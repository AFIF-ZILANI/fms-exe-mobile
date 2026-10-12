# 18 · Link Items

**Route:** `src/app/(manager)/link.tsx` · **Tier:** Manager `[C receive_stock]`
**Tab bar:** hidden

---

## Purpose

Bind pre-printed QR codes to the delivery lot they arrived on, standing at the
farm gate with a truck waiting — a whole pallet without stopping between units.

---

## What this replaced

v1 shipped **Receive stock**: unit-first, one at a time, code typed by hand
(`q` is a substring match on the unit id). That screen's own note said "this is
the screen QR replaces in v2 — the scan fills the same search field and
everything downstream is unchanged."

That turned out to be half right. Downstream *is* unchanged — same
`POST /stock-units/:id/bind`, same everything. But the flow inverts: a scanner
makes **lot-first, many-units** the natural shape, because the expensive step
is picking the lot and the cheap step is now the code. So the screen is
lot → summary → scan-many, and the old manual search survives inside it as the
fallback for a torn or unreadable label.

**`expo-camera` runs in Expo Go** as of SDK 57, so this needed no development
build. `docs/PRD.md` §7's "No QR scan — expo-camera needs a development build"
was true on older SDKs and is no longer.

---

## Frame

### Stage 1–2 — pick a lot, then its summary

```
┌────────────────────────────────────────┐
│  ‹   Link items                        │  Header 56h
├────────────────────────────────────────┤
│  PURCHASE LOT                          │
│ ┌────────────────────────────────────┐ │
│ │ Tox Safe Plus Pro               ▾  │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ ▢  Tox Safe Plus Pro               │ │  Lot summary
│ │    supplement                      │ │
│ │  ────────────────────────────────  │ │
│ │  Quantity   10                     │ │
│ │  Received   Sep 1, 2026            │ │
│ │  Lot        …3409941               │ │
│ │  ────────────────────────────────  │ │
│ │  LINKED THIS SESSION            1  │ │  stat mono
│ ╰────────────────────────────────────╯ │
│                                        │
│  ▉▉▉  📷  Scan codes            ▉▉▉   │  52h primary
│        Type a code instead             │  44h ghost
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ SCANNED                  1 linked  │ │
│ ├────┬───────────────────────────────┤ │
│ │ ⊘  │ …46525f4                      │ │
│ ╰────┴───────────────────────────────╯ │
└────────────────────────────────────────┘
```

### Stage 3 — the scanner (full-screen)

```
┌────────────────────────────────────────┐
│  ✕   Tox Safe Plus Pro                 │  on black
│      3 linked                          │
├────────────────────────────────────────┤
│                                        │
│            ┌──────────┐                │
│            │          │                │  220×220 reticle
│            │  camera  │                │  border flashes on result
│            │          │                │
│            └──────────┘                │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ✓  Linked …46525f4               │  │  flash strip, 1.4s
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  THIS SESSION                       3  │  panel, max 42% height
│  ⊘ …46525f4                            │
│  ⊘ …62ce53b                            │
│  ⚠ …4e9b17f   Already linked · in stock│
│                                        │
│  ▉▉▉         Done              ▉▉▉    │
└────────────────────────────────────────┘
```

---

## Anatomy

### Lot picker — `<PickerField>` `52h`

| Element | Spec |
| --- | --- |
| Options | `purchase-items`, **filtered to `item.is_unit_tracked`** |
| Label | Item name |
| Sub-label | `base_quantity · purchase date` |
| On change | **Clears the session list.** A new lot is a new session; carrying counts across would misreport what went into which delivery. |

`StockUnitService.bind` rejects a lot whose item isn't QR-tracked with *"X
isn't tracked by QR code — use Move Stock instead"*. Filter the list, don't
explain the error.

### Lot summary — `<Card>`

40dp `tintAmber` `package` tile, item name `h2`, category `caption`. Then a
rule, three label/value rows (Quantity, Received, Lot id tail — all `data`
mono), another rule, and the session count as a `stat` figure that goes
`success` above zero.

**Supplier is not shown.** `Purchase` carries `supplier_id` with no relation.

### Actions

| Control | Spec |
| --- | --- |
| Scan codes | Primary `52h`, `camera` icon. Opens the scanner. |
| Type a code instead | Ghost `44h`, toggles the manual block below |

**Both are replaced by the offline notice when there's no connection** (below).

### Manual fallback

The v1 search, kept: a `56h` mono search field (`autoCorrect={false}` —
autocorrect on a hex fragment is actively harmful), querying
`?q=&status=UNASSIGNED` at 3+ characters. Result rows bind on tap, then the
block collapses. Its helper reads "For a torn or unreadable label. Partial
codes work."

### Scanner — full-screen `Modal`, black ground

