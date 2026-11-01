/** Run: `bun src/lib/vaccine-schedule.test.ts`. */

import assert from 'node:assert/strict';

import type { StockUnit } from './types';
import { bottleProblem, canConfirm, dateOfDay, groupRows, nextVaccine, relativeDay, rowState, type VaccineScheduleRow } from './vaccine-schedule';

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

// dateOfDay / relativeDay
assert.equal(dateOfDay('2026-10-25T00:00:00.000Z', 1).getDate(), 25); // placement day is Day 1
assert.equal(dateOfDay('2026-10-25T00:00:00.000Z', 9).getDate(), 2); // Day 9 = 2 Nov
assert.equal(relativeDay(5, 5), 'today');
assert.equal(relativeDay(6, 5), 'tomorrow');
assert.equal(relativeDay(9, 5), 'in 4 days');
assert.equal(relativeDay(4, 5), '1 day late');
assert.equal(relativeDay(2, 5), '3 days late');

// groupRows / nextVaccine
const r = (id: string, day: number, status: VaccineScheduleRow['status'], xDone = false): VaccineScheduleRow => ({
  id,
  batch_id: 'b',
  purpose: 'P',
  purposeRef: { code: 'P', label: id },
  method: null,
  planned_day: day,
  day,
  status,
  reason: null,
  confirmed_by: null,
  confirmed_at: null,
  vaccinations: [],
  houses: [
    { id: 'x', name: 'X', confirm: xDone ? { confirmed_at: '2026-11-01T00:00:00Z', confirmed_by: { id: 'p', name: 'R' } } : null },
    { id: 'y', name: 'Y', confirm: null },
  ],
});
const rows = [r('late', 3, 'PENDING'), r('later', 12, 'PENDING'), r('today', 5, 'PENDING'), r('gone', 2, 'CANCELLED'), r('mine', 4, 'PENDING', true), r('next', 8, 'PENDING')];
const g = groupRows(rows, 5, 'x');
assert.deepEqual(g.due.map((x) => x.id), ['late', 'today']); // overdue first
assert.deepEqual(g.upcoming.map((x) => x.id), ['next', 'later']);
assert.deepEqual(g.done.map((x) => x.id), ['gone', 'mine']); // X already confirmed "mine"
assert.deepEqual(groupRows(rows, 5, 'y').due.map((x) => x.id), ['late', 'mine', 'today']); // Y still owes "mine"
assert.equal(nextVaccine(rows, 5, 'x')?.id, 'late');
assert.equal(nextVaccine([r('next', 8, 'PENDING')], 5, 'x')?.id, 'next');
assert.equal(nextVaccine([r('gone', 2, 'CANCELLED')], 5, 'x'), null);
