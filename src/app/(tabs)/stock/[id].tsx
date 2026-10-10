import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { LevelBar, categoryIcon } from '@/components/stock-item-card';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { IconTile } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { humanise } from '@/lib/profile-format';
import {
  formatBalance,
  groupLocations,
  reorderGap,
  stockState,
  summarizeStock,
  type StockRow,
} from '@/lib/stock-summary';
import type { Item } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

type Place = { name: string; type: string; balance: number };

/** docs/navigation-redesign-design.md Phase 4 — one item: total, how it stands against its reorder level, and where it is. Read-only. */
export default function StockItemScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  // Same URLs and keys as the Stock tab, so this opens instantly from its cache.
  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);

  const line = useMemo(
    () => summarizeStock(items.data?.results ?? [], rows.data ?? []).find((l) => l.item.id === id),
    [items.data, rows.data, id],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.race([
        Promise.allSettled([items.refetch(), rows.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = (items.isPending && !items.data) || (rows.isPending && !rows.data);
  const groups = line ? groupLocations(line) : null;
  const unit = line?.item.unit.toLowerCase() ?? '';
  const state = line ? stockState(line) : 'OK';
  const gap = line ? reorderGap(line) : null;
  const tone = state === 'OUT' ? 'critical' : state === 'LOW' ? 'warning' : 'ink';

  const place = (title: string, list: Place[], icon: 'archive' | 'home') => {
    if (list.length === 0 || !line) return null;
    return (
      <>
        <View style={styles.sectionHead}>
          <AppText variant="eyebrow" color="muted">
            {title}
          </AppText>
          <AppText variant="data" color="muted">
            {list.length}
          </AppText>
        </View>
        <View style={styles.list}>
          {list.map((l) => {
            const share = line.balance > 0 ? Math.max(0, Math.min(1, l.balance / line.balance)) : 0;
            return (
              <View
                key={`${l.type}-${l.name}`}
                accessible
                accessibilityLabel={`${l.name}, ${formatBalance(l.balance)} ${unit}`}
                style={[styles.place, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}
              >
                <IconTile name={icon} tint="surfaceAlt" color="muted" />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {l.name}
                  </AppText>
                  <View style={[styles.track, { backgroundColor: theme.line }]}>
                    <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: theme.primary }]} />
                  </View>
                </View>
                <View style={styles.qty}>
                  <AppText variant="figure">{formatBalance(l.balance)}</AppText>
                  <AppText variant="caption" color="muted">
                    {unit}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title={line?.item.name ?? 'Item'} leading="back" />
      <SyncBanner />

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={96} />
          ))}
        </View>
      ) : !line || !groups ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="package"
            tint="surfaceAlt"
            title="Item not found."
            body="It may have been retired. Pull down to refresh."
          />
        </Card>
      ) : (
        <>
          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <IconTile
                name={categoryIcon(line.item.category)}
                tint={state === 'OUT' ? 'tintRed' : state === 'LOW' ? 'tintAmber' : 'surfaceAlt'}
                color={state === 'OUT' ? 'critical' : state === 'LOW' ? 'warning' : 'muted'}
                size={56}
              />
              <View style={styles.flex}>
                <AppText variant="caption" color="muted">
                  {humanise(line.item.category)}
                </AppText>
                <View style={styles.heroNumber}>
                  <AppText variant="stat" color={tone}>
                    {formatBalance(line.balance)}
                  </AppText>
                  <AppText variant="label" color="muted">
                    {unit} in total
                  </AppText>
                </View>
              </View>
              {state === 'LOW' ? <StatusPill status="LOW" label="Low" /> : null}
              {state === 'OUT' ? <StatusPill status="OVERDUE" label="Out" /> : null}
            </View>

            {gap ? (
              <View style={styles.level}>
                <LevelBar line={line} />
                <AppText variant="caption" color={gap.short ? 'warning' : 'muted'}>
                  {gap.short
                    ? `${formatBalance(gap.amount)} ${unit} short of the reorder level (${formatBalance(Number(line.item.reorder_level))})`
                    : `${formatBalance(gap.amount)} ${unit} above the reorder level (${formatBalance(Number(line.item.reorder_level))})`}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" color="muted" style={styles.level}>
                No reorder level set.
              </AppText>
            )}
          </Card>

          {groups.warehouses.length + groups.houses.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState compact icon="archive" tint="surfaceAlt" title="None in stock anywhere." />
            </Card>
          ) : (
            <>
              {place('Warehouses', groups.warehouses, 'archive')}
              {place('Houses', groups.houses, 'home')}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  hero: { marginTop: Spacing.md, gap: Spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroNumber: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  level: { gap: Spacing.xs },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginTop: Spacing.xl,
  },
  list: { gap: Spacing.sm, marginTop: Spacing.sm },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.sm },
  fill: { height: '100%', borderRadius: Radius.pill },
  qty: { alignItems: 'flex-end', minWidth: 56 },
});