| Region | Spec |
| --- | --- |
| Header | `✕` close `44×44`, lot name `bodyStrong` white, running count `caption` white-72% |
| Viewport | `CameraView`, `facing="back"`, `barcodeTypes: ['qr']` |
| Reticle | 220 × 220, 3px border, `card` radius. Border is white-60% at rest, `primary` on a success, `critical` on an error. |
| Flash strip | Bottom of the viewport, `52h`, `card` radius, `primary` or `critical` fill, icon + message, clears after 1.4s |
| Panel | `surface`, `sheet` top corners, max 42% height: "THIS SESSION" + count, scrolling row list, then a `Done` button |
| Row | 16dp status icon, code tail in `data` mono, error message in `caption` `critical` |

---

## Scan behaviour

The logic lives in `src/lib/scan.ts` and is unit-tested in `scan.test.ts` —
the only part of this feature verifiable without a device.

| Situation | Buzz | Result |
| --- | --- | --- |
| Payload isn't a UUID | error | "Not a ZeroD stock code". **No request** — the QR payload *is* the StockUnit id, so anything else came off another label. |
| First sight of a valid code | — | Bind it |
| **Same code still in frame** | **none** | **Silent.** `onBarcodeScanned` fires many times a second; a 1.5s per-code cooldown absorbs it. This is the guard that makes everything below safe to report. |
| **Same code presented again after the cooldown** | warning | Amber flash, "Already linked in this session". **No new row** — the code is already in the list from when it worked. |
| A bind is already in flight | — | Ignored: one request at a time, so a fast pan can't interleave. |
| Bind succeeds | success | Green flash, count +1, row prepended |
| Bind fails, retryable (no connection, 5xx) | error | Red flash, error row, and the code is **released** so the label can be rescanned once the problem is fixed |
| Bind fails, settled (409/404/400) | error | Red flash, error row, and the code stays **marked** — see below |

**The cooldown is what makes duplicate reporting possible.** Without it, a
label resting in frame would fire an alert and a vibration ten times a second.
With it, "still in frame" and "shown to me again on purpose" are different
events, and only the second is worth telling anyone about.

**A settled rejection is never released.** `isRetryable()` releases only a
transport failure (status 0, or 5xx). A 409 "already bound", a 404 unknown
code, or a 400 wrong-item is decided for that code against that lot — if those
released, an already-bound label left in frame would re-POST and re-vibrate on
every cooldown, forever. Instead it falls through to the duplicate path and
goes quiet after one report.

### Scan area (2026-10-12)

Only a code whose **centre sits inside the square** counts (`lib/scan-area.ts`).
expo-camera has no scan-region prop, so each detected code's position (corner
points, else bounds) is checked against the 220 dp square centred in the camera
view. A code outside it is ignored, and every couple of seconds a nudge reads
"Move the code inside the square" so a held-up code that isn't being read
doesn't look like a dead camera. If the camera reports no position the code
passes: better to scan than to go dead.

### Sound (2026-10-12)

`buzz()` also plays a sound through `expo-audio` (`assets/sounds/`): a short
rising two-note **chime** for a successful link, and a lower **double buzz** for anything
that didn't go through — already linked (this session or earlier), unknown or
foreign code, lot full, server error. A duplicate and a rejection sound the same
on purpose. It plays in silent mode and mixes with other audio. Like the
vibration it never throws: if audio fails to load the scan carries on silently.

### Vibration

`expo-haptics`, via `lib/haptics.ts`. On a noisy farm gate with the phone at
arm's length the operator is looking at the pallet, not the screen, so the buzz
is the primary channel and the colour flash is the confirmation they get when
they do look.

Fire-and-forget and never allowed to throw: haptics are silently unavailable in
Low Power Mode, when the user has turned them off, on some browsers, and on
devices with no vibration hardware. Feedback failing must not interrupt the
scan it was reporting on.

**Error copy** (`bindErrorMessage`):

