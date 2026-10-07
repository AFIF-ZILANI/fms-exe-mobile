import type { BatchHouseBalance, House } from './types';

export type HouseFilter = 'ALL' | 'RUNNING' | 'EMPTY';

/** One house and the batch currently in it (if any). */
export type HouseLine = {
  house: House;
  /** The first positive balance in this house; null when it is empty. */
  balance: BatchHouseBalance | null;
  running: boolean;
};

/**
 * Houses in the farm's spatial order — by house number, then name — each with the live batch in it.
 * A worker's model of the farm is spatial, so the order never depends on status or size. A house
 * without a number goes last. "Running" means a positive balance; zero or none is an empty house.
 */
export function buildHouseLines(houses: House[], balances: BatchHouseBalance[]): HouseLine[] {
  return [...houses]
    .sort(
      (a, b) =>
        (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    )
    .map((house) => {
      const balance = balances.find((b) => b.house_id === house.id && b.quantity > 0) ?? null;
      return { house, balance, running: balance !== null };
    });
}

export type HousesSummary = { birds: number; running: number; empty: number; total: number };

/** Live birds are counted from running houses only. */
export function summarizeHouses(lines: HouseLine[]): HousesSummary {
  const running = lines.filter((l) => l.running);
  return {
    birds: running.reduce((sum, l) => sum + (l.balance?.quantity ?? 0), 0),
    running: running.length,
    empty: lines.length - running.length,
    total: lines.length,
  };
}

export function filterHouses(lines: HouseLine[], filter: HouseFilter): HouseLine[] {
  if (filter === 'RUNNING') return lines.filter((l) => l.running);
  if (filter === 'EMPTY') return lines.filter((l) => !l.running);
  return lines;
}

export type CycleProgress = { ratio: number; label: string; over: boolean };

/**
 * Where a batch is in its planned cycle: a 0–1 fill for the bar, the words ("Day 17 of ~60"), and
 * whether it has run past the planned end (the bar is then full and the UI can say so). Unusable
 * inputs give an empty bar, never NaN or a negative width.
 */
export function cycleProgress(day: number, expectedDays: number): CycleProgress {
  const d = Number.isFinite(day) ? Math.max(0, Math.floor(day)) : 0;
  const total = Number.isFinite(expectedDays) && expectedDays > 0 ? expectedDays : 0;
  return {
    ratio: total > 0 ? Math.min(1, d / total) : 0,
    label: total > 0 ? `Day ${d} of ~${total}` : `Day ${d}`,
    over: total > 0 && d > total,
  };
}
