# Field App — Offline Sync

Closes the open item parked in `server/docs/FEATURES.md` §5: *"Field App
offline-sync implementation (queue internals, conflict handling, retry logic
against `idempotency_key`) — the sync mechanism itself is still a separate
design conversation."* This is that conversation.

Scope: how writes survive a bad connection and land exactly once. Screen
behaviour is `docs/PRD.md`; how sync state is drawn is `docs/design.md` §2.2.

---

## 1. The model: write-outbox only

**Writes** always queue to a local SQLite table and sync when the network
returns. A form never blocks on the network and never fails because of it.

**Reads** come from React Query with an AsyncStorage persister — the last
successful response, shown with its age when it matters (`docs/PRD.md` §3).

This is deliberately **not** a full two-way replica. A local mirror of houses,
batches and balances would mean reconciling derived counts like
`BatchHouseBalance`, which the server maintains transactionally alongside every
mortality, allocation and bird sale. Recomputing that locally is how a farm ends
up with two different bird counts and no way to tell which is right. The queue
solves the actual problem — *the barn has no signal and the work still happened*
— without inventing a second source of truth.

---

## 2. Why the server already supports this

The schema was built for it. `idempotency_key String @unique` sits on **12
tables**, each carrying the same comment: *"client-generated; prevents
double-insert on offline sync retry."* Every corresponding validator accepts
`idempotency_key` as an optional string, and every service falls back to
`crypto.randomUUID()` when the client omits it.

So the client generates the key **at enqueue time**, not at send time. That is
the whole mechanism: the key is created once, stored with the row, and reused on
every retry, so the database's unique constraint is what guarantees
exactly-once — not the client's retry logic.

Three tables needed the column added for the Manager tier
(`BatchFeedingProgram`, `Alerts`, `EmployeeTaskAssignment`) so that **every**
mobile write is queueable. Uniformity here is cheaper than correctness: one
write path in the app beats a queued path plus an online-only path.

---

## 3. The queue

`src/lib/outbox.ts`, one `expo-sqlite` table:

```sql
CREATE TABLE IF NOT EXISTS outbox (
  key        TEXT PRIMARY KEY,   -- the idempotency_key (uuid), generated at enqueue
  endpoint   TEXT NOT NULL,      -- '/mortality-logs'
  method     TEXT NOT NULL DEFAULT 'POST',
  body       TEXT NOT NULL,      -- JSON, actor id already stamped in
  created_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT                -- non-null = dead-lettered, stop retrying
);
```

SQLite rather than AsyncStorage because the queue must survive a force-quit
mid-flush, and because `attempts` / `last_error` want real columns rather than a
rewritten JSON blob.

**The body is complete at enqueue time**, including the actor id from the
session. A queued write belongs to whoever wrote it, so switching identity
(`PRD` §6.2) clears the React Query cache but must **never** clear the outbox.

---

## 4. Flush

`flush()` walks rows oldest-first, sends each, and classifies the response:

| Response | Action | Why |
| --- | --- | --- |
| 2xx | delete row | Landed. |
| 409 naming `idempotency_key` | **delete row** | Already landed on an earlier attempt. This is success. |
| 409 from `bind` | see §4.2 | Ambiguous — needs one extra check. |
| other 4xx | set `last_error`, stop retrying | Validation won't fix itself on retry. Surface it. |
| 5xx / network error | `attempts++`, leave queued | Transient. |

### 4.1 The 409 rule is load-bearing

`server/src/lib/prisma-errors.ts` maps Prisma's P2002 (unique violation) to a
**409 conflict** — it does not return the existing row. So a retry of a write
that already succeeded gets an error, not a success.

Without this rule, every successfully synced record retries forever and the
queue never drains. The error message names the conflicting field
(`conflictingFields()` reads both `meta.target` and the adapter's nested
`driverAdapterError.cause.constraint.fields`), which is what makes the check
possible: a 409 mentioning `idempotency_key` means *this exact write already
landed*; a 409 mentioning anything else is a real conflict.

That distinction is the single most important line in the sync layer. It is
tested directly (§7, step 5), not assumed.

### 4.2 `bind` is the one ambiguous replay

`POST /stock-units/:id/bind` takes no `idempotency_key` — it's addressed by unit
id, so it doesn't need one to be safe. But its 409 is ambiguous.
`StockUnitService.bind` rejects any unit whose status isn't `UNASSIGNED` with
`"StockUnit is already in_stock"`, and that fires identically whether:

- **our** queued write already landed and we're replaying it, or
- **someone else** bound that unit while we were offline.

Dropping the row silently would be wrong in the second case — the manager would
believe they'd recorded a binding that is in fact someone else's.

So on a 409 from `bind`, `GET /stock-units/:id` and compare
`purchase_item_id` against the one in the queued body:

| Result | Action |
| --- | --- |
| Matches | Our write landed. Delete the row. |
| Differs | Someone else bound it. Dead-letter with "This unit was already bound to another lot." |

Two extra lines, and it's the difference between an accurate ledger and a
plausible-looking one.

### 4.3 Dead letters

A 4xx that isn't the idempotency case is a bad request — a nonexistent
`house_id`, a missing required `reason` — and retrying it a thousand times
changes nothing. Store the server's RFC 7807 `detail`, stop retrying, and
surface it: the `<SyncBanner>` shows "N didn't send" and opens the **Sync center** (`/sync`), where each
failed record is shown in plain words with its reason and can be **retried** or **discarded**
(editing a failed record is not offered). See "Sync center" below.

