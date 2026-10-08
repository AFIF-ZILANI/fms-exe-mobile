# 12 · Team

> **Updated 2026-10-08 (Team redesign):** three stat cards (On shift, Tasks done, Overdue) · filter chips with counts (All, Overdue, Open, Done) · one card per person: photo or initials, role, what is left today ("1 overdue" in red, "2 left today", "All done"), a progress bar of today's tasks (amber once anything is overdue) and this month's points · pull to refresh. Most overdue first. The same per-person sums feed Home's Team card (`lib/team-view.ts`).


**Route:** `src/app/(tabs)/(manager)/team/index.tsx` · **Tab:** Team
**Tier:** Manager `[C assign_task]`

---

## Purpose

Who's working, and how they're doing. The screen a manager opens to decide who
needs attention today.

---

## Frame

```
┌────────────────────────────────────────┐
│  Team                            ＋⃝    │  Header 56h + assign action
├────────────────────────────────────────┤
│                                        │
│ ┌──────────────┐  ┌──────────────┐    │
│ │ ▢ tintGreen  │  │ ▢ tintAmber  │    │  Stat row
│ │ 6            │  │ 11/18        │    │
│ │ ON SHIFT     │  │ TASKS DONE   │    │
│ └──────────────┘  └──────────────┘    │
│                                        │
│ ╭────────────────────────────────────╮ │
│ ├────┬───────────────────────────────┤ │
│ │(KM)│ Karim Mia                     │ │
│ │    │ Worker · 0 of 2       (−2) ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │(RH)│ Rahim Hossain                 │ │
│ │    │ Worker · 2 of 3       (+7) ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │(SA)│ Sabina Akter                  │ │
│ │    │ Worker · 3 of 3       (+4) ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │(NI)│ Nasir Islam                   │ │
│ │    │ Worker · no tasks      (0) ›  │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

| Element | Spec |
| --- | --- |
| Title | "Team" `h1` `ink` |
| Trailing | `44×44` icon button, 24dp `user-plus` `ink` → `/assign`. Assigning work is the action a manager comes here to take. |

Tab root — no back button.

### Stat row — two cards, `↔12`

| Card | Tint | Figure | Eyebrow |
| --- | --- | --- | --- |
| On shift | `tintGreen` | Count of employees with ≥ 1 task today | "ON SHIFT" |
| Tasks done | `tintAmber` | `11/18` — completed over assigned, today, across the team | "TASKS DONE" |

Neither is tappable. The ratio figure is mono; the slash is part of the mono
run so the two numbers align with each other.

### Team rows — `<LedgerRow>` `64h`

| Element | Spec |
| --- | --- |
| Gutter | Initials in a `32×32` `primarySoft` circle, `data` `primary`, centred |
| Line 1 | Name `bodyStrong` `ink` |
| Line 2 | `role · 2 of 3` — role `caption` `muted`, ratio `data` mono. "no tasks" in `muted` when none assigned today. |
| Trailing | `<ScoreChip>` — month-to-date signed points, `pill`, `36h`, `primarySoft` fill for positive / `tintRed` for negative / `surfaceAlt` for zero, label `figure` mono in `success`/`critical`/`muted` |
| Chevron | 20dp `muted` after the chip |
| Order | **Pending tasks descending** — the people needing attention float up. Ties break alphabetically. |

A worker with 0 of 2 done sorts above one with 3 of 3, which is the whole point
of the ordering.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Stat cards show `48×28` skeletons. List shows 5 skeleton rows at `64h`. |
| **Empty — no employees** | Full-card `<EmptyState>`: `users` tile in `surfaceAlt`, "No employees yet.", "People are added in the admin dashboard." No action button. |
| **Stale** | `caption` `muted` "as of 08:15" directly under the stat row, one line for the screen. |
| **Error** | Stat row and list fail independently. The list's failure shows `alert-circle` `critical`, "Couldn't load the team.", "Retry". |
| **Offline** | Stale treatment. Rows stay navigable from cache. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Assign action | `44×44` | → `/assign` |
| Team row | `64h` | → `/team/[employeeId]` |
| Centre tab button | `58×58` | ⇧ log sheet (Manager rows included) |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /employees` | Rows |
| `GET /task-assignments?employee_id&due_to=today` | Ratios, "on shift", "tasks done" |
| `GET /performance-score-entries?employee_id&date_from` | Score chips |

The per-employee queries fan out. For a farm-sized team that's fine; if the list
ever paginates, the ratio and chip columns must degrade to a skeleton per row
rather than blocking the list.

---

## Notes

- **Sorted by need, not by name.** A manager scanning this list is looking for
  the person who hasn't done anything today. Alphabetical order hides them in
  the middle.
- The score chip on this screen and the one on [13 · Employee
  detail](13-employee-detail.md) must agree exactly — same month window, same
  clamp, same rounding. They come from the same query.
- **Managers see others' scores here; Workers see only their own** on
  [03 · My performance](03-my-performance.md). The split is capability-driven,
  not two components.
- Don't add a "message" or "call" affordance. There's no messaging in this
  product and a `tel:` link on a farm where everyone is within shouting distance
  is decoration.
