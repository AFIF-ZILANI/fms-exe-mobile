# ZeroD Farms Field App — Design System

Design system for the **Employee Field App** — the phone client Workers and
Managers use in the barn. Scope is this app only. The Admin Web Dashboard is a
separate client with its own system (`web/docs/design.md`); where the two
overlap, this doc says so and defers.

- Screens this system serves — `docs/PRD.md`
- **Per-screen layout blueprints — `docs/layout/`** (exact sizes, positions, states)
- Offline queue behaviour the UI reflects — `docs/offline-sync.md`

---

## 0. What changed in v2, and why

v1 shipped a strict monochrome system ("Field Instrument"): ink on paper,
hairline rules, colour reserved exclusively for mortality figures and unsynced
rows. It was disciplined and it was correct about legibility. It was also
**dull, flat, and hard to parse** — every row weighed the same, nothing guided
the eye, and a screen of grey text with a UUID in it reads as unfinished rather
than as restrained.

v2 keeps what worked and fixes what didn't:

| Kept from v1 | Changed in v2 |
| --- | --- |
| Figures are the content — numerals get the display treatment | Numerals now sit **inside stat cards**, not floating on bare ground |
| Never colour-alone for status (icon or word always) | Colour is now **structural too** — brand indigo carries primary actions |
| One status vocabulary shared with the web dashboard | Added tinted surfaces, so a screen has depth without shouting |
| Mono for every numeral, so columns align for free | Sans changed to a friendlier geometric face (see §3) |
| 48dp targets, bottom-anchored primary actions | Added a **persistent bottom tab bar** — v1's FAB-only nav left workers lost |
| Dark mode ships with light, always | Cards, radii and soft shadows replace bare hairline rows |

**The v1 bet is explicitly withdrawn.** "The only saturated colour belongs to a
value that means something" made every screen equally quiet, which made none of
them scannable. v2's bet is different and stated in §2.1.

---

## 1. Direction: "Field Indigo" (was "Field Green" until 2026-10-07)

**A calm, modern instrument that still looks alive.** It is read at arm's length,
in direct sun and in a dim barn, by someone wearing gloves who is already doing
something else with their other hand.

Four consequences drive every decision here:

1. **Figures are the content.** Every screen's most important element is a
   number — a bird count, a mortality, a reading, a point total. Figures get the
   display treatment; labels get out of the way.
2. **Grouping beats density.** Related things live in a card together. A worker
   should be able to find "today's tasks" without reading a single word, purely
   from where the block sits and what shape it is.
3. **It writes a permanent ledger.** `Consumption`, `MortalityLog`,
   `BatchHouseAllocation`, `PerformanceScoreEntry` and the rest are append-only —
   a correction is a new offsetting row, never an edit. The interface should feel
   trustworthy, and never offer an Edit affordance on a logged record.
4. **The thumb is the only reliable input.** One-handed reach, 48dp minimum
   targets, primary actions bottom-anchored, navigation at the bottom of the
   screen — never the top.

### 1.1 Principles

1. **Indigo is the app.** Brand indigo carries primary actions, active navigation
   and selected states. It should be visible on every screen. Green is no longer
   the brand: it means `success` only (positive outcomes, synced, healthy).
2. **Never colour-alone for status.** Non-negotiable — colourblind safety, and
   screenshots that get forwarded. Every status carries an icon **or** a word.
3. **One status vocabulary across both clients.** A CRITICAL alert is the same
   colour concept here as on the web dashboard. §2.4 maps them.
4. **Legibility beats atmosphere.** This screen competes with sunlight. Tints are
   soft; text contrast is not.
5. **Dark mode is not an afterthought.** Feeding at 5am and 11pm is normal. Every
   token ships light and dark together, in the same change.
6. **Motion confirms, never decorates.** The only animations that survive review
   are the ones that tell a worker their write was recorded.

---

## 2. Colour

### 2.1 The bet

**Brand indigo is structural; the other saturated colours stay semantic.**

