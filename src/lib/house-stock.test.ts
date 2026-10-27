/** Run: `bun src/lib/house-stock.test.ts`. */

import assert from 'node:assert/strict';

import { bulkLines, codeTail, unitActions } from './house-stock';
import type { StockLine } from './stock-summary';
import type { Item, StockUnit } from './types';

const HOUSE = 'house-1';

const item = (over: Partial<Item> = {}) => ({ id: 'i1', name: 'Vitamin', category: 'MEDICINE', is_unit_tracked: true, ...over }) as Item;

const unit = (status: StockUnit['status'], over: Partial<Item> = {}, houseId: string | null = HOUSE): StockUnit => ({
  id: '0b9d8f2e-1a2b-4c3d-8e9f-a1b2c3d4e5f6',
  purchase_item_id: 'p1',
  status,
  bound_at: null,
  bound_by_id: null,
  purchase_item: { id: 'p1', item_id: 'i1', unit: 'BOTTLE', item: item(over) },
  houseAllocations: [{ house_id: houseId, house: houseId ? { id: houseId, name: 'House 1' } : null }],
});

assert.deepEqual(unitActions(unit('BOUND'), HOUSE), { start: true, finish: true }); // sealed: both
assert.deepEqual(unitActions(unit('IN_USE'), HOUSE), { start: false, finish: true }); // opened: finish only
assert.deepEqual(unitActions(unit('BOUND', { category: 'EQUIPMENT' }), HOUSE), { start: true, finish: false }); // never used up
assert.deepEqual(unitActions(unit('IN_USE', { category: 'EQUIPMENT' }), HOUSE), { start: false, finish: false });
assert.deepEqual(unitActions(unit('CONSUMED'), HOUSE), { start: false, finish: false });
assert.deepEqual(unitActions(unit('BOUND', {}, 'house-2'), HOUSE), { start: false, finish: false }); // moved elsewhere

const line = (name: string, tracked: boolean, balance: number): StockLine => ({
  item: item({ id: name, name, is_unit_tracked: tracked }),
  balance,
  isLow: false,
  locations: [],
});

assert.deepEqual(
  bulkLines([line('Starter feed', false, 40), line('Vitamin', true, 3), line('Husk', false, 0), line('Grower feed', false, 12)]).map(
    (l) => l.item.name,
  ),
  ['Grower feed', 'Starter feed'], // coded and empty items left out, A-Z
);

assert.equal(codeTail('0b9d8f2e-1a2b-4c3d-8e9f-a1b2c3d4e5f6'), '…3d4e5f6');
