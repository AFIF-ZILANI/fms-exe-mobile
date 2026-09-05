import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useSession } from '@/lib/session';
import { initials, monthRange } from '@/lib/farm';
import { formatSignedPoints, formatTime } from '@/lib/format';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();

/**
 * docs/layout/13-employee-detail.md — one person: what they're on, and their
 * record. Managers see others' scores here; a Worker sees only their own on
 * /me/performance. The split is capability-driven, not two components.
 *
 * No payroll section: a manager sees points, not pay. Putting a colleague's
 * salary here is a privacy problem the app doesn't need.
 */
export default function EmployeeDetailScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const theme = useTheme();
  const { employee: actor } = useSession();
  const { from, to } = monthRange(new Date());

  const { data: employee, isLoading } = useGetData<Employee>(`/employees/${employeeId}`, [
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
  const all = tasks?.results ?? [];
  const today = all.filter((t) => {
    const due = new Date(t.due_at);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });
  const done = today.filter((t) => t.status === 'DONE').length;

  const pointsColor = points > 0 ? 'success' : points < 0 ? 'critical' : 'ink';

  return (
    <Screen>
      <Header title={employee?.profile.name ?? 'Employee'} leading="back" />

      <Card style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="60%" height={26} />
            <Skeleton width="40%" height={18} />
          </View>
        ) : (
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
              <AppText variant="h2" color="primary">
                {initials(employee?.profile.name ?? '')}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="h2">{employee?.profile.name}</AppText>
              <AppText variant="caption" color="muted">
                {employee?.role.toLowerCase()}
                {employee?.joining_date
                  ? ` · joined ${new Date(employee.joining_date).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}`
                  : ''}
              </AppText>
              {employee?.profile.mobile ? (
                <AppText variant="data" color="muted">
                  {employee.profile.mobile}
                </AppText>
              ) : null}
            </View>
          </View>
        )}

        <View style={[styles.rule, { backgroundColor: theme.line }]} />

        {/* A divider-separated pair, not two tinted cards — this card already
            carries the person's identity, and stacking tinted blocks inside it
            makes a card-in-a-card. */}
        <View style={styles.statPair}>
          <View style={styles.stat}>
            <AppText variant="stat" color={pointsColor}>
              {formatSignedPoints(points)}
            </AppText>
            <AppText variant="eyebrow" color="muted">
              Points · {new Date().toLocaleDateString(undefined, { month: 'short' })}
            </AppText>
          </View>
          <View style={[styles.statRule, { backgroundColor: theme.line }]} />
          <View style={styles.stat}>
            <AppText variant="stat">
              {done}/{today.length}
            </AppText>
            <AppText variant="eyebrow" color="muted">
              Tasks today
            </AppText>
          </View>
        </View>
      </Card>

      {/* Rate is primary: it's the action that decays if it isn't instant. */}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Rate"
            icon="award"
            onPress={() => router.push(`/score?employee_id=${employeeId}` as Href)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            variant="secondary"
            label="Assign task"
            onPress={() => router.push(`/assign?employee_id=${employeeId}` as Href)}
            block
          />
        </View>
      </View>

      <Card rows eyebrow="Today's tasks" note={`${done}/${today.length}`} style={styles.card}>
        {today.length === 0 ? (
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="Nothing assigned today."
            action={{
              label: 'Assign a task',
              onPress: () => router.push(`/assign?employee_id=${employeeId}` as Href),
            }}
          />
        ) : (
          today.map((task, i) => (
            <LedgerRow
              key={task.id}
              gutter={formatTime(task.due_at)}
              last={i === today.length - 1}
              onPress={
                task.status === 'PENDING'
                  ? () => router.push(`/tasks/${task.id}` as Href)
                  : undefined
              }
            >
              <View style={styles.taskHead}>
                <AppText
                  variant="bodyStrong"
                  color={task.status === 'DONE' ? 'inkSoft' : 'ink'}
                  style={styles.flex}
                >
                  {task.title}
                </AppText>
                <StatusPill status={task.status} />
              </View>
            </LedgerRow>
          ))
        )}
      </Card>

      <Card rows eyebrow="Score history" style={styles.card}>
        {entries.length === 0 ? (
          <EmptyState
            compact
            icon="award"
            tint="tintAmber"
            title="No entries this month."
            body="Tap Rate to add one."
          />
        ) : (
          entries.slice(0, 6).map((entry, i) => (
            <LedgerRow
              key={entry.id}
              gutter={formatSignedPoints(entry.points)}
              gutterColor={entry.points > 0 ? 'success' : 'critical'}
              last={i === Math.min(entries.length, 6) - 1}
            >
              <View style={styles.taskHead}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {entry.criterion.replaceAll('_', ' ').toLowerCase()}
                </AppText>
                <AppText variant="data" color="muted">
                  {shortDate(entry.date)}
                </AppText>
              </View>
              {entry.reason ? (
                <AppText variant="body" color="inkSoft" numberOfLines={2}>
                  &ldquo;{entry.reason}&rdquo;
                </AppText>
              ) : null}
              {/* "You" rather than the manager's own name: it's the difference
                  between reading a record and auditing one. */}
              <AppText variant="caption" color="muted">
                {entry.given_by_id === actor?.profile.id ? 'You' : (entry.given_by?.name ?? '')}
              </AppText>
            </LedgerRow>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { height: 1, marginVertical: Spacing.lg },
  statPair: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  statRule: { width: 1, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  taskHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
