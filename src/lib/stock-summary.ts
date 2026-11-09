import type { Item } from './types';

/** One row of GET /items/stock-by-location (balance is a Decimal string). */
export type StockRow = {
  item_id: string;
  location_type: string;
  location_id: string;
  balance: string;
  location_name: string;
};

export type StockLine = {
  item: Item;
  balance: number;
  isLow: boolean;
  locations: { name: string; type: string; balance: number }[];
};

/**
 * Items + per-location balances -> one line per active item: the total across every location,
 * Low when the item has a reorder level and the total is below it, Low first then A-Z.
 * Junk balances are ignored and an item with no (or unparsable) reorder level is never Low.
 */
export function summarizeStock(items: Item[], rows: StockRow[]): StockLine[] {
  const byItem = new Map<string, StockRow[]>();
  for (const r of rows) {
    const list = byItem.get(r.item_id) ?? [];
    list.push(r);
    byItem.set(r.item_id, list);
  }

  const lines = items
    .filter((item) => item.is_active)
    .map((item): StockLine => {
      const all = (byItem.get(item.id) ?? [])
        .map((r) => ({ name: r.location_name, type: r.location_type, balance: Number(r.balance) }))
        .filter((l) => Number.isFinite(l.balance));
      const balance = all.reduce((sum, l) => sum + l.balance, 0);
      const reorder = item.reorder_level == null ? null : Number(item.reorder_level);
      const isLow = reorder !== null && Number.isFinite(reorder) && balance < reorder;
      return { item, balance, isLow, locations: all.filter((l) => l.balance !== 0) };
    });

  return lines.sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.item.name.localeCompare(b.item.name));
}

/** "1,200", "90.5", "0" — up to three decimals, no trailing zeros. */
export function formatBalance(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** An item's Bag size in its base unit (50 for a 50 kg feed bag), or 0 when it isn't kept in bags. */
export function bagSize(item: Pick<Item, 'unit' | 'itemUnits'>): number {
  if (item.unit === 'BAG') return 0;
  return Number(item.itemUnits?.find((u) => u.unit === 'BAG')?.factor_to_base ?? 0);
}

/** A stock amount in the item's base unit with its unit: "12.5 kg", "40 ml". An item with a Bag conversion
 *  (feed) always reads in whole bags plus the loose remainder -- "3 Bag 12.5 kg", "3 Bag", "0 Bag 20 kg" --
 *  never bare kg. Same rule as the dashboard's formatStock (web/src/pages/inventory/stock-qty.ts). */
export function formatStock(n: number, item: Pick<Item, 'unit' | 'itemUnits'>): string {
  const base = item.unit.toLowerCase();
  const size = bagSize(item);
  if (size <= 0) return `${formatBalance(n)} ${base}`;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  // epsilon so 150 at 50/bag is 3 bags, not 2 bags 50 kg from float drift
  const bags = Math.floor(abs / size + 1e-9);
  const loose = Number((abs - bags * size).toFixed(3));
  return loose > 0 ? `${sign}${formatBalance(bags)} Bag ${formatBalance(loose)} ${base}` : `${sign}${formatBalance(bags)} Bag`;
}

/** A quantity as entered (a draw, a move): in the base unit it reads like stock ("2 Bag 20 kg"); in a bag
 *  it's "2 Bag"; any other unit stays as entered. `item` may be unknown (an old queued record). */
export function formatEntered(quantity: number, unit: string, item?: Pick<Item, 'unit' | 'itemUnits'> | null): string {
  if (item && unit === item.unit) return formatStock(quantity, item);
  if (unit === 'BAG') return `${formatBalance(quantity)} Bag`;
  return `${formatBalance(quantity)} ${unit.toLowerCase()}`;
}

/** A stock figure split for a big-number layout: the headline and the line under it. Feed gives
 *  { main: "25 Bag", sub: "20 kg" } (sub '' on a whole bag); anything else { main: "40", sub: "ml" }. */
export function stockFigure(n: number, item: Pick<Item, 'unit' | 'itemUnits'>): { main: string; sub: string } {
  if (bagSize(item) <= 0) return { main: formatBalance(n), sub: item.unit.toLowerCase() };
  const [bags, loose = ''] = formatStock(n, item).split(' Bag');
  return { main: `${bags} Bag`, sub: loose.trim() };
}

/** Case-insensitive match on item name or category ("feed", "vacc"); a blank query keeps everything. */
export function searchStock(lines: StockLine[], query: string): StockLine[] {
  const q = query.trim().toLowerCase();
  if (!q) return lines;
  return lines.filter(
    (l) => l.item.name.toLowerCase().includes(q) || l.item.category.toLowerCase().replace(/_/g, ' ').includes(q),
  );
}

/** An item's non-zero balances split into warehouses and houses, each A-Z, for the item detail screen. */
export function groupLocations(line: StockLine): { warehouses: StockLine['locations']; houses: StockLine['locations'] } {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });
  return {
    warehouses: line.locations.filter((l) => l.type === 'WAREHOUSE').sort(byName),
    houses: line.locations.filter((l) => l.type !== 'WAREHOUSE').sort(byName),
  };
}

