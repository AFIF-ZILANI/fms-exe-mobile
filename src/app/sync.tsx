import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRelative } from '@/lib/format';
import { discardDeadLetter, retryDeadLetter, type OutboxRow } from '@/lib/outbox';
import { describeOutboxRow, plainReason } from '@/lib/outbox-describe';
import { useSession } from '@/lib/session';
import { SUMMARY_KEY, triggerFlush, useOutboxRows, useOutboxSummary } from '@/lib/use-outbox';

/** docs/navigation-redesign-design.md Phase 2 — what is waiting to send, what failed and why. */
export default function SyncCenterScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { signedIn } = useSession();
  const { data: summary } = useOutboxSummary();
  const rows = useOutboxRows();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const failed = rows?.failed ?? [];
  const pending = rows?.pending ?? [];
  const lastSynced = summary?.lastSyncedAt ? formatRelative(new Date(summary.lastSyncedAt)) : 'Not yet';

  const syncNow = async () => {
    setSyncing(true);
    try {
      await triggerFlush(queryClient);
    } finally {
      setSyncing(false);
    }
  };

  const retry = async (row: OutboxRow) => {
    setBusyKey(row.key);
    try {
      await retryDeadLetter(row.key);
      await triggerFlush(queryClient);
    } catch (e) {
      Alert.alert('Not done', e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const discard = (row: OutboxRow) => {
    Alert.alert('Discard this record?', 'It was never saved on the server, and it will not be sent.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await discardDeadLetter(row.key);
              await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
            } catch (e) {
              Alert.alert('Not done', e instanceof Error ? e.message : 'Something went wrong. Try again.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Sync center" leading="back" />
      <AppText variant="caption" color="muted">
        Last synced: {lastSynced}
      </AppText>

      {rows && failed.length === 0 && pending.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="check-circle"
            tint="tintGreen"
            title="Everything is sent."
            body="Nothing is waiting on this phone."
          />
        </View>
      ) : null}

      {failed.length > 0 ? (
        <Card eyebrow="Couldn't send" note={String(failed.length)} style={styles.card}>
          {failed.map((row, i) => {
            const { title, detail } = describeOutboxRow(row);
            return (
              <View key={row.key} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                <View style={styles.head}>
                  <Icon name="alert-circle" size={20} color="critical" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{title}</AppText>
                    {detail ? (
                      <AppText variant="body" color="inkSoft">
                        {detail}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="muted">
                      Recorded {formatRelative(new Date(row.created_at))}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color="critical">
                  {plainReason(row.last_error)}
                </AppText>
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <Button
                      variant="secondary"
                      label="Retry"
                      icon="rotate-cw"
                      onPress={() => void retry(row)}
                      loading={busyKey === row.key}
                      block
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button variant="secondary" label="Discard" onPress={() => discard(row)} disabled={busyKey === row.key} block />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card eyebrow="Waiting to send" note={String(pending.length)} style={styles.card}>
          {pending.map((row, i) => {
            const { title, detail } = describeOutboxRow(row);
            return (
              <View key={row.key} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                <View style={styles.head}>
                  <Icon name="clock" size={20} color="warning" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{title}</AppText>
                    {detail ? (
                      <AppText variant="body" color="inkSoft">
                        {detail}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="muted">
                      Recorded {formatRelative(new Date(row.created_at))} · sends when you&apos;re online
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.syncNow}>
            <Button variant="secondary" label="Sync now" icon="refresh-cw" onPress={() => void syncNow()} loading={syncing} block />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  empty: { marginTop: Spacing.md },
  item: { gap: Spacing.sm, paddingVertical: Spacing.md },
  head: { flexDirection: 'row', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md },
  syncNow: { marginTop: Spacing.sm },
});
