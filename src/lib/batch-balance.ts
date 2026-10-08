import type { BatchHouseBalance } from './types';

/**
 * The balance row a log form should use for a house. The server lists a house's balances newest-updated
 * first with no quantity filter, so a zero row (a batch moved out or fully lost) can sit ahead of the
 * live batch. Prefer the first row with birds in it; if none has any, keep the first row (the old
 * behaviour), so a form can still resolve its batch.
 */
export function pickLiveBalance(rows: BatchHouseBalance[] | undefined): BatchHouseBalance | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.quantity > 0) ?? rows[0];
}
