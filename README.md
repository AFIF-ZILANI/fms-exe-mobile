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
| [`docs/PRD.md`](docs/PRD.md) | The 20 screens — purpose, layout, fields, empty states, endpoints |
| [`docs/design.md`](docs/design.md) | The "Field Instrument" visual system — colour, type, structure, voice |
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

**Pointing at the API.** The server binds `localhost:5085`, which a physical
phone can't reach. Set the API base URL to your machine's LAN IP and add that
origin to `ALLOWED_ORIGINS` in `server/.env`.

See [`AGENTS.md`](AGENTS.md) for Expo conventions — in particular, check the
versioned docs before writing against any Expo API rather than working from
memory.