Indigo is free to appear anywhere it means "this is the app, this is the action"
— buttons, the active tab, selected chips, links, progress bars. Green, red, amber
and blue are **not** free: they keep v1's
discipline and appear only when a value means something (a mortality figure, an
unsynced write, an out-of-range reading).

This is what makes the app read as alive without becoming noisy. One colour
carries identity and action. Three colours carry meaning. Nothing carries
decoration.

> The discipline that still matters: **a red thing on screen is always bad news,
> and an amber thing is always "not on the server yet."** The moment red is used
> to make a button prominent, or amber to add warmth, the signal stops working.
> This is the first thing to check in design review.

### 2.2 Foundation tokens

The neutral ground the whole UI is built on.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `ground` | `#F6F7F9` | `#0F1117` | The page background behind cards |
| `surface` | `#FFFFFF` | `#171A22` | Card fill, sheet fill, header fill |
| `surfaceAlt` | `#F0F2F5` | `#1F232D` | Input wells, insets, pressed rows, skeletons |
| `ink` | `#0F1419` | `#E9ECF1` | Primary text, hero figures |
| `inkSoft` | `#434B57` | `#B0B7C3` | Secondary text, card body copy |
| `muted` | `#636C7A` | `#808998` | Captions, eyebrows, placeholder, inactive tabs |
| `line` | `#E3E6EB` | `#272C37` | Hairlines, card borders, dividers, input borders |

Neutrals are a cool grey (a faint blue cast in dark) so they sit with the indigo
brand. Light `muted` and every brand pair clear WCAG AA (4.5:1) — checked 2026-10-07.

### 2.3 Brand tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `#4F46E5` | `#818CF8` | Primary buttons, active tab, links, focus rings, selected state |
| `primaryPressed` | `#3B33C4` | `#6366F1` | Pressed state of anything `primary` |
| `primarySoft` | `#ECEBFD` | `#1B1A3D` | Selected chip fill, active tab pill, soft badge fill |
| `onPrimary` | `#FFFFFF` | `#0B0A26` | Text and icons on a `primary` fill |

**`primary` is no longer `success`.** Until 2026-10-07 they were the same green. The
brand is now indigo and `success` keeps the green, so "positive" never reads as "the
button colour". `info` is a darker, cyan-leaning blue so it can't be mistaken for
the indigo.

### 2.4 Semantic tokens

Names match `web/docs/design.md` so one word means one thing across both clients.

| Token | Light | Dark | Field-app usage |
| --- | --- | --- | --- |
| `success` | `#1B8A5A` | `#34D399` | Positive score entries, in-range readings, synced. Its own green, separate from `primary`. |
| `critical` | `#DC2626` | `#FF7B6B` | Mortality figures, negative scores, errors, out-of-range readings, destructive confirms |
| `warning` | `#D97706` | `#FBBF24` | **Queued / unsynced writes**, low stock, nearing expiry, over-threshold input warnings |
| `info` | `#0369A1` | `#38BDF8` | Fresh-from-network marker, informational banners |
| `neutral` | = `muted` | = `muted` | Done, cancelled, closed, inactive — no action needed |

Mobile-specific meanings worth stating, since they don't exist on web:

- **`warning` means "not yet on the server."** Queue depth, pending dots and the
  dead-letter state all draw from it. It is the colour a worker learns first.
- **`info` marks freshness,** not importance — a value fetched this session
  rather than served from cache.

### 2.5 Tint surfaces

Soft fills used **only** as card or tile backgrounds, never as text colour and
never as a border. They give a screen depth without adding saturation.

| Token | Light | Dark | Paired with |
| --- | --- | --- | --- |
| `tintGreen` | `#E7F5EE` | `#12332A` | Bird counts, positive stats, healthy houses |
| `tintAmber` | `#FEF5E7` | `#2A2110` | Points / payroll stats, queue banner |
| `tintRed` | `#FDECEC` | `#2B1616` | Mortality stats, error banners |
| `tintBlue` | `#E6F4FB` | `#0F2230` | Environment readings, info banners |

