# 08 · Log Feed / Consumption

**Route:** `src/app/log/consumption.tsx` · **Tier:** Both · **Tab bar:** hidden

Uses the shared log-form spine — header, house picker, batch resolver, fields,
submit bar — specified in [07 · Log mortality](07-log-mortality.md#the-shared-spine).
Only this form's own content is below.

---

## Purpose

Record feed or supplies drawn for a house, so stock and cost stay honest.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Log feed                          │
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
│  ITEM                                  │
│ ┌────────────────────────────────────┐ │
│ │ Starter feed                    ▾  │ │  52h
│ └────────────────────────────────────┘ │
│  Programme for d21: Starter          ✓ │  caption success
│                                        │
│  QUANTITY                              │
│ ┌────────────────────────┐ ┌─────────┐ │
│ │  40                    │ │  kg  ▾  │ │  64h + unit 64h
│ └────────────────────────┘ └─────────┘ │
│                                        │
│  NOTE (OPTIONAL)                       │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  88h
│ └────────────────────────────────────┘ │
│                                        │
│  DATE                                  │
│ ┌────────────────────────────────────┐ │
│ │ Today · 6 Sep 2026              ▾  │ │  52h
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉   Record 40 kg starter feed  ▉▉▉ │
└────────────────────────────────────────┘
```

---

## Anatomy

### Item picker — `<PickerField>` `52h`

| Element | Spec |
| --- | --- |
| Eyebrow | "ITEM" |
| Sheet | `64h` rows: item name `bodyStrong` `ink`, category + default unit `caption` `muted`. Grouped by category with `eyebrow` section headers inside the sheet. |
| Search | The sheet gains a `52h` search field at the top **when the list exceeds 12 items**. Below that it's furniture. |
| Focus | Focused on mount when a house arrived prefilled; otherwise the house picker is. |

### Feeding-programme hint — `caption`, `↕6` under the item field

Reads the batch's feeding programme for the current day-of-cycle and says what
the plan is:

| Case | Copy | Colour |
| --- | --- | --- |
| Selected item matches the programme | "Programme for d21: Starter ✓" | `success`, 16dp `check` |
| Selected item differs | "⚠ Programme for d21 is Starter, not Grower." | `warning`, 16dp `alert-triangle` |
| No programme set | "No feeding programme for this batch." | `muted`, no icon |
| Nothing selected yet | Line omitted | — |

**A mismatch never blocks submit.** Feed substitutions happen; the hint exists so
the substitution is deliberate rather than accidental.

### Quantity — `<NumberField>` `64h` + unit `<PickerField>` `64h`

| Element | Spec |
| --- | --- |
| Eyebrow | "QUANTITY", spanning both controls |
| Input | Flex, `64h`, `figure` mono, `keyboardType="decimal-pad"` |
| Unit | Fixed `96×64`, `↔8`, `surfaceAlt`, `control` radius, value `body` `ink` + 16dp chevron |
| Unit default | From the selected item, and **changes when the item changes** |
| Unit options | kg · g · litre · piece · sack — from the item's allowed units, not a global list |
| No steppers | Feed quantities are typed, not nudged. Steppers on a decimal field are a mis-tap generator. |

### Note and Date

`<TextField>` multiline `88h`, and the standard date field — both identical to
[07](07-log-mortality.md#date-field--pickerfield-52h).

### Submit bar

Label composes the value: "Record 40 kg starter feed". Falls back to "Record
feed" before item and quantity are both set.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Item sheet shows 5 skeleton rows. Everything else per the spine. |
| **Empty — no items** | Item sheet body: `package` tile in `surfaceAlt`, "No items available.", "Items are set up in the admin dashboard." |
| **Empty — no batch** | Spine's `tintRed` resolver, submit disabled. |
| **Stale** | Spine treatment. The programme hint adds nothing — a cached feeding programme is as good as a live one. |
| **Error** | Field-level per the spine. |
| **Offline** | No change. Items come from cache; a worker who has opened this form once can log feed offline indefinitely. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Item field | `52h` | ⇧ item sheet |
| Item sheet search | `52h` | Filter, only when > 12 items |
| Quantity | `64h` | Focus, decimal keypad |
| Unit | `96×64` | ⇧ unit sheet |
| Submit | `52h` | Queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /items?is_unit_tracked=false&is_active=true` | Item sheet |
| `GET /batch-house-balances?house_id=X` | Batch resolver |
| `GET /batch-feeding-programs?batch_id` | Programme hint |
| `POST /consumptions` | The write |

`given_by_id` from the session. `base_quantity` is server-computed — never sent.

---

## Notes

- **`is_unit_tracked` splits the item list.** `Item.is_unit_tracked` — not
  category — decides whether an item is individually QR-coded (`StockUnit`) or
  tracked as an aggregate quantity (`StockLedger`). Without QR in v1 this form
  draws only from `is_unit_tracked: false`.
- **Prefer the server filter over a client one.** `listItemsQuerySchema` filters
  by `category` and `is_active` today; it needs an `is_unit_tracked` param, one
  line mirroring `is_active`. Client-side filtering of a paginated list silently
  drops matches past page one — the bug shows up only on farms with enough
  items to paginate, which is exactly the farms that matter.
- **No `stock_unit_id` without QR.** The field doesn't exist on this form in v1.
- The unit picker must re-default when the item changes. Leaving "kg" selected
  after switching from feed to a piece-counted supply writes a quantity that is
  wrong by three orders of magnitude and looks perfectly reasonable in the list.
