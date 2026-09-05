/** Domain calculations the server doesn't expose as endpoints because they
 *  don't need to be -- all derivable from data the client already has. */

import type { Batch } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `today − batch.starting_date`, in whole days. There's no endpoint for
 *  this and it doesn't need one (docs/PRD.md §6.5). */
export function dayOfCycle(startingDate: string): number {
  const start = new Date(startingDate).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / DAY_MS));
}

/** The batch's own planned length, from placement to expected sale --
 *  what <DayCycleBar/> fills against. Falls back to a broiler-typical 35
 *  days if the dates are unusable. */
export function expectedCycleDays(batch: Pick<Batch, 'starting_date' | 'expected_selling_date'>): number {
  const start = new Date(batch.starting_date).getTime();
  const end = new Date(batch.expected_selling_date).getTime();
  const days = Math.round((end - start) / DAY_MS);
  return days > 0 ? days : 35;
}

/** The ledger gutter's house token -- "H2", or an em dash when the row
 *  isn't house-bound (docs/design.md §6.2). */
export function houseToken(houseNumber: number | undefined | null): string {
  return houseNumber === undefined || houseNumber === null ? '—' : `H${houseNumber}`;
}

/** Two-letter initials for the gutter on team lists. Falls back to the first
 *  two characters for a single-word or non-Latin name — several employees'
 *  names are Bengali, where a word-split gives one token. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** First and last instant of the month containing `date`, as ISO strings --
 *  the window the performance screens query a score total over. */
export function monthRange(date: Date): { from: string; to: string } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The payroll adjustment a month's points would produce, clamped to
 * [-10%, +20%] exactly as PayrollRecord does server-side.
 *
 * Deliberately asymmetric -- the floor is easier to hit than the ceiling.
 * Don't "balance" it. Client-side only for the *projection* on an open
 * month; the real figure comes from PayrollRecord once an Admin runs
 * payroll (docs/PRD.md §6.3).
 */
export function clampAdjustment(points: number): number {
  return Math.max(-10, Math.min(20, points));
}
