import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { StatusPill } from '@/components/ui/status-pill';
import { TextField } from '@/components/ui/text-field';
import { SubmitBar } from '@/components/ui/submit-bar';
import { AppText } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { routeForTaskType } from '@/lib/task-forms';
import { formatTime } from '@/lib/format';
import type { TaskAssignment } from '@/lib/types';

/**
 * docs/PRD.md §6.6. This is where the unknown-TaskType fallback surfaces: a
 * code no screen handles renders the mark-done branch with the type shown as
 * a plain label, so the worker still knows what was asked and nothing errors.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: task, isLoading } = useGetData<TaskAssignment>(`/task-assignments/${id}`, [
    'task-assignments',
    id,
  ]);

  if (isLoading || !task) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Task' }} />
        <AppText variant="body" color="muted" style={{ paddingTop: Spacing.three }}>
          {isLoading ? 'Loading…' : 'Task not found.'}
        </AppText>
      </Screen>
    );
  }

  const formRoute = routeForTaskType(task.task.task_type?.code);
  const isOpen = task.status === 'PENDING';

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

  const cancel = async () => {
    setSubmitting(true);
    try {
      await submit({ endpoint: `/task-assignments/${task.id}/cancel`, body: {} });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Task' }} />

      <View style={styles.header}>
        <AppText variant="title">{task.title}</AppText>
        <StatusPill status={task.status} />
      </View>

      <View style={styles.meta}>
        <AppText variant="data" color="muted">
          {task.task.task_type?.label ?? task.task.label}
        </AppText>
        <AppText variant="data" color="muted">
          {task.location_note ?? task.house?.name ?? 'No location'} · due {formatTime(task.due_at)}
        </AppText>
      </View>

      {task.description && (
        <>
          <Section label="Description" />
          <AppText variant="body">{task.description}</AppText>
        </>
      )}

      {isOpen && formRoute && (
        <>
          <Section label="Do it" />
          <Pressable
            onPress={openForm}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: theme.ink }]}
          >
            <AppText variant="label" color="paper">
              Open form
            </AppText>
          </Pressable>
        </>
      )}

      {isOpen && !formRoute && (
        <>
          <Section label="Mark done" />
          <TextField label="Completion note" value={note} onChangeText={setNote} multiline />
        </>
      )}

      {!isOpen && task.completion_note && (
        <>
          <Section label="Completion note" />
          <AppText variant="body">{task.completion_note}</AppText>
        </>
      )}

      {isOpen && can(employee?.role, 'assign_task') && (
        <>
          <Section label="Manager" />
          <Pressable onPress={cancel} accessibilityRole="button" style={styles.cancel}>
            <AppText variant="label" color="critical">
              Cancel this task
            </AppText>
          </Pressable>
        </>
      )}

      {isOpen && !formRoute && (
        <SubmitBar label="Mark done" onPress={markDone} loading={submitting} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.two, gap: Spacing.two },
  meta: { gap: Spacing.half, marginTop: Spacing.two },
  cta: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { minHeight: MinTouchTarget, justifyContent: 'center' },
});
