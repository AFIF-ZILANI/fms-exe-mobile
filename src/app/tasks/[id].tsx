import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { TextField } from '@/components/ui/text-field';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { IconTile } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { routeForTaskType } from '@/lib/task-forms';
import { formatTime } from '@/lib/format';
import type { TaskAssignment } from '@/lib/types';

/**
 * docs/layout/06-task-detail.md. This is where the unknown-TaskType fallback
 * surfaces: a code no screen handles renders the mark-done branch with the
 * type shown as a plain label, so the worker still knows what was asked and
 * nothing errors. Never a disabled "Open form" — that's the worst of both
 * branches.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Read once at mount. Calling Date.now() during render is impure (the
  // React Compiler rejects it), and the overdue line doesn't need to tick.
  const [now] = useState(() => Date.now());

  const { data: task, isLoading, isError } = useGetData<TaskAssignment>(
    `/task-assignments/${id}`,
    ['task-assignments', id],
  );

  if (isLoading) {
    return (
      <Screen>
        <Header title="Task" leading="back" />
        <Card style={styles.card}>
          <View style={styles.skeletons}>
            <Skeleton width="70%" height={26} />
            <Skeleton width="40%" height={18} />
            <Skeleton height={18} />
            <Skeleton height={18} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (isError || !task) {
    // A 404 here is normal — managers cancel tasks.
    return (
      <Screen>
        <Header title="Task" leading="back" />
        <EmptyState
          icon="alert-circle"
          tint="tintRed"
          title="This task is gone."
          body="It may have been cancelled."
          action={{ label: 'Back to dashboard', onPress: () => router.replace('/') }}
        />
      </Screen>
    );
  }

  const formRoute = routeForTaskType(task.task.task_type?.code);
  const isOpen = task.status === 'PENDING';
  const overdue = isOpen && new Date(task.due_at).getTime() < now;
  const isManager = can(employee?.role, 'assign_task');

  const openForm = () => {
    if (!formRoute) return;
    const sep = formRoute.includes('?') ? '&' : '?';
    const params = [task.house_id ? `house_id=${task.house_id}` : '', `task_id=${task.id}`]
      .filter(Boolean)
      .join('&');
    router.push(`${formRoute}${sep}${params}` as Href);
  };

  const markDone = async () => {
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: `/task-assignments/${task.id}/complete`,
        body: note.trim() ? { completion_note: note.trim() } : {},
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert('Cancel this task?', `"${task.title}" will be closed without being done.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel task',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await submit({ endpoint: `/task-assignments/${task.id}/cancel`, body: {} });
            router.back();
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <Screen bottomInset={isOpen ? 0 : Spacing.xl}>
        {/* Title is generic: the task's own title is the first thing in the
            card below, at a size that can wrap. A long title in a truncating
            header loses the half that matters. */}
        <Header title="Task" leading="back" />

        <Card style={styles.card}>
          <View style={styles.head}>
            <IconTile
              name={formRoute ? 'clipboard' : 'check-square'}
              tint={formRoute ? 'tintBlue' : 'surfaceAlt'}
              color={formRoute ? 'info' : 'muted'}
            />
            <View style={styles.flex}>
              <AppText variant="h2">{task.title}</AppText>
              <View style={styles.pill}>
                <StatusPill status={overdue ? 'OVERDUE' : task.status} />
              </View>
            </View>
          </View>

          {task.description ? (
            <>
              <View style={[styles.rule, { backgroundColor: theme.line }]} />
              <AppText variant="body" color="inkSoft">
                {task.description}
              </AppText>
            </>
          ) : null}

          <View style={[styles.rule, { backgroundColor: theme.line }]} />

          <Detail label="Where" value={task.location_note ?? task.house?.name ?? 'Not set'} />
          <Detail
            label="Due"
            value={formatTime(task.due_at)}
            tone={overdue ? 'critical' : undefined}
          />
          {/* No "Assigned by" row: TaskAssignment carries assigned_by_id but
              no relation, and a whole extra employee fetch for one name isn't
              worth it. Add it when the endpoint includes the relation. */}
          {task.employee?.profile?.name ? (
            <Detail label="For" value={task.employee.profile.name} />
          ) : null}
          {/* Omitted when the task has no type. An unrecognised code shows
              here as a plain label rather than erroring. */}
          {task.task.task_type?.code ? (
            <Detail label="Type" value={task.task.task_type.code} mono />
          ) : null}
        </Card>

        {isOpen && !formRoute && (
          <View style={styles.card}>
            <TextField
              label="Completion note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              multiline
            />
          </View>
        )}

        {!isOpen && task.completion_note ? (
          <Card eyebrow="Completion note" style={styles.card}>
            <AppText variant="body" color="inkSoft">
              {task.completion_note}
            </AppText>
          </Card>
        ) : null}
      </Screen>

      {/* No submit bar once done or cancelled — the screen becomes read-only
          and the tab bar returns. This is the one screen whose bottom chrome
          depends on data. */}
      {isOpen && (
        <SubmitBar
          label={formRoute ? 'Open form' : 'Mark done'}
          onPress={formRoute ? openForm : markDone}
          loading={submitting}
          secondary={isManager ? { label: 'Cancel task', onPress: confirmCancel } : undefined}
        />
      )}
    </View>
  );
}

function Detail({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'critical';
}) {
  return (
    <View style={styles.detail}>
      <AppText variant="label" color="muted" style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant={mono ? 'data' : 'body'} color={tone ?? 'ink'} style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md },
  head: { flexDirection: 'row', gap: Spacing.md },
  pill: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  rule: { height: 1, marginVertical: Spacing.lg },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minHeight: 28 },
  detailLabel: { width: 88 },
});
