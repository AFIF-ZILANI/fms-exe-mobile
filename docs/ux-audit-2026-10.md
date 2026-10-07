# Mobile app audit — features, flow, UI/UX

Date: 2026-10-07. Branch: `docs/scan-flows-and-ux-audit`.

## How this was done, and what it can't tell you

- **Read:** `docs/design.md`, the app shell (`_layout`, tabs, tab bar, log sheet),
  the dashboard, houses, house detail, task detail, login, profile, the forms
  (mortality, consumption, environment, treatment, transfer, adjust, score, link),
  the pickers, the scanner, the sync banner, `use-queued-submit`, `outbox`,
  `permissions`, `api`. Not read line by line: team screens, performance,
  assign, feeding-program, flag-stock, change-password, weight.
- **Ran:** `tsc --noEmit` (clean) and `expo lint` (1 warning, see L2).
- **Visual check:** done on the **web build** of the app in headless Chrome at a
  390x844 phone viewport, signed in as a throwaway Worker and a throwaway Manager
  (local test accounts). Light theme: Home, Houses, a house, every log form, the log
  sheet, Profile, Performance, Team, and all manager forms. Dark theme: Home,
  Environment, Mortality, and the log sheet. Chrome ran with web-security off so
  the web build could call the API.
- **What the visual check cannot cover:** it is not a phone. No camera or QR scanner,
  no haptics, no real touch sizing, no native date picker, no Dynamic Type, no
  offline or queued states, no task detail (no tasks exist for the test users), no
  filled-in or error states. Treat those as still unverified.
- Findings marked **(code)** come from reading the source. Findings marked
  **(seen)** were observed on screen or in the dev log.

## What is already good (keep)

- A real design system ("Field Green"): tokens for colour, type, spacing, radius,
  elevation; light and dark together; every status has an icon or word, never
  colour alone.
- Offline-first writes: every form enqueues locally and syncs later; sync state is
  visible; logout is blocked while records are unsynced.
