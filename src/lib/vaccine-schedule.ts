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

export const canConfirm = (state: VaccineRowState) => state === 'DUE_TODAY' || state === 'OVERDUE';

/** The units a bottle's amount can be entered in: its item's own unit, then any conversion marked usable. */
export function amountUnits(item: { unit: string; itemUnits?: { unit: string; is_usable: boolean }[] }): string[] {
  return [...new Set([item.unit, ...(item.itemUnits ?? []).filter((u) => u.is_usable).map((u) => u.unit)])];
}
