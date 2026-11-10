/** Disease cases on the mortality form. Run: `bun src/lib/disease-cases.test.ts`. */

import assert from 'node:assert/strict';

import { openCasesIn, type DiseaseCase } from './disease-cases';

const c = (id: string, status: DiseaseCase['status'], houses: string[]): DiseaseCase => ({
  id,
  status,
  severity: 'LOW',
  noticed_on: '2026-11-07T00:00:00.000Z',
  disease: { id: 'd', label: 'Gumboro (IBD)' },
  houses: houses.map((h) => ({ id: h, name: h })),
});

const cases = [c('open-a', 'ACTIVE', ['A']), c('open-b', 'ACTIVE', ['B']), c('done-a', 'RESOLVED', ['A']), c('open-ab', 'ACTIVE', ['A', 'B'])];

assert.deepEqual(openCasesIn(cases, 'A').map((x) => x.id), ['open-a', 'open-ab']);
assert.deepEqual(openCasesIn(cases, 'C'), []);
assert.deepEqual(openCasesIn(cases, undefined), []);

console.log('disease-cases checks passed');
