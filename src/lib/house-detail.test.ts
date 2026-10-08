/** House page wording. Run: `bun src/lib/house-detail.test.ts`. */

import assert from 'node:assert/strict';

import { daysLeft, freshness, newestIso } from './house-detail';

// Built from LOCAL components so the tests pass in any timezone: "today" is the phone's calendar day.
const now = new Date(2026, 9, 7, 9, 30); // 7 Oct 2026, 09:30 local
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

// --- freshness: calendar days where the person is ---------------------------------------------------
assert.deepEqual(freshness(at(2026, 9, 7, 8, 0), now), { text: 'Today', today: true });
assert.deepEqual(freshness(at(2026, 9, 7, 0, 5), now), { text: 'Today', today: true }, 'just after local midnight is still today');
assert.deepEqual(freshness(at(2026, 9, 6, 23, 55), now), { text: 'Yesterday', today: false }, 'five minutes before midnight is yesterday, not "0 days"');
assert.deepEqual(freshness(at(2026, 9, 5), now), { text: '2 days ago', today: false });
assert.deepEqual(freshness(at(2026, 9, 1), now), { text: '6 days ago', today: false });
assert.deepEqual(freshness(at(2026, 8, 30), now), { text: '7 days ago', today: false });
assert.deepEqual(freshness(at(2026, 8, 23), now), { text: '2 weeks ago', today: false });
assert.deepEqual(freshness(at(2026, 7, 12), now), { text: '8 weeks ago', today: false }, '56 days');
assert.deepEqual(freshness(at(2026, 7, 7), now), { text: 'Over 2 months ago', today: false }, '61 days');
assert.deepEqual(freshness(at(2026, 5, 1), now), { text: 'Over 2 months ago', today: false });

// A timestamp slightly in the future (a phone clock a few minutes behind) is still today.
assert.deepEqual(freshness(at(2026, 9, 7, 9, 45), now), { text: 'Today', today: true });

// --- no record / junk --------------------------------------------------------------------------------
assert.deepEqual(freshness(null, now), { text: 'No record yet', today: false });
assert.deepEqual(freshness(undefined, now), { text: 'No record yet', today: false });
assert.deepEqual(freshness('', now), { text: 'No record yet', today: false });
assert.deepEqual(freshness('not a date', now), { text: 'No record yet', today: false });

// --- newest of two optional timestamps (medication vs vaccination) --------------------------------------
assert.equal(newestIso('2026-10-01T00:00:00.000Z', '2026-10-05T00:00:00.000Z'), '2026-10-05T00:00:00.000Z');
assert.equal(newestIso('2026-10-05T00:00:00.000Z', '2026-10-01T00:00:00.000Z'), '2026-10-05T00:00:00.000Z');
assert.equal(newestIso(null, '2026-10-05T00:00:00.000Z'), '2026-10-05T00:00:00.000Z');
assert.equal(newestIso('2026-10-05T00:00:00.000Z', undefined), '2026-10-05T00:00:00.000Z');
assert.equal(newestIso(null, undefined), null);
assert.equal(newestIso('garbage', '2026-10-05T00:00:00.000Z'), '2026-10-05T00:00:00.000Z', 'an unparsable date never wins');
assert.equal(newestIso('garbage', null), null);

// --- days left ------------------------------------------------------------------------------------------
assert.deepEqual(daysLeft(17, 60), { text: '43 days left', warn: false });
assert.deepEqual(daysLeft(56, 60), { text: '4 days left', warn: false });
assert.deepEqual(daysLeft(57, 60), { text: '3 days left', warn: true });
assert.deepEqual(daysLeft(59, 60), { text: '1 day left', warn: true });
assert.deepEqual(daysLeft(60, 60), { text: 'Cycle ends today', warn: true });
// Past the planned end there is no negative count: the bar and "past plan" already say it.
assert.deepEqual(daysLeft(61, 60), { text: 'Past planned end', warn: true });
assert.deepEqual(daysLeft(5, 0), { text: '', warn: false }, 'no planned length, nothing to count down');
assert.deepEqual(daysLeft(Number.NaN, 30), { text: '', warn: false });

console.log('house-detail checks passed');
