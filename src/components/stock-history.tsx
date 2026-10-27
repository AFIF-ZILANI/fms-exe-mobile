import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { IconTile, type IconName } from '@/components/ui/icon';
import { ItemPicker } from '@/components/ui/item-picker';
import { KpiTile } from '@/components/ui/kpi-tile';
import { PillSelect } from '@/components/ui/pill-select';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import {
  RANGES,
  allocationRow,
  consumptionRow,
  rangeFrom,
  summaryWindows,
  type ActivityRowData,
  type Range,
} from '@/lib/stock-history';
import type { House, HouseAllocation, HouseConsumption, Item, StockActivitySummary } from '@/lib/types';

export type StockKind = 'allocated' | 'used';

/** Everything that differs between the two histories. The pages themselves are identical. */
const KINDS = {
  allocated: {
    title: 'Move-in history',
    path: '/stock-house-allocations',
    icon: 'arrow-down-circle' as IconName,
    toRow: (r: HouseAllocation) => allocationRow(r),
    empty: { title: 'Nothing allocated yet.', body: 'Units moved into this house show up here.' },
    kpis: { total: 'Units in', today: 'In today', week: 'Last 7 days', items: 'Items' },
  },
  used: {
    title: 'Used stock',
    path: '/consumptions',
    icon: 'box' as IconName,
    toRow: (r: HouseConsumption) => consumptionRow(r),
    empty: { title: 'Nothing used yet.', body: 'Stock drawn in this house shows up here.' },
    kpis: { total: 'Draws', today: 'Used today', week: 'Last 7 days', items: 'Items' },
  },
} as const;

const PAGE = 20;
const MAX = 100; // the server caps a page at 100

function toRows(kind: StockKind, results: (HouseAllocation | HouseConsumption)[] | undefined): ActivityRowData[] {
  if (!results) return [];
  return kind === 'allocated'
    ? (results as HouseAllocation[]).map(allocationRow)
    : (results as HouseConsumption[]).map(consumptionRow);
}

/** A list of rows in one card, newest first. The same row on the house screen and the full page. */
function ActivityRows({ kind, rows }: { kind: StockKind; rows: ActivityRowData[] }) {
  const theme = useTheme();
  return (
    <>
      {rows.map((row, i) => (
        <View
          key={row.id}
          style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}
        >
          <IconTile name={KINDS[kind].icon} tint="surfaceAlt" color="muted" size={32} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {row.title}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {row.subtitle}
            </AppText>
          </View>
          <AppText variant="caption" color="muted">
            {formatRelative(row.at)}
          </AppText>
        </View>
      ))}
    </>
  );
}

/** The house screen's section: the five latest rows and a way into the full page. Renders nothing
 *  until there is something to show, so an unused house isn't cluttered with empty cards. */
export function StockPreviewCard({
  kind,
  houseId,
  results,
}: {
  kind: StockKind;
  houseId: string;
  results: (HouseAllocation | HouseConsumption)[] | undefined;
}) {
  const rows = toRows(kind, results);
  if (rows.length === 0) return null;
  const slug = kind === 'allocated' ? 'allocation-history' : 'used-stocks';

  return (
    <Card
      rows
      eyebrow={KINDS[kind].title}
      action="See all"
      onActionPress={() => router.push(`/houses/${houseId}/${slug}` as Href)}
      style={styles.preview}
    >
      <ActivityRows kind={kind} rows={rows} />
    </Card>
  );
}

/** The latest five for the house screen. Written as a hook so the screen can refresh it with the rest. */
export function useStockPreview(kind: StockKind, houseId: string) {
  return useGetData<Paginated<HouseAllocation | HouseConsumption>>(
    `${KINDS[kind].path}?house_id=${houseId}&limit=5`,
    ['house-stock', kind, houseId, 'preview'],
  );
}

type TypeFilter = 'all' | 'ALLOCATION' | 'REALLOCATION';
const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ALLOCATION', label: 'Allocated' },
  { value: 'REALLOCATION', label: 'Moved in' },
];

