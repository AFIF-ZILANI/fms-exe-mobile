import type { StockUnit } from '@/lib/types';

/** A batch's planned vaccine row (GET /batch-vaccine-schedules?batch_id=). Workers can only confirm one. */
export type VaccineScheduleRow = {
  id: string;
  batch_id: string;
  /** What it's for (Gumboro, Ranikhet...). No product: any vaccine bottle scanned at confirm is what was given. */
  purpose: string;
  purposeRef: { code: string; label: string };
  method: VaccineMethod | null;
  planned_day: number;
  day: number;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
  reason: string | null;
  confirmed_by: { id: string; name: string } | null;
  confirmed_at: string | null;
  vaccinations: { id: string; vaccine_name: string; consumption: { quantity: string; unit: string } | null }[];
  /** Every house the batch is in; each confirms for itself, and the row is DONE once all have. */
  houses: { id: string; name: string; confirm: { confirmed_at: string; confirmed_by: { id: string; name: string } } | null }[];
};

export type VaccineMethod =
  | 'EYE_DROP'
  | 'NASAL_DROP'
  | 'DRINKING_WATER'
  | 'MUSCLE_INJECTION'
  | 'NECK_INJECTION'
  | 'SPRAY';

export const METHOD_LABEL: Record<VaccineMethod, string> = {
  EYE_DROP: 'Eye drop',
  NASAL_DROP: 'Nasal drop',
  DRINKING_WATER: 'Drinking water',
  MUSCLE_INJECTION: 'Muscle injection',
  NECK_INJECTION: 'Neck injection',
  SPRAY: 'Spray',
};

export type VaccineRowState = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'DONE' | 'CANCELLED';

/** Due/overdue are derived from today's batch day, never stored. Only due and overdue rows can be confirmed --
 *  the server enforces the same rule (today's day >= row.day). */
export function rowState(row: Pick<VaccineScheduleRow, 'status' | 'day'>, today: number): VaccineRowState {
  if (row.status !== 'PENDING') return row.status;
  if (row.day === today) return 'DUE_TODAY';
  return row.day < today ? 'OVERDUE' : 'UPCOMING';
}

/** This house can confirm when the row is due or overdue and this house hasn't confirmed it yet. */
export function canConfirm(state: VaccineRowState, row: Pick<VaccineScheduleRow, 'houses'>, houseId?: string): boolean {
  if (state !== 'DUE_TODAY' && state !== 'OVERDUE') return false;
  const house = row.houses.find((h) => h.id === houseId);
  return !!house && !house.confirm;
}

const BLOCKED: Partial<Record<StockUnit['status'], string>> = {
  UNASSIGNED: 'Not linked to a purchase yet.',
  PRINTED: 'Not linked to a purchase yet.',
  CONSUMED: 'Already used up.',
  DISPOSED: 'Already disposed.',
};

/** Why a scanned (or typed) bottle can't go into this house's confirm, or null when it can. The server checks
 *  the same and more (what's left in it); this just answers on the spot instead of at Confirm. */
export function bottleProblem(unit: StockUnit, houseId: string, houseName: string): string | null {
  const blocked = BLOCKED[unit.status];
  if (blocked) return blocked;
  const item = unit.purchase_item?.item;
  if (!item) return 'This bottle has no purchase record.';
  // The row names a purpose, not a product: any vaccine bottle will do.
  if (item.category !== 'VACCINE') return `${item.name} isn't a vaccine.`;
  // A split batch is confirmed house by house: the bottles have to be in this house.
  const here = unit.houseAllocations?.[0];
  if (here?.house_id !== houseId) return `In ${here?.house?.name ?? 'the warehouse'} — move it to ${houseName} first.`;
  return null;
}


/** The calendar date a batch day falls on (Day 1 = placement day), the same rule as dayOfCycle. */
export function dateOfDay(startingDate: string, day: number): Date {
  const [y, m, d] = startingDate.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d! + day - 1);
}

export const shortDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** How far off a day is, in words: "today", "in 3 days", "2 days late". */
export function relativeDay(day: number, today: number): string {
  const n = day - today;
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n > 0) return `in ${n} days`;
  return n === -1 ? '1 day late' : `${-n} days late`;
}

export type VaccineGroups = { due: VaccineScheduleRow[]; upcoming: VaccineScheduleRow[]; done: VaccineScheduleRow[] };

/** The timeline as a worker in one house reads it. Due = theirs to confirm now (oldest first,
 *  so overdue tops the list); a row this house already confirmed counts as done here even while another
 *  house is still waiting. Cancelled rows sit with the done ones, muted. */
export function groupRows(rows: VaccineScheduleRow[], today: number, houseId?: string): VaccineGroups {
  const groups: VaccineGroups = { due: [], upcoming: [], done: [] };
  for (const row of [...rows].sort((a, b) => a.day - b.day)) {
    const doneHere = !!row.houses.find((h) => h.id === houseId)?.confirm;
    if (row.status !== 'PENDING' || doneHere) groups.done.push(row);
    else if (row.day <= today) groups.due.push(row);
    else groups.upcoming.push(row);
  }
  return groups;
}

/** The one row the house screen previews: what's due here now, else what's next. */
export function nextVaccine(rows: VaccineScheduleRow[], today: number, houseId?: string): VaccineScheduleRow | null {
  const { due, upcoming } = groupRows(rows, today, houseId);
  return due[0] ?? upcoming[0] ?? null;
}
