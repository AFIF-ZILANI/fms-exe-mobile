import { Alert, Pressable, View, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOutboxSummary, triggerFlush } from '@/lib/use-outbox';
import { listDeadLetters, retryDeadLetter } from '@/lib/outbox';
import { formatTime } from '@/lib/format';

/**
 * Only rendered when there's something to say -- docs/design.md §6, "only
 * when it matters." Tapping with pending writes retries now; tapping with
 * dead letters offers to retry them.
 *
 * ponytail: dead-letter resolution is a native Alert, not a dedicated
 * screen -- docs/PRD.md's 20 screens don't include a dead-letter manager,
 * and this is a rare-path safety net, not a primary flow. Upgrade to a real
 * list view if dead letters turn out to be common enough to need one.
 */
export function SyncBanner() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data } = useOutboxSummary();

  if (!data || (data.pendingCount === 0 && data.deadLetterCount === 0)) return null;

  const handlePress = async () => {
    if (data.deadLetterCount > 0) {
      const rows = await listDeadLetters();
      Alert.alert(
        `${rows.length} ${rows.length === 1 ? 'entry needs' : 'entries need'} attention`,
        rows
          .slice(0, 5)
          .map((r) => `${r.endpoint}: ${r.last_error}`)
          .join('\n'),
        [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'Retry all',
            onPress: async () => {
              await Promise.all(rows.map((r) => retryDeadLetter(r.key)));
              await triggerFlush(queryClient);
            },
          },
        ],
      );
      return;
    }
    await triggerFlush(queryClient);
  };

  const tone = data.deadLetterCount > 0 ? 'critical' : 'warning';
  const label =
    data.deadLetterCount > 0
      ? `${data.deadLetterCount} ${data.deadLetterCount === 1 ? 'entry needs' : 'entries need'} attention`
      : `${data.pendingCount} queued`;

  return (
    <Pressable onPress={handlePress} style={styles.row} accessibilityRole="button">
      <View style={[styles.dot, { backgroundColor: theme[tone] }]} />
      <AppText variant="label" color={tone}>
        {label}
      </AppText>
      {data.lastSyncedAt !== null && (
        <AppText variant="data" color="muted" style={styles.synced}>
          synced {formatTime(new Date(data.lastSyncedAt))}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  synced: { marginLeft: 'auto' },
});
