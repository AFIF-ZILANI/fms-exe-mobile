import { useGetData } from '@/lib/api';
import { useSession } from '@/lib/session';

export const UNREAD_KEY = ['notifications', 'unread-count'];
export const NOTIFICATIONS_KEY = ['notifications', 'list'];

/** How many notifications the signed-in person has not read. Re-checked every minute and whenever the app
 *  comes back to the front, so the bell stays honest without push. */
export function useUnreadNotifications(): number {
  const { signedIn } = useSession();
  const { data } = useGetData<{ count: number }>('/notifications/unread-count', UNREAD_KEY, {
    enabled: signedIn,
    refetchInterval: 60_000,
  });
  return data?.count ?? 0;
}
