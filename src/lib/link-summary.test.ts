/** Run: `bun src/lib/link-summary.test.ts`. */

import assert from 'node:assert/strict';

import { summarizeLots } from './link-summary';

const lot = (unit_count: number | null, linked: number, last: string | null, since = 0) => ({
  unit_count,
  _count: { stockUnits: linked },
  last_linked_at: last,
  linked_since: since,
});

const lots = [
  lot(10, 4, '2026-10-12T08:00:00Z', 4), // pending, 6 to go
  lot(null, 0, null), //                     pending, never split
  lot(null, 15, '2026-09-06T00:00:00Z'), //  pending, legacy: linked but no count
  lot(25, 25, '2026-10-12T10:36:00Z', 12), // complete, newest
  lot(20, 20, '2026-10-11T12:13:00Z'), //    complete
  lot(15, 15, '2026-09-06T21:26:00Z'), //    complete, oldest
];

const { pending, recent, kpis } = summarizeLots(lots, 2);

assert.equal(pending.length, 3);
assert.deepEqual(recent.map((p) => p.unit_count), [25, 20]); // newest first, capped at the limit
assert.equal(kpis.pendingCount, 3);
assert.equal(kpis.notSplit, 2);
assert.equal(kpis.codesToLink, 6); // only the lot with a known count contributes
assert.equal(kpis.linkedToday, 16);
assert.equal(kpis.lotsTouchedToday, 2);
assert.equal(kpis.completedCount, 3);
assert.equal(kpis.totalLots, 6);

// nothing at all is zeros, not a crash
const none = summarizeLots([]);
assert.deepEqual(none.pending, []);
assert.equal(none.kpis.codesToLink, 0);

console.log('link-summary ok');
