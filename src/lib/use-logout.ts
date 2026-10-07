import { Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { discardDeadLetter, listDeadLetters } from '@/lib/outbox';
import { logoutDecision } from '@/lib/logout-decision';
import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';

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

    if (decision === 'blocked') {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
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
                // Only the failed ones: pending records never reach this branch.
                for (const row of await listDeadLetters()) await discardDeadLetter(row.key);
                await queryClient.invalidateQueries();
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
