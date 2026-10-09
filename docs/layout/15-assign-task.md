# 15 · Assign a Task

> **Updated 2026-10-09 (Assign redesign):** "Assign to" is always shown (prefilled from a person's page, changeable, any role) · Task with its kind in plain words · Title (what the worker sees) · Notes · Where (House / Somewhere else) · Due with one-tap chips (In 1 hour, Today 6 PM while it is still sensible, Tomorrow 8 AM) above a field that opens the date then the time dialog (Android) · inline error and a disabled button when the time is not in the future (also re-checked at send) · a Preview of how it will look on the worker's list · button says "Assign to <full name>". Fixed: the Android due picker was an undismissable dialog; closing or sending a form opened by a deep link crashed with "GO_BACK was not handled" (all forms now use `goBack()` in `lib/nav.ts`).


**Route:** `src/app/(manager)/assign.tsx` · **Tier:** Manager `[C assign_task]`
**Tab bar:** hidden

---

## Purpose

Put work on someone's dashboard.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Assign a task                     │
├────────────────────────────────────────┤
│  WHO                                   │
│ ┌────────────────────────────────────┐ │
│ │ ╭──╮ Rahim Hossain              ▾  │ │  52h
│ │ ╰──╯                               │ │
│ └────────────────────────────────────┘ │
│                                        │
│  TASK                                  │
│ ┌────────────────────────────────────┐ │
│ │ Morning environment reading     ▾  │ │  52h
│ └────────────────────────────────────┘ │
│  Opens the environment form         ⓘ  │  caption info
│                                        │
│  TITLE                                 │
│ ┌────────────────────────────────────┐ │
│ │ Morning environment reading        │ │  52h  prefilled, editable
│ └────────────────────────────────────┘ │
│                                        │
│  DESCRIPTION (OPTIONAL)                │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  88h
│ └────────────────────────────────────┘ │
│                                        │
│  WHERE                                 │
│  ( House )            ( Other )        │  Segmented 44h
│ ┌────────────────────────────────────┐ │
│ │ House 2                         ▾  │ │  52h  swaps by toggle
│ └────────────────────────────────────┘ │
│                                        │
│  DUE                                   │
│ ┌──────────────────┐ ┌───────────────┐ │
│ │ Today · 6 Sep  ▾ │ │  09:00     ▾  │ │  52h + 52h
│ └──────────────────┘ └───────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Assign to Rahim            ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Employee picker — `<PickerField>` `52h`

Eyebrow "WHO". Value shows a `28×28` initials circle `↔8` before the name.
Sheet rows `64h` with initials, name, role, and today's task count in `caption`
`muted` — a manager assigning work wants to see who's already loaded.

**Prefilled and still editable** when launched with `?employee_id=`.

### Task picker — `<PickerField>` `52h`

| Element | Spec |
| --- | --- |
| Eyebrow | "TASK" |
| Sheet | `64h` rows: task label `bodyStrong` `ink`, its `TaskType.code` in `data` mono `muted` beneath, or "No form" in `muted` when `task_type_id` is null |
| Source | `GET /tasks?active=true` |

### Form hint — `caption`, `↕6`

| Case | Copy | Colour |
| --- | --- | --- |
| Type maps to a form | "Opens the environment form" with 16dp `info` icon | `info` |
| Type doesn't map, or is null | "Marked done by hand — no form." | `muted` |

This tells the manager what the worker will actually see. Assigning a
"Clean waterers" task and expecting a form is the misunderstanding this line
prevents.

### Title — `<TextField>` `52h`

Eyebrow "TITLE". **Prefilled from the selected task's label, and editable** —
"Morning environment reading" becomes "Morning environment reading — new
thermometer" without creating a new task in the catalogue.

Changing the task picker overwrites the title **only if the manager hasn't
edited it**. Once touched, it's theirs.

### Description — `<TextField>` multiline `88h`, optional

### Where — `<SegmentedToggle>` `44h` + a swapping field

| Segment | Field below |
| --- | --- |
| House | `<PickerField>` `52h`, active houses, sends `house_id` |
| Other | `<TextField>` `52h`, placeholder "Front gate, feed store…", sends `location_note` |

**The toggle is the UI expression of the server's rule that `house_id` and
`location_note` are mutually exclusive.** Making it a toggle means the invalid
combination *can't be expressed*, rather than being caught at POST.

Switching segments **clears the other field's value** — carrying a stale
`location_note` behind a House selection is exactly the state the toggle exists
to prevent.

### Due — date `52h` + time `52h`, `↔8`

| Element | Spec |
| --- | --- |
| Date | Flex, reads "Today · 6 Sep" or "Tue · 8 Sep". `minimumDate` today — you can't assign work into the past. |
| Time | Fixed `120×52`, `data` mono value, platform time picker, 15-minute granularity |
| Defaults | Today, and the next quarter-hour at least 30 minutes out |

### Submit bar

"Assign to Rahim" — names the person, because that's the consequential half.
Falls back to "Assign task", disabled, until who / task / title / where are all
set.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Pickers render with skeleton values; their sheets show 4 skeleton rows. |
| **Empty — no employees** | Employee sheet: "No employees yet." Submit stays disabled. |
| **Empty — no tasks** | Task sheet: `check-square` tile `surfaceAlt`, "No tasks defined.", "Tasks are set up in the admin dashboard." This blocks the form — say so rather than showing an empty list. |
| **Stale** | No treatment. Nothing on this screen is a decision-driving figure. |
| **Error** | Field-level. A failed task list shows the empty-with-explanation state above. |
| **Offline** | No change; the write queues. Both lists come from cache. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm if dirty → pop |
| Who | `52h` | ⇧ employee sheet |
| Task | `52h` | ⇧ task sheet; prefills title, sets the form hint |
| Title | `52h` | Focus; marks the title as manually edited |
| Where toggle | `44h` | Swap the field below, clear the other value |
| House / Other field | `52h` | ⇧ house sheet, or focus the text field |
| Date | `52h` | Platform date picker, `minimumDate` today |
| Time | `52h` | Platform time picker |
| Submit | `52h` | Queue → toast "Assigned to Rahim" → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /employees` | Who |
| `GET /tasks?active=true` | Task, and its `TaskType` for the hint |
| `GET /houses?active=true` | Where → House |
| `POST /task-assignments` | The write |

`assigned_by_id` from the session.

---

## Notes

- **Three levels, all backed by the server:** `TaskType` (which screen this
  opens) → `Tasks` (the catalogue) → `EmployeeTaskAssignment` (the actual work).
  This screen creates the third from the second.
- `Tasks.task_type_id` is nullable — a task with no type ("Fix water line") is a
  plain mark-done item, and the form hint says so.
- **No recurring assignments in v1.** Managers create each one. Don't add a
  "repeat daily" toggle; there's no server support and a fake one produces
  tasks that silently stop appearing.
- The due-time default of "next quarter-hour, at least 30 minutes out" exists so
  a manager can assign without touching the time picker at all in the common
  case.
