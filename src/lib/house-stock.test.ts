/** Run: `bun src/lib/house-stock.test.ts`. */

import assert from 'node:assert/strict';

import { codeTail, houseBalance, houseSupplies, unitActions } from './house-stock';
import type { StockRow } from './stock-summary';
import type { Item, StockUnit } from './types';

const HOUSE = 'house-1';

const item = (over: Partial<Item> = {}) => ({ id: 'i1', name: 'Vitamin', category: 'MEDICINE', is_unit_tracked: true, is_active: true, unit: 'KG', ...over }) as Item;

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

const supply = (id: string, tracked = false, active = true) => item({ id, name: id, is_unit_tracked: tracked, is_active: active });
const row = (item_id: string, location_type: string, location_id: string, balance: string): StockRow => ({
  item_id,
  location_type,
  location_id,
  balance,
  location_name: location_id,
});
const items = [supply('Starter feed'), supply('Grower feed'), supply('Husk'), supply('Vitamin', true), supply('Old feed', false, false)];
const rows = [
  row('Starter feed', 'HOUSE', HOUSE, '40'),
  row('Starter feed', 'WAREHOUSE', 'w1', '4950'), // warehouse stock is not this house's
  row('Grower feed', 'HOUSE', HOUSE, '12.5'),
  row('Grower feed', 'HOUSE', 'house-2', '99'), // another house's
  row('Husk', 'HOUSE', HOUSE, '0'), // used up
  row('Vitamin', 'HOUSE', HOUSE, '3'), // coded: listed with the units instead
  row('Old feed', 'HOUSE', HOUSE, '5'), // inactive item
];

assert.deepEqual(
  houseSupplies(items, rows, HOUSE).map((s) => [s.item.name, s.balance]),
  [
    ['Grower feed', 12.5],
    ['Starter feed', 40],
  ],
);
assert.deepEqual(houseSupplies(items, rows, 'house-3'), []);
assert.equal(houseBalance(rows, HOUSE, 'Starter feed'), 40);
assert.equal(houseBalance(rows, 'house-2', 'Starter feed'), 0);

assert.equal(codeTail('0b9d8f2e-1a2b-4c3d-8e9f-a1b2c3d4e5f6'), '…3d4e5f6');
