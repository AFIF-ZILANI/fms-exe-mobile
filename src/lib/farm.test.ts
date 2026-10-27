/** Run: `bun src/lib/farm.test.ts`. */

import assert from 'node:assert/strict';

import { dayOfCycle, expectedCycleDays } from './farm';

const placed = '2026-10-25T00:00:00.000Z';
// A local time on the given calendar day, wherever the phone is.
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h);

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
