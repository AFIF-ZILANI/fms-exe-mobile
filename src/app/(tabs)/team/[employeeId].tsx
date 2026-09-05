import { Pressable, View, StyleSheet } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Reading } from '@/components/ui/reading';
import { AppText } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { monthRange } from '@/lib/farm';
import { formatTime } from '@/lib/format';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();

/** docs/PRD.md §6.13 -- one person: what they're on, and their record.
 *  Managers see others' scores here; a Worker sees only their own (§6.3). */
export default function EmployeeDetailScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const theme = useTheme();
  const { from, to } = monthRange(new Date());

  const { data: employee } = useGetData<Employee>(`/employees/${employeeId}`, [
    'employees',
    employeeId,
  ]);

  const { data: tasks } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?employee_id=${employeeId}&limit=50`,
    ['task-assignments', 'employee', employeeId],
  );

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employeeId}&date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', employeeId, from],
  );

  const entries = scores?.results ?? [];
  const points = entries.reduce((sum, e) => sum + e.points, 0);
  const pending = (tasks?.results ?? []).filter((t) => t.status === 'PENDING');

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: employee?.profile.name ?? 'Employee' }} />

      {employee && (
        <View style={styles.header}>
          <AppText variant="title">{employee.profile.name}</AppText>
          <AppText variant="data" color="muted">
            {employee.role.toLowerCase()} · joined{' '}
            {new Date(employee.joining_date).toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })}
          </AppText>
        </View>
      )}

      <Section label={new Date().toLocaleDateString(undefined, { month: 'long' })} />
      <Reading
        value={points > 0 ? `+${points}` : String(points)}
        label="Points"
        color={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push(`/score?employee_id=${employeeId}` as Href)}
          accessibilityRole="button"
          style={[styles.action, { backgroundColor: theme.ink }]}
        >
          <AppText variant="label" color="paper">
            Rate
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/assign?employee_id=${employeeId}` as Href)}
          accessibilityRole="button"
          style={[styles.action, { borderColor: theme.line, borderWidth: 1 }]}
        >
          <AppText variant="label">Assign task</AppText>
        </Pressable>
      </View>

      <Section label="Open tasks" />
      {pending.length === 0 ? (
        <AppText variant="body" color="muted">
          Nothing open.
        </AppText>
      ) : (
        pending.map((task) => (
          <LedgerRow
            key={task.id}
            gutter="—"
            onPress={() => router.push(`/tasks/${task.id}` as Href)}
          >
            <AppText variant="body">{task.title}</AppText>
            <AppText variant="data" color="muted">
              {task.location_note ?? task.house?.name ?? '—'} · {formatTime(task.due_at)}
            </AppText>
          </LedgerRow>
        ))
      )}

      <Section label="Score history" />
      {entries.length === 0 ? (
        <AppText variant="body" color="muted">
          No score entries this month.
        </AppText>
      ) : (
        entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            gutter={entry.points > 0 ? `+${entry.points}` : String(entry.points)}
            gutterColor={entry.points > 0 ? 'success' : 'critical'}
          >
            <View style={styles.entryHead}>
              <AppText variant="body">{entry.criterion.replaceAll('_', ' ').toLowerCase()}</AppText>
              <AppText variant="data" color="muted">
                {shortDate(entry.date)}
              </AppText>
            </View>
            <AppText variant="data" color="muted">
              {entry.reason}
            </AppText>
          </LedgerRow>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.two, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  action: {
    flex: 1,
    minHeight: MinTouchTarget,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
