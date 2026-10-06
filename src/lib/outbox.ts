/**
 * The offline write queue. See docs/offline-sync.md for the full design --
 * this file is that document's §3-4 made real. No React here on purpose;
 * lib/use-outbox.ts is the reactive wrapper.
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, ApiError } from '@/lib/api';

const LAST_SYNCED_KEY = 'fms:last-synced-at';

export async function getLastSyncedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNCED_KEY);
  return raw ? Number(raw) : null;
}

export type OutboxRow = {
  key: string;
  endpoint: string;
  method: string;
  body: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
};

let db: SQLite.SQLiteDatabase | null = null;
let ready: Promise<void> | null = null;
let initError: Error | null = null;

/**
 * Opened lazily rather than at module scope: a throw during import takes the
 * whole app down with a white screen and no recovery path. Here a failure is
 * contained -- reads and navigation still work, and writes surface a real
 * error instead of vanishing.
 *
 * (In practice this only fails on web, where expo-sqlite is a WASM build
 * needing SharedArrayBuffer and therefore cross-origin isolation. iOS and
 * Android use native SQLite and are unaffected.)
 */
export function initOutbox(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      try {
        db = await SQLite.openDatabaseAsync('outbox.db');
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS outbox (
            key         TEXT PRIMARY KEY,
            endpoint    TEXT NOT NULL,
            method      TEXT NOT NULL DEFAULT 'POST',
            body        TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            attempts    INTEGER NOT NULL DEFAULT 0,
            last_error  TEXT
          );
        `);
      } catch (err) {
        db = null;
        initError = err instanceof Error ? err : new Error(String(err));
        console.warn('[outbox] local queue unavailable:', initError.message);
      }
    })();
  }
  return ready;
}

/** Throws rather than silently dropping a write -- the app's whole promise is
 *  that a queued record is durable, so a broken queue must be loud. */
async function requireDb(): Promise<SQLite.SQLiteDatabase> {
  await initOutbox();
  if (!db) {
    throw new Error(
      `Local queue unavailable, so this can't be saved offline: ${initError?.message ?? 'unknown error'}`,
    );
  }
  return db;
}

/** True when writes can be queued. The UI uses this to warn rather than
 *  letting a worker record into a void. */
export function isOutboxAvailable(): boolean {
  return db !== null;
}

export type EnqueueInput = {
  endpoint: string;
  body: Record<string, unknown>;
  method?: string;
};

/** Generates the idempotency_key HERE, at enqueue time, not at send time --
 *  that's what makes a retry reuse the same key instead of minting a new one
 *  every attempt. Stamps it into the body under `idempotency_key` since every
 *  write endpoint that needs one accepts it there. */
export async function enqueue({ endpoint, body, method = 'POST' }: EnqueueInput): Promise<string> {
  const database = await requireDb();
  const key = Crypto.randomUUID();
  const fullBody = { ...body, idempotency_key: key };
  await database.runAsync(
    `INSERT INTO outbox (key, endpoint, method, body, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    key,
    endpoint,
    method,
    JSON.stringify(fullBody),
    Date.now(),
  );
  return key;
}

export async function listPending(): Promise<OutboxRow[]> {
  await initOutbox();
  if (!db) return [];
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE last_error IS NULL ORDER BY created_at ASC`,
  );
}

