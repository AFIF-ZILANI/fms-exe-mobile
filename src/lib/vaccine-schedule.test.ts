/** Run: `bun src/lib/vaccine-schedule.test.ts`. */

import assert from 'node:assert/strict';

import type { StockUnit } from './types';
import { bottleProblem, canConfirm, rowState } from './vaccine-schedule';

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

const unit = (over: { status?: StockUnit['status']; category?: string; houseId?: string | null }): StockUnit => ({
  id: 'u',
  purchase_item_id: 'l',
  status: over.status ?? 'BOUND',
  bound_at: null,
  bound_by_id: null,
  purchase_item: {
    id: 'l',
    item_id: 'i',
    unit: 'DOSE',
    item: { id: 'i', name: 'Ma5+Clone30', category: over.category ?? 'VACCINE', unit: 'DOSE', is_unit_tracked: true, is_active: true },
  },
  houseAllocations:
    over.houseId === null ? [] : [{ house_id: over.houseId ?? 'x', house: { id: over.houseId ?? 'x', name: 'House X' } }],
});

assert.equal(bottleProblem(unit({}), 'x', 'House X'), null);
assert.equal(bottleProblem(unit({ status: 'CONSUMED' }), 'x', 'House X'), 'Already used up.');
assert.equal(bottleProblem(unit({ category: 'MEDICINE' }), 'x', 'House X'), "Ma5+Clone30 isn't a vaccine.");
assert.equal(bottleProblem(unit({ houseId: null }), 'x', 'House X'), 'In the warehouse — move it to House X first.');
assert.equal(bottleProblem(unit({ houseId: 'y' }), 'x', 'House X'), 'In House X — move it to House X first.');
