/** My tasks grouping and wording. Run: `bun src/lib/tasks-view.test.ts`. */

import assert from 'node:assert/strict';

import { dueLabel, groupTasks, taskHref } from './tasks-view';
import type { TaskAssignment } from './types';

// Built from LOCAL components so the tests pass in any timezone: "today" is the phone's calendar day.
const now = new Date(2026, 9, 7, 14, 0); // 7 Oct 2026, 14:00 local
const at = (d: number, h: number, m = 0, month = 9) => new Date(2026, month, d, h, m).toISOString();

const task = (id: string, status: TaskAssignment['status'], due: string, over: Partial<TaskAssignment> = {}) =>
  ({
    id,
    status,
    due_at: due,
    completed_at: null,
    house_id: null,
    title: id,
    task: { task_type: { code: 'MORTALITY' } },
    ...over,
  }) as unknown as TaskAssignment;

// --- grouping -----------------------------------------------------------------------------------------
{
  const g = groupTasks(
    [
      task('later-day', 'PENDING', at(9, 8)), // 9 Oct
      task('tomorrow', 'PENDING', at(8, 0, 5)), // just after midnight tomorrow
      task('today-evening', 'PENDING', at(7, 18)), // later today
      task('today-earlier', 'PENDING', at(7, 9)), // earlier today -> overdue
      task('yesterday', 'PENDING', at(6, 12)),
      task('done-1', 'DONE', at(5, 10), { completed_at: at(5, 11) }),
      task('done-2', 'DONE', at(6, 10), { completed_at: at(6, 15) }),
      task('cancelled', 'CANCELLED', at(7, 16)),
    ],
    now,
  );
  assert.deepEqual(g.overdue.map((t) => t.id), ['yesterday', 'today-earlier'], 'overdue: oldest first, includes earlier today');
  assert.deepEqual(g.today.map((t) => t.id), ['today-evening']);
  assert.deepEqual(g.later.map((t) => t.id), ['tomorrow', 'later-day'], 'later: soonest first');
  assert.deepEqual(g.done.map((t) => t.id), ['done-2', 'done-1'], 'done: most recently completed first');
  const all = [...g.overdue, ...g.today, ...g.later, ...g.done].map((t) => t.id);
  assert.ok(!all.includes('cancelled'), 'cancelled tasks are never shown');
}

// --- boundaries -----------------------------------------------------------------------------------------
{
  const g = groupTasks(
    [
      task('exactly-now', 'PENDING', now.toISOString()),
      task('one-min-ago', 'PENDING', new Date(now.getTime() - 60_000).toISOString()),
      task('last-minute-today', 'PENDING', at(7, 23, 59)),
      task('midnight-tomorrow', 'PENDING', at(8, 0, 0)),
    ],
    now,
  );
  assert.deepEqual(g.overdue.map((t) => t.id), ['one-min-ago'], 'due exactly now is not yet overdue');
  assert.deepEqual(g.today.map((t) => t.id), ['exactly-now', 'last-minute-today']);
  assert.deepEqual(g.later.map((t) => t.id), ['midnight-tomorrow'], '00:00 tomorrow is tomorrow');
}

// --- junk never crashes; done without a completion time falls back to due date --------------------------------
{
  const g = groupTasks(
    [
      task('junk-due', 'PENDING', 'not a date'),
      task('done-no-time', 'DONE', at(3, 9)),
      task('done-with-time', 'DONE', at(2, 9), { completed_at: at(4, 9) }),
    ],
    now,
  );
  assert.deepEqual(g.later.map((t) => t.id), ['junk-due'], 'an unreadable due date is shown under Later, not dropped');
  assert.deepEqual(g.done.map((t) => t.id), ['done-with-time', 'done-no-time']);
  assert.deepEqual(groupTasks([], now), { overdue: [], today: [], later: [], done: [] });
}

// --- daylight saving: still calendar days (TZ=America/Los_Angeles exercises it) ------------------------------------
{
  const afterFallBack = new Date(2026, 10, 2, 9, 0); // 2 Nov 2026, just after US clocks went back
  const g = groupTasks([task('t', 'PENDING', at(2, 20, 0, 10)), task('n', 'PENDING', at(3, 1, 0, 10))], afterFallBack);
  assert.deepEqual(g.today.map((t) => t.id), ['t']);
  assert.deepEqual(g.later.map((t) => t.id), ['n']);
}

// --- due label ---------------------------------------------------------------------------------------------------
assert.equal(dueLabel(at(7, 18), now), 'Today');
assert.equal(dueLabel(at(8, 9), now), 'Tomorrow');
assert.equal(dueLabel(at(6, 9), now), 'Yesterday');
assert.equal(dueLabel(at(9, 9), now), 'Oct 9');
assert.equal(dueLabel(at(1, 9, 0, 11), now), 'Dec 1');
assert.equal(dueLabel(null, now), '');
assert.equal(dueLabel('garbage', now), '');

// --- href: same routing Home's Today card used ---------------------------------------------------------------------
assert.equal(
  taskHref(task('t1', 'PENDING', at(7, 9), { house_id: 'h9' })),
  '/log/mortality?house_id=h9&task_id=t1',
  'a task type with a form opens that form for the house and carries the task id',
);
assert.equal(taskHref(task('t2', 'PENDING', at(7, 9))), '/log/mortality?task_id=t2', 'no house: only the task id');
assert.equal(
  taskHref(task('t3', 'PENDING', at(7, 9), { house_id: 'h1', task: { task_type: { code: 'MEDICATION' } } as TaskAssignment['task'] })),
  '/log/treatment?type=medication&house_id=h1&task_id=t3',
  'a route that already has a query string gets & not ?',
);
assert.equal(
  taskHref(task('t4', 'PENDING', at(7, 9), { task: { task_type: { code: 'SOMETHING_NEW' } } as TaskAssignment['task'] })),
  '/tasks/t4',
  'an unknown task type falls back to the detail screen',
);
assert.equal(
  taskHref(task('t5', 'PENDING', at(7, 9), { task: { task_type: null } as TaskAssignment['task'] })),
  '/tasks/t5',
  'no task type at all falls back to the detail screen',
);

console.log('tasks-view checks passed');
