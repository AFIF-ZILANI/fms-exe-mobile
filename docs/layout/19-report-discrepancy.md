# 19 · Report a Discrepancy

**Route:** `src/app/(manager)/adjust.tsx` · **Tier:** Manager `[C report_discrepancy]`
**Tab bar:** hidden

---

## Purpose

The shelf doesn't match the ledger. Say so now, while you're standing in front
of it.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Report a discrepancy              │
├────────────────────────────────────────┤
│  ITEM                                  │
│ ┌────────────────────────────────────┐ │
│ │ Starter feed                    ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  WHERE                                 │
│  ( Warehouse )         ( House )       │  Segmented 44h
│                                        │
│  ON RECORD                             │
│ ┌────────────────────────────────────┐ │
│ │  240                       sacks   │ │  64h  READ-ONLY  surfaceAlt
│ └────────────────────────────────────┘ │
│  From the ledger · as of 08:15         │  caption muted
│                                        │
│  COUNTED                               │
│ ┌────────────────────────────────────┐ │
│ │  232                       sacks   │ │  64h  focused
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │            −8 sacks                │ │  Delta block  96h  tintRed
│ │            SHORT                   │ │
│ └────────────────────────────────────┘ │
│                                        │
│  REASON                                │
│ ┌────────────────────────────────────┐ │
│ │ Damaged in storage              ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  NOTE (OPTIONAL)                       │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  88h
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Report 8 sacks short       ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Item picker — `<PickerField>` `52h`

Eyebrow "ITEM". Sheet rows `64h`: item name `bodyStrong`, `category · current
balance unit` in `caption` `muted`. Search field appears above 12 items.

Selecting an item **populates "On record"** and sets the unit suffix on both
number fields.

### Where — `<SegmentedToggle>` `44h`

| Segment | Effect |
| --- | --- |
| Warehouse | Sends `warehouse: true`. No further field. |
| House | Reveals a `<PickerField>` `52h` below, `↕12`, for the house |

**One of warehouse/house is required** — the toggle makes the invalid empty case
unrepresentable, the same trick as [15 · Assign a task](15-assign-task.md#where--segmentedtoggle-44h--a-swapping-field).

Switching also **re-fetches "On record"**, because the balance is per-location.

### On record — read-only `<NumberField>` `64h`

| Element | Spec |
| --- | --- |
| Fill | `surfaceAlt`, **no border**, not focusable, no keyboard |
| Value | `figure` mono `muted` — muted, not `ink`, so it reads as context rather than input |
| Suffix | The item's unit, `body` `muted` |
| Helper | "From the ledger · as of 08:15" `caption` `muted` |

Prefilled from `GET /stock-ledger?item_id`. **Read-only on purpose** — the whole
point is to assert what's actually there against what the system believes, and
an editable "before" turns the record into fiction.

### Counted — `<NumberField>` `64h`

Eyebrow "COUNTED". `decimal-pad`. **Focused once an item is selected.** Same unit
suffix.

### Delta block — `96h`, tinted by sign

| Element | Spec |
| --- | --- |
| Container | `card` radius, `pad 16`, contents centred, `↕16` above and below |
| Figure | `stat` mono 28, signed — `−8 sacks` |
| Label | `eyebrow`: "SHORT" / "OVER" / "MATCHES" |
| Short (negative) | `tintRed` fill, figure `critical` |
| Over (positive) | `tintAmber` fill, figure `warning` |
| Match (zero) | `tintGreen` fill, figure `success`, label "MATCHES", and the submit bar **disables** with the label "Nothing to report" |
| Empty | `surfaceAlt`, figure "—" `muted`, label "ENTER A COUNT" |

The server takes `quantity_before` and `quantity_after` and derives
`adjustment_quantity`. **Show that delta before submit so the manager sees what
they're asserting** — this block is the screen's most important element and is
why it gets a tinted card of its own rather than a helper line.

### Reason — `<PickerField>` `52h`, required

Fixed options: Damaged in storage · Expired · Spillage · Theft suspected ·
Miscount on receipt · Other. Choosing "Other" reveals the note field's label
changing to "NOTE" and makes it required.

### Note — `<TextField>` multiline `88h`

Optional, except after Reason = Other.

### Submit bar

"Report 8 sacks short" / "Report 3 sacks over". Falls back to "Report
discrepancy", disabled until item, location, a non-zero delta and a reason all
exist.

Confirms: "Report 8 sacks short?" / "The ledger will go from 240 to 232." /
"Report" / "Cancel".

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Item picker live. "On record" shows a `64×20` skeleton once an item is chosen. |
| **Empty — no items** | Item sheet: "No items available.", "Items are set up in the admin dashboard." |
| **Empty — no ledger row** | "On record" shows `0` with the helper "No ledger entry yet — treated as zero." That's a legitimate state: a first count on an item nobody has received yet. |
| **Stale** | "as of HH:MM" in the On-record helper, always shown when cached. This screen's whole premise is comparing against the ledger, so the ledger's age is load-bearing, not decorative. |
| **Error** | A failed balance fetch disables submit: "Couldn't read the current balance." Reporting a delta against an unknown "before" would write a wrong `quantity_before`. |
| **Offline** | Same as stale, and submit stays enabled — the balance comes from cache and the confirm dialog gains "Checked against the ledger from 08:15." |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm if dirty → pop |
| Item | `52h` | ⇧ item sheet; fills On record, sets units |
| Where toggle | `44h` | Swap location field, refetch balance |
| House | `52h` | ⇧ house sheet |
| Counted | `64h` | Focus, decimal keypad; delta recomputes live |
| Reason | `52h` | ⇧ reason sheet |
| Submit | `52h` | Confirm → queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /items` | Item picker |
| `GET /stock-ledger?item_id` | "On record" balance, per location |
| `GET /houses?active=true` | House picker |
| `POST /inventory-adjustments` | The write, with `quantity_before` and `quantity_after` |

---

## Notes

- **Send `quantity_before` and `quantity_after`, not the delta.** The server
  derives `adjustment_quantity` itself. Sending a computed delta means two
  sources of truth for the same arithmetic.
- **"On record" must be read-only.** The temptation to let a manager fix an
  obviously-wrong ledger number directly is exactly the thing this record exists
  to prevent — an adjustment with a hand-edited "before" is unauditable.
- The zero-delta case disabling submit is deliberate. "I counted and it matched"
  is a real and useful thing to know, but `InventoryAdjustment` has no way to
  record it, and writing a zero-quantity adjustment to express it would pollute
  the ledger with rows that mean nothing.
- Reason is a fixed picker here but free text on [07 ·
  Mortality](07-log-mortality.md). The difference is real: mortality causes are
  local and biological, discrepancy reasons are procedural and finite.
