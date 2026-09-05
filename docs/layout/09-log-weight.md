# 09 · Log Weight Sample

**Route:** `src/app/log/weight.tsx` · **Tier:** Both · **Tab bar:** hidden

Uses the shared log-form spine specified in
[07 · Log mortality](07-log-mortality.md#the-shared-spine).

---

## Purpose

Record the average weight of a sample of birds — the number the whole growth
curve is built from.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Log weight                        │
├────────────────────────────────────────┤
│  HOUSE                                 │
│ ┌────────────────────────────────────┐ │
│ │ House 2                         ▾  │ │  52h
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ B-24 · Cobb 500 · d21              │ │  64h  tintGreen
│ │ 4,812 live birds                   │ │
│ └────────────────────────────────────┘ │
│                                        │
│  AVERAGE WEIGHT                        │
│ ┌────────────────────────┐ ┌─────────┐ │
│ │  1,840                 │ │    g    │ │  64h + fixed unit
│ └────────────────────────┘ └─────────┘ │
│  Target at d21: ~1,750 g            ✓  │  caption success
│                                        │
│  SAMPLE SIZE                           │
│ ┌────────────────────────────────────┐ │
│ │  50                       birds    │ │  64h
│ └────────────────────────────────────┘ │
│                                        │
│  DATE                                  │
│ ┌────────────────────────────────────┐ │
│ │ Today · 6 Sep 2026              ▾  │ │  52h
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ⚠ Already logged for House 2 today │ │  Duplicate warning (conditional)
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉   Record 1,840 g average    ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Average weight — `<NumberField>` `64h` + fixed unit

| Element | Spec |
| --- | --- |
| Eyebrow | "AVERAGE WEIGHT" |
| Input | Flex, `64h`, `figure` mono, `keyboardType="decimal-pad"`. **Focused on mount.** |
| Unit | Fixed `64×64` block reading "g", `surfaceAlt`, `control` radius, `body` `muted`, centred. **Not a picker** — the server stores grams and there is no second unit. It's a suffix, styled to match the unit picker on [08](08-log-consumption.md) so the two forms feel related. |
| Thousands | Grouped as the worker types (`1,840`). The grouping is display-only; the submitted value is unformatted. |

### Growth-curve hint — `caption`, `↕6`

Compares the entered weight against the breed's expected weight for the current
day-of-cycle.

| Case | Copy | Colour |
| --- | --- | --- |
| Within ±10% of target | "Target at d21: ~1,750 g ✓" | `success` |
| Outside ±10% | "⚠ Target at d21 is ~1,750 g. That's 22% under." | `warning` |
| No curve for this breed | "No growth curve for Cobb 500." | `muted` |
| Nothing entered | Line omitted | — |

Never blocks. A genuinely underweight flock is the most important thing this
form can tell anyone, and an app that refuses to record it is useless.

### Sample size — `<NumberField>` `64h`

Eyebrow "SAMPLE SIZE". Trailing suffix "birds" in `body` `muted` inside the
field, right-aligned. `keyboardType="number-pad"`. Common values are 30–100; no
stepper, no validation beyond "greater than zero".

### Date field and duplicate warning

Standard date field. Below it, **conditionally**, a `tintAmber` inset:

```
┌────────────────────────────────────┐
│ ⚠ Already logged for House 2 today │  48h · tintAmber · card radius
│   Submitting adds a second record. │
└────────────────────────────────────┘
```

Shown when a `WeightRecord` already exists for this `batch_id` + `house_id` +
`date`. `pad 12/16`, 20dp `alert-triangle` `warning`, copy `caption` `ink`.

**Submit stays enabled and the confirm dialog fires on tap:** "Log a second
weight for House 2 today?" / "The server allows one per house per day. This one
may fail to send." / "Record anyway" / "Cancel".

### Submit bar

"Record 1,840 g average", falling back to "Record weight".

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Per the spine. |
| **Empty — no batch** | Spine's `tintRed` resolver, submit disabled. |
| **Stale** | Spine treatment. The duplicate check runs against cached records, so its warning may be a false negative offline — the copy is a warning, not a guarantee, and worded accordingly. |
| **Error** | Field-level per the spine. |
| **Offline** | No change. The duplicate warning still fires from cache when it can. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Weight input | `64h` | Focus on mount, decimal keypad |
| Sample size | `64h` | Focus, number keypad |
| Date field | `52h` | Platform date picker, `maximumDate` today |
| Submit | `52h` | Validate → duplicate confirm if needed → queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /batch-house-balances?house_id=X` | Batch resolver |
| `GET /weight-records?house_id&date` | Duplicate check |
| `POST /weight-records` | The write |

`measured_by_id` from the session.

---

## Notes

- **The server enforces `@@unique([batch_id, house_id, date])`** — one sample per
  house per day. `date` must be submitted **truncated to midnight** or the
  constraint never actually bites and duplicates accumulate silently.
- **There is no update endpoint for `WeightRecord`** (create + list only). A
  same-day duplicate can't be "replaced" — it surfaces through the outbox's
  normal dead-letter path instead. That's why the warning above is worded "may
  fail to send" rather than "will be replaced".
- The dead-letter case is the one place a worker sees a rejected write. The
  outbox review sheet must show the reason plainly ("A weight for House 2 on 6
  Sep already exists") rather than the raw 409.
- Don't offer an "edit today's sample" affordance. The ledger is append-only and
  there is no endpoint; the affordance would be a lie.
