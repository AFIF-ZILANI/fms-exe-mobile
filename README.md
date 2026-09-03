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

Pre-implementation. The app is currently the unmodified `create-expo-app`
template; the docs above define what replaces it.

## Running it

```bash
bun install
npx expo start          # Expo Go is enough — v1 adds no native modules
```

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
