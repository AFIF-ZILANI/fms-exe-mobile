# 06 · Task Detail

**Route:** `src/app/tasks/[id].tsx` · **Tier:** Both · **Tab bar:** hidden

---

## Purpose

One task, and the one thing to do about it.

---

## Frame

### Routable type — has a matching form

```
┌────────────────────────────────────────┐
│  ‹   Task                              │  Header 56h
├────────────────────────────────────────┤
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ ▢  Environment reading             │ │  Task card
│ │    (● Pending)                     │ │
│ │  ────────────────────────────────  │ │
│ │  Check temp, humidity and ammonia  │ │
│ │  before the morning feed.          │ │
│ │  ────────────────────────────────  │ │
│ │  Where      House 2                │ │
│ │  Due        Today 09:00 · in 2h    │ │
│ │  Assigned   Karim Mia · 5 Sep      │ │
│ │  Type       ENVIRONMENT            │ │
│ ╰────────────────────────────────────╯ │
│                                        │
│                                        │
├────────────────────────────────────────┤
│  ▉▉▉  Open environment form      ▉▉▉  │  Submit bar
│         Cancel task            [C]     │
└────────────────────────────────────────┘
```

### No type, or an unrecognised one — mark-done branch

```
│ ╭────────────────────────────────────╮ │
│ │ ▢  Fix water line                  │ │
│ │    (● Pending)                     │ │
│ │  ────────────────────────────────  │ │
│ │  Where      Front gate             │ │
│ │  Due        Today 14:00            │ │
│ │  Assigned   Karim Mia · 5 Sep      │ │
│ ╰────────────────────────────────────╯ │
│                                        │
│  Completion note                       │
│ ┌────────────────────────────────────┐ │
│ │ Optional                           │ │  104h textarea
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Mark done                  ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Back button, title "Task" `h1`. Deliberately generic — the task's own title is
the first thing in the card below, at a size that can wrap to two lines. Putting
a long task title in a truncating header loses the half that matters.

### Task card

| Element | Spec |
| --- | --- |
| Container | Card, `pad 16` |
| Icon | `▢` `40×40` tinted tile matching the task type's domain; `surfaceAlt` with a `check-square` icon when the task has no type |
| Title | `h2` `ink`, `↔12` from the tile, wraps to two lines |
| Status | `<StatusPill>` `↕8` under the title: "● Pending" `warning`, "● Done" `neutral`, "● Cancelled" `neutral`, "● Overdue" `critical` |
| Divider | 1px `line`, `↕16` above and below, omitted when there's no description |
| Description | `body` `inkSoft`, full text, never truncated |
| Divider | 1px `line`, `↕16` |
| Detail rows | Label/value pairs, `28h` each, `↕4` apart |

**Detail rows** — label column 88dp, `label` `muted`; value column flex,
`body` `ink`:

| Label | Value |
| --- | --- |
| Where | House name, or `location_note`. Never both — the server makes them mutually exclusive. |
| Due | `Today 09:00 · in 2h`. Date in `data` mono, relative part `caption`. Goes `critical` and reads "· 3h overdue" when past. |
| Assigned | `assigned_by.name · date` |
| Type | The `TaskType.code` in `data` mono `muted`. **Row omitted when the task has no type.** |

### Completion note — mark-done branch only

Standard `<TextField>` in multiline mode: `104h`, `surfaceAlt`, `control`
radius, placeholder "Optional". Label "Completion note" above in `label`
`muted`. `↕16` below the card.

### Submit bar

| Branch | Primary | Secondary |
| --- | --- | --- |
| Routable type, pending | `52h` "Open environment form" — the verb names the destination, and the form name matches the sheet row it corresponds to | Ghost `44h` "Cancel task" `[C assign_task]` in `critical` |
| No type, pending | `52h` "Mark done" | Ghost `44h` "Cancel task" `[C]` |
| Done or cancelled | No submit bar at all. The screen becomes read-only and the tab bar returns. |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Header renders. Card renders its frame with a `200×26` title skeleton and four `28h` detail-row skeletons. Submit bar renders disabled with its generic label. |
| **Empty** | Not applicable — this screen always has one task or an error. |
| **Stale** | `caption` `muted` "as of HH:MM" under the status pill. A stale *task* barely matters; a stale *status* does, because the person may have completed it on another device. |
| **Error — not found** | Full-screen `<EmptyState>`: `alert-circle` in `tintRed`, "This task is gone.", "It may have been cancelled.", "Back to dashboard" secondary button. A 404 here is normal — managers cancel tasks. |
| **Error — load failed** | Full-screen state with "Couldn't load this task." and a "Retry" button. |
| **Offline** | Renders from cache if present. If the task isn't cached, the not-found state's copy changes to "Not available offline." **Mark done still works** — it queues like any other write. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop |
| "Open … form" | `52h` | → the mapped form, deep-linked with `house_id`, `batch_id` and `task_id`. Completing that form marks this task done in the same queued batch. |
| "Mark done" | `52h` | Queue `POST /task-assignments/:id/complete` with the note, toast "Marked done · will sync", pop |
| "Cancel task" `[C]` | `44h` | Confirm dialog "Cancel this task?" → queue `POST /task-assignments/:id/cancel`, pop |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /task-assignments/:id` | Everything on the screen |
| `POST /task-assignments/:id/complete` | Mark done |
| `POST /task-assignments/:id/cancel` | Cancel `[C]` |

Task-type → form mapping lives in `src/lib/task-forms.ts`.

---

## Notes

- **This is where the unknown-`TaskType` fallback surfaces.** A `TaskType.code`
  that isn't a key in `TASK_FORMS` renders the mark-done branch with the code as
  a plain label in the Type row. The worker still knows what was asked, and
  nothing errors. That fallback is what makes a DB-stored type list safe: the
  server can gain a type before the app release that handles it.
- **Never render a disabled "Open form" button for an unknown type.** Fall
  through to mark-done. A disabled primary action with no explanation is the
  worst of both branches.
- The tab bar is hidden because the submit bar owns the bottom. When the task is
  already done or cancelled there is no submit bar, so the tab bar returns —
  this is the one screen in the app whose bottom chrome depends on data.
- Cancel is `critical`-coloured but is a **ghost** button, not a filled one.
  Filled red at the thumb position is how a task gets cancelled by accident.
