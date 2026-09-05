# 00 · App Shell

The chrome every screen inherits: header, tab bar, log sheet, sync banner,
toasts and dialogs. Specified once here so no blueprint restates it.

**Route:** `src/app/_layout.tsx` (root), `(tabs)/_layout.tsx` (tab navigator)
**Tier:** Both

---

## Purpose

Give a worker a fixed frame — always know where you are, always reach the most
common action with a thumb, always see whether your writes have landed.

---

## Frame

```
┌────────────────────────────────────────┐ ← status bar, translucent
│                                        │
│  ‹   Screen title              ⚙       │  Header  56h
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ⟳  2 queued · synced 10:42      ↻ │ │  Sync banner  48h  (conditional)
│ └────────────────────────────────────┘ │
│                                        │
│                                        │
│            screen content              │
│                                        │
│                                        │
│                                        │
├────────────────────────────────────────┤
│                   ╭─────╮              │
│    ⌂       ▤     │  ＋  │    ⚇      ○ │  Tab bar  64h
│   Home   Houses  ╰─────╯   Team    Me  │
└────────────────────────────────────────┘
                                     ↕ safe-area inset
```

---

## Anatomy

### Header — `56h` + top safe-area inset

| Region | Spec |
| --- | --- |
| Container | `surface` fill, full bleed, `pad 0/20`. No border at rest. |
| On scroll | Gains `header` elevation (light) or a 1px `line` bottom border (dark), cross-faded over 160ms once content passes 8dp under it. |
| Back button | `44×44` icon button, 24dp `chevron-left`, `ink`. Leading edge flush with the 20dp padding. Absent on the four tab roots. |
| Title | `h1` (26/32) `ink`, single line, truncates with tail ellipsis. Leading-aligned — **never centred**; a centred title wastes the width a Bengali house name needs. |
| Trailing action | Optional `44×44` icon button, 24dp, `ink`. At most one. A second action belongs in the screen body. |
| Height | Fixed `56h`. It does not collapse or expand on scroll — a moving header costs more than the 56dp it saves. |

### Sync banner — `48h`, conditional

Rendered directly under the header on any screen that can write, and **only**
when the outbox is non-empty or the last sync failed. Never shown at zero queue.

| State | Fill | Icon | Copy | Trailing |
| --- | --- | --- | --- | --- |
| Queued | `tintAmber` | `refresh-cw` 20dp `warning` | "2 queued · synced 10:42" | `↻` retry icon button `44×44` |
| Syncing | `tintAmber` | `refresh-cw` rotating 1s linear | "Sending 2…" | none |
| Dead-letter | `tintRed` | `alert-circle` 20dp `critical` | "1 didn't send" | "Review ›" ghost button |
| Offline, empty queue | `tintBlue` | `wifi-off` 20dp `info` | "Offline. Writes will queue." | none |

- `card` radius, `pad 12/16`, `↔20` from screen edges, `↕12` below.
- Copy is `label`-size `ink`. The count is mono.
- Whole banner is tappable → outbox review sheet. Retry is a distinct target.

### Tab bar — `64h` + bottom safe-area inset

| Region | Spec |
| --- | --- |
| Container | `surface` fill, 1px `line` top border, **no shadow**. Full bleed. |
| Layout | Four equal columns; the centre button floats over the boundary between columns 2 and 3. Each column ≥ 48dp wide, `44h` touch area centred. |
| Icon | 24dp Feather. Active `primary`, inactive `muted`. |
| Active pill | `primarySoft` fill, `56×32`, `pill` radius, centred behind the icon. Scales in from 0.8 over 160ms. |
| Label | `label` (14/20). Active `primary`, inactive `muted`. `↕2` under the icon. |
| Centre button | `58×58` circle, `primary` fill, 24dp white `plus`, `raised` elevation. Its centre sits **14dp above** the bar's top edge. |
| Press | Whole column scales to 0.97 for 80ms. |

**Tabs:**

| # | Icon | Label | Route | Gate |
| --- | --- | --- | --- | --- |
| 1 | `home` | Home | `/` | — |
| 2 | `grid` | Houses | `/houses` | — |
| — | `plus` | *(Log)* | ⇧ log sheet | — |
| 3 | `users` | Team | `/team` | `[C] assign_task` |
| 4 | `user` | Me | `/me/performance` | — |

**Worker layout.** With Team removed the bar renders three labelled tabs. They
stay in their columns — Home, Houses, *(centre)*, Me — leaving column 3 empty
rather than re-centring, so the centre button never shifts between roles and
muscle memory survives a promotion.

**Hidden on:** every screen under `log/`, every Manager form
(`score`, `assign`, `transfer`, `feeding-program`, `receive`, `adjust`,
`flag-stock`), `tasks/[id]`, and `profile`. Those screens show a `<SubmitBar>`
or nothing.

### Log sheet — opened by the centre button

