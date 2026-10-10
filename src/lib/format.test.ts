/**
 * Runnable check for the formatting logic that has branches worth breaking.
 * No framework — `npx tsx src/lib/format.test.ts`, or `node --experimental-strip-types`.
 */

import assert from 'node:assert/strict';

import { formatBatchCode, formatSignedPercent, formatSignedPoints, latestTimestamp, parseMoney } from './format';

// The bug this function exists for: a uuid pasted into the batch code field,
// which v1 rendered in full as a house label on the dashboard.
assert.equal(formatBatchCode('ANALYTICS-ec18144e-7a83-40b5-82c6-86d32189f492'), 'ANALYTICS');
assert.equal(formatBatchCode('B-24'), 'B-24');
assert.equal(formatBatchCode('  B-24  '), 'B-24');
assert.equal(formatBatchCode('A-very-long-batch-code-here'), 'A-very-long-b…');

// A bare uuid leaves nothing human behind, so the raw value is kept rather
// than returning an empty label.
assert.equal(formatBatchCode('ec18144e-7a83-40b5-82c6-86d32189f492').length, 14);

// Missing code falls back to an id fragment, never to blank.
assert.equal(formatBatchCode(undefined, 'abcd1234ef56'), '…ef56');
assert.equal(formatBatchCode(null, null), '—');
assert.equal(formatBatchCode(''), '—');

assert.equal(formatSignedPoints(7), '+7');
assert.equal(formatSignedPoints(0), '0');
assert.equal(formatSignedPoints(-2), '-2');

assert.equal(formatSignedPercent(7), '+7.0%');
assert.equal(formatSignedPercent(0), '0.0%');
assert.equal(formatSignedPercent(-2.5), '-2.5%');

// Money arrives as a Prisma Decimal serialised to a string.
assert.equal(parseMoney('15750.00'), 15750);
assert.equal(parseMoney('not money'), 0);

// The newest timestamp, ignoring zeros and junk.
assert.equal(latestTimestamp([0, 1_700_000_000_000, 1_600_000_000_000]), 1_700_000_000_000);
assert.equal(latestTimestamp([0, NaN]), null);
assert.equal(latestTimestamp([]), null);

console.log('format.ts checks passed');
