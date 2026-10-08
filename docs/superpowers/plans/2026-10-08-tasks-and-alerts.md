# My Tasks + Alerts (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full "My tasks" list (overdue, today, later, done) opened from Home's Today card, and an Alerts screen opened from a bell on Home's header with a count badge, both read-only.

**Architecture:** Two pure, tested helpers carry the logic (`lib/tasks-view.ts` groups and words tasks; `lib/alerts-view.ts` sorts and summarises alerts). The Header gains an optional badge on its action. Two new root-stack screens (`/tasks`, `/alerts`) and small Home edits use them.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / TanStack Query / Bun assertion scripts. No new dependencies.

**Spec:** `mobile/docs/navigation-redesign-design.md` §Phases 3.

## Global Constraints

- Branch → change → verify → merge. Work on `feat/tasks-alerts` in `mobile/` (own git repo); never commit to `main`. Commit messages carry **no attribution lines**.
- No new dependencies. `bunx tsc --noEmit`, `bunx expo lint`, `bun run test` clean before any task is done.
- React Compiler: no ref reads/writes and no `new Date()`/`Date.now()` during render (hold `now` in state; Home's existing `new Date()` calls in JSX stay as they are).
- Read-only: no task or alert is created, edited, completed, cancelled or resolved from the new screens. Opening a pending task goes through the **same routing as Home's Today card** (`routeForTaskType` + `house_id`/`task_id` params), extracted into one function used by both.
- A Worker may call `GET /alerts` and `GET /task-assignments?employee_id=<own>` (server `READ_ANY` / own-record rule); do not call anything else.
- Status by icon AND word, never colour alone; design tokens and shared components; 48dp targets; light and dark.
- Cancelled tasks are never shown.
- The new screens render `null` (not an error) when `!signedIn`, with every hook above that return.

## Review Focus

- A pending task due earlier today is Overdue, not Today; due later today is Today; due tomorrow or later is Later; a DONE task is Done; CANCELLED is dropped; an unparsable due date never crashes. Pinned in Task 1.
- "Today" is the phone's local calendar day, including across daylight-saving changes. Pinned in Task 1.
- Alerts sort Critical → Warning → Info, newest first within a level. The Home badge counts the server's active total (not just the first page) and turns red only when a Critical alert is active. Pinned in Task 1.
- Tapping a pending task opens the same screen Home's card did (same route and params); tapping a done task opens the read-only detail. Task 1 pins the href; Task 2 uses it in both places.
- The header badge is readable in light and dark, has an accessibility label with the count, and caps its text ("9+"). Task 2.
- Pull-to-refresh never spins forever offline (time-boxed). Task 2.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/tasks-view.ts` (new) + `.test.ts` | Pure: `groupTasks`, `dueLabel`, `taskHref`. |
| `src/lib/alerts-view.ts` (new) + `.test.ts` | Pure: `sortAlerts`, `summarizeAlerts`, `levelWord`, `alertTypeLabel`. |
| `src/lib/types.ts` | `FarmAlert` type. |
| `src/components/ui/header.tsx` | Optional badge on the action. |
| `src/app/tasks/index.tsx` (new) | My tasks screen. |
| `src/app/alerts.tsx` (new) | Alerts screen. |
| `src/app/(tabs)/index.tsx` | Bell with badge; Today card "All"; use `taskHref`. |
| `package.json` | `test` script runs the two new scripts. |

---

### Task 1: Pure helpers and types

**Files:**
- Create: `mobile/src/lib/tasks-view.ts`, `mobile/src/lib/tasks-view.test.ts`
- Create: `mobile/src/lib/alerts-view.ts`, `mobile/src/lib/alerts-view.test.ts`
- Modify: `mobile/src/lib/types.ts`, `mobile/package.json`

**Interfaces (exact names used by Task 2):**
- `tasks-view.ts`: `type TaskGroups = { overdue; today; later; done: TaskAssignment[] }`, `groupTasks(tasks: TaskAssignment[], now: Date): TaskGroups`, `dueLabel(iso: string | null | undefined, now: Date): string`, `taskHref(task): string`
- `alerts-view.ts`: `sortAlerts(alerts: FarmAlert[], byLevel?: boolean): FarmAlert[]`, `summarizeAlerts(results: FarmAlert[], total?: number): { count: number; critical: boolean }`, `levelWord(level): string`, `alertTypeLabel(type): string`
- `types.ts`: `type FarmAlert`, `type AlertLevel`

- [ ] **Step 1: Branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
git checkout main && git checkout -b feat/tasks-alerts
```

- [ ] **Step 2: Add the alert type** — append to `src/lib/types.ts`:

```ts
export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

/** GET /alerts rows. Named FarmAlert so it never collides with React Native's `Alert`. */
export type FarmAlert = {
  id: string;
  title: string;
  description: string | null;
  type: 'EMPLOYEE' | 'BATCH' | 'FEED' | 'MEDICINE' | 'SYSTEM';
  level: AlertLevel;
  status: 'ACTIVE' | 'RESOLVED';
  issued_at: string;
  resolved_at: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Write the failing tasks test** — `src/lib/tasks-view.test.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it fails** — `bun src/lib/tasks-view.test.ts` → FAIL, module not found.

- [ ] **Step 5: Implement** — `src/lib/tasks-view.ts`:

```ts
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
```

- [ ] **Step 6: Run it to verify it passes** — `bun src/lib/tasks-view.test.ts`; then `TZ=Asia/Dhaka bun src/lib/tasks-view.test.ts` and `TZ=America/Los_Angeles bun src/lib/tasks-view.test.ts` — Expected: `tasks-view checks passed` each time.

- [ ] **Step 7: Write the failing alerts test** — `src/lib/alerts-view.test.ts`:

```ts
/** Alert ordering and counts. Run: `bun src/lib/alerts-view.test.ts`. */

import assert from 'node:assert/strict';

import { alertTypeLabel, levelWord, sortAlerts, summarizeAlerts } from './alerts-view';
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

console.log('alerts-view checks passed');
```

- [ ] **Step 8: Run to verify it fails**, then implement — `src/lib/alerts-view.ts`:

```ts
import type { AlertLevel, FarmAlert } from './types';

const RANK: Record<AlertLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

const issuedMs = (a: FarmAlert) => {
  const ms = new Date(a.issued_at || a.created_at).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
};

/** Critical first, then Warning, then Info; newest first inside a level (an unreadable date goes last).
 *  Pass `byLevel = false` for a plain newest-first list (resolved alerts). Never mutates its input. */
export function sortAlerts(alerts: FarmAlert[], byLevel = true): FarmAlert[] {
  return [...alerts].sort(
    (a, b) => (byLevel ? RANK[a.level] - RANK[b.level] : 0) || issuedMs(b) - issuedMs(a),
  );
}

/** What the Home bell shows: the server's total of active alerts (not just this page) and whether any
 *  shown alert is Critical (the badge turns red only then). */
export function summarizeAlerts(results: FarmAlert[], total?: number): { count: number; critical: boolean } {
  const count = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, total) : results.length;
  return { count, critical: results.some((a) => a.level === 'CRITICAL') };
}

const LEVEL: Record<AlertLevel, string> = { CRITICAL: 'Critical', WARNING: 'Warning', INFO: 'Info' };
export const levelWord = (level: AlertLevel): string => LEVEL[level];

const TYPE: Record<FarmAlert['type'], string> = {
  EMPLOYEE: 'Employee',
  BATCH: 'Batch',
  FEED: 'Feed',
  MEDICINE: 'Medicine',
  SYSTEM: 'System',
};
export const alertTypeLabel = (type: FarmAlert['type']): string => TYPE[type];
```

- [ ] **Step 9: Run to verify it passes** — `bun src/lib/alerts-view.test.ts` → `alerts-view checks passed`.

- [ ] **Step 10: Test script** — append `&& bun src/lib/tasks-view.test.ts && bun src/lib/alerts-view.test.ts` to the `test` script in `package.json` (keep the existing chain). `bun run test` → fourteen "checks passed" lines.

- [ ] **Step 11: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/tasks-view.ts src/lib/tasks-view.test.ts src/lib/alerts-view.ts src/lib/alerts-view.test.ts src/lib/types.ts package.json
git commit -m "feat(tasks): pure task grouping, alert sorting and the shared task href"
```

---

### Task 2: Header badge, the two screens, Home

**Files:**
- Modify: `mobile/src/components/ui/header.tsx` (badge on the action)
- Create: `mobile/src/app/tasks/index.tsx`
- Create: `mobile/src/app/alerts.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx` (Home)

**Interfaces:** Consumes Task 1 helpers, `useGetData`/`Paginated`, `useSession`, `Screen`/`Header`/`Card`/`EmptyState`/`LedgerRow`/`StatusPill`/`Icon`/`AppText`, `formatTime`, `formatRelative`, `houseToken`.

- [ ] **Step 1: Header badge** — in `src/components/ui/header.tsx`:

(a) Extend the `action` prop type:

```tsx
  action?: {
    icon: IconName;
    label: string;
    onPress: () => void;
    /** A count shown on the icon (e.g. active alerts). Hidden at 0; capped as "9+". */
    badge?: number;
    /** Red only when something is critical; amber otherwise. */
    badgeTone?: 'warning' | 'critical';
  };
```

(b) Add imports `import { useColorScheme } from '@/hooks/use-color-scheme';` and read `const scheme = useColorScheme();` at the top of the component.

(c) Replace the action `Pressable` block with:

```tsx
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={
            action.badge && action.badge > 0 ? `${action.label}, ${action.badge} active` : action.label
          }
          style={styles.iconButton}
        >
          <Icon name={action.icon} size={24} />
          {action.badge && action.badge > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: action.badgeTone === 'critical' ? theme.critical : theme.warning },
              ]}
            >
              <AppText
                variant="caption"
                style={[
                  styles.badgeText,
                  // Dark text on the bright dark-theme colours and on amber; white on light-theme red.
                  { color: scheme === 'dark' || action.badgeTone !== 'critical' ? '#0F1419' : '#FFFFFF' },
                ]}
              >
                {action.badge > 9 ? '9+' : String(action.badge)}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ) : null}
