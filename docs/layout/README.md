# Layout Blueprints

Per-screen construction detail for the ZeroD Farms Field App: what sits where,
at what size, in what state, and what happens when it's tapped.

**These docs assume `docs/design.md`.** Tokens (`primary`, `tintAmber`,
`Spacing.lg`), control sizes (primary button = 52dp) and component behaviour are
defined there and only *named* here. If a number appears in a blueprint that
isn't in the design system, it is a one-off and the blueprint says why.

Behaviour, endpoints and product rules live in `docs/PRD.md`. Where a blueprint
and the PRD disagree about *what a screen does*, the PRD wins; where they
disagree about *how it looks*, the blueprint wins.

---

## Index

| # | Screen | Route | Tier |
| --- | --- | --- | --- |
| [00](00-app-shell.md) | App shell — header, tab bar, sheets, banners | — | Both |
| [01](01-dashboard.md) | Dashboard | `index.tsx` | Both |
| [02](02-profile.md) | Profile / identity | `profile.tsx` | Both |
| [03](03-my-performance.md) | My performance | `me/performance.tsx` | Both |
| [04](04-houses.md) | Houses | `houses/index.tsx` | Both |
| [05](05-house-detail.md) | House detail | `houses/[id].tsx` | Both |
| [06](06-task-detail.md) | Task detail | `tasks/[id].tsx` | Both |
| [07](07-log-mortality.md) | Log mortality | `log/mortality.tsx` | Both |
| [08](08-log-consumption.md) | Log feed / consumption | `log/consumption.tsx` | Both |
| [09](09-log-weight.md) | Log weight sample | `log/weight.tsx` | Both |
| [10](10-log-environment.md) | Log environment reading | `log/environment.tsx` | Both |
| [11](11-log-treatment.md) | Log treatment | `log/treatment.tsx` | Both |
| [12](12-team.md) | Team | `(manager)/team/index.tsx` | Manager |
| [13](13-employee-detail.md) | Employee detail | `(manager)/team/[employeeId].tsx` | Manager |
| [14](14-rate-employee.md) | Rate an employee | `(manager)/score.tsx` | Manager |
| [15](15-assign-task.md) | Assign a task | `(manager)/assign.tsx` | Manager |
| [16](16-house-transfer.md) | House transfer | `(manager)/transfer.tsx` | Manager |
| [17](17-feeding-program.md) | Feeding program | `(manager)/feeding-program.tsx` | Manager |
| [18](18-link-items.md) | Link items (QR scan) | `(manager)/link.tsx` | Manager |
| [19](19-report-discrepancy.md) | Report a discrepancy | `(manager)/adjust.tsx` | Manager |
| [20](20-flag-low-stock.md) | Flag low stock | `(manager)/flag-stock.tsx` | Manager |

---

## How to read a blueprint

Every file follows the same seven sections:

| Section | What it gives you |
| --- | --- |
| **Purpose** | One sentence. Why a person opens this screen. |
| **Frame** | ASCII wireframe of the screen at 390 × 844 (iPhone 14 reference). |
| **Anatomy** | Every region top to bottom: size, spacing, tokens, content. |
| **States** | Loading, empty, stale, error, offline. All five, every screen. |
| **Interactions** | Every tap target and where it goes. |
| **Data** | Endpoints, and what each field maps to on screen. |
| **Notes** | The traps. Read these before implementing. |

### Reference frame

All wireframes are drawn at **390 × 844** (iPhone 14). Everything is fluid
horizontally; nothing is pinned to a pixel width. Vertical positions in the
anatomy tables are *stack order and gap*, never absolute offsets.

```
 390 wide
├─20─┤                      ├─20─┤     screen padding (Spacing.xl)
     ├──────  350  ──────┤         content width
```

### Measurement legend

| Notation | Means |
| --- | --- |
| `52h` | 52dp tall |
| `40×40` | 40dp square |
| `↕12` | 12dp vertical gap **below** this element |
| `↔8` | 8dp horizontal gap |
| `pad 16` | 16dp padding on all sides |
| `pad 16/20` | 16dp vertical, 20dp horizontal |
| `→ route` | tapping navigates to `route` |
| `⇧ sheet` | tapping opens a bottom sheet |
| `[C]` | capability-gated — hidden when `can()` is false |

### Wireframe glyphs

| Glyph | Element |
| --- | --- |
| `╭─╮ ╰─╯` | Card (`card` radius, `card` elevation) |
| `┌─┐ └─┘` | Tinted stat card or inset well |
| `▓▓░░` | Day-cycle bar, filled / empty segments |
| `▉▉▉` | Primary button (filled) |
| `▭` | Secondary button (outlined) |
| `( )` | Chip or pill |
| `›` | Row chevron, 20dp `muted`, right-aligned |
| `●` | Status dot — **always** beside a word, never alone |
| `▢` | Icon tile, 40×40, tinted |

---

## Shared building blocks

Specified once here. A blueprint names them; it never redefines them.

### Screen scaffold

Every screen is the same three layers:

