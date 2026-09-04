import { useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Reading } from '@/components/ui/reading';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useGetData, type Paginated } from '@/lib/api';
import { routeForTaskType } from '@/lib/task-forms';
import { formatTime } from '@/lib/format';
import { dayOfCycle, expectedCycleDays, houseToken, monthRange, clampAdjustment } from '@/lib/farm';
import type { BatchHouseBalance, Employee, TaskAssignment } from '@/lib/types';
import type { Href } from 'expo-router';

type ScoreEntry = { id: string; points: number; employee_id: string };

/** docs/PRD.md §6.1 -- the screen a worker opens by reflex. Answers "what do
 *  I owe today, and did my last entries actually save?" */
export default function DashboardScreen() {
  const theme = useTheme();
  const { employee, isLoading } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const { from, to } = useMemo(() => monthRange(new Date()), []);

  const endOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const { data: tasks } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?employee_id=${employee?.id ?? ''}&due_to=${endOfToday}&limit=50`,
    ['task-assignments', 'today', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    '/batch-house-balances?limit=50',
    ['batch-house-balances', 'all'],
  );

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', 'mtd', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  const { data: team } = useGetData<Paginated<Employee>>('/employees?limit=100', ['employees', 'all'], {
    enabled: isManager,
  });

  if (isLoading) return <Screen />;

  if (!employee) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'ZeroD Farms' }} />
        <View style={styles.emptyIdentity}>
          <AppText variant="title">Who are you?</AppText>
          <AppText variant="body" color="muted">
            No login yet — pick who you are to start recording.
          </AppText>
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button">
            <AppText variant="label" color="info">
              Choose identity
            </AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const pending = (tasks?.results ?? []).filter((t) => t.status === 'PENDING');
  const done = (tasks?.results ?? []).filter((t) => t.status === 'DONE');
  const ordered = [...pending, ...done];

  const points = (scores?.results ?? []).reduce((sum, s) => sum + s.points, 0);
  const activeBalances = (balances?.results ?? []).filter((b) => b.quantity > 0);

  const openTask = (task: TaskAssignment) => {
    const route = routeForTaskType(task.task.task_type?.code);
    if (!route) {
      router.push(`/tasks/${task.id}` as Href);
      return;
    }
    const sep = route.includes('?') ? '&' : '?';
    const params = [task.house_id ? `house_id=${task.house_id}` : '', `task_id=${task.id}`]
      .filter(Boolean)
      .join('&');
    router.push(`${route}${sep}${params}` as Href);
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'ZeroD Farms' }} />

      <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" style={styles.identity}>
        <AppText variant="title">{employee.profile.name}</AppText>
        <AppText variant="data" color="muted">
          {employee.role.toLowerCase()}
        </AppText>
      </Pressable>
      <SyncBanner />

      <Section label="Today" trailing={new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} />
      {ordered.length === 0 ? (
        <AppText variant="body" color="muted">
          Nothing assigned today. Use + to log anything.
        </AppText>
      ) : (
        ordered.map((task) => (
          <LedgerRow
            key={task.id}
            gutter={houseToken(task.house?.number)}
            onPress={() => (task.status === 'PENDING' ? openTask(task) : router.push(`/tasks/${task.id}` as Href))}
          >
            <View style={styles.taskRow}>
              <AppText variant="body" color={task.status === 'DONE' ? 'muted' : 'ink'}>
                {task.title}
              </AppText>
              {task.status === 'DONE' && (
                <AppText variant="eyebrow" color="success">
                  Done
                </AppText>
              )}
            </View>
            <AppText variant="data" color="muted">
              {task.location_note ?? task.house?.name ?? '—'} · {formatTime(task.due_at)}
            </AppText>
          </LedgerRow>
        ))
      )}

      <Section
        label={new Date().toLocaleDateString(undefined, { month: 'long' })}
        trailing="My performance →"
        onTrailingPress={() => router.push('/me/performance')}
      />
      <View style={styles.readings}>
        <Reading
          value={points > 0 ? `+${points}` : String(points)}
          label="Points"
          color={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
        />
        <Reading value={`${clampAdjustment(points).toFixed(1)}%`} label="Projected" color="muted" />
      </View>

      {isManager && (
        <>
          <Section label="Team" trailing="All →" onTrailingPress={() => router.push('/team')} />
          {(team?.results ?? [])
            .filter((e) => e.id !== employee.id)
            .slice(0, 5)
            .map((member) => (
              <LedgerRow
                key={member.id}
                gutter={member.profile.name.slice(0, 2).toUpperCase()}
                onPress={() => router.push(`/team/${member.id}` as Href)}
              >
                <AppText variant="body">{member.profile.name}</AppText>
                <AppText variant="data" color="muted">
                  {member.role.toLowerCase()}
                </AppText>
              </LedgerRow>
            ))}

          <Section label="Manager" />
          <View style={styles.managerActions}>
            {[
              { label: 'Transfer', path: '/transfer' },
              { label: 'Feed plan', path: '/feeding-program' },
              { label: 'Receive', path: '/receive' },
              { label: 'Discrepancy', path: '/adjust' },
              { label: 'Flag stock', path: '/flag-stock' },
            ].map((action) => (
              <Pressable
                key={action.path}
                onPress={() => router.push(action.path as Href)}
                accessibilityRole="button"
                style={[styles.managerAction, { borderColor: theme.line }]}
              >
                <AppText variant="label">{action.label}</AppText>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Section label="Houses" trailing="All →" onTrailingPress={() => router.push('/houses')} />
      {activeBalances.length === 0 ? (
        <AppText variant="body" color="muted">
          No running batches.
        </AppText>
      ) : (
        activeBalances.map((balance) => (
          <LedgerRow
            key={balance.id}
            gutter={houseToken(balance.house?.number)}
            onPress={() => router.push(`/houses/${balance.house_id}` as Href)}
          >
            <View style={styles.houseRow}>
              <AppText variant="figure">{balance.quantity.toLocaleString()}</AppText>
              <AppText variant="data" color="muted">
                {balance.batch?.batch_code}
              </AppText>
            </View>
            {balance.batch && (
              <DayCycleBar
                day={dayOfCycle(balance.batch.starting_date)}
                expectedDays={expectedCycleDays(balance.batch)}
              />
            )}
          </LedgerRow>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { paddingTop: Spacing.two },
  emptyIdentity: { gap: Spacing.two, paddingTop: Spacing.five },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  houseRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  readings: { flexDirection: 'row', gap: Spacing.five },
  managerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  managerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
});
