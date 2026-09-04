import { View, StyleSheet } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Reading } from '@/components/ui/reading';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useResolvedBatch } from '@/components/ui/batch-resolver';
import { dayOfCycle, expectedCycleDays, houseToken } from '@/lib/farm';
import { formatRelative, formatTime } from '@/lib/format';
import type { House, TaskAssignment } from '@/lib/types';

type Dated = { id: string; date?: string; recorded_at?: string };

/** docs/PRD.md §6.5 -- everything about the house you're standing in. The
 *  quick-action button reads this screen's id straight off the pathname, so
 *  every action it opens arrives with house_id prefilled. */
export default function HouseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: house } = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const { balance } = useResolvedBatch(id);

  // Four separate limit=1 reads rather than one aggregate endpoint -- each is
  // already ordered newest-first server-side, and react-query caches them
  // independently. Written out longhand: wrapping useGetData in a local helper
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

  const activity = [
    { label: 'Mortality', row: mortality?.results[0] },
    { label: 'Environment', row: environment?.results[0] },
    { label: 'Weight sample', row: weight?.results[0] },
    { label: 'Feed draw', row: consumption?.results[0] },
  ].filter((a) => a.row);

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: house?.name ?? 'House' }} />
      <SyncBanner />

      {house && (
        <View style={styles.header}>
          <AppText variant="title">{house.name}</AppText>
          <AppText variant="data" color="muted">
            {house.type.toLowerCase()}
            {house.capacity ? ` · capacity ${house.capacity.toLocaleString()}` : ''}
          </AppText>
        </View>
      )}

      {balance?.batch ? (
        <>
          <Section label="Current batch" />
          <Reading value={balance.quantity.toLocaleString()} label="Live birds" />
          <View style={styles.batchMeta}>
            <AppText variant="data" color="muted">
              {balance.batch.batch_code} · {balance.batch.breed.toLowerCase()} ·{' '}
              {balance.batch.phase.toLowerCase()}
            </AppText>
            <DayCycleBar
              day={dayOfCycle(balance.batch.starting_date)}
              expectedDays={expectedCycleDays(balance.batch)}
            />
          </View>
        </>
      ) : (
        <>
          <Section label="Current batch" />
          <AppText variant="body" color="muted">
            Empty house — nothing to log against until a batch is placed.
          </AppText>
        </>
      )}

      <Section label="Recent activity" />
      {activity.length === 0 ? (
        <AppText variant="body" color="muted">
          Nothing recorded here yet.
        </AppText>
      ) : (
        activity.map(({ label, row }) => (
          <LedgerRow key={label} gutter="—">
            <View style={styles.activityRow}>
              <AppText variant="body">{label}</AppText>
              <AppText variant="data" color="muted">
                {formatRelative((row!.date ?? row!.recorded_at)!)}
              </AppText>
            </View>
          </LedgerRow>
        ))
      )}

      <Section label="Open tasks" />
      {(tasks?.results ?? []).length === 0 ? (
        <AppText variant="body" color="muted">
          No open tasks for this house.
        </AppText>
      ) : (
        tasks?.results.map((task) => (
          <LedgerRow
            key={task.id}
            gutter={houseToken(house?.number)}
            onPress={() => router.push(`/tasks/${task.id}` as Href)}
          >
            <AppText variant="body">{task.title}</AppText>
            <AppText variant="data" color="muted">
              {formatTime(task.due_at)}
            </AppText>
          </LedgerRow>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.two, gap: Spacing.half },
  batchMeta: { gap: Spacing.one, marginTop: Spacing.two },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
