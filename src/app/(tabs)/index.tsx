import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';

import { SyncBanner } from '@/components/ui/sync-banner';
import { UpdateBanner } from '@/components/ui/update-banner';
import { FeatureGrid } from '@/components/feature-grid';
import ledger from '@/constants/ledger';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useGetData, type Paginated } from '@/lib/api';
import { summarizeAlerts, unseenAlerts } from '@/lib/alerts-view';
import { useSeenAlerts } from '@/lib/use-seen-alerts';
import { useUnreadNotifications } from '@/lib/use-unread-notifications';
import { dueLabel, groupTasks, taskHref } from '@/lib/tasks-view';
import { formatSignedPoints, formatTime } from '@/lib/format';
import { cycleProgress } from '@/lib/houses-summary';
import { humanise } from '@/lib/profile-format';
import { summarizeTeam, taskStatusLine, type MemberStat } from '@/lib/team-view';
import { dayOfCycle, expectedCycleDays, houseToken, initials, monthRange } from '@/lib/farm';
import type { BatchHouseBalance, Employee, FarmAlert, TaskAssignment } from '@/lib/types';

// Home is the first screen in the Hisab Khata system (tailwind.config.js): styled with NativeWind classes, and
// built from its own markup rather than the shared cards, so the other screens keep their look until they move too.

type ScoreEntry = { id: string; points: number; employee_id: string };

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** 9,812 stays whole; 12,400 becomes 12.4k so three figures fit one row. */
const compactCount = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString();

const TONE_TEXT = { critical: 'text-error', ink: 'text-ink', success: 'text-success', muted: 'text-muted' } as const;

