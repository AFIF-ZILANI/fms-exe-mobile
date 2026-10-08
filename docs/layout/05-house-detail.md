# 05 · House Detail

> **Superseded 2026-10-08:** the house page now has a hero card, five "Today's records" tiles that show when each was last logged, Stock shortcuts and Open tasks; see [`../house-detail-redesign-design.md`](../house-detail-redesign-design.md). The "Recent activity" card and three-tile row below are kept for history.

**Route:** `src/app/(tabs)/houses/[id].tsx` · **Tier:** Both

---

## Purpose

Everything about the house you're standing in, and every action you might take
in it. This is the screen the day is spent on.

---

## Frame

```
┌────────────────────────────────────────┐
│  ‹   Grower shed 2                     │  Header 56h
├────────────────────────────────────────┤
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ GROWER · CAP 6,000    (● Running)  │ │  Hero card
│ │                                    │ │
│ │            4,812                   │ │  hero mono 40
│ │            LIVE BIRDS              │ │  eyebrow
│ │            as of 08:15             │ │  caption muted (stale only)
│ │  ────────────────────────────────  │ │
│ │  B-24 · Cobb 500 · Grower          │ │  data mono
│ │  d21 ▓▓▓░░            14 days left │ │
│ ╰────────────────────────────────────╯ │
│                                        │
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ ▢      │ │ ▢      │ │ ▢      │      │  Quick log row
│ │ Deaths │ │ Feed   │ │ Weight │      │
│ └────────┘ └────────┘ └────────┘      │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ RECENT ACTIVITY                    │ │
│ ├────┬───────────────────────────────┤ │
│ │ ▢  │ 12 deaths              2h ago │ │
│ ├────┼───────────────────────────────┤ │
│ │ ▢  │ 40 kg starter feed     4h ago │ │
│ ├────┼───────────────────────────────┤ │
│ │ ▢  │ 1,840 g avg · n=50     1d ago │ │
│ ├────┼───────────────────────────────┤ │
│ │ ▢  │ 31°C · 62% · 18ppm     1d ago │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ OPEN TASKS                     2   │ │
│ ├────┬───────────────────────────────┤ │
│ │ 09 │ Environment reading           │ │
│ │ 00 │ Rahim · Due in 2h          ›  │ │
│ ╰────┴───────────────────────────────╯ │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Back button, then the house name as `h1`, truncating. No trailing action — the
actions are in the body where they're reachable.

### Hero card — the screen's one `hero` figure

| Element | Spec |
| --- | --- |
| Container | Card, `pad 20` |
| Meta row | `44h`. Left: `TYPE · CAP 6,000` in `eyebrow` `muted` (capacity mono). Right: `<StatusPill>`. |
| Figure | `hero` mono 40/44 `ink`, centred, `↕4` |
| Eyebrow | "LIVE BIRDS", centred, `muted` |
| Staleness | `caption` `muted`, centred, only when cached — "as of 08:15" |
| Divider | 1px `line`, `↕16` above and below |
| Batch line | `B-24 · Cobb 500 · Grower` — code in `data` mono `ink`, breed and phase in `caption` `muted` |
| Cycle line | `<DayCycleBar>` left, "14 days left" `caption` `muted` right. Days-left goes `warning` at ≤ 3 and reads "Cycle ends today" at 0. |

**Capacity is context, not a gauge.** Don't render a fill bar of
`count ÷ capacity` — a house at 4,812 of 6,000 is not 80% of anything a worker
acts on, and the bar competes with the day-cycle bar directly beneath it.

### Quick log row — three tiles, `↔12`

| Element | Spec |
| --- | --- |
| Tile | Equal thirds, `80h`, `surface` fill, `card` radius, `card` elevation |
| Icon | `▢` `40×40` tinted tile, 20dp icon, centred, `↕8` |
| Label | `label` `ink`, centred |
| Tiles | Deaths (`alert-circle`/`tintRed`), Feed (`package`/`tintAmber`), Weight (`bar-chart-2`/`tintBlue`) |

These are the three logs recorded daily. Environment and treatment stay in the
log sheet — surfacing five tiles here makes all five equally forgettable.

**Every tile deep-links with `?house_id=` already set.** This is the single
biggest tap-saver in the app.

**Hidden entirely when the house has no batch** — every log write needs a batch,
and a tile that opens a form which can't submit is worse than no tile.

### Recent activity card

| Element | Spec |
| --- | --- |
| Gutter | `▢` `32×32` tinted domain tile, 18dp icon — not a text token. This list is keyed by *kind of record*, so the gutter carries the kind. |
| Title | The value, figure-first: "12 deaths", "40 kg starter feed", "1,840 g avg · n=50", "31°C · 62% · 18ppm". Numerals mono `ink`, words `body` `inkSoft`. |
| Trailing | Relative time `caption` `muted`, right-aligned |
| Rows | One per domain — the latest mortality, consumption, weight, environment. Four rows maximum, one per kind. |
| Not tappable | No chevron. There is no record-detail screen, and the ledger is append-only so there is nothing to do with a row. |
| Missing kind | A domain with no record is **omitted**, not shown as "—". Four rows of "no data yet" on a fresh batch is noise. |

### Open tasks card

| Element | Spec |
| --- | --- |
| Header | Eyebrow "OPEN TASKS", trailing count `label` `muted` |
| Gutter | Due time as two mono lines — `09` over `00`. Time is what a worker sorts these by. |
| Title | Task title `bodyStrong` `ink` |
| Meta | `assignee.name · Due in 2h`, `caption` `muted`. Overdue goes `critical`. |
| Order | `due_at` ascending |
| Card omitted | Entirely, when there are no open tasks — not shown empty |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Hero card renders its frame with a `120×44` skeleton for the figure and a `160×18` skeleton for the batch line. Quick log tiles render live (they're static). Both lower cards show 3 skeleton rows. |
| **Empty — no batch in this house** | Hero card figure slot reads "Empty house" in `h2` `muted` instead of a number; the batch and cycle lines are removed; the status pill reads "● Empty". Quick log tiles are **hidden**. Recent activity and open tasks still render if they have content. A `caption` `muted` line under the hero reads "Logging needs a batch in this house." |
| **Empty — no activity** | Recent activity card body: `clock` tile in `surfaceAlt`, "Nothing logged here yet.", "Use the buttons above to start." |
| **Stale** | "as of HH:MM" under the hero figure. Recent-activity relative times are computed from the record timestamps, so they stay honest without a caption. |
| **Error** | Hero card failing replaces the whole screen body with a centred error state — without a bird count and a batch, nothing else on this screen is actionable. Lower cards failing degrade individually with a "Retry" ghost button. |
| **Offline** | Stale treatment. **Quick log tiles stay enabled** — logging offline is the primary use case, not a degraded one. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop to `/houses` |
| Quick log tile | `80h` | → its form with `?house_id=` and the resolved `batch_id` |
| Task row | `≥64h` | → the mapped log form (prefilled) or `/tasks/[id]` |
| Centre tab button | `58×58` | ⇧ log sheet **with this house's context** — the sheet shows "House 2 · B-24 · 4,812 birds" under its title and every row deep-links with `?house_id=` |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /houses/:id` | Name, type, capacity |
| `GET /batch-house-balances?house_id` | Hero count, batch code, breed, phase, `starting_date` |
| `GET /mortality-logs?house_id&limit=1` | Recent activity row |
| `GET /consumptions?house_id&limit=1` | Recent activity row |
| `GET /weight-records?house_id&limit=1` | Recent activity row |
| `GET /environment-records?house_id&limit=1` | Recent activity row |
| `GET /task-assignments?house_id&status=PENDING` | Open tasks card |

Six requests. They fire in parallel and each card renders as its own resolves —
the hero card must never wait on the activity queries.

---

## Notes

- **Day-of-cycle is `today − batch.starting_date`, client-side.** "Days left" is
  `expected_days − day`, and when the batch is past its expected end the line
  reads "Day 38 of ~35" rather than a negative number.
- **This is where the hero figure belongs.** The dashboard deliberately doesn't
  use one; here, the live bird count outranks everything else on screen and
  should be readable at arm's length from across the shed.
- The quick log row and the log sheet overlap by three items on purpose. The row
  is for the worker who came here to log; the sheet is for the one who came here
  to look and then remembered something.
- **Recent activity is one row per kind, not a merged feed.** A merged
  chronological feed of the last ten writes sounds better and is worse: it
  answers "what happened recently" when the actual question is "has today's
  environment reading been done yet".
