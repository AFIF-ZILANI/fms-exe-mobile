/** Team summary for a manager. Run: `bun src/lib/team-view.test.ts`. */

import assert from 'node:assert/strict';

import { summarizeTeam, taskStatusLine } from './team-view';
import type { Employee, TaskAssignment } from './types';

const person = (id: string, name: string) => ({ id, profile: { name } }) as unknown as Employee;
const task = (id: string, employee_id: string, status: TaskAssignment['status'], due_at: string) =>
  ({ id, employee_id, status, due_at }) as unknown as TaskAssignment;

const now = new Date('2026-10-08T12:00:00Z');
const team = [person('a', 'Asha'), person('b', 'Bilal'), person('c', 'Chitra'), person('me', 'Manager')];
const tasks = [
  task('1', 'a', 'DONE', '2026-10-08T05:00:00Z'),
  task('2', 'a', 'PENDING', '2026-10-08T15:00:00Z'), // later today
  task('3', 'b', 'PENDING', '2026-10-08T06:00:00Z'), // overdue
  task('4', 'b', 'PENDING', '2026-10-08T07:00:00Z'), // overdue
  task('5', 'c', 'CANCELLED', '2026-10-08T06:00:00Z'), // doesn't count
];
const scores = [
  { employee_id: 'a', points: 3 },
  { employee_id: 'a', points: -1 },
  { employee_id: 'c', points: 5 },
];

const s = summarizeTeam(team, tasks, scores, now, 'me');
assert.deepEqual(s.members.map((m) => m.member.id), ['b', 'a', 'c'], 'overdue first, the viewer left out');
const [b, a, c] = s.members;
assert.deepEqual({ done: b!.done, pending: b!.pending, overdue: b!.overdue, total: b!.total }, { done: 0, pending: 2, overdue: 2, total: 2 });
assert.deepEqual({ done: a!.done, pending: a!.pending, overdue: a!.overdue, points: a!.points }, { done: 1, pending: 1, overdue: 0, points: 2 });
assert.equal(c!.total, 0, 'a cancelled task is not on their plate');
assert.equal(c!.points, 5);
assert.equal(s.onShift, 2);
assert.equal(s.done, 1);
assert.equal(s.total, 4);

// ties fall back to name
const tie = summarizeTeam([person('x', 'Zed'), person('y', 'Amir')], [], [], now);
assert.deepEqual(tie.members.map((m) => m.member.id), ['y', 'x']);
assert.deepEqual(summarizeTeam([], [], [], now), { members: [], onShift: 0, done: 0, total: 0 });

// the line under the name
assert.deepEqual(taskStatusLine({ pending: 2, overdue: 1, total: 3 }), { text: '1 overdue', tone: 'critical' });
assert.deepEqual(taskStatusLine({ pending: 2, overdue: 0, total: 3 }), { text: '2 left today', tone: 'ink' });
assert.deepEqual(taskStatusLine({ pending: 0, overdue: 0, total: 3 }), { text: 'All done', tone: 'success' });
assert.deepEqual(taskStatusLine({ pending: 0, overdue: 0, total: 0 }), { text: 'No tasks today', tone: 'muted' });

console.log('team-view checks passed');
