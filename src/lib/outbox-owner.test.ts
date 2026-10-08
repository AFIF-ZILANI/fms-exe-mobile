/** Queue ownership. Run: `bun src/lib/outbox-owner.test.ts`. */

import assert from 'node:assert/strict';

import { isVisibleTo } from './outbox-owner';

assert.equal(isVisibleTo('a', 'a'), true, 'my own row');
assert.equal(isVisibleTo('a', 'b'), false, "someone else's row is hidden");
assert.equal(isVisibleTo(null, 'b'), true, 'a row from before owners existed stays visible');
assert.equal(isVisibleTo(undefined, 'b'), true);
assert.equal(isVisibleTo('', 'b'), true);
assert.equal(isVisibleTo('a', null), false, 'nobody signed in: nothing is shown or sent');
assert.equal(isVisibleTo(null, null), false);

console.log('outbox-owner checks passed');
