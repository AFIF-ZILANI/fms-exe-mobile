# 16 · House Transfer

**Route:** `src/app/(manager)/transfer.tsx` · **Tier:** Manager `[C house_transfer]`
**Tab bar:** hidden

---

## Purpose

Move birds between houses, or correct a count that's drifted from reality.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Move birds                        │
├────────────────────────────────────────┤
│  ( Transfer )        ( Correction )    │  Reason toggle  48h
│                                        │
│  BATCH                                 │
│ ┌────────────────────────────────────┐ │
│ │ B-24 · Cobb 500 · d21           ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  FROM                                  │
│ ┌────────────────────────────────────┐ │
│ │ House 2 · 4,812 birds           ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│              ↓                         │  24dp arrow-down, muted, ↕8
│                                        │
│  TO                                    │
│ ┌────────────────────────────────────┐ │
│ │ House 3 · 5,000 birds           ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  QUANTITY                              │
│ ┌────────────────────────────────────┐ │
│ │  500                        birds  │ │  64h
│ └────────────────────────────────────┘ │
│  House 2 keeps 4,312 · House 3 → 5,500 │  caption muted
│                                        │
│  NOTE (OPTIONAL)                       │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  88h
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Move 500 birds             ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Reason toggle — `<SegmentedToggle>` `48h`

First on the form, because it changes what the rest of the form means.

| Segment | Meaning | Field shape |
| --- | --- | --- |
| Transfer | Birds physically moved between two houses | From **and** To both required |
| Correction | The count was wrong | **One** of From / To, the other reads "— none —" |

Maps to the server's `reason` of `TRANSFER` | `ADJUSTMENT`. Switching to
Correction does **not** clear the two house fields — it makes them individually
clearable, and adds a "— none —" row at the top of both house sheets.

**`INITIAL` is set by `BatchService.create` and is not client-choosable.** It
never appears in this toggle.

### Batch picker — `<PickerField>` `52h`

Eyebrow "BATCH". Sheet lists `status=RUNNING` batches: code `bodyStrong`, then
`breed · d21 · 9,812 birds` in `caption` `muted`. Selecting a batch **resets both
house fields** — the house list below is scoped to houses that batch occupies.

### From / To pickers — `52h` each, with a `↓` between

| Element | Spec |
| --- | --- |
| Value | `House 2 · 4,812 birds` — name `body` `ink`, count `data` mono `muted` |
| From sheet | Only houses where this batch has a non-zero balance. A transfer out of an empty house is not a thing. |
| To sheet | All active houses, including ones the batch doesn't occupy yet — that's how a batch spreads. |
| Arrow | 24dp `arrow-down` `muted`, centred, `↕8` above and below. Purely orientational. |
| Same house | Selecting the same house in both is blocked at the sheet: the already-chosen house is greyed with "already selected" in `caption`. |

### Quantity — `<NumberField>` `64h`

| Element | Spec |
| --- | --- |
| Eyebrow | "QUANTITY" |
| Suffix | "birds" `body` `muted`, right-aligned inside the field |
| Keyboard | `number-pad`, focused after both houses are set |
| Helper | Live arithmetic: "House 2 keeps 4,312 · House 3 → 5,500" in `caption` `muted` |

### Over-count warning

When `quantity > from-house balance`:

```
 ⚠ House 2 only has 4,812. This would leave −188.
```

- Field border 2px `critical`, helper line `critical` with a 16dp
  `alert-triangle`.
- **Submit is disabled.** This is the one numeric field in the app that hard-blocks,
  because the write decrements `BatchHouseBalance` inside a transaction and a
  negative balance corrupts every downstream count on every other screen.
- On a Correction with no From house, the check doesn't apply.

### Submit bar

"Move 500 birds" on Transfer, "Correct to 4,312" on Correction. Falls back to
"Move birds" / "Record correction", disabled.

**Always confirms:** "Move 500 birds from House 2 to House 3?" / "House 2 will
have 4,312. This can't be undone — a mistake needs a second, offsetting move." /
"Move" / "Cancel".

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Toggle renders live. Pickers show skeleton values. Submit disabled. |
| **Empty — no running batches** | Full-screen `<EmptyState>`: `package` tile `surfaceAlt`, "No running batches.", "Nothing to move." No action button. |
| **Empty — batch occupies one house** | The From sheet has one entry. Transfer still works (into a new house); Correction still works. No special state. |
| **Stale** | The balance shown beside each house carries "as of HH:MM" in the sheet rows, and the helper arithmetic uses a "≈" prefix. **Stale counts are the real risk on this screen** — the over-count guard is only as good as the balance it checks. |
| **Error** | Field-level. A failed balance fetch disables submit with "Couldn't check the current count." rather than allowing an unguarded write. |
| **Offline** | Same as stale. Submit stays enabled when the guard passes against cached balances — the confirm dialog's copy gains a line: "Checked against counts from 08:15." |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm if dirty → pop |
| Reason toggle | `42h` in `48h` | Switch mode; allow "— none —" in the house sheets |
| Batch | `52h` | ⇧ batch sheet; resets both houses |
| From / To | `52h` | ⇧ house sheet, scoped as described |
| Quantity | `64h` | Focus, number keypad |
| Submit | `52h` | Guard → confirm → queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /batches?status=RUNNING` | Batch sheet |
| `GET /batch-house-balances?batch_id` | House sheets, live counts, the over-count guard |
| `POST /batch-house-allocations` | The write |

---

## Notes

- **The server requires at least one of from/to.** A one-sided row *is* a
  correction — that's what the toggle's second mode produces, and it's why
  Correction doesn't simply mean "quantity can be negative".
- **This is the only hard-blocking numeric guard in the app.** Everywhere else a
  suspicious number warns and proceeds, because a real event must always be
  recordable. Here the "event" is a bookkeeping move the manager controls
  entirely, so blocking costs nothing and prevents a transaction that silently
  corrupts counts.
- The confirm dialog states the resulting balance, not just the quantity. "Move
  500" is easy to approve; "House 2 will have 4,312" is what a manager actually
  checks.
- Don't offer an undo. There isn't one — a mistake is a second, offsetting move,
  and the dialog says so in those words.
