/** Run: `bun src/lib/lot-split.test.ts`. */

import assert from 'node:assert/strict';

import { codesNeeded, isLotComplete } from './lot-split';

assert.equal(codesNeeded(10, 1), 10);
assert.equal(codesNeeded(10, 0.5), 20);
assert.equal(codesNeeded(10, 2.5), 4);
assert.equal(codesNeeded(0.3, 0.1), 3); // float noise must not reject a clean split
assert.equal(codesNeeded(10, 3), null); // doesn't divide evenly
assert.equal(codesNeeded(10, 20), null); // bottle bigger than the lot
assert.equal(codesNeeded(10, 0), null);
assert.equal(codesNeeded(10, NaN), null);

assert.equal(isLotComplete(10, 10), true);
assert.equal(isLotComplete(10, 15), true); // over-linked before the cap existed
assert.equal(isLotComplete(10, 9), false);
assert.equal(isLotComplete(null, 20), false); // never split: nothing to be complete against

console.log('lot-split ok');
