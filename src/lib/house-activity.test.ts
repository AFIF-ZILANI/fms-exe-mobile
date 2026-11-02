import assert from 'node:assert/strict';


import { setDayStartHour } from './farm';
import { activityMeta, activityStamp, groupByDay, type ActivityEntry } from './house-activity';

// The times shown are the phone's clock, which on the farm is Dhaka's; pin it so the test runs anywhere.
process.env.TZ = 'Asia/Dhaka';

// Dhaka wall-clock time (UTC+6) as an instant.
const dhaka = (d: number, h: number, min = 0) => new Date(Date.UTC(2026, 10, d, h - 6, min)).toISOString();
const now = new Date(dhaka(2, 10));
const entry = (id: string, at: string, extra: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id,
  kind: 'MORTALITY',
  at,
  title: 't',
  detail: null,
  by: null,
  batch_code: null,
  ...extra,
});

assert.deepEqual(activityStamp({ at: dhaka(2, 9, 5) }, now), { time: '09:05', day: 'Today' });
assert.deepEqual(activityStamp({ at: dhaka(1, 18, 30) }, now), { time: '18:30', day: 'Yesterday' });
assert.deepEqual(activityStamp({ at: new Date(Date.UTC(2026, 9, 28, 1)).toISOString() }, now), { time: '07:00', day: '28 Oct' });
// A weighing known only by its day shows no made-up time.
assert.deepEqual(activityStamp({ at: '2026-11-01T00:00:00.000Z', day_only: true }, now), { time: null, day: 'Yesterday' });

assert.equal(activityMeta(entry('a', dhaka(2, 9), { detail: 'Heat', by: 'Rahim', batch_code: 'B-7' })), 'Heat · Rahim · B-7');
assert.equal(activityMeta(entry('a', dhaka(2, 9), { by: 'Rahim' })), 'Rahim');

// Grouped by farm day: with the day starting at 04:00, 01:30 on the 2nd still belongs to the 1st.
setDayStartHour(4);
const groups = groupByDay([entry('a', dhaka(2, 9)), entry('b', dhaka(2, 1, 30)), entry('c', dhaka(1, 20))], now);
assert.deepEqual(groups.map((g) => [g.label, g.entries.map((e) => e.id)]), [
  ['Today', ['a']],
  ['Yesterday', ['b', 'c']],
]);
setDayStartHour(0);

console.log('house-activity ok');