| Region | Spec |
| --- | --- |
| Handle | `32×4`, `line`, `pill` radius, centred, `↕8` from top |
| Title | "Log an entry" `h2` `ink`, `pad 20`, `↕8` below |
| Context line | Present only when launched with a house — "House 2 · B-24 · 4,812 birds", `caption` `muted`, `↕16` below |
| Rows | `64h`, `pad 12/20`. `▢` 40×40 tinted tile with 20dp icon `↔12` title block. Title `bodyStrong` `ink`, description `caption` `muted`. |
| Divider | 1px `line` between rows, inset 72dp from the left so it starts at the title, not under the tile |

**Rows, in order** (the order is the frequency order — mortality is logged
daily, treatment is not):

| Row | Icon / tint | Description | Route |
| --- | --- | --- | --- |
| Mortality | `alert-circle` / `tintRed` | "Birds that died today" | `/log/mortality` |
| Feed | `package` / `tintAmber` | "Feed or supplies drawn" | `/log/consumption` |
| Weight | `bar-chart-2` / `tintBlue` | "Average sample weight" | `/log/weight` |
| Environment | `thermometer` / `tintBlue` | "Temperature, humidity, gas" | `/log/environment` |
| Treatment | `plus-square` / `tintGreen` | "Medication or vaccination" | `/log/treatment` |
| Rate someone `[C]` | `award` / `tintAmber` | "Give or take points" | `/score` |
| Assign a task `[C]` | `check-square` / `tintGreen` | "Put work on a dashboard" | `/assign` |
| Report discrepancy `[C]` | `clipboard` / `tintAmber` | "Stock doesn't match" | `/adjust` |

Manager rows sit below a `↕8` gap and a 1px full-width `line`, so the two tiers
read as two groups without a second heading.

### Toast — write confirmation

| Region | Spec |
| --- | --- |
| Position | Bottom, 12dp above the tab bar or submit bar, `↔20` inset |
| Size | `52h`, `card` radius, `sheet` elevation |
| Fill | `ink` (inverted) with `surface`-coloured text — high contrast, unmistakable, and never confusable with a status colour |
| Content | 20dp `check` icon `↔12` message in `label` size |
| Copy | "Recorded · will sync" / "Recorded" when online and already flushed |
| Timing | Slides up 200ms, holds 2.4s, fades 160ms |

### Confirm dialog

Used only before something irreversible or costly (a mortality above threshold,
a transfer that exceeds the source count).

| Region | Spec |
| --- | --- |
| Container | Centred card, `↔32` from screen edges, `card` radius, `pad 20`, `sheet` elevation, 40% black backdrop |
| Title | `h2`, restates the fact — "Record 50 deaths in House 2?" |
| Body | `body` `inkSoft`, one or two lines of consequence |
| Actions | Stacked: primary `52h` full width, then ghost `44h` "Cancel" below. Never side by side — a mis-tap on a 2-up dialog is exactly the error being guarded against. |

---

## States

| State | Shell behaviour |
| --- | --- |
| **Loading** | Header renders immediately with its title. Body shows skeletons. Tab bar is always live — navigation never waits on data. |
| **Empty** | Per screen. The shell adds nothing. |
| **Stale** | Sync banner unaffected; staleness is a per-screen caption. |
| **Error** | A failed *read* renders in the screen body, never in the shell. A failed *write* surfaces in the sync banner's dead-letter state. |
| **Offline** | Sync banner appears in its offline variant. Nothing else changes — offline is the normal path, not a degraded mode. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop the stack |
| Header trailing | `44×44` | Screen-specific |
| Sync banner body | full width `48h` | ⇧ outbox review sheet |
| Sync banner retry | `44×44` | Flush the outbox now |
| Tab (each) | column × `44h` | Switch tab, reset that tab's stack to root on second press |
| Centre button | `58×58` | ⇧ log sheet |
| Sheet backdrop | full screen | Dismiss |

---

## Data

The shell reads nothing from the API. It reads:

| Source | Used for |
| --- | --- |
| `useSession()` | Role → which tabs and sheet rows render |
| `useOutbox()` | Queue depth, last-synced time, dead-letter count |
| `NetInfo` | Offline banner variant |
| `can(role, capability)` | Every `[C]` gate |

---

## Notes

- **The tab bar is the single biggest usability change in v2.** v1 shipped a FAB
  and a back stack; workers three screens deep had no way home and no sense of
  place. Every other change in this redesign is cosmetic next to this one.
- **Second press on the active tab resets that tab's stack.** Standard, expected,
  and the cheapest way out of a deep drill-down.
- **Never render a disabled tab.** A Worker seeing a greyed "Team" learns the app
  is withholding something. Removing it says the app is theirs.
- **The centre button is not a route.** It has no screen, no back state, and no
  entry in the navigator — it opens a sheet. Making it a route would put a
  meaningless "Log" screen in the back stack.
- **Header title is leading-aligned.** Several house names are Bengali and long;
  a centred title truncates them from both ends.
- The sync banner is **absent at zero queue**, not empty. A persistent "0 queued"
  row trains people to ignore the exact component they must not ignore.
