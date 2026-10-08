import { useState } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { HouseHero, LogTile, ShortcutTile } from '@/components/house-detail-parts';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import type { IconName } from '@/components/ui/icon';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { freshness, newestIso } from '@/lib/house-detail';
import type { BatchHouseBalance, House, TaskAssignment } from '@/lib/types';

type Dated = { id: string; date?: string; recorded_at?: string };

const when = (row: Dated | undefined) => row?.date ?? row?.recorded_at ?? null;

const LOGS: {
  key: 'mortality' | 'feed' | 'weight' | 'environment' | 'treatment';
  label: string;
  path: string;
  icon: IconName;
  tint: Extract<ThemeColor, 'tintRed' | 'tintAmber' | 'tintBlue' | 'tintGreen'>;
}[] = [
  { key: 'mortality', label: 'Mortality', path: '/log/mortality', icon: 'alert-circle', tint: 'tintRed' },
  { key: 'feed', label: 'Feed', path: '/log/consumption', icon: 'package', tint: 'tintAmber' },
  { key: 'weight', label: 'Weight', path: '/log/weight', icon: 'bar-chart-2', tint: 'tintBlue' },
  { key: 'environment', label: 'Environment', path: '/log/environment', icon: 'thermometer', tint: 'tintBlue' },
  { key: 'treatment', label: 'Treatment', path: '/log/treatment', icon: 'plus-square', tint: 'tintGreen' },
];

/** docs/house-detail-redesign-design.md — the house you're standing in: its birds and cycle, what is
 *  still to log today, stock actions for this house, and its open tasks. */
export default function HouseDetailScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Read once and refreshed on pull-down: new Date() during render is impure.
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  // Same URL and key as useResolvedBatch, so the cache is shared with the log forms.
  const balanceQ = useGetData<Paginated<BatchHouseBalance>>(
    `/batch-house-balances?house_id=${id}&limit=1`,
    ['batch-house-balances', id],
  );
  const house = houseQ.data;
  const balance = balanceQ.data?.results?.[0] ?? null;
  const running = !!balance && balance.quantity > 0;
  const batchId = running && balance ? balance.batch_id : undefined;

  // Latest-record reads (limit=1, newest first server-side). Written longhand: wrapping useGetData in a
  // local helper would call a hook from a nested function.
  const mortality = useGetData<Paginated<Dated>>(`/mortality-logs?house_id=${id}&limit=1`, ['mortality-logs', 'latest', id]);
  const consumption = useGetData<Paginated<Dated>>(`/consumptions?house_id=${id}&limit=1`, ['consumptions', 'latest', id]);
  const weight = useGetData<Paginated<Dated>>(`/weight-records?house_id=${id}&limit=1`, ['weight-records', 'latest', id]);
  const environment = useGetData<Paginated<Dated>>(
    `/environment-records?house_id=${id}&limit=1`,
    ['environment-records', 'latest', id],
  );
  // Treatments are recorded per batch, not per house: the tile shows the batch's latest medication or vaccination.
  const medications = useGetData<Paginated<Dated>>(
    batchId ? `/medications?batch_id=${batchId}&limit=1` : '',
    ['medications', 'latest', batchId ?? 'none'],
    { enabled: !!batchId },
  );
  const vaccinations = useGetData<Paginated<Dated>>(
    batchId ? `/vaccinations?batch_id=${batchId}&limit=1` : '',
    ['vaccinations', 'latest', batchId ?? 'none'],
    { enabled: !!batchId },
  );
  const tasks = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?house_id=${id}&status=PENDING&limit=20`,
    ['task-assignments', 'house', id],
  );

  // Wait for BOTH the house and its birds: otherwise a house whose counts have not arrived reads "Empty".
  // `isPending`, not `isLoading`: offline with nothing cached a query is paused and `isLoading` is false.
  const ready = !houseQ.isPending && !balanceQ.isPending;
  const failed = (houseQ.isError && !houseQ.data) || (balanceQ.isError && !balanceQ.data);
  const offlineNoData =
    (houseQ.isPending && houseQ.fetchStatus === 'paused') ||
    (balanceQ.isPending && balanceQ.fetchStatus === 'paused');

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  };

  const lastLogged: Record<(typeof LOGS)[number]['key'], string | null> = {
    mortality: when(mortality.data?.results[0]),
    feed: when(consumption.data?.results[0]),
    weight: when(weight.data?.results[0]),
    environment: when(environment.data?.results[0]),
    treatment: newestIso(when(medications.data?.results[0]), when(vaccinations.data?.results[0])),
  };

  const tileWidth = (width - 2 * Spacing.xl - 2 * Spacing.md) / 3;
  const withHouse = (path: string) => `${path}?house_id=${id}` as Href;
  const openTasks = tasks.data?.results ?? [];

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title={house?.name ?? 'House'} leading="back" />
      <SyncBanner />

      {offlineNoData ? (
        <Card style={styles.state}>
          <EmptyState
            compact
            icon="wifi-off"
            tint="surfaceAlt"
            title="You're offline."
            body="This house loads when you're back online."
          />
        </Card>
      ) : !ready ? (
        <View style={styles.state}>
          <Skeleton height={200} />
        </View>
      ) : failed || !house ? (
        <Card style={styles.state}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this house."
            action={{
              label: 'Retry',
              onPress: () => void Promise.all([houseQ.refetch(), balanceQ.refetch()]),
            }}
          />
        </Card>
      ) : (
        <>
          <HouseHero house={house} balance={balance} />

          {/* A tile that opens a form which cannot submit is worse than no tile: logging needs a batch. */}
          {running ? (
            <>
              <AppText variant="eyebrow" color="muted" style={styles.section}>
                Today&apos;s records
              </AppText>
              <View style={styles.tiles}>
                {LOGS.map((log) => (
                  <LogTile
                    key={log.key}
                    label={log.label}
                    icon={log.icon}
                    tint={log.tint}
                    freshness={freshness(lastLogged[log.key], now)}
                    width={tileWidth}
                    onPress={() => router.push(withHouse(log.path))}
                  />
                ))}
              </View>
            </>
          ) : null}

          <AppText variant="eyebrow" color="muted" style={styles.section}>
            Stock
          </AppText>
          <View style={styles.shortcuts}>
            <ShortcutTile
              label="Move to house"
              icon="arrow-right"
              onPress={() => router.push(withHouse('/scan/allocate'))}
            />
            <ShortcutTile
              label="Use an item"
              icon="box"
              onPress={() => router.push(withHouse('/scan/consume'))}
            />
          </View>

          {/* Omitted entirely when empty, rather than shown empty. */}
          {openTasks.length > 0 ? (
            <Card rows eyebrow="Open tasks" note={String(openTasks.length)} style={styles.card}>
              {openTasks.map((task, i) => (
                <LedgerRow
                  key={task.id}
                  gutter={formatTime(task.due_at)}
                  last={i === openTasks.length - 1}
                  onPress={() => router.push(`/tasks/${task.id}` as Href)}
                >
                  <AppText variant="bodyStrong">{task.title}</AppText>
                  <AppText variant="caption" color="muted">
                    {task.employee?.profile?.name ?? 'Unassigned'}
                  </AppText>
                </LedgerRow>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: Spacing.md },
  section: { marginTop: Spacing.xl, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: { marginTop: Spacing.xl },
});
