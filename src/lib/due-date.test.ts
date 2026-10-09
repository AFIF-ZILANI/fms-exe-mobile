/** Date/time dialog conversions. Run: `TZ=Asia/Dhaka bun src/lib/due-date.test.ts` (any TZ works). */
import assert from 'node:assert/strict';

import { isPastDue, quickDueOptions, sameMinute, toPickerDay, withPickedDay, withPickedTime } from './due-date';

// 9pm local on 8 Oct is still the 8th as a picker day, whatever the zone.
const evening = new Date(2026, 9, 8, 21, 30);
assert.equal(toPickerDay(evening).toISOString(), '2026-10-08T00:00:00.000Z');
// 01:00 local on the 9th is the 9th, even where UTC is still the 8th.
assert.equal(toPickerDay(new Date(2026, 9, 9, 1, 0)).toISOString(), '2026-10-09T00:00:00.000Z');

// Picking the 12th keeps the existing local time of day.
const picked = withPickedDay(new Date('2026-10-12T00:00:00.000Z'), new Date(2026, 9, 8, 15, 45));
assert.deepEqual([picked.getFullYear(), picked.getMonth(), picked.getDate(), picked.getHours(), picked.getMinutes()], [2026, 9, 12, 15, 45]);

// Picking 07:15 keeps the existing local day.
const timed = withPickedTime(new Date(2026, 0, 1, 7, 15), new Date(2026, 9, 12, 15, 45));
assert.deepEqual([timed.getFullYear(), timed.getMonth(), timed.getDate(), timed.getHours(), timed.getMinutes()], [2026, 9, 12, 7, 15]);

// A round trip through the picker is a no-op on the day.
const base = new Date(2026, 9, 8, 23, 59);
assert.equal(withPickedDay(toPickerDay(base), base).getTime(), new Date(2026, 9, 8, 23, 59).getTime());

// quick picks: at 10:10 all three are offered, rounded to a quarter hour
const ten = new Date(2026, 9, 8, 10, 10);
const picks = quickDueOptions(ten);
assert.deepEqual(picks.map((p) => p.label), ['In 1 hour', 'Today 6 PM', 'Tomorrow 8 AM']);
assert.deepEqual([picks[0]!.date.getHours(), picks[0]!.date.getMinutes()], [11, 15], '11:10 rounds up to 11:15');
assert.deepEqual([picks[1]!.date.getHours(), picks[1]!.date.getMinutes()], [18, 0]);
assert.deepEqual([picks[2]!.date.getDate(), picks[2]!.date.getHours()], [9, 8]);
// at 17:00 "today 6 PM" is too close to offer; at 16:30 it is exactly 90 minutes out, so it stays
assert.deepEqual(quickDueOptions(new Date(2026, 9, 8, 17, 0)).map((p) => p.label), ['In 1 hour', 'Tomorrow 8 AM']);
assert.ok(quickDueOptions(new Date(2026, 9, 8, 16, 30)).some((p) => p.label === 'Today 6 PM'));
// across a month end, tomorrow is the 1st
assert.deepEqual([quickDueOptions(new Date(2026, 9, 31, 20, 0)).at(-1)!.date.getMonth(), quickDueOptions(new Date(2026, 9, 31, 20, 0)).at(-1)!.date.getDate()], [10, 1]);

// past or not
assert.equal(isPastDue(new Date(2026, 9, 8, 10, 0), new Date(2026, 9, 8, 10, 0)), true, 'due right now is already late');
assert.equal(isPastDue(new Date(2026, 9, 8, 10, 1), new Date(2026, 9, 8, 10, 0)), false);
assert.equal(sameMinute(new Date(2026, 9, 8, 10, 0, 5), new Date(2026, 9, 8, 10, 0, 50)), true);
assert.equal(sameMinute(new Date(2026, 9, 8, 10, 0), new Date(2026, 9, 8, 10, 1)), false);

console.log('due-date checks passed');
