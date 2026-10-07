/** The Houses tab's numbers and ordering. Run: `bun src/lib/houses-summary.test.ts`. */

import assert from 'node:assert/strict';

import { buildHouseLines, cycleProgress, filterHouses, summarizeHouses } from './houses-summary';
import type { BatchHouseBalance, House } from './types';

const house = (over: Partial<House> & { id: string; name: string }): House => ({
  type: 'BROODER',
  number: 1,
  capacity: null,
  is_active: true,
  ...over,
});
const balance = (house_id: string, quantity: number): BatchHouseBalance => ({
  id: `b-${house_id}-${quantity}`,
  batch_id: 'batch-1',
  house_id,
  quantity,
  updated_at: '2026-10-01T00:00:00.000Z',
});

const h1 = house({ id: 'h1', name: 'Alpha', number: 1 });
const h2 = house({ id: 'h2', name: 'Bravo', number: 2 });
const h2b = house({ id: 'h2b', name: 'Another two', number: 2 }); // same number as h2
const h3 = house({ id: 'h3', name: 'Charlie', number: 3 });
const hNone = house({ id: 'hn', name: 'No number', number: undefined as unknown as number });

// --- order: by house number (the farm's spatial order), then name, no number last -----------------
{
  const lines = buildHouseLines([h3, hNone, h2, h1, h2b], []);
  assert.deepEqual(
    lines.map((l) => l.house.id),
    ['h1', 'h2b', 'h2', 'h3', 'hn'],
    'duplicate numbers fall back to name; a missing number goes last',
  );
}

// --- running means a positive balance; zero or no balance is empty --------------------------------
{
  const lines = buildHouseLines([h1, h2, h3], [balance('h1', 7900), balance('h2', 0)]);
  const byId = Object.fromEntries(lines.map((l) => [l.house.id, l]));
  assert.equal(byId.h1.running, true);
  assert.equal(byId.h1.balance?.quantity, 7900);
  assert.equal(byId.h2.running, false, 'a zero balance is an empty house');
  assert.equal(byId.h2.balance, null);
  assert.equal(byId.h3.running, false);
}

// --- a house with two positive balances uses the first (as the old screen did) ---------------------
{
  const [line] = buildHouseLines([h1], [balance('h1', 100), balance('h1', 200)]);
  assert.equal(line.balance?.quantity, 100);
}

// --- summary: birds only from running houses -------------------------------------------------------
{
  const lines = buildHouseLines([h1, h2, h3], [balance('h1', 7900), balance('h3', 100), balance('h2', 0)]);
  assert.deepEqual(summarizeHouses(lines), { birds: 8000, running: 2, empty: 1, total: 3 });
  assert.deepEqual(summarizeHouses([]), { birds: 0, running: 0, empty: 0, total: 0 });
}

// --- filter ----------------------------------------------------------------------------------------
{
  const lines = buildHouseLines([h1, h2, h3], [balance('h1', 5)]);
  assert.equal(filterHouses(lines, 'ALL').length, 3);
  assert.deepEqual(filterHouses(lines, 'RUNNING').map((l) => l.house.id), ['h1']);
  assert.deepEqual(filterHouses(lines, 'EMPTY').map((l) => l.house.id), ['h2', 'h3']);
}

// --- cycle progress ---------------------------------------------------------------------------------
assert.deepEqual(cycleProgress(17, 60), { ratio: 17 / 60, label: 'Day 17 of ~60', over: false });
assert.deepEqual(cycleProgress(0, 35), { ratio: 0, label: 'Day 0 of ~35', over: false });
assert.deepEqual(cycleProgress(35, 35), { ratio: 1, label: 'Day 35 of ~35', over: false });
// Past the expected end the bar is full, the words say so, and `over` lets the UI warn.
assert.deepEqual(cycleProgress(40, 35), { ratio: 1, label: 'Day 40 of ~35', over: true });
// Unusable inputs never produce NaN or a negative bar.
assert.equal(cycleProgress(5, 0).ratio, 0);
assert.equal(cycleProgress(-3, 35).ratio, 0);
assert.equal(cycleProgress(-3, 35).label, 'Day 0 of ~35');
assert.equal(Number.isNaN(cycleProgress(Number.NaN, 35).ratio), false);

console.log('houses-summary checks passed');