**Rule:** a tinted surface always carries a matching semantic-coloured figure or
icon. A tinted card with only neutral ink inside it is decoration — remove the
tint. Text on a tint is always `ink`, never the semantic colour at body size.

### 2.6 Elevation

Light theme uses soft shadows. Dark theme uses **borders instead of shadows** —
a shadow on a dark ground is invisible and only costs render time.

| Level | Light | Dark | Use |
| --- | --- | --- | --- |
| `flat` | none | none | Rows inside a card, list items |
| `card` | `y2 blur8 rgba(15,22,19,0.05)` + `y1 blur2 rgba(15,22,19,0.03)` | `1px solid line` | Every card |
| `raised` | `y4 blur12 rgba(79,70,229,0.24)` | `y4 blur12 rgba(0,0,0,0.4)` | Centre tab button, FAB |
| `sheet` | `y-4 blur24 rgba(15,22,19,0.12)` | `y-4 blur24 rgba(0,0,0,0.5)` | Bottom sheets, sticky submit bar |
| `header` | `y1 blur3 rgba(15,22,19,0.04)` on scroll only | `1px bottom line` on scroll only | Screen header once content scrolls under it |

Shadows never exceed these values. There is no `xl` elevation, and nothing in
this app floats above a sheet.

---

## 3. Typography

**Plus Jakarta Sans** (UI text) **+ IBM Plex Mono** (every numeral), bundled as
static TTFs in `assets/fonts/` and loaded with `expo-font`'s `useFonts` behind
the splash screen. Both are OFL-licensed.

**The sans changed in v2.** IBM Plex Sans is a technical, slightly cold face —
correct for a console, wrong for a tool a farm worker uses every morning. Plus
Jakarta Sans is geometric, open, and noticeably friendlier at body sizes while
holding up better at 11px than most humanist alternatives.

**The mono did not change.** Figures in this app are *measurements and codes*:
aligned decimals in a ledger, batch codes (`B-24`), house tokens (`H2`), stock
id fragments (`…a3f9`). Mono aligns them for free — no `tabular-nums`
workaround. IBM Plex Mono is already bundled; keep it.

Weights to bundle: Jakarta Regular / Medium / SemiBold / Bold, Plex Mono Regular
/ SemiBold. Six static TTFs. Don't add more — the scale below is the whole
system.

### 3.1 Scale

| Role | Face | Size / line | Notes |
| --- | --- | --- | --- |
| `hero` | Plex Mono 600 | 40 / 44 | The one big figure. **At most one per screen.** |
| `stat` | Plex Mono 600 | 28 / 32 | Figures inside stat cards |
| `figure` | Plex Mono 600 | 20 / 26 | Counts in list rows, score chips |
| `data` | Plex Mono 400 | 13 / 18 | Codes, ids, timestamps, aligned columns |
| `h1` | Jakarta 700 | 26 / 32 | Screen title in the header |
| `h2` | Jakarta 600 | 20 / 26 | Card titles, sheet titles |
| `bodyStrong` | Jakarta 600 | 16 / 24 | Row titles, emphasised body |
| `body` | Jakarta 400 | 16 / 24 | Everything else. **Never below 16 for content.** |
| `label` | Jakarta 500 | 14 / 20 | Field labels, button text, tab labels |
| `caption` | Jakarta 400 | 13 / 18 | Row meta, helper text, timestamps in prose |
| `eyebrow` | Jakarta 600 | 11 / 14 | Uppercase, `letterSpacing 0.08em`. Section headers. |

### 3.2 Rules

- **Every numeral is Plex Mono.** Counts, weights, readings, money, points,
  percentages, dates in data rows. No exceptions — the alignment is the point.
- **Every word is Jakarta.** Including labels that sit beside figures.
- Body text never drops below 16pt. There is no dense table in this app.
- Support Dynamic Type to ~130% without clipping. Test the dashboard first — it
  has the most stacked content.
- **Bengali falls back.** Several house names are Bengali (`বাচ্চার সেড`) and
  neither bundled face has Bengali glyphs, so those strings render in the
  platform default. Acceptable — but never apply a `letterSpacing` or
  line-height tweak that assumes Jakarta metrics to a field that can hold a
  house name.

