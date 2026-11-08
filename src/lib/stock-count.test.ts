/** Run: `bun src/lib/stock-count.test.ts`. */

import assert from 'node:assert/strict';

import {
  alreadyDone,
  canConsume,
  consumeBlockReason,
  daysAgo,
  diffCount,
  farmDateParam,
  strayNote,
  type CountUnit,
} from './stock-count';
import { setDayStartHour } from './farm';
import type { StockUnit } from './types';

const unit = (id: string, category = 'MEDICINE'): CountUnit => ({
  id,
  status: 'BOUND',
  item: { id: 'i', name: 'Amino', category, unit: 'ML' },
});
const stray = (id: string, status: StockUnit['status']): StockUnit => ({
  id,
  status,
  purchase_item_id: 'p',
  bound_at: null,
  bound_by_id: null,
});

const expected = [unit('a'), unit('b'), unit('c')];

// missing = expected - scanned; a code scanned twice counts once
{
  const r = diffCount(expected, ['a', 'a', 'c'], new Map());
  assert.deepEqual(
    r.missing.map((u) => u.id),
    ['b'],
  );
  assert.deepEqual(
    r.counted.map((u) => u.id),
    ['a', 'c'],
  );
  assert.equal(r.foundHere.length, 0);
}

// nothing scanned: everything is missing
assert.equal(diffCount(expected, [], new Map()).missing.length, 3);

// strays: live elsewhere -> found here; used up / disposed / unknown / unbound -> notes
{
  const strays = new Map<string, StockUnit | null>([
    ['x', stray('x', 'IN_USE')],
    ['y', stray('y', 'CONSUMED')],
    ['z', null],
    ['w', stray('w', 'PRINTED')],
  ]);
  const r = diffCount(expected, ['a', 'x', 'y', 'z', 'w'], strays);
  assert.deepEqual(
    r.foundHere.map((s) => s.id),
    ['x'],
  );
  assert.deepEqual(
    r.notes.map((s) => s.id),
    ['y', 'z', 'w'],
  );
  assert.equal(strayNote(r.notes[0]!), 'Marked used up, but it is here');
  assert.equal(strayNote(r.notes[1]!), 'Unknown code');
  assert.equal(strayNote(r.notes[2]!), 'Not linked to a delivery yet');
}

// a stray not looked up yet (lookup failed) is a note, never a crash
assert.equal(diffCount(expected, ['q'], new Map()).notes[0]!.unit, null);

// consumed needs an open batch
assert.match(consumeBlockReason(null)!, /No batch/);
assert.match(consumeBlockReason({ id: '1', batch_code: 'B-1', status: 'CLOSED' })!, /B-1 is finalised/);
assert.equal(consumeBlockReason({ id: '1', batch_code: 'B-1', status: 'SOLD' }), null);
assert.equal(consumeBlockReason({ id: '1', batch_code: 'B-1', status: 'RUNNING' }), null);

// equipment can't be consumed
assert.equal(canConsume([unit('a'), unit('e', 'EQUIPMENT')]), false);
assert.equal(canConsume([unit('a')]), true);
assert.equal(canConsume([]), false);

// farm dates: Dhaka is UTC+6, so 20:00 UTC is already the next farm day
assert.equal(farmDateParam(new Date('2026-11-08T17:00:00Z')), '2026-11-08');
assert.equal(farmDateParam(new Date('2026-11-08T20:00:00Z')), '2026-11-09');
// with the day starting at 04:00, 02:00 Dhaka (20:00 UTC) still belongs to the day before
setDayStartHour(4);
assert.equal(farmDateParam(new Date('2026-11-08T20:00:00Z')), '2026-11-08');
setDayStartHour(0);
assert.equal(farmDateParam(daysAgo(1, new Date('2026-11-08T10:00:00Z'))), '2026-11-07');

// a retried write that already landed counts as done; anything else stays an error
assert.equal(alreadyDone('CONSUMED', { status: 409, message: 'StockUnit is consumed' }), true);
assert.equal(alreadyDone('DISPOSE', { status: 409, message: 'StockUnit is already disposed' }), true);
assert.equal(alreadyDone('MOVE', { status: 409, message: 'Unit is already at that house' }), true);
assert.equal(alreadyDone('CONSUMED', { status: 409, message: 'Batch B-1 is finalised' }), false);
assert.equal(alreadyDone('CONSUMED', { status: 400, message: 'StockUnit is consumed' }), false);

console.log('stock-count: ok');
