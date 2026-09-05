import { Alert, Pressable, View, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOutboxSummary, triggerFlush } from '@/lib/use-outbox';
import { listDeadLetters, retryDeadLetter } from '@/lib/outbox';
import { formatTime } from '@/lib/format';

/**
 * Only rendered when there's something to say — a persistent "0 queued" row
 * trains people to ignore the exact component they must not ignore
 * (docs/layout/00-app-shell.md). Tapping with pending writes retries now;
 * tapping with dead letters offers to retry them.
 *
 * ponytail: dead-letter resolution is a native Alert, not a dedicated screen —
 * the 20 screens don't include a dead-letter manager, and this is a rare-path
 * safety net, not a primary flow. Upgrade to a real list view if dead letters
 * turn out to be common enough to need one.
 */
export function SyncBanner() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { data } = useOutboxSummary();

  if (!data || (data.pendingCount === 0 && data.deadLetterCount === 0)) return null;

  const dead = data.deadLetterCount > 0;

  const handlePress = async () => {
    if (dead) {
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

  const label = dead
    ? `${data.deadLetterCount} didn't send`
    : `${data.pendingCount} queued`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: dead ? theme.tintRed : theme.tintAmber, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Icon name={dead ? 'alert-circle' : 'refresh-cw'} size={20} color={dead ? 'critical' : 'warning'} />

      <AppText variant="label" style={styles.flex}>
        {label}
        {data.lastSyncedAt !== null && !dead ? (
          <AppText variant="caption" color="muted">
            {`  ·  synced ${formatTime(new Date(data.lastSyncedAt))}`}
          </AppText>
        ) : null}
      </AppText>

      <View style={styles.trailing}>
        <Icon name={dead ? 'chevron-right' : 'rotate-cw'} size={20} color="muted" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: Size.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  flex: { flex: 1 },
  trailing: { minWidth: 20, alignItems: 'flex-end' },
});
