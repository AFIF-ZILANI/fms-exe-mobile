import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Icon, IconTile } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedPoints, formatTime } from '@/lib/format';
import { humanise } from '@/lib/profile-format';
import { dueLabel } from '@/lib/tasks-view';
import type { ScoreEntry, TaskAssignment } from '@/lib/types';

export type TaskTone = 'overdue' | 'open' | 'done';

const TASK_LOOK = {
  overdue: { icon: 'alert-triangle', tint: 'tintRed', color: 'critical' },
  open: { icon: 'clock', tint: 'tintBlue', color: 'info' },
  done: { icon: 'check-circle', tint: 'tintGreen', color: 'success' },
} as const;

/** One assigned task: what it is, when it is due and where, and whether it is late or finished. */
export function TaskItem({ task, tone, now }: { task: TaskAssignment; tone: TaskTone; now: Date }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const look = TASK_LOOK[tone];
  const where = task.house?.name ?? task.location_note;
  const done = tone === 'done';

  return (
    <Pressable
      onPress={done ? undefined : () => router.push(`/tasks/${task.id}` as Href)}
      accessibilityRole={done ? undefined : 'button'}
      accessibilityLabel={`${task.title}, ${tone === 'overdue' ? 'overdue, ' : ''}${dueLabel(task.due_at, now)} ${formatTime(task.due_at)}${where ? `, ${where}` : ''}${done ? ', done' : ''}`}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        elevation(scheme, 'card'),
      ]}
    >
      <IconTile name={look.icon} tint={look.tint} color={look.color} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={done ? 'inkSoft' : 'ink'} numberOfLines={2}>
          {task.title}
        </AppText>
        <AppText variant="caption" color={tone === 'overdue' ? 'critical' : 'muted'} numberOfLines={1}>
          {dueLabel(task.due_at, now)} · {formatTime(task.due_at)}
          {where ? ` · ${where}` : ''}
        </AppText>
      </View>
      {tone === 'overdue' ? <StatusPill status="OVERDUE" /> : null}
      {done ? <StatusPill status="DONE" /> : <Icon name="chevron-right" size={20} color="muted" />}
    </Pressable>
  );
}

/** One score entry: the points as a coloured badge, what it was for, why, and who gave it and when. */
export function ScoreItem({ entry, givenBy }: { entry: ScoreEntry; givenBy: string }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const good = entry.points > 0;
  const date = new Date(entry.incident_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View
      accessible
      accessibilityLabel={`${formatSignedPoints(entry.points)} points, ${humanise(entry.criterion)}${entry.reason ? `, ${entry.reason}` : ''}, by ${givenBy}, ${date}`}
      style={[styles.item, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}
    >
      <View style={[styles.badge, { backgroundColor: good ? theme.tintGreen : theme.tintRed }]}>
        <AppText variant="figure" color={good ? 'success' : 'critical'}>
          {formatSignedPoints(entry.points)}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {humanise(entry.criterion)}
        </AppText>
        {entry.reason ? (
          <AppText variant="body" color="inkSoft" numberOfLines={2}>
            &ldquo;{entry.reason}&rdquo;
          </AppText>
        ) : null}
        <AppText variant="caption" color="muted">
          {givenBy ? `${givenBy} · ` : ''}
          {date}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  badge: {
    width: Size.row - 8,
    height: Size.row - 8,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
