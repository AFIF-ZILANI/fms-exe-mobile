/** What a house screen offers on its stock, kept pure so it can be checked without a device. */

import { checkUnit } from './scan-actions';
import type { StockRow } from './stock-summary';
import type { Item, StockUnit } from './types';

export type UnitActions = { start: boolean; finish: boolean };

/** Which buttons a unit gets, by the scanner's own rules (scan-actions.ts): a sealed unit can be started
 *  or finished, an opened one only finished, and equipment is never "used up". */
export function unitActions(unit: StockUnit, houseId: string): UnitActions {
  return {
    start: checkUnit({ action: 'start', houseId }, unit).ok,
    finish: checkUnit({ action: 'finish', houseId }, unit).ok,
  };
}

export type HouseSupply = { item: Item; balance: number };

/** Feed and other supplies without codes held in this house, A-Z. Only what was moved into the house
 *  counts: the server refuses to log use beyond the house's own balance, so warehouse stock isn't usable here. */
export function houseSupplies(items: Item[], rows: StockRow[], houseId: string): HouseSupply[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: HouseSupply[] = [];
  for (const r of rows) {
    if (r.location_type !== 'HOUSE' || r.location_id !== houseId) continue;
    const item = byId.get(r.item_id);
    const balance = Number(r.balance);
    if (!item || !item.is_active || item.is_unit_tracked || !(balance > 0)) continue;
    out.push({ item, balance });
  }
  return out.sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** How much of one item this house holds (0 when none). */
export function houseBalance(rows: StockRow[], houseId: string, itemId: string): number {
  return rows
    .filter((r) => r.location_type === 'HOUSE' && r.location_id === houseId && r.item_id === itemId)
    .reduce((sum, r) => sum + (Number(r.balance) || 0), 0);
}

/** The last seven characters, which is how a label is read out. */
export const codeTail = (id: string) => `…${id.slice(-7)}`;
