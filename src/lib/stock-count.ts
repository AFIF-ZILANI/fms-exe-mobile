import { farmDayNumber } from './farm';
import type { StockUnit, StockUnitStatus } from './types';

/** A unit the server says should be at the counted place (GET /stock-units/at-location). */
export type CountUnit = {
  id: string;
  status: StockUnitStatus;
  item: { id: string; name: string; category: string; unit: string };
};

/** A scanned code that wasn't on the expected list: the unit as the server has it, or null if unknown. */
export type Stray = { id: string; unit: StockUnit | null };

export type CountResult = {
  /** Expected here, not scanned: used without a scan, lost, or elsewhere. */
  missing: CountUnit[];
  /** Expected and scanned. */
  counted: CountUnit[];
  /** Scanned, live (BOUND/IN_USE), but recorded somewhere else: the system has its place wrong. */
  foundHere: Stray[];
  /** Scanned but not movable: unknown code, not bound yet, used up or disposed. */
  notes: Stray[];
};

const LIVE: StockUnitStatus[] = ['BOUND', 'IN_USE'];

/** Expected vs scanned. Pure, so the review screen's three lists are a tested fact. */
export function diffCount(
  expected: CountUnit[],
  scanned: Iterable<string>,
  strays: Map<string, StockUnit | null>,
): CountResult {
  const seen = new Set(scanned);
  const expectedIds = new Set(expected.map((u) => u.id));
  const foundHere: Stray[] = [];
  const notes: Stray[] = [];
  for (const id of seen) {
    if (expectedIds.has(id)) continue;
    const unit = strays.get(id) ?? null;
    (unit && LIVE.includes(unit.status) ? foundHere : notes).push({ id, unit });
  }
  return {
    missing: expected.filter((u) => !seen.has(u.id)),
    counted: expected.filter((u) => seen.has(u.id)),
    foundHere,
    notes,
  };
}

/** Why a stray can't be fixed by moving it, in words for the notes list. */
export function strayNote(s: Stray): string {
  if (!s.unit) return 'Unknown code';
  switch (s.unit.status) {
    case 'CONSUMED':
      return 'Marked used up, but it is here';
    case 'DISPOSED':
      return 'Marked disposed, but it is here';
    case 'SOLD':
      return 'Marked sold, but it is here';
    case 'UNASSIGNED':
    case 'PRINTED':
      return 'Not linked to a delivery yet';
    default:
      return '';
  }
}

export type CountBatch = {
  id: string;
  batch_code: string;
  status: 'RUNNING' | 'SOLD' | 'CLOSED';
} | null;

/** "Consumed" needs a batch to carry the cost; null = good to go. */
export function consumeBlockReason(batch: CountBatch): string | null {
  if (!batch) return 'No batch was in this house that day. Pick the day it was used, or another house.';
  if (batch.status === 'CLOSED') return `Batch ${batch.batch_code} is finalised. Its books are closed.`;
  return null;
}

/** Equipment is used, not used up: it leaves through dispose, so "Consumed" isn't offered for it. */
export const canConsume = (units: CountUnit[]) =>
  units.length > 0 && units.every((u) => u.item.category !== 'EQUIPMENT');

const DAY_MS = 86_400_000;

/** The same moment n farm days back -- "used yesterday" is today's time, a day earlier. */
export const daysAgo = (n: number, now: Date = new Date()) => new Date(now.getTime() - n * DAY_MS);

/** An instant's farm day as YYYY-MM-DD, the ?date= the server's batch lookup reads. */
export const farmDateParam = (d: Date) => new Date(farmDayNumber(d) * DAY_MS).toISOString().slice(0, 10);

/** The server's 409 for a unit already where the action would put it (a retried write that landed). */
export function alreadyDone(
  action: 'CONSUMED' | 'START' | 'MOVE' | 'RETURN' | 'DISPOSE',
  err: { status: number; message: string },
) {
  if (err.status !== 409) return false;
  const pattern = {
    CONSUMED: /is consumed/,
    START: /already in use/,
    MOVE: /already at that house/,
    RETURN: /already at the warehouse/,
    DISPOSE: /already disposed/,
  }[action];
  return pattern.test(err.message);
}