---

## 4. Spacing, radius, layout

### 4.1 Spacing scale

4dp grid. Named by size, not by ordinal — `Spacing.lg` survives an insertion,
`Spacing.three` does not.

| Token | Value | Typical use |
| --- | --- | --- |
| `xs` | 4 | Icon-to-label gap, chip inner gap |
| `sm` | 8 | Between a label and its field, tight stacks |
| `md` | 12 | Between cards, between rows in a card |
| `lg` | 16 | Card inner padding, standard block gap |
| `xl` | 20 | **Screen horizontal padding** |
| `xxl` | 24 | Between major sections |
| `xxxl` | 32 | Above a screen's first card, below its last |
| `huge` | 56 | Empty-state vertical breathing room |

### 4.2 Radius

Four values, not one — v1's single 8dp radius made cards and inputs
indistinguishable, which is part of why screens read as flat.

| Token | Value | Applies to |
| --- | --- | --- |
| `control` | 12 | Buttons, inputs, small tiles, icon squares |
| `card` | 16 | Cards, tinted stat blocks, list containers |
| `sheet` | 24 | Bottom sheet top corners only |
| `pill` | 999 | Chips, badges, status pills, segmented toggles, avatars |

### 4.3 Layout rules

- **Screen horizontal padding: 20dp.** Cards span the full width inside it.
- **Card inner padding: 16dp.** 12dp when the card is a dense list of rows.
- **Gap between cards: 12dp.** Between sections: 24dp.
- **Touch targets ≥ 48dp**, ≥ 12dp apart. Gloved, wet, or dirty hands.
- **First card sits 16dp below the header.** Last card clears the tab bar by
  24dp plus the safe-area inset.
- **Primary action is bottom-anchored** — a sticky `<SubmitBar>` at the thumb,
  content scrolling behind it. Never a button at the end of a scroll.
- **Nothing is edge-to-edge except the tab bar, the header, and sheets.**

### 4.4 Standard control sizes

Fixed, so every screen agrees. `docs/layout/` never restates these — it names
them.

| Control | Height | Radius | Notes |
| --- | --- | --- | --- |
| Primary button | 52 | `control` | Full width inside padding. `primary` fill, `onPrimary` label. |
| Secondary button | 48 | `control` | `surface` fill, 1px `line` border, `ink` label |
| Ghost / text button | 44 | `control` | No fill, `primary` label |
| Destructive button | 52 | `control` | `critical` fill, white label. Confirm dialog only. |
| Text input | 52 | `control` | `surfaceAlt` fill, 1px `line`, 2px `primary` on focus |
| Number input | 64 | `control` | Taller — holds `figure`-size mono digits |
| Picker field | 52 | `control` | Same as input, with a trailing chevron |
| Chip / filter | 36 | `pill` | 12dp horizontal padding |
| Status pill | 24 | `pill` | 8dp horizontal padding, `caption` text |
| Icon button | 44 × 44 | `control` | 24dp icon centred |
| List row | ≥ 64 | — | 56 when the row has no second line |
| Tab bar | 64 + safe area | — | See §6.1 |
| Centre tab button | 58 × 58 | `pill` | Circle, `raised` elevation, sits 14dp proud of the bar |
| FAB | 56 × 56 | `pill` | Only where a tab bar is absent |

---

## 5. Iconography

**`@expo/vector-icons` → Feather.** Added in v2 — v1 shipped no icon library at
all and drew its few glyphs as literal text ("✓"), which is a large part of why
screens read as unfinished. This is the Expo-recommended icon package; install
it with `npx expo install @expo/vector-icons`.

Consume it through `<Icon>` and `<IconTile>` (`src/components/ui/icon.tsx`),
never by importing Feather directly — the wrappers are what keep sizes and
theme colours consistent.

- Nav and action icons: **24dp**, stroke weight as shipped.
- Inline row icons: **20dp**. Icons inside chips and pills: **16dp**.
- Icons in tinted tiles: 20dp icon centred in a 40 × 40 `control`-radius tile
  filled with the matching tint.
