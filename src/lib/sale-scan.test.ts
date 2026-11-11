/** Run: `bun src/lib/sale-scan.test.ts`. */

import assert from 'node:assert/strict';

import { saleProgress, waitingCount } from './sale-scan';
import type { ScanSale } from './types';

const sale = (lines: [number, number][]): ScanSale => ({
  id: crypto.randomUUID(),
  sale_date: '2026-11-11T00:00:00.000Z',
  customer_name: null,
  lines: lines.map(([scanned, quantity], i) => ({ id: `l${i}`, item_name: `Item ${i}`, scanned, quantity })),
});

assert.deepEqual(saleProgress(sale([[2, 3], [1, 1]])), { scanned: 3, needed: 4, done: false });
assert.deepEqual(saleProgress(sale([[3, 3], [1, 1]])), { scanned: 4, needed: 4, done: true });
assert.equal(waitingCount([sale([[0, 2]]), sale([[1, 1]]), sale([[1, 2]])]), 2);
assert.equal(waitingCount([]), 0);

console.log('sale-scan: ok');
