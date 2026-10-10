/** Stock lines. Run: `bun src/lib/stock-summary.test.ts`. */

import assert from 'node:assert/strict';

import {
  attentionOrder,
  categoryCounts,
  filterStock,
  formatBalance,
  groupLocations,
  levelRatio,
  reorderGap,
  searchStock,
  statusCounts,
  stockState,
  summarizeStock,
  type StockRow,
} from './stock-summary';
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

// --- search: name or category, case-insensitive; blank keeps all -------------------------------------
{
  const lines = summarizeStock([feed, vaccine, husk], []);
  assert.deepEqual(searchStock(lines, 'NEWCASTLE').map((l) => l.item.id), ['vac']);
  assert.deepEqual(searchStock(lines, ' vacc ').map((l) => l.item.id), ['vac'], 'matches category, trims');
  assert.deepEqual(searchStock(lines, 'zzz'), []);
  assert.equal(searchStock(lines, '').length, 3);
  assert.equal(searchStock(lines, '   ').length, 3);
  const med = summarizeStock([item({ id: 'm', name: 'Tonic', category: 'FEED_ADDITIVE' })], []);
  assert.equal(searchStock(med, 'feed additive').length, 1, 'underscored categories match their spaced words');
}

// --- locations grouped: warehouses then houses, natural A-Z ------------------------------------------------
{
  const [line] = summarizeStock(
    [feed],
    [row('feed', '1', 'House 10', 'HOUSE'), row('feed', '2', 'House 2', 'HOUSE'), row('feed', '3', 'Warehouse B'), row('feed', '4', 'Warehouse A')],
  );
  const g = groupLocations(line);
  assert.deepEqual(g.warehouses.map((l) => l.name), ['Warehouse A', 'Warehouse B']);
  assert.deepEqual(g.houses.map((l) => l.name), ['House 2', 'House 10'], 'House 2 before House 10');
  assert.deepEqual(groupLocations(summarizeStock([feed], [])[0]), { warehouses: [], houses: [] });
}

// --- state, level bar, filters ---------------------------------------------------------------
{
  const lines = summarizeStock(
    [feed, vaccine, husk, item({ id: 'water', name: 'Water treatment', category: 'SUPPLEMENT', reorder_level: '10' })],
    [row('feed', '40'), row('vac', '500'), row('water', '0')],
  );
  const by = (id: string) => lines.find((l) => l.item.id === id)!;
  assert.equal(stockState(by('feed')), 'LOW', '40 of 100 is under the reorder level');
  assert.equal(stockState(by('vac')), 'OK');
  assert.equal(stockState(by('water')), 'OUT');
  assert.equal(stockState(by('husk')), 'OUT', 'no stock, no reorder level: still out');

  assert.equal(levelRatio(by('feed')), 0.2, '40 / (100 x 2)');
  assert.equal(levelRatio(by('vac')), 1, 'capped at full');
  assert.equal(levelRatio(by('husk')), null, 'nothing to measure against');
  assert.equal(levelRatio({ balance: 100, item: { reorder_level: '100' } }), 0.5, 'exactly at the reorder level is halfway');

  assert.deepEqual(reorderGap(by('feed')), { short: true, amount: 60 }, '60 short of the reorder level');
  assert.deepEqual(reorderGap(by('vac')), { short: false, amount: 450 });
  assert.equal(reorderGap(by('husk')), null);

  assert.deepEqual(statusCounts(lines), { ALL: 4, LOW: 1, OUT: 2 });
  const ids = (f: Parameters<typeof filterStock>[1]) => filterStock(lines, f).map((l) => l.item.id).sort();
  assert.deepEqual(ids({ status: 'LOW', category: null }), ['feed']);
  assert.deepEqual(ids({ status: 'OUT', category: null }), ['husk', 'water']);
  assert.deepEqual(ids({ status: 'ALL', category: 'VACCINE' }), ['vac']);
  assert.deepEqual(ids({ status: 'OUT', category: 'FEED' }), ['husk'], 'status and category both apply');

  assert.deepEqual(categoryCounts(lines), [
    { category: 'FEED', count: 2 },
    { category: 'SUPPLEMENT', count: 1 },
    { category: 'VACCINE', count: 1 },
  ]);
  assert.deepEqual(attentionOrder(lines).map((l) => l.item.id), ['feed', 'vac', 'husk', 'water'], 'low, then in stock, then empty (each A-Z)');
}

console.log('stock-summary checks passed');
