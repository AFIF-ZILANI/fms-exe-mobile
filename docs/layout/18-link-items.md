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

| Situation | Result |
| --- | --- |
| Payload isn't a UUID | "Not a ZeroD stock code". **No request** — the QR payload *is* the StockUnit id, so anything else came off another label. |
| First sight of a valid code | Bind it |
| Same code still in frame | Silent. `onBarcodeScanned` fires continuously; a 1.5s per-code cooldown absorbs it. |
| Code already linked this session | Silent, and the cooldown refreshes. Reporting it as an error would make the screen unusable. |
| A bind is already in flight | Ignored — one request at a time, so a fast pan can't interleave. |
| Bind succeeds | Green flash, count +1, row prepended |
| Bind fails | Red flash with the server's message, error row prepended, and the code is **released** so the same label can be rescanned once the problem is fixed |

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
- No haptics yet. On a noisy farm gate with the phone at arm's length, a buzz
  per scan would carry better than a colour flash — `expo-haptics` is in Expo
  Go, so it's a small addition when someone has used this for real.
