# 20 · Flag Low Stock

**Route:** `src/app/(manager)/flag-stock.tsx` · **Tier:** Manager `[C flag_low_stock]`
**Tab bar:** hidden

---

## Purpose

Raise a reorder signal without touching Purchases — finance stays Admin's.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Flag low stock                    │
├────────────────────────────────────────┤
│  ITEM                                  │
│ ┌────────────────────────────────────┐ │
│ │ Starter feed                    ▾  │ │  52h
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ 12 sacks left · as of 08:15        │ │  48h  tintAmber
│ └────────────────────────────────────┘ │
│                                        │
│  TYPE                                  │
│  ( Feed )              ( Medicine )    │  Segmented 44h
│                                        │
│  URGENCY                               │
│  ( Info ) ( Warning ) ( Critical )     │  Segmented 44h
│                                        │
│  TITLE                                 │
│ ┌────────────────────────────────────┐ │
│ │ Low stock: Starter feed            │ │  52h  prefilled
│ └────────────────────────────────────┘ │
│                                        │
│  DESCRIPTION                           │
│ ┌────────────────────────────────────┐ │
│ │ Karim Mia: 12 sacks left, about    │ │  104h  prefilled prefix
│ │ two days at current draw.          │ │
│ └────────────────────────────────────┘ │
│                                        │
├────────────────────────────────────────┤
│  ▉▉▉  Raise warning              ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Item picker — `<PickerField>` `52h`

Eyebrow "ITEM". Sheet rows show name, category, and current balance. Selecting
an item fills the balance strip, the title, and the description prefix.

### Balance strip — `48h`, `tintAmber`

| Element | Spec |
| --- | --- |
| Container | `tintAmber` fill, `card` radius, `pad 12/16`, `↕16` below |
| Content | Balance `figure` mono `ink` + unit + " left", then `· as of 08:15` in `caption` `muted` |
| Zero balance | `tintRed` fill, copy "Nothing left" in `bodyStrong` `ink` |
| No ledger row | Strip omitted entirely — flagging an item with no ledger history is legitimate and the strip would say nothing useful |

Read-only, not a field. It's here so the manager's description can cite a real
number without leaving the screen.

### Type — `<SegmentedToggle>` `44h`

Two segments: Feed | Medicine. Maps to the alert's `type`. Defaults from the
selected item's category, and stays overridable.

### Urgency — `<SegmentedToggle>` `44h`, three segments

| Segment | Active fill | Active label |
| --- | --- | --- |
| Info | `tintBlue` | `info` |
| Warning | `tintAmber` | `warning` |
| Critical | `tintRed` | `critical` |

**Defaults to Warning.** This is the one segmented control in the app whose
active segment is coloured rather than plain `surface` — the level *is* a
status, and the design system's rule is that status colours mean something.
Inactive segments stay `muted` on the `surfaceAlt` track.

### Title — `<TextField>` `52h`

Prefilled `Low stock: {item.name}`, editable. Re-prefills when the item changes,
unless the manager has edited it.

### Description — `<TextField>` multiline `104h`

**Prefilled with the manager's name as a prefix:** `Karim Mia: `, with the cursor
placed after it.

`Alerts` has no actor column — there is no `raised_by_id` anywhere in the schema.
Until one exists, the name prefix is how the Admin knows who raised it. Worth a
real field later; not worth a migration now.

The prefix is normal editable text, not a locked ornament. A manager who deletes
it has made a choice, and a locked prefix would be the kind of clever affordance
that breaks the moment someone's name has an unusual character in it.

### Submit bar

"Raise warning" / "Raise critical alert" / "Raise notice" — the verb follows the
urgency segment. Disabled until item and title exist.

No confirm dialog. An alert is cheap, reversible by the Admin, and the whole
point is that raising one is frictionless.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Item picker live; balance strip shows a `120×20` skeleton once an item is chosen. |
| **Empty — no items** | Item sheet: "No items available.", "Items are set up in the admin dashboard." |
| **Empty — no ledger row** | Balance strip omitted; everything else works. |
| **Stale** | "as of HH:MM" in the balance strip, always. |
| **Error** | A failed balance fetch omits the strip rather than blocking — the alert doesn't depend on the number. |
| **Offline** | No change; the write queues. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm if dirty → pop |
| Item | `52h` | ⇧ item sheet; fills strip, title, type default |
| Type | `44h` | Select |
| Urgency | `44h` | Select; changes the submit label |
| Title / Description | `52h` / `104h` | Focus |
| Submit | `52h` | Queue → toast "Alert raised" → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /items` | Item picker |
| `GET /stock-ledger?item_id` | Balance strip |
| `POST /alerts` | The write, `related_id` = the item id |

---

## Notes

- **`related_id` is the item id.** That's what makes the alert actionable on the
  Admin side — without it the Admin gets a sentence and has to go find the item.
- **`Alerts` has no actor column.** The name prefix in the description is a
  workaround, and it should be replaced by a real `raised_by_id` field when the
  schema next changes. Until then, don't hide the prefix behind an
  uneditable-looking control — it's a compromise, and it should read like one.
- This screen deliberately doesn't touch Purchases. A manager raising a signal
  and a manager committing farm money are different authority levels, and v1
  keeps the second one in the Admin dashboard.
- No confirm dialog and no threshold guard. Flagging low stock is the cheapest
  possible write in the app; every gram of friction here means a farm runs out
  of feed on a Sunday.
