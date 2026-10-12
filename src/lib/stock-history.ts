import type { HouseAllocation, HouseConsumption } from './types';

export type Range = 'today' | 'week' | 'month' | 'all';

export const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'all', label: 'All' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBack = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);

/** Where a filter chip starts, as an ISO instant on the phone's calendar; undefined = no lower bound.
 *  "7 days" is today and the six before it, so it matches the summary's "last 7 days" tile. */
export function rangeFrom(range: Range, now: Date): string | undefined {
  if (range === 'all') return undefined;
  return (range === 'today' ? startOfDay(now) : daysBack(now, range === 'week' ? 6 : 29)).toISOString();
}

/** The two windows the summary endpoints count in. */
export function summaryWindows(now: Date) {
  return { today_from: startOfDay(now).toISOString(), week_from: daysBack(now, 6).toISOString() };
}

export type ActivityRowData = { id: string; title: string; subtitle: string; at: string };

const tail = (id: string) => `…${id.slice(-7)}`;

/** A coded unit moving into a house. A REALLOCATION is one that arrived from another house. */
export function allocationRow(a: HouseAllocation): ActivityRowData {
  return {
    id: a.id,
    title: a.stock_unit.purchase_item?.item.name ?? 'Unlinked unit',
    subtitle: `${tail(a.stock_unit.id)} · ${a.type === 'REALLOCATION' ? 'Moved in' : 'Allocated'}`,
    at: a.occurred_at,
  };
}

/** A draw of stock: how much, and by whom when we know. */
export function consumptionRow(c: HouseConsumption): ActivityRowData {
  const amount = `${Number(c.quantity)} ${c.unit.toLowerCase()}`;
  return {
    id: c.id,
    title: c.item.name,
    subtitle: c.recorded_by?.name ? `${amount} · ${c.recorded_by.name}` : amount,
    at: c.date,
  };
}
