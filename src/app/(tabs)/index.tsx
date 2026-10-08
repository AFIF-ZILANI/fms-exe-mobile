import { useMemo, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { CycleBar } from '@/components/cycle-bar';
import { FeatureGrid } from '@/components/feature-grid';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useGetData, type Paginated } from '@/lib/api';
import { summarizeAlerts } from '@/lib/alerts-view';
import { dueLabel, groupTasks, taskHref } from '@/lib/tasks-view';
import { formatSignedPoints, formatTime } from '@/lib/format';
import { cycleProgress } from '@/lib/houses-summary';
import { dayOfCycle, expectedCycleDays, houseToken, initials, monthRange } from '@/lib/farm';
import type { BatchHouseBalance, Employee, FarmAlert, TaskAssignment } from '@/lib/types';

type ScoreEntry = { id: string; points: number; employee_id: string };

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** 9,812 stays whole; 12,400 becomes 12.4k so three stat cards fit one row. */
const compactCount = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString();

/** One running house: name and where its cycle stands on the left, live birds on the right. */
function HouseRow({ balance, last }: { balance: BatchHouseBalance; last: boolean }) {
  const theme = useTheme();
  const { batch, house } = balance;
  const progress = batch ? cycleProgress(dayOfCycle(batch.starting_date), expectedCycleDays(batch)) : null;

  return (
    <Pressable
      onPress={() => router.push(`/houses/${balance.house_id}` as Href, { withAnchor: true })}
      accessibilityRole="button"
      accessibilityLabel={`${house?.name ?? 'House'}, ${balance.quantity.toLocaleString()} birds${
        progress ? `, ${progress.label}` : ''
      }`}
      style={({ pressed }) => [
        styles.houseRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
        pressed && { backgroundColor: theme.surfaceAlt },
      ]}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {house?.name ?? 'House'}
        </AppText>
        {progress && (
          <View style={styles.houseProgress}>
            <AppText variant="caption" color={progress.over ? 'warning' : 'muted'}>
              {progress.over ? `${progress.label} · past plan` : progress.label}
            </AppText>
            <CycleBar progress={progress} />
          </View>
        )}
      </View>
      <View style={styles.houseCount}>
        <AppText variant="figure">{balance.quantity.toLocaleString()}</AppText>
        <AppText variant="caption" color="muted">
          birds
        </AppText>
      </View>
      <Icon name="chevron-right" size={20} color="muted" />
    </Pressable>
  );
}

/** docs/layout/01-dashboard.md — the screen a worker opens by reflex. */
export default function DashboardScreen() {
  const theme = useTheme();
  const { employee, isLoading, refresh } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  // Held in state: new Date() during render is impure, and groupTasks needs one stable "now".
  const [now] = useState(() => new Date());
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
  const groups = groupTasks(all, now);
  const pendingCount = groups.overdue.length + groups.today.length;
  // Overdue first, then what is still due today, then what is finished — a worker wants proof of
  // what they finished, but never above what is left. docs/layout/01-dashboard.md.
  const ordered = [...groups.overdue, ...groups.today, ...groups.done].slice(0, 5);
  const doneCount = groups.done.length;
  const total = pendingCount + doneCount;

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
          value={String(pendingCount)}
          eyebrow="Tasks left"
          tint={groups.overdue.length ? 'tintRed' : pendingCount ? 'tintBlue' : 'tintGreen'}
          valueColor={groups.overdue.length ? 'critical' : pendingCount ? 'ink' : 'success'}
          icon={
            <IconTile
              name={pendingCount ? 'check-square' : 'check-circle'}
              tint={groups.overdue.length ? 'tintRed' : pendingCount ? 'tintBlue' : 'tintGreen'}
              color={groups.overdue.length ? 'critical' : pendingCount ? 'info' : 'success'}
              size={32}
            />
          }
          onPress={() => router.push('/tasks' as Href)}
        />
        <StatCard
          value={compactCount(birds)}
          eyebrow="Birds"
          tint="tintGreen"
          icon={<IconTile name="home" tint="tintGreen" color="success" size={32} />}
          onPress={() => router.push('/houses')}
        />
        <StatCard
          value={formatSignedPoints(points)}
          eyebrow="Points"
          tint="tintAmber"
          valueColor={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
          icon={<IconTile name="award" tint="tintAmber" color="warning" size={32} />}
          onPress={() => router.push('/performance')}
        />
      </View>

      {alertSummary.count > 0 && (
        <Pressable
          onPress={() => router.push('/alerts' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${alertSummary.count} active alerts`}
          style={[
            styles.alertStrip,
            { backgroundColor: alertSummary.critical ? theme.tintRed : theme.tintAmber },
          ]}
        >
          <Icon
            name="alert-triangle"
            size={20}
            color={alertSummary.critical ? 'critical' : 'warning'}
          />
          <AppText variant="label" style={styles.flex}>
            {alertSummary.count} active {alertSummary.count === 1 ? 'alert' : 'alerts'}
            {alertSummary.critical ? ' · needs attention' : ''}
          </AppText>
          <Icon name="chevron-right" size={20} color="muted" />
        </Pressable>
      )}

      <Card
        rows
        eyebrow={`Today · ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
        note={total ? `${doneCount} of ${total} done` : undefined}
        action={total ? undefined : 'All tasks'}
        onActionPress={() => router.push('/tasks' as Href)}
        style={styles.card}
      >
        {total > 0 && (
          <View style={[styles.track, { backgroundColor: theme.line }]}>
            <View
              style={[styles.fill, { backgroundColor: theme.success, width: `${(doneCount / total) * 100}%` }]}
            />
          </View>
        )}
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
            const overdue = groups.overdue.includes(task);
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
                  {overdue ? <StatusPill status="OVERDUE" /> : null}
                </View>
                <AppText variant="caption" color={overdue ? 'critical' : 'muted'}>
                  {overdue ? `${dueLabel(task.due_at, now)} · ` : ''}
                  {formatTime(task.due_at)}
                  {task.location_note ? ` · ${task.location_note}` : ''}
                </AppText>
              </LedgerRow>
            );
          })
        )}
        {total > ordered.length && (
          <Pressable
            onPress={() => router.push('/tasks' as Href)}
            accessibilityRole="button"
            style={styles.more}
          >
            <AppText variant="label" color="primary">
              See all {total} tasks
            </AppText>
          </Pressable>
        )}
      </Card>

      <FeatureGrid isManager={isManager} />

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
        eyebrow={`Houses · ${activeBalances.length} running`}
        action="All"
        onActionPress={() => router.push('/houses')}
        style={styles.card}
      >
        {activeBalances.length === 0 ? (
          <EmptyState compact icon="home" tint="surfaceAlt" title="No running batches." />
        ) : (
          activeBalances.slice(0, 6).map((balance, i) => (
            <HouseRow key={balance.id} balance={balance} last={i === Math.min(activeBalances.length, 6) - 1} />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  more: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.xs, minHeight: 44 },
  card: { marginTop: Spacing.md },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.row,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  houseProgress: { marginTop: Spacing.xs, gap: 4 },
  // Fixed width so every row's cycle bar is the same length, whatever the bird count.
  houseCount: { alignItems: 'flex-end', width: 84 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
