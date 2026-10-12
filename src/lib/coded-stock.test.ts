/** Run: `bun src/lib/coded-stock.test.ts`. */

import assert from 'node:assert/strict';

import { stockLabel, unitsAvailable } from './coded-stock';
import type { HouseCodedStock } from './types';

const line = (over: Partial<HouseCodedStock> = {}): HouseCodedStock => ({
  item_id: 'a',
  item_name: 'Tox Safe Plus Pro',
  unit: 'LITER',
  pack_unit: 'BOTTLE',
  units: 3,
  quantity: 3,
  ...over,
});

assert.equal(stockLabel(line()), '3 bottles · 3 liter');
assert.equal(stockLabel(line({ units: 1, quantity: 0.5 })), '1 bottle · 0.5 liter');
assert.equal(stockLabel(line({ quantity: 2.3333333 })), '3 bottles · 2.33 liter'); // no float noise
assert.equal(stockLabel(line({ quantity: null })), '3 bottles'); // size unknown: say the count, never guess a volume
assert.equal(stockLabel(line({ pack_unit: null, quantity: null })), '3 units'); // mixed pack types
assert.equal(stockLabel(line({ pack_unit: 'BOX', units: 2, quantity: null })), '2 boxes');
assert.equal(stockLabel(line({ pack_unit: 'LITER', units: 3, quantity: 2 })), '3 units · 2 liter'); // bought by volume: no container name

const lines = [line(), line({ item_id: 'b', units: 4 })];
assert.equal(unitsAvailable(lines), 7);
assert.equal(unitsAvailable(lines, 'b'), 4);
assert.equal(unitsAvailable(lines, 'nope'), 0);
assert.equal(unitsAvailable([]), 0);

console.log('coded-stock ok');
