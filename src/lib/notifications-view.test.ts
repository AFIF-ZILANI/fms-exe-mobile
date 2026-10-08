/** Notification grouping and destinations. Run: `bun src/lib/notifications-view.test.ts`. */

import assert from 'node:assert/strict';

import { groupNotifications, notificationHref, notificationLook, unreadCount } from './notifications-view';
import type { AppNotification } from './types';

const n = (id: string, created_at: string, over: Partial<AppNotification> = {}): AppNotification => ({
  id,
  kind: 'POINTS_GIVEN',
  title: id,
  body: null,
  related_id: null,
  read_at: null,
  created_at,
  ...over,
});

// --- where a tap goes ---
assert.equal(notificationHref({ kind: 'TASK_ASSIGNED', related_id: 't1' }), '/tasks/t1');
assert.equal(notificationHref({ kind: 'TASK_ASSIGNED', related_id: null }), null);
for (const kind of ['POINTS_GIVEN', 'POINTS_VOIDED', 'PAYSLIP_READY', 'PAYOUT_CONFIRMED', 'PAYOUT_FAILED', 'BONUS_GRANTED'] as const) {
  assert.equal(notificationHref({ kind, related_id: 'x' }), '/performance', kind);
}
assert.equal(notificationHref({ kind: 'PASSWORD_CHANGED', related_id: null }), null);
assert.equal(notificationHref({ kind: 'PASSWORD_RESET', related_id: null }), null);

// --- every kind has an icon, and an unknown one falls back to a bell ---
assert.equal(notificationLook('TASK_ASSIGNED').icon, 'check-square');
assert.equal(notificationLook('SOMETHING_NEW' as never).icon, 'bell');

// --- grouping (local calendar day) ---
const now = new Date(2026, 9, 8, 15, 0); // 8 Oct, 3pm local
const groups = groupNotifications(
  [
    n('a', new Date(2026, 9, 8, 14, 0).toISOString()),
    n('b', new Date(2026, 9, 8, 0, 5).toISOString()),
    n('c', new Date(2026, 9, 7, 23, 59).toISOString()),
    n('d', 'not a date'),
  ],
  now,
);
assert.deepEqual(groups.map((g) => g.title), ['Today', 'Earlier']);
assert.deepEqual(groups[0]!.items.map((x) => x.id), ['a', 'b']);
assert.deepEqual(groups[1]!.items.map((x) => x.id), ['c', 'd'], 'an unreadable date is kept, under Earlier');
assert.deepEqual(groupNotifications([], now), []);
assert.deepEqual(groupNotifications([n('e', new Date(2026, 9, 1).toISOString())], now).map((g) => g.title), ['Earlier']);

// --- unread ---
assert.equal(unreadCount([n('a', 'x'), n('b', 'x', { read_at: '2026-10-08T00:00:00Z' })]), 1);

console.log('notifications-view checks passed');
