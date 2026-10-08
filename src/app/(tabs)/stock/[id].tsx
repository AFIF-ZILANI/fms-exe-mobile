import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { IconTile } from '@/components/ui/icon';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { humanise } from '@/lib/profile-format';
import { formatBalance, groupLocations, summarizeStock, type StockRow } from '@/lib/stock-summary';
import type { Item } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

/** docs/navigation-redesign-design.md Phase 4 — one item: total, reorder level, and where it is. Read-only. */
export default function StockItemScreen() {
  const theme = useTheme();
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

  const place = (title: string, list: { name: string; type: string; balance: number }[], icon: 'archive' | 'home') =>
    list.length === 0 ? null : (
      <Card rows eyebrow={title} note={String(list.length)} style={styles.card}>
        {list.map((l, i) => (
          <LedgerRow
            key={`${l.type}-${l.name}`}
            gutterNode={<IconTile name={icon} tint="surfaceAlt" color="muted" size={32} />}
            last={i === list.length - 1}
          >
            <View style={styles.rowTop}>
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                {l.name}
              </AppText>
              <AppText variant="figure">{formatBalance(l.balance)}</AppText>
            </View>
            <AppText variant="caption" color="muted">
              {unit}
            </AppText>
          </LedgerRow>
        ))}
      </Card>
    );

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
            <Skeleton key={i} height={72} />
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
          <Card style={styles.card}>
            <AppText variant="caption" color="muted">
              {humanise(line.item.category)} · {unit}
            </AppText>
            <View style={styles.rowTop}>
              <AppText variant="figure" color={line.isLow ? 'warning' : 'ink'} style={styles.flex}>
                {formatBalance(line.balance)} {unit} in total
              </AppText>
              {line.isLow ? <StatusPill status="LOW" label="Low" /> : null}
            </View>
            {line.item.reorder_level != null && Number.isFinite(Number(line.item.reorder_level)) ? (
              <AppText variant="caption" color="muted">
                Reorder level {formatBalance(Number(line.item.reorder_level))} {unit}
              </AppText>
            ) : null}
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
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