- **Every icon that conveys status is paired with a word.** An icon alone is
  decoration; an icon plus "Queued" is a status.

Domain icons, fixed so the same concept looks the same everywhere:

| Domain | Feather icon | Tint |
| --- | --- | --- |
| Mortality | `alert-circle` | `tintRed` |
| Feed / consumption | `package` | `tintAmber` |
| Weight | `bar-chart-2` | `tintBlue` |
| Environment | `thermometer` | `tintBlue` |
| Treatment | `plus-square` | `tintGreen` |
| Houses | `home` | `tintGreen` |
| Team | `users` | `tintGreen` |
| Points / payroll | `award` | `tintAmber` |
| Queue / sync | `refresh-cw` | `tintAmber` |

---

## 6. Structural devices

Four. All carry information; none are decoration.

### 6.1 The bottom tab bar

**New in v2.** v1 had no tab bar — navigation was a FAB plus back-stack, and a
worker three screens deep had no idea where they were or how to get home.

```
┌──────────────────────────────────────┐
│                                      │
│            screen content            │
│                                      │
├──────────────────────────────────────┤
│                  ╭───╮               │
│   ⌂       ▤     │ + │      ⚇      ○ │
│  Home   Houses  ╰───╯    Team    Me  │
└──────────────────────────────────────┘
```

- **64dp tall** plus the bottom safe-area inset, `surface` fill, 1px `line` top
  border. No shadow — the border is enough and reads cleanly in sunlight.
- **Four tabs plus a centre button**, five equal cells. Each tab: 22dp icon, 11pt
  caption, press-scale spring and a selection haptic.
- **Active tab:** icon and label switch to `primary`, and a 24×3dp `primary` tab
  slides along the bar's top edge to it. Inactive: `muted`. No pill behind the icon.
- **The centre button is Log** — the app's most frequent action. 46dp `primary`
  circle with a white 24dp `plus`, flush inside the bar (no elevation). It opens
  the log-type sheet (§6.4), it is not a route.
- **Team is Manager-only.** For a Worker the bar renders four items — Home,
  Houses, centre, Me — with the centre button still centred. The tab is removed,
  never shown disabled.
- **Hidden on** every form screen and every sheet, so the sticky submit bar owns
  the bottom. Present on all list and detail screens.

### 6.2 The ledger gutter

Kept from v1, now living **inside cards** rather than on bare ground. A 44dp
left column holding the row's index token, separated from content by a hairline,
with row rules crossing it.

```
 H2 │ Environment reading
    │ 09:00                    ›
────┼───────────────────────────
 H3 │ Weigh sample
    │ 11:00                    ›
```

The gutter holds **whatever that list is actually keyed by**:

| Screen | Gutter carries |
| --- | --- |
| Dashboard tasks, house detail | House token (`H2`), em dash when not house-bound |
| Score history | The signed points (`+3`, `−2`), coloured |
| Team list | Employee initials (`RH`) in a `primarySoft` circle |

Location is the first thing a worker scans for — they are standing in one house
and everything else is noise. Implemented once as `<LedgerRow>`; never
hand-rolled per screen.

### 6.3 The day-cycle bar

Five segments, filled by `day ÷ expected days`, rendered wherever a batch
appears: `d21 ▓▓▓░░`.

A batch is a cohort moving through a fixed ~35-day cycle, and day-of-cycle
changes what every other number means — a mortality reading that's routine on
day 3 is alarming on day 30. Day is computed client-side as
`today − batch.starting_date`; there is no endpoint for it and it doesn't need
one.

v2 spec: segments 20dp × 6dp, 3dp apart, `pill` radius. Filled segments
`primary`, empty `line`. The `d21` label is `data`-size mono in `muted`, 6dp to
the left. Implemented once as `<DayCycleBar>`.

### 6.4 The log sheet

The centre tab button opens a bottom sheet — not a route, not a menu.

- `sheet`-radius top corners, `surface` fill, `sheet` elevation, 32dp grab
  handle in `line` centred 8dp from the top.
