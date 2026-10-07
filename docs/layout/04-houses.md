# 04 · Houses

> **Superseded 2026-10-07:** the Houses list is now summary tiles, All/Running/Empty chips and one card per house; see [`../houses-redesign-design.md`](../houses-redesign-design.md). The ledger-row layout below is kept for history.

**Route:** `src/app/(tabs)/houses/index.tsx` · **Tab:** Houses · **Tier:** Both

---

## Purpose

Pick where you are. The fastest path from "I'm standing in House 2" to logging
something against House 2.

---

## Frame

```
┌────────────────────────────────────────┐
│  Houses                                │  Header 56h
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ⟳  2 queued · synced 10:42      ↻ │ │  Sync banner (conditional)
│ └────────────────────────────────────┘ │
│                                        │
│  (All)  (Brooder)  (Grower)  (Layer)   │  Filter chips  36h
│                                        │
│ ╭────────────────────────────────────╮ │
│ ├────┬───────────────────────────────┤ │
│ │ H2 │ Grower shed 2                 │ │
│ │    │ 4,812 birds · B-24            │ │
│ │    │ d21 ▓▓▓░░       (● Running) › │ │
│ ├────┼───────────────────────────────┤ │
│ │ H3 │ বাচ্চার সেড                     │ │
│ │    │ 5,000 birds · B-25            │ │
│ │    │ d14 ▓▓░░░       (● Running) › │ │
│ ├────┼───────────────────────────────┤ │
│ │ H4 │ Layer house 1                 │ │
│ │    │ — · no batch                  │ │
│ │    │                 (● Empty)   › │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Title "Houses" `h1` `ink`. No trailing action — there is no house creation in
this app; houses come from the Admin dashboard.

### Filter chips — `36h`, horizontally scrollable

| Element | Spec |
| --- | --- |
| Row | `pad 0/20`, `↔8` between chips, `↕16` below, scrolls horizontally without a scrollbar |
| Chip | `36h`, `pill` radius, `pad 0/12`, `label` text |
| Unselected | `surface` fill, 1px `line`, `inkSoft` label |
| Selected | `primarySoft` fill, 1px `primary`, `primary` label |
| Options | All · Brooder · Grower · Layer, from `House.type` |
| Touch area | Expanded to 48dp vertically without changing the visual 36dp |

The row is **omitted entirely when there are three or fewer houses.** A filter
above a three-row list is furniture.

### House rows — `<LedgerRow>`, three lines, `≥ 84h`

| Element | Spec |
| --- | --- |
| Gutter | House token `data` mono `muted` |
| Line 1 | House name `bodyStrong` `ink`, truncating at one line |
| Line 2 | Live count `figure` mono `ink` + " birds" `caption` `muted`, then `·` and batch code `data` mono `muted` |
| Line 3 | `<DayCycleBar>` left; `<StatusPill>` right |
| Chevron | 20dp `muted`, vertically centred across all three lines |

`<StatusPill>` values: "● Running" `success`, "● Empty" `neutral`,
"● Closing" `warning` when `batch.status` is not `RUNNING`.

**A house with no batch** shows "—" where the count goes, "no batch" in place of
the code, omits the day-cycle bar, and keeps line 3 at its height so rows stay
uniform. The row still navigates — an empty house is where a batch gets placed.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Filter chips render immediately (they're static). List card shows 4 skeleton rows at `84h`. |
| **Empty — no active houses** | Full-card `<EmptyState>`: `home` tile in `surfaceAlt`, "No active houses.", "Houses are set up in the admin dashboard." No action button — there is nothing this app can do about it. |
| **Empty — filter matches nothing** | `<EmptyState>` inside the card: "No {type} houses.", plus a "Show all" ghost button that clears the filter. Distinct copy from the no-houses case; conflating them sends someone to the admin dashboard for a filter problem. |
| **Stale** | A `caption` `muted` line "Counts as of 08:15" sits directly under the filter row, `↕8` above the card. One line for the whole list, not per row. |
| **Error** | Card body: `alert-circle` `critical` tile, "Couldn't load houses.", "Retry" secondary button. |
| **Offline** | Stale treatment plus the shell's offline banner. Cached houses remain fully navigable — house detail works offline, and so does every log form. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Filter chip | `36h` / 48 touch | Filter the list in place. Client-side; the list is small. |
| House row | `≥84h` | → `/houses/[id]` |
| Centre tab button | `58×58` | ⇧ log sheet — **without** a house context, since this screen is a list of houses rather than one house |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /houses?active=true` | Rows, names, types, tokens |
| `GET /batch-house-balances` | Live counts, batch codes, day-of-cycle |

Joined client-side on `house_id`. Day-of-cycle is `today − batch.starting_date`.

---

## Notes

- **Inactive houses are hidden, not greyed.** `is_active` exists so history
  survives, not so the field app lists retired buildings.
- **House names can be Bengali** (`বাচ্চার সেড`). The name field must not carry a
  `letterSpacing` or line-height override that assumes Latin metrics, and it
  must be allowed to render in the platform fallback face without looking
  broken beside its Jakarta neighbours.
- Sorting is by house token, ascending, always. Not by count, not by
  most-recently-used — a worker's mental model of the farm is spatial, and
  reordering the list between visits breaks it.
- The count on this screen and the count on house detail come from the same
  cache entry. They cannot disagree; if they ever do, the join is wrong.