/** The shell: ledger-paper ground, safe area on top, one scrolling column. */
function Page({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerClassName="px-4 pb-10" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** A section's heading in the serif, with its one action on the right. */
function SectionHead({
  title,
  note,
  aside,
  action,
  onAction,
}: {
  title: string;
  note?: string;
  /** Plain text on the right, shown instead of `action`. */
  aside?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mt-6 mb-2 flex-row items-end justify-between">
      <View className="flex-row items-baseline gap-2">
        <Text className="font-heading text-title text-ink">{title}</Text>
        {note ? <Text className="font-body text-label text-muted">{note}</Text> : null}
      </View>
      {aside ? (
        <Text className="font-body text-label text-muted">{aside}</Text>
      ) : action ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={16}>
          <Text className="font-body-semibold text-label text-primary">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One column of the summary ledger: the figure first, its name under it. */
function Figure({ value, label, tone, onPress }: { value: string; label: string; tone: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      className="flex-1 px-4 py-4 active:bg-background"
    >
      <Text className={`font-body-bold text-stat ${tone}`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="font-body text-label text-muted">{label}</Text>
    </Pressable>
  );
}

function Rule() {
  return <View className="w-px bg-line" />;
}

function Person({ name, uri }: { name: string; uri?: string | null }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" accessibilityLabel={`${name}'s photo`} />
  ) : (
    <View className="h-avatar w-avatar items-center justify-center rounded-full bg-primary/10">
      <Text className="font-body-semibold text-label text-primary">{initials(name)}</Text>
    </View>
  );
}

/** One person on the team: who they are, what is left of their day, and how their month is going. */
function TeamRow({ stat, last }: { stat: MemberStat; last: boolean }) {
  const { member } = stat;
  const status = taskStatusLine(stat);

  return (
    <Pressable
      onPress={() => router.push(`/team/${member.id}` as Href, { withAnchor: true })}
      accessibilityRole="button"
      accessibilityLabel={`${member.profile.name}, ${humanise(member.role)}, ${status.text}, ${stat.points} points this month`}
      className={`min-h-row flex-row items-center gap-4 px-4 py-2 active:bg-background ${last ? '' : 'border-b border-line'}`}
    >
      <Person name={member.profile.name} uri={member.profile.avatar?.image_url} />
      <View className="flex-1">
        <Text className="font-body-semibold text-body text-ink" numberOfLines={1}>
          {member.profile.name}
        </Text>
        <Text className="font-body text-label text-muted" numberOfLines={1}>
          {humanise(member.role)}, <Text className={TONE_TEXT[status.tone]}>{status.text.toLowerCase()}</Text>
        </Text>
      </View>
      <View className="items-end">
        <Text className={`font-body-bold text-figure ${stat.points < 0 ? 'text-error' : 'text-ink'}`}>
          {formatSignedPoints(stat.points)}
        </Text>
        <Text className="font-body text-caption text-muted">points</Text>
      </View>
    </Pressable>
  );
}

/** One running house: name and where its cycle stands on the left, live birds on the right. */
function HouseRow({ balance, last }: { balance: BatchHouseBalance; last: boolean }) {
  const { batch, house } = balance;
  const progress = batch ? cycleProgress(dayOfCycle(batch.starting_date), expectedCycleDays(batch)) : null;

  return (
    <Pressable
      onPress={() => router.push(`/houses/${balance.house_id}` as Href, { withAnchor: true })}
      accessibilityRole="button"
      accessibilityLabel={`${house?.name ?? 'House'}, ${balance.quantity.toLocaleString()} birds${
        progress ? `, ${progress.label}` : ''
      }`}
      className={`min-h-row flex-row items-center gap-4 px-4 py-4 active:bg-background ${last ? '' : 'border-b border-line'}`}
    >
      <View className="flex-1 gap-1">
        <Text className="font-body-semibold text-body text-ink" numberOfLines={1}>
          {house?.name ?? 'House'}
        </Text>
        {progress && (
          <>
            <Text className={`font-body text-label ${progress.over ? 'text-error' : 'text-muted'}`}>
              {progress.over ? `${progress.label}, past plan` : progress.label}
            </Text>
            <View className="h-bar overflow-hidden rounded-full bg-line">
              <View
                className={`h-bar rounded-full ${progress.over ? 'bg-error' : 'bg-primary'}`}
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </View>
          </>
        )}
      </View>
      {/* Fixed width so every row's cycle bar is the same length, whatever the bird count. */}
      <View className="items-end" style={{ width: 96 }}>
        <Text className="font-body-bold text-figure text-ink">{balance.quantity.toLocaleString()}</Text>
        <Text className="font-body text-caption text-muted">birds</Text>
      </View>
    </Pressable>
  );
}

/** docs/layout/01-dashboard.md — the screen a worker opens by reflex. */
export default function DashboardScreen() {
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
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&status=ACTIVE&limit=100`,
    ['performance-score-entries', 'mtd', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  // A manager's team card: everyone's tasks due by tonight and everyone's points this month. Same URLs and
  // keys as the Team screen, so the two share one cache.
  const { data: team } = useGetData<Paginated<Employee>>('/employees?limit=100', ['employees', 'all'], {
    enabled: isManager,
  });
  const { data: teamTasks } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?due_to=${endOfToday}&limit=100`,
    ['task-assignments', 'team-today'],
    { enabled: isManager },
  );
  const { data: teamScores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?date_from=${from}&date_to=${to}&status=ACTIVE&limit=100`,
    ['performance-score-entries', 'team-mtd', from],
    { enabled: isManager },
  );

  // Same URL and key as the Alerts screen, so the bell badge and the list agree.
  const { data: activeAlerts } = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const alertSummary = summarizeAlerts(activeAlerts?.results ?? [], activeAlerts?.total);
  // The bell counts only what this person hasn't opened the Alerts screen on yet; the strip below keeps the full total.
  const { seen } = useSeenAlerts();
  const newAlerts = seen ? unseenAlerts(activeAlerts?.results ?? [], seen).length : 0;
  const unreadNotifications = useUnreadNotifications();

  if (isLoading) return <View className="flex-1 bg-background" />;

  // Signed in but the profile didn't load (first launch offline, or a failed fetch).
  if (!employee) {
    return (
      <Page>
        <Text className="mt-6 font-heading text-display text-ink">ZeroD Farms</Text>
        <View className="mt-10 items-center gap-2 rounded bg-surface p-6">
          <Feather name="user" size={28} color={ledger.muted} />
          <Text className="font-body-semibold text-body text-ink">{"Couldn't load your profile."}</Text>
          <Text className="font-body text-label text-muted">Check your connection and try again.</Text>
          <Pressable
            onPress={() => void refresh().catch(() => undefined)}
            accessibilityRole="button"
            className="mt-2 min-h-tap items-center justify-center self-stretch rounded bg-primary active:opacity-80"
          >
            <Text className="font-body-semibold text-body text-surface">Try again</Text>
          </Pressable>
        </View>
      </Page>
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
  const teamSummary = summarizeTeam(
    team?.results ?? [],
    teamTasks?.results ?? [],
    teamScores?.results ?? [],
    now,
    employee.id,
  );

  const openTask = (task: TaskAssignment) => {
    router.push(taskHref(task) as Href);
  };

  const badge = newAlerts + unreadNotifications;

  return (
    <Page>
      {/* Greeting and the one inbox bell. */}
      <View className="mt-4 flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="font-body text-body text-muted">{greeting()}</Text>
          <Text className="font-heading text-display text-ink" numberOfLines={2}>
            {employee.profile.name}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications' as Href)}
          accessibilityRole="button"
          accessibilityLabel={badge ? `Inbox, ${badge} new` : 'Inbox'}
          className="h-icon w-icon items-center justify-center rounded bg-surface active:bg-line"
        >
          <Feather name="bell" size={22} color={ledger.ink} />
          {badge > 0 ? (
            <View
              className={`absolute -right-1 -top-1 min-w-[22px] items-center rounded-full px-1 ${
                alertSummary.critical && newAlerts > 0 ? 'bg-error' : 'bg-primary'
              }`}
            >
              <Text className="font-body-bold text-caption text-surface">{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SyncBanner />
      <UpdateBanner />

      {/* The day in three figures, ruled like ledger columns. */}
      <View className="mt-6 flex-row overflow-hidden rounded border border-line bg-surface">
        <Figure
          value={String(pendingCount)}
          label="Tasks left"
          tone={groups.overdue.length ? 'text-error' : pendingCount ? 'text-ink' : 'text-success'}
          onPress={() => router.push('/tasks' as Href)}
        />
        <Rule />
        <Figure value={compactCount(birds)} label="Birds" tone="text-ink" onPress={() => router.push('/houses')} />
        <Rule />
        <Figure
          value={formatSignedPoints(points)}
          label="Points"
          tone={points > 0 ? 'text-success' : points < 0 ? 'text-error' : 'text-ink'}
          onPress={() => router.push('/performance')}
        />
      </View>

      {alertSummary.count > 0 && (
        <Pressable
          onPress={() => router.push('/alerts' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${alertSummary.count} active alerts`}
          className={`mt-4 min-h-tap flex-row items-center gap-4 rounded px-4 py-2 active:opacity-80 ${
            alertSummary.critical ? 'bg-error/10' : 'bg-primary/10'
          }`}
        >
          <Feather name="alert-triangle" size={22} color={alertSummary.critical ? ledger.error : ledger.primary} />
          <View className="flex-1">
            <Text className={`font-body-semibold text-body ${alertSummary.critical ? 'text-error' : 'text-ink'}`}>
              {alertSummary.count} active {alertSummary.count === 1 ? 'alert' : 'alerts'}
            </Text>
            {alertSummary.critical ? <Text className="font-body text-label text-ink">Needs attention</Text> : null}
          </View>
          <Feather name="chevron-right" size={22} color={ledger.muted} />
        </Pressable>
      )}

      <SectionHead
        title="Today"
        note={now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        aside={total ? `${doneCount} of ${total} done` : undefined}
        action="All tasks"
        onAction={() => router.push('/tasks' as Href)}
      />
      <View className="overflow-hidden rounded border border-line bg-surface">
        {total > 0 && (
          <View className="h-bar bg-line">
            <View className="h-bar bg-success" style={{ width: `${(doneCount / total) * 100}%` }} />
          </View>
        )}
        {ordered.length === 0 ? (
          <View className="items-center gap-1 px-4 py-10">
            <Feather name="check-circle" size={28} color={ledger.success} />
            <Text className="mt-2 font-body-semibold text-body text-ink">Nothing assigned today.</Text>
            <Text className="font-body text-label text-muted">Tap + to log anything.</Text>
          </View>
        ) : (
          ordered.map((task, i) => {
            const done = task.status === 'DONE';
            const overdue = groups.overdue.includes(task);
            const last = i === ordered.length - 1;
            return (
              <Pressable
                key={task.id}
                onPress={done ? undefined : () => openTask(task)}
                disabled={done}
                accessibilityRole="button"
                className={`min-h-row flex-row active:bg-background ${last ? '' : 'border-b border-line'}`}
              >
                {/* The house column, ruled off like a ledger's first column. */}
                <View className="items-center justify-center border-r border-line px-2" style={{ width: 56 }}>
                  <Text className="font-body-semibold text-label text-muted" numberOfLines={1} adjustsFontSizeToFit>
                    {houseToken(task.house?.number)}
                  </Text>
                </View>
                <View className="flex-1 justify-center px-4 py-2">
                  <Text className={`font-body-semibold text-body ${done ? 'text-muted' : 'text-ink'}`}>{task.title}</Text>
                  {task.location_note ? (
                    <Text className="font-body text-label text-muted" numberOfLines={1}>
                      {task.location_note}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end justify-center pr-4">
                  <Text className="font-body-semibold text-label text-ink">{formatTime(task.due_at)}</Text>
                  {done ? <Text className="font-body-semibold text-caption text-success">Done</Text> : null}
                  {overdue ? (
                    <Text className="font-body-semibold text-caption text-error">Overdue, {dueLabel(task.due_at, now).toLowerCase()}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
        {total > ordered.length && (
          <Pressable
            onPress={() => router.push('/tasks' as Href)}
            accessibilityRole="button"
            className="min-h-tap items-center justify-center border-t border-line active:bg-background"
          >
            <Text className="font-body-semibold text-label text-primary">See all {total} tasks</Text>
          </Pressable>
        )}
      </View>

      <FeatureGrid isManager={isManager} />

      {isManager && teamSummary.members.length > 0 && (
        <>
          <SectionHead
            title="Team"
            note={`${teamSummary.onShift} on shift`}
            action="See all"
            onAction={() => router.push('/team')}
          />
          <View className="overflow-hidden rounded border border-line bg-surface">
            {teamSummary.members.slice(0, 4).map((stat, i) => (
              <TeamRow key={stat.member.id} stat={stat} last={i === Math.min(teamSummary.members.length, 4) - 1} />
            ))}
            {teamSummary.members.length > 4 && (
              <Pressable
                onPress={() => router.push('/team')}
                accessibilityRole="button"
                className="min-h-tap items-center justify-center border-t border-line active:bg-background"
              >
                <Text className="font-body-semibold text-label text-primary">See all {teamSummary.members.length} people</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <SectionHead
        title="Houses"
        note={`${activeBalances.length} running`}
        action="See all"
        onAction={() => router.push('/houses')}
      />
      <View className="overflow-hidden rounded border border-line bg-surface">
        {activeBalances.length === 0 ? (
          <View className="items-center gap-2 px-4 py-10">
            <Feather name="home" size={28} color={ledger.muted} />
            <Text className="font-body-semibold text-body text-ink">No running batches.</Text>
          </View>
        ) : (
          activeBalances.slice(0, 6).map((balance, i) => (
            <HouseRow key={balance.id} balance={balance} last={i === Math.min(activeBalances.length, 6) - 1} />
          ))
        )}
      </View>
    </Page>
  );
}