- One 64dp row per log type: 40dp tinted icon tile, title in `bodyStrong`,
  one-line description in `caption`.
- Rows are filtered through `can()` — the same component serves both roles with
  no role branch in the JSX.
- **Context carries through.** Opened from a house screen every row deep-links
  with `?house_id=` already set. Opened from the dashboard, the form asks.

### 6.5 What not to add

- **No numbered markers** (01 / 02 / 03). Nothing in this app is a sequence.
- **No zebra striping, no tinted list rows.** Rows inside a card separate by
  hairline only; tints belong to stat cards and icon tiles.
- **No gradients.** Not on buttons, not on cards, not behind the hero figure.
- **No shadow above `raised`.** Nothing in this app needs to look like it's
  floating an inch off the glass.
- **No third elevation on a card.** A card inside a card is a layout bug.

---

## 7. Components

Build these before the screens that need them. Exact per-screen composition
lives in `docs/layout/`.

| Component | Notes |
| --- | --- |
| `<Screen>` | Ground fill, safe areas, scroll container, tab-bar bottom inset |
| `<Header>` | Screen title, optional back, optional trailing action. Gains `header` elevation on scroll. |
| `<TabBar>` | §6.1. Four tabs + raised centre button, capability-filtered. |
| `<Card>` | `surface`, `card` radius, `card` elevation, 16dp padding. The base container. |
| `<StatCard>` | Tinted card holding one `stat` figure + eyebrow caption. Used in 2- and 3-up rows. |
| `<Reading>` | The one `hero` figure per screen, with eyebrow caption. |
| `<LedgerRow>` | §6.2. The gutter device. |
| `<DayCycleBar>` | §6.3. |
| `<ScoreChip>` | Signed points. `success` / `critical` only — never a third state. |
| `<StatusPill>` | Task, batch and stock statuses → `neutral`/`success`/`warning`/`critical` + a word. Never colour alone. |
| `<SyncBanner>` | Queue depth, last-synced time, dead-letter count. `tintAmber`. Waiting: tap to sync now. Failed: tap to open the Sync center. |
| `<SubmitBar>` | Sticky bottom, `sheet` elevation. Carries the value it will write (§8). |
| `<Button>` | The five variants in §4.4. |
| `<NumberField>` | 64dp, `decimal-pad`, mono input, unit suffix, optional stepper. |
| `<TextField>` | 52dp, label above, helper/error below. |
| `<PickerField>` | 52dp, opens a select sheet. |
| `<SegmentedToggle>` | 44dp, `pill` radius, `primarySoft` active segment. |
| `<Chip>` | 36dp selectable pill. Selected = `primarySoft` fill + `primary` border + `primary` label. |
| `<LogSheet>` | §6.4. |
| `<HousePicker>` `<BatchResolver>` `<EmployeePicker>` `<ItemPicker>` | The four pickers. Every field that can be a choice is one. |
| `<EmptyState>` | Icon tile, title, one line of guidance, optional action button. |
| `<Skeleton>` | `surfaceAlt` block, subtle 1.2s pulse. |

**Empty and stale states are per-screen requirements, not a component.** A farm
app runs where the network doesn't, so "nothing yet" and "as of three hours ago"
are normal states. `docs/layout/` names both for every screen.

**Loading:** skeleton blocks matching the layout about to appear, never
spinners. A spinner tells a worker nothing; a skeleton tells them what's coming.

---

## 8. Voice

Words are design material. Plain, active, and never apologetic about the ledger.
The button names the record it writes, and the confirmation reuses that word.

| Instead of | Write |
| --- | --- |
| "Submit" | "Record 12 deaths" — the submit bar carries the value |
| "Sync pending" | "2 queued" |
| "No data available" | "Nothing assigned today." |
| "Error: request failed" | "Saved on this phone. It'll send when you're back online." |
| "Are you sure?" | "Record 50 deaths in House 2?" — restate the fact |

Rules:

- **An action keeps its name through the whole flow.** A button that says
  "Record" produces a confirmation that says "Recorded."
