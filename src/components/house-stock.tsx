import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { categoryIcon } from '@/components/stock-item-card';
import { useResolvedBatch } from '@/components/ui/batch-resolver';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { codeTail, houseSupplies, unitActions, type HouseSupply } from '@/lib/house-stock';
import { scanErrorMessage } from '@/lib/scan';
import { unitUseBody } from '@/lib/scan-actions';
import { formatBalance, type StockRow } from '@/lib/stock-summary';
import type { House, Item, StockUnit } from '@/lib/types';

const PREVIEW = 5;

type Tint = 'tintBlue' | 'tintGreen' | 'tintAmber' | 'surfaceAlt';
type Tone = 'info' | 'success' | 'warning' | 'muted';

/** Sealed units waiting in the house, and opened ones being used. */
export type UnitSection = 'sealed' | 'in-use';

const SECTIONS = {
  sealed: {
    status: 'BOUND',
    title: 'Sealed',
    slug: 'allocated-stocks',
    icon: 'package' as IconName,
    tint: 'tintBlue' as Tint,
    tone: 'info' as Tone,
    since: 'in since',
    empty: { title: 'Nothing sealed here.', body: 'Units moved into this house wait here until someone opens one.' },
  },
  'in-use': {
    status: 'IN_USE',
    title: 'In use',
    slug: 'in-use-stocks',
    icon: 'play-circle' as IconName,
    tint: 'tintGreen' as Tint,
    tone: 'success' as Tone,
    since: 'here since',
    empty: { title: 'Nothing open right now.', body: 'Start using a sealed unit and it shows up here.' },
  },
} as const;

/** Units of one kind physically in a house (their latest allocation is here). */
export function useHouseUnits(houseId: string, section: UnitSection, limit: number) {
  return useGetData<Paginated<StockUnit>>(
    `/stock-units?house_id=${houseId}&status=${SECTIONS[section].status}&limit=${limit}`,
    ['stock-units', 'house', houseId, section, limit],
  );
}

/** Feed and other uncoded supplies held in this house. Same URLs and keys as the Stock tab. */
export function useHouseSupplies(houseId: string) {
  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);
  const supplies = items.data && rows.data ? houseSupplies(items.data.results, rows.data, houseId) : undefined;
  return {
    supplies,
    isPending: items.isPending || rows.isPending,
    isError: (items.isError && !items.data) || (rows.isError && !rows.data),
    refetch: () => Promise.allSettled([items.refetch(), rows.refetch()]),
  };
}

type UseAction = 'start' | 'finish';

/** Start or finish one unit straight from the list. One unit at a time, like the scanner. */
function useUnitAction(houseId: string) {
  const queryClient = useQueryClient();
  const { balance } = useResolvedBatch(houseId);
  const [busy, setBusy] = useState<{ id: string; action: UseAction } | null>(null);

  const send = async (unit: StockUnit, action: UseAction) => {
    setBusy({ id: unit.id, action });
    try {
      await apiFetch(`/stock-units/${unit.id}/use`, {
        method: 'POST',
        body: JSON.stringify(
          unitUseBody(action, { houseId, batchId: balance?.batch_id, now: new Date(), key: Crypto.randomUUID() }),
        ),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Both lists, the Used stock history and the Stock tab's levels all move.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-units'] }),
        queryClient.invalidateQueries({ queryKey: ['house-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['consumptions'] }),
        queryClient.invalidateQueries({ queryKey: ['items'] }),
      ]);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const message = err instanceof ApiError ? scanErrorMessage(err.status, err.message) : 'Something went wrong.';
      Alert.alert(action === 'start' ? "Couldn't start it" : "Couldn't record it", message);
    } finally {
      setBusy(null);
    }
  };

  const run = (unit: StockUnit, action: UseAction) => {
    if (busy) return;
    if (action === 'start') return void send(unit, 'start');
    // Finishing logs what was left as used and can't be taken back from the phone: ask first.
    const name = unit.purchase_item?.item.name ?? 'this unit';
    Alert.alert(`${name} ${codeTail(unit.id)} consumed?`, 'What was left in it is recorded as used in this house.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Consumed', style: 'destructive', onPress: () => void send(unit, 'finish') },
    ]);
  };

  return { run, busy };
}

/** A card's own header: what the section is, how many, and the way into the full list. */
export function SectionHead({
  title,
  icon,
  tint,
  tone,
  count,
  onSeeAll,
}: {
  title: string;
  icon: IconName;
  tint: Tint;
  tone: Tone;
  /** Left out where the total isn't known (a preview of a long history). */
  count?: number;
  onSeeAll?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.head}>
      <IconTile name={icon} tint={tint} color={tone} size={32} />
      <AppText variant="bodyStrong">{title}</AppText>
      {count !== undefined ? (
        <View style={[styles.count, { backgroundColor: theme[tint] }]}>
          <AppText variant="data" color={tone}>
            {count}
          </AppText>
        </View>
      ) : null}
      <View style={styles.flex} />
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} accessibilityRole="link" hitSlop={12} style={styles.seeAll}>
          <AppText variant="label" color="primary">
            See all
          </AppText>
          <Icon name="chevron-right" size={16} color="primary" />
        </Pressable>
      ) : null}
    </View>
  );
}

