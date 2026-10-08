import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { ScoreChip } from '@/components/ui/score-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { IconTile } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useSession } from '@/lib/session';
import { initials, monthRange } from '@/lib/farm';
import { summarizeTeam } from '@/lib/team-view';
import type { Employee, ScoreEntry, TaskAssignment } from '@/lib/types';

/** docs/layout/12-team.md — who's working, and how they're doing. Sorted by
 *  overdue then pending tasks, most first: a manager scanning this list is looking for the
 *  person who hasn't done anything today, and alphabetical order hides them
 *  in the middle. */
export default function TeamScreen() {
  const theme = useTheme();
  const { employee: actor } = useSession();
  // Held in state: new Date() during render is impure, and the overdue test needs one stable "now".
  const [now] = useState(() => new Date());
  const { from, to } = monthRange(now);

  const { data: employees, isLoading, isError, refetch } = useGetData<Paginated<Employee>>(
    '/employees?limit=100',
    ['employees', 'all'],
  );

  const endOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const { data: tasks } = useGetData<Paginated<TaskAssignment>>(
    // The server caps limit at 100; asking for more is a 400, which is how
    // this screen silently showed zeros for every stat.
    `/task-assignments?due_to=${endOfToday}&limit=100`,
    ['task-assignments', 'team-today'],
  );

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', 'team-mtd', from],
  );

  const { members: ordered, onShift, done, total } = summarizeTeam(
    employees?.results ?? [],
    tasks?.results ?? [],
    scores?.results ?? [],
    now,
    actor?.id,
  );
  const totals = { done, total };

  return (
    <Screen>
      <Header
        title="Team"
        leading="back"
        action={{ icon: 'user-plus', label: 'Assign a task', onPress: () => router.push('/assign') }}
      />

      <View style={styles.statRow}>
        <StatCard
          value={String(onShift)}
          eyebrow="On shift"
          tint="tintGreen"
          icon={<IconTile name="users" tint="tintGreen" color="success" />}
        />
        <StatCard
          value={`${totals.done}/${totals.total}`}
          eyebrow="Tasks done"
          tint="tintAmber"
          icon={<IconTile name="check-circle" tint="tintAmber" color="warning" />}
        />
      </View>

      <Card rows style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load the team."
            action={{ label: 'Retry', onPress: () => void refetch() }}
          />
        ) : ordered.length === 0 ? (
          <EmptyState
            compact
            icon="users"
            tint="surfaceAlt"
            title="No employees yet."
            body="People are added in the admin dashboard."
          />
        ) : (
          ordered.map((stats, i) => {
            const member = stats.member;
            return (
              <LedgerRow
                key={member.id}
                gutterNode={
                  <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                    <AppText variant="data" color="primary">
                      {initials(member.profile.name)}
                    </AppText>
                  </View>
                }
                last={i === ordered.length - 1}
                onPress={() => router.push(`/team/${member.id}` as Href)}
              >
                <AppText variant="bodyStrong">{member.profile.name}</AppText>
                <View style={styles.meta}>
                  <AppText variant="caption" color="muted">
                    {member.role.toLowerCase()} ·
                  </AppText>
                  <AppText variant="data" color="muted">
                    {stats.total > 0 ? `${stats.done} of ${stats.total}` : 'no tasks'}
                  </AppText>
                  <View style={styles.chip}>
                    <ScoreChip points={stats.points} variant="data" />
                  </View>
                </View>
              </LedgerRow>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  chip: { marginLeft: 'auto' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
