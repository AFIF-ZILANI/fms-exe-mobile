import { formatBalance } from './stock-summary';
import { humanise } from './profile-format';
import type { StockUnitStatus } from './types';

/** GET /stock-units/:id/profile -- one coded unit, everything known about it. */
export type UnitProfile = {
  id: string;
  status: StockUnitStatus;
  bound_at: string | null;
  bound_by: string | null;
  asset: { name: string; status: string } | null;
  /** null for a code not linked to a purchase lot yet. */
  item: { id: string; name: string; category: string; unit: string } | null;
  location: { type: 'HOUSE' | 'WAREHOUSE'; name: string; since: string | null } | null;
  /** Base units left: in this unit (null when the lot has no unit count) and in its whole lot. */
  remaining: { unit: string | null; lot: string } | null;
  lot: {
    id: string;
    quantity: string;
    unit: string;
    base_quantity: string;
    unit_count: number | null;
    unit_price: string;
    total_price: string;
    cost_per_unit: string | null;
    mfg_date: string | null;
    expiration_date: string | null;
    /** How many of the lot's codes are in each status. */
    codes: Partial<Record<StockUnitStatus, number>>;
  } | null;
  purchase: {
    id: string;
    purchase_date: string;
    invoice_no: string | null;
    warehouse: string;
    recorded_by: string;
    supplier: { name: string; company: string | null; mobile: string | null } | null;
  } | null;
  movements: { id: string; type: 'ALLOCATION' | 'REALLOCATION' | 'RETURN'; house: string | null; at: string; by: string | null }[];
  uses: {
    id: string;
    at: string;
    house: string;
    quantity: string;
    unit: string;
    batch_code: string | null;
    by: string;
    note: string | null;
    treatment: string | null;
  }[];
};

type Tone = 'success' | 'info' | 'warning' | 'critical' | 'neutral';

/** The words a worker uses for a unit's state. Equipment is never "used up", it is in use or not. */
export function unitStatus(status: StockUnitStatus, category: string | null): { label: string; tone: Tone } {
  const tool = category === 'EQUIPMENT';
  switch (status) {
    case 'BOUND':
      return { label: tool ? 'Not in use' : 'Sealed', tone: 'success' };
    case 'IN_USE':
      return { label: tool ? 'In use' : 'Opened', tone: 'info' };
    case 'CONSUMED':
      return { label: 'Used up', tone: 'neutral' };
    case 'DISPOSED':
      return { label: 'Disposed', tone: 'critical' };
    case 'PRINTED':
      return { label: 'Not linked yet', tone: 'warning' };
    default:
      return { label: 'Not printed', tone: 'neutral' };
  }
}

const DAY_MS = 86_400_000;

/** How close the lot is to its expiry date: past it is critical, the last 30 days a warning. */
export function expiryState(iso: string | null, now: Date): { label: string; tone: Tone } | null {
  if (!iso) return null;
  const days = Math.floor((Date.parse(iso.slice(0, 10)) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS);
  if (days < 0) return { label: `Expired ${-days} ${-days === 1 ? 'day' : 'days'} ago`, tone: 'critical' };
  if (days === 0) return { label: 'Expires today', tone: 'critical' };
  if (days <= 30) return { label: `Expires in ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'warning' };
  return null;
}

/** "Moved to House 2" / "Back to the warehouse". */
export function movementTitle(m: UnitProfile['movements'][number]): string {
  return m.house ? `Moved to ${m.house}` : 'Back to the warehouse';
}

const qty = (value: string, unit: string) => `${formatBalance(Number(value))} ${humanise(unit).toLowerCase()}`;

/** "Used 2 ml in House 2". */
export function usageTitle(u: UnitProfile['uses'][number]): string {
  return `Used ${qty(u.quantity, u.unit)} in ${u.house}`;
}

/**
 * What is left in this unit and how full it is: "7.5 of 10 ml" and 0.75. Null when there is nothing
 * sensible to say -- equipment isn't used up, a used-up unit has nothing left, and a lot without a unit
 * count doesn't know one unit's size.
 */
export function unitLeft(p: UnitProfile): { text: string; share: number } | null {
  if (!p.item || !p.lot || !p.remaining || p.item.category === 'EQUIPMENT') return null;
  if (p.status === 'CONSUMED' || p.status === 'DISPOSED') return null;
  if (p.remaining.unit === null || !p.lot.unit_count) return null;
  const size = Number(p.lot.base_quantity) / p.lot.unit_count;
  const left = Math.max(0, Math.min(size, Number(p.remaining.unit)));
  const unit = humanise(p.item.unit).toLowerCase();
  return { text: `${formatBalance(left)} of ${formatBalance(size)} ${unit}`, share: size > 0 ? left / size : 0 };
}

/** The lot's codes in the words above, busiest first: "3 sealed · 1 opened · 2 used up". */
export function lotCodesSummary(codes: Partial<Record<StockUnitStatus, number>>, category: string | null): string {
  return (Object.entries(codes) as [StockUnitStatus, number][])
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([status, n]) => `${n} ${unitStatus(status, category).label.toLowerCase()}`)
    .join(' · ');
}
