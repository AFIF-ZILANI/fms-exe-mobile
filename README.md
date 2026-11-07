<div align="center">

<img src="assets/images/icon.png" width="96" alt="ZFarm icon" />

# ZFarm

**The field app for ZeroD Farms staff: log the day, scan the stock, get paid for good work.**

[![Latest release](https://img.shields.io/github/v/release/AFIF-ZILANI/fms-exe-mobile?label=release)](https://github.com/AFIF-ZILANI/fms-exe-mobile/releases/latest)
![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-58-000020?logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react)
![Offline first](https://img.shields.io/badge/offline-first-2E7D32)

[**Download the Android APK**](https://github.com/AFIF-ZILANI/fms-exe-mobile/releases/latest)

</div>

---

ZFarm is the phone client of the ZeroD Farms Management System, built for the people working in the barns.

A **Worker** logs the day's mortality, feed, weights, environment readings and treatments against the right house and batch, offline, in a barn, with one hand, and sees what their performance points are worth in pay. A **Manager** assigns that work, scores the people doing it, moves birds between houses, and handles stock at the farm gate by scanning QR codes.

Every write is queued on the phone first and lands on the server exactly once when signal comes back.

## Contents

- [Features](#features)
- [Install](#install)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Development](#development)
- [Testing](#testing)
- [Releasing](#releasing)
- [Documentation](#documentation)

## Features

| | Worker | Manager |
| --- | :---: | :---: |
| Daily logs: mortality, feed, weight, environment, treatment | ✓ | ✓ |
| Offline write queue, synced exactly once on reconnect, with a Sync centre | ✓ | ✓ |
| Tasks assigned to me, with due dates | ✓ | ✓ |
| Performance points and what they're worth in pay | ✓ | ✓ |
| Alerts and a notifications inbox | ✓ | ✓ |
| **QR stock:** move to a house, return to the warehouse, start using, consumed | ✓ | ✓ |
| **Look up a code:** everything about a bottle, from purchase to last use | ✓ | ✓ |
| Vaccine schedule: confirm a dose by scanning the bottle | ✓ | ✓ |
| Use supplies without codes (feed, litter) from what the house holds | ✓ | ✓ |
| Link printed QR codes to a purchase lot | | ✓ |
| Assign tasks, give points, see the team | | ✓ |
| Move birds between houses, adjust stock, flag low stock, set feeding programs | | ✓ |

**Scanning is built for speed.** The camera stays open for a whole pallet, several codes are checked with the server in parallel, codes read meanwhile are queued instead of dropped, and the scanner never takes more than the lot or house has room for. Every unit carries an idempotency key, so a retried scan can't record twice.

## Install

1. On the phone, download `ZFarm-v<version>.apk` from the [latest release](https://github.com/AFIF-ZILANI/fms-exe-mobile/releases/latest).
2. Open it and allow installs from this source when Android asks.
3. Sign in with the email and temporary password your manager gives you.

Android 7.0 or newer. The release APK talks to the production API. After the first install, new versions show up as an **Update available** banner on the home screen.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 58, React Native 0.88, React 19 |
| Navigation | Expo Router (file-based, in `src/app/`) |
| Server state | TanStack Query |
| Offline queue | `expo-sqlite` outbox, flushed in order with per-write idempotency keys |
| Scanning | `expo-camera` QR reading, a pure scan pipeline (`src/lib/scan*.ts`) |
| Feedback | Haptics and sounds per scan result |
| API | Hono + Prisma + PostgreSQL ([`fms-backend`](https://github.com/AFIF-ZILANI/fms-backend)) |

## How it works

```
src/
├── app/                 # Screens (Expo Router). (tabs)/ for the bottom bar, (manager)/ for manager-only
│   ├── (tabs)/          # Home, Houses, Stock, Tasks, Team, Performance, Profile
│   ├── (manager)/       # Link items, assign, score, transfer birds, adjust, feeding program…
│   ├── log/             # Mortality, weight, environment, treatment
│   ├── scan/            # Move / return, start using / consumed, look up
│   └── vaccines/        # Confirm a scheduled dose by scanning
├── components/          # UI kit (Field Green design) and the QR scanner
├── hooks/
└── lib/                 # Pure logic + its tests: api, outbox, scan, scan pump, formatting, views
```

- **Writes go through the outbox** ([`docs/offline-sync.md`](docs/offline-sync.md)). A log is saved to SQLite with an idempotency key, then flushed in order. A server replay (`409`) counts as delivered, and a write that can never succeed moves to a dead-letter list in the Sync centre instead of blocking the queue.
- **QR screens need a connection** because each code is checked against the server as it's read. The pipeline is: camera read → `classifyScan` (in frame, duplicate, valid code?) → **scan pump** (up to 4 in flight, capacity guard) → lookup + `checkUnit` → write → result row, haptic and flash. All of it except the camera is plain TypeScript with tests.
- **The API host is derived, not configured.** In development, `src/lib/api.ts` uses the host the app was loaded from (`<metro host>:5085/api`), so phones, simulators and the browser all work with no settings. Release builds inline `EXPO_PUBLIC_API_BASE_URL`.

## Development

**Prerequisites:** [Bun](https://bun.sh), the [API](https://github.com/AFIF-ZILANI/fms-backend) running locally on port 5085, and Expo Go or an Android device/emulator.

```bash
bun install
npx expo start            # scan the QR with Expo Go, or press a for Android
```

**Testing on a real phone without touching production:** open the project in **Expo Go**, not in the installed release app. The release APK has the production API built in. Expo Go loads from your Metro server and therefore talks to your local API and database.

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` **only** for a deployed API or a tunnel, never for a LAN IP:

- **DHCP moves the machine.** An IP that worked yesterday silently times out today, and every screen hangs on "Loading…" with no error.
- **`.env` is read when Metro starts** and `EXPO_PUBLIC_*` values are inlined into the bundle. Changes do nothing until you restart with `npx expo start --clear`.

If screens hang with no data and no console error, check that pair first.

**Web is a preview target only.** `expo-sqlite` on web needs `SharedArrayBuffer` and cross-origin isolation headers, which the dev server doesn't send, so the offline queue may be unavailable in `--web`. It degrades rather than crashes.

Expo moves fast: read the versioned docs for SDK 58 before writing against any Expo API. See [`AGENTS.md`](AGENTS.md).

## Testing

```bash
bun run test              # pure-logic tests: scan pipeline, scan pump, outbox, views, formatting…
npx tsc --noEmit          # typecheck
npx expo lint             # lint (incl. React Compiler rules)
```

Run all three before calling a change done.

The scanner's server behaviour is also exercised end to end by the API's simulation, which feeds lists of codes through this app's scan logic against the real API, with network latency and rate limiting:

```bash
# in the server repo
bun scripts/scan-sim.ts <bind|allocate|return|start|finish> new 30
```

## Releasing

The native `android/` project is generated by `expo prebuild` and is gitignored. Configure native behaviour in `app.json`, never by hand.

1. Bump `expo.version` and `expo.android.versionCode` in `app.json`.
2. Build:
   ```bash
   bun run build:apk         # -> dist/ZFarm-v<version>.apk, pointed at the production API
   ```
3. Publish a GitHub release tagged `v<version>` with the APK attached.

Installed apps poll the latest GitHub release and show **Update available — version x.y.z** when it's newer than their own version. Installing over the current version keeps the user signed in and keeps their pending sync queue.

> The release is signed with the debug keystore, which is fine for sideloading. Publishing to the Play Store needs a dedicated upload key. Updates must be built with the same key as the installed app, or Android refuses to install them over it.

## Documentation

| Doc | Covers |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Every screen: purpose, behaviour, fields, empty states, endpoints |
| [`docs/design.md`](docs/design.md) | The "Field Green" visual system: colour, type, spacing, components, voice |
| [`docs/layout/`](docs/layout/README.md) | Per-screen blueprints: sizes, positions, states and tap targets |
| [`docs/offline-sync.md`](docs/offline-sync.md) | The write queue: how records survive no signal and never duplicate |
| [`docs/scan-flows-design.md`](docs/scan-flows-design.md) | The QR flows: link, move, use, look up |

Upstream, in the API repo: `docs/FEATURES.md` (the feature set and the permission matrix this app implements) and `docs/api.md` (endpoint reference).
