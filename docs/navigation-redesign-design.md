# Navigation redesign

Status: **Phases 1–4 built** (2026-10-08). Known oddity: Back from Team goes to Home even when Team was opened from another tab.

## Why

Audit findings this fixes (docs/ux-audit-2026-10.md): two launchers with different contents (C2), manager tools buried at the bottom of Home (V1), Profile hidden behind a gear on Home, the Me tab opening only My performance, an empty gap in the Worker's tab bar (V5), no way to see stock, and a raw native alert for failed-to-send records (C4).

## Decisions (user)

1. **Bottom bar, identical for everyone:** `Home · Tasks · [+] · Performance · Profile` (updated 2026-10-08; Houses is reached from Home, Stock levels from the launcher's Stock group, both hidden tab routes).
2. **Profile is the Profile** (the route was `/me`; `/performance` and `/tasks` are now tabs). **Settings is a separate screen with app settings only**, opened by a gear on the Me header.
3. **New features:** My tasks list, Sync center, Alerts inbox. The **Stock tab** comes with the chosen bar (read as wanted; first version is modest).

## Information architecture

| Place | Contents |
| --- | --- |
| **Home** | Greeting, Birds/Points tiles, Today's tasks (→ My tasks), Team card (managers), Houses. Bell with alerts badge (Phase 3). The bottom "Manager" grid and "My performance" button are removed. |
| **Houses** | Unchanged. |
| **[+ Log]** | Grouped launcher. **Record:** Mortality, Feed, Weight, Environment, Treatment. **Stock:** Move to house, Use an item; managers also Link items, Report discrepancy, Flag low stock. **Manage** (managers only): Assign a task, Give points, Move birds, Feeding plan, Team. |
| **Stock** | Scan shortcuts (Move to house, Use an item, + Link items for managers); filter All / Low; items with total balance, low-stock first, "Low" flag when below the item's reorder level. |
| **Me** | The Profile (identity, tiles, contact, employment, personal, emergency contact) + a My performance row. Header gear → Settings. |
| **Settings** (stack, no tab bar) | Appearance (Match phone / Light / Dark), Change password, Sync (status now; Sync center in Phase 2), App version, Log out. App settings only, nothing about the person. |
| **Team** | No longer a tab. Reached from Home's Team card and the launcher's Manage group. Its route stays (hidden tab); the Home tab shows as active while on it. |

## Rules
- The bar never changes shape by role; role only changes what the launcher and Home offer. A Worker never sees the Manage group (pinned by a test).
- Log out and Change password live only in Settings (plus a Log out on the Me "couldn't load" dead end, so nobody is trapped).
- Every screen outside the five tabs hides the tab bar, as today.

## Phases
1. **Shell:** the bar, Stock tab v1, grouped launcher, Me = Profile, Settings, Home cleanup.
2. **Sync center:** Settings → Sync center: queued and failed records in plain words, Retry, Discard (the outbox already has `retryDeadLetter` and `discardDeadLetter`), last synced time. Replaces the raw error alert.
3. **My tasks + Alerts:** `/tasks` list (today, overdue, done) from Home's "Today · All"; `/alerts` from the bell, read-only, severity shown by word and icon, badge count of open alerts. **Built:** My tasks groups pending tasks into Overdue (due time passed, including earlier today), Today (rest of the local day) and Later, plus the 20 most recent Done; cancelled are hidden; tapping a pending task uses the same route as Home's Today card (`taskHref`). Alerts shows Active (Critical → Warning → Info, newest first) and Resolved, read-only. The bell badge shows the server's active total (capped "9+") and is red only when a Critical alert is active.
4. **Stock polish:** item detail with balance by location, search, pull to refresh. **Built:** search by name or category; `/stock/[id]` shows the total, reorder level and non-zero balances by warehouse and house (read-only, from the same cached queries); pull to refresh (6 s time-box); an offline state; a note when there are more than 100 items (the list shows the first 100).

## Out of scope
Push notifications, editing profile fields, alert acknowledgement/resolving, stock adjustments beyond the existing Report discrepancy flow.

## Alerts (2026-10-08)
Alerts are filtered server-side by role (see server/docs/api.md "Who sees what"). The screen: severity filter chips with counts; one card per alert; tap to read the full text, open what it is about (`alertTarget` in `lib/alerts-view.ts`, by the family in the server's dedupe key) and, for managers, "Mark resolved" (online-only, with a confirm). "New" tags and the Home bell count use a per-employee seen list kept on the phone (`lib/use-seen-alerts.ts`), saved when the person leaves the screen; the Home strip keeps the full active total. Resolved alerts are folded away. Environment/sensor alerts are deliberately not built yet.

## Notifications (2026-10-08)
The Home bell opens the **Inbox**, one switch ("Notifications · n" / "Alerts · n") over two screens: `/notifications` (what happened to me: task assigned, points given or removed, payslip ready, payment sent or failed, bonus, password changed or reset) and `/alerts` (what the farm needs looked at). The bell badge is unread notifications plus unseen alerts; Home's red strip still links straight to Alerts. Notifications are written by the server when the action happens (server/docs/api.md "Notifications"), polled for the bell every minute and on app focus (no push yet). Tapping one marks it read and goes where it is about (`notificationHref` in `lib/notifications-view.ts`): tasks to the task, pay and points to My performance, account changes nowhere. Marking read is online-only, like resolving an alert. Not built: push notifications, "task due soon", status-change notices, per-kind opt-out.

## Stock redesign (2026-10-10)
Stock tab: the scan actions are a compact row of three icon tiles (Move to house, Use an item, Link items for managers) · search · status chips with counts (All, Low, Out) · category chips (Feed, Medicine, ...) when there is more than one · one card per item: category icon tinted by state, name, category and reorder level, a level bar with a tick at the reorder level (halfway mark), and the quantity with its unit. Order: Low first, then in stock, then empty (so retired or never-bought items do not bury the ones that matter), each A-Z. Item screen: hero with the total, a level bar and "N short of / above the reorder level", then each warehouse and house as a card with its share of the total. Logic is in `lib/stock-summary.ts` (`stockState`, `levelRatio`, `reorderGap`, `filterStock`, `attentionOrder`), all tested.

## Settings redesign (2026-10-10)
Identity card at the top (photo, name, role, email; opens Profile) · Appearance as three tiles (Match phone, Light, Dark) · Sync: Status, **Data updated** (when any screen's data last refreshed from the server) and **Last upload** (when a record last left this phone) as separate rows, Sync center with a red count of records that need attention, Sync now · Account: Change password and Log out (red, last, with its existing confirmations) · About: App version and the server this phone talks to. Fixed: the old "Last synced" showed the last *upload* ("19h ago") even when the screen's data was fresh, which read as "sync is broken".

## Quick actions sheet redesign (2026-10-10)
The (+) sheet is three plain grouped lists (Record / Stock / Manage for managers): one white card per group on the grey sheet, each row a small grey icon, the name and a chevron (descriptions live in the screen-reader label), hairline dividers, a Close button and a handle, and a tick (haptic) on press. A tile-grid version was tried first and dropped as busy. Contents are still decided by `buildLauncher` (tested).

## Log and manager forms redesign (2026-10-10)
Every quick-action form shares one look: a one-line hint under the title saying what it records, and fields grouped into white cards (`FormCard`) with a small heading ("What happened", "The sample", "Readings 3 of 5"). The flock under a house is a quiet grey card (batch, breed, day, live birds). Number fields can carry one-tap values (mortality 1/2/5/10, birds weighed 10/20/50/100). Selected chips and pills are indigo everywhere. Optional pickers (doctor, "any item") have a x to clear them. Done: Log mortality, feed, weight, environment, treatment; Move to house, Use an item; Report discrepancy, Flag low stock, Move birds, Rate; Assign task (earlier). Link items and Feeding plan keep their existing layouts.

Fixes found on the way: **Rate** offered ratings the server always refuses (-4/-5, which need written notice, and "Other", which needs an admin's approval), so they ended up as failed records in the Sync center; they are now greyed out with a sentence saying why, and "Other" is gone (`needsAdminPaperwork` in `lib/criteria.ts`, tested). **Move birds** accepted moving birds into the house they were already in. **Log feed** now shows the stock on hand and warns when the quantity is more than that. Raw codes in pickers (item categories, adjustment reasons) read as words. Five newer tests were added to `bun run test`.
