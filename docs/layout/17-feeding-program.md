# 17 · Feeding Program

**Route:** `src/app/(manager)/feeding-program.tsx`
**Tier:** Manager `[C feeding_program]` · **Tab bar:** hidden

---

## Purpose

Which feed a batch gets, on which days of its cycle.

---

## Frame

```
┌────────────────────────────────────────┐
│  ‹   Feeding program                   │  Header 56h · back, not close
├────────────────────────────────────────┤
│  BATCH                                 │
│ ┌────────────────────────────────────┐ │
│ │ B-24 · Cobb 500 · d21           ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ PROGRAM                            │ │  Timeline card
│ │                                    │ │
│ │  d0 ──────────────────────── d35   │ │
│ │  ▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓   │ │  24h bar
│ │        ▲ today d21                 │ │
│ │                                    │ │
│ ├────┬───────────────────────────────┤ │
│ │0–10│ Pre-starter                   │ │
│ │    │ Nourish PS-1              ⋯   │ │
│ ├────┼───────────────────────────────┤ │
│ │11–24│ Starter          (● Current) │ │
│ │    │ Nourish ST-2              ⋯   │ │
│ ├────┼───────────────────────────────┤ │
│ │25– │ Grower                        │ │
│ │    │ Nourish GR-3              ⋯   │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
│  ▭  Add a phase                        │  48h secondary
│                                        │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

The add form is a bottom sheet, not an inline section — see below.

---

## Anatomy

### Header — `56h`

Back chevron, **not a close ✕**. This screen is a viewer with an editing
affordance, not a form; nothing is lost by leaving it.

### Batch picker — `<PickerField>` `52h`

Same control as [16 · House transfer](16-house-transfer.md#batch-picker--pickerfield-52h).
Changing the batch reloads the whole card.

### Timeline bar — `24h`

| Element | Spec |
| --- | --- |
| Container | Full card width, `24h`, `pill` radius, `surfaceAlt` fill |
| Segments | One per phase, width proportional to its day span, `primary` at descending opacity (100% / 75% / 55%) so adjacent phases separate without a second colour |
| Dividers | 2px `surface` gaps between segments |
| Today marker | 2px `ink` vertical line at `day ÷ expected_days`, with a 16dp `▲` and "today d21" in `caption` `ink` below |
| Axis labels | "d0" and "d35" in `data` mono `muted`, `↕4` above the bar |
| Gaps | A day range no phase covers renders as `tintRed` fill in the bar |
| Overlaps | Overlapping phases render the overlap in `tintAmber` with a 1px `warning` border |

The bar is the whole reason this screen exists as a screen rather than a list —
a gap on day 12 is invisible in three rows of text and obvious in one bar.

### Phase rows — `<LedgerRow>` `≥64h`

| Element | Spec |
| --- | --- |
| Gutter | Day range `0–10`, `11–24`, `25–` (open-ended), `data` mono `muted`. Wider than the standard 44dp — **52dp** here, because `11–24` doesn't fit in 44. This is the one gutter-width exception in the app. |
| Line 1 | Feed type `bodyStrong` `ink`, then `<StatusPill>` "● Current" `success` on the phase containing today |
| Line 2 | Item name `caption` `muted` |
| Trailing | `44×44` `⋯` icon button → row action sheet |

### Row action sheet

| Row | Action |
| --- | --- |
| Change end day | Opens a day stepper sheet. **The only editable field** — see Notes. |
| Delete phase | Confirm, then `DELETE`. `critical` label. |

### Validation banner

Above the "Add a phase" button, when the program has a gap or an overlap:

```
┌────────────────────────────────────┐
│ ⚠ No feed set for days 11–12       │  48h  tintAmber
└────────────────────────────────────┘
```

`tintAmber`, `card` radius, `pad 12/16`, 20dp `alert-triangle` `warning`. One
line per problem, up to three, then "and 2 more".

**The server doesn't validate ranges**, so a silent gap means a batch with no
feed type on day 12 and nobody finds out until the feed hint on
[08 · Log feed](08-log-consumption.md) says "No feeding programme".

### Add-phase sheet

```
        ─────
╭────────────────────────────────────╮
│ Add a phase                        │  h2
│                                    │
│  FEED TYPE                         │
│ ┌────────────────────────────────┐ │  52h picker
│ │ Grower                      ▾  │ │
│ └────────────────────────────────┘ │
│  ITEM                              │
│ ┌────────────────────────────────┐ │  52h picker
│ │ Nourish GR-3                ▾  │ │
│ └────────────────────────────────┘ │
│  DAYS                              │
│ ┌──────────┐  to  ┌──────────┐    │  64h + 64h
│ │   25     │      │  open ▾  │    │
│ └──────────┘      └──────────┘    │
│  Starts the day after Starter ends │  caption muted
│                                    │
│  ▉▉▉  Add phase              ▉▉▉  │  52h
╰────────────────────────────────────╯
```

- Start day defaults to the previous phase's end + 1, so the common case needs
  no typing.
- End day accepts a number **or "open"** — open-ended is the last phase, and the
  picker's first row is "Open-ended".
- Adding a phase that overlaps an existing one shows the `tintAmber` warning
  inline in the sheet and still allows submit. The manager may be deliberately
  re-cutting the schedule.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Batch picker renders live. Timeline card shows a `24h` skeleton bar and 3 skeleton rows. |
| **Empty — no program** | Card body `<EmptyState>`: `calendar` tile `tintAmber`, "No feeding program set for this batch.", "Add a phase to start." The timeline bar is hidden — an empty bar reads as a rendering bug. |
| **Empty — no batches** | Full-screen: "No running batches." |
| **Stale** | No treatment. A feeding program changes weekly at most. |
| **Error** | Card body with Retry. |
| **Offline** | Reads from cache; adds and edits queue. The validation banner runs on cached data, which is fine — it's arithmetic on rows the manager can see. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop |
| Batch | `52h` | ⇧ batch sheet, reload |
| Phase `⋯` | `44×44` | ⇧ row action sheet |
| "Add a phase" | `48h` | ⇧ add sheet |
| Add sheet submit | `52h` | Queue `POST` → toast → dismiss sheet |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /batches?status=RUNNING` | Batch picker |
| `GET /batch-feeding-programs?batch_id` | Timeline, rows |
| `GET /items?is_active=true` | Item picker in the add sheet |
| `POST /batch-feeding-programs` | Add a phase |
| `PATCH /batch-feeding-programs/:id` | **`end_day` only** |
| `DELETE /batch-feeding-programs/:id` | Delete a phase |

---

## Notes

- **`PATCH` accepts `end_day` and nothing else** — that's all the server's update
  schema takes. This is why the row action sheet offers "Change end day" rather
  than a full edit form: an edit screen with four fields where three silently
  fail to save is worse than one field that works.
- To change a phase's feed type or start day: delete and re-add. The sheet says
  so, in those words, under the delete row.
- **Flag overlapping or gapped day ranges.** The validation banner is the most
  valuable thing on this screen and the only place the problem is visible.
- The timeline bar uses opacity steps rather than distinct hues. Three saturated
  colours here would break the design system's rule that colour carries meaning,
  and the phases don't mean anything different from each other — they're just
  adjacent.
- **This screen keeps the tab bar.** It's a viewer, not a form; the add flow is a
  sheet with its own submit.
