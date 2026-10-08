import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { TaskItem, ScoreItem } from '@/components/member-sections';
import { InfoCard, InfoRow, ProfileHeader, openLink } from '@/components/profile-parts';
import { Button } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { IconTile } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useSession } from '@/lib/session';
import { monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import { formatDate as formatProfileDate } from '@/lib/profile-format';
import { groupTasks } from '@/lib/tasks-view';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

const SHOWN = 4;

/**
 * docs/layout/13-employee-detail.md — one person: who they are, what is on their plate, and their record.
 * Managers see others' scores here; a Worker sees only their own on /performance. The split is
 * capability-driven, not two components.
 *
 * No payroll section: a manager sees points, not pay. Putting a colleague's salary here is a privacy
 * problem the app doesn't need.
 */
export default function EmployeeDetailScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const theme = useTheme();
  const { employee: actor } = useSession();
  // Held in state: new Date() during render is impure, and the day's bounds need one stable "now".
  const [now] = useState(() => new Date());
  const { from, to } = monthRange(now);
  const [refreshing, setRefreshing] = useState(false);
  const [allTasks, setAllTasks] = useState(false);
  const [allScores, setAllScores] = useState(false);

  const { startOfToday, endOfToday } = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { startOfToday: start.toISOString(), endOfToday: end.toISOString() };
  }, [now]);

  const person = useGetData<Employee>(`/employees/${employeeId}`, ['employees', employeeId]);
  // Everything still open, however old: an overdue task from last week must not vanish from this page.
  const pending = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?employee_id=${employeeId}&status=PENDING&limit=100`,
    ['task-assignments', 'employee', employeeId, 'pending'],
  );
  const doneToday = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?employee_id=${employeeId}&status=DONE&due_from=${startOfToday}&due_to=${endOfToday}&limit=50`,
    ['task-assignments', 'employee', employeeId, 'done-today'],
  );
  // Settled entries only: a voided or disputed one does not count towards pay, so it must not count here.
  const scores = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employeeId}&date_from=${from}&date_to=${to}&status=ACTIVE&limit=100`,
    ['performance-score-entries', employeeId, from],
  );

  const employee = person.data;
  const groups = groupTasks(pending.data?.results ?? [], now);
  const finished = doneToday.data?.results ?? [];
  // Everything assigned, in the order a manager cares about: late, due today, coming up, then finished today.
  const assigned = [
    ...groups.overdue.map((task) => ({ task, tone: 'overdue' as const })),
    ...groups.today.map((task) => ({ task, tone: 'open' as const })),
    ...groups.later.map((task) => ({ task, tone: 'open' as const })),
    ...finished.map((task) => ({ task, tone: 'done' as const })),
  ];
  const todayTotal = groups.today.length + finished.length;
  const openCount = groups.overdue.length + groups.today.length + groups.later.length;
  const shownTasks = allTasks ? assigned : assigned.slice(0, SHOWN);

  const entries = scores.data?.results ?? [];
  const points = entries.reduce((sum, e) => sum + e.points, 0);
  const pointsColor = points > 0 ? 'success' : points < 0 ? 'critical' : 'ink';
  const hasOverdue = groups.overdue.length > 0;
  const onProbation = employee?.employment_status === 'PROBATION' && !!employee.probation_end_date;

  const assign = () => router.push(`/assign?employee_id=${employeeId}` as Href);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([person.refetch(), pending.refetch(), doneToday.refetch(), scores.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
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
      <Header title={employee?.profile.name ?? 'Employee'} leading="back" />

      {person.isLoading ? (
        <View style={styles.skeletons}>
          <Skeleton height={180} />
          <Skeleton height={56} />
        </View>
      ) : person.isError || !employee ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this person."
            action={{ label: 'Retry', onPress: () => void person.refetch() }}
          />
        </Card>
      ) : (
        <>
          <ProfileHeader employee={employee} />

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
              <Button variant="secondary" label="Assign" icon="plus" onPress={assign} block />
            </View>
          </View>

          <View style={styles.statRow}>
            <StatCard
              value={formatSignedPoints(points)}
              eyebrow={`Points · ${now.toLocaleDateString(undefined, { month: 'short' })}`}
              tint="tintAmber"
              valueColor={pointsColor}
              icon={<IconTile name="award" tint="tintAmber" color="warning" size={32} />}
            />
            <StatCard
              value={`${finished.length}/${todayTotal}`}
              eyebrow="Done today"
              tint="tintBlue"
              icon={<IconTile name="check-circle" tint="tintBlue" color="info" size={32} />}
            />
            <StatCard
              value={String(groups.overdue.length)}
              eyebrow="Overdue"
              tint={hasOverdue ? 'tintRed' : 'tintGreen'}
              valueColor={hasOverdue ? 'critical' : 'success'}
              icon={
                <IconTile
                  name={hasOverdue ? 'alert-triangle' : 'check'}
                  tint={hasOverdue ? 'tintRed' : 'tintGreen'}
                  color={hasOverdue ? 'critical' : 'success'}
                  size={32}
                />
              }
            />
          </View>

          <View style={styles.sectionHead}>
            <AppText variant="eyebrow" color="muted">
              Assigned tasks{assigned.length > 0 ? ` · ${openCount} open` : ''}
            </AppText>
            <Pressable onPress={assign} accessibilityRole="button" hitSlop={Spacing.md}>
              <AppText variant="label" color="primary">
                Assign
              </AppText>
            </Pressable>
          </View>
          {assigned.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="check-circle"
                tint="tintGreen"
                title="Nothing assigned."
                action={{ label: 'Assign a task', onPress: assign }}
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {shownTasks.map(({ task, tone }) => (
                <TaskItem key={task.id} task={task} tone={tone} now={now} />
              ))}
              {assigned.length > SHOWN ? (
                <Pressable onPress={() => setAllTasks((v) => !v)} accessibilityRole="button" style={styles.more}>
                  <AppText variant="label" color="primary">
                    {allTasks ? 'Show less' : `Show all ${assigned.length}`}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.sectionHead}>
            <AppText variant="eyebrow" color="muted">
              Points · {now.toLocaleDateString(undefined, { month: 'long' })}
            </AppText>
            {entries.length > 0 ? (
              <AppText variant="figure" color={pointsColor}>
                {formatSignedPoints(points)}
              </AppText>
            ) : null}
          </View>
          {entries.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="award"
                tint="tintAmber"
                title="No entries this month."
                body="Tap Rate to add one."
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {(allScores ? entries : entries.slice(0, SHOWN)).map((entry) => (
                // "You" rather than the manager's own name: it's the difference between reading a record and auditing one.
                <ScoreItem
                  key={entry.id}
                  entry={entry}
                  givenBy={entry.given_by_id === actor?.profile.id ? 'You' : (entry.given_by?.name ?? '')}
                />
              ))}
              {entries.length > SHOWN ? (
                <Pressable onPress={() => setAllScores((v) => !v)} accessibilityRole="button" style={styles.more}>
                  <AppText variant="label" color="primary">
                    {allScores ? 'Show less' : `Show all ${entries.length}`}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          )}

          <InfoCard title="Contact">
            <InfoRow
              label="Mobile"
              value={employee.profile.mobile}
              icon="phone"
              onPress={() => openLink(`tel:${employee.profile.mobile}`)}
              last={!employee.profile.email}
            />
            {employee.profile.email ? (
              <InfoRow
                label="Email"
                value={employee.profile.email}
                icon="mail"
                onPress={() => openLink(`mailto:${employee.profile.email}`)}
                last
              />
            ) : null}
          </InfoCard>

          {onProbation ? (
            <InfoCard title="Employment">
              <InfoRow label="Probation ends" value={formatProfileDate(employee.probation_end_date as string)} last />
            </InfoCard>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginTop: Spacing.xl,
  },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
