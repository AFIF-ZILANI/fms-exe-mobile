import { useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useGetData, type Paginated } from '@/lib/api';
import { routeForTaskType } from '@/lib/task-forms';
import { formatBatchCode, formatSignedPoints, formatTime } from '@/lib/format';
import { dayOfCycle, expectedCycleDays, houseToken, initials, monthRange } from '@/lib/farm';
import type { BatchHouseBalance, Employee, TaskAssignment } from '@/lib/types';

type ScoreEntry = { id: string; points: number; employee_id: string };

const MANAGER_ACTIONS: { label: string; path: string; icon: IconName }[] = [
  { label: 'Transfer', path: '/transfer', icon: 'shuffle' },
  { label: 'Feed plan', path: '/feeding-program', icon: 'calendar' },
  { label: 'Receive', path: '/receive', icon: 'download' },
  { label: 'Discrepancy', path: '/adjust', icon: 'clipboard' },
  { label: 'Flag stock', path: '/flag-stock', icon: 'flag' },
];

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** docs/layout/01-dashboard.md — the screen a worker opens by reflex. */
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
        <Header title="ZeroD Farms" />
        <EmptyState
          icon="user"
          tint="primarySoft"
          title="Who are you?"
          body="No login yet — pick who you are to start recording."
          action={{ label: 'Choose identity', onPress: () => router.push('/profile') }}
        />
      </Screen>
    );
  }

  const all = tasks?.results ?? [];
  const pending = all.filter((t) => t.status === 'PENDING');
  // Done tasks stay visible but sink below pending — a worker wants proof of
  // what they finished. docs/layout/01-dashboard.md.
  const ordered = [...pending, ...all.filter((t) => t.status === 'DONE')].slice(0, 4);

  const points = (scores?.results ?? []).reduce((sum, s) => sum + s.points, 0);
  const activeBalances = (balances?.results ?? []).filter((b) => b.quantity > 0);
  const birds = activeBalances.reduce((sum, b) => sum + b.quantity, 0);
  const mates = (team?.results ?? []).filter((e) => e.id !== employee.id);

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
    <Screen>
      <Header
        eyebrow={greeting()}
        title={employee.profile.name}
        action={{ icon: 'settings', label: 'Profile', onPress: () => router.push('/profile') }}
      />

      <SyncBanner />

      <View style={styles.statRow}>
        <StatCard
          value={birds.toLocaleString()}
          eyebrow="Birds"
          tint="tintGreen"
          icon={<IconTile name="home" tint="primarySoft" color="primary" />}
        />
        <StatCard
          value={formatSignedPoints(points)}
          eyebrow={`Points · ${new Date().toLocaleDateString(undefined, { month: 'short' })}`}
          tint="tintAmber"
          valueColor={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
          icon={<IconTile name="award" tint="tintAmber" color="warning" />}
          onPress={() => router.push('/me/performance')}
        />
      </View>

      <Card
        rows
        eyebrow={`Today · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
        note={all.length ? `${all.length - pending.length} of ${all.length}` : undefined}
        style={styles.card}
      >
        {ordered.length === 0 ? (
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="Nothing assigned today."
            body="Tap ＋ to log anything."
          />
        ) : (
          ordered.map((task, i) => {
            const done = task.status === 'DONE';
            return (
              <LedgerRow
                key={task.id}
                gutter={houseToken(task.house?.number)}
                last={i === ordered.length - 1}
                onPress={done ? undefined : () => openTask(task)}
              >
                <View style={styles.rowTop}>
                  <AppText variant="bodyStrong" color={done ? 'inkSoft' : 'ink'} style={styles.flex}>
                    {task.title}
                  </AppText>
                  {done ? <StatusPill status="DONE" /> : null}
                </View>
                <AppText variant="caption" color="muted">
                  {formatTime(task.due_at)}
                  {task.location_note ? ` · ${task.location_note}` : ''}
                </AppText>
              </LedgerRow>
            );
          })
        )}
      </Card>

      {isManager && mates.length > 0 && (
        <Card
          rows
          eyebrow="Team"
          action="All"
          onActionPress={() => router.push('/team')}
          style={styles.card}
        >
          {mates.slice(0, 3).map((member, i) => (
            <LedgerRow
              key={member.id}
              gutterNode={
                <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                  <AppText variant="data" color="primary">
                    {initials(member.profile.name)}
                  </AppText>
                </View>
              }
              last={i === Math.min(mates.length, 3) - 1}
              onPress={() => router.push(`/team/${member.id}` as Href)}
            >
              <AppText variant="bodyStrong">{member.profile.name}</AppText>
              <AppText variant="caption" color="muted">
                {member.role.toLowerCase()}
              </AppText>
            </LedgerRow>
          ))}
        </Card>
      )}

      <Card
        rows
        eyebrow="Houses"
        action="All"
        onActionPress={() => router.push('/houses')}
        style={styles.card}
      >
        {activeBalances.length === 0 ? (
          <EmptyState compact icon="home" tint="surfaceAlt" title="No running batches." />
        ) : (
          activeBalances.slice(0, 4).map((balance, i) => (
            <LedgerRow
              key={balance.id}
              gutter={houseToken(balance.house?.number)}
              last={i === Math.min(activeBalances.length, 4) - 1}
              onPress={() => router.push(`/houses/${balance.house_id}` as Href)}
            >
              <View style={styles.rowTop}>
                <AppText variant="figure">{balance.quantity.toLocaleString()}</AppText>
                <AppText variant="data" color="muted">
                  {formatBatchCode(balance.batch?.batch_code, balance.batch_id)}
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
      </Card>

      {isManager && (
        <Card eyebrow="Manager" style={styles.card}>
          <View style={styles.grid}>
            {MANAGER_ACTIONS.map((action) => (
              <Pressable
                key={action.path}
                onPress={() => router.push(action.path as Href)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [
                  styles.gridItem,
                  { backgroundColor: theme.surfaceAlt },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Icon name={action.icon} size={20} color="primary" />
                <AppText variant="label" style={styles.flex}>
                  {action.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <View style={styles.footerNote}>
        <Button
          variant="ghost"
          label="My performance"
          icon="bar-chart-2"
          onPress={() => router.push('/me/performance')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  card: { marginTop: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  gridItem: {
    // Two per row inside the card's 16dp padding, with a 12dp gap.
    width: '47.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
  },
  footerNote: { alignItems: 'center', marginTop: Spacing.sm },
});
