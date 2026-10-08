# House detail redesign

Status: **Built** (2026-10-08). Not verified on a device: pull-to-refresh, real-phone spacing, Bengali names, the "Today" state with real records.

## Why
The old page showed three log tiles (Environment and Treatment hid behind the + sheet), a "Recent activity" card that listed only the kind of record and a date (so it could not say whether today's work was done), and no way to scan stock into this house.

## Layout (consistent with the Houses tab cards)
1. **Hero card:** number badge, type and capacity, status; live birds large; batch code and breed · phase; the same continuous progress bar with "Day 17 of ~60" and, on the right, "43 days left" (amber at 3 days or fewer; "Cycle ends today"; "Past planned end" with a full amber bar).
2. **Today's records** (running houses only): five tiles — Mortality, Feed, Weight, Environment, Treatment. Each shows when it was last logged under its label: **✓ Today** (check and word), Yesterday, "3 days ago", "2 weeks ago", "2+ months ago", "No record yet". Tapping opens the form for this house. The tiles replace the old "Recent activity" card.
3. **Stock:** *Move to house* and *Use an item*, both opening with this house already chosen. Shown for empty houses too.
4. **Open tasks:** unchanged content, shown only when there are any.
5. An **empty house** shows "Empty house — Logging needs a batch in this house." and only the Stock shortcuts (no log tiles that lead to forms that cannot submit).

## Behaviour
- "Today" is the phone's local calendar day; a record made just before midnight is "Yesterday" after midnight (`lib/house-detail.ts`, tested in three time zones).
- **Treatment is per batch, not per house:** its tile shows the batch's latest medication or vaccination (a batch moved across houses shows the same time in each).
- The page waits for **both** the house and its bird count before showing a status (otherwise an empty read would show "Empty house"). Offline with nothing cached it says "You're offline."; a failed load shows Retry; cached data shows immediately.
- Pull down to refresh (also refreshes "today").
- A house is "running" when it has a balance with birds in it (same rule as the Houses tab). The page reads up to 20 of the house's balances and takes the first with birds, because the server lists them newest-updated first with no quantity filter, so a zero row from a moved-out batch can come first. (The log forms still read only the first row, as before: a house in that state can show as running here yet ask for a batch on a form. That is an existing limit, noted for a follow-up.)
- Pull-to-refresh refetches this page's data and stops spinning after six seconds even if offline (paused requests never settle).
- **Date caveats:** the weight record's date is a date without a time, so on a phone in a time zone behind UTC a weight logged today can read "Yesterday"; for Bangladesh (ahead of UTC) it reads correctly. Wording is tested across daylight-saving changes (`TZ=America/Los_Angeles bun src/lib/house-detail.test.ts`); the default, Dhaka and Los Angeles zones all pass.

## Out of scope
Editing a house, showing the *values* of the last records (only when they were made), a history list.
