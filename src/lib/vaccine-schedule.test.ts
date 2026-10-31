/** Run: `bun src/lib/vaccine-schedule.test.ts`. */

import assert from 'node:assert/strict';

import { amountUnits, canConfirm, rowState } from './vaccine-schedule';

assert.equal(rowState({ status: 'PENDING', day: 7 }, 5), 'UPCOMING');
assert.equal(rowState({ status: 'PENDING', day: 5 }, 5), 'DUE_TODAY');
assert.equal(rowState({ status: 'PENDING', day: 3 }, 5), 'OVERDUE');
assert.equal(rowState({ status: 'DONE', day: 3 }, 5), 'DONE');
assert.equal(rowState({ status: 'CANCELLED', day: 9 }, 5), 'CANCELLED');

const split = {
  houses: [
    { id: 'x', name: 'X', confirm: { confirmed_at: '2026-11-01T00:00:00Z', confirmed_by: { id: 'p', name: 'Rahim' } } },
    { id: 'y', name: 'Y', confirm: null },
  ],
};
assert.equal(canConfirm('UPCOMING', split, 'y'), false); // never before its day
assert.equal(canConfirm('DUE_TODAY', split, 'y'), true);
assert.equal(canConfirm('OVERDUE', split, 'y'), true); // late is fine
assert.equal(canConfirm('DUE_TODAY', split, 'x'), false); // X already confirmed its share
assert.equal(canConfirm('DUE_TODAY', split, 'z'), false); // the batch isn't in this house
assert.equal(canConfirm('DUE_TODAY', split, undefined), false);
assert.equal(canConfirm('DONE', split, 'y'), false);

assert.deepEqual(
  amountUnits({
    unit: 'DOSE',
    itemUnits: [
      { unit: 'LITRE', is_usable: true },
      { unit: 'DOSE', is_usable: true },
      { unit: 'BOX', is_usable: false }, // purchase-only units aren't offered
    ],
  }),
  ['DOSE', 'LITRE'],
);
assert.deepEqual(amountUnits({ unit: 'BOTTLE' }), ['BOTTLE']);
