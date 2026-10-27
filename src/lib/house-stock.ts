/** What a house screen offers on its stock, kept pure so it can be checked without a device. */

import { checkUnit } from './scan-actions';
import type { StockLine } from './stock-summary';
import type { StockUnit } from './types';

export type UnitActions = { start: boolean; finish: boolean };

/** Which buttons a unit gets, by the scanner's own rules (scan-actions.ts): a sealed unit can be started
 *  or finished, an opened one only finished, and equipment is never "used up". */
export function unitActions(unit: StockUnit, houseId: string): UnitActions {
  return {
    start: checkUnit({ action: 'start', houseId }, unit).ok,
    finish: checkUnit({ action: 'finish', houseId }, unit).ok,
  };
}

/** Feed and other supplies without codes that have stock to draw on, A-Z. */
export function bulkLines(lines: StockLine[]): StockLine[] {
  return lines
    .filter((l) => !l.item.is_unit_tracked && l.balance > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** The last seven characters, which is how a label is read out. */
export const codeTail = (id: string) => `…${id.slice(-7)}`;
