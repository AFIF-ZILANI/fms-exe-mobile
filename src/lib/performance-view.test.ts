/** My-performance maths. Run: `bun src/lib/performance-view.test.ts`. */

import assert from 'node:assert/strict';

import { monthOffsetFor, recordForMonth, scalePosition, signedPercent, splitPoints, ZERO_POSITION } from './performance-view';

// the scale: −10 is the floor, +20 the ceiling, zero a third of the way in
assert.equal(scalePosition(-10), 0);
assert.equal(scalePosition(20), 1);
assert.ok(Math.abs(scalePosition(0) - 1 / 3) < 1e-9);
assert.ok(Math.abs(ZERO_POSITION - 1 / 3) < 1e-9);
assert.equal(scalePosition(-25), 0, 'below the floor pins to the floor');
assert.equal(scalePosition(99), 1, 'above the ceiling pins to the ceiling');
assert.ok(Math.abs(scalePosition(5) - 0.5) < 1e-9);

// earned and lost
assert.deepEqual(splitPoints([{ points: 3 }, { points: -2 }, { points: 2 }, { points: -1 }]), { earned: 5, lost: 3 });
assert.deepEqual(splitPoints([]), { earned: 0, lost: 0 });
assert.deepEqual(splitPoints([{ points: 0 }]), { earned: 0, lost: 0 });

// month arithmetic: 8 Oct 2026 local
const now = new Date(2026, 9, 8);
assert.equal(monthOffsetFor('2026-10-01T00:00:00.000Z', now), 0);
assert.equal(monthOffsetFor('2026-09-01T00:00:00.000Z', now), -1);
assert.equal(monthOffsetFor('2025-12-01T00:00:00.000Z', now), -10, 'across a year boundary');

// the record for a viewed month
const records = [{ month: '2026-09-01T00:00:00.000Z', id: 'sep' }, { month: '2026-08-01T00:00:00.000Z', id: 'aug' }];
assert.equal(recordForMonth(records, new Date(2026, 8, 15))?.id, 'sep');
assert.equal(recordForMonth(records, new Date(2026, 9, 1)), undefined, 'October has no payroll yet');

// percent wording
assert.equal(signedPercent(3), '+3%');
assert.equal(signedPercent('-2'), '-2%');
assert.equal(signedPercent(0), '0%');
assert.equal(signedPercent('3.0'), '+3%');

console.log('performance-view checks passed');
