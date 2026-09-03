# ZeroD Farms Field App — Design Guidelines

Design system for the **Employee Field App** (`fms-exe-mobile`) — the phone
client Workers and Managers use in the barn. Scope is this app only. The Admin
Web Dashboard is a separate client with its own system (`web/docs/design.md`);
where the two overlap, this doc says so and defers.

Screens this system serves are inventoried in `docs/PRD.md`. The feature set and
permission matrix it implements are `server/docs/FEATURES.md` §3.

This doc describes what is **proposed** — none of it is implemented yet. The
Expo template ships a five-token `Colors` object in `src/constants/theme.ts` and
system fonts; everything below replaces that.

---

## 1. Direction: "Field Instrument"

**This is an instrument, not a dashboard.** It is read at arm's length, in
direct sun and in a dim barn, by someone wearing gloves who is already doing
something else with their other hand.

Two consequences drive every decision here:

1. **Figures are the content.** Every screen's most important element is a
   number — a bird count, a mortality, a reading, a point total. Figures get the
   display treatment; labels get out of the way. This inverts the usual
   hierarchy, deliberately.
2. **It writes a permanent ledger.** `Consumption`, `MortalityLog`,
   `BatchHouseAllocation`, `PerformanceScoreEntry` and the rest are append-only
   at the application layer — a correction is a new offsetting row, never an
   edit (`server/docs/FEATURES.md` §4). The interface should look like the
   logbook it is.

### 1.1 Principles

1. **Colour is a data channel, not decoration.** See §2. This is the system's
   defining constraint.
2. **Never colour-alone for status.** Inherited from `web/docs/design.md` §1.3
   and non-negotiable for the same reasons — colourblind safety, and screenshots
   that get forwarded. Every status carries an icon or a word.
3. **One status vocabulary across both clients.** A CRITICAL alert is the same
   colour concept here as on the web dashboard. §2.2 maps them explicitly.
4. **Legibility beats atmosphere.** Pure white ground, near-black ink. Not a
   warm cream — this screen competes with sunlight.
5. **Dark mode is not an afterthought.** Feeding at 5am and 11pm is normal.
   Every token ships light and dark together.
6. **The thumb is the only reliable input.** One-handed reach, 48dp targets,
   primary actions bottom-anchored.

---

## 2. Colour system

### 2.1 The constraint

The interface is **monochrome**. Buttons are ink. Cards are paper. Rules are
grey. The only saturated colour on any screen belongs to **a value that means
something** — a mortality figure, a negative score, an unsynced row, an
out-of-range reading.

This is the system's one real bet. It pays off twice: it reads as disciplined
and professional, and in a barn it makes colour a dependable attention signal.
When nothing is decorative, anything coloured is worth looking at.

> The discipline **is** the design. The moment a coloured primary button or a
> tinted card appears "to add warmth," the signal stops working and every
> screen gets slower to read. This is the first thing to check in review.

