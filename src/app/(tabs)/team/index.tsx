import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CycleBar } from '@/components/cycle-bar';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Avatar } from '@/components/ui/avatar';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, IconTile } from '@/components/ui/icon';
import { ScoreChip } from '@/components/ui/score-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useSession } from '@/lib/session';
import { monthRange } from '@/lib/farm';
import { humanise } from '@/lib/profile-format';
import { countByFilter, filterTeam, summarizeTeam, taskStatusLine, type MemberStat, type TeamFilter } from '@/lib/team-view';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

const FILTERS: { value: TeamFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'OPEN', label: 'Open' },
  { value: 'DONE', label: 'Done' },
];

const EMPTY_FILTER: Record<Exclude<TeamFilter, 'ALL'>, string> = {
  OVERDUE: 'Nobody is overdue.',
  OPEN: 'Nobody has tasks left today.',
  DONE: 'Nobody has finished all their tasks yet.',
};

/** One person: face, role, what is left of their day (with a bar), and their month's points. */
function MemberCard({ stat }: { stat: MemberStat }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { member } = stat;
  const status = taskStatusLine(stat);

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        onPress={() => router.push(`/team/${member.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${member.profile.name}, ${humanise(member.role)}, ${status.text}, ${stat.points} points this month`}
        style={({ pressed }) => [
          styles.member,
          { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
          elevation(scheme, 'card'),
        ]}
      >
        <Avatar name={member.profile.name} uri={member.profile.avatar?.image_url} size={48} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {member.profile.name}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="caption" color="muted">
              {humanise(member.role)} ·
            </AppText>
            <AppText variant="caption" color={status.tone}>
              {status.text}
            </AppText>
          </View>
          {stat.total > 0 ? (
            <View style={styles.progress}>
              <CycleBar progress={{ ratio: stat.done / stat.total, label: '', over: stat.overdue > 0 }} />
              <AppText variant="caption" color="muted">
                {stat.done} of {stat.total} done
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.points}>
          <ScoreChip points={stat.points} variant="figure" />
          <AppText variant="caption" color="muted">
            points
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color="muted" />
      </Pressable>
    </Animated.View>
  );
}

/** docs/layout/12-team.md — who's working, and how they're doing. Most overdue first: a manager scanning
 *  this is looking for the person who is behind, and alphabetical order hides them in the middle. */
export default function TeamScreen() {
  const theme = useTheme();
  const { employee: actor } = useSession();
  // Held in state: new Date() during render is impure, and the overdue test needs one stable "now".
  const [now] = useState(() => new Date());
  const { from, to } = monthRange(now);
  const [filter, setFilter] = useState<TeamFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const employees = useGetData<Paginated<Employee>>('/employees?limit=100', ['employees', 'all']);

  const endOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const tasks = useGetData<Paginated<TaskAssignment>>(
    // The server caps limit at 100; asking for more is a 400, which is how
    // this screen silently showed zeros for every stat.
    `/task-assignments?due_to=${endOfToday}&limit=100`,
    ['task-assignments', 'team-today'],
  );

  const scores = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', 'team-mtd', from],
  );

  const summary = summarizeTeam(
    employees.data?.results ?? [],
    tasks.data?.results ?? [],
    scores.data?.results ?? [],
    now,
    actor?.id,
  );
  const counts = countByFilter(summary.members);
  const shown = filterTeam(summary.members, filter);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([employees.refetch(), tasks.refetch(), scores.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const hasOverdue = summary.overdue > 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header
        title="Team"
        leading="back"
        action={{ icon: 'user-plus', label: 'Assign a task', onPress: () => router.push('/assign') }}
      />

      <View style={styles.statRow}>
        <StatCard
          value={String(summary.onShift)}
          eyebrow="On shift"
          tint="tintGreen"
          icon={<IconTile name="users" tint="tintGreen" color="success" size={32} />}
        />
        <StatCard
          value={`${summary.done}/${summary.total}`}
          eyebrow="Tasks done"
          tint="tintBlue"
          icon={<IconTile name="check-circle" tint="tintBlue" color="info" size={32} />}
        />
        <StatCard
          value={String(summary.overdue)}
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

      {employees.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={88} />
          ))}
        </View>
      ) : employees.isError ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load the team."
            action={{ label: 'Retry', onPress: () => void employees.refetch() }}
          />
        </Card>
      ) : summary.members.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="users"
            tint="surfaceAlt"
            title="No employees yet."
            body="People are added in the admin dashboard."
          />
        </Card>
      ) : (
        <>
          <View style={styles.chips}>
            {FILTERS.map((f) => {
              const on = filter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${f.label}, ${counts[f.value]}`}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.line },
                  ]}
                >
                  <AppText variant="label" color={on ? 'onPrimary' : 'inkSoft'}>
                    {f.label}
                  </AppText>
                  <AppText variant="data" color={on ? 'onPrimary' : 'muted'}>
                    {counts[f.value]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {shown.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="check-circle"
                tint="tintGreen"
                title={filter === 'ALL' ? 'Nobody yet.' : EMPTY_FILTER[filter]}
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {shown.map((stat) => (
                <MemberCard key={stat.member.id} stat={stat} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  card: { marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.md },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  progress: { marginTop: Spacing.sm, gap: 4 },
  points: { alignItems: 'flex-end', minWidth: 56 },
});
