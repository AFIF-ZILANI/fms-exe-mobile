# 14 · Rate an Employee

> **Updated 2026-10-10 (redesign):** person card with this month's points and, once a rating is picked, where they will land ("-2 -> +1") · a Good work / A problem switch (green / red) · one list of ratings as radio rows with the points as a coloured badge on the right (the ones that need written notice, -4 and -5, sit greyed at the end with "Needs written notice (web)"; "Other" is gone because it needs an admin's approval) · Reason · the button says "Record +3 points". Switching the kind clears the choice.


**Route:** `src/app/(manager)/score.tsx` · **Tier:** Manager `[C score_employee]`
**Tab bar:** hidden

---

## Purpose

Record a point entry in under fifteen seconds, at the moment the thing happened.
**The quality of the whole payroll system depends on this being fast enough to
actually use.**

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Rate                              │  Header 56h
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ╭──╮ Rahim Hossain                 │ │  Subject bar  64h  primarySoft
│ │ │RH│ Worker · +7 this month     ▾  │ │
│ │ ╰──╯                               │ │
│ └────────────────────────────────────┘ │
│                                        │
│  POSITIVE                              │  eyebrow success
│  (+3 Attendance perfect)               │  Chips  40h  wrapping
│  (+3 Early problem report)             │
│  (+3 Suggestion implemented)           │
│  (+2 Zero negligent loss)              │
│  (+2 Accurate data entry)              │
│  (+2 Biosecurity followed)             │
│  (+2 Helped coworker)  (+2 Extra task) │
│  (+3 Team target)  (+2 Conflict resolved)│
│                                        │
│  NEGATIVE                              │  eyebrow critical  ↕24
│  (−5 Falsified record)                 │
│  (−5 Negligent loss)                   │
│  (−4 Biosecurity violation)            │
│  (−4 Concealed problem)                │
│  (−3 Missed critical task)             │
│  (−3 Equipment damage)  (−3 Conduct)   │
│  (−3 Team supervision)                 │
│  (−2 Unexcused absence)                │
│  (−2 Pattern lateness)                 │
│                                        │
│  ▭ Other…                              │  48h  → reveals stepper
│                                        │
│  REASON                                │
│ ┌────────────────────────────────────┐ │
│ │ Covered Karim's evening feed       │ │  88h
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉    Record +2 points         ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Close `✕` (this is a form), title "Rate" `h1`.

### Subject bar — `64h`, `primarySoft`

| Element | Spec |
| --- | --- |
| Container | `primarySoft` fill, `card` radius, `pad 12/16`, full width |
| Avatar | `40×40` circle, `surface` fill, initials `label` `primary` |
| Name | `bodyStrong` `ink`, `↔12` |
| Meta | `role · +7 this month` — `caption` `muted`, the signed total in `data` mono `success`/`critical` |
| Trailing | 20dp `chevron-down` `muted` — **only when the employee wasn't passed in** |

**When launched with `?employee_id=`** the bar is not tappable and has no
chevron. It is still shown, because a manager rating someone from a deep link
must be able to confirm *who* before committing points to their pay.

**When launched without one**, the bar reads "Pick someone" in `muted` and opens
the employee sheet on tap; the chips below are disabled until a person is chosen.

### Criterion chips — `40h`, wrapping

| Element | Spec |
| --- | --- |
| Section eyebrow | "POSITIVE" in `success`, "NEGATIVE" in `critical`. `↕12` below each. |
| Chip | `40h` (taller than the standard 36 — these are the primary targets on this screen), `pill` radius, `pad 0/14`, wrapping with `↔8` / `↕8` |
| Unselected | `surface` fill, 1px `line`, label `label` `inkSoft`. The point value is `data` mono `success`/`critical` and sits `↔6` before the criterion name. |
| Selected | `primarySoft` fill + 1px `primary` for positive; `tintRed` fill + 1px `critical` for negative. Label goes `ink`, value keeps its colour. |
| Selection | **Single-select across both groups.** Choosing a negative deselects a positive. |
| Point value | **Shown, never editable** — it's a server-side snapshot from `FIXED_CRITERION_POINTS`. |

