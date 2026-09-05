# 10 · Log Environment Reading

**Route:** `src/app/log/environment.tsx` · **Tier:** Both · **Tab bar:** hidden

Uses the shared log-form spine specified in
[07 · Log mortality](07-log-mortality.md#the-shared-spine).

---

## Purpose

Record the five shed readings in one pass, without putting the phone down
between them.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Log environment                   │
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
│  TIME PERIOD                           │
│ (Morning)(Noon)(Afternoon)(Evening)    │  Wrapping pills, 7 options
│ (Night)(Midnight)(Late night)          │
│                                        │
│  READINGS                              │
│ ┌──────────────────────────┐ ┌───────┐ │
│ │ 🌡  31.2                 │ │  °C   │ │  64h  · in range
│ └──────────────────────────┘ └───────┘ │
│ ┌──────────────────────────┐ ┌───────┐ │
│ │ 💧  62                   │ │   %   │ │  64h  ↕8
│ └──────────────────────────┘ └───────┘ │
│ ┌──────────────────────────┐ ┌───────┐ │
│ │ ☁  24                    │ │ ppm   │ │  64h  · OUT OF RANGE
│ └──────────────────────────┘ └───────┘ │
│  ⚠ Ammonia above 20 ppm                │  caption critical
│ ┌──────────────────────────┐ ┌───────┐ │
│ │ ○  1,800                 │ │ ppm   │ │  64h
│ └──────────────────────────┘ └───────┘ │
│ ┌──────────────────────────┐ ┌───────┐ │
│ │ ⌁  1,013                 │ │ hPa   │ │  64h
│ └──────────────────────────┘ └───────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Record 5 readings          ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Time period — `<SegmentedToggle>` `44h`

| Element | Spec |
| --- | --- |
| Eyebrow | "TIME PERIOD" |
| Container | `44h`, `pill` radius, `surfaceAlt` fill, 3dp inner padding, full width |
| Segments | **Seven**, not three: Morning · Noon · Afternoon · Evening · Night · Midnight · Late night, matching the server's `time_period` enum. Rendered as a wrapping `<PillSelect>` rather than a segmented bar, which cannot fit seven. |
| Default | From the device clock. **Overridable**, because a reading taken at noon may be logged at four. |

### Readings — five `<NumberField>` rows, `64h` each, `↕8` apart

One stacked column, **not a grid.** A 2-up grid halves the field width, which
halves the mono digits' legibility, to save 160dp of scroll on a screen nobody
scrolls quickly.

| # | Icon | Field | Unit | Keyboard | Normal range |
| --- | --- | --- | --- | --- | --- |
| 1 | `thermometer` | Temperature | °C | decimal | 18–34 |
| 2 | `droplet` | Humidity | % | number | 40–70 |
| 3 | `cloud` | Ammonia | ppm | number | 0–20 |
| 4 | `circle` | CO₂ | ppm | number | 0–3,000 |
| 5 | `activity` | Pressure | hPa | number | 950–1,050 |

| Element | Spec |
| --- | --- |
| Icon | 20dp `muted`, inside the field's leading edge, `↔12` before the value |
| Value | `figure` mono `ink`, flex |
| Unit | Fixed `72×64` block, `surfaceAlt`, `body` `muted`, centred. Static suffix, not a picker. |
| First field | **Temperature is focused on mount.** |
| Keyboard `next` | Each field's return key advances to the next reading; the fifth submits. This is the one form where keyboard chaining matters — five fields in a row with gloves on. |

### Out-of-range treatment

A value outside its normal range is **not an error** — it's the reading, and the
reading is the point.

| Element | Spec |
| --- | --- |
| Field border | 2px `critical` |
| Value colour | stays `ink` — the number is not wrong, the condition is |
| Helper | `caption` `critical`, `↕6`: "⚠ Ammonia above 20 ppm" with a 16dp `alert-triangle` |
| Submit | Unaffected. Enabled, same label. |

**No confirm dialog.** Unlike mortality, an out-of-range environment reading has
no destructive side effect and is frequently the whole reason someone opened the
form.

### Partial readings

**All five are required** — the server's schema demands every field, so submit
stays disabled until all five are filled. The label still counts progress
("Record 3 of 5 readings") so the worker can see what's missing.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Per the spine. The segmented toggle and all five fields render live. |
| **Empty — no batch** | Spine's `tintRed` resolver, submit disabled. |
| **Stale** | Spine treatment. Ranges are static constants, so nothing else degrades. |
| **Error** | Field-level per the spine. |
| **Offline** | No change. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Time segment | `38h` in a `44h` bar | Select |
| Reading field ×5 | `64h` | Focus; return advances to the next |
| Submit | `52h` | Queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /batch-house-balances?house_id=X` | Batch resolver |
| `POST /environment-records` | The write |

`recorded_by_id` from the session. `time_period` is the segmented value.

---

## Notes

- **Five readings, one column, one submit.** The temptation is to split this into
  a wizard or a grid. Both are worse: a worker walks the shed once with the
  phone, and the form should match that walk.
- **Normal ranges are display constants, not server validation.** They live in
  `src/lib/farm.ts` beside the growth curve. If a farm's ranges differ, that's a
  constant to change, not a schema migration.
- Ammonia is the reading that matters most and the one workers skip — it's third
  in the column rather than last for exactly that reason.
- Don't auto-fill any reading from a previous entry. A pre-filled 31.2 that
  nobody re-measured is worse than a blank field, and it will be submitted.