```
┌────────────────────────────────┐
│  Header            56h + inset │  ← surface, gains elevation on scroll
├────────────────────────────────┤
│                                │
│  Scroll content                │  ← ground fill
│  pad 0/20                      │     first card ↕16 below header
│                                │     last card ↕24 above tab bar
├────────────────────────────────┤
│  Tab bar         64h + inset   │  ← list/detail screens only
└────────────────────────────────┘
```

Form screens replace the tab bar with a sticky `<SubmitBar>` of the same
footprint. No screen shows both.

### Card

```
╭──────────────────────────────────╮
│ EYEBROW                 action › │  ← 11pt uppercase muted · optional trailing
│                                  │     ↕12
│ content                          │
╰──────────────────────────────────╯
```

- `surface` fill, `card` radius (16), `card` elevation, `pad 16`.
- A card that is purely a list of rows uses `pad 12/0` and lets rows own their
  own horizontal padding, so hairlines run edge to edge inside the card.
- Card header row is `44h`: eyebrow left, optional trailing action right in
  `label`-size `primary`.
- Cards are separated by `↕12`. A new section starts at `↕24`.

### Stat card

```
┌──────────────┐  ┌──────────────┐
│ ▢            │  │ ▢            │   40×40 icon tile, ↕12
│ 7,430        │  │ +7           │   stat (mono 28)
│ BIRDS        │  │ POINTS       │   eyebrow, ↕4 above
└──────────────┘  └──────────────┘
   tintGreen         tintAmber
```

- Tinted fill, `card` radius, `pad 16`, no elevation, no border.
- In a row: equal widths, `↔12`. **Two per row, or three when every figure is
  ≤ 4 characters.** Never four.
- The figure inherits the tint's semantic colour only when it *is* a status
  (mortality count in `critical`); otherwise it is `ink`.

### Ledger row

```
├────┬─────────────────────────────┤
│ H2 │ Environment reading         │  44dp gutter · 1px line · content
│    │ 09:00 · Due in 2h        ›  │  ↕2 between lines
├────┴─────────────────────────────┤
```

- Minimum `64h` (two lines), `56h` when single-line. `pad 12/16`.
- Gutter: 44dp wide, content centred, `data`-size mono, `muted` — unless it
  carries score points, which take `success`/`critical`.
- Hairline (`line`, 1px) between rows, inset to start at the gutter's left edge
  so the vertical rule and the horizontal rules form a continuous grid.
- Last row in a card has no bottom hairline.
- Chevron `›` 20dp `muted`, right-aligned, only when the row navigates.

### Form field stack

```
Label                              label · muted · ↕6
┌──────────────────────────────┐
│ value                        │   52h (64h if numeric) · surfaceAlt · line
└──────────────────────────────┘
Helper or error text               caption · muted / critical · ↕6
                                   ↕16 before the next field
```

- Focus: border becomes 2px `primary`, fill stays `surfaceAlt`.
- Error: border 2px `critical`, helper text `critical`, and the label stays
  `muted` — colouring the label too is noise.
- Required fields carry no asterisk. The submit bar's disabled state and the
  inline error carry that information instead.

### Submit bar

```
├──────────────────────────────────┤
│  ▉▉▉ Record 12 deaths        ▉▉▉ │  52h button · pad 12/20 · surface
└──────────────────────────────────┘     + bottom safe-area inset
```

- `surface` fill, `sheet` elevation (shadow points up), 1px `line` top border.
- Holds one primary button, full width. A secondary action, when one exists,
  is a ghost button *above* the primary at `44h`, never beside it.
- **The label states the value being written** — "Record 12 deaths", not
  "Submit". Disabled until the form is valid, and the label falls back to the
  bare verb ("Record mortality") when there's no value yet.

### Bottom sheet

```
        ─────                        32×4 grab handle, line, ↕8 from top
╭──────────────────────────────────╮
│ Sheet title                      │  h2 · pad 20 · ↕16
│                                  │
│ ▢  Row title                     │  64h rows
│    Row description            ›  │
╰──────────────────────────────────╯
```

- `sheet` radius on top corners only, `surface` fill, `sheet` elevation.
- Backdrop 40% black, tap to dismiss. Drag-down to dismiss.
- Max height 80% of the screen; content scrolls inside.

### Empty state

```
              ▢                     56×56 tinted tile, icon 24
                                    ↕16
        Nothing assigned today.     bodyStrong, centred
     Tap ＋ to log anything.        caption, muted, centred, ↕4
                                    ↕20
          ▭ Optional action         secondary button, auto width
```

Centred in the space the content would have occupied, with `Spacing.huge` (56)
above. Never a bare line of grey text on an empty screen.

---

## Global rules the blueprints assume

1. **Every numeral is Plex Mono.** Blueprints won't repeat this.
2. **Tab bar on list and detail screens; submit bar on forms.** Never both.
3. **Every write queues first** and confirms instantly — no screen blocks on the
   network, and no blueprint shows a loading spinner on a submit button.
4. **No row-level Edit** on a logged record, anywhere. The ledger is append-only.
5. **Any figure that drives a decision states its age when served from cache** —
   "as of 08:15" in `caption` `muted`, beside or under the figure.
6. **Manager-only regions are marked `[C]`** and are *removed* when the
   capability is false, never rendered disabled.
