# 03 · My Performance

> **Updated 2026-10-08 (redesign):** month stepper · hero with this month's points and a −10%…+20% scale showing where they land (zero a third of the way in, the floor easier to reach than the ceiling) · Applied/Projected adjustment · Earned and Lost cards · for a month whose payroll has run, a payslip (fixed wage + performance allowance = total pay, from `total_pay`/`fixed_wage`/`allowance`) · points as one card each (settled entries only) · pay history as cards; tapping a month opens it above. Fixed: pay history showed ৳0 for every month (the app read fields the server does not have).


**Route:** `src/app/(tabs)/me/performance.tsx` · **Tab:** Me · **Tier:** Both

---

## Purpose

What my points are worth. The loop that makes performance-linked pay mean
anything to the person being paid.

---

## Frame

```
┌────────────────────────────────────────┐
│  My performance          (Sep 2026 ▾)  │  Header 56h + month chip
├────────────────────────────────────────┤
│                                        │
│ ╭────────────────────────────────────╮ │
│ │            POINTS THIS MONTH       │ │  Hero card
│ │                                    │ │
│ │              +7                    │ │  hero mono 40, success
│ │                                    │ │
│ │        Projected  +7.0%            │ │  figure mono 20
│ │        on next month's pay         │ │  caption muted
│ ╰────────────────────────────────────╯ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ SCORE HISTORY                      │ │
│ ├────┬───────────────────────────────┤ │
│ │ +3 │ Attendance perfect      1 SEP │ │
│ │    │ "Full month, no lateness"     │ │
│ │    │ Karim · Manager               │ │
│ ├────┼───────────────────────────────┤ │
│ │ +2 │ Helped coworker        12 SEP │ │
│ │    │ Karim · Manager               │ │
│ ├────┼───────────────────────────────┤ │
│ │ −2 │ Pattern lateness       20 SEP │ │
│ │    │ Karim · Manager               │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │ PAYROLL HISTORY                    │ │
│ ├──────────────────────────────────┬─┤ │
│ │ AUG 2026     +5    +5.0%   ৳15,750│ │
│ ├──────────────────────────────────┼─┤ │
│ │ JUL 2026     −2    −2.0%   ৳14,700│ │
│ ├──────────────────────────────────┼─┤ │
│ │ JUN 2026      0     0.0%   ৳15,000│ │
│ ╰──────────────────────────────────┴─╯ │
├────────────────────────────────────────┤
│    ⌂       ▤     ╭ ＋ ╮     ⚇      ○  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

| Element | Spec |
| --- | --- |
| Title | "My performance" `h1` `ink` |
| Month picker | Trailing chip, `36h`, `pill` radius, `surfaceAlt` fill, 1px `line`. Label `label` `ink` + 16dp `chevron-down` `muted`. ⇧ month sheet. |

### Hero card — the one `hero` figure on this screen

| Element | Spec |
| --- | --- |
| Container | Card, `pad 20`, contents centred |
| Eyebrow | "POINTS THIS MONTH", `↕16` below |
| Figure | `hero` mono 40/44. `success` when > 0, `critical` when < 0, `ink` at exactly 0. Always signed — `+7`, `−2`, and plain `0` with no sign. |
| Divider | 1px `line`, full card width minus padding, `↕16` above and below |
| Projection | `figure` mono 20, same colour rule as the hero. Preceded by "Projected" in `label` `muted` on the same line, `↔8`. |
| Footnote | "on next month's pay" `caption` `muted`, `↕4` |

**No taka figure for the open month.** The clamp makes points and money
non-linear near the edges, so a projected currency amount would be wrong at
exactly the moments it matters. Percentage only, labelled *projected*.

### Score history card

| Element | Spec |
| --- | --- |
| Gutter | The signed points, `figure` mono, `success` or `critical`. This is the column you scan a score history for — it earns the gutter. |
| Line 1 | Criterion label `bodyStrong` `ink`; date `data` mono `muted` right-aligned |
| Line 2 | Reason, `body` `inkSoft`, in quotes, wrapping to two lines max then truncating |
| Line 3 | `given_by.name · role`, `caption` `muted` |
| Row height | Auto, `≥ 64h`, `pad 12/16` |
| Order | Date descending |
| Not tappable | There is no score detail screen and nothing to do with an entry. No chevron. |

### Payroll history card

A three-column aligned block — the one place in the app where mono's alignment
is doing structural work rather than cosmetic.

| Column | Width | Content |
| --- | --- | --- |
| Month | flex | `AUG 2026` `data` mono `muted`, uppercase |
| Points | 56dp, right | Signed, `data` mono, `success`/`critical`/`muted` |
| Percent | 64dp, right | `+5.0%` `data` mono, same colour |
| Amount | flex, right | `৳15,750` `figure` mono `ink` |

- Row height `56h`, `pad 12/16`, hairline between.
- **No edit affordance, ever.** `PayrollRecord` is immutable.
- Rows are not tappable. There is no payroll detail screen in v1.

### Month sheet

Standard bottom sheet. One `56h` row per month, last 12 months, newest first.
Current month is labelled "Sep 2026 · open" with the "open" in `caption`
`warning`. Selected month carries a trailing `check` in `primary`.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Hero card renders its eyebrow and a `96×44` `surfaceAlt` skeleton for the figure. Both list cards show 3 skeleton rows. |
| **Empty — no score entries** | Score history card body: `award` tile in `tintAmber`, "No score entries yet this month." The hero card still renders, showing `0` — **the total is shown as zero, never hidden.** A blank where a number belongs reads as a bug. |
| **Empty — no payroll** | Payroll card body: `calendar` tile in `surfaceAlt`, "First payroll runs at month end." |
| **Stale** | "as of HH:MM" `caption` `muted` under the hero figure's footnote line. |
| **Error** | Per card. Hero card failing shows the figure slot as "—" with a "Retry" ghost button below the footnote; the two list cards fail independently. |
| **Offline** | Stale treatment. Nothing hides. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Month chip | `36h` (≥ 48 touch area) | ⇧ month sheet |
| Month sheet row | `56h` | Set month, refetch, dismiss |
| Everything else | — | Read-only. This screen is visibility, not editability. |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /performance-score-entries?employee_id&date_from&date_to` | Hero total, score history |
| `GET /payroll-records?employee_id` | Payroll history |

`employee_id` is always the session's own id. A person sees their own record
only; Managers see others' via [13 · Employee detail](13-employee-detail.md).

---

## Notes

- **"Projected" is computed client-side** — sum the month's points, clamp to
  `[−10, +20]`. `PayrollRecord` doesn't exist until the Admin runs generate.
- **The clamp is deliberately asymmetric** (the −10% floor is easier to hit than
  the +20% ceiling). Don't visually balance it — no symmetric gauge, no
  centred meter. A bar that makes the two ends look equidistant lies about the
  incentive structure.
- **Money serialises as a string** (Prisma `Decimal` → JSON). Parse before
  formatting or summing.
- The score history is the only place a worker sees *why* they were scored. Never
  truncate the reason to one line to save space — two lines, then ellipsis.
- This is a tab root: no back button, tab bar visible.
