import { Pressable, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

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
import { IconTile, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useResolvedBatch } from '@/components/ui/batch-resolver';
import { dayOfCycle, expectedCycleDays } from '@/lib/farm';
import { formatBatchCode, formatRelative, formatTime } from '@/lib/format';
import type { House, TaskAssignment } from '@/lib/types';

type Dated = { id: string; date?: string; recorded_at?: string };

/** The three logs recorded daily. Environment and treatment stay in the log
 *  sheet — surfacing five tiles makes all five equally forgettable.
 *  docs/layout/05-house-detail.md. */
const QUICK_LOGS: {
  label: string;
  path: string;
  icon: IconName;
  tint: Extract<ThemeColor, 'tintRed' | 'tintAmber' | 'tintBlue'>;
}[] = [
  { label: 'Deaths', path: '/log/mortality', icon: 'alert-circle', tint: 'tintRed' },
  { label: 'Feed', path: '/log/consumption', icon: 'package', tint: 'tintAmber' },
  { label: 'Weight', path: '/log/weight', icon: 'bar-chart-2', tint: 'tintBlue' },
];

/** docs/layout/05-house-detail.md — everything about the house you're standing
 *  in, and every action you might take in it. */
export default function HouseDetailScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: house, isLoading } = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const { balance } = useResolvedBatch(id);

  // Four separate limit=1 reads rather than one aggregate endpoint — each is
  // already ordered newest-first server-side, and react-query caches them
  // independently. Written longhand: wrapping useGetData in a local helper
  // would call a hook from a nested function.
  const { data: mortality } = useGetData<Paginated<Dated>>(
    `/mortality-logs?house_id=${id}&limit=1`,
    ['mortality-logs', 'latest', id],
  );
  const { data: environment } = useGetData<Paginated<Dated>>(
    `/environment-records?house_id=${id}&limit=1`,
    ['environment-records', 'latest', id],
  );
  const { data: weight } = useGetData<Paginated<Dated>>(
    `/weight-records?house_id=${id}&limit=1`,
    ['weight-records', 'latest', id],
  );
  const { data: consumption } = useGetData<Paginated<Dated>>(
    `/consumptions?house_id=${id}&limit=1`,
    ['consumptions', 'latest', id],
  );

  const { data: tasks } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?house_id=${id}&status=PENDING&limit=20`,
    ['task-assignments', 'house', id],
  );

  // One row per kind, not a merged feed: the question is "has today's
  // environment reading been done", not "what happened recently".
  // A kind with no record is omitted rather than shown as "—".
  const activity = (
    [
      { label: 'Mortality', icon: 'alert-circle', tint: 'tintRed', row: mortality?.results[0] },
      { label: 'Feed', icon: 'package', tint: 'tintAmber', row: consumption?.results[0] },
      { label: 'Weight sample', icon: 'bar-chart-2', tint: 'tintBlue', row: weight?.results[0] },
      { label: 'Environment', icon: 'thermometer', tint: 'tintBlue', row: environment?.results[0] },
    ] as const
  ).filter((a) => a.row);

  const batch = balance?.batch;
  const openTasks = tasks?.results ?? [];

  const withHouse = (path: string) => `${path}?house_id=${id}` as Href;

  return (
    <Screen>
      <Header title={house?.name ?? 'House'} leading="back" />
      <SyncBanner />

      <Card style={styles.hero}>
        <View style={styles.heroMeta}>
          <AppText variant="eyebrow" color="muted">
            {house ? house.type : ''}
            {house?.capacity ? `  ·  CAP ${house.capacity.toLocaleString()}` : ''}
          </AppText>
          <StatusPill status={batch ? 'RUNNING' : 'EMPTY'} />
        </View>

        {isLoading ? (
          <View style={styles.heroSkeleton}>
            <Skeleton width="60%" height={44} />
          </View>
        ) : batch ? (
          <>
            <AppText variant="hero" style={styles.centre}>
              {balance!.quantity.toLocaleString()}
            </AppText>
            <AppText variant="eyebrow" color="muted" style={styles.centre}>
              Live birds
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="h2" color="muted" style={styles.centre}>
              Empty house
            </AppText>
            <AppText variant="caption" color="muted" style={styles.centre}>
              Logging needs a batch in this house.
            </AppText>
          </>
        )}

        {batch && (
          <>
            <View style={[styles.rule, { backgroundColor: theme.line }]} />
            <View style={styles.batchLine}>
              <AppText variant="data">{formatBatchCode(batch.batch_code, balance?.batch_id)}</AppText>
              <AppText variant="caption" color="muted">
                {batch.breed.toLowerCase()} · {batch.phase.toLowerCase()}
              </AppText>
            </View>
            <View style={styles.batchLine}>
              <DayCycleBar
                day={dayOfCycle(batch.starting_date)}
                expectedDays={expectedCycleDays(batch)}
              />
              <DaysLeft day={dayOfCycle(batch.starting_date)} total={expectedCycleDays(batch)} />
            </View>
          </>
        )}
      </Card>

      {/* Hidden without a batch — a tile opening a form that can't submit is
          worse than no tile. */}
      {batch && (
        <View style={styles.quickRow}>
          {QUICK_LOGS.map((q) => (
            <Pressable
              key={q.path}
              onPress={() => router.push(withHouse(q.path))}
              accessibilityRole="button"
              accessibilityLabel={`Log ${q.label.toLowerCase()}`}
              style={({ pressed }) => [
                styles.quickTile,
                { backgroundColor: theme.surface },
                elevation(scheme, 'card'),
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconTile name={q.icon} tint={q.tint} />
              <AppText variant="label">{q.label}</AppText>
            </Pressable>
          ))}
        </View>
      )}

      <Card rows eyebrow="Recent activity" style={styles.card}>
        {activity.length === 0 ? (
          <EmptyState
            compact
            icon="clock"
            tint="surfaceAlt"
            title="Nothing logged here yet."
            body={batch ? 'Use the buttons above to start.' : undefined}
          />
        ) : (
          activity.map((a, i) => (
            <LedgerRow
              key={a.label}
              gutterNode={<IconTile name={a.icon} tint={a.tint} size={32} />}
              last={i === activity.length - 1}
            >
              <View style={styles.activityRow}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {a.label}
                </AppText>
                <AppText variant="caption" color="muted">
                  {formatRelative((a.row!.date ?? a.row!.recorded_at)!)}
                </AppText>
              </View>
            </LedgerRow>
          ))
        )}
      </Card>

      {/* Omitted entirely when empty, rather than shown empty. */}
      {openTasks.length > 0 && (
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
      )}
    </Screen>
  );
}

/** Goes `warning` at =< 3 days, and never shows a negative — a batch past its
 *  expected end reads "Day 38 of ~35". docs/layout/05-house-detail.md. */
function DaysLeft({ day, total }: { day: number; total: number }) {
  const left = total - day;
  if (left < 0) {
    return (
      <AppText variant="caption" color="muted">
        Day {day} of ~{total}
      </AppText>
    );
  }
  return (
    <AppText variant="caption" color={left <= 3 ? 'warning' : 'muted'}>
      {left === 0 ? 'Cycle ends today' : `${left} days left`}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  hero: { marginTop: Spacing.xs, padding: Spacing.xl },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  heroSkeleton: { alignItems: 'center', paddingVertical: Spacing.xs },
  rule: { height: 1, marginVertical: Spacing.lg },
  batchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quickRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  quickTile: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },
  card: { marginTop: Spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
