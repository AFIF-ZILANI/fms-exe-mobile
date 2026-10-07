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
