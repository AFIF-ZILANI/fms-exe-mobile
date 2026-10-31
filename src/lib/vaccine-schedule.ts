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
