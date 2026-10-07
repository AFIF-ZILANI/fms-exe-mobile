# Houses tab redesign

Status: **Built** (2026-10-07). Not verified on a device: pull-to-refresh gesture, real-phone spacing.

## Why
The old Houses tab was a dense ledger table: token, name, count, batch, progress and status stacked in one row.
House tokens were not unique (two `H1`, two `H2`) or were cut off (`H37…`); the filter was by house type, which
is not how people look for a house; and nothing said how the farm as a whole stood.

## Layout (Houses tab only; the house detail screen is unchanged)
1. **Two summary tiles:** *Live birds* (running houses only) and *Houses running* (`4 of 12`).
2. **Filter chips with counts:** `All 12 · Running 4 · Empty 8` (replaces the Brooder/Grower/Layer chips; the type is on each card).
3. **One card per house**, 12dp apart, the whole card tappable:
   - header: number badge, **name leading** (wraps to two lines), status pill;
   - sub-line: type and capacity;
   - running: live birds large, batch code, a continuous progress bar and "Day 17 of ~60" (amber and "· past plan" once past the planned end);
   - empty: a short card, "No batch placed".
4. **Order** stays by house number (then name), never by status, so the farm layout does not shuffle.
5. **Pull down to refresh**; loading skeletons, error with Retry, "no houses", and "no running/empty houses" states are kept.

## Rules
- The name leads and the number is only a badge, because numbers are not unique.
- "Running" means a positive balance in the house; a house with several positive balances uses the first (as before). A running house whose batch details did not load still shows its birds, just without a batch code or progress bar.
- The screen waits for **both** the houses and the bird counts before showing any status or total (otherwise every house would read "Empty"). If either fails with nothing cached it shows the error state with Retry; offline with nothing cached it says "You're offline." Cached data from Home shows immediately.
- Numbers and ordering come from `lib/houses-summary.ts` (tested: `bun src/lib/houses-summary.test.ts`).
- Light and dark use the existing tokens; chips have a 6dp `hitSlop` to reach 48dp.

## Out of scope
House detail, searching houses, filtering by house type (the type is shown on each card; say so if it should come back).
