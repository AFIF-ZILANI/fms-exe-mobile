import { View, StyleSheet } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { LedgerRow } from '@/components/ui/ledger-row';
import { ScoreChip } from '@/components/ui/score-chip';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useSession } from '@/lib/session';
import { monthRange } from '@/lib/farm';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

/** docs/PRD.md §6.12 -- who's working, how are they doing. Sorted by pending
 *  tasks descending, so the people needing attention float up. */
export default function TeamScreen() {
  const { employee: actor } = useSession();
  const { from, to } = monthRange(new Date());

  const { data: employees, isLoading } = useGetData<Paginated<Employee>>('/employees?limit=100', [
    'employees',
    'all',
  ]);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { data: tasks } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?due_to=${endOfToday.toISOString()}&limit=200`,
    ['task-assignments', 'team-today'],
  );

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?date_from=${from}&date_to=${to}&limit=500`,
    ['performance-score-entries', 'team-mtd', from],
  );

  const team = (employees?.results ?? []).filter((e) => e.id !== actor?.id);

  const statsFor = (employeeId: string) => {
    const theirs = (tasks?.results ?? []).filter((t) => t.employee_id === employeeId);
    const done = theirs.filter((t) => t.status === 'DONE').length;
    const points = (scores?.results ?? [])
      .filter((s) => s.employee_id === employeeId)
      .reduce((sum, s) => sum + s.points, 0);
    return { done, total: theirs.length, pending: theirs.length - done, points };
  };

  const ordered = [...team].sort((a, b) => statsFor(b.id).pending - statsFor(a.id).pending);

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Team' }} />
      <Section label="Team" trailing="Assign →" onTrailingPress={() => router.push('/assign')} />

      {isLoading ? (
        <AppText variant="body" color="muted">
          Loading…
        </AppText>
      ) : ordered.length === 0 ? (
        <AppText variant="body" color="muted">
          No employees yet.
        </AppText>
      ) : (
        ordered.map((member) => {
          const stats = statsFor(member.id);
          return (
            <LedgerRow
              key={member.id}
              gutter={member.profile.name.slice(0, 2).toUpperCase()}
              onPress={() => router.push(`/team/${member.id}` as Href)}
            >
              <View style={styles.row}>
                <AppText variant="body">{member.profile.name}</AppText>
                <ScoreChip points={stats.points} variant="data" />
              </View>
              <AppText variant="data" color="muted">
                {member.role.toLowerCase()} · {stats.done}/{stats.total} today
              </AppText>
            </LedgerRow>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.two },
});
