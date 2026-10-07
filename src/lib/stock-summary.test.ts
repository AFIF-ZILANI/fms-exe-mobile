/** Stock lines. Run: `bun src/lib/stock-summary.test.ts`. */

import assert from 'node:assert/strict';

import { formatBalance, summarizeStock, type StockRow } from './stock-summary';
import type { Item } from './types';

const item = (over: Partial<Item> & { id: string; name: string }): Item => ({
  category: 'FEED',
  unit: 'KG',
  is_unit_tracked: false,
  is_active: true,
  reorder_level: null,
  ...over,
});
const row = (item_id: string, balance: string, name = 'Warehouse A', type = 'WAREHOUSE'): StockRow => ({
  item_id,
  location_type: type,
  location_id: `${type}-${name}`,
  balance,
  location_name: name,
});

const feed = item({ id: 'feed', name: 'Starter feed', reorder_level: '100' });
const vaccine = item({ id: 'vac', name: 'Newcastle vaccine', category: 'VACCINE', unit: 'ML', reorder_level: '50' });
const husk = item({ id: 'husk', name: 'Rice husk' }); // no reorder level
const old = item({ id: 'old', name: 'Retired item', is_active: false });

// --- total across every location -----------------------------------------------------
{
  const lines = summarizeStock([feed], [row('feed', '60'), row('feed', '30.5', 'House 2', 'HOUSE')]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].balance, 90.5, 'warehouse + house balances add up');
  assert.equal(lines[0].locations.length, 2);
}

// --- Low only when a reorder level exists and the total is below it ---------------------
assert.equal(summarizeStock([feed], [row('feed', '99.999')])[0].isLow, true);
assert.equal(summarizeStock([feed], [row('feed', '100')])[0].isLow, false, 'exactly at the level is not low');
assert.equal(summarizeStock([feed], [])[0].isLow, true, 'no stock rows at all is zero, which is below 100');
assert.equal(summarizeStock([husk], [row('husk', '0')])[0].isLow, false, 'no reorder level => never low');
assert.equal(summarizeStock([item({ id: 'z', name: 'Z', reorder_level: 'abc' })], [row('z', '1')])[0].isLow, false, 'a junk reorder level never flags');

// --- junk balances are ignored, zero rows are not listed as locations ---------------------
{
  const [line] = summarizeStock([feed], [row('feed', 'oops'), row('feed', '10'), row('feed', '0', 'House 3', 'HOUSE')]);
  assert.equal(line.balance, 10);
  assert.deepEqual(line.locations.map((l) => l.name), ['Warehouse A']);
}

// --- inactive items are hidden ---------------------------------------------------------------
assert.deepEqual(summarizeStock([old, husk], []).map((l) => l.item.id), ['husk']);

// --- order: Low first, then by name -------------------------------------------------------------
{
  const lines = summarizeStock([husk, vaccine, feed], [row('husk', '5'), row('vac', '10'), row('feed', '500')]);
  assert.deepEqual(lines.map((l) => l.item.name), ['Newcastle vaccine', 'Rice husk', 'Starter feed']);
  assert.deepEqual(lines.map((l) => l.isLow), [true, false, false]);
}
{
  const lines = summarizeStock([feed, vaccine], [row('feed', '1'), row('vac', '1')]);
  assert.deepEqual(lines.map((l) => l.item.name), ['Newcastle vaccine', 'Starter feed'], 'both low: alphabetical');
}

// --- display ------------------------------------------------------------------------------------
assert.equal(formatBalance(90.5), '90.5');
assert.equal(formatBalance(1200), '1,200');
assert.equal(formatBalance(0), '0');
assert.equal(formatBalance(0.12345), '0.123');
assert.equal(formatBalance(2.0), '2');

console.log('stock-summary checks passed');
