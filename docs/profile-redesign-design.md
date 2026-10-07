# Employee profile redesign

Status: **Approved to build** (user said "go ahead" on 2026-10-07 after asking for the info list, layout and plan in one go).

## Goal

The Profile screen today is a name, a role/phone line, and three buttons. Make it the
page an employee is glad to open: who they are at the farm, their own details as the
farm holds them, who to call in an emergency, and the app's settings (including the
light/dark choice). Professional, calm, and honest about what they can and cannot change.

## What data exists (checked against the running API, 2026-10-07)

`GET /employees/:id` for your own record returns the full hire profile. A worker **cannot**
read payout accounts (`/employee-payout-accounts` → 403) or the role label list
(`/employee-roles` → 403), and cannot edit any employee field.

## Decisions: what the profile shows

| Section | Fields | Notes |
| --- | --- | --- |
| **Identity** | Photo (or initials), name, role, employment status, "with the farm" tenure and joined date | Photo comes from `profile.avatar.image_url` when present. |
| **At a glance** | Points this month · Time with the farm | Points tile opens My performance. |
| **Contact** | Mobile (tap to call), email (tap to write), address | Missing → "Not provided". |
| **Employment** | Role, status, joined date, probation end date (only while on probation) | Status words: Appointed, On probation, Confirmed. |
| **Personal** | Age (from date of birth), marital status, education, experience (years + note), National ID **masked** to the last 4 digits | A phone can be shared or lost, so the full NID is never shown. |
| **Emergency contact** | Name and relationship, phone (tap to call) | If none on file: a clear warning row, "No emergency contact on file. Ask your manager to add one." |
| **Settings** | Appearance (Match phone / Light / Dark), Change password, My performance, app version | New: the appearance choice. |
| **Account** | Log out | Keeps the existing "sync first" guard when records are unsent. |

### Deliberately **not** shown
- **Salary / reference salary.** Pay belongs on My performance, not on a screen others glance at in a barn.
- **Religion.** Collected only to decide a festival-bonus proposal; it has no place on a phone screen.
- **Referee (reference) details.** Hiring paperwork, not the employee's concern day to day.
- **Payout accounts.** The server does not let a worker read them; showing them would need a new permission and a design for masking. Out of scope.
- **Internal rating number.** Meaning is unclear to the worker and duplicates points.

### Read-only, said plainly
No profile field can be changed from the app (the server allows no employee edits). The screen
says so once, at the bottom of the details: "Something wrong? Ask your manager. Only they can change these details."

## Layout (390 × 844, light and dark)

```
┌──────────────────────────────────┐
│ ‹  Profile                       │  header, back
│                                  │
│  ┌────────────────────────────┐  │
│  │        ( photo / TW )      │  │  identity card, centred
│  │        Test Worker         │  │  h1
│  │   [Worker]  [● Confirmed]  │  │  role pill, status pill
│  │  Joined 12 Mar 2025        │  │  caption
│  └────────────────────────────┘  │
│  ┌─────────────┐ ┌────────────┐  │
│  │  +4         │ │ 1 yr 7 mo  │  │  stat tiles
│  │  POINTS·OCT │ │ WITH FARM  │  │
│  └─────────────┘ └────────────┘  │
│  CONTACT                         │
│  ┌────────────────────────────┐  │
│  │ Mobile   +880 1…       ☎   │  │  label · value · action
│  │ Email    name@…        ✉   │  │
│  │ Address  Not provided      │  │
│  └────────────────────────────┘  │
│  EMPLOYMENT … / PERSONAL …       │  same row card
│  EMERGENCY CONTACT               │
│  ┌────────────────────────────┐  │
│  │ Rahim · Brother        ☎   │  │
│  └────────────────────────────┘  │
│  Something wrong? Ask your       │  caption
│  manager…                        │
│  SETTINGS                        │
│  ┌────────────────────────────┐  │
│  │ Appearance                 │  │
│  │ [Match phone|Light|Dark]   │  │
│  │ ───────────────────────    │  │
│  │ My performance          ›  │  │
│  │ Change password         ›  │  │
│  │ App version        1.0.0   │  │
│  └────────────────────────────┘  │
│  [        Log out        ]       │  destructive, full width
└──────────────────────────────────┘
```

## Behaviour and states
- **Data:** fetch `GET /employees/:id` fresh each time the screen opens; show the copy saved at
  login immediately so it never opens empty or blocks offline. If the fetch fails, keep the saved copy and show one quiet line, "Showing details saved on this phone."
- **Missing values** read "Not provided" in muted text, never a blank or a dash on its own.
- **Tap targets** 48dp. Call and email rows open the phone's dialer / mail app. Never open on a missing value.
- **Never colour alone:** the emergency warning has an icon and words; status pills keep dot + word.
- **Appearance:** saved on the phone, applied at startup behind the splash; default "Match phone".
- **Light and dark** both work with the existing tokens (Field Indigo).
- **Names:** long or Bengali names wrap; no letter-spacing tweaks (design.md §3.2).

## Out of scope
Editing any field, photo upload, payout accounts, payslips, notification settings, language switch.
