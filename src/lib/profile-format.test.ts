/**
 * Profile formatting — verifiable without a device. Run: `bun src/lib/profile-format.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  ageFromDob,
  displayValue,
  educationLabel,
  formatDate,
  formatExperience,
  formatTenure,
  formatTenureShort,
  hasEmergencyContact,
  maritalLabel,
  maskNid,
  roleLabel,
  statusLabel,
} from './profile-format';

// --- dates: the stored UTC calendar date, never shifted by the phone's timezone ---
assert.equal(formatDate('2025-03-12T00:00:00.000Z'), '12 Mar 2025');
assert.equal(formatDate('2025-12-01T23:59:59.000Z'), '1 Dec 2025');
assert.equal(formatDate('not a date'), '—');

// --- tenure ---------------------------------------------------------------------
const now = new Date('2026-10-07T09:00:00.000Z');
assert.equal(formatTenure('2025-03-07T00:00:00.000Z', now), '1 yr 7 mo');
assert.equal(formatTenure('2026-03-07T00:00:00.000Z', now), '7 mo');
assert.equal(formatTenure('2025-10-07T00:00:00.000Z', now), '1 yr', 'exactly a year, no "0 mo"');
assert.equal(formatTenure('2026-09-25T00:00:00.000Z', now), '12 days');
assert.equal(formatTenure('2026-10-06T00:00:00.000Z', now), '1 day');
assert.equal(formatTenure('2026-10-07T01:00:00.000Z', now), 'Joined today');
assert.equal(formatTenure('2026-12-01T00:00:00.000Z', now), 'Joined today', 'a future join date never goes negative');
assert.equal(formatTenureShort('2025-03-07T00:00:00.000Z', now), '1y 7m');
assert.equal(formatTenureShort('2026-03-07T00:00:00.000Z', now), '7m');
assert.equal(formatTenureShort('2026-09-25T00:00:00.000Z', now), '12d');
assert.equal(formatTenureShort('2026-10-07T01:00:00.000Z', now), 'New');

// --- age: birthday boundaries ----------------------------------------------------
assert.equal(ageFromDob('1994-10-07T00:00:00.000Z', now), 32, 'birthday today');
assert.equal(ageFromDob('1994-10-08T00:00:00.000Z', now), 31, 'birthday tomorrow');
assert.equal(ageFromDob('1994-10-06T00:00:00.000Z', now), 32, 'birthday yesterday');
assert.equal(ageFromDob(null, now), null);
assert.equal(ageFromDob(undefined, now), null);
assert.equal(ageFromDob('garbage', now), null);
assert.equal(ageFromDob('2030-01-01T00:00:00.000Z', now), null, 'a future date of birth is not an age');

// --- National ID: only the last 4 digits ever reach the screen ---------------------
assert.equal(maskNid('1234567890123'), '•••• 0123');
assert.equal(maskNid(' 1234567890 '), '•••• 7890', 'whitespace is ignored');
assert.equal(maskNid('123'), '••••', 'a short id reveals nothing');
assert.equal(maskNid('1234'), '••••', 'exactly four digits would be the whole id');
assert.equal(maskNid(''), null);
assert.equal(maskNid('   '), null);
assert.equal(maskNid(null), null);
assert.ok(!String(maskNid('9988776655')).includes('99887'), 'the head of the id is never present');

// --- labels --------------------------------------------------------------------
assert.equal(roleLabel('WORKER'), 'Worker');
assert.equal(roleLabel('MANAGER'), 'Manager');
assert.equal(roleLabel('INTERN'), 'Intern');
assert.equal(roleLabel('SHED_LEAD'), 'Shed lead', 'an unknown role is still readable');
assert.equal(statusLabel('APPOINTED'), 'Appointed');
assert.equal(statusLabel('PROBATION'), 'On probation');
assert.equal(statusLabel('CONFIRMED'), 'Confirmed');
assert.equal(statusLabel('TERMINATED'), 'Ended');
assert.equal(statusLabel(undefined), null);
assert.equal(maritalLabel('MARRIED'), 'Married');
assert.equal(maritalLabel(null), null);
assert.equal(educationLabel('SSC'), 'SSC');
assert.equal(educationLabel('BACHELOR'), "Bachelor's");
assert.equal(educationLabel('NONE'), 'No formal schooling');
assert.equal(educationLabel(undefined), null);
assert.equal(educationLabel('OTHER_THING'), 'Other thing', 'an unknown level is humanised, not hidden');

// --- experience ------------------------------------------------------------------
assert.equal(formatExperience(3, 'Layer farm, Gazipur'), '3 yrs · Layer farm, Gazipur');
assert.equal(formatExperience(1, null), '1 yr');
assert.equal(formatExperience(0, 'First job'), 'First job', 'zero years with a note shows the note only');
assert.equal(formatExperience(0, null), null);
assert.equal(formatExperience(null, '  '), null);
assert.equal(formatExperience(null, 'Poultry helper'), 'Poultry helper');

// --- "Not provided": blank and whitespace are missing ------------------------------
assert.equal(displayValue('  hello '), 'hello');
assert.equal(displayValue(''), null);
assert.equal(displayValue('   '), null);
assert.equal(displayValue(null), null);
assert.equal(displayValue(undefined), null);

// --- emergency contact on file ------------------------------------------------------
assert.equal(hasEmergencyContact({ emergency_name: 'Rahim', emergency_phone: '017' }), true);
assert.equal(hasEmergencyContact({ emergency_name: 'Rahim', emergency_phone: null }), true, 'a name alone is something to show');
assert.equal(hasEmergencyContact({ emergency_name: null, emergency_phone: '017' }), true);
assert.equal(hasEmergencyContact({ emergency_name: '  ', emergency_phone: '' }), false);
assert.equal(hasEmergencyContact({}), false);

console.log('profile-format checks passed');
