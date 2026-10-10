/** Which ratings the phone can send. Run: `bun src/lib/criteria.test.ts`. */
import assert from 'node:assert/strict';

import { NEGATIVE_CRITERIA, POSITIVE_CRITERIA, needsAdminPaperwork } from './criteria';

// Every positive rating can be sent from the phone.
for (const c of POSITIVE_CRITERIA) assert.equal(needsAdminPaperwork(c.value, c.points), false, c.value);

// -4 and -5 need written notice first; -3 and above do not.
const blocked = NEGATIVE_CRITERIA.filter((c) => needsAdminPaperwork(c.value, c.points)).map((c) => c.value);
assert.deepEqual(blocked, ['FALSIFIED_RECORD', 'NEGLIGENT_LOSS', 'BIOSECURITY_VIOLATION', 'CONCEALED_PROBLEM']);
assert.equal(needsAdminPaperwork('MISSED_CRITICAL_TASK', -3), false);

// OTHER always needs an admin's approval.
assert.equal(needsAdminPaperwork('OTHER', 2), true);

console.log('criteria checks passed');
