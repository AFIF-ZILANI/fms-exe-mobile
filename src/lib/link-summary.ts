import { isLotComplete } from './lot-split';

/** The fields of a purchase line the Link items overview reads. */
export type SummaryLot = {
  unit_count: number | null;
  _count?: { stockUnits: number };
  last_linked_at: string | null;
  linked_since: number;
};

const linkedOf = (p: SummaryLot) => p._count?.stockUnits ?? 0;

/**
 * What the Link items overview shows: every lot still pending, the most recently
 * completed few, and the figures across all of them. `linked_since` is the
 * server's per-line count of units linked since the start of today.
 */
export function summarizeLots<T extends SummaryLot>(lots: T[], recentLimit = 5) {
  const pending = lots.filter((p) => !isLotComplete(p.unit_count, linkedOf(p)));
  const done = lots
    .filter((p) => isLotComplete(p.unit_count, linkedOf(p)))
    // newest finish first; a lot with no link time (never happens for a complete one) sinks
    .sort((a, b) => (b.last_linked_at ?? '').localeCompare(a.last_linked_at ?? ''));

  return {
    pending,
    recent: done.slice(0, recentLimit),
    kpis: {
      pendingCount: pending.length,
      /** Pending lots with no bottle count yet: their codes-to-go is unknowable until someone sets it. */
      notSplit: pending.filter((p) => p.unit_count === null).length,
      /** Codes still to link on lots whose count is known. */
      codesToLink: pending.reduce((n, p) => n + (p.unit_count === null ? 0 : p.unit_count - linkedOf(p)), 0),
      linkedToday: lots.reduce((n, p) => n + p.linked_since, 0),
      lotsTouchedToday: lots.filter((p) => p.linked_since > 0).length,
      completedCount: done.length,
      totalLots: lots.length,
    },
  };
}