/** houses/:id/allocated-stocks and houses/:id/used-stocks: KPIs, filters, then every row. */
export function StockHistoryScreen({ kind }: { kind: StockKind }) {
  const cfg = KINDS[kind];
  const { id } = useLocalSearchParams<{ id: string }>();

  // Read once per mount and on pull-down: `new Date()` during render is impure.
  const [now, setNow] = useState(() => new Date());
  const [range, setRange] = useState<Range>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [item, setItem] = useState<Item | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);

  const windows = summaryWindows(now);
  const from = rangeFrom(range, now);

  const params = new URLSearchParams({ house_id: id, limit: String(limit) });
  if (from) params.set('occurred_from', from);
  if (item) params.set('item_id', item.id);
  if (kind === 'allocated' && type !== 'all') params.set('type', type);

  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const summaryQ = useGetData<StockActivitySummary>(
    `${cfg.path}/summary?house_id=${id}&today_from=${encodeURIComponent(windows.today_from)}&week_from=${encodeURIComponent(windows.week_from)}`,
    ['house-stock', kind, id, 'summary', windows.today_from],
  );
  const listQ = useGetData<Paginated<HouseAllocation | HouseConsumption>>(
    `${cfg.path}?${params.toString()}`,
    ['house-stock', kind, id, 'list', range, type, item?.id ?? 'any', limit, now.toDateString()],
  );

  const rows = toRows(kind, listQ.data?.results);
  const total = listQ.data?.total ?? 0;
  const filtered = range !== 'all' || type !== 'all' || item !== null;
  const summary = summaryQ.data;

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(PAGE);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      await Promise.allSettled([houseQ.refetch(), summaryQ.refetch(), listQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Header title={cfg.title} eyebrow={houseQ.data?.name} leading="back" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kpiScroll}
        contentContainerStyle={styles.kpiRow}
      >
        <View style={styles.kpiCard}>
          <KpiTile
            icon={cfg.icon}
            tint="tintBlue"
            tone="info"
            label={cfg.kpis.total}
            value={summary ? String(summary.total) : '–'}
            note={summary?.last_at ? `Last ${formatRelative(summary.last_at)}` : 'None yet'}
          />
        </View>
        <View style={styles.kpiCard}>
          <KpiTile
            icon="sun"
            tint="tintAmber"
            tone="warning"
            label={cfg.kpis.today}
            value={summary ? String(summary.today) : '–'}
            note="Since midnight"
          />
        </View>
        <View style={styles.kpiCard}>
          <KpiTile
            icon="calendar"
            tint="tintGreen"
            tone="success"
            label={cfg.kpis.week}
            value={summary ? String(summary.week) : '–'}
            note="Today and 6 days back"
          />
        </View>
        <View style={styles.kpiCard}>
          <KpiTile
            icon="layers"
            tint="tintBlue"
            tone="info"
            label={cfg.kpis.items}
            value={summary ? String(summary.items) : '–'}
            note="Different items"
          />
        </View>
      </ScrollView>

      <View style={styles.filters}>
        <PillSelect options={RANGES} value={range} onChange={reset(setRange)} />
        {kind === 'allocated' ? <PillSelect options={TYPES} value={type} onChange={reset(setType)} /> : null}
        <ItemPicker
          value={item}
          onChange={reset(setItem)}
          onClear={() => reset(setItem)(null)}
          placeholder="All items"
        />
      </View>

      <View style={styles.sectionHead}>
        <AppText variant="h2">{filtered ? 'Matching' : 'All'}</AppText>
        <AppText variant="caption" color="muted">
          {listQ.data ? `${rows.length} of ${total}` : ''}
        </AppText>
      </View>

      {listQ.isPending ? (
        <Skeleton height={160} />
      ) : listQ.isError && !listQ.data ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this."
            action={{ label: 'Retry', onPress: () => void listQ.refetch() }}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={cfg.icon}
            tint="surfaceAlt"
            title={filtered ? 'Nothing matches these filters.' : cfg.empty.title}
            body={filtered ? 'Try a wider range or another item.' : cfg.empty.body}
          />
        </Card>
      ) : (
        <>
          <Card rows>
            <ActivityRows kind={kind} rows={rows} />
          </Card>
          {rows.length < total && limit < MAX ? (
            <Button
              variant="ghost"
              label="Show more"
              block
              onPress={() => setLimit((l) => Math.min(MAX, l + PAGE))}
            />
          ) : null}
          {rows.length < total && limit >= MAX ? (
            <AppText variant="caption" color="muted" style={styles.cap}>
              Showing the latest {MAX}. Narrow the range or pick an item to see older ones.
            </AppText>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  preview: { marginTop: Spacing.xl },
  // Bleeds to the screen edges so the tiles slide under the padding instead of stopping at it.
  kpiScroll: { marginHorizontal: -Spacing.xl, marginTop: Spacing.md },
  kpiRow: { gap: Spacing.md, paddingHorizontal: Spacing.xl },
  kpiCard: { width: 168 },
  filters: { gap: Spacing.md, marginTop: Spacing.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  cap: { textAlign: 'center', marginTop: Spacing.md },
});
