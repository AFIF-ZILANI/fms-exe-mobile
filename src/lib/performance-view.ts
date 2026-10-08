import { clampAdjustment } from './farm';

/** The adjustment band, in percent: −10 at the floor, +20 at the ceiling. Mirrors the server's clamp. */
export const ADJUST_MIN = -10;
export const ADJUST_MAX = 20;

/** Where a month's points sit on the −10…+20 scale, 0 (floor) to 1 (ceiling). Beyond the band it pins to the end. */
export const scalePosition = (points: number): number =>
  (clampAdjustment(points) - ADJUST_MIN) / (ADJUST_MAX - ADJUST_MIN);

/** Where zero sits on that scale, so the bar can show the break between losing and gaining. */
export const ZERO_POSITION = (0 - ADJUST_MIN) / (ADJUST_MAX - ADJUST_MIN);

/** What a month's entries added and took away, as two non-negative numbers. */
export function splitPoints(entries: { points: number }[]): { earned: number; lost: number } {
  let earned = 0;
  let lost = 0;
  for (const e of entries) {
    if (e.points > 0) earned += e.points;
    else lost += -e.points;
  }
  return { earned, lost };
}

/** How many months back a payroll month is from now: 0 for this month, −1 for last, and so on. */
export function monthOffsetFor(monthIso: string, now: Date): number {
  const m = new Date(monthIso);
  return m.getUTCFullYear() * 12 + m.getUTCMonth() - (now.getFullYear() * 12 + now.getMonth());
}

/** "+3%", "−2%", "0%": a whole percent, signed. */
export function signedPercent(value: number | string): string {
  const n = Math.round(Number(value));
  return n > 0 ? `+${n}%` : `${n}%`;
}

/** Which payroll record, if any, belongs to the month `viewed` falls in. Records carry the month as UTC midnight. */
export function recordForMonth<T extends { month: string }>(records: T[], viewed: Date): T | undefined {
  return records.find((r) => monthOffsetFor(r.month, viewed) === 0);
}
