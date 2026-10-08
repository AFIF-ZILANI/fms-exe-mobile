import { routeForTaskType } from './task-forms';
import type { TaskAssignment } from './types';

export type TaskGroups = {
  overdue: TaskAssignment[];
  today: TaskAssignment[];
  later: TaskAssignment[];
  done: TaskAssignment[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Midnight at the start of the next local day (built from the calendar, so daylight-saving days are right). */
const startOfNextLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

const dueMs = (t: TaskAssignment) => new Date(t.due_at).getTime();

/**
 * Splits my tasks into Overdue (pending and due time passed), Today (pending, due later today), Later
 * (pending, tomorrow or beyond; also an unreadable due date, so a task never silently disappears) and
 * Done. Cancelled tasks are dropped. "Today" is the phone's local calendar day. Pending groups are
 * soonest first; Done is most recently completed first (due date when there is no completion time).
 */
export function groupTasks(tasks: TaskAssignment[], now: Date): TaskGroups {
  const nowMs = now.getTime();
  const tomorrow = startOfNextLocalDay(now);
  const groups: TaskGroups = { overdue: [], today: [], later: [], done: [] };

  for (const t of tasks) {
    if (t.status === 'DONE') {
      groups.done.push(t);
      continue;
    }
    if (t.status !== 'PENDING') continue;
    const due = dueMs(t);
    if (Number.isNaN(due)) groups.later.push(t);
    else if (due < nowMs) groups.overdue.push(t);
    else if (due < tomorrow) groups.today.push(t);
    else groups.later.push(t);
  }

  const byDue = (a: TaskAssignment, b: TaskAssignment) => (dueMs(a) || 0) - (dueMs(b) || 0);
  groups.overdue.sort(byDue);
  groups.today.sort(byDue);
  groups.later.sort(byDue);
  const doneMs = (t: TaskAssignment) => {
    const done = t.completed_at ? new Date(t.completed_at).getTime() : Number.NaN;
    return Number.isNaN(done) ? dueMs(t) || 0 : done;
  };
  groups.done.sort((a, b) => doneMs(b) - doneMs(a));
  return groups;
}

/** "Today", "Tomorrow", "Yesterday" or "Oct 9" — by calendar day where the person is. Empty when unreadable. */
export function dueLabel(iso: string | null | undefined, now: Date): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfLocalDay(d) - startOfLocalDay(now)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Where tapping a pending task goes: the form its task type maps to, for its house and carrying the
 * task id so the form completes the task; an unknown or missing type falls back to the task detail
 * screen. One function, used by Home's Today card and the My tasks list.
 */
export function taskHref(task: {
  id: string;
  house_id: string | null;
  task: { task_type?: { code: string } | null };
}): string {
  const route = routeForTaskType(task.task.task_type?.code);
  if (!route) return `/tasks/${task.id}`;
  const sep = route.includes('?') ? '&' : '?';
  const params = [task.house_id ? `house_id=${task.house_id}` : '', `task_id=${task.id}`].filter(Boolean).join('&');
  return `${route}${sep}${params}`;
}
