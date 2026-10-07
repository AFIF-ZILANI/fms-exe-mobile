/** What the Log launcher offers. Run: `bun src/lib/launcher.test.ts`. */

import assert from 'node:assert/strict';

import { buildLauncher } from './launcher';

const MANAGER_ONLY_PATHS = ['/assign', '/score', '/transfer', '/feeding-program', '/link', '/adjust', '/flag-stock', '/team'];

const worker = buildLauncher(false, null);
const manager = buildLauncher(true, null);

// --- groups per role -----------------------------------------------------------
assert.deepEqual(worker.map((g) => g.title), ['Record', 'Stock']);
assert.deepEqual(manager.map((g) => g.title), ['Record', 'Stock', 'Manage']);

// --- a Worker is never offered a manager-only item ------------------------------
const workerPaths = worker.flatMap((g) => g.items.map((i) => i.path.split('?')[0]));
for (const p of MANAGER_ONLY_PATHS) {
  assert.ok(!workerPaths.includes(p), `worker must not be offered ${p}`);
}
// ...and a Manager is offered every one of them.
const managerPaths = manager.flatMap((g) => g.items.map((i) => i.path.split('?')[0]));
for (const p of MANAGER_ONLY_PATHS) {
  assert.ok(managerPaths.includes(p), `manager should be offered ${p}`);
}

// --- contents ---------------------------------------------------------------
assert.deepEqual(
  worker[0].items.map((i) => i.label),
  ['Mortality', 'Feed', 'Weight', 'Environment', 'Treatment'],
);
assert.deepEqual(worker[1].items.map((i) => i.label), ['Move to house', 'Use an item']);
assert.deepEqual(
  manager[1].items.map((i) => i.label),
  ['Move to house', 'Use an item', 'Link items', 'Report discrepancy', 'Flag low stock'],
);
assert.deepEqual(
  manager[2].items.map((i) => i.label),
  ['Assign a task', 'Give points', 'Move birds', 'Feeding plan', 'Team'],
);

// --- house context ---------------------------------------------------------------
const inHouse = buildLauncher(true, 'h-9');
const byLabel = (groups: typeof inHouse, label: string) =>
  groups.flatMap((g) => g.items).find((i) => i.label === label)!;
assert.equal(byLabel(inHouse, 'Mortality').path, '/log/mortality?house_id=h-9');
assert.equal(byLabel(inHouse, 'Move to house').path, '/scan/allocate?house_id=h-9');
assert.equal(byLabel(inHouse, 'Use an item').path, '/scan/consume?house_id=h-9');
assert.equal(byLabel(inHouse, 'Report discrepancy').path, '/adjust?house_id=h-9');
assert.equal(byLabel(inHouse, 'Team').path, '/team', 'screens that are not house-scoped never get a house_id');
assert.equal(byLabel(manager, 'Mortality').path, '/log/mortality', 'no house, no query string');

// --- hygiene -----------------------------------------------------------------------
for (const groups of [worker, manager, inHouse]) {
  const labels = groups.flatMap((g) => g.items.map((i) => i.label));
  assert.equal(new Set(labels).size, labels.length, 'labels are unique within a launcher');
  for (const item of groups.flatMap((g) => g.items)) {
    assert.ok(item.path.startsWith('/'), `${item.label} path is absolute`);
    assert.ok(item.description.length > 0, `${item.label} has a description`);
  }
}

console.log('launcher checks passed');
