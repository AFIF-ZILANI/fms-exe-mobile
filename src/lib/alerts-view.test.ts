/** Alert ordering and counts. Run: `bun src/lib/alerts-view.test.ts`. */

import assert from 'node:assert/strict';

import { alertTypeLabel, countByLevel, filterAlerts, levelWord, sortAlerts, summarizeAlerts } from './alerts-view';
import type { FarmAlert } from './types';

const alert = (id: string, level: FarmAlert['level'], issued_at: string, over: Partial<FarmAlert> = {}): FarmAlert => ({
  id,
  title: id,
  description: null,
  type: 'SYSTEM',
  level,
  status: 'ACTIVE',
  issued_at,
  resolved_at: null,
  created_at: issued_at,
  ...over,
});

const d = (day: number) => `2026-10-0${day}T09:00:00.000Z`;

// --- order: Critical, Warning, Info; newest first inside a level -------------------------------------------
{
  const sorted = sortAlerts([
    alert('info-new', 'INFO', d(7)),
    alert('crit-old', 'CRITICAL', d(1)),
    alert('warn-new', 'WARNING', d(6)),
    alert('crit-new', 'CRITICAL', d(5)),
    alert('warn-old', 'WARNING', d(2)),
  ]);
  assert.deepEqual(sorted.map((a) => a.id), ['crit-new', 'crit-old', 'warn-new', 'warn-old', 'info-new']);
}

// --- newest-first only (resolved list) -------------------------------------------------------------------------
{
  const sorted = sortAlerts([alert('a', 'INFO', d(1)), alert('b', 'CRITICAL', d(2)), alert('c', 'WARNING', d(3))], false);
  assert.deepEqual(sorted.map((a) => a.id), ['c', 'b', 'a'], 'level is ignored when byLevel is false');
}

// --- does not mutate its input ---------------------------------------------------------------------------------
{
  const input = [alert('x', 'INFO', d(1)), alert('y', 'CRITICAL', d(2))];
  sortAlerts(input);
  assert.deepEqual(input.map((a) => a.id), ['x', 'y']);
}

// --- an unreadable date sorts last within its level, and never throws ------------------------------------------
{
  const sorted = sortAlerts([alert('junk', 'WARNING', 'garbage', { created_at: 'garbage' }), alert('ok', 'WARNING', d(3))]);
  assert.deepEqual(sorted.map((a) => a.id), ['ok', 'junk']);
}

// --- summary: the server total beats the page length; red only for Critical ----------------------------------
assert.deepEqual(summarizeAlerts([alert('a', 'WARNING', d(1))], 7), { count: 7, critical: false });
assert.deepEqual(summarizeAlerts([alert('a', 'WARNING', d(1)), alert('b', 'CRITICAL', d(2))], 2), { count: 2, critical: true });
assert.deepEqual(summarizeAlerts([alert('a', 'INFO', d(1))], undefined), { count: 1, critical: false }, 'no total: use the page');
assert.deepEqual(summarizeAlerts([], 0), { count: 0, critical: false });
assert.deepEqual(summarizeAlerts([], undefined), { count: 0, critical: false });
assert.deepEqual(summarizeAlerts([], -3), { count: 0, critical: false }, 'a junk total never goes negative');

// --- words -----------------------------------------------------------------------------------------------------
assert.equal(levelWord('CRITICAL'), 'Critical');
assert.equal(levelWord('WARNING'), 'Warning');
assert.equal(levelWord('INFO'), 'Info');
assert.equal(alertTypeLabel('MEDICINE'), 'Medicine');
assert.equal(alertTypeLabel('BATCH'), 'Batch');
assert.equal(alertTypeLabel('SYSTEM'), 'System');
assert.equal(alertTypeLabel('EMPLOYEE'), 'Employee');
assert.equal(alertTypeLabel('FEED'), 'Feed');

// --- filter chips ----------------------------------------------------------------
const mix = [alert('a', 'INFO', '2026-10-01'), alert('b', 'CRITICAL', '2026-10-02'), alert('c', 'CRITICAL', '2026-10-03')];
assert.deepEqual(countByLevel(mix), { ALL: 3, CRITICAL: 2, WARNING: 0, INFO: 1 });
assert.deepEqual(countByLevel([]), { ALL: 0, CRITICAL: 0, WARNING: 0, INFO: 0 });
assert.deepEqual(filterAlerts(mix, 'CRITICAL').map((a) => a.id), ['b', 'c']);
assert.equal(filterAlerts(mix, 'ALL').length, 3);
assert.equal(filterAlerts(mix, 'WARNING').length, 0);

console.log('alerts-view checks passed');
