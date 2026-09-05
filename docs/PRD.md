# ZeroD Farms Field App — Product Requirements

The Employee Mobile App referenced in `web/docs/PRD.md` §1.3 ("gets its own PRD
when that build starts"). This is that document.

**Scope: this app only.** The Admin Web Dashboard is a separate client with its
own PRD (`web/docs/PRD.md`). Don't pull admin screens into this build.

- Feature set and permission matrix — `server/docs/FEATURES.md` §3
- Visual system — `docs/design.md`
- **Per-screen layout blueprints — `docs/layout/`** (exact sizes, positions, states)
- Offline queue behaviour — `docs/offline-sync.md`
- API reference — `server/docs/api.md`

**This doc says what each screen does. `docs/layout/` says what it looks like.**
Every screen in §6 links to its blueprint; where the two disagree about
behaviour this doc wins, and where they disagree about layout the blueprint
wins.

---

## 1. Product overview

### 1.1 What this is

The phone client for farm staff. A **Worker** standing in a barn with a bad
connection logs the day's mortality, feed, weights, environment readings and
treatments against the right house and batch, and sees what their performance
points are worth in pay. A **Manager** on the same app assigns that work, scores
the people doing it, moves birds between houses, and reconciles stock at the
farm gate.

Every write lands exactly once when signal comes back.

### 1.2 Personas

| Persona | Who | Uses |
| --- | --- | --- |
| Worker | Field staff, the bulk of daily data entry | Dashboard, 5 log forms, own performance |
| Manager | Supervises Workers, handles structural and stock actions | All of the above, plus the 8 Manager screens |
| Admin | The farm operator | **Not this app.** `web/` dashboard — see `web/docs/PRD.md` |
| Intern | Entry-level, supervised | **Not in v1.** `FEATURES.md` §3.4, one key in the capability map |

### 1.3 Scope boundary

v1 covers the Worker tier (`FEATURES.md` §3.2) and the **full** Manager tier
(§3.3), plus task assignment. Out of scope is listed in §7.

---

## 2. Global app shell

Full construction detail in [`docs/layout/00-app-shell.md`](layout/00-app-shell.md).

**Root layout** provides, in order: the React Query client with an AsyncStorage
persister, the session (identity + role), and outbox initialisation.

**Navigation is a bottom tab bar** — four tabs plus a raised centre button:

| Tab | Route | Gate |
| --- | --- | --- |
| Home | `/` | — |
| Houses | `/houses` | — |
| *(centre)* | opens the log sheet, §5 | — |
| Team | `/team` | `assign_task` |
| Me | `/me/performance` | — |

**This replaced the v1 shell**, which had no tab bar — navigation was a floating
action button plus a back stack, and a worker three screens deep had no way home
and no sense of place. The tab bar is the single largest usability change in the
v2 design pass.

The tab bar is **hidden on every form screen** (all of `log/`, every Manager
form, `tasks/[id]`, `profile`), where a sticky `<SubmitBar>` owns the bottom
instead. No screen shows both.

**Screen header** — 56dp, leading-aligned title, optional back, at most one
trailing action. Every screen that can write shows the queue state
(`<SyncBanner>`) beneath it, and **only when the queue is non-empty**.

**Route groups** — expo-router file routes. The `(manager)` group holds every
Manager screen; its `_layout.tsx` redirects to `/` when
`!can(role, 'assign_task')`, so the tier is gated in one place rather than per
screen. Manager-only tabs and sheet rows are **removed**, never rendered
disabled.

---

## 3. Cross-cutting rules

These affect behaviour on many screens. Stated once.

- **No auth.** v1 ships a profile switcher (§6.2) as a stand-in; Google OAuth
  replaces it later. Every write reads its actor id (`recorded_by_id` /
  `measured_by_id` / `administered_by_id` / `given_by_id` / `assigned_by_id` /
  `bound_by_id`) from the session, never from a picker.
- **Roles are UI shape, not security.** Nothing is enforced server-side — every
  endpoint is open to anyone who can reach the API, which is already true of
  `web/` today. `src/lib/permissions.ts` decides what a person *sees*. Do not
  describe it as a permission boundary.
- **Every write queues first.** No form blocks on the network. See
  `docs/offline-sync.md`.
- **Append-only.** Corrections are new offsetting entries, never edits. No
  screen offers a row-level Edit on a logged record.
- **Money serialises as a string** (Prisma `Decimal` → JSON). Parse before
  formatting or summing — same rule as `web/docs/PRD.md` §4.
- **Reads are cached and may be stale.** Any screen showing a number that drives
  a decision states its age when served from cache.

---

## 4. Permission matrix (v1 subset)

From `FEATURES.md` §3.5, restricted to the two roles this version ships.
Encoded in `src/lib/permissions.ts`.

| Capability | Worker | Manager |
| --- | --- | --- |
| `view_batch` | ✅ | ✅ |
| `log_environment` | ✅ | ✅ |
| `log_weight` | ✅ | ✅ |
| `log_mortality` | ✅ | ✅ |
| `log_consumption` | ✅ | ✅ |
| `log_treatment` | ✅ | ✅ |
| `view_own_performance` | ✅ | ✅ |
| `assign_task` | ❌ | ✅ |
| `score_employee` | ❌ | ✅ |
| `house_transfer` | ❌ | ✅ |
| `feeding_program` | ❌ | ✅ |
| `receive_stock` | ❌ | ✅ |
| `report_discrepancy` | ❌ | ✅ |
| `flag_low_stock` | ❌ | ✅ |

---

## 5. The log sheet

The tab bar's raised centre button opens a bottom sheet of actions filtered
through `can()` — the same component serves both roles with no role branch in
the JSX. Layout in [`docs/layout/00-app-shell.md`](layout/00-app-shell.md#log-sheet--opened-by-the-centre-button).

| Worker | Manager adds |
| --- | --- |
| Log mortality | Rate an employee |
| Log feed / consumption | Assign a task |
| Log weight sample | Report stock discrepancy |
| Log environment reading | |
| Log treatment | |

**The centre button is not a route.** It has no screen and no back state — it
opens a sheet. Making it a route would put a meaningless "Log" screen in the
back stack.

**Context carries through.** Opened from a house screen, every action
deep-links with `?house_id=` already set, so the most common path — standing in
House 2, logging House 2's mortality — never asks which house, and the sheet
shows that house's batch and live count under its title. Opened from the
dashboard or the houses list, the form asks.

House detail additionally surfaces the three daily logs — mortality, feed,
weight — as tiles in the screen body, so the most common path is one tap rather
than two. Environment and treatment stay sheet-only; surfacing five tiles makes
all five equally forgettable.

"Rate an employee" is the quick path the scoring loop depends on: two taps from
anywhere to employee → criterion → reason. A manager who has to navigate three
levels to record "helped a coworker" records it never, and the point ledger
degrades into month-end guesswork.

---

## 6. Screens

Each follows the same template: **Purpose · Layout · Actions · Empty/Stale ·
Endpoints · Notes.** The **Layout** sections here are a sketch of intent; the
buildable version — every size, position, state and tap target — is the
matching file in [`docs/layout/`](layout/README.md).

| § | Screen | Blueprint |
| --- | --- | --- |
| — | App shell, tab bar, log sheet | [00](layout/00-app-shell.md) |
| 6.1 | Dashboard | [01](layout/01-dashboard.md) |
| 6.2 | Profile / identity | [02](layout/02-profile.md) |
| 6.3 | My performance | [03](layout/03-my-performance.md) |
| 6.4 | Houses | [04](layout/04-houses.md) |
| 6.5 | House detail | [05](layout/05-house-detail.md) |
| 6.6 | Task detail | [06](layout/06-task-detail.md) |
| 6.7 | Log mortality **(+ the shared form spine)** | [07](layout/07-log-mortality.md) |
| 6.8 | Log feed / consumption | [08](layout/08-log-consumption.md) |
| 6.9 | Log weight | [09](layout/09-log-weight.md) |
| 6.10 | Log environment | [10](layout/10-log-environment.md) |
| 6.11 | Log treatment | [11](layout/11-log-treatment.md) |
| 6.12 | Team | [12](layout/12-team.md) |
| 6.13 | Employee detail | [13](layout/13-employee-detail.md) |
| 6.14 | Rate an employee | [14](layout/14-rate-employee.md) |
| 6.15 | Assign a task | [15](layout/15-assign-task.md) |
| 6.16 | House transfer | [16](layout/16-house-transfer.md) |
| 6.17 | Feeding program | [17](layout/17-feeding-program.md) |
| 6.18 | Receive stock | [18](layout/18-receive-stock.md) |
| 6.19 | Report a discrepancy | [19](layout/19-report-discrepancy.md) |
| 6.20 | Flag low stock | [20](layout/20-flag-low-stock.md) |

**Routes moved in v2.** The four tab roots and their children now live under a
`(tabs)` group — `index.tsx` is `(tabs)/index.tsx`, `houses/` is
`(tabs)/houses/`, and so on. Form screens stay outside it so they render without
a tab bar. The route line at the top of each blueprint is authoritative; the
paths in the headings below are the v1 names and are kept only so the two docs
diff cleanly.

### 6.1 Dashboard — `index.tsx`

**Purpose.** The screen a worker opens by reflex. Answers "what do I owe today,
and did my last entries actually save?"

**Layout.** Full wireframe and anatomy in
[`layout/01-dashboard.md`](layout/01-dashboard.md). In outline, top to bottom:

1. **Header** — greeting + name, settings action.
2. **Sync banner**, only when the queue is non-empty.
3. **Stat row** — two tinted cards: total live birds (`tintGreen`), month-to-date
   points (`tintAmber`, tappable → §6.3).
4. **Today's tasks card** — ledger rows keyed by house token, done tasks sunk
   below pending, max four then a "2 of 4 ›" affordance.
5. **Team card** `[C assign_task]` — ledger rows keyed by employee initials,
   showing today's ratio and a month-to-date `<ScoreChip>`, sorted by pending
   tasks descending.
6. **Houses card** — ledger rows keyed by house token: live count, batch code,
   `<DayCycleBar>`.
7. **Manager action grid** `[C]` — a 2-up grid of the five structural actions:
   Transfer, Feed plan, Receive, Discrepancy, Flag stock.

The gutter holds employee initials on the team card instead of a house token —
same device, same 44dp column, indexing whatever the list is keyed by.

**This screen has no hero figure.** Two stat cards carry the numbers; no single
number here outranks the others. The hero belongs on §6.5.

**Actions.** Task row → its form (§6.7–6.11) or the task detail (§6.6). Identity
→ §6.2. Score block → §6.3. House row → §6.5. Team row → §6.13.

**Empty.** No tasks → "Nothing assigned today." plus a pointer to the quick
button. No batches → "No running batches."

**Stale.** Served from cache, HOUSES carries "as of 08:15" against the counts.
Bird counts drive decisions; an unlabelled stale number is worse than none.

**Endpoints.** `GET /task-assignments?employee_id&status&due_to`,
`GET /batch-house-balances`,
`GET /performance-score-entries?employee_id&date_from`, and for Managers
`GET /employees`.

**Notes.** Done tasks stay visible but sink below pending — a worker wants proof
of what they finished. Order is `due_at`, not creation.

---

### 6.2 Profile / identity — `profile.tsx`

**Purpose.** The auth stand-in, and the only place role changes.

**Layout.** Current identity card (name, role, mobile). Below it, the list of
`Employees` with name and role; tapping switches. A persistent banner: **"No
login yet — pick who you are. This is temporary."** Link to §6.3.

**Empty.** No employees → the API base URL and a "can't reach the server" state,
since that's the actual cause on a fresh setup.

**Endpoints.** `GET /employees?limit=100` (includes `profile` and `role`).

**Notes.** Switching identity **clears the React Query cache** — otherwise the
previous person's tasks and scores flash on the new person's dashboard. It must
**not** clear the outbox: queued writes carry their own actor id, stamped at
enqueue time.

---

### 6.3 My performance — `me/performance.tsx`

**Purpose.** What my points are worth. The loop that makes performance-linked
pay mean anything to the person being paid.

**Layout.** Full wireframe and anatomy in
[`layout/03-my-performance.md`](layout/03-my-performance.md). In outline:

1. **Header** — title plus a month-picker chip.
2. **Hero card** — the month's signed point total as the screen's one `hero`
   figure, with the projected percentage and its "on next month's pay" footnote
   beneath a divider.
3. **Score history card** — ledger rows whose gutter carries the signed points;
   criterion, reason in quotes, then who gave it.
4. **Payroll history card** — month, points, percentage and amount in four
   mono-aligned columns.

The gutter carries the signed points — the one column you scan a score history
for. Mono aligns the payroll figures without a table.

**Actions.** Month picker. Read-only otherwise: `FEATURES.md` §3.1 is explicit
that this is "visibility, not editability."

**Empty.** No entries this month → "No score entries yet this month," with the
total shown as `0`, not hidden. No payroll rows → "First payroll runs at month
end."

**Endpoints.** `GET /performance-score-entries?employee_id&date_from&date_to`,
`GET /payroll-records?employee_id`.

**Notes.**
- **"Projected" is computed client-side** — sum the month's points, clamp to
  [−10, +20]. `PayrollRecord` doesn't exist until the Admin runs generate.
  Label it *projected* and **show no taka figure for the open month**; the clamp
  makes points and money non-linear near the edges.
- **`PayrollRecord` is immutable.** No edit affordance on a past month, ever —
  same rule as `web/docs/PRD.md` §6.11.
- The clamp is deliberately asymmetric (the −10% floor is easier to hit than the
  +20% ceiling). Don't visually balance it.
- A person sees their own record only. Managers see others' via §6.13.

---

### 6.4 Houses — `houses/index.tsx`

**Purpose.** Pick where you are.

**Layout.** One row per house in the ledger gutter: house token, name, type
(`BROODER`/`GROWER`/`LAYER`), live bird count in Mono, batch code and
`<DayCycleBar>`. `<SyncBanner>` above.

**Empty.** "No active houses."

**Endpoints.** `GET /houses?active=true`, `GET /batch-house-balances`.

**Notes.** Inactive houses are hidden, not greyed — `is_active` exists so
history survives, not so the field app lists retired buildings.

---

### 6.5 House detail — `houses/[id].tsx`

**Purpose.** Everything about the house you're standing in, and every action you
might take in it.

**Layout.** Header: name, type, capacity. Current batch — code, breed, phase,
day-of-cycle with `<DayCycleBar>`, live count as the hero `<Reading>`. Then
RECENT ACTIVITY in the gutter: last mortality, environment reading, weight
sample and feed draw, each with a relative timestamp ("2h ago"). Then this
house's open tasks.

**Actions.** Three quick-log tiles in the screen body — mortality, feed, weight —
plus the tab bar's centre button, which opens the log sheet with this house's
context. All of them carry `?house_id=` into the form, which is the single
biggest tap-saver in the app. The tiles are hidden when the house has no batch,
since every log write needs one.

**Empty.** No batch in this house → "Empty house," and the log actions hide,
since every log write needs a batch.

**Endpoints.** `GET /houses/:id`, `GET /batch-house-balances?house_id`,
`GET /mortality-logs?house_id&limit=1` and the same for environment / weight /
consumption, `GET /task-assignments?house_id&status=PENDING`.

**Notes.** Day-of-cycle is `today − batch.starting_date`, client-side.

---

### 6.6 Task detail — `tasks/[id].tsx`

**Purpose.** One task, and the one thing to do about it.

**Layout.** Title, description, task type, location (house name or
`location_note`), due time, who assigned it. Then either:

- **Routable type** → a full-width primary "Open form" button, deep-linking with
  `house_id` / `batch_id` / `task_id` prefilled.
- **No type, or an unrecognised one** → completion note field + "Mark done."

**Actions.** Mark done. Cancel (Manager only).

**Endpoints.** `GET /task-assignments/:id`,
`POST /task-assignments/:id/complete`, `POST /task-assignments/:id/cancel`.

**Notes.** This is where the unknown-`TaskType` fallback surfaces. An
unrecognised code renders the mark-done branch with the type as a plain label —
the worker still knows what was asked, and nothing errors. See §8.

---

### 6.7–6.11 The five log forms

All share the spine: **house → batch (auto) → fields → sticky submit.** Each
shows the resolved batch and its live bird count under the house picker, so the
worker can check they're logging against the right flock before writing.

`GET /batch-house-balances?house_id=X` is the batch resolver for every one of
them, and doubles as the count display.

| § | Screen | Fields | Notes |
| --- | --- | --- | --- |
| 6.7 | Mortality | house, **count died**, cause note?, date | Count focused on mount. Warn (don't block) if count > 2% of live birds — a fat-finger `50` for `5` is the costly typo, and `BatchHouseBalance` decrements for real. |
| 6.8 | Consumption | house, **item**, quantity, unit, note?, date | Items filtered to `is_unit_tracked: false` — see below. Unit defaults from the item; `base_quantity` is server-computed. No `stock_unit_id` without QR. |
| 6.9 | Weight | house, **average weight (g)**, sample size, date | Server enforces `@@unique([batch_id, house_id, date])` — one sample per house per day, so `date` is submitted truncated to midnight or the constraint never actually bites. There is **no update endpoint** for WeightRecords (create + list only), so a same-day duplicate can't be "replaced" — it surfaces through the outbox's normal dead-letter path instead. |
| 6.10 | Environment | house, temp °C, humidity %, ammonia ppm, CO₂ ppm, pressure hPa, **time period** | Five readings stacked in one keypad-friendly column, not a grid. `time_period` defaults from the device clock, overridable. |
| 6.11 | Treatment | **type toggle** (medication / vaccination), house, name, dosage, cause?, doctor?, remarks? | One screen, two endpoints. Doctor optional — treatments happen without one. |

**Empty/loading.** No houses → the same "can't reach server" state as §6.2.
Batch unresolved → submit disabled with "No batch in this house," not a silent
failure at POST time.

**On submit.** Queue, confirm instantly ("Saved · will sync"), navigate back. If
launched from a task, mark that task done too. **Never block on the network.**

**Endpoints.** `POST /mortality-logs`, `/consumptions`, `/weight-records`,
`/environment-records`, `/medications` | `/vaccinations`.

**`is_unit_tracked` splits the item list.** `Item.is_unit_tracked` — not
category — decides whether an item is individually QR-coded (`StockUnit`) or
tracked as an aggregate quantity (`StockLedger`), and the server gates `bind()`
and `TransferService.create()` on it so the two mechanisms can't mix for one
item. Without QR in v1, §6.8 draws only from `is_unit_tracked: false`.

`listItemsQuerySchema` currently filters by `category` and `is_active` only, so
either the app filters client-side or the server gains an `is_unit_tracked`
query param (one line, mirroring `is_active`). **Prefer the server filter** —
client-side filtering of a paginated list silently drops matches past page one.

---

### 6.12 Team — `(manager)/team/index.tsx`

**Purpose.** Who's working, and how they're doing.

**Layout.** Gutter carries initials. Per row: name, role, today's task progress
(`2/3`), month-to-date `<ScoreChip>`. Sorted by pending tasks descending — the
people needing attention float up.

**Actions.** Row → §6.13. Header action → §6.15.

**Empty.** "No employees yet."

**Endpoints.** `GET /employees`,
`GET /task-assignments?employee_id&due_to=today`,
`GET /performance-score-entries?employee_id&date_from`.

---

### 6.13 Employee detail — `(manager)/team/[employeeId].tsx`

**Purpose.** One person: what they're on, and their record.

**Layout.** Profile header (name, role, joining date, rating). MTD
`<ScoreChip>`. Today's tasks. Score history feed — criterion, points, reason,
who gave it, when.

**Actions.** **Rate** → §6.14 with `?employee_id=`. **Assign task** → §6.15 with
`?employee_id=`.

**Endpoints.** `GET /employees/:id`, `GET /task-assignments?employee_id`,
`GET /performance-score-entries?employee_id`.

**Notes.** Managers see others' scores here; Workers see only their own (§6.3).
The split is capability-driven, not two components.

---

### 6.14 Rate an employee — `(manager)/score.tsx`

**Purpose.** Record a point entry in under fifteen seconds, at the moment the
thing happened. The quality of the whole payroll system depends on this being
fast enough to actually use.

**Layout.** Full wireframe and anatomy in
[`layout/14-rate-employee.md`](layout/14-rate-employee.md). In outline:

1. **Subject bar** — a `primarySoft` block showing who is being rated and their
   month-to-date total. Tappable to change **only** when no `?employee_id=` was
   passed; always shown, so a deep-linked manager can confirm the person before
   committing points to their pay.
2. **Positive criteria** — wrapping chips, each carrying its point value.
3. **Negative criteria** — the same, visually separated, below a red eyebrow,
   never the default scroll position.
4. **"Other…"** — reveals an inline ±1..±5 stepper, excluding zero.
5. **Reason** — required, validated before enqueue.
6. **Submit bar** — "Record +2 points", signed and coloured.

Selection is single across both groups; choosing a chip collapses the stepper
and vice versa. They are the same field.

**Actions.** Chips carry their point value. The value is **shown, never
editable** — it's a server-side snapshot from `FIXED_CRITERION_POINTS`. `OTHER`
is the only case revealing a points control, constrained to ±1..±5 excluding 0
(the server refines exactly this).

**Validation.** Reason is required and the server rejects blank — validate
before enqueueing, or the row dead-letters for a reason the manager can't see.

**Endpoints.** `POST /performance-score-entries`, `given_by_id` from session.

**Notes.** Negative criteria are visually separated and never the default scroll
position. Positive-first ordering is deliberate: the ledger is meant to be
mostly a record of good work, and a UI that surfaces penalties first quietly
teaches the opposite.

---

### 6.15 Assign a task — `(manager)/assign.tsx`

**Purpose.** Put work on someone's dashboard.

**Layout.** Employee picker → task picker (`GET /tasks?active=true`, showing
each task's type) → title (prefilled from the task's label, editable) →
description → **location as a segmented toggle: House ▾ | Other**, where "Other"
swaps in the free-text `location_note` → due date and time.

**Endpoints.** `GET /employees`, `GET /tasks?active=true`,
`GET /houses?active=true`, `POST /task-assignments`.

**Notes.** The toggle is the UI expression of the server's rule that `house_id`
and `location_note` are mutually exclusive. Making it a toggle means the invalid
combination **can't be expressed**, rather than being caught at POST.

---

### 6.16 House transfer — `(manager)/transfer.tsx`

**Purpose.** Move birds between houses, or correct a count.

**Layout.** Batch picker → from-house (with its live count) → to-house →
quantity → reason toggle `TRANSFER` | `ADJUSTMENT`.

**Endpoints.** `GET /batches?status=RUNNING`,
`GET /batch-house-balances?batch_id`, `POST /batch-house-allocations`.

**Notes.** The server requires at least one of from/to — a one-sided row is a
correction. Show the source house's live count beside the quantity field and
warn when quantity exceeds it: this write decrements `BatchHouseBalance` inside
a transaction, and a wrong number quietly corrupts every downstream count.
`INITIAL` is set by `BatchService.create` and is **not** client-choosable.

---

### 6.17 Feeding program — `(manager)/feeding-program.tsx`

**Purpose.** Which feed a batch gets, on which days.

**Layout.** Batch picker, then the existing program as a day-range timeline
(`0–10 Pre-starter · 11–24 Starter · 25– Grower`), then an add form: feed type,
item, start day, end day (optional — open-ended is the last phase).

**Empty.** "No feeding program set for this batch."

**Endpoints.** `GET /batch-feeding-programs?batch_id`, `POST` same,
`PATCH /:id` (end_day only — all the server's update schema accepts).

**Notes.** Flag overlapping or gapped day ranges. The server doesn't validate
ranges, so a silent gap means a batch with no feed type on day 12.

---

### 6.18 Receive stock — `(manager)/receive.tsx`

**Purpose.** Bind a physical coded unit to the purchase lot it arrived on, at
the farm gate.

**Layout.** Search field ("last few characters from the label") → results from
`GET /stock-units?q=&status=UNASSIGNED`, each showing its id tail in Mono → pick
one → pick the `PurchaseItem` lot (supplier, item, date) → confirm.

**Empty.** No match → "No unassigned unit matches that," plus the reminder that
partial codes work.

**Endpoints.** `GET /stock-units?q=&status=UNASSIGNED`, `GET /purchase-items`,
`POST /stock-units/:id/bind` with `bound_by_id`.

**Notes.** `listStockUnitsQuerySchema.q` is a substring match on the unit id,
documented as accepting "a full scanned id or a fragment" — which is why v1
needs no camera. This is the screen QR replaces in v2: the scan fills the same
search field and everything downstream is unchanged. Search-first means the
camera is an input optimisation later, not a rewrite.

**The lot picker must show only `is_unit_tracked` items.** `StockUnitService.bind`
rejects a lot whose item isn't flagged, with *"X isn't tracked by QR code — use
Move Stock instead."* Offering an untracked lot means the manager picks it and
eats a 400 for something the picker could have known. Filter the list, don't
explain the error.

---

### 6.19 Report a discrepancy — `(manager)/adjust.tsx`

**Purpose.** The shelf doesn't match the ledger. Say so now.

**Layout.** Item picker → location toggle **Warehouse | House** → quantity on
record (prefilled from the ledger, read-only) → quantity counted → the computed
delta, shown large and signed → reason (required) → note.

**Endpoints.** `GET /items`, `GET /stock-ledger?item_id` for the current
balance, `POST /inventory-adjustments`.

**Notes.** The server takes `quantity_before` and `quantity_after` and derives
`adjustment_quantity`; show that delta before submit so the manager sees what
they're asserting. One of warehouse/house is required — same toggle trick as
§6.15.

---

### 6.20 Flag low stock — `(manager)/flag-stock.tsx`

**Purpose.** Raise a reorder signal without touching Purchases — finance stays
Admin's.

**Layout.** Item picker → type `FEED` | `MEDICINE` → level (default `WARNING`) →
title (prefilled "Low stock: {item}") → description.

**Endpoints.** `POST /alerts`, `related_id` = the item id.

**Notes.** **`Alerts` has no actor column** — no `raised_by_id` anywhere in the
schema. Until one exists, prefix the description with the manager's name so the
Admin knows who raised it. Worth a real field later; not worth a migration now.

---

## 7. v1 boundaries

Don't scope-creep these into this pass:

- **No auth.** Google OAuth replaces the profile switcher, at which point the §4
  matrix moves server-side as real middleware.
- **No QR scan.** `expo-camera` needs a development build; the `q` fragment
  search covers §6.18 and §6.8. First thing to add in v2 — a faster input path
  for existing flows, not new functionality.
- **No Intern tier** (`FEATURES.md` §3.4) — one key in `CAPABILITIES`, plus the
  "assist" nuance on weight sampling that the matrix leaves undefined.
- **No recurring tasks.** Managers create each assignment.
- **No admin web Tasks page.** Tasks and task types are API-only this pass.
- **Mobile never writes payroll.** It reads `PayrollRecord`; the monthly run
  stays Admin-only in `web/` (PRD §6.11).
- **No server-side permission enforcement** — see §3.

---

## 8. Task types are soft-coded

Three levels, all backed by the server:

```
TaskType    ENVIRONMENT · MORTALITY · WEIGHT · …   which screen this opens
   ↑
Tasks       "Morning environment reading" · "Clean waterers"   the catalogue
   ↑
EmployeeTaskAssignment   "Rahim, House 2, 09:00, PENDING"   the actual work
```

`TaskType` and `Tasks` are admin-managed lookups — rows, not Prisma enums, so
adding one needs no migration. `Tasks.task_type_id` is nullable: a task with no
type ("Fix water line") is a plain mark-done item. Several tasks can share one
type, which is why the levels are separate.

`src/lib/task-forms.ts` maps `TaskType.code` → screen:

```ts
export const TASK_FORMS = {
  MORTALITY:   '/log/mortality',
  CONSUMPTION: '/log/consumption',
  WEIGHT:      '/log/weight',
  ENVIRONMENT: '/log/environment',
  MEDICATION:  '/log/treatment?type=medication',
  VACCINATION: '/log/treatment?type=vaccination',
} as const;
```

**A code that isn't a key here falls back to the mark-done sheet** (§6.6) —
never a crash, never a blank screen. That fallback is what makes a DB-stored
type list safe: the server can gain a type before the app release that handles
it, and nothing breaks in between.

`TaskType.code` is generated once at create and never recomputed on rename, for
this reason. Adding a seventh screen later is one screen, one line here, one
admin-created row.