- **Errors don't apologise and are never vague.** Say what happened and what
  happens next. The offline case is not an error at all — it's the normal path,
  and the copy should sound like it.
- **Empty screens are invitations.** "Nothing assigned today" plus a pointer to
  the Log button, never a blank panel.
- Sentence case everywhere except eyebrows, which are uppercase.

---

## 9. Motion

Short, purposeful, and mostly about confirming a write landed.

| Moment | Spec |
| --- | --- |
| **Press** | Scale to 0.97, 80ms. Every button, card and row. |
| **The save** | New row slides into the ledger (240ms ease-out) and the queue counter ticks up. The app's core promise — *it's recorded*. |
| **The flush** | Pending dots resolve `warning` → `neutral` in sequence as the outbox drains, 120ms apart. |
| **Sheet** | Slides up 280ms `ease-out`, backdrop fades to 40% black. Dismisses on drag or backdrop tap. |
| **Tab change** | Icon and label cross-fade to `primary` 160ms; the `primarySoft` pill scales in from 0.8. |
| **Screen push** | Platform default. Don't customise it. |

All of it respects `AccessibilityInfo.isReduceMotionEnabled()` and falls back to
an instant state change. **Losing the animation must not lose the feedback** —
the confirmation still has to be visible, just not animated.

`react-native-reanimated` is already in `package.json`. Nothing else is needed.

---

## 10. Guardrails (do / don't)

- **Do** consume colour through theme tokens via `useTheme()`. **Don't** hardcode
  hex in a component — a colour needed twice belongs in `constants/theme.ts`.
- **Do** use `primary` for actions and positive outcomes freely. **Don't** use
  `critical` on a control to make it prominent — it means dangerous or dead.
- **Do** pair every status colour with an icon or word. **Don't** ship a bare
  coloured dot as the only signal.
- **Do** put a semantic figure or icon on every tinted surface. **Don't** tint a
  card that contains only neutral text — that's decoration.
- **Do** set every numeral in Plex Mono. **Don't** mix Jakarta figures into a
  column of mono ones — the misalignment is exactly what the choice prevents.
- **Do** ship light and dark values together for any new token. **Don't** add one
  without the other in the same change.
- **Do** hold WCAG AA: body text ≥ 4.5:1, large text and icons ≥ 3:1, in both
  themes. **Don't** put `muted` on `surfaceAlt` without checking — they're close.
- **Do** keep one `hero` figure per screen. **Don't** stack three 40pt figures;
  if everything is the hero, nothing is.
- **Do** confirm before anything irreversible.
- **Do** keep the tab bar visible on list and detail screens. **Don't** show it
  on a form — the submit bar owns that space.

---

## 11. Accessibility checklist

- [ ] Every interactive element ≥ 48dp with an `accessibilityLabel`.
- [ ] Status conveyed by icon or word, not colour alone.
- [ ] Text/background pairs meet AA contrast in **both** themes, tints included.
- [ ] Dynamic Type to 130% without clipping — check the dashboard first.
- [ ] `isReduceMotionEnabled()` respected, with feedback preserved (§9).
- [ ] Numeric inputs open a numeric keyboard.
- [ ] Tab bar items expose `accessibilityRole="tab"` and a selected state.
- [ ] The centre Log button is labelled "Log an entry", not "Add".

---

## 12. Where this lives

| What | File |
| --- | --- |
| Colour, type, spacing, radius, elevation tokens | `src/constants/theme.ts` |
| Theme hook | `src/hooks/use-theme.ts` |
| Bundled fonts | `assets/fonts/` (Plus Jakarta Sans ×4, IBM Plex Mono ×2) |
| **Per-screen layout blueprints** | **`docs/layout/`** |
| Screen inventory and behaviour | `docs/PRD.md` |
| Offline queue behaviour the UI reflects | `docs/offline-sync.md` |
| Feature set + permission matrix | `server/docs/FEATURES.md` §3 |
| Admin dashboard's system (shared vocabulary) | `web/docs/design.md` |
