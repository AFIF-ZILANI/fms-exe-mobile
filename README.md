# ZeroD Farms — Employee Field App

The phone client for farm staff, part of the ZeroD Farms Management System.

A **Worker** logs the day's mortality, feed, weights, environment readings and
treatments against the right house and batch — offline, in a barn, with one
hand — and sees what their performance points are worth in pay. A **Manager**
assigns that work, scores the people doing it, moves birds between houses, and
reconciles stock at the farm gate.

Every write queues locally first and lands exactly once when signal comes back.

## The system

| Repo | What |
| --- | --- |
| `server/` | Hono + Prisma + Postgres API. The source of truth for all three clients. |
| `web/` | Admin dashboard — the operator console. Not for field staff. |
| `mobile/` | **This app.** Worker + Manager, in the field. |

## Docs

Read in this order:

| Doc | What it covers |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | The 20 screens — purpose, behaviour, fields, empty states, endpoints |
| [`docs/design.md`](docs/design.md) | The "Field Green" visual system — colour, type, spacing, components, voice |
| [`docs/layout/`](docs/layout/README.md) | **Per-screen blueprints** — every size, position, state and tap target |
| [`docs/offline-sync.md`](docs/offline-sync.md) | The write queue: how records survive no signal and don't duplicate |

Upstream, in the other repos:

- `server/docs/FEATURES.md` §3 — the feature set and permission matrix this app implements
- `server/docs/api.md` — endpoint reference
- `web/docs/design.md` — the admin client's system; shares the status-colour vocabulary

## Status

v1 built: all 20 screens, the offline write queue, and the Worker + Manager
tiers. Verified end-to-end against a live API — including an offline write
surviving a reload and syncing exactly once on reconnect.

## Running it

```bash
bun install
npx expo start          # iOS/Android — the real targets
npx expo start --web    # preview only, see the caveat below
```

**Web is a preview target, not a deployment one.** The app runs there, but
`expo-sqlite` uses a WASM build needing `SharedArrayBuffer`, which requires
cross-origin isolation (`COEP`/`COOP`). Those headers are configured for
production builds via the expo-router plugin in `app.json`, but the dev server
doesn't send them — so the offline queue may be unavailable in `--web` dev.
That degrades rather than crashes (`lib/outbox.ts` opens the database lazily),
and iOS/Android use native SQLite and are unaffected.

Lint and typecheck before calling anything done:

```bash
npx expo lint
npx tsc --noEmit
```

**Pointing at the API.** Nothing to configure. `src/lib/api.ts` derives the API
host from the Expo dev server the app was loaded from, so a phone, a simulator
and the browser all reach `<that host>:5085/api` without a setting.

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` **only** for a deployed API or a
tunnel — never for a LAN IP. Two traps make a hardcoded IP worse than useless:

- **DHCP moves the machine.** A LAN IP that worked yesterday silently times out
  today, and every screen just hangs on "Loading…" with no error.
- **`.env` is read when the dev server starts**, and `EXPO_PUBLIC_*` values are
  inlined into the bundle. Editing or deleting `.env` does nothing until you
  restart with `npx expo start --clear`.

If screens hang with no data and no console error, that pair is the first thing
to check: `curl` the URL the app is using, then restart the dev server.

See [`AGENTS.md`](AGENTS.md) for Expo conventions — in particular, check the
versioned docs before writing against any Expo API rather than working from
memory.
