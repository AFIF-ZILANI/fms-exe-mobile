/** Run: `bun src/lib/unit-profile.test.ts`. */

import assert from 'node:assert/strict';

import { expiryState, lotCodesSummary, movementTitle, unitLeft, unitStatus, usageTitle, type UnitProfile } from './unit-profile';

assert.equal(unitStatus('BOUND', 'VACCINE').label, 'Sealed');
assert.equal(unitStatus('IN_USE', 'MEDICINE').label, 'Opened');
assert.equal(unitStatus('BOUND', 'EQUIPMENT').label, 'Not in use');
assert.equal(unitStatus('IN_USE', 'EQUIPMENT').label, 'In use');
assert.equal(unitStatus('PRINTED', null).label, 'Not linked yet');
assert.equal(unitStatus('SOLD', 'VACCINE').label, 'Sold');

const now = new Date(2026, 10, 2, 10);
assert.deepEqual(expiryState('2026-10-30T00:00:00.000Z', now), { label: 'Expired 3 days ago', tone: 'critical' });
assert.deepEqual(expiryState('2026-11-02T00:00:00.000Z', now), { label: 'Expires today', tone: 'critical' });
assert.deepEqual(expiryState('2026-11-12T00:00:00.000Z', now), { label: 'Expires in 10 days', tone: 'warning' });
assert.equal(expiryState('2027-01-31T00:00:00.000Z', now), null);
assert.equal(expiryState(null, now), null);

assert.equal(movementTitle({ id: 'm', type: 'ALLOCATION', house: 'House 2', at: '', by: null }), 'Moved to House 2');
assert.equal(movementTitle({ id: 'm', type: 'RETURN', house: null, at: '', by: null }), 'Back to the warehouse');
assert.equal(
  usageTitle({ id: 'u', at: '', house: 'House 2', quantity: '2.500', unit: 'ML', batch_code: null, by: 'R', note: null, treatment: null }),
  'Used 2.5 ml in House 2',
);

const profile = (over: Partial<UnitProfile> = {}): UnitProfile => ({
  id: 'u1',
  status: 'IN_USE',
  bound_at: null,
  bound_by: null,
  asset: null,
  item: { id: 'i1', name: 'ND vaccine', category: 'VACCINE', unit: 'ML' },
  location: null,
  remaining: { unit: '7.5', lot: '47.5' },
  lot: {
    id: 'l1',
    quantity: '5',
    unit: 'BOTTLE',
    base_quantity: '50',
    unit_count: 5,
    unit_price: '200',
    total_price: '1000',
    cost_per_unit: '200',
    mfg_date: null,
    expiration_date: null,
    codes: {},
  },
  purchase: null,
  movements: [],
  uses: [],
  ...over,
});
assert.deepEqual(unitLeft(profile()), { text: '7.5 of 10 ml', share: 0.75 });
assert.equal(unitLeft(profile({ status: 'CONSUMED' })), null);
assert.equal(unitLeft(profile({ item: { id: 'i', name: 'Heater', category: 'EQUIPMENT', unit: 'UNIT' } })), null);
assert.equal(unitLeft(profile({ remaining: { unit: null, lot: '3' } })), null);

assert.equal(lotCodesSummary({ BOUND: 3, IN_USE: 1, CONSUMED: 2, DISPOSED: 0 }, 'VACCINE'), '3 sealed · 2 used up · 1 opened');

console.log('unit-profile ok');