```

(d) Add `const theme = useTheme();` if the component does not already have it (it does), and add to `StyleSheet.create`:

```tsx
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
```

- [ ] **Step 2: The My tasks screen** — create `src/app/tasks/index.tsx`:

```tsx
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { houseToken } from '@/lib/farm';
import { formatTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { dueLabel, groupTasks, taskHref } from '@/lib/tasks-view';
import type { TaskAssignment } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;
const DONE_SHOWN = 20;

/** docs/navigation-redesign-design.md Phase 3 — all of my tasks: overdue, today, later, and recently done. */
export default function MyTasksScreen() {
  const theme = useTheme();
  const { employee, signedIn } = useSession();
  // Held in state (new Date() during render is impure) and refreshed on pull-down.
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const q = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?employee_id=${employee?.id ?? ''}&limit=100`,
    ['task-assignments', 'mine', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const groups = groupTasks(q.data?.results ?? [], now);
  const total = groups.overdue.length + groups.today.length + groups.later.length + groups.done.length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([q.refetch(), new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS))]);
    } finally {
      setRefreshing(false);
    }
  };

  const section = (
    title: string,
    tasks: TaskAssignment[],
    kind: 'overdue' | 'pending' | 'done',
  ) =>
    tasks.length === 0 ? null : (
      <Card rows eyebrow={title} note={String(tasks.length)} style={styles.card}>
        {tasks.map((task, i) => (
          <LedgerRow
            key={task.id}
            gutter={houseToken(task.house?.number)}
            last={i === tasks.length - 1}
            onPress={() => router.push((kind === 'done' ? `/tasks/${task.id}` : taskHref(task)) as Href)}
          >
            <View style={styles.rowTop}>
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                {task.title}
              </AppText>
              {kind === 'overdue' ? <StatusPill status="OVERDUE" /> : null}
              {kind === 'done' ? <StatusPill status="DONE" /> : null}
            </View>
            <AppText variant="caption" color={kind === 'overdue' ? 'critical' : 'muted'}>
              {kind === 'done'
                ? `Done ${dueLabel(task.completed_at ?? task.due_at, now).toLowerCase()}`
                : `${dueLabel(task.due_at, now)} · ${formatTime(task.due_at)}`}
              {task.location_note ? ` · ${task.location_note}` : ''}
            </AppText>
          </LedgerRow>
        ))}
      </Card>
    );

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="My tasks" leading="back" />
      <SyncBanner />

      {q.isPending && !q.data ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </View>
      ) : q.isError && !q.data ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load your tasks."
            action={{ label: 'Retry', onPress: () => void q.refetch() }}
          />
        </Card>
      ) : total === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="No tasks assigned to you."
            body="New tasks from your manager show up here."
          />
        </Card>
      ) : (
        <>
          {section('Overdue', groups.overdue, 'overdue')}
          {section('Today', groups.today, 'pending')}
          {section('Later', groups.later, 'pending')}
          {section('Done', groups.done.slice(0, DONE_SHOWN), 'done')}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
```

- [ ] **Step 3: The Alerts screen** — create `src/app/alerts.tsx`:

```tsx
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { alertTypeLabel, levelWord, sortAlerts } from '@/lib/alerts-view';
import { useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AlertLevel, FarmAlert } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

const LEVEL_ICON: Record<AlertLevel, { icon: IconName; color: ThemeColor }> = {
  CRITICAL: { icon: 'alert-octagon', color: 'critical' },
  WARNING: { icon: 'alert-triangle', color: 'warning' },
  INFO: { icon: 'info', color: 'info' },
};

/** docs/navigation-redesign-design.md Phase 3 — the farm's alerts, read-only. Severity is an icon AND a word. */
export default function AlertsScreen() {
  const theme = useTheme();
  const { signedIn } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  // Same URL and key as Home's bell, so the cache is shared and the badge and list agree.
  const active = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const resolved = useGetData<Paginated<FarmAlert>>('/alerts?status=RESOLVED&limit=20', ['alerts', 'resolved']);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const activeList = sortAlerts(active.data?.results ?? []);
  const resolvedList = sortAlerts(resolved.data?.results ?? [], false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([active.refetch(), resolved.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const row = (alert: FarmAlert, last: boolean, isResolved: boolean) => {
    const { icon, color } = isResolved ? { icon: 'check-circle' as IconName, color: 'muted' as ThemeColor } : LEVEL_ICON[alert.level];
    return (
      <View
        key={alert.id}
        accessible
        accessibilityLabel={`${levelWord(alert.level)}. ${alert.title}. ${alert.description ?? ''}`}
        style={[styles.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.line }]}
      >
        <Icon name={icon} size={20} color={color} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={isResolved ? 'inkSoft' : 'ink'}>
            {alert.title}
          </AppText>
          {alert.description ? (
            <AppText variant="body" color="inkSoft" numberOfLines={3}>
              {alert.description}
            </AppText>
          ) : null}
          <AppText variant="caption" color={isResolved ? 'muted' : color}>
            {isResolved ? 'Resolved' : levelWord(alert.level)} · {alertTypeLabel(alert.type)} ·{' '}
            {formatRelative(isResolved ? (alert.resolved_at ?? alert.issued_at) : alert.issued_at)}
          </AppText>
        </View>
      </View>
    );
  };

  const loading = (active.isPending && !active.data) || (resolved.isPending && !resolved.data);
  const failed = (active.isError && !active.data) || (resolved.isError && !resolved.data);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="Alerts" leading="back" />
      <SyncBanner />

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} />
          ))}
        </View>
      ) : failed ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load alerts."
            action={{
              label: 'Retry',
              onPress: () => void Promise.all([active.refetch(), resolved.refetch()]),
            }}
          />
        </Card>
      ) : (
        <>
          {activeList.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="check-circle"
                tint="tintGreen"
                title="No active alerts."
                body="Anything that needs attention shows up here."
              />
            </Card>
          ) : (
            <Card eyebrow="Active" note={String(active.data?.total ?? activeList.length)} style={styles.card}>
              {activeList.map((a, i) => row(a, i === activeList.length - 1, false))}
            </Card>
          )}

          {resolvedList.length > 0 ? (
            <Card eyebrow="Resolved" style={styles.card}>
              {resolvedList.map((a, i) => row(a, i === resolvedList.length - 1, true))}
            </Card>
          ) : null}

          <AppText variant="caption" color="muted" style={styles.note}>
            Alerts are resolved by your manager.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  item: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
});
```

- [ ] **Step 4: Home** — in `src/app/(tabs)/index.tsx` make exactly these changes (let `bunx expo lint` and `tsc` list any leftover unused import and remove only those):

(a) Imports — add:
```tsx
import { summarizeAlerts } from '@/lib/alerts-view';
import { taskHref } from '@/lib/tasks-view';
```
and add `FarmAlert` to the existing `import type { ... } from '@/lib/types';`.

(b) After the existing `useGetData` calls add:

```tsx
  // Same URL and key as the Alerts screen, so the bell badge and the list agree.
  const { data: activeAlerts } = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const alertSummary = summarizeAlerts(activeAlerts?.results ?? [], activeAlerts?.total);
```
(place it above the `if (isLoading) return <Screen />;` early return, with the other hooks).

(c) Replace the whole body of `openTask` with a call to the shared function:

```tsx
  const openTask = (task: TaskAssignment) => {
    router.push(taskHref(task) as Href);
  };
```
and remove the now-unused `routeForTaskType` import.

(d) The Home `<Header ... />` gets the bell (it currently has no action):

```tsx
      <Header
        eyebrow={greeting()}
        title={employee.profile.name}
        action={{
          icon: 'bell',
          label: 'Alerts',
          badge: alertSummary.count,
          badgeTone: alertSummary.critical ? 'critical' : 'warning',
          onPress: () => router.push('/alerts' as Href),
        }}
      />
```

(e) The Today card: replace its `eyebrow` and `note` props with an eyebrow that carries the done count, and an "All" action to the full list:

```tsx
      <Card
        rows
        eyebrow={`Today · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}${
          all.length ? ` · ${all.length - pending.length} of ${all.length} done` : ''
        }`}
        action="All"
        onActionPress={() => router.push('/tasks' as Href)}
        style={styles.card}
      >
```
(the `Card` shows `note` instead of `action` when both are set, so `note` must be removed.)

- [ ] **Step 5: Typecheck, lint, tests** — `bunx tsc --noEmit && bunx expo lint && bun run test`; clean, fourteen "checks passed" lines. Confirm `grep -rn "routeForTaskType" src` lists only `lib/task-forms.ts` and `lib/tasks-view.ts` (and its test).

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(tasks): My tasks list, Alerts screen and the Home bell and 'All' link"
```

---

### Task 3: Verify, document, merge

- [ ] **Step 1: Green** — `bunx tsc --noEmit && bunx expo lint && bun run test`; also `TZ=Asia/Dhaka bun src/lib/tasks-view.test.ts` and `TZ=America/Los_Angeles bun src/lib/tasks-view.test.ts`.

- [ ] **Step 2: Browser check** as the test worker and manager, light and dark: Home header shows the bell (with a badge when active alerts exist; amber, or red when any is Critical), the Today card has an "All" link and an "x of y done" eyebrow; `/tasks` shows sections (the test users may have none: the empty state "No tasks assigned to you." is expected); `/alerts` shows Active and Resolved with severity icons and words, or the empty states. The dev data may contain no active alerts or tasks for the test users; say so in the report.

- [ ] **Step 3: Docs and merge** — set the Status line in `docs/navigation-redesign-design.md` to `Status: **Phases 1–3 built** (2026-10-08). Phase 4 (Stock polish) pending.` (keep the existing known-oddity and follow-up sentences); append a short "Phase 3" note in that doc's Phases section (My tasks sections and rules; Alerts read-only; bell badge counts the server's active total, red only for Critical).

```bash
git add docs
git commit -m "docs: mark tasks and alerts built"
git checkout main && git merge --no-ff feat/tasks-alerts -m "Merge feat/tasks-alerts: My tasks list, Alerts screen and Home bell" && git branch -d feat/tasks-alerts
```

---

## Self-review

- **Spec coverage:** `/tasks` list (today, overdue, done, plus later) from Home's Today card "All" (T2 Steps 2 and 4e); `/alerts` read-only with severity word and icon (T2 Step 3); bell with a count badge of open alerts (T2 Steps 1, 4b, 4d); badge red only for Critical (T1 `summarizeAlerts` + T2 header tone).
- **Placeholders:** none; the Home and Header edits are listed precisely, with lint catching only residual unused imports.
- **Type consistency:** `groupTasks`/`dueLabel`/`taskHref`/`sortAlerts`/`summarizeAlerts`/`levelWord`/`alertTypeLabel` match between Task 1 and Task 2; `FarmAlert`/`AlertLevel` are defined in T1 Step 2 before use; the Home and Alerts screens share the exact URL and key `['alerts','active']`.
- **Review Focus:** grouping, day and DST boundaries, href, sorting and the badge summary are pinned by Task 1 tests; the badge readability, pull-to-refresh time-box and null-after-logout are Task 2 steps.
