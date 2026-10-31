/** A batch's planned vaccine row (GET /batch-vaccine-schedules?batch_id=). Workers can only confirm one. */
export type VaccineScheduleRow = {
  id: string;
  batch_id: string;
  item_id: string;
  item: { id: string; name: string; unit: string; itemUnits: { unit: string }[] };
  purpose: string;
  method: string | null;
  planned_day: number;
  day: number;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
  reason: string | null;
  confirmed_by: { id: string; name: string } | null;
  confirmed_at: string | null;
  vaccinations: { id: string; consumption: { quantity: string; unit: string } | null }[];
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

/** The units a bottle's amount can be entered in: the item's own unit, then any usable conversion. */
export function amountUnits(item: VaccineScheduleRow['item']): string[] {
  return [...new Set([item.unit, ...item.itemUnits.map((u) => u.unit)])];
}
