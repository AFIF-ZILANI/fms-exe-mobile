import { Alert } from 'react-native';

import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';

/**
 * Log out — unless records on this phone have not uploaded yet. A queued write belongs to
 * whoever is signed in when it uploads, so nothing may be left behind.
 */
export function useLogout() {
  const { logout } = useSession();
  const { data: outbox } = useOutboxSummary();

  return () => {
    const pending = (outbox?.pendingCount ?? 0) + (outbox?.deadLetterCount ?? 0);
    if (pending > 0) {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
      return;
    }
    void logout();
  };
}
