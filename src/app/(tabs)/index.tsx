import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { IconTile } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useGetData, type Paginated } from '@/lib/api';
import { summarizeAlerts } from '@/lib/alerts-view';
import { taskHref } from '@/lib/tasks-view';
import { formatBatchCode, formatSignedPoints, formatTime } from '@/lib/format';
import { dayOfCycle, expectedCycleDays, houseToken, initials, monthRange } from '@/lib/farm';
import type { BatchHouseBalance, Employee, FarmAlert, TaskAssignment } from '@/lib/types';

type ScoreEntry = { id: string; points: number; employee_id: string };

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** docs/layout/01-dashboard.md — the screen a worker opens by reflex. */
export default function DashboardScreen() {
  const theme = useTheme();
  const { employee, isLoading, refresh } = useSession();
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

  // Same URL and key as the Alerts screen, so the bell badge and the list agree.
  const { data: activeAlerts } = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const alertSummary = summarizeAlerts(activeAlerts?.results ?? [], activeAlerts?.total);

  if (isLoading) return <Screen />;

  // Signed in but the profile didn't load (first launch offline, or a failed fetch).
  if (!employee) {
    return (
      <Screen>
        <Header title="ZeroD Farms" />
        <EmptyState
          icon="user"
          tint="primarySoft"
          title="Couldn't load your profile."
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void refresh().catch(() => undefined) }}
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
    router.push(taskHref(task) as Href);
  };

  return (
    <Screen>
      <Header
        eyebrow={greeting()}
        title={employee.profile.name}
        action={{
          icon: 'bell',
          label: 'Alerts',
          badge: alertSummary.count,
          badgeTone: alertSummary.critical ? 'critical' : 'warning',
          onPress: () => router.push('/alerts' as Href),
        }}
      />

      <SyncBanner />

      <View style={styles.statRow}>
        <StatCard
          value={birds.toLocaleString()}
          eyebrow="Birds"
          tint="tintGreen"
          icon={<IconTile name="home" tint="tintGreen" color="success" />}
        />
        <StatCard
          value={formatSignedPoints(points)}
          eyebrow={`Points · ${new Date().toLocaleDateString(undefined, { month: 'short' })}`}
          tint="tintAmber"
          valueColor={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
          icon={<IconTile name="award" tint="tintAmber" color="warning" />}
          onPress={() => router.push('/me/performance', { withAnchor: true })}
        />
      </View>

      <Card
        rows
        eyebrow={`Today · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}${
          all.length ? ` · ${all.length - pending.length} of ${all.length} done` : ''
        }`}
        action="All tasks"
        onActionPress={() => router.push('/tasks' as Href)}
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
              onPress={() => router.push(`/team/${member.id}` as Href, { withAnchor: true })}
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
              onPress={() => router.push(`/houses/${balance.house_id}` as Href, { withAnchor: true })}
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
});
