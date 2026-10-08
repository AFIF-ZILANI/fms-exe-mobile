# 13 · Employee Detail

> **Updated 2026-10-08 (member page redesign):** photo header (shared with Profile) · Rate / Assign · three stat cards (Points this month, Done today, Overdue) · Assigned tasks as one card each (late first, then today, coming up, finished today; icon by state, due day and time, house name, Overdue/Done pill; four shown, "Show all") · Points as one card each (coloured badge, criterion, reason, who gave it and when; month total in the heading; four shown, "Show all") · Contact (tap to call or write) · probation end when on probation. Pull to refresh. Fixed: overdue tasks from earlier days were invisible; history dates read "Invalid date" (the server field is `incident_date`); totals now count settled (ACTIVE) entries only, like payroll does.


**Route:** `src/app/(tabs)/(manager)/team/[employeeId].tsx`
**Tier:** Manager `[C assign_task]`

---

## Purpose

One person: what they're on right now, and their record.

---

## Frame

```
┌────────────────────────────────────────┐
│  ‹   Rahim Hossain                     │  Header 56h
├────────────────────────────────────────┤
│                                        │
│ ╭────────────────────────────────────╮ │
│ │  ╭────╮  Rahim Hossain             │ │  Profile card
│ │  │ RH │  Worker · joined 12 Mar 25 │ │
│ │  ╰────╯  01712 345678              │ │
│ │  ────────────────────────────────  │ │
│ │        +7            2 of 3        │ │  Inline stat pair
│ │      POINTS · SEP   TASKS TODAY    │ │
│ ╰────────────────────────────────────╯ │
│                                        │
│ ┌──────────────────┐ ┌───────────────┐ │
│ │ ▉ Rate           │ │ ▭ Assign task │ │  Action row  52h
│ └──────────────────┘ └───────────────┘ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ TODAY'S TASKS                  2/3 │ │
│ ├────┬───────────────────────────────┤ │
│ │ H2 │ Environment reading           │ │
│ │    │ 09:00        (● Done)         │ │
│ ├────┼───────────────────────────────┤ │
│ │ H3 │ Weigh sample                  │ │
│ │    │ 11:00  (● Pending)         ›  │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ SCORE HISTORY            Sep 2026 ▾│ │
│ ├────┬───────────────────────────────┤ │
│ │ +3 │ Attendance perfect      1 SEP │ │
│ │    │ "Full month, no lateness"     │ │
│ │    │ You                           │ │
│ ├────┼───────────────────────────────┤ │
│ │ −2 │ Pattern lateness       20 SEP │ │
│ │    │ Karim · Manager               │ │
│ ╰────┴───────────────────────────────╯ │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Back button, employee name `h1` truncating. No trailing action — the two
actions are body buttons, because they're the point of the screen and deserve
more than a 44dp icon.

### Profile card

| Element | Spec |
| --- | --- |
| Avatar | `56×56` circle, `primarySoft`, initials `h2` `primary` |
| Name | `h2` `ink`, `↔16` from the avatar |
| Meta 1 | `role · joined 12 Mar 25`, `caption` `muted` |
| Meta 2 | Mobile number, `data` mono `muted` |
| Divider | 1px `line`, `↕16` above and below |
| Stat pair | Two equal halves, no fill, no tile — a divider-separated pair inside the card rather than two `<StatCard>`s. Figures `stat` mono, eyebrows below in `muted`, both centred in their half. A 1px `line` runs vertically between them. |
| Points colour | `success` / `critical` / `ink` at zero |
| Tasks colour | Always `ink` — a ratio isn't a judgement |

The stat pair is deliberately *not* two tinted cards. This card already carries
the person's identity; stacking tinted blocks inside it makes a card-in-a-card,
which the design system forbids.

### Action row — two buttons, `↔12`

| Button | Variant | Label | Action |
| --- | --- | --- | --- |
| Rate | Primary `52h`, flex 1 | "Rate" | → `/score?employee_id=` |
| Assign task | Secondary `52h`, flex 1 | "Assign task" | → `/assign?employee_id=` |

Rate is primary because it's the action that decays if it isn't instant — a
manager who has to navigate three levels to record "helped a coworker" records
it never, and the point ledger degrades into month-end guesswork.

### Today's tasks card

| Element | Spec |
| --- | --- |
| Header | Eyebrow "TODAY'S TASKS", trailing ratio `data` mono `muted` |
| Gutter | House token, or `—` |
| Line 1 | Task title `bodyStrong` `ink`, `inkSoft` when done |
| Line 2 | Due time `data` mono `muted` + `<StatusPill>` |
| Chevron | Pending rows only |
| Empty | `<EmptyState>` in the card body: "Nothing assigned today.", with an "Assign a task" ghost button |

### Score history card

| Element | Spec |
| --- | --- |
| Header | Eyebrow "SCORE HISTORY", trailing month chip `36h` (same control as [03](03-my-performance.md)) |
| Rows | Identical to [03 · My performance](03-my-performance.md#score-history-card) — signed points in the gutter, criterion, reason, attributor |
| Attribution | Entries the current manager gave read **"You"** instead of their own name. It's the difference between reading a record and auditing one. |
| Max rows | 6, then a "See all" ghost row at `44h` |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Profile card renders its frame with name and avatar skeletons; the stat pair shows two `48×28` skeletons. Action row renders live and enabled — rating someone doesn't require their history to have loaded. |
| **Empty — no tasks today** | Card body empty state with an assign shortcut. |
| **Empty — no score entries** | Score card body: `award` tile `tintAmber`, "No entries this month.", "Tap Rate to add one." |
| **Stale** | "as of HH:MM" `caption` `muted` under the stat pair. |
| **Error** | Profile card failing takes the screen — without a name this page is meaningless. The two list cards degrade independently with Retry. |
| **Offline** | Stale treatment. **Both actions stay enabled** — scoring and assigning queue like any other write. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop to `/team` |
| Rate | `52h` | → `/score?employee_id=` |
| Assign task | `52h` | → `/assign?employee_id=` |
| Task row (pending) | `64h` | → `/tasks/[id]` |
| Month chip | `36h` | ⇧ month sheet, scoped to this card |
| "See all" | `44h` | Expand the card in place — no separate screen |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /employees/:id` | Profile card |
| `GET /task-assignments?employee_id` | Tasks card, ratio |
| `GET /performance-score-entries?employee_id` | Score history, points stat |

---

## Notes

- **This screen and [03 · My performance](03-my-performance.md) are the same
  data with different framing.** Don't merge them into one component with a
  `viewerIsSelf` prop — the actions, the hero treatment and the payroll section
  all differ, and the merged component would be mostly branches.
- **No payroll section here.** A manager sees points, not pay. Payroll is the
  employee's own business and the Admin's; putting a colleague's salary on this
  screen is a privacy problem the app doesn't need.
- The "You" attribution matters more than it looks. A manager scanning a history
  needs to know which entries are their own judgement and which are a
  colleague's before deciding whether to add another.
- Both action buttons pass `?employee_id=`, so neither destination shows its own
  employee picker. That's the two-taps-from-anywhere path the scoring loop
  depends on.
