import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { houseToken } from '@/lib/farm';
import { formatTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { dueLabel, groupTasks, taskHref } from '@/lib/tasks-view';
import type { TaskAssignment } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;
const DONE_SHOWN = 20;

/** docs/navigation-redesign-design.md Phase 3 — all of my tasks: overdue, today, later, and recently done. */
export default function MyTasksScreen() {
  const theme = useTheme();
  const { employee, signedIn } = useSession();
  // Held in state (new Date() during render is impure) and refreshed on pull-down.
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Two queries: the server lists oldest-due first, so one mixed page of old Done rows could push
  // upcoming pending tasks off it. Done is a best-effort recent list (ceiling: the first 100 by due date).
  const mine = `employee_id=${employee?.id ?? ''}&limit=100`;
  const pendingQ = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?${mine}&status=PENDING`,
    ['task-assignments', 'mine', 'pending', employee?.id ?? 'none'],
    { enabled: !!employee },
  );
  const doneQ = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?${mine}&status=DONE`,
    ['task-assignments', 'mine', 'done', employee?.id ?? 'none'],
    { enabled: !!employee },
  );
  const q = pendingQ;

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const groups = groupTasks([...(pendingQ.data?.results ?? []), ...(doneQ.data?.results ?? [])], now);
  const total = groups.overdue.length + groups.today.length + groups.later.length + groups.done.length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([Promise.allSettled([pendingQ.refetch(), doneQ.refetch()]), new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS))]);
    } finally {
      setRefreshing(false);
    }
  };

  const section = (
    title: string,
    tasks: TaskAssignment[],
    kind: 'overdue' | 'pending' | 'done',
  ) =>
    tasks.length === 0 ? null : (
      <Card rows eyebrow={title} note={String(tasks.length)} style={styles.card}>
        {tasks.map((task, i) => (
          <LedgerRow
            key={task.id}
            gutter={houseToken(task.house?.number)}
            last={i === tasks.length - 1}
            onPress={() => router.push((kind === 'done' ? `/tasks/${task.id}` : taskHref(task)) as Href)}
          >
            <View style={styles.rowTop}>
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                {task.title}
              </AppText>
              {kind === 'overdue' ? <StatusPill status="OVERDUE" /> : null}
              {kind === 'done' ? <StatusPill status="DONE" /> : null}
            </View>
            <AppText variant="caption" color={kind === 'overdue' ? 'critical' : 'muted'}>
              {kind === 'done'
                ? `Done · ${dueLabel(task.completed_at ?? task.due_at, now)}`
                : `${dueLabel(task.due_at, now)} · ${formatTime(task.due_at)}`}
              {task.location_note ? ` · ${task.location_note}` : ''}
            </AppText>
          </LedgerRow>
        ))}
      </Card>
    );

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="My tasks" leading="back" />
      <SyncBanner />

      {q.isPending && !q.data ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </View>
      ) : q.isError && !q.data ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load your tasks."
            action={{ label: 'Retry', onPress: () => void Promise.all([pendingQ.refetch(), doneQ.refetch()]) }}
          />
        </Card>
      ) : total === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="No tasks assigned to you."
            body="New tasks from your manager show up here."
          />
        </Card>
      ) : (
        <>
          {section('Overdue', groups.overdue, 'overdue')}
          {section('Today', groups.today, 'pending')}
          {section('Later', groups.later, 'pending')}
          {section('Done', groups.done.slice(0, DONE_SHOWN), 'done')}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
