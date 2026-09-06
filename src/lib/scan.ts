/**
 * Scan-session logic for linking QR-coded stock units to a purchase lot.
 *
 * Kept out of the component so it can be checked without a camera — the one
 * part of this feature that can be tested on a machine with no device
 * attached. See scan.test.ts.
 */

/** The QR payload IS the StockUnit id (schema.prisma: "id is the QR payload
 *  itself — printed directly, no separate human-readable code"). Anything that
 *  isn't a uuid came off some other label and must not cost a round-trip. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStockCode(payload: string): boolean {
  return UUID.test(payload.trim());
}

export type ScanOutcome =
  | { kind: 'accept'; id: string }
  /** Already handled this session — silently ignored, not an error. The camera
   *  fires continuously while a code sits in frame. */
  | { kind: 'duplicate'; id: string }
  /** Seen very recently; still settling. Also silent. */
  | { kind: 'cooldown'; id: string }
  | { kind: 'invalid'; payload: string };

export type ScanState = {
  /** Codes already sent this session, in scan order (newest first for display). */
  seen: Set<string>;
  /** id -> timestamp of the last time we acted on it. */
  lastSeenAt: Map<string, number>;
};

export function newScanState(): ScanState {
  return { seen: new Set(), lastSeenAt: new Map() };
}

/** How long the same code stays suppressed after being handled. Long enough
 *  that one label held in frame doesn't fire twice, short enough that
 *  re-scanning deliberately still feels responsive. */
export const COOLDOWN_MS = 1500;

/**
 * Decides what a raw camera payload means, without performing any effect.
 * The caller owns the request; this owns "should we even try".
 */
export function classifyScan(state: ScanState, payload: string, now: number): ScanOutcome {
  const id = payload.trim().toLowerCase();

  if (!isStockCode(id)) return { kind: 'invalid', payload: payload.trim() };

  const last = state.lastSeenAt.get(id);
  if (last !== undefined && now - last < COOLDOWN_MS) return { kind: 'cooldown', id };

  if (state.seen.has(id)) {
    // Refresh the cooldown so a code left in frame doesn't re-report every
    // 1.5s once it's already been accepted.
    state.lastSeenAt.set(id, now);
    return { kind: 'duplicate', id };
  }

  state.lastSeenAt.set(id, now);
  return { kind: 'accept', id };
}

/** Called once a code has actually been sent, so it counts as seen. Separate
 *  from classifyScan because a failed request should NOT mark it seen — the
 *  worker must be able to rescan after fixing whatever went wrong. */
export function markSent(state: ScanState, id: string): void {
  state.seen.add(id);
}

/** A failed send releases the code so it can be tried again immediately. */
export function releaseScan(state: ScanState, id: string): void {
  state.seen.delete(id);
  state.lastSeenAt.delete(id);
}

/** Turns a bind failure into something a person at a farm gate can act on.
 *  The server's own wording is preferred where it's already plain. */
export function bindErrorMessage(status: number, detail: string | undefined): string {
  if (status === 404) return 'Unknown code — not a ZeroD stock unit.';
  if (status === 409) {
    // "StockUnit is already in_stock" -> "Already linked · in stock"
    const state = detail?.match(/already (\w+)/i)?.[1];
    return state ? `Already linked · ${state.replace('_', ' ')}` : 'Already linked.';
  }
  if (status === 0) return "Couldn't reach the server.";
  return detail?.trim() || `Failed with ${status}.`;
}
