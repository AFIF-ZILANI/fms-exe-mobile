/** Run: `bun src/lib/vaccine-schedule.test.ts`. */

import assert from 'node:assert/strict';

import { amountUnits, canConfirm, rowState } from './vaccine-schedule';

assert.equal(rowState({ status: 'PENDING', day: 7 }, 5), 'UPCOMING');
assert.equal(rowState({ status: 'PENDING', day: 5 }, 5), 'DUE_TODAY');
assert.equal(rowState({ status: 'PENDING', day: 3 }, 5), 'OVERDUE');
assert.equal(rowState({ status: 'DONE', day: 3 }, 5), 'DONE');
assert.equal(rowState({ status: 'CANCELLED', day: 9 }, 5), 'CANCELLED');

assert.equal(canConfirm('UPCOMING'), false); // never before its day
assert.equal(canConfirm('DUE_TODAY'), true);
assert.equal(canConfirm('OVERDUE'), true); // late is fine
assert.equal(canConfirm('DONE'), false);

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
