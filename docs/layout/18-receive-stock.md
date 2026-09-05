# 18 · Receive Stock

**Route:** `src/app/(manager)/receive.tsx` · **Tier:** Manager `[C receive_stock]`
**Tab bar:** hidden

---

## Purpose

Bind a physical coded unit to the purchase lot it arrived on, standing at the
farm gate with a delivery truck waiting.

---

## Frame

### Step 1 — find the unit

```
┌────────────────────────────────────────┐
│  ✕   Receive stock                     │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 🔍  a3f9                       ✕ │  │  Search  56h  focused on mount
│  └──────────────────────────────────┘  │
│  Type the last few characters from     │  caption muted
│  the label. Partial codes work.        │
│                                        │
│ ╭────────────────────────────────────╮ │
│ ├────┬───────────────────────────────┤ │
│ │ ▢  │ …8b2a3f9                      │ │
│ │    │ Feed sack · unassigned     ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │ ▢  │ …c1a3f9                       │ │
│ │    │ Medicine box · unassigned  ›  │ │
│ ╰────┴───────────────────────────────╯ │
├────────────────────────────────────────┤
│                (no submit bar yet)     │
└────────────────────────────────────────┘
```

### Step 2 — pick the lot, confirm

```
┌────────────────────────────────────────┐
│  ‹   Receive stock                     │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ▢  …8b2a3f9                     ✕  │ │  Selected unit  64h  primarySoft
│ │    Feed sack                       │ │
│ └────────────────────────────────────┘ │
│                                        │
│  PURCHASE LOT                          │
│ ╭────────────────────────────────────╮ │
│ ├────┬───────────────────────────────┤ │
│ │ ◉  │ Rahman Traders                │ │  Radio rows  72h
│ │    │ Starter feed · 40 sacks       │ │
│ │    │ 4 Sep 2026 · ৳48,000          │ │
│ ├────┼───────────────────────────────┤ │
│ │ ○  │ Delta Agro                    │ │
│ │    │ Grower feed · 25 sacks        │ │
│ │    │ 1 Sep 2026 · ৳31,250          │ │
│ ╰────┴───────────────────────────────╯ │
├────────────────────────────────────────┤
│  ▉▉▉  Bind to Rahman Traders     ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Search field — `56h`, focused on mount

| Element | Spec |
| --- | --- |
| Container | `56h` (taller than the standard input — it's the screen's whole first step), `surfaceAlt`, `control` radius, 1px `line`, 2px `primary` on focus |
| Leading | 20dp `search` `muted`, `↔12` |
| Input | `data` mono `ink` — the content is a code, so it's mono |
| Trailing | `44×44` clear `✕`, only when non-empty |
| Keyboard | `default`, `autoCapitalize="none"`, `autoCorrect={false}`. Autocorrect on a hex fragment is actively harmful. |
| Debounce | 300ms before querying |
| Helper | "Type the last few characters from the label. Partial codes work." `caption` `muted`, `↕8`. Always visible — it's the instruction that makes the screen usable without a scanner. |

### Result rows — `<LedgerRow>` `64h`

| Element | Spec |
| --- | --- |
| Gutter | `▢` `32×32` `surfaceAlt` tile with an 18dp `box` icon |
| Line 1 | Unit id, **tail-anchored**: `…8b2a3f9` in `data` mono `ink`. The matched fragment is `primary`-coloured within the string. |
| Line 2 | `item.name · unassigned`, `caption` `muted` |
| Chevron | 20dp `muted` |

Showing the id's tail rather than its head is deliberate — the label on the sack
is read from the end, and a list of ids that all start `4f8e-11ef-` distinguishes
nothing.

### Selected unit bar — `64h`, `primarySoft`

Replaces the search field in step 2. Trailing `✕` returns to step 1 with the
search text preserved.

### Purchase lot list — radio rows `72h`

| Element | Spec |
| --- | --- |
| Gutter | 24dp radio, `primary` when selected, `line` ring when not |
| Line 1 | Supplier `bodyStrong` `ink` |
| Line 2 | `item.name · quantity unit`, `caption` `muted` |
| Line 3 | `date · ৳amount`, `data` mono `muted` |
| Selected | Row background `primarySoft`, `card` radius |
| Order | Purchase date descending — the truck at the gate is usually the most recent lot |

**The lot list shows only `is_unit_tracked` items.** `StockUnitService.bind`
rejects a lot whose item isn't flagged, with *"X isn't tracked by QR code — use
Move Stock instead."* Offering an untracked lot means the manager picks it and
eats a 400 for something the picker could have known. **Filter the list, don't
explain the error.**

### Submit bar

"Bind to Rahman Traders". Present only in step 2, disabled until a lot is
selected.

Confirms: "Bind …8b2a3f9 to Rahman Traders?" / "Feed sack, 4 Sep. This links the
physical unit to the lot it arrived on." / "Bind" / "Cancel".

---

## States

| State | Treatment |
| --- | --- |
| **Loading — searching** | Result card shows 3 skeleton rows. The search field keeps focus throughout; a search that steals focus on every keystroke is unusable. |
| **Empty — no query yet** | Result card is **absent**, not empty. Below the helper text sits a `<EmptyState>` with a `box` tile in `surfaceAlt` and "Search for a unit to begin." |
| **Empty — no match** | `<EmptyState>`: `search` tile `surfaceAlt`, "No unassigned unit matches that.", "Partial codes work — try fewer characters." The second line matters: the usual cause is too many characters, not too few. |
| **Empty — no lots** | Step 2's list body: `download` tile `surfaceAlt`, "No QR-tracked purchase lots.", "Lots are recorded in the admin dashboard." |
| **Stale** | Not applicable — this screen always queries live. A cached "unassigned" that's since been bound is exactly the error the confirm step catches. |
| **Error** | Search failure shows an inline `48h` `tintRed` strip above the results: "Couldn't search. Retry." A failed bind dead-letters through the outbox with the server's message. |
| **Offline** | **Search is disabled.** The field goes `surfaceAlt` with a `wifi-off` leading icon and the helper reads "Search needs a connection. Everything else in the app works offline." This is the one screen that genuinely can't work from cache — the unit list is the server's live view of what's unassigned. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Close / back | `44×44` | Step 2 → step 1; step 1 → pop |
| Search field | `56h` | Focus on mount, debounced query |
| Clear `✕` | `44×44` | Clear, refocus |
| Result row | `64h` | Select the unit → step 2 |
| Selected unit `✕` | `44×44` | Back to step 1, search preserved |
| Lot row | `72h` | Select (radio, single) |
| Submit | `52h` | Confirm → queue → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /stock-units?q=&status=UNASSIGNED` | Search results |
| `GET /purchase-items` | Lot list, filtered to `is_unit_tracked` items |
| `POST /stock-units/:id/bind` | The write, with `bound_by_id` from the session |

---

## Notes

- **`listStockUnitsQuerySchema.q` is a substring match on the unit id**,
  documented as accepting "a full scanned id or a fragment" — which is why v1
  needs no camera.
- **This is the screen QR replaces in v2.** The scan fills the same search field
  and everything downstream is unchanged. Search-first means the camera is an
  input optimisation later, not a rewrite — so don't restructure this screen
  around a scanner that doesn't exist yet, and don't leave a disabled camera
  button on it either.
- Two steps rather than one screen with two pickers: the unit determines which
  lots are even plausible, and a manager at the gate does these in sequence
  anyway.
- The confirm dialog restates the unit id. It's the only thing on screen that
  can be wrong in a way that isn't visible — supplier names are memorable, hex
  fragments aren't.