export type StockState = 'OUT' | 'LOW' | 'OK';

/** Out when nothing is left, Low when below the reorder level, otherwise fine. */
export function stockState(line: Pick<StockLine, 'balance' | 'isLow'>): StockState {
  if (line.balance <= 0) return 'OUT';
  return line.isLow ? 'LOW' : 'OK';
}

/** How full an item is against its reorder level, 0 to 1, with the reorder level drawn at the halfway mark so
 *  "just above it" and "well stocked" look different. Null when the item has no reorder level to measure against. */
export function levelRatio(line: Pick<StockLine, 'balance'> & { item: Pick<Item, 'reorder_level'> }): number | null {
  const reorder = line.item.reorder_level == null ? NaN : Number(line.item.reorder_level);
  if (!Number.isFinite(reorder) || reorder <= 0) return null;
  return Math.max(0, Math.min(1, line.balance / (reorder * 2)));
}

export type StockFilter = { status: 'ALL' | 'LOW' | 'OUT'; category: string | null };

/** Applies the status chip and the category chip together. */
export function filterStock(lines: StockLine[], filter: StockFilter): StockLine[] {
  return lines.filter((l) => {
    if (filter.category && l.item.category !== filter.category) return false;
    const state = stockState(l);
    if (filter.status === 'LOW') return state === 'LOW';
    if (filter.status === 'OUT') return state === 'OUT';
    return true;
  });
}

/** How many items sit in each status, for the chips. */
export function statusCounts(lines: StockLine[]): Record<'ALL' | 'LOW' | 'OUT', number> {
  const counts = { ALL: lines.length, LOW: 0, OUT: 0 };
  for (const l of lines) {
    const s = stockState(l);
    if (s === 'LOW') counts.LOW += 1;
    if (s === 'OUT') counts.OUT += 1;
  }
  return counts;
}

/** Each category present, with its item count, biggest first then A-Z. */
export function categoryCounts(lines: StockLine[]): { category: string; count: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.item.category, (map.get(l.item.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** Low first (act on it), then what is in stock, then what is empty -- each A-Z. Empty items go last: on a farm
 *  with many retired or never-bought items they would otherwise bury the ones that matter. */
export const attentionOrder = (lines: StockLine[]): StockLine[] => {
  const rank = (l: StockLine) => (stockState(l) === 'LOW' ? 0 : stockState(l) === 'OUT' ? 2 : 1);
  return [...lines].sort((a, b) => rank(a) - rank(b) || a.item.name.localeCompare(b.item.name));
};

/** How far the total is from the reorder level: how much short of it, or how much above. Null with no reorder level. */
export function reorderGap(line: Pick<StockLine, 'balance'> & { item: Pick<Item, 'reorder_level'> }): { short: boolean; amount: number } | null {
  const reorder = line.item.reorder_level == null ? NaN : Number(line.item.reorder_level);
  if (!Number.isFinite(reorder) || reorder <= 0) return null;
  const diff = line.balance - reorder;
  return { short: diff < 0, amount: Math.abs(diff) };
}

/** Units an item may be moved or used in: its base unit (factor 1), then every is_usable conversion.
 *  Mirrors the server's toBaseQuantity(..., "USABLE"), which refuses any other unit. */
export function usableUnits(item: Pick<Item, 'unit' | 'itemUnits'>): { unit: string; factor: number }[] {
  const extra = (item.itemUnits ?? [])
    .filter((u) => u.is_usable && u.unit !== item.unit && Number(u.factor_to_base) > 0)
    .map((u) => ({ unit: u.unit, factor: Number(u.factor_to_base) }));
  return [{ unit: item.unit, factor: 1 }, ...extra];
}
