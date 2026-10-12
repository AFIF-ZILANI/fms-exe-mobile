import type { HouseCodedStock } from './types';

const plural = (word: string, n: number) => (n === 1 ? word : /(s|x|ch|sh)$/.test(word) ? `${word}es` : `${word}s`);

/** "3 bottles · 3 liter" — what is in the house, in packs and, when the lots know their size, in volume. */
export function stockLabel(line: HouseCodedStock): string {
  // A lot bought by volume (pack unit = the item's own unit, e.g. LITER) has no container name to give.
  const pack = line.pack_unit && line.pack_unit !== line.unit ? line.pack_unit.toLowerCase() : 'unit';
  const count = `${line.units} ${plural(pack, line.units)}`;
  if (line.quantity === null) return count;
  const amount = line.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${count} · ${amount} ${line.unit.toLowerCase()}`;
}

/** How many units the scanner may still take: the chosen item's, or every item's in the house. */
export function unitsAvailable(lines: HouseCodedStock[], itemId?: string): number {
  return lines.filter((l) => !itemId || l.item_id === itemId).reduce((n, l) => n + l.units, 0);
}