- Good form manners: sticky bottom submit that names the record ("Record 12
  deaths"), discard confirmation only on touched forms, warn-never-block on odd
  values (mortality %, environment ranges), append-only mindset (no Edit on logged
  records).
- Role handling hides what you can't do instead of greying it out.

## A. Missing features

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| A1 | High | **No scan flows for allocate / consume.** Consume form excludes tracked items on purpose **(code)** `log/consumption.tsx`. | Build per `docs/scan-flows-design.md`. |
| A2 | High | **A worker cannot move stock items from the warehouse to a house.** The only transfer screen moves *birds* and is manager-only **(code)** `(manager)/transfer.tsx`. | Allocate screen (coded units) plus an aggregate item transfer for feed and other bulk items. |
| A3 | High | **Manager finance is absent**: sales, purchases, payments. Manager capabilities are only 7 stock/people items **(code)** `lib/permissions.ts`. | Separate design and plan (not part of the scan work). |
| A4 | Med | **Treatment is free text.** Medicine / vaccine name is typed, with no link to an item, a coded bottle, or a Consumption **(code)** `log/treatment.tsx`. The unit-tracking design says treatments should trace to a priced lot. Typos will also fragment reporting. | Pick the item from the catalog, or scan the bottle; create the Consumption and link it. |
| A5 | Low | No dispose / mark-empty for coded units on mobile. | Add after the three scan flows. |

## B. Flow and logic issues

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| B1 | Med | **Cancelling a task ignores a failed save.** `confirmCancel` awaits `submit()` then always calls `router.back()` **(code)** `tasks/[id].tsx`. If the local write fails, the worker believes it was cancelled. | Check the return value like the other forms do. |
| B2 | Med | **Task completion is queued separately from the form write** **(code)** `use-queued-submit.ts`. If the real write dead-letters, the task can still show done. | Make completion depend on the primary write, or let the server complete the task from a `task_id` on the write. |
| B3 | Med | **Environment form promises a partial save it won't do.** The button reads "Record 3 of 5 readings" but `isValid` requires all five **(code)** `log/environment.tsx`. | Allow partial readings if the server accepts it; otherwise change the label to say what is missing ("2 more needed"). |
| B4 | Med | **Pickers silently stop at 100 rows** (items, batches, employees, doctors) **(code)**. Anything past 100 is invisible. | Server-side search on the picker, or pagination. |
| B5 | Med | **Offline numbers can be stale.** Adjust computes "on record" from a cached stock query **(code)** `(manager)/adjust.tsx`; the same pattern applies to bird balances in forms. | Show "as of <time>" next to cached figures; re-check at sync. |
| B6 | Low | **No pull-to-refresh anywhere** **(code)**: no `RefreshControl` in the app. | Add to Home, Houses, house detail, Team. |
| B7 | Low | Dashboard fires four list requests; house detail fires seven. | One summary endpoint per screen if it ever feels slow on a farm connection. |

## C. UX issues (simplicity and friendliness)

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| C1 | High | **The house is re-picked on every form** unless you came from a house screen. Most workers work one or two houses. | Remember the last house; offer "My houses"; one tap to change. |
| C2 | Med | **Two places for actions.** The dashboard has a Manager grid, and the centre "+" sheet has a different manager list **(code)**. Transfer, Feed plan and Flag stock are on one and not the other. | One launcher. Group it Record / Stock / Manage. Drop the dashboard grid or make it a shortcut subset. |
| C3 | Med | **Jargon.** "Link items", "Discrepancy", "Rate someone", "Transfer" (it moves birds), "Feed" (also supplies). | "Scan to receive", "Stock count off", "Give points", "Move birds", "Use supplies". |
| C4 | Med | **Dead-letter handling is a native Alert** listing raw endpoints and server errors **(code)** `sync-banner.tsx`; the file's own comment calls it a stopgap. | A "Needs attention" screen: plain-language label, the reason, Fix and retry or Discard. |
| C5 | Med | **Sync banner shows only on Home, Houses, House detail.** On other screens a queued state is invisible. | Small persistent sync indicator in the header (icon plus count). |
| C6 | Med | **Login is bare** **(seen)**: no app name or mark, no show-password control, a large empty area, and a disabled "Sign in" that is low-contrast in dark. The unreachable-server message prints the API base URL **(code)**. | Add the brand mark, show/hide password, keep the URL for a hidden diagnostic. |
| C7 | Low | **Environment "time of day"** has 7 pills including Midnight and Late night **(code)**; a sensible default is already computed. | Hide behind "Change" or use a time stamp instead. |
| C8 | Low | **Chips are 36dp** (`design.md` §4.4) while the same doc requires 48dp targets for gloved hands. | Raise chips and filters to 44–48dp. |
| C9 | Low | **Confirmations use native Alert.** Fine for rare ones, weak for the high-stakes ones (move birds, mortality over threshold). | A bottom-sheet summary with the numbers that matter. |
| C10 | Low | Empty-state copy "Tap ＋ to log anything" assumes the centre button is understood. | Name it ("Tap Log"). |

## D. Code hygiene

| ID | Finding |
| --- | --- |
| D1 | **(seen)** Dev log on web: `"shadow*" style props are deprecated. Use "boxShadow"`. |
| D2 | Lint: `employee` assigned but unused in `(manager)/link.tsx:48`. |
| D3 | `lib/permissions.ts` header says "no auth yet" but login now exists. The check is client-side only; confirm the server enforces the same matrix. |
| D4 | Several forms read `employee` only as a guard and never use it in the body. Harmless, but noise. |
| D5 | Web build notes in the code (sqlite worker can hang). The web target is for development only. |

## V. Visual findings (seen on screen)

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| V1 | Med | **Manager actions are buried.** On the Manager's Home the action grid is the *last* card, below Today, Team and Houses; at 844px it is off screen. The main manager tools need a scroll to find. | Put manager shortcuts near the top, or rely on one launcher (C2). |
| V2 | Med | **House tokens are not unique.** The Houses list shows two houses labelled `H1` and two labelled `H2`, and two long ones truncated as `H37…` / `H74…`. The design relies on the token as a spatial landmark. | Validate unique house numbers at creation, and show the house name where a token is ambiguous. (Some of this may just be test data.) |
| V3 | Med | **Titles don't line up with the cards.** On Home, Houses, Team and Performance the title starts about 20dp to the right of the card edge; on form screens it is flush. | Align header content to the card edge, or document the inset as deliberate. |
| V4 | Low | **Text touches the card edge.** On house detail, the dates ("Sep 25") in Recent activity end flush against the card's right edge with no padding. | Add right padding to the row content. |
| V5 | Low | **Unbalanced tab bar for Workers.** With Team hidden, the bar reads Home, Houses, +, empty gap, Me. | Keep the intent (centre button never moves) but fill the slot (e.g. Scan) or centre the four remaining items. |
| V6 | Med | **Empty "Today" card is huge** (~210dp) and pushes Houses down when nothing is assigned. | Collapse to a one-line row when empty. |
| V7 | Med | **Same thing, different names.** House detail tiles say Deaths / Feed / Weight; the log sheet says Mortality / Feed / Weight; Home calls the bird mover "Transfer" while its screen is titled "Move birds". The sheet says "Report discrepancy", the screen "Report a discrepancy". | One word per concept, used everywhere (C3). |
| V8 | Med | **Manager log sheet is 9 rows tall.** "Link items" is cut off at the bottom, and the Manager group has no heading, only a rule. | Group with headings (Record / Stock / Manage) and keep the common items on the first screenful. |
| V9 | Low | **Every empty number field shows a grey "0".** It reads like a value that was entered. Submit buttons stay a faint grey and never say why they're disabled. | Use a blank field with a unit hint, and show what's missing near the button ("Pick a house"). |
| V10 | Low | **Team rows are cramped.** The chevron sits on top of the right-aligned count; the two header tiles, "1 On shift" and "1/2 Tasks done", don't say what they count; roles show lowercase ("worker"). | Separate the count from the chevron; label the tiles ("1 working now", "1 of 2 tasks done today"). |
| V11 | Low | **Rate screen is a wall of 19 chips** across three groups, about two screens tall before the reason field. | Group by theme, or a two-step pick (positive / negative, then list). |
| V12 | Low | **Assign a task** shows a "DUE" label with nothing under it on web. May be a web-only gap in the date control. | Check on a device; if it also fails there it's a High bug. |
| V13 | Low | The "LIVE BIRDS" label sits tight under the hero number on house detail. | A few dp more space. |
| V14 | Info | **Dark mode is solid.** Tints, contrast, hero numerals and the log sheet all hold up in the four dark screens checked. No issues found there. | Keep. |
| V15 | Info | **Good:** the house detail hero (count, batch, day progress, status), Bengali house names rendering correctly, the Performance screen's plain-language "Projected 0.0% on next month's pay", and clear empty-state copy. | Keep. |

## E. Proposed direction: simple and friendly

1. **Home = "what do I do now".** Today's tasks first. Under them, four big buttons:
   Mortality, Feed, Weight, **Scan**. Bird count and points become a single quiet
   line.
2. **One launcher** (the centre button) grouped Record / Stock / Manage, using plain
   verbs (C2, C3).
3. **Scan hub**: Receive, Move to house, Use. All three share one scan session
   (`scan-flows-design.md`).
4. **One house memory** across forms (C1).
5. **A standard form template**: house chip at the top (remembered), the one field
   that matters focused, bottom submit naming the record, a summary sheet only
   where the stakes are high.
6. **Honest sync**: header indicator plus a Needs-attention screen (C4, C5).
7. **Accessibility pass** on a real device: Dynamic Type at 130%, 48dp targets,
   contrast of disabled states in both themes.

## F. Suggested order

| Priority | Work |
| --- | --- |
| P0 | B1 (small bug), then the scan flows (A1, A2 coded part) |
| P1 | C1 house memory, C2/C3/V7/V8 launcher and wording, V1 manager shortcuts, C4/C5 sync, B2 task completion, B3 |
| P2 | A4 treatment linking, C6 login, B4 picker search, B6 pull-to-refresh, C7–C10, V2–V6, V9–V13 |
| Separate project | A3 manager finance screens |

## G. Still to check on a real device

Camera and the Link items scanner with a real QR, haptics, touch-target sizes,
Dynamic Type at 130%, the date control on Assign a task (V12), task detail with a
real task, filled-in and error states, and the offline / queued / dead-letter
states. Add the results here.

## H. Fixed in Phase 0 (branch `fix/phase0-consistency`)

B1 task cancel now checks the save; B3 environment button says how many readings
are still needed; V3 titles align with cards (Header no longer double-pads inside
Screen); V4 row text no longer touches the card edge; V7 one name per concept
(Move birds, Mortality, Report discrepancy); D1 shadows moved to `boxShadow` (also
gives the two-layer card shadow `design.md` specifies); D2 unused variable; D3 stale
comment. Verified: `tsc` and `expo lint` clean, `scan` and `format` checks pass, and
Home, Houses, house detail and a form re-shot in the browser. Not yet verified on a
device.
