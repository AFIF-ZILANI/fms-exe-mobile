/** Whether logging out is allowed. Run: `bun src/lib/logout-decision.test.ts`. */

import assert from 'node:assert/strict';

import { logoutDecision } from './logout-decision';

// Nothing queued: straight through.
assert.equal(logoutDecision(0, 0), 'go');

// Records still waiting to send block, because they would upload under whoever signs in next.
assert.equal(logoutDecision(3, 0), 'blocked');
assert.equal(logoutDecision(1, 0), 'blocked');

// Only failed records: ask, and the answer may be to discard them.
assert.equal(logoutDecision(0, 2), 'confirm-discard');

// A pending record blocks even when failed ones exist.
assert.equal(logoutDecision(1, 5), 'blocked');

// Junk counts never open the door by accident.
assert.equal(logoutDecision(0, -1), 'go');
assert.equal(logoutDecision(Number.NaN, 0), 'go');

console.log('logout-decision checks passed');
