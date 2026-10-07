/**
 * The scan session's decision logic — the part of the QR feature that can be
 * verified without a camera. Run: `bun src/lib/scan.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  COOLDOWN_MS,
  bindErrorMessage,
  classifyScan,
  isRetryable,
  isStockCode,
  markSent,
  newScanState,
  releaseScan,
  scanErrorMessage,
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

// --- a code held in frame is silent, but a deliberate rescan reports --------
// The distinction the whole screen rests on: 'cooldown' fires many times a
// second and must stay silent; 'duplicate' is the operator presenting the same
// label again on purpose, and gets a warning.
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);

  // Ten frames while the label sits in view — every one suppressed.
  for (let t = 1010; t < 1000 + COOLDOWN_MS; t += 100) {
    assert.equal(classifyScan(s, A, t).kind, 'cooldown');
  }
  // Taken away and shown again.
  assert.equal(classifyScan(s, A, 1000 + COOLDOWN_MS + 1).kind, 'duplicate');
}

// --- retryability decides whether a label can be rescanned -----------------
assert.equal(isRetryable(0), true, 'lost connection is worth another try');
assert.equal(isRetryable(500), true);
assert.equal(isRetryable(503), true);
assert.equal(isRetryable(409), false, 'already bound is settled — never retry');
assert.equal(isRetryable(404), false, 'unknown code stays unknown');
assert.equal(isRetryable(400), false, 'wrong item for this lot is settled');

// A settled rejection must stay marked, so a label left in frame does not
// re-POST and re-buzz on every cooldown.
{
  const s = newScanState();
  classifyScan(s, A, 1000);
  markSent(s, A);
  // 409 -> not retryable -> not released.
  assert.equal(classifyScan(s, A, 1000 + COOLDOWN_MS + 1).kind, 'duplicate');
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

// --- scanErrorMessage: wording for any scan action ----------------------------
assert.equal(scanErrorMessage(403, 'forbidden'), "You don't have permission to do this.");
assert.equal(scanErrorMessage(404, 'not found'), 'Unknown code — not a ZeroD stock unit.');
assert.equal(scanErrorMessage(0, undefined), "Couldn't reach the server.");
assert.equal(
  scanErrorMessage(409, 'Unit is already at that house'),
  'Unit is already at that house',
  "the server's own plain wording is kept",
);
assert.equal(
  scanErrorMessage(
    400,
    '"BOTTLE" is not a valid unit for using this item -- add or update the conversion via POST /item-units first',
  ),
  "This item can't be used by the bottle yet. Ask a manager to set it up.",
  'server jargon about item-units becomes plain words',
);
assert.equal(scanErrorMessage(500, undefined), 'Failed with 500.');

console.log('scan.ts checks passed');
