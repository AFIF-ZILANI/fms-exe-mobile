import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useHouseOptions } from '@/components/ui/house-picker';
import { dayOfCycle, expectedCycleDays, houseToken } from '@/lib/farm';
import { formatBatchCode } from '@/lib/format';
import type { BatchHouseBalance, House } from '@/lib/types';

const FILTERS = ['ALL', 'BROODER', 'GROWER', 'LAYER'] as const;
type Filter = (typeof FILTERS)[number];

/** A filter above a three-row list is furniture. docs/layout/04-houses.md. */
const FILTER_THRESHOLD = 3;

/** docs/layout/04-houses.md — pick where you are. */
export default function HousesScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('ALL');

  const { data: houses, isLoading, isError, refetch } = useHouseOptions();
  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    '/batch-house-balances?limit=100',
    ['batch-house-balances', 'all'],
  );

  const balanceFor = (houseId: string) =>
    (balances?.results ?? []).find((b) => b.house_id === houseId && b.quantity > 0);

  const all = useMemo(
    // Sorted by token, always. A worker's model of the farm is spatial, and
    // reordering between visits breaks it. docs/layout/04-houses.md.
    () => [...(houses?.results ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [houses?.results],
  );

  const shown = filter === 'ALL' ? all : all.filter((h) => h.type === filter);

  return (
    <Screen>
      <Header title="Houses" />
      <SyncBanner />

      {all.length > FILTER_THRESHOLD && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primarySoft : theme.surface,
                    borderColor: active ? theme.primary : theme.line,
                  },
                ]}
              >
                <AppText variant="label" color={active ? 'primary' : 'inkSoft'}>
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Card rows style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load houses."
            action={{ label: 'Retry', onPress: () => void refetch() }}
          />
        ) : all.length === 0 ? (
          <EmptyState
            compact
            icon="home"
            tint="surfaceAlt"
            title="No active houses."
            body="Houses are set up in the admin dashboard."
          />
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon="filter"
            tint="surfaceAlt"
            title={`No ${filter.toLowerCase()} houses.`}
            action={{ label: 'Show all', onPress: () => setFilter('ALL') }}
          />
        ) : (
          shown.map((house, i) => (
            <HouseRow
              key={house.id}
              house={house}
              balance={balanceFor(house.id)}
              last={i === shown.length - 1}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

function HouseRow({
  house,
  balance,
  last,
}: {
  house: House;
  balance?: BatchHouseBalance;
  last: boolean;
}) {
  const batch = balance?.batch;

  return (
    <LedgerRow
      gutter={houseToken(house.number)}
      last={last}
      onPress={() => router.push(`/houses/${house.id}` as Href)}
    >
      <AppText variant="bodyStrong" numberOfLines={1}>
        {house.name}
      </AppText>

      <View style={styles.metaRow}>
        {batch ? (
          <>
            <AppText variant="figure">{balance!.quantity.toLocaleString()}</AppText>
            <AppText variant="caption" color="muted">
              birds ·
            </AppText>
            {/* Mono only for the code itself — "no batch" is prose. */}
            <AppText variant="data" color="muted">
              {formatBatchCode(batch.batch_code, balance?.batch_id)}
            </AppText>
          </>
        ) : (
          <AppText variant="caption" color="muted">
            No batch placed
          </AppText>
        )}
      </View>

      <View style={styles.metaRow}>
        {batch ? (
          <DayCycleBar day={dayOfCycle(batch.starting_date)} expectedDays={expectedCycleDays(batch)} />
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.pill}>
          <StatusPill status={batch ? 'RUNNING' : 'EMPTY'} />
        </View>
      </View>
    </LedgerRow>
  );
}

const styles = StyleSheet.create({
  filters: { gap: Spacing.sm, paddingVertical: Spacing.md, paddingRight: Spacing.xl },
  chip: {
    height: Size.chip,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Holds line 3's height when there's no batch, so rows stay uniform.
  spacer: { height: 18 },
  pill: { marginLeft: 'auto' },
});
