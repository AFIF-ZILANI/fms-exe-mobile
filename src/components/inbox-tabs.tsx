import { router } from 'expo-router';

import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { useGetData, type Paginated } from '@/lib/api';
import { useUnreadNotifications } from '@/lib/use-unread-notifications';
import type { FarmAlert } from '@/lib/types';

type Tab = 'notifications' | 'alerts';

/** The switch between the two halves of the inbox: what happened to me, and what the farm needs looked at.
 *  Each is its own screen; this just moves between them, and carries the counts so neither is missed. */
export function InboxTabs({ current }: { current: Tab }) {
  const unread = useUnreadNotifications();
  // Same URL and key as the Alerts screen and Home, so this costs nothing extra.
  const active = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const alerts = active.data?.total ?? active.data?.results.length ?? 0;

  return (
    <SegmentedToggle
      value={current}
      onChange={(tab) => {
        if (tab !== current) router.replace(tab === 'alerts' ? '/alerts' : '/notifications');
      }}
      options={[
        { value: 'notifications', label: unread > 0 ? `Notifications · ${unread}` : 'Notifications' },
        { value: 'alerts', label: alerts > 0 ? `Alerts · ${alerts}` : 'Alerts' },
      ]}
    />
  );
}