| Status | Shown |
| --- | --- |
| 404 | "Unknown code — not a ZeroD stock unit." |
| 409 | "Already linked · in stock" — parsed from the server's `already in_stock` |
| 0 | "Couldn't reach the server." |
| other | The server's own `detail`, which is already plain for the not-tracked case |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Lot picker shows its own loading; the rest of the screen doesn't exist until a lot is chosen. |
| **Empty — no lot chosen** | Full `<EmptyState>`: `package` tile, "Pick a lot to link into.", "Choose the delivery these units arrived on, then scan their codes." |
| **Empty — no tracked lots** | Picker sheet: "No QR-tracked purchase lots. Lots are recorded in the admin dashboard." |
| **Empty — nothing scanned yet** | Scanner panel reads "Point the camera at a code. The camera stays open — scan the whole pallet without stopping." |
| **Camera permission not granted** | Scanner viewport shows `camera-off`, "Camera access is off.", and an "Allow camera" button calling `requestPermission()`. Never a blank black screen. |
| **Error** | Per scan, inline. Nothing takes the screen. |
| **Offline** | **This screen stops working, by design.** Both actions are replaced by a `tintRed` notice: "Linking needs a connection." / "Each code is checked against the server as you scan. Everything else in the app still works offline." The scanner shows the same, so a session already open doesn't silently pile up failures. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop |
| Lot picker | `52h` | ⇧ lot sheet; clears the session |
| Scan codes | `52h` | Open the scanner |
| Type a code instead | `44h` | Toggle the manual block |
| Manual result row | `≥64h` | Bind that unit |
| Scanner close / Done | `44×44` / `52h` | Close the scanner; the session list stays on the screen behind |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /purchase-items?limit=100` | Lot picker, filtered client-side to `is_unit_tracked` |
| `GET /stock-units?q=&status=UNASSIGNED&limit=25` | Manual fallback search |
| `POST /stock-units/:id/bind` | The write — `{ purchase_item_id, bound_by_id }` |

`bound_by_id` comes from the session. A successful bind invalidates the
`['stock-units']` query key.

---

## Notes

- **Requiring a connection is a deliberate exception** to the app's
  offline-first rule, and the only screen that takes it. Binding the wrong
  unit to a lot is expensive and silent, and every check that catches it
  (already bound, unknown code, wrong item) exists only on the server. The
  cost is real: a gate with no bars means no linking, which is why the offline
  notice says so plainly rather than looking broken.
- **A failed scan releases the code.** Marking it seen on failure would mean a
  worker who fixes the problem can't rescan the same label without restarting
  the session.
- **The session count is per-session, not per-lot.** "12 of 40 linked" would be
  more useful and needs `purchase_item_id` adding to
  `listStockUnitsQuerySchema` server-side — one line mirroring `status`. Worth
  doing; not done here because it's a change in another repo.
- **Two different "already" cases, both reported.** A code scanned earlier in
  *this session* is caught client-side (amber, "Already linked in this
  session"). A code bound in some *earlier* session is caught by the server's
  409 and reads "Already linked · in stock" in red. The operator needs to tell
  those apart: the first is their own double-scan, the second means the unit
  belongs to another delivery.

---

## Update — bottle split and lot list (2026-10-12)

The dropdown picker is gone. With no lot chosen the screen lists **open lots**
as cards (name, quantity · date, a `BottleStrip` of one segment per bottle,
"3 of 10 linked · 7 left"). A lot with no saved split reads "Not split yet".
**Complete lots** (`unit_count` set and linked ≥ it) leave that list and sit in
a greyed "Complete" card below — not tappable, so a finished delivery can't be
reopened.

Opening a lot shows the strip large, `linked / total`, and — until the first
link — a **Bottle size** field (`codesNeeded` in `lib/lot-split.ts`: 10 L ÷ 1 L
= 10). The first bind sends `unit_count`; the server stores it on the
`PurchaseItem`, then refuses any bind past it (409 "This lot is full").
Lots never split stay uncapped, which keeps the web bind dialog working.

`GET /purchase-items` now includes `_count.stockUnits` for the progress figure.

### Mark lot complete (2026-10-12)

Once any code is linked the split is settled — the bottle-size field only
exists while a lot has **zero** linked codes, so a lot can't be resized to make
room for more. **Mark lot complete** (secondary button, confirm dialog) calls
`POST /purchase-items/:id/complete`, which sets `unit_count` to the linked
count: no more binds (409 "lot is full"), no different split. It also covers a
short delivery (9 of an expected 10) and lots linked before caps existed (null
split, uncapped until marked). Complete lots leave the list for the greyed
"Complete" card. Manager-only, like bind.

### Completing needs every unit linked (2026-10-12)

A lot with a saved bottle count completes **by itself** when its last code
links; there is no manual button for it. **Mark lot complete** exists only for
a lot that predates splits (null `unit_count`): enter the bottle size, and the
button appears once the linked count has reached the count that size implies.
`POST /purchase-items/:id/complete {unit_count}` re-checks that server-side
(400 "Only X of Y units are linked") and 409s on a lot that already has a count.

### Scan limit (2026-10-12)

The scanner knows how many the lot can still take (`remaining`): its header
reads "3 linked · 7 left" and counts down as codes land. Each bind awaits the
lot's refetch, so the next code is judged against the updated count. At 0 the
camera stops accepting codes ("This lot is full — no more codes needed"), and
a beat after the last code the scanner closes on its own. Opening the scanner
also refreshes the lot, in case another phone linked some since it was loaded.
The server still refuses a bind past the count (409); this just stops the
round trips and tells the operator before it happens.

### Overview screen: KPIs, pending, completed (2026-10-12)

With no lot chosen, the screen is three sections:

1. **KPIs** — a 2 × 2 grid of `StatCard`s: **Pending lots** (note: how many still
   need a bottle size), **Codes to link** (bottles left on lots whose count is
   known), **Linked today** (units linked since the phone's midnight, across how
   many lots), **Completed** (of all lots).
2. **Pending** — every lot not yet complete, as tappable cards with the bottle strip.
3. **Completed** — the latest five completed lots, newest finish first, not tappable
   ("latest 5 of 12" when there are more).

Figures come from `lib/link-summary.ts` (tested). `GET /purchase-items` takes
`?since=<ISO>` and returns per line `last_linked_at` and `linked_since`.