type Segment = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** The main thing to do with this unit: tinted, the rest stay neutral. */
  main?: boolean;
  disabled?: boolean;
  loading?: boolean;
  done?: boolean;
};

/** One slim bar of equal segments under a row. Quieter than separate buttons, and it stays on one line
 *  at large system font sizes (labels shrink a little rather than wrap). */
function ActionBar({ segments }: { segments: Segment[] }) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderColor: theme.line }]}>
      {segments.map((s, i) => {
        const off = s.disabled || s.loading;
        const color: ThemeColor = s.done ? 'success' : s.main ? 'primary' : 'ink';
        return (
          <Pressable
            key={s.key}
            onPress={s.onPress}
            disabled={off}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            accessibilityState={{ disabled: !!off }}
            style={({ pressed }) => [
              styles.segment,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.line },
              s.main && { backgroundColor: theme.primarySoft },
              pressed && { backgroundColor: theme.surfaceAlt },
              s.disabled && styles.disabled,
            ]}
          >
            {s.loading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Icon name={s.done ? 'check' : s.icon} size={16} color={color} />
            )}
            <AppText
              variant="label"
              color={color}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.segmentLabel}
            >
              {s.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One coded unit: what it is, its code, how long it's been here, and what can be done with it. */
function UnitRow({
  unit,
  section,
  houseId,
  offline,
  action,
}: {
  unit: StockUnit;
  section: UnitSection;
  houseId: string;
  offline: boolean;
  action: ReturnType<typeof useUnitAction>;
}) {
  const theme = useTheme();
  const cfg = SECTIONS[section];
  const [copied, setCopied] = useState(false);
  const item = unit.purchase_item?.item;
  const can = unitActions(unit, houseId);
  const busy = action.busy?.id === unit.id ? action.busy.action : null;
  const blocked = offline || (action.busy !== null && !busy);
  const arrived = unit.houseAllocations?.[0]?.occurred_at;

  const copy = async () => {
    // The whole id is the QR payload, so it pastes into the dashboard's search as-is.
    await Clipboard.setStringAsync(unit.id).catch(() => {});
    void Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const segments: Segment[] = [];
  if (can.start)
    segments.push({
      key: 'start',
      label: 'Start',
      icon: 'play',
      main: true,
      onPress: () => action.run(unit, 'start'),
      disabled: blocked || busy === 'finish',
      loading: busy === 'start',
    });
  if (can.finish)
    segments.push({
      key: 'finish',
      label: 'Consumed',
      icon: 'check-circle',
      main: !can.start,
      onPress: () => action.run(unit, 'finish'),
      disabled: blocked || busy === 'start',
      loading: busy === 'finish',
    });
  segments.push({ key: 'copy', label: copied ? 'Copied' : 'Copy', icon: 'copy', onPress: () => void copy(), done: copied });

  return (
    <View style={[styles.row, { borderTopColor: theme.line }]}>
      <View style={styles.rowHead}>
        <IconTile name={item ? categoryIcon(item.category) : cfg.icon} tint={cfg.tint} color={cfg.tone} size={32} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item?.name ?? 'Unit'}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            <AppText variant="data" color="muted">
              {codeTail(unit.id)}
            </AppText>
            {arrived ? `  ·  ${cfg.since} ${formatRelative(arrived)}` : ''}
          </AppText>
        </View>
      </View>
      <ActionBar segments={segments} />
    </View>
  );
}

/** A supply without codes: how much this house holds, and a way to log what it used. */
function SupplyRow({ supply, houseId }: { supply: HouseSupply; houseId: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.rowHead, { borderTopColor: theme.line }]}>
      <IconTile name={categoryIcon(supply.item.category)} tint="tintAmber" color="warning" size={32} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {supply.item.name}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          <AppText variant="data" color="ink">
            {formatBalance(supply.balance)}
          </AppText>
          {` ${supply.item.unit.toLowerCase()} in this house`}
        </AppText>
      </View>
      <Pressable
        onPress={() => router.push(`/log/consumption?house_id=${houseId}&item_id=${supply.item.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Log ${supply.item.name} consumed`}
        style={({ pressed }) => [
          styles.tonal,
          { backgroundColor: theme.primarySoft },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <Icon name="edit-3" size={16} color="primary" />
        <AppText variant="label" color="primary" numberOfLines={1}>
          Consumed
        </AppText>
      </Pressable>
    </View>
  );
}

function OfflineNote() {
  return (
    <View style={styles.offline}>
      <Icon name="wifi-off" size={14} color="muted" />
      <AppText variant="caption" color="muted">
        Starting and finishing needs a connection.
      </AppText>
    </View>
  );
}

/** The house screen's card for one unit kind: the first few with actions, and the full page behind
 *  "See all". Renders nothing while empty, like the other stock cards. */
export function HouseUnitsCard({ houseId, section }: { houseId: string; section: UnitSection }) {
  const cfg = SECTIONS[section];
  const q = useHouseUnits(houseId, section, PREVIEW);
  const action = useUnitAction(houseId);
  const offline = useNetworkState().isConnected === false;
  const units = q.data?.results ?? [];
  if (units.length === 0) return null;
  const total = q.data?.total ?? units.length;

  return (
    <Card rows style={styles.card}>
      <SectionHead
        title={cfg.title}
        icon={cfg.icon}
        tint={cfg.tint}
        tone={cfg.tone}
        count={total}
        // Sealed always links through: its page also holds the move-in history.
        onSeeAll={
          total > units.length || section === 'sealed'
            ? () => router.push(`/houses/${houseId}/${cfg.slug}` as Href)
            : undefined
        }
      />
      {units.map((unit) => (
        <UnitRow key={unit.id} unit={unit} section={section} houseId={houseId} offline={offline} action={action} />
      ))}
      {offline ? <OfflineNote /> : null}
    </Card>
  );
}

/** The house screen's card of feed and supplies held in this house. */
export function HouseSuppliesCard({ houseId }: { houseId: string }) {
  const { supplies } = useHouseSupplies(houseId);
  if (!supplies || supplies.length === 0) return null;
  const shown = supplies.slice(0, PREVIEW);

  return (
    <Card rows style={styles.card}>
      <SectionHead
        title="Feed & supplies"
        icon="package"
        tint="tintAmber"
        tone="warning"
        count={supplies.length}
        onSeeAll={
          supplies.length > shown.length ? () => router.push(`/houses/${houseId}/bulk-stocks` as Href) : undefined
        }
      />
      {shown.map((supply) => (
        <SupplyRow key={supply.item.id} supply={supply} houseId={houseId} />
      ))}
    </Card>
  );
}

const MAX = 100; // the server caps a page at 100

/** houses/:id/allocated-stocks and houses/:id/in-use-stocks: every unit of that kind in the house. */
export function HouseUnitsScreen({ section }: { section: UnitSection }) {
  const cfg = SECTIONS[section];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const q = useHouseUnits(id, section, MAX);
  const action = useUnitAction(id);
  const offline = useNetworkState().isConnected === false;
  const units = q.data?.results ?? [];
  const total = q.data?.total ?? 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([houseQ.refetch(), q.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <Header
        title={section === 'sealed' ? 'Sealed stock' : 'In use'}
        eyebrow={houseQ.data?.name}
        leading="back"
        // The move-in history used to be this page; it stays one tap away.
        action={
          section === 'sealed'
            ? {
                icon: 'clock',
                label: 'Move-in history',
                onPress: () => router.push(`/houses/${id}/allocation-history` as Href),
              }
            : undefined
        }
      />

      {q.isPending ? (
        <Skeleton height={220} />
      ) : q.isError && !q.data ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this."
            action={{ label: 'Retry', onPress: () => void q.refetch() }}
          />
        </Card>
      ) : units.length === 0 ? (
        <Card>
          <EmptyState compact icon={cfg.icon} tint="surfaceAlt" title={cfg.empty.title} body={cfg.empty.body} />
        </Card>
      ) : (
        <Card rows style={styles.card}>
          <SectionHead title={cfg.title} icon={cfg.icon} tint={cfg.tint} tone={cfg.tone} count={total} />
          {units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} section={section} houseId={id} offline={offline} action={action} />
          ))}
          {offline ? <OfflineNote /> : null}
          {total > units.length ? (
            <AppText variant="caption" color="muted" style={styles.more}>
              Showing the first {units.length} of {total}.
            </AppText>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

/** houses/:id/bulk-stocks: every uncoded supply this house holds. */
export function BulkStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const q = useHouseSupplies(id);
  const supplies = q.supplies ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([houseQ.refetch(), q.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <Header title="Feed & supplies" eyebrow={houseQ.data?.name} leading="back" />
      {q.isPending ? (
        <Skeleton height={220} />
      ) : q.isError ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this."
            action={{ label: 'Retry', onPress: () => void q.refetch() }}
          />
        </Card>
      ) : supplies.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="package"
            tint="surfaceAlt"
            title="No feed or supplies in this house."
            body="Feed and other uncoded supplies show up here once they're moved into the house."
          />
        </Card>
      ) : (
        <Card rows style={styles.card}>
          <SectionHead title="Feed & supplies" icon="package" tint="tintAmber" tone="warning" count={supplies.length} />
          {supplies.map((supply) => (
            <SupplyRow key={supply.item.id} supply={supply} houseId={id} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.lg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    // The card already pads its rows top and bottom.
    paddingBottom: Spacing.md,
  },
  count: { minWidth: 26, paddingHorizontal: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, borderTopWidth: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bar: { flexDirection: 'row', height: 40, borderWidth: 1, borderRadius: Radius.control, overflow: 'hidden' },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  segmentLabel: { flexShrink: 1 },
  disabled: { opacity: 0.4 },
  tonal: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  more: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
});
