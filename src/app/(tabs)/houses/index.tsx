import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { HouseCard } from '@/components/house-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconTile } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { useHouseOptions } from '@/components/ui/house-picker';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import {
  buildHouseLines,
  filterHouses,
  summarizeHouses,
  type HouseFilter,
} from '@/lib/houses-summary';
import type { BatchHouseBalance } from '@/lib/types';

const FILTERS: { value: HouseFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'EMPTY', label: 'Empty' },
];

/** docs/houses-redesign-design.md — the farm at a glance, then one card per house. */
export default function HousesScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<HouseFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const houses = useHouseOptions();
  const balances = useGetData<Paginated<BatchHouseBalance>>(
    '/batch-house-balances?limit=100',
    ['batch-house-balances', 'all'],
  );

  const lines = useMemo(
    // Spatial order (by house number), never by status: a worker's model of the farm is spatial.
    () => buildHouseLines(houses.data?.results ?? [], balances.data?.results ?? []),
    [houses.data?.results, balances.data?.results],
  );
  const summary = summarizeHouses(lines);
  const shown = filterHouses(lines, filter);
  const counts: Record<HouseFilter, number> = {
    ALL: summary.total,
    RUNNING: summary.running,
    EMPTY: summary.empty,
  };

  // Wait for BOTH queries: houses without their bird counts would all read "Empty" and the tiles 0.
  const ready = !houses.isLoading && !balances.isLoading;
  const failed = (houses.isError && !houses.data) || (balances.isError && !balances.data);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([houses.refetch(), balances.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="Houses" />
      <SyncBanner />

      {ready && !failed && lines.length > 0 ? (
        <>
          <View style={styles.tiles}>
            <StatCard
              value={summary.birds.toLocaleString()}
              eyebrow="Live birds"
              tint="tintGreen"
              icon={<IconTile name="feather" tint="tintGreen" color="success" />}
            />
            <StatCard
              value={`${summary.running} of ${summary.total}`}
              eyebrow="Houses running"
              tint="tintBlue"
              icon={<IconTile name="home" tint="tintBlue" color="info" />}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  hitSlop={6}
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
                    {f.label} {counts[f.value]}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {!ready ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={112} />
          ))}
        </View>
      ) : failed ? (
        <Card style={styles.state}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load houses."
            action={{ label: 'Retry', onPress: () => void refresh() }}
          />
        </Card>
      ) : lines.length === 0 ? (
        <Card style={styles.state}>
          <EmptyState
            compact
            icon="home"
            tint="surfaceAlt"
            title="No active houses."
            body="Houses are set up in the admin dashboard."
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card style={styles.state}>
          <EmptyState
            compact
            icon="filter"
            tint="surfaceAlt"
            title={`No ${filter === 'RUNNING' ? 'running' : 'empty'} houses.`}
            action={{ label: 'Show all', onPress: () => setFilter('ALL') }}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {shown.map((line) => (
            <HouseCard key={line.house.id} line={line} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  filters: { gap: Spacing.sm, paddingTop: Spacing.lg, paddingBottom: Spacing.xs, paddingRight: Spacing.xl },
  chip: {
    height: Size.chip,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  list: { gap: Spacing.md, marginTop: Spacing.md },
  state: { marginTop: Spacing.md },
});
