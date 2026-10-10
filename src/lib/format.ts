/** No date/number library -- these are small enough that one earns its
 *  keep only if the list grows past what a few functions cover. */

export function formatTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2h ago" / "just now" -- falls back to a plain date past 24h, since
 *  "3d ago" reads worse than "2 Sep" once the reading is stale enough to
 *  matter. Used on House detail's recent-activity feed (docs/PRD.md §6.5). */
export function formatRelative(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Money is a Prisma Decimal serialized as a JSON string -- parse before
 *  formatting or summing, never treat it as a number off the wire
 *  (docs/PRD.md §3). */
export function parseMoney(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: string | number): string {
  const n = parseMoney(value);
  const rounded = Math.round(n).toLocaleString('en-US');
  return `৳${rounded}`; // ৳ -- the seed data's phone numbers (+880) are Bangladesh
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatSignedPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

const UUID_TAIL = /[-_\s]*[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * A batch code is a label a person reads at arm's length, but the field is
 * admin-entered free text and real data has ids pasted into it
 * ("ANALYTICS-ec18144e-7a83-40b5-82c6-86d32189f492" shipped to the v1
 * dashboard as a house label). Strip a pasted uuid tail, cap what's left, and
 * fall back to a short id fragment rather than rendering nothing.
 */
export function formatBatchCode(code?: string | null, id?: string | null): string {
  const raw = code?.trim();
  if (!raw) return id ? `…${id.slice(-4)}` : '—';

  const label = raw.replace(UUID_TAIL, '').trim() || raw;
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

/** The newest of a set of timestamps (ms since the epoch), ignoring zeros and junk; null when there are none. */
export function latestTimestamp(times: number[]): number | null {
  const good = times.filter((t) => Number.isFinite(t) && t > 0);
  return good.length ? Math.max(...good) : null;
}
