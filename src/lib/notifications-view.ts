import type { IconName } from '../components/ui/icon';
import type { AppNotification, NotificationKind } from './types';

type Look = { icon: IconName; tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue' | 'primarySoft' | 'surfaceAlt' };

/** One icon and tint per kind, so a person can tell tasks from points from pay at a glance. */
const LOOK: Record<NotificationKind, Look> = {
  TASK_ASSIGNED: { icon: 'check-square', tint: 'tintBlue' },
  POINTS_GIVEN: { icon: 'award', tint: 'tintAmber' },
  POINTS_VOIDED: { icon: 'rotate-ccw', tint: 'surfaceAlt' },
  PAYSLIP_READY: { icon: 'file-text', tint: 'tintGreen' },
  PAYOUT_CONFIRMED: { icon: 'check-circle', tint: 'tintGreen' },
  PAYOUT_FAILED: { icon: 'alert-circle', tint: 'tintRed' },
  BONUS_GRANTED: { icon: 'gift', tint: 'tintAmber' },
  PASSWORD_CHANGED: { icon: 'lock', tint: 'primarySoft' },
  PASSWORD_RESET: { icon: 'key', tint: 'primarySoft' },
};

export const notificationLook = (kind: NotificationKind): Look =>
  LOOK[kind] ?? { icon: 'bell', tint: 'surfaceAlt' };

/** Where tapping a notification goes. Pay and points all live on My performance; the account ones have no
 *  screen of their own. Null means there is nowhere to go, so the tap only marks it read. */
export function notificationHref(n: Pick<AppNotification, 'kind' | 'related_id'>): string | null {
  switch (n.kind) {
    case 'TASK_ASSIGNED':
      return n.related_id ? `/tasks/${n.related_id}` : null;
    case 'POINTS_GIVEN':
    case 'POINTS_VOIDED':
    case 'PAYSLIP_READY':
    case 'PAYOUT_CONFIRMED':
    case 'PAYOUT_FAILED':
    case 'BONUS_GRANTED':
      return '/performance';
    default:
      return null;
  }
}

export type NotificationGroup = { title: 'Today' | 'Earlier'; items: AppNotification[] };

/** Splits newest-first notifications into Today (the phone's calendar day) and Earlier, dropping empty groups. */
export function groupNotifications(items: AppNotification[], now: Date): NotificationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of items) {
    const at = new Date(n.created_at).getTime();
    // An unreadable date goes to Earlier rather than vanishing.
    (at >= startOfToday ? today : earlier).push(n);
  }
  return [
    { title: 'Today' as const, items: today },
    { title: 'Earlier' as const, items: earlier },
  ].filter((g) => g.items.length > 0);
}

export const unreadCount = (items: AppNotification[]): number => items.filter((n) => !n.read_at).length;