This is not a departure from the web dashboard — `web/docs/design.md` §2.2 keeps
`primary` grayscale for exactly the same reason ("that's what makes a 15-page
data console feel calm"). The field app takes the same position further.

### 2.2 Tokens

Replace the `Colors` object in `src/constants/theme.ts` wholesale.

**Foundation** — the entire UI is built from these five:

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `ink` | `#101418` | `#E8ECEF` | Body text, primary buttons, the hero figure |
| `paper` | `#FFFFFF` | `#0D1014` | Screen ground |
| `field` | `#F1F3F5` | `#171B20` | Insets, pressed states, input wells |
| `line` | `#DFE3E8` | `#262C33` | Hairlines, the ledger gutter rule |
| `muted` | `#626E7A` | `#8A959F` | Secondary text, captions, eyebrows |

**Data channel** — the only saturated values in the app. Names match
`web/docs/design.md` §2.3 so one word means one thing across both clients:

| Token | Light | Dark | Field-app usage |
| --- | --- | --- | --- |
| `success` | `#11784A` | `#3DD68C` | Positive score entries, in-range readings, synced |
| `critical` | `#C0342B` | `#FF6B5E` | Mortality figures, negative scores, errors, out-of-range readings |
| `warning` | `#B26A00` | `#E8A33D` | **Queued / unsynced writes**, low stock, nearing expiry |
| `info` | `#1F6FEB` | `#5AA3FF` | Fresh-from-network marker, informational alerts |
| `neutral` | = `muted` | = `muted` | Done, cancelled, closed, inactive — no action needed |

Mobile-specific usages worth stating, since they don't exist on web:

- **`warning` means "not yet on the server."** Queue depth, pending dots, and
  the dead-letter state all draw from it. It is the most frequently seen colour
  in the app and the one a worker learns first.
- **`info` marks freshness**, not importance — a value fetched this session
  rather than served from cache.

### 2.3 The one brand touch

`web/docs/design.md` §2.2 defines a green brand accent
(`oklch(0.53 0.14 152)`) reserved for "login/logo/empty-state illustrations
only — never in tables/badges/charts."

The field app honours that scope exactly, which here means **one place**: the
splash screen and app icon. It appears nowhere in the running UI. That keeps the
two clients recognisably one product without breaking §2.1.

---

## 3. Typography

**IBM Plex Sans + IBM Plex Mono**, bundled as static TTFs in `assets/fonts/`
and loaded with `expo-font`'s `useFonts` behind the existing splash screen.
Both are OFL-licensed.

Mono is not a stylistic flourish. Figures in this app are *measurements and
codes*: aligned decimals in the ledger, batch codes (`B-24`), house tokens
(`H2`), stock-unit id fragments (`…a3f9`). Mono aligns them for free — no
`tabular-nums` workaround needed, which is the equivalent rule web has to
enforce by hand (`web/docs/design.md` §3). At hero scale it reads as "this is a
reading," which is exactly true.

### 3.1 Scale

| Role | Face | Size / line | Notes |
| --- | --- | --- | --- |
| Reading | Plex Mono 600 | 44 / 40 | The hero figure. **At most one per screen.** |
| Figure | Plex Mono 600 | 24 / 28 | Counts in lists, score chips |
| Data | Plex Mono 400 | 13 / 18 | Codes, ids, timestamps, aligned columns |
| Title | Plex Sans 600 | 20 / 26 | Screen and section titles |
| Body | Plex Sans 400 | 16 / 24 | Everything else. **Never below 16 for content.** |
| Label | Plex Sans 500 | 14 / 20 | Field labels, buttons |
| Eyebrow | Plex Sans 500 | 11 / 14 | Uppercase, `letterSpacing: 0.08em`. Section headers. |

Weights to bundle: Plex Sans Regular / Medium / SemiBold, Plex Mono Regular /
SemiBold. Five files, ~250KB. Don't add more weights — the scale above is the
whole system.

### 3.2 Rules

- **Every numeral is Plex Mono.** Counts, weights, readings, money, dates in
  data rows, percentages, points. No exceptions — the alignment is the point.
- **Every word is Plex Sans.** Including labels that sit next to figures.
- Body text never drops below 16pt. Dense-table thinking from the web dashboard
  does not transfer; there is no dense table here.
- Support Dynamic Type up to ~130% without clipping. Test the dashboard at that
  size, since it has the most stacked content.

---

## 4. Structural devices

Two, and both carry information. Neither is decoration.

### 4.1 The ledger gutter

A 44dp left column holding the row's index token, separated from content by a
hairline, with row rules crossing it.

```
 H2 │ Environment reading
    │ 09:00
────┼──────────────────────────
 H3 │ Weigh sample
    │ 11:00
────┼──────────────────────────
  — │ Fix water line · front gate
```

The gutter holds **whatever that list is actually keyed by**:

| Screen | Gutter carries |
| --- | --- |
| Dashboard tasks, house detail | House token (`H2`), em dash when not house-bound |
| Score history | The signed points (`+3`, `−2`) |
| Team list | Employee initials (`RH`) |

Location is the first thing a worker scans for — they are standing in one house
and everything else is noise. The gutter encodes that rather than decorating it.

Implemented once as `<LedgerRow>`. Don't hand-roll the layout per screen.

### 4.2 The day-cycle bar

Five segments, filled by `day ÷ expected days`, rendered wherever a batch
appears: `d21 ▓▓▓░░`.

A batch is a cohort moving through a fixed ~35-day cycle, and day-of-cycle
changes what every other number means — a 40g mortality reading is routine on
day 3 and alarming on day 30. Day is computed client-side as
`today − batch.starting_date`; there is no endpoint for it and it doesn't need
one.

Implemented once as `<DayCycleBar>`.

### 4.3 What not to add

- **No numbered markers** (01 / 02 / 03). Nothing in this app is a sequence.
- **No cards with elevation.** Hairlines and ground changes carry structure;
  shadows add visual noise that costs contrast in sunlight.
- **No zebra striping, no tinted rows.** Rows separate by rule only.

---

## 5. Spacing, radius, layout

- **4dp grid**, matching the template's existing `Spacing` scale in
  `src/constants/theme.ts` (`half 2 · one 4 · two 8 · three 16 · four 24 ·
  five 32 · six 64`). Keep it — it's already there and it's fine.
- **Radius: 8dp** for inputs, buttons and insets. One value, not a scale. A
  scale is for a component library with 40 surfaces; this app has six.
- **Touch targets ≥ 48dp**, ≥ 12dp apart. Gloved, wet, or dirty hands. The 32dp
  targets that work with a mouse do not work here.
- **Screen padding: 16dp** horizontal. The ledger gutter sits inside it.
- **Primary action is bottom-anchored** — a sticky `<SubmitBar>` at the thumb,
  content scrolling behind it. Never a button at the end of a scroll.

---

## 6. Components

Build these before the screens that need them — same discipline that made
`StatusBadge` a prerequisite on web.

| Component | Notes |
| --- | --- |
| `<LedgerRow>` | §4.1. The gutter device. |
| `<DayCycleBar>` | §4.2. |
| `<Reading>` | The hero Plex Mono figure + eyebrow caption. One per screen. |
| `<ScoreChip>` | Signed points. `success` / `critical` only — never a third state. |
| `<StatusPill>` | Task, batch, and stock-unit statuses → `neutral`/`success`/`warning`/`critical` + a word. Never colour alone (§1.2). |
| `<SyncBanner>` | Queue depth, last-synced time, dead-letter count. Tappable to retry. |
| `<SubmitBar>` | Sticky bottom. Carries the value it will write (§7). |
| `<NumberField>` | `keyboardType="decimal-pad"`, Plex Mono input, unit suffix. |
| `<HousePicker>` `<BatchResolver>` `<EmployeePicker>` `<ItemPicker>` | The four pickers. Every field that can be a choice is one. |
| `<QuickActionButton>` | The persistent FAB. Actions filtered through `can()`. |

**Empty and stale states are per-screen requirements, not a component.** A farm
app runs where the network doesn't, so "nothing yet" and "as of three hours ago"
are normal states. `docs/PRD.md` names both for every screen.

**Loading:** skeleton rows that match the layout about to appear, not spinners —
same reasoning as `web/docs/design.md` §5.

---

## 7. Voice

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
  the quick-action button, never a blank panel.
- Sentence case everywhere except eyebrows (§3.1), which are uppercase.

---

## 8. Motion

Two moments. No others.

1. **The save.** On submit, the new row slides into the ledger and the queue
   counter ticks up. ~240ms. This is the app's core promise — *it's recorded* —
   and the one thing worth animating.
2. **The flush.** Pending dots resolve from `warning` to `neutral` in sequence
   as the outbox drains.

Both respect `AccessibilityInfo.isReduceMotionEnabled()` and fall back to an
instant state change. **Losing the animation must not lose the feedback** — the
confirmation still has to be visible, just not animated.

`react-native-reanimated` is already in `package.json`. Nothing else is needed.

---

## 9. Guardrails (do / don't)

- **Do** consume colour through the theme tokens via `useTheme()`. **Don't**
  hardcode hex in a component — if a colour is needed twice it belongs in
  `constants/theme.ts`.
- **Do** keep every button, card and rule monochrome. **Don't** colour a
  primary action, tint a card, or add a gradient. That's §2.1, the whole bet.
- **Do** pair every status colour with an icon or word. **Don't** ship a bare
  coloured dot as the only signal.
- **Do** set every numeral in Plex Mono. **Don't** mix Sans figures into a
  column of Mono ones — the misalignment is exactly what the choice prevents.
- **Do** ship light and dark values together for any new token. **Don't** add
  one without the other in the same change.
- **Do** hold WCAG AA: body text ≥ 4.5:1, large text and icons ≥ 3:1, in both
  themes. **Don't** put `muted` on `field` without checking — they're close in
  lightness.
- **Do** keep one hero `<Reading>` per screen. **Don't** stack three 44pt
  figures; if everything is the hero, nothing is.
- **Do** confirm before anything irreversible. **Don't** use `critical` on a
  control just to make it prominent — it means dangerous or dead, nothing else.

---

## 10. Accessibility checklist

- [ ] Every interactive element ≥ 48dp with an `accessibilityLabel`.
- [ ] Status conveyed by icon or word, not colour alone (§1.2).
- [ ] Text/background pairs meet AA contrast in **both** themes.
- [ ] Dynamic Type to 130% without clipping — check the dashboard first.
- [ ] `isReduceMotionEnabled()` respected, with feedback preserved (§8).
- [ ] Numeric inputs open a numeric keyboard.

---

## 11. Where this lives

| What | File |
| --- | --- |
| Colour tokens, type scale, spacing | `src/constants/theme.ts` |
| Theme hook | `src/hooks/use-theme.ts` |
| Bundled fonts | `assets/fonts/` (IBM Plex Sans ×3, Plex Mono ×2) |
| Screen inventory this system serves | `docs/PRD.md` |
| Offline queue behaviour the UI reflects | `docs/offline-sync.md` |
| Feature set + permission matrix | `server/docs/FEATURES.md` §3 |
| Admin dashboard's system (shared vocabulary) | `web/docs/design.md` |
