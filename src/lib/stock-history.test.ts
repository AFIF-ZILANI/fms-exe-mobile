/** Run: `bun src/lib/stock-history.test.ts`. */

import assert from 'node:assert/strict';

import { allocationRow, consumptionRow, rangeFrom, summaryWindows } from './stock-history';
import type { HouseAllocation, HouseConsumption, Item } from './types';

const now = new Date(2026, 9, 12, 15, 30); // 12 Oct 2026, 15:30 local
const local = (iso?: string) => (iso ? new Date(iso) : null);

// chips start at local midnight, not "24 hours ago"
assert.deepEqual(local(rangeFrom('today', now)), new Date(2026, 9, 12));
assert.deepEqual(local(rangeFrom('week', now)), new Date(2026, 9, 6)); // today + the six before
assert.deepEqual(local(rangeFrom('month', now)), new Date(2026, 8, 13));
assert.equal(rangeFrom('all', now), undefined);

// the summary windows agree with the chips
const w = summaryWindows(now);
assert.equal(w.today_from, rangeFrom('today', now));
assert.equal(w.week_from, rangeFrom('week', now));

// month boundaries roll back correctly
assert.deepEqual(local(rangeFrom('week', new Date(2026, 9, 3))), new Date(2026, 8, 27));

const item = { id: 'i1', name: 'Newcastle vaccine', category: 'VACCINE', unit: 'ML', is_unit_tracked: true, is_active: true } as Item;

const alloc = (type: HouseAllocation['type'], withItem = true): HouseAllocation => ({
  id: 'a1',
  type,
  occurred_at: '2026-10-12T08:00:00Z',
  stock_unit: { id: '11111111-2222-3333-4444-555555a3f9b7', purchase_item: withItem ? { item } : null },
});

assert.deepEqual(allocationRow(alloc('ALLOCATION')), {
  id: 'a1',
  title: 'Newcastle vaccine',
  subtitle: '…5a3f9b7 · Allocated',
  at: '2026-10-12T08:00:00Z',
});
assert.match(allocationRow(alloc('REALLOCATION')).subtitle, /Moved in$/);
assert.equal(allocationRow(alloc('ALLOCATION', false)).title, 'Unlinked unit');

const used = (name: string | null): HouseConsumption => ({
  id: 'c1',
  item,
  quantity: '2.5000',
  unit: 'KG',
  date: '2026-10-12T09:00:00Z',
  recorded_by: name ? { id: 'p', name } : null,
});
assert.equal(consumptionRow(used('Jihad')).subtitle, '2.5 kg · Jihad'); // trailing zeros trimmed
assert.equal(consumptionRow(used(null)).subtitle, '2.5 kg');

console.log('stock-history ok');
