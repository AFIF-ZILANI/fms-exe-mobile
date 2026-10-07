/**
 * The scan session's decisions, verifiable without a camera or a server.
 * Run: `bun src/lib/scan-actions.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  checkUnit,
  consumptionBody,
  currentHouseId,
  currentHouseName,
  decideScan,
  newKeyStore,
  type ScanPlan,
} from './scan-actions';
import type { StockUnit } from './types';

const ITEM = { id: 'item-1', name: 'Newcastle vaccine', category: 'VACCINE', unit: 'ML', is_unit_tracked: true, is_active: true };
const OTHER = { ...ITEM, id: 'item-2', name: 'Antibiotic' };

function unit(over: Partial<StockUnit> = {}): StockUnit {
  return {
    id: 'u-1',
    purchase_item_id: 'pi-1',
    status: 'IN_STOCK',
    bound_at: null,
    bound_by_id: null,
    purchase_item: { id: 'pi-1', item_id: ITEM.id, unit: 'BOTTLE', item: ITEM },
    houseAllocations: [],
    ...over,
  };
}

const allocate: ScanPlan = { action: 'allocate', houseId: 'h-2' };
const consume: ScanPlan = { action: 'consume', houseId: 'h-2' };
const bind: ScanPlan = { action: 'bind', purchaseItemId: 'pi-1' };

// --- location -----------------------------------------------------------------
assert.equal(currentHouseId(unit()), null, 'no allocations = warehouse');
assert.equal(currentHouseName(unit()), 'Warehouse');
const inH1 = unit({ houseAllocations: [{ house_id: 'h-1', house: { id: 'h-1', name: 'House 1' } }] });
assert.equal(currentHouseId(inH1), 'h-1');
assert.equal(currentHouseName(inH1), 'House 1');
const returned = unit({ houseAllocations: [{ house_id: null, house: null }] });
assert.equal(currentHouseName(returned), 'Warehouse', 'a RETURN event puts it back in the warehouse');

// --- allocate -----------------------------------------------------------------
assert.deepEqual(checkUnit(allocate, unit()), { ok: true });
assert.deepEqual(checkUnit(allocate, inH1), { ok: true }, 'moving house to house is fine');
assert.deepEqual(
  checkUnit({ ...allocate, houseId: 'h-1' }, inH1),
  { ok: false, reason: 'Already in House 1.' },
  'already in the chosen house is rejected before any request',
);
assert.deepEqual(checkUnit(allocate, unit({ status: 'UNASSIGNED', purchase_item: null })), {
  ok: false,
  reason: 'Not linked to a purchase yet.',
});
assert.deepEqual(checkUnit(allocate, unit({ status: 'CONSUMED' })), { ok: false, reason: 'Already used up.' });
assert.deepEqual(checkUnit(allocate, unit({ status: 'DISPOSED' })), { ok: false, reason: 'Already disposed.' });

// --- item filter --------------------------------------------------------------
const filtered: ScanPlan = { ...allocate, itemId: OTHER.id, itemName: OTHER.name };
assert.deepEqual(checkUnit(filtered, unit()), {
  ok: false,
  reason: 'Not Antibiotic — this is Newcastle vaccine.',
});
assert.deepEqual(checkUnit({ ...filtered, itemId: ITEM.id }, unit()), { ok: true });

// --- consume ------------------------------------------------------------------
assert.deepEqual(checkUnit(consume, unit()), { ok: true });
assert.deepEqual(checkUnit(consume, unit({ status: 'IN_USE' })), { ok: true }, 'a bottle can be used again');
assert.equal(checkUnit(consume, unit({ status: 'CONSUMED' })).ok, false);
assert.equal(checkUnit(consume, unit({ status: 'UNASSIGNED', purchase_item: null })).ok, false);
assert.equal(
  checkUnit(consume, unit({ purchase_item: null })).ok,
  false,
  'a unit with no purchase record cannot be consumed (no item to draw)',
);

// --- bind ---------------------------------------------------------------------
assert.deepEqual(checkUnit(bind, unit({ status: 'UNASSIGNED', purchase_item: null })), { ok: true });
assert.deepEqual(checkUnit(bind, unit()), { ok: false, reason: 'Already linked · in stock' });
assert.deepEqual(checkUnit(bind, unit({ status: 'IN_USE' })), { ok: false, reason: 'Already linked · in use' });

// --- decisions ----------------------------------------------------------------
const ok = { ok: true } as const;
const bad = { ok: false, reason: 'nope' } as const;
assert.deepEqual(decideScan('auto', ok, false), { kind: 'commit' }, 'auto confirms a passing unit at once');
assert.deepEqual(decideScan('manual', ok, false), { kind: 'hold' }, 'manual waits for Confirm');
assert.deepEqual(decideScan('auto', bad, false), { kind: 'reject', reason: 'nope' });
assert.deepEqual(decideScan('manual', bad, false), { kind: 'reject', reason: 'nope' });
assert.deepEqual(decideScan('auto', ok, true), { kind: 'duplicate' }, 'already done this session');
assert.deepEqual(decideScan('manual', bad, true), { kind: 'duplicate' }, 'duplicate wins over a failing check');

// --- whole-unit consume body --------------------------------------------------
{
  const body = consumptionBody(unit(), {
    houseId: 'h-2',
    batchId: 'b-1',
    now: new Date('2026-10-07T08:00:00.000Z'),
    key: 'k-1',
  });
  assert.equal(body.quantity, 1, 'one whole unit');
  assert.equal(body.unit, 'BOTTLE', "the purchase line's unit, never the item's base unit (ML)");
  assert.notEqual(body.unit, ITEM.unit);
  assert.equal(body.item_id, ITEM.id);
  assert.equal(body.stock_unit_id, 'u-1');
  assert.equal(body.house_id, 'h-2');
  assert.equal(body.batch_id, 'b-1');
  assert.equal(body.date, '2026-10-07T08:00:00.000Z');
  assert.equal(body.idempotency_key, 'k-1');
  const noBatch = consumptionBody(unit(), { houseId: 'h-2', now: new Date(0), key: 'k' });
  assert.equal('batch_id' in noBatch, false, 'batch_id is omitted when the house has no running batch');
  assert.throws(() => consumptionBody(unit({ purchase_item: null }), { houseId: 'h', now: new Date(0), key: 'k' }));
}

// --- idempotency keys: a rescan after a lost response reuses the key -----------
{
  let n = 0;
  const keys = newKeyStore(() => `key-${++n}`);
  const first = keys.keyFor('u-1');
  assert.equal(keys.keyFor('u-1'), first, 'same unit, same key until it is dropped');
  assert.notEqual(keys.keyFor('u-2'), first);
  keys.drop('u-1');
  assert.notEqual(keys.keyFor('u-1'), first, 'after a confirmed write the next one gets a fresh key');
}

console.log('scan-actions checks passed');
