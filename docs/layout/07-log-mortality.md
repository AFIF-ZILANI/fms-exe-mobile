# 07 · Log Mortality

**Route:** `src/app/log/mortality.tsx` · **Tier:** Both · **Tab bar:** hidden

This file also specifies **the shared log-form spine** used by
[08](08-log-consumption.md), [09](09-log-weight.md), [10](10-log-environment.md)
and [11](11-log-treatment.md). Those files specify only their own fields and
their own traps.

---

## Purpose

Record the birds that died, against the right house and the right batch, in
under twenty seconds, with gloves on, offline.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Log mortality                     │  Header 56h · close, not back
├────────────────────────────────────────┤
│                                        │
│  HOUSE                                 │  eyebrow ↕6
│ ┌────────────────────────────────────┐ │
│ │ House 2                         ▾  │ │  Picker  52h
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ B-24 · Cobb 500 · d21              │ │  Batch resolver  64h  tintGreen
│ │ 4,812 live birds                   │ │
│ └────────────────────────────────────┘ │
│                                        │
│  BIRDS THAT DIED                       │  ↕20
│ ┌──────────────────────────┐ ┌──┐ ┌──┐ │
│ │  12                      │ │ −│ │ +│ │  Number field 64h + steppers
│ └──────────────────────────┘ └──┘ └──┘ │
│  0.25% of the flock                    │  caption muted
│                                        │
│  CAUSE (OPTIONAL)                      │  ↕16
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  Textarea 88h
│ └────────────────────────────────────┘ │
│                                        │
│  DATE                                  │  ↕16
│ ┌────────────────────────────────────┐ │
│ │ Today · 6 Sep 2026              ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
├────────────────────────────────────────┤
│  ▉▉▉    Record 12 deaths         ▉▉▉  │  Submit bar
└────────────────────────────────────────┘
```

---

## The shared spine

Every log form is the same five parts, in this order:

```
1. Header             ✕ close · form name
2. House picker       52h · the only field above the fold that can't be skipped
3. Batch resolver     64h · read-only confirmation, tintGreen
4. Fields             the form's own content
5. Submit bar         52h · states the value being written
```

### 1. Header — `56h`

| Element | Spec |
| --- | --- |
| Leading | `44×44` icon button, 24dp **`x`**, not a chevron. A form is a modal task; the close glyph says the work is discarded, a back chevron says it's saved. |
| Title | Form name `h1` `ink` — "Log mortality", "Log feed", "Log weight", "Log environment", "Log treatment" |
| Trailing | None |

Closing with unsaved input opens a confirm dialog: "Discard this entry?" /
"Nothing has been recorded yet." / "Discard" (`critical` filled) / "Keep
editing" (ghost). No dialog when the form is untouched.

### 2. House picker — `<PickerField>` `52h`

| Element | Spec |
| --- | --- |
| Eyebrow | "HOUSE", `↕6` above |
| Field | `52h`, `surfaceAlt`, 1px `line`, `control` radius, `pad 0/16`. Value `body` `ink`, trailing 20dp `chevron-down` `muted`. |
| Placeholder | "Pick a house" in `muted` |
| Sheet | Standard bottom sheet, one `64h` row per active house: token in a `32×32` `primarySoft` circle, name `bodyStrong`, live count `caption` `muted`. Current selection carries a trailing `check`. |
| Prefilled | When launched with `?house_id=`, the field is filled and the sheet is still reachable — never locked. A worker who tapped the wrong house tile must be able to fix it here rather than backing out. |

### 3. Batch resolver — `64h`, `tintGreen`, read-only

| Element | Spec |
| --- | --- |
| Container | `tintGreen` fill, `card` radius, `pad 12/16`, `↕16` below |
| Line 1 | `B-24 · Cobb 500 · d21` — code `data` mono `ink`, breed and day `caption` `muted` |
| Line 2 | Live count `figure` mono `ink` + " live birds" `caption` `muted` |
| No house yet | Container is `surfaceAlt`, single line "Pick a house first" `caption` `muted` |
| No batch | Container is `tintRed`, `alert-circle` 20dp `critical` `↔12`, "No batch in this house" `bodyStrong` `ink`, second line "Nothing can be logged here." Submit is disabled. |
| Loading | `surfaceAlt` with a `140×18` skeleton |

This block is **not a field.** It has no label, no chevron, and cannot be
tapped. It exists so the worker can check they're logging against the right
flock before writing, which is the single most valuable thing on the screen.

### 4. Fields

Per form. All use the `<TextField>` / `<NumberField>` / `<PickerField>` specs
from [README · Form field stack](README.md#form-field-stack).

### 5. Submit bar

| State | Label |
| --- | --- |
| Valid, with a value | "Record 12 deaths" — the value is in the label |
| Valid, no value yet | "Record mortality" — the bare verb |
| Invalid or unresolved batch | Same label, disabled: `surfaceAlt` fill, `muted` label, no elevation |

**On submit:** queue the write, show the toast "Recorded · will sync", and pop
immediately. If the form was launched from a task, `POST
/task-assignments/:id/complete` is queued in the same batch. **Never block on
the network**, never show a spinner on the button, never wait for a 201.

---

## Mortality-specific anatomy

### Count field — `<NumberField>` `64h` with steppers

| Element | Spec |
| --- | --- |
| Eyebrow | "BIRDS THAT DIED" |
| Input | Flex width, `64h`, `surfaceAlt`, `control` radius. Value in `figure` mono 20 `ink`, left-aligned, `pad 0/16`. `keyboardType="number-pad"`. |
| Steppers | Two `56×64` buttons, `↔8` from the input and `↔8` from each other, `surface` fill, 1px `line`, `control` radius. 24dp `minus` / `plus` in `ink`. |
| Stepper behaviour | ±1 per tap. Long-press repeats at 6/sec after a 400ms delay. Minus is disabled at 0. |
| Focus | **Focused on mount.** The keyboard is up before the worker's thumb arrives. |
| Helper | "0.25% of the flock" `caption` `muted`, `↕6`. Recomputes live. |

Steppers exist because the common case is a single-digit correction to a number
the worker already typed, and because tapping `+` twice with gloves is more
reliable than positioning a cursor.

### Threshold warning

When `count > 2% of live birds`, the helper line switches to `warning`:

```
 ⚠ 120 is 2.5% of the flock. Unusual — check the count.
