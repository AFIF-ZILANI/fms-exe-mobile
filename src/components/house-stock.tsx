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
import { bulkLines, codeTail, unitActions } from '@/lib/house-stock';
import { scanErrorMessage } from '@/lib/scan';
import { unitUseBody } from '@/lib/scan-actions';
import { formatBalance, summarizeStock, type StockLine, type StockRow } from '@/lib/stock-summary';
import type { House, Item, StockUnit } from '@/lib/types';

const PREVIEW = 5;

/** Sealed units waiting in the house, and opened ones being used. */
export type UnitSection = 'sealed' | 'in-use';

const SECTIONS = {
  sealed: {
    status: 'BOUND',
    title: 'Sealed in this house',
    slug: 'allocated-stocks',
    icon: 'package' as IconName,
    tint: 'tintBlue' as const,
    color: 'info' as const,
    since: 'In since',
    empty: { title: 'Nothing sealed here.', body: 'Units moved into this house wait here until someone opens one.' },
  },
  'in-use': {
    status: 'IN_USE',
    title: 'In use',
    slug: 'in-use-stocks',
    icon: 'play-circle' as IconName,
    tint: 'tintGreen' as const,
    color: 'success' as const,
    since: 'Here since',
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

/** Supplies without codes (feed, husk…) that have stock to draw on. Same URLs and keys as the Stock tab. */
export function useBulkStock() {
  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);
  const lines = items.data && rows.data ? bulkLines(summarizeStock(items.data.results, rows.data)) : undefined;
  return {
    lines,
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
    Alert.alert(
      `${name} ${codeTail(unit.id)} used up?`,
      'What was left in it is recorded as used in this house.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Used up', style: 'destructive', onPress: () => void send(unit, 'finish') },
      ],
    );
  };

  return { run, busy };
}

type ChipTone = 'primary' | 'neutral';

/** A compact action under a row: big enough for a gloved thumb, small enough that three fit. */
function ActionChip({
  label,
  icon,
  tone = 'neutral',
  onPress,
  disabled,
  loading,
  done,
}: {
  label: string;
  icon: IconName;
  tone?: ChipTone;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Briefly shows a check in place of the icon (Copied). */
  done?: boolean;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';
  const fg: ThemeColor = primary ? 'onPrimary' : 'ink';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: primary ? theme.primary : theme.surfaceAlt },
        (disabled || loading) && styles.chipDisabled,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? '#FFFFFF' : theme.muted} />
      ) : (
        <Icon name={done ? 'check' : icon} size={16} color={done ? 'success' : fg} />
      )}
      <AppText variant="label" color={done ? 'success' : fg} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** One coded unit: what it is, its code, how long it's been here, and what can be done with it. */