**Positive-first ordering is deliberate.** The ledger is meant to be mostly a
record of good work, and a UI that surfaces penalties first quietly teaches the
opposite. Negative criteria are visually separated by a `↕24` gap and their own
red eyebrow, and are **never the default scroll position.**

### "Other…" — secondary button `48h`

Reveals an inline stepper block, `↕12` below:

```
┌────────────────────────────────────┐
│  POINTS                            │
│  ┌──┐   ┌──────────┐   ┌──┐        │  56×56 steppers, figure between
│  │ −│   │   +2     │   │ +│        │
│  └──┘   └──────────┘   └──┘        │
│  −5 to +5, not zero                │  caption muted
└────────────────────────────────────┘
```

- `surfaceAlt` fill, `card` radius, `pad 16`.
- Steppers `56×56`, `surface`, 1px `line`, `control` radius, 24dp `minus`/`plus`.
- Value `stat` mono, centred, `success`/`critical` by sign.
- **Range ±1..±5 excluding 0** — the server refines exactly this. Stepping
  through zero jumps `+1 → −1` and back; zero is never displayable.
- Opening "Other…" deselects any chosen chip, and choosing a chip collapses the
  stepper. They're the same field.

### Reason — `<TextField>` multiline `88h`

| Element | Spec |
| --- | --- |
| Eyebrow | "REASON" — **no "(optional)"**, because it isn't |
| Placeholder | "What happened?" |
| Validation | Required, non-blank after trim. Error: border 2px `critical`, `caption` `critical` "A reason is required." |

The server rejects blank. **Validate before enqueueing**, or the row
dead-letters for a reason the manager can't see and the points silently never
land.

### Submit bar

"Record +2 points" / "Record −3 points", signed and coloured to match. Falls
back to "Record points", disabled, until a criterion and a non-blank reason both
exist.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Subject bar shows a name skeleton when `?employee_id=` needs fetching. Chips render live — they're static constants, not an endpoint. |
| **Empty — no employees** | Employee sheet body: `users` tile `surfaceAlt`, "No employees yet." Only reachable when launched without an id. |
| **Stale** | The subject bar's "+7 this month" gets a `caption` "as of HH:MM" only if it's cached and the manager opened the screen cold. A stale MTD total doesn't change the rating decision, so it's the lightest possible treatment. |
| **Error** | Reason validation is the only inline error. A failed subject fetch falls back to the "Pick someone" state rather than blocking. |
| **Offline** | No change. Chips are constants; the write queues. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm if dirty → pop |
| Subject bar | `64h` | ⇧ employee sheet — only when no `?employee_id=` |
| Criterion chip | `40h` | Single-select; collapses the stepper |
| "Other…" | `48h` | Reveal the stepper; deselect chips |
| Stepper − / + | `56×56` | ±1, skipping zero, clamped to ±5 |
| Reason | `88h` | Focus, multiline |
| Submit | `52h` | Validate reason → queue → toast "Recorded +2 for Rahim" → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /employees` | Employee sheet, when no id was passed |
| `GET /performance-score-entries?employee_id&date_from` | The subject bar's MTD total |
| `POST /performance-score-entries` | The write |

`given_by_id` from the session. Criterion constants live in
`src/lib/criteria.ts`, mirroring the server's `FIXED_CRITERION_POINTS`.

---

## Notes

- **Fifteen seconds is the design constraint, not a nice-to-have.** Every
  decision on this screen serves it: chips instead of a picker, the value
  pre-attached to the criterion, the employee pre-filled from the deep link, one
  required text field. If a change adds a step here, it's the wrong change.
- **The point value is never editable on a fixed criterion.** A manager who can
  set "Helped coworker" to +5 has turned a shared scale into a personal one, and
  the payroll clamp stops meaning anything comparable between people.
- **`OTHER` is the only case revealing a points control** and it is bounded at
  ±5 — below the ±5 of the most serious fixed criteria, so an ad-hoc entry can
  never outweigh "Falsified record".
- The toast names the person: "Recorded +2 for Rahim". A manager rating three
  people in a row needs to see which one landed.
- Don't add a confirm dialog. It's an append-only ledger entry, a correction is
  a new offsetting entry, and a dialog on the fastest path in the app defeats
  the screen's only real requirement.
