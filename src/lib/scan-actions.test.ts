/**
 * The scan session's decisions, verifiable without a camera or a server.
 * Run: `bun src/lib/scan-actions.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  checkUnit,
  unitUseBody,
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
    status: 'BOUND',
    bound_at: null,
    bound_by_id: null,
    purchase_item: { id: 'pi-1', item_id: ITEM.id, unit: 'BOTTLE', item: ITEM },
    houseAllocations: [],
    ...over,
  };
}

const allocate: ScanPlan = { action: 'allocate', houseId: 'h-2' };
const start: ScanPlan = { action: 'start', houseId: 'h-2', houseName: 'House 2' };
const finish: ScanPlan = { ...start, action: 'finish' };
const inH2 = unit({ houseAllocations: [{ house_id: 'h-2', house: { id: 'h-2', name: 'House 2' } }] });
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
assert.deepEqual(checkUnit(allocate, unit({ status: 'PRINTED', purchase_item: null })), {
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

// --- start / finish ("Use an item") -------------------------------------------
for (const plan of [start, finish]) {
  assert.deepEqual(checkUnit(plan, inH2), { ok: true }, `${plan.action}: a unit in this house`);
  assert.deepEqual(
    checkUnit(plan, unit()),
    { ok: false, reason: "It's at Warehouse, not House 2 — move it here first." },
    'never moved = still in the warehouse',
  );
  assert.deepEqual(
    checkUnit(plan, inH1),
    { ok: false, reason: "It's at House 1, not House 2 — move it here first." },
    'in another house',
  );
  assert.deepEqual(
    checkUnit(plan, unit({ houseAllocations: [{ house_id: null, house: null }] })),
    { ok: false, reason: "It's at Warehouse, not House 2 — move it here first." },
    'returned to the warehouse',
  );
  assert.deepEqual(
    checkUnit({ ...plan, houseName: undefined }, unit()),
    { ok: false, reason: "It's at Warehouse, not this house — move it here first." },
  );
  assert.equal(checkUnit(plan, { ...inH2, status: 'CONSUMED' }).ok, false);
  assert.equal(checkUnit(plan, unit({ status: 'UNASSIGNED', purchase_item: null })).ok, false);
  assert.equal(checkUnit(plan, unit({ purchase_item: null })).ok, false, 'no purchase record = no item');
  assert.deepEqual(
    checkUnit({ ...plan, itemId: 'item-2', itemName: 'Antibiotic' }, inH2),
    { ok: false, reason: 'Not Antibiotic — this is Newcastle vaccine.' },
    'a chosen item only accepts that item',
  );
  assert.deepEqual(checkUnit({ ...plan, itemId: undefined }, inH2), { ok: true }, 'no item chosen = any item');
}
assert.deepEqual(
  checkUnit(start, { ...inH2, status: 'IN_USE' }),
  { ok: false, reason: 'Already in use.' },
  'an opened unit cannot be started again',
);
assert.deepEqual(
  checkUnit(start, { ...inH1, status: 'IN_USE' }),
  { ok: false, reason: 'Already in use.' },
  'already-in-use wins over the wrong-house message',
);
assert.deepEqual(checkUnit(finish, { ...inH2, status: 'IN_USE' }), { ok: true }, 'an opened unit can be finished');
{
  const tool = { ...inH2, purchase_item: { ...inH2.purchase_item!, item: { ...ITEM, category: 'EQUIPMENT' } } };
  assert.deepEqual(checkUnit(start, tool), { ok: true }, 'equipment can be started');
  assert.deepEqual(checkUnit(finish, tool), { ok: false, reason: "Equipment isn't used up — dispose it instead." });
}

// --- bind ---------------------------------------------------------------------
assert.deepEqual(checkUnit(bind, unit({ status: 'PRINTED', purchase_item: null })), { ok: true });
assert.deepEqual(checkUnit(bind, unit({ status: 'UNASSIGNED', purchase_item: null })), {
  ok: false,
  reason: 'Not printed yet — confirm its print on the dashboard first.',
});
assert.deepEqual(checkUnit(bind, unit()), { ok: false, reason: 'Already linked · bound' });
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

// --- use body ------------------------------------------------------------------
{
  const body = unitUseBody('finish', { houseId: 'h-2', batchId: 'b-1', now: new Date('2026-10-07T08:00:00.000Z'), key: 'k-1' });
  assert.deepEqual(body, {
    action: 'FINISH',
    house_id: 'h-2',
    date: '2026-10-07T08:00:00.000Z',
    batch_id: 'b-1',
    idempotency_key: 'k-1',
  });
  const noBatch = unitUseBody('start', { houseId: 'h-2', now: new Date(0), key: 'k' });
  assert.equal(noBatch.action, 'START');
  assert.equal('batch_id' in noBatch, false, 'batch_id is omitted when the house has no running batch');
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
