import { Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { discardDeadLetter, listDeadLetters, listPending } from '@/lib/outbox';
import { logoutDecision } from '@/lib/logout-decision';
import { useSession } from '@/lib/session';
import { SUMMARY_KEY, useOutboxSummary } from '@/lib/use-outbox';

/**
 * Log out. Records still waiting to send block it (they would upload under whoever signs in next).
 * Failed records ask first: review them in the Sync center, or log out and discard them.
 */
export function useLogout() {
  const { logout } = useSession();
  const { data: outbox } = useOutboxSummary();
  const queryClient = useQueryClient();

  return () => {
    const pending = outbox?.pendingCount ?? 0;
    const failed = outbox?.deadLetterCount ?? 0;
    const decision = logoutDecision(pending, failed);

    const syncFirst = (n: number) =>
      Alert.alert(
        'Sync first',
        `${n} record${n === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );

    if (decision === 'blocked') {
      syncFirst(pending);
      return;
    }

    if (decision === 'confirm-discard') {
      Alert.alert(
        `${failed} record${failed === 1 ? '' : 's'} couldn't send`,
        "They're only on this phone. Review them, or log out and discard them.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Review', onPress: () => router.push('/sync' as Href) },
          {
            text: 'Log out and discard',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  // The cached counts may be stale: re-check the database before discarding anything.
                  const waiting = await listPending();
                  if (waiting.length > 0) {
                    syncFirst(waiting.length);
                    return;
                  }
                  for (const row of await listDeadLetters()) await discardDeadLetter(row.key);
                  await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
                } catch (e) {
                  Alert.alert('Not done', e instanceof Error ? e.message : 'Something went wrong. Try again.');
                  return;
                }
                void logout();
              })();
            },
          },
        ],
      );
      return;
    }

    void logout();
  };
}