```

- 16dp `alert-triangle` `warning`, copy `caption` `warning`.
- The field border goes 2px `warning`.
- **Submit stays enabled.** A real mass-mortality event is exactly when the app
  must not argue.
- Submitting past the threshold opens the confirm dialog: "Record 120 deaths in
  House 2?" / "That's 2.5% of the flock." / "Record" / "Cancel".

A fat-finger `50` for `5` is the costly typo here, and `BatchHouseBalance`
decrements for real.

### Cause field

`<TextField>` multiline, `88h`, eyebrow "CAUSE (OPTIONAL)", placeholder empty.
Optional in the schema and optional in the UI — no asterisk, no validation.

### Date field — `<PickerField>` `52h`

Eyebrow "DATE". Value reads "Today · 6 Sep 2026", or "5 Sep 2026" for any other
day. Opens the platform date picker. Defaults to today. Cannot be set in the
future — the picker's `maximumDate` is today.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | House picker renders live. Batch resolver shows its skeleton. Submit bar disabled. |
| **Empty — no houses** | Full-screen `<EmptyState>` replacing the form body: `wifi-off` in `tintRed`, "Can't reach the server.", the base URL in a `surfaceAlt` inset, "Try again". Same state as [02 · Profile](02-profile.md) — on a fresh setup this is the actual cause. |
| **Empty — no batch** | The `tintRed` resolver variant. Submit disabled with the reason visible, never a silent failure at POST time. |
| **Stale** | The resolver's live count carries "as of 08:15" in `caption` `muted` on line 2. The percentage helper is computed from that possibly-stale count, so it says "≈ 0.25%" with the tilde when the count is cached. |
| **Error — submit rejected locally** | Field-level: border 2px `critical`, `caption` `critical` under the field. Submit stays visible and enabled so the fix is one tap away. |
| **Offline** | **No change.** No banner on the form, no disabled state, no warning. The submit bar says "Record 12 deaths" exactly as it does online, and the toast says "Recorded · will sync". Offline is the normal path. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close | `44×44` | Discard confirm (if dirty) → pop |
| House field | `52h` | ⇧ house sheet |
| House sheet row | `64h` | Select, refetch the batch, dismiss |
| Count input | `64h` | Focus, numeric keypad |
| Stepper − / + | `56×64` | ±1, long-press repeats |
| Cause | `88h` | Focus, default keyboard |
| Date field | `52h` | Platform date picker |
| Submit | `52h` | Validate → confirm if over threshold → queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /houses?active=true` | House sheet |
| `GET /batch-house-balances?house_id=X` | Batch resolver **and** the live count. One request serves both. |
| `POST /mortality-logs` | The write |

`recorded_by_id` comes from the session, never from a picker.

---

## Notes

- **The count field is focused on mount.** Every log form focuses its primary
  field on mount; for this one that's the count.
- **`BatchHouseBalance` decrements for real.** This write changes a number every
  other screen displays. That's why the threshold warning and the confirm dialog
  exist, and why neither of them blocks.
- The percentage helper is the cheapest possible sanity check and costs one
  division. It catches the decimal-place error that a threshold on absolute
  count never will — 12 deaths is fine in a flock of 5,000 and catastrophic in
  a flock of 200.
- Don't add a "cause" picker. Causes are free text on purpose; the vocabulary a
  farm uses is local and a fixed list would be wrong everywhere.
