/**
 * The scan session's decision logic — the part of the QR feature that can be
 * verified without a camera. Run: `bun src/lib/scan.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  COOLDOWN_MS,
  bindErrorMessage,
  classifyScan,
  isStockCode,
  markSent,
  newScanState,
  releaseScan,
} from './scan';

const A = '4f8e11ef-1234-4abc-8def-0123456789ab';
const B = 'aabbccdd-1111-4222-8333-444455556666';

// --- payload validation -----------------------------------------------------
assert.equal(isStockCode(A), true);
assert.equal(isStockCode(A.toUpperCase()), true);
assert.equal(isStockCode('  ' + A + '  '), true, 'surrounding whitespace is trimmed');
assert.equal(isStockCode('https://example.com/' + A), false, 'a URL is not a bare id');
assert.equal(isStockCode('not-a-uuid'), false);
assert.equal(isStockCode(''), false);

// --- first scan is accepted -------------------------------------------------
{
  const s = newScanState();
  assert.deepEqual(classifyScan(s, A, 1000), { kind: 'accept', id: A });
}

// --- a code held in frame does not fire twice -------------------------------
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);
  assert.equal(classifyScan(s, A, 1100).kind, 'cooldown', 'still inside the cooldown window');
}

// --- past the cooldown, an already-sent code reads as a duplicate, not new ---
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);
  assert.equal(classifyScan(s, A, 1000 + COOLDOWN_MS + 1).kind, 'duplicate');
}

// --- a failed send releases the code so it can be retried at once -----------
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);
  releaseScan(s, A);
  assert.deepEqual(
    classifyScan(s, A, 1001),
    { kind: 'accept', id: A },
    'a rescan after failure must not be suppressed by the cooldown',
  );
}

// --- different codes do not block each other --------------------------------
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);
  assert.equal(classifyScan(s, B, 1010).kind, 'accept');
}

// --- case is normalised, so one label can't be linked twice -----------------
{
  const s = newScanState();
  classifyScan(s, A.toUpperCase(), 1000);
  markSent(s, A);
  assert.equal(classifyScan(s, A, 1000 + COOLDOWN_MS + 1).kind, 'duplicate');
}

// --- junk payloads never reach the network ----------------------------------
{
  const s = newScanState();
  assert.deepEqual(classifyScan(s, 'hello', 1000), { kind: 'invalid', payload: 'hello' });
  assert.equal(s.seen.size, 0);
}

// --- error copy -------------------------------------------------------------
assert.equal(bindErrorMessage(404, 'StockUnit not found'), 'Unknown code — not a ZeroD stock unit.');
assert.equal(bindErrorMessage(409, 'StockUnit is already in_stock'), 'Already linked · in stock');
assert.equal(bindErrorMessage(409, undefined), 'Already linked.');
assert.equal(bindErrorMessage(0, undefined), "Couldn't reach the server.");
assert.equal(
  bindErrorMessage(400, '"Feed" isn\'t tracked by QR code -- use Move Stock instead'),
  '"Feed" isn\'t tracked by QR code -- use Move Stock instead',
  'a clear server message is passed through unchanged',
);

console.log('scan.ts checks passed');