function UnitRow({
  unit,
  section,
  houseId,
  offline,
  action,
  first,
}: {
  unit: StockUnit;
  section: UnitSection;
  houseId: string;
  offline: boolean;
  action: ReturnType<typeof useUnitAction>;
  first: boolean;
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

  return (
    <View style={[styles.unit, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}>
      <View style={styles.unitHead}>
        <IconTile name={item ? categoryIcon(item.category) : cfg.icon} tint={cfg.tint} color={cfg.color} size={40} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item?.name ?? 'Unit'}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="data" color="muted">
              {codeTail(unit.id)}
            </AppText>
            {arrived ? (
              <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flex}>
                {`  ·  ${cfg.since.toLowerCase()} ${formatRelative(arrived)}`}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {can.start ? (
          <ActionChip
            label="Start using"
            icon="play"
            tone="primary"
            onPress={() => action.run(unit, 'start')}
            disabled={blocked || busy === 'finish'}
            loading={busy === 'start'}
          />
        ) : null}
        {can.finish ? (
          <ActionChip
            label="Consumed"
            icon="check-circle"
            tone={can.start ? 'neutral' : 'primary'}
            onPress={() => action.run(unit, 'finish')}
            disabled={blocked || busy === 'start'}
            loading={busy === 'finish'}
          />
        ) : null}
        <ActionChip label={copied ? 'Copied' : 'Copy code'} icon="copy" onPress={() => void copy()} done={copied} />
      </View>
    </View>
  );
}

/** A supply without codes: how much is in stock, and a way to log what this house used. */
function BulkRow({ line, houseId, first }: { line: StockLine; houseId: string; first: boolean }) {
  const theme = useTheme();
  const unit = line.item.unit.toLowerCase();
  return (
    <View style={[styles.unit, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}>
      <View style={styles.unitHead}>
        <IconTile name={categoryIcon(line.item.category)} tint="tintAmber" color="warning" size={40} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {line.item.name}
          </AppText>
          <AppText variant="caption" color={line.isLow ? 'warning' : 'muted'} numberOfLines={1}>
            {`${formatBalance(line.balance)} ${unit} in stock${line.isLow ? ' · low' : ''}`}
          </AppText>
        </View>
        <ActionChip
          label="Consumed"
          icon="edit-3"
          tone="primary"
          onPress={() =>
            router.push(`/log/consumption?house_id=${houseId}&item_id=${line.item.id}` as Href)
          }
        />
      </View>
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
    <Card
      rows
      eyebrow={`${cfg.title} · ${total}`}
      action={total > units.length ? 'See all' : undefined}
      onActionPress={() => router.push(`/houses/${houseId}/${cfg.slug}` as Href)}
      style={styles.card}
    >
      {units.map((unit, i) => (
        <UnitRow
          key={unit.id}
          unit={unit}
          section={section}
          houseId={houseId}
          offline={offline}
          action={action}
          first={i === 0}
        />
      ))}
      {offline ? <OfflineNote /> : null}
    </Card>
  );
}

/** The house screen's card of supplies without codes. */
export function BulkStockCard({ houseId }: { houseId: string }) {
  const { lines } = useBulkStock();
  if (!lines || lines.length === 0) return null;
  const shown = lines.slice(0, PREVIEW);

  return (
    <Card
      rows
      eyebrow={`Feed & supplies · ${lines.length}`}
      action={lines.length > shown.length ? 'See all' : undefined}
      onActionPress={() => router.push(`/houses/${houseId}/bulk-stocks` as Href)}
      style={styles.card}
    >
      {shown.map((line, i) => (
        <BulkRow key={line.item.id} line={line} houseId={houseId} first={i === 0} />
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
        title={cfg.title}
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
        <>
          <AppText variant="caption" color="muted" style={styles.count}>
            {total > units.length ? `Showing ${units.length} of ${total}` : `${total} unit${total === 1 ? '' : 's'}`}
          </AppText>
          <Card rows>
            {units.map((unit, i) => (
              <UnitRow
                key={unit.id}
                unit={unit}
                section={section}
                houseId={id}
                offline={offline}
                action={action}
                first={i === 0}
              />
            ))}
            {offline ? <OfflineNote /> : null}
          </Card>
        </>
      )}
    </Screen>
  );
}

/** houses/:id/bulk-stocks: every supply without codes that has stock. */
export function BulkStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const bulk = useBulkStock();
  const lines = bulk.lines ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([houseQ.refetch(), bulk.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <Header title="Feed & supplies" eyebrow={houseQ.data?.name} leading="back" />
      {bulk.isPending ? (
        <Skeleton height={220} />
      ) : bulk.isError ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this."
            action={{ label: 'Retry', onPress: () => void bulk.refetch() }}
          />
        </Card>
      ) : lines.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="package"
            tint="surfaceAlt"
            title="No feed or supplies in stock."
            body="Purchased feed and other uncoded supplies show up here."
          />
        </Card>
      ) : (
        <Card rows>
          {lines.map((line, i) => (
            <BulkRow key={line.item.id} line={line} houseId={id} first={i === 0} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.xl },
  unit: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  unitHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meta: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  chipDisabled: { opacity: 0.45 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  count: { marginTop: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
});
