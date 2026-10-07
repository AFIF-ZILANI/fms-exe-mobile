# Navigation redesign

Status: **Phase 1 built** (2026-10-07): new bar, grouped launcher, Stock tab v1, Me = Profile, Settings, Home cleanup. Phases 2–4 (Sync center, My tasks + Alerts, Stock polish) pending. Known oddity: Back from Team goes to Home even when Team was opened from another tab (Tabs back behaviour).

## Why

Audit findings this fixes (docs/ux-audit-2026-10.md): two launchers with different contents (C2), manager tools buried at the bottom of Home (V1), Profile hidden behind a gear on Home, the Me tab opening only My performance, an empty gap in the Worker's tab bar (V5), no way to see stock, and a raw native alert for failed-to-send records (C4).

## Decisions (user)

1. **Bottom bar, identical for everyone:** `Home · Houses · [+ Log] · Stock · Me`.
2. **Me is the Profile.** **Settings is a separate screen with app settings only**, opened by a gear on the Me header.
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
3. **My tasks + Alerts:** `/tasks` list (today, overdue, done) from Home's "Today · All"; `/alerts` from the bell, read-only, severity shown by word and icon, badge count of open alerts.
4. **Stock polish:** item detail with balance by location, search, pull to refresh.

## Out of scope
Push notifications, editing profile fields, alert acknowledgement/resolving, stock adjustments beyond the existing Report discrepancy flow.
