import type { AlertLevel, FarmAlert } from './types';

const RANK: Record<AlertLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

const issuedMs = (a: FarmAlert) => {
  const ms = new Date(a.issued_at || a.created_at).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
};

/** Critical first, then Warning, then Info; newest first inside a level (an unreadable date goes last).
 *  Pass `byLevel = false` for a plain newest-first list (resolved alerts). Never mutates its input. */
export function sortAlerts(alerts: FarmAlert[], byLevel = true): FarmAlert[] {
  return [...alerts].sort(
    (a, b) => (byLevel ? RANK[a.level] - RANK[b.level] : 0) || issuedMs(b) - issuedMs(a),
  );
}

/** What the Home bell shows: the server's total of active alerts (not just this page) and whether any
 *  shown alert is Critical (the badge turns red only then). */
export function summarizeAlerts(results: FarmAlert[], total?: number): { count: number; critical: boolean } {
  const count = typeof total === 'number' && Number.isFinite(total) ? Math.max(0, total) : results.length;
  return { count, critical: results.some((a) => a.level === 'CRITICAL') };
}

const LEVEL: Record<AlertLevel, string> = { CRITICAL: 'Critical', WARNING: 'Warning', INFO: 'Info' };
export const levelWord = (level: AlertLevel): string => LEVEL[level];

const TYPE: Record<FarmAlert['type'], string> = {
  EMPLOYEE: 'Employee',
  BATCH: 'Batch',
  FEED: 'Feed',
  MEDICINE: 'Medicine',
  SYSTEM: 'System',
};
export const alertTypeLabel = (type: FarmAlert['type']): string => TYPE[type];
