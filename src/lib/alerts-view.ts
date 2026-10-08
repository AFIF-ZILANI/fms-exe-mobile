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

export type LevelFilter = 'ALL' | AlertLevel;

/** How many alerts sit at each level, for the filter chips. */
export function countByLevel(alerts: FarmAlert[]): Record<LevelFilter, number> {
  const counts: Record<LevelFilter, number> = { ALL: alerts.length, CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const a of alerts) counts[a.level] += 1;
  return counts;
}

export const filterAlerts = (alerts: FarmAlert[], filter: LevelFilter): FarmAlert[] =>
  filter === 'ALL' ? alerts : alerts.filter((a) => a.level === filter);

/** Where "open it" goes for an alert: the screen where the person can act on what it is about. The
 *  family is the part of the server's dedupe key before the colon. Null when there is nowhere to go. */
export type AlertTarget = { label: string; href: string };

export function alertTarget(alert: Pick<FarmAlert, 'dedupe_key' | 'related_id'>): AlertTarget | null {
  const family = alert.dedupe_key?.split(':')[0];
  const id = alert.related_id;
  switch (family) {
    case 'LOW_STOCK':
      return id ? { label: 'View item', href: `/stock/${id}` } : null;
    case 'EXPIRY':
      return { label: 'View stock', href: '/stock' };
    case 'MORTALITY':
    case 'LOG_MISSING':
      return id ? { label: 'Open house', href: `/houses/${id}` } : null;
    case 'TASK_OVERDUE':
      return id ? { label: 'View task', href: `/tasks/${id}` } : null;
    case 'NEG_PERF':
    case 'PROBATION':
      return id ? { label: 'View person', href: `/team/${id}` } : null;
    default:
      return null;
  }
}

/** Ids of alerts this person has already looked at, kept on the phone. A damaged entry is an empty list. */
export function parseSeen(raw: string | null | undefined): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const SEEN_CAP = 300;

/** Adds ids to the seen list, oldest dropped past the cap so it never grows without bound. */
export function mergeSeen(seen: string[], ids: string[]): string[] {
  return [...new Set([...seen, ...ids])].slice(-SEEN_CAP);
}

export const unseenAlerts = (alerts: FarmAlert[], seen: string[]): FarmAlert[] => {
  const known = new Set(seen);
  return alerts.filter((a) => !known.has(a.id));
};

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
