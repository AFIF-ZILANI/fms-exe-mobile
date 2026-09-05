# 01 · Dashboard

**Route:** `src/app/(tabs)/index.tsx` · **Tab:** Home · **Tier:** Both

---

## Purpose

The screen a worker opens by reflex. Answers "what do I owe today, did my last
entries save, and how am I doing this month?" — in that order, without scrolling.

---

## Frame

### Worker

```
┌────────────────────────────────────────┐
│  Good morning                    ⚙     │  Header 56h
│  Rahim                                 │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ⟳  2 queued · synced 10:42      ↻ │ │  Sync banner (conditional)
│ └────────────────────────────────────┘ │
│                                        │
│ ┌──────────────┐  ┌──────────────┐    │
│ │ ▢ tintGreen  │  │ ▢ tintAmber  │    │  Stat row
│ │ 9,812        │  │ +7           │    │
│ │ BIRDS        │  │ POINTS · SEP │    │
│ └──────────────┘  └──────────────┘    │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ TODAY · 6 SEP            2 of 4  › │ │  Tasks card
│ ├────┬───────────────────────────────┤ │
│ │ H2 │ Environment reading           │ │
│ │    │ 09:00 · Due in 2h          ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │ H3 │ Weigh sample                  │ │
│ │    │ 11:00                      ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │ H2 │ Feed allocation    (● Done)   │ │
│ ├────┼───────────────────────────────┤ │
│ │ —  │ Fix water line                │ │
│ │    │ front gate                 ›  │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ HOUSES              as of 08:15  › │ │  Houses card
│ ├────┬───────────────────────────────┤ │
│ │ H2 │ 4,812        B-24             │ │
│ │    │ d21 ▓▓▓░░                  ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │ H3 │ 5,000        B-25             │ │
│ │    │ d14 ▓▓░░░                  ›  │ │
│ ╰────┴───────────────────────────────╯ │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

### Manager adds

Between the tasks card and the houses card:

```
│ ╭────────────────────────────────────╮ │
│ │ TEAM                       ALL   › │ │
│ ├────┬───────────────────────────────┤ │
│ │(RH)│ Rahim              2/3   (+7) │ │
│ │    │ Worker                     ›  │ │
│ ├────┼───────────────────────────────┤ │
│ │(KM)│ Karim              0/2   (−2) │ │
│ │    │ Worker                     ›  │ │
│ ╰────┴───────────────────────────────╯ │
```

And below the houses card:

```
│ ╭────────────────────────────────────╮ │
│ │ MANAGER                            │ │
│ │  ▢ Transfer    ▢ Feed plan         │ │  2-up action grid
│ │  ▢ Receive     ▢ Discrepancy       │ │
│ │  ▢ Flag stock                      │ │
│ ╰────────────────────────────────────╯ │
```

---

## Anatomy

### Header — `56h`

| Element | Spec |
| --- | --- |
| Greeting | `caption` `muted`. "Good morning" < 12:00, "Good afternoon" < 17:00, else "Good evening". |
| Name | `h1` `ink`, `employee.name`. Sits on the line below the greeting; the two together fit the 56dp with `↕0` between. |
| Trailing | `44×44` `settings` icon → `/profile`. |

No back button — this is a tab root.

### Stat row — two cards, `↔12`

| Card | Tint | Figure | Eyebrow | Source |
| --- | --- | --- | --- | --- |
| Birds | `tintGreen` | Sum of live counts across the worker's houses, `stat`, `ink` | "BIRDS" | `batch-house-balances` |
| Points | `tintAmber` | Month-to-date signed total, `stat`, `success` if > 0 / `critical` if < 0 / `ink` if 0 | "POINTS · SEP" | `performance-score-entries` |

- Icon tiles: `home` on birds, `award` on points. `40×40`, `control` radius,
  fill is the card's tint darkened one step — in practice `primarySoft` on the
  green card and a `warning`-at-12% on the amber.
- **The points card is tappable** → `/me/performance`. The birds card is not;
  it has no single destination.
- `↕20` below, before the tasks card.

### Tasks card

| Element | Spec |
| --- | --- |
| Header row | `44h`. Eyebrow "TODAY · 6 SEP" left; "2 of 4" `label` `muted` right, with a `›` when there are more than 4 tasks (→ a full task list). |
| Rows | `<LedgerRow>`, `64h`. Gutter = house token or `—`. |
| Row title | Task title, `bodyStrong` `ink`. |
| Row meta | `caption` `muted`: due time, then `· Due in 2h` when < 3h away, or `· Overdue` in `critical` when past. |
| Done rows | Title drops to `inkSoft`, no chevron, trailing `<StatusPill>` "● Done" in `neutral`. **Done tasks stay visible but sort below pending** — a worker wants proof of what they finished. |
| Order | `due_at` ascending among pending, then done. Never creation order. |
| Max rows | 4. A fifth collapses into the header's "2 of 4 ›" affordance. |

### Team card `[C assign_task]`

| Element | Spec |
| --- | --- |
| Header | Eyebrow "TEAM", trailing "ALL ›" `label` `primary` → `/team` |
| Gutter | Employee initials in a `32×32` `primarySoft` circle, `data`-size `primary` |
| Title | Name `bodyStrong`; role `caption` `muted` on line two |
| Trailing | Today's ratio `2/3` in `data` mono `muted`, `↔12`, then a `<ScoreChip>` |
| Order | Pending tasks descending — the people needing attention float up |
| Max rows | 3, then "ALL ›" |

### Houses card

| Element | Spec |
| --- | --- |
| Header | Eyebrow "HOUSES"; trailing shows staleness — "as of 08:15" `caption` `muted` when served from cache, "ALL ›" `label` `primary` when fresh. When both apply, staleness wins and "ALL" moves to a footer row. |
| Gutter | House token, `data` mono `muted` |
| Line 1 | Live count `figure` mono `ink` `↔12` batch code `data` mono `muted` |
| Line 2 | `<DayCycleBar>` with its `d21` label |
| Empty batch | Count reads "—" and the day-cycle bar is omitted; the row still navigates |

### Manager action grid `[C]`

| Element | Spec |
| --- | --- |
| Container | Card, `pad 16`, eyebrow "MANAGER" header row |
| Items | 2-up grid, `↔12` / `↕12`. Each item `64h`, `surfaceAlt` fill, `control` radius. |
| Item content | `▢` 32×32 tinted tile with 18dp icon, `↔10`, label `label` `ink`, wrapping to two lines if needed |
| Items | Transfer (`shuffle`), Feed plan (`calendar`), Receive (`download`), Discrepancy (`clipboard`), Flag stock (`flag`) |
| Odd item | The fifth sits alone on the last row at half width, left-aligned — not stretched. A stretched odd tile reads as a different, more important action. |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Header renders live from session. Stat row: two `tintGreen`/`tintAmber` cards with a `56×28` `surfaceAlt` skeleton where the figure goes. Tasks and houses cards render with 3 skeleton rows each at the real row height, so nothing shifts when data lands. |
| **Empty — no tasks** | Tasks card keeps its header, body becomes an `<EmptyState>`: `check-circle` tile in `tintGreen`, "Nothing assigned today.", "Tap ＋ to log anything." |
| **Empty — no batches** | Houses card body: `home` tile in `surfaceAlt`, "No running batches.", no action button. |
| **Empty — no team** `[C]` | Team card is **removed entirely**, not shown empty. A manager with no reports doesn't need a card telling them so. |
| **Stale** | Houses card header shows "as of HH:MM". The stat row's birds figure gets the same caption underneath in `caption` `muted`. Bird counts drive decisions; an unlabelled stale number is worse than none. |
| **Error** | Per card, not per screen: the failing card's body becomes a `48h` inset with `alert-circle` `critical`, "Couldn't load houses.", and a "Retry" ghost button. Other cards still render. A dashboard that blanks because one of four endpoints failed is worse than three-quarters of a dashboard. |
| **Offline** | Identical to stale, plus the shell's offline sync banner. No card is hidden. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Settings | `44×44` | → `/profile` |
| Points stat card | full card | → `/me/performance` |
| Task row (pending, routable type) | `64h` | → the mapped log form, with `house_id`, `batch_id`, `task_id` prefilled |
| Task row (pending, no type) | `64h` | → `/tasks/[id]` |
| Task row (done) | — | Not tappable |
| "2 of 4 ›" | `44h` | → full task list |
| Team row | `64h` | → `/team/[employeeId]` |
| "ALL ›" (team) | `44h` | → `/team` |
| House row | `64h` | → `/houses/[id]` |
| "ALL ›" (houses) | `44h` | → `/houses` |
| Manager grid item | `64h` | → its Manager form |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /task-assignments?employee_id&status&due_to` | Tasks card, "2 of 4" ratio |
| `GET /batch-house-balances` | Houses card, birds stat |
| `GET /performance-score-entries?employee_id&date_from` | Points stat |
| `GET /employees` `[C]` | Team card |
| `GET /task-assignments?employee_id&due_to=today` `[C]` | Team ratios |

Day-of-cycle is computed client-side as `today − batch.starting_date`. There is
no endpoint for it and it doesn't need one.

---

## Notes

- **This screen has no `hero` figure.** Two `stat` cards carry the numbers
  instead. The design system allows one hero per screen; the dashboard is the
  screen that shouldn't use it, because no single number here outranks the
  others. House detail is where the hero belongs.
- **Batch code, not batch name.** v1 rendered `batch.name` and a seeded
  analytics UUID leaked onto the dashboard as a house label. Render
  `batch.code`; if it's absent, render the id's last four characters in `data`
  mono — never the full string, never the raw name.
- **The "2 of 4" ratio counts today only.** Not the week, not the backlog.
- Done tasks sinking below pending is deliberate and worth defending in review —
  the instinct to hide them entirely is wrong; workers check what they finished.
- The Manager grid duplicates rows that also live in the log sheet. That's fine:
  the sheet is for *logging*, the grid is for *structural* work, and a manager
  reaching for "Transfer" is not in the same mental mode as one logging feed.
