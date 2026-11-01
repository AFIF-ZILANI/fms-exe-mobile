/** Run: `bun src/lib/farm.test.ts`. */

import assert from 'node:assert/strict';

import { dayOfCycle, expectedCycleDays, setDayStartHour } from './farm';

const placed = '2026-10-25T00:00:00.000Z';
// A Dhaka wall-clock time (UTC+6) on the given day, wherever the phone or test machine is.
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 6, min));

assert.equal(dayOfCycle(placed, at(2026, 10, 25, 0)), 1); // just after midnight on placement day
assert.equal(dayOfCycle(placed, at(2026, 10, 25, 23)), 1); // still Day 1 that evening
assert.equal(dayOfCycle(placed, at(2026, 10, 26, 0)), 2); // ticks over at midnight
assert.equal(dayOfCycle(placed, at(2026, 10, 27)), 3);
assert.equal(dayOfCycle(placed, at(2026, 11, 24)), 31); // across a month end
assert.equal(dayOfCycle(placed, at(2026, 10, 20)), 1); // a future placement never reads Day 0 or less

// Placed Sep 6, sold Nov 5: the sale is on Day 61.
assert.equal(expectedCycleDays({ starting_date: '2026-09-06T00:00:00.000Z', expected_selling_date: '2026-11-05T00:00:00.000Z' }), 61);
assert.equal(dayOfCycle('2026-09-06T00:00:00.000Z', at(2026, 11, 5)), 61); // so on the sale day, Day 61 of 61
// Unusable dates fall back.
assert.equal(expectedCycleDays({ starting_date: '2026-09-06T00:00:00.000Z', expected_selling_date: '2026-09-06T00:00:00.000Z' }), 35);

// With the farm day starting at 04:00, the small hours stay on the previous day.
setDayStartHour(4);
assert.equal(dayOfCycle(placed, at(2026, 10, 26, 3, 59)), 1);
assert.equal(dayOfCycle(placed, at(2026, 10, 26, 4)), 2);
assert.equal(dayOfCycle(placed, at(2026, 10, 25, 4)), 1);
setDayStartHour(0);
