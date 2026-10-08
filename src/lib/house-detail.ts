/** Wording for the house page, kept pure so it can be verified without a device. */

const DAY_MS = 24 * 60 * 60 * 1000;

export type Freshness = { text: string; today: boolean };

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * When a record was last made, in the words a worker uses: "Today", "Yesterday", "3 days ago",
 * "2 weeks ago". Counted in calendar days where the person is (the phone's local day), so a record
 * made five minutes before midnight is "Yesterday" after midnight. No record, or an unreadable date,
 * is "No record yet". A timestamp slightly in the future (a phone clock a few minutes behind) is today.
 */
export function freshness(iso: string | null | undefined, now: Date): Freshness {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { text: 'No record yet', today: false };

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / DAY_MS);
  if (days <= 0) return { text: 'Today', today: true };
  if (days === 1) return { text: 'Yesterday', today: false };
  if (days < 14) return { text: `${days} days ago`, today: false };
  if (days < 60) return { text: `${Math.floor(days / 7)} weeks ago`, today: false };
  return { text: 'Over 2 months ago', today: false };
}

/** The later of two optional timestamps (the latest medication vs vaccination). An unreadable one never wins. */
export function newestIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const t = (v: string | null | undefined) => {
    const ms = v ? new Date(v).getTime() : Number.NaN;
    return Number.isNaN(ms) ? null : ms;
  };
  const ta = t(a);
  const tb = t(b);
  if (ta === null && tb === null) return null;
  if (tb === null || (ta !== null && ta >= tb)) return a ?? null;
  return b ?? null;
}

export type DaysLeft = { text: string; warn: boolean };

/** "43 days left", amber at three days or fewer, "Cycle ends today", "Past planned end"; empty when there is no planned length. */
export function daysLeft(day: number, expectedDays: number): DaysLeft {
  if (!Number.isFinite(day) || !Number.isFinite(expectedDays) || expectedDays <= 0) {
    return { text: '', warn: false };
  }
  const left = expectedDays - Math.max(0, Math.floor(day));
  if (left < 0) return { text: 'Past planned end', warn: true };
  if (left === 0) return { text: 'Cycle ends today', warn: true };
  return { text: `${left} day${left === 1 ? '' : 's'} left`, warn: left <= 3 };
}
