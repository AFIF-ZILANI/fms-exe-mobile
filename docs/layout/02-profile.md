# 02 · Profile / Identity

> **Superseded 2026-10-07.** This blueprint describes the old profile-picker screen, which no longer exists.
> The Profile screen is now the employee profile described in [`../profile-redesign-design.md`](../profile-redesign-design.md)
> (identity card, at-a-glance tiles, contact / employment / personal / emergency contact, settings with the
> light/dark choice, log out). The sections below are kept for history only.

**Route:** `src/app/(tabs)/me/index.tsx` (the Me tab; was `src/app/profile.tsx`) · **Tier:** Both · **Tab bar:** hidden

---

## Purpose

The auth stand-in. The only place a role changes, and the first screen anyone
sees on a fresh install that can't reach the server.

---

## Frame

```
┌────────────────────────────────────────┐
│  ‹   Who are you?                      │  Header 56h
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ⓘ No login yet — pick who you are. │ │  Notice  auto-h  tintBlue
│ │   This is temporary.               │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ╭────────────────────────────────────╮ │
│ │  ╭────╮                            │ │  Current identity card
│ │  │ RH │  Rahim Hossain             │ │
│ │  ╰────╯  Worker · 01712 345678     │ │
│ │                                    │ │
│ │  ▭ My performance                  │ │
│ ╰────────────────────────────────────╯ │
│                                        │
│  SWITCH TO                             │  Eyebrow  ↕24
│ ╭────────────────────────────────────╮ │
│ ├────┬───────────────────────────────┤ │
│ │(KM)│ Karim Mia                     │ │
│ │    │ Manager                    ✓  │ │
│ ├────┼───────────────────────────────┤ │
│ │(SA)│ Sabina Akter                  │ │
│ │    │ Worker                        │ │
│ ╰────┴───────────────────────────────╯ │
│                                        │
└────────────────────────────────────────┘
```

---

## Anatomy

### Header — `56h`

Title "Who are you?" `h1`. Back button present when reached from the dashboard;
absent when this is the launch screen because no identity is set yet.

### Notice — `tintBlue`, auto height

| Element | Spec |
| --- | --- |
| Container | `tintBlue` fill, `card` radius, `pad 12/16`, `↕16` below |
| Icon | `info` 20dp `info`, top-aligned, `↔12` |
| Copy | "No login yet — pick who you are. This is temporary." `body` `ink`, wraps to two lines |

Always visible. It is not dismissible — the moment it can be dismissed, someone
dismisses it and then can't explain why the app has no password.

### Current identity card

| Element | Spec |
| --- | --- |
| Container | Card, `pad 16` |
| Avatar | `56×56` circle, `primarySoft` fill, initials `h2` `primary`, centred |
| Name | `h2` `ink`, `↔16` from the avatar |
| Meta | `caption` `muted`: `role · mobile`, `↕2` under the name |
| Action | Secondary button `48h`, full width, "My performance", `↕16` below the identity block → `/me/performance` |

When no identity is set, this whole card is replaced by an `<EmptyState>`:
`user` tile in `surfaceAlt`, "Nobody selected yet.", "Pick a name below to
start."

### Switch list

| Element | Spec |
| --- | --- |
| Eyebrow | "SWITCH TO", `↕24` above the card |
| Rows | `<LedgerRow>` `64h`, gutter carries a `32×32` `primarySoft` initials circle |
| Title | Name `bodyStrong` `ink` |
| Meta | Role `caption` `muted` |
| Current | Trailing 20dp `check` in `primary`. The current person is **not** removed from the list — seeing yourself in it is what makes the list legible as "everyone". |
| Order | Managers first, then Workers, each alphabetical |

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Notice renders immediately. Identity card renders from session (already local — no request). Switch list shows 4 skeleton rows. |
| **Empty — no employees** | The switch card body becomes the server-unreachable state below. An empty employee list on this screen is almost always a connectivity problem, not an empty database. |
| **Stale** | Not applicable — the list is small and re-fetched on focus. |
| **Error / can't reach server** | Replaces the switch list card body: `wifi-off` tile in `tintRed`, "Can't reach the server.", then the base URL in `data` mono `muted` inside a `surfaceAlt` inset (`pad 8/12`, `control` radius) so it can be read aloud over a phone, then a "Try again" secondary button. This is the screen where a fresh setup fails, so the diagnostic belongs here rather than in a generic error card. |
| **Offline** | Same as error, with the copy "You're offline." and the base URL still shown. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Back | `44×44` | Pop |
| "My performance" | `48h` | → `/me/performance` |
| Switch row | `64h` | Set identity, clear the React Query cache, navigate to `/` |
| "Try again" | `48h` | Refetch `/employees` |

---

## Data

| Endpoint | Feeds |
| --- | --- |
| `GET /employees?limit=100` | Switch list. Includes `profile` and `role`. |

---

## Notes

- **Switching identity clears the React Query cache.** Otherwise the previous
  person's tasks and scores flash on the new person's dashboard for a frame.
- **It must not clear the outbox.** Queued writes carry their own actor id,
  stamped at enqueue time. A worker who queues five entries and hands the phone
  to a colleague must not lose them.
- **The tab bar is hidden here.** This screen is reached from the dashboard's
  settings icon or shown at launch with no identity; in the second case a tab
  bar would offer navigation into screens that can't render.
- No sign-out. There is no session to end — switching identity *is* the whole
  model until OAuth lands.
- Don't add a search field to the switch list. A farm has a dozen employees; a
  search field on a twelve-row list is furniture.
