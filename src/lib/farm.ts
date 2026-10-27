/** Domain calculations the server doesn't expose as endpoints because they
 *  don't need to be -- all derivable from data the client already has. */

import type { Batch } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored farm date (midnight UTC of that calendar day, e.g. "2026-09-06T00:00:00Z") as a day count. */
const storedDay = (iso: string) => Math.round(Date.parse(iso.slice(0, 10)) / DAY_MS);
/** The phone's own calendar day -- the farm's day, not UTC's. */
const localDay = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

/** Which day of the batch it is, the farm's way: the placement day is Day 1, the next calendar day Day 2.
 *  Counted in calendar days, so it ticks over at midnight, not 24 hours after placement. */
export function dayOfCycle(startingDate: string, now: Date = new Date()): number {
  return Math.max(1, localDay(now) - storedDay(startingDate) + 1);
}

/** The day number the batch is expected to be sold on (placement = Day 1), what <DayCycleBar/> fills
 *  against: placed Sep 6, sold Nov 5 is Day 61. Falls back to a broiler-typical 35 if the dates are unusable. */
export function expectedCycleDays(batch: Pick<Batch, 'starting_date' | 'expected_selling_date'>): number {
  const days = storedDay(batch.expected_selling_date) - storedDay(batch.starting_date) + 1;
  return days > 1 ? days : 35;
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
