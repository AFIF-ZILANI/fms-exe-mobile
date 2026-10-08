/** Date/time dialog conversions. Run: `TZ=Asia/Dhaka bun src/lib/due-date.test.ts` (any TZ works). */
import assert from 'node:assert/strict';

import { toPickerDay, withPickedDay, withPickedTime } from './due-date';

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

console.log('due-date checks passed');