A silent dead letter is worse than a failed write, because the worker believes
the record exists.

### 4.4 Triggers

- After every enqueue (optimistic — usually online).
- On app foreground.
- On `expo-network` reporting a transition to connected.
- Manual "Sync now" from Settings or the Sync center (tapping the banner while records are waiting also flushes).

No polling timer. Nothing to poll for — the queue only changes when the user
writes or the network returns, and both are events.

### 4.5 Concurrency

`flush()` is guarded by a module-level flag so a foreground event and a
reconnect event can't run it twice at once. Rows are sent **sequentially**, not
in parallel: several of these writes mutate shared server state
(`BatchHouseBalance` is decremented by mortality and moved by allocations), so
ordering is worth preserving and throughput is irrelevant at a few dozen writes
a day.

---

## 5. The submit path

`src/lib/use-queued-submit.ts` — the one hook every form calls.

1. Validate client-side. A blank required `reason` should never reach the queue;
   it would dead-letter for something the form could have caught.
2. Generate the `idempotency_key`.
3. Stamp in the actor id from the session.
4. Insert into `outbox`.
5. Fire `flush()` without awaiting it.
6. Return immediately.

The UI confirms from step 4, never step 5. "Saved · will sync" is the honest
message: it *is* saved, on this phone, durably, and the server is a detail of
when.

**`submit()` returns a boolean, and callers must honour it.** `false` means the
write reached *nothing* — not the server, not the queue — and the hook has
already told the user so. A form that navigates away regardless would leave a
worker believing a record landed when it didn't, which is the one failure this
whole design exists to prevent. Every call site is `if (queued) router.back()`;
the feeding-program screen, which stays put to add another phase, only clears
its fields when `queued` is true.

The database is also opened **lazily**, inside `initOutbox()`, rather than at
module scope. A throw at import time would white-screen the entire app with no
recovery; contained, a storage failure still leaves reads, navigation and a
real error message working.

If a task launched the form, marking that task done is a second queued write
(`POST /task-assignments/:id/complete`) enqueued in the same step 4.

---

## 6. What is not solved here

- **Conflicting concurrent edits.** There are none by construction. Every
  queued write is an `INSERT` into an append-only table, or an idempotent status
  `UPDATE`. Nothing does read-modify-write, so there is nothing to merge.
- **Offline reads of data never fetched.** A house never loaded while online
  isn't available offline. Acceptable: the read set is small and the app fetches
  it on first launch.
- **Server-side idempotency for `bind`.** It takes no key and doesn't need one;
  the client disambiguates its 409 with a follow-up read (§4.2). A
  `bound_by_id` + `idempotency_key` on `StockUnit` would remove the extra
  round-trip, but not the ambiguity — someone else can always have bound it
  first.
- **Clock skew.** Queued rows carry the device's `date`. A phone with a badly
  wrong clock writes badly dated records. Out of scope; worth revisiting if it
  shows up in practice.

---

## 7. Verification

The offline path is the part of this app most likely to be quietly wrong, so
test it directly rather than reasoning about it. Steps 3–5 are the reason the
outbox exists at all.

1. **Online.** Submit a mortality log → row lands, dashboard count updates.
2. **Airplane mode.** Submit two more → both queue, UI confirms instantly,
   banner reads "2 queued."
3. **Restart the app while still offline** → both survive. This is the SQLite
   choice being tested.
4. **Restore network** → flush runs, banner clears, all three rows in the DB
   **once**.
5. **Force the replay case.** Submit offline; let the flush POST succeed but
   kill the app before it deletes the row; reconnect. The retry must hit the
   409-on-`idempotency_key` branch and **delete the row without creating a
   duplicate.** This is the exact bug the whole design exists to prevent.
6. **Dead letter.** Queue a write with a nonexistent `house_id` → visible error,
   no infinite retry.
7. **Identity.** Queue a write as one employee, switch to another before it
   syncs → it still lands attributed to the first.
8. **Manager offline.** Assign a task with no signal → queues and syncs like any
   log write.


## Sync center (2026-10-07)

- **Screen:** `/sync`, reached from Settings → Sync center or by tapping the banner's failed state. It lists
  *Couldn't send* (failed records: plain title and detail, the reason in plain words, **Retry** and
  **Discard**) and *Waiting to send* (pending records), with the last-synced time and Sync now.
- **Words, not endpoints:** `lib/outbox-describe.ts` turns a queued row into a title and detail and a server
  error into a plain reason; nothing on screen shows an endpoint or an HTTP code.
- **Privacy:** the queued bodies are read into component state (`useOutboxRows`), never into the persisted
  query cache.
- **Logout:** records still *waiting to send* block logout ("Sync first"): they would upload under whoever
  signs in next. *Failed* records ask: **Review**, **Log out and discard** (deletes only failed rows, after
  re-reading the queue so a stale count can't hide a pending record), or Cancel.
- **Known gap (not fixed here):** the queue has no owner column. After a **forced** sign-out (expired or
  deactivated session, or a password changed elsewhere) the next person to sign in on the same phone can
  have the previous person's pending records sent under their own login, and can see and retry the failed
  ones. Voluntary logout through Settings is covered; the 401 path and the Change password screen's
  Log out are not. The fix is to store the actor's employee id on each row at enqueue time and have
  `flush` and `useOutboxRows` ignore other people's rows.