export async function listDeadLetters(): Promise<OutboxRow[]> {
  await initOutbox();
  if (!db) return [];
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE last_error IS NOT NULL ORDER BY created_at ASC`,
  );
}

/** An explicit user action from the dead-letter view -- clears the error so
 *  the next flush retries it. Never automatic; see docs/offline-sync.md §4.3. */
export async function retryDeadLetter(key: string): Promise<void> {
  const database = await requireDb();
  await database.runAsync(`UPDATE outbox SET last_error = NULL, attempts = 0 WHERE key = ?`, key);
}

export async function discardDeadLetter(key: string): Promise<void> {
  const database = await requireDb();
  await database.runAsync(`DELETE FROM outbox WHERE key = ?`, key);
}

async function remove(key: string): Promise<void> {
  const database = await requireDb();
  await database.runAsync(`DELETE FROM outbox WHERE key = ?`, key);
}

async function markFailed(key: string, error: string): Promise<void> {
  const database = await requireDb();
  await database.runAsync(
    `UPDATE outbox SET last_error = ?, attempts = attempts + 1 WHERE key = ?`,
    error,
    key,
  );
}

/** Bumps the retry counter without setting last_error -- a transient failure
 *  keeps the row eligible for the next flush, unlike markFailed(). */
async function markRetry(key: string): Promise<void> {
  const database = await requireDb();
  await database.runAsync(`UPDATE outbox SET attempts = attempts + 1 WHERE key = ?`, key);
}

/**
 * The one ambiguous replay: POST /stock-units/:id/bind takes no key (it's
 * addressed by unit id), so its 409 means either "our write already landed"
 * or "someone else bound it while we were offline" -- indistinguishable
 * without a follow-up read. See docs/offline-sync.md §4.2.
 */
async function resolveBindConflict(endpoint: string, requestBody: unknown): Promise<boolean> {
  const match = /^\/stock-units\/([^/]+)\/bind$/.exec(endpoint);
  if (!match || !match[1]) return false;
  try {
    const unit = await apiFetch<{ purchase_item_id: string | null }>(`/stock-units/${match[1]}`);
    const requested = (requestBody as { purchase_item_id?: string }).purchase_item_id;
    return unit.purchase_item_id === requested;
  } catch {
    // Can't confirm either way -- leave it queued rather than guess.
    return false;
  }
}

let flushing = false;

/**
 * Walks the queue oldest-first and sends each row in sequence (not parallel:
 * several of these writes mutate shared server state, e.g. BatchHouseBalance,
 * so ordering is worth preserving over throughput at a few dozen writes a
 * day). Classification table is docs/offline-sync.md §4.
 *
 * Guarded by `flushing` so a foreground event and a reconnect event can't run
 * this twice at once -- a call that arrives mid-flush returns immediately
 * without waiting. Harmless: the row it would have sent is still queued and
 * the next trigger (foreground, reconnect, or the caller's own next attempt)
 * picks it up.
 */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  let reachedServer = false;
  try {
    await initOutbox();
    if (!db) return;
    const rows = await listPending();
    for (const row of rows) {
      const parsedBody = JSON.parse(row.body) as Record<string, unknown>;
      try {
        await apiFetch(row.endpoint, {
          method: row.method,
          body: JSON.stringify(parsedBody),
        });
        await remove(row.key);
        reachedServer = true;
      } catch (err) {
        // The session ended (expired, deactivated) or a temp password is pending: the write
        // itself is fine, so keep it and stop -- everything behind it would fail the same way.
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.code === 'PASSWORD_CHANGE_REQUIRED')
        ) {
          break;
        }
        if (err instanceof ApiError && err.status === 409) {
          reachedServer = true;
          if (err.isReplayConflict()) {
            await remove(row.key);
            continue;
          }
          const wasOurs = await resolveBindConflict(row.endpoint, parsedBody);
          if (wasOurs) {
            await remove(row.key);
          } else {
            await markFailed(row.key, err.message);
          }
          continue;
        }
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
          // Validation won't fix itself on retry -- surface it instead of
          // spinning forever.
          reachedServer = true;
          await markFailed(row.key, err.message);
          continue;
        }
        // 5xx, network failure, or a 429 -- transient, leave queued.
        await markRetry(row.key);
      }
    }
  } finally {
    flushing = false;
    // "Synced" means "reached the server," not "queue is empty" -- a dead
    // letter still counts, a pure network failure doesn't.
    if (reachedServer) await AsyncStorage.setItem(LAST_SYNCED_KEY, String(Date.now()));
  }
}
