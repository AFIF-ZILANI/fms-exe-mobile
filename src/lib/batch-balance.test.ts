/** Which balance row a log form uses for a house. Run: `bun src/lib/batch-balance.test.ts`. */

import assert from 'node:assert/strict';

import { pickLiveBalance } from './batch-balance';
import type { BatchHouseBalance } from './types';

const row = (batch_id: string, quantity: number): BatchHouseBalance => ({
  id: `r-${batch_id}`,
  batch_id,
  house_id: 'h1',
  quantity,
  updated_at: '2026-10-01T00:00:00.000Z',
});

// Normal case: the first row has birds.
assert.equal(pickLiveBalance([row('a', 100), row('b', 50)])?.batch_id, 'a');

// The reported bug: a zero row (a batch moved out or fully lost) sorts ahead of the live batch.
assert.equal(pickLiveBalance([row('old', 0), row('live', 800)])?.batch_id, 'live');
assert.equal(pickLiveBalance([row('old', 0), row('older', 0), row('live', 1)])?.batch_id, 'live');

// No row has birds: keep the old behaviour (the first row), so a form can still resolve its batch.
assert.equal(pickLiveBalance([row('only', 0)])?.batch_id, 'only');
assert.equal(pickLiveBalance([row('x', 0), row('y', 0)])?.batch_id, 'x');

// Nothing at all.
assert.equal(pickLiveBalance([]), null);
assert.equal(pickLiveBalance(undefined), null);

console.log('batch-balance checks passed');
