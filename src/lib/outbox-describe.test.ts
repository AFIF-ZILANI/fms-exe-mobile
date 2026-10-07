/** Queued-record wording. Run: `bun src/lib/outbox-describe.test.ts`. */

import assert from 'node:assert/strict';

import { describeOutboxRow, plainReason } from './outbox-describe';

const d = (endpoint: string, body: unknown) =>
  describeOutboxRow({ endpoint, body: typeof body === 'string' ? body : JSON.stringify(body) });

// --- known endpoints get a plain title (and a detail where the body has one) ----------------
assert.deepEqual(d('/mortality-logs', { count_died: 12 }), { title: 'Mortality', detail: '12 died' });
assert.deepEqual(d('/mortality-logs', { count_died: 1 }), { title: 'Mortality', detail: '1 died' });
assert.deepEqual(d('/consumptions', { quantity: 2.5, unit: 'KG' }), { title: 'Feed or item use', detail: '2.5 kg' });
assert.deepEqual(d('/consumptions', { quantity: 1, unit: 'BOTTLE', stock_unit_id: 'u' }), {
  title: 'Feed or item use',
  detail: '1 bottle',
});
assert.deepEqual(d('/medications', { medicine_name: 'Amoxy' }), { title: 'Medication', detail: 'Amoxy' });
assert.deepEqual(d('/vaccinations', { vaccine_name: 'Newcastle' }), { title: 'Vaccination', detail: 'Newcastle' });
assert.deepEqual(d('/batch-house-allocations', { quantity: 500 }), { title: 'Birds moved', detail: '500 birds' });
assert.equal(d('/weight-records', {}).title, 'Weight sample');
assert.equal(d('/environment-records', {}).title, 'Environment readings');
assert.equal(d('/task-assignments/abc-123/complete', {}).title, 'Task marked done');
assert.equal(d('/task-assignments/abc-123/cancel', {}).title, 'Task cancelled');
assert.equal(d('/task-assignments', { title: 'Check water' }).title, 'Task assigned');
assert.equal(d('/task-assignments', { title: 'Check water' }).detail, 'Check water');
assert.equal(d('/performance-score-entries', {}).title, 'Points given');
assert.equal(d('/inventory-adjustments', {}).title, 'Stock discrepancy');
assert.equal(d('/alerts', {}).title, 'Low-stock flag');
assert.equal(d('/batch-feeding-programs', {}).title, 'Feeding plan phase');
assert.equal(d('/stock-units/9f1c/bind', {}).title, 'Item linked');

// --- no detail when the body lacks the field, or it is the wrong type ------------------------------
assert.equal(d('/mortality-logs', {}).detail, null);
assert.equal(d('/mortality-logs', { count_died: 'many' }).detail, null);
assert.equal(d('/consumptions', { quantity: 'x' }).detail, null);
assert.equal(d('/medications', { medicine_name: '   ' }).detail, null);

// --- never crashes: unknown endpoint, malformed or non-object body ------------------------------------
assert.deepEqual(d('/something-new', {}), { title: 'A record', detail: null });
assert.deepEqual(d('/mortality-logs', 'not json {'), { title: 'Mortality', detail: null });
assert.deepEqual(d('/mortality-logs', 'null'), { title: 'Mortality', detail: null });
assert.deepEqual(d('/mortality-logs', '[1,2]'), { title: 'Mortality', detail: null });
assert.deepEqual(d('', '{}'), { title: 'A record', detail: null });

// --- no raw endpoint or id ever leaks into the words ---------------------------------------------------
for (const [endpoint, body] of [
  ['/task-assignments/abc-123/complete', {}],
  ['/stock-units/9f1c/bind', {}],
  ['/mortality-logs', { count_died: 3 }],
] as const) {
  const { title, detail } = d(endpoint, body);
  assert.ok(!title.includes('/') && !title.includes('abc-123') && !title.includes('9f1c'), title);
  assert.ok(!(detail ?? '').includes('/'));
}

// --- plain reasons ---------------------------------------------------------------------------------------
assert.equal(plainReason(null), 'The server refused this record.');
assert.equal(plainReason(undefined), 'The server refused this record.');
assert.equal(plainReason('   '), 'The server refused this record.');
assert.equal(
  plainReason('"BOTTLE" is not a valid unit for using this item -- add or update the conversion via POST /item-units first'),
  "This item can't be used by that unit yet. Ask a manager to set it up.",
);
assert.equal(plainReason('Only 4 of this item is on hand at this house'), 'Only 4 of this item is on hand at this house');
assert.equal(plainReason('Error: Count must be positive'), 'Count must be positive');
assert.equal(plainReason('idempotency_key already in use'), 'Already recorded.');
{
  const long = 'x'.repeat(400);
  const out = plainReason(long);
  assert.equal(out.length, 160);
  assert.ok(out.endsWith('…'));
}

console.log('outbox-describe checks passed');
