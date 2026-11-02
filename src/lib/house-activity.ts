import type { IconName } from '../components/ui/icon';
import { farmDayNumber } from './farm';

export type ActivityKind =
  | 'MORTALITY'
  | 'USE'
  | 'WEIGHT'
  | 'ENVIRONMENT'
  | 'BIRDS_IN'
  | 'BIRDS_OUT'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ADJUSTMENT'
  | 'VACCINE';

/** One line of GET /houses/:id/activity, already worded by the server. */
export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  at: string;
  /** `at` is a day without a time (a weighing entered on a later day). */
  day_only?: boolean;
  title: string;
  detail: string | null;
  by: string | null;
  batch_code: string | null;
};

type Look = {
  icon: IconName;
  tint: 'tintRed' | 'tintAmber' | 'tintBlue' | 'tintGreen' | 'surfaceAlt';
  color: 'critical' | 'warning' | 'info' | 'success' | 'muted';
};

/** How each kind reads at a glance: deaths red, use and things leaving amber, arrivals green. */
export const ACTIVITY_LOOK: Record<ActivityKind, Look> = {
  MORTALITY: { icon: 'alert-circle', tint: 'tintRed', color: 'critical' },
  USE: { icon: 'package', tint: 'tintAmber', color: 'warning' },
  WEIGHT: { icon: 'bar-chart-2', tint: 'tintBlue', color: 'info' },
  ENVIRONMENT: { icon: 'thermometer', tint: 'tintBlue', color: 'info' },
  BIRDS_IN: { icon: 'arrow-down-circle', tint: 'tintGreen', color: 'success' },
  BIRDS_OUT: { icon: 'arrow-up-circle', tint: 'tintAmber', color: 'warning' },
  STOCK_IN: { icon: 'log-in', tint: 'tintGreen', color: 'success' },
  STOCK_OUT: { icon: 'log-out', tint: 'tintAmber', color: 'warning' },
  ADJUSTMENT: { icon: 'clipboard', tint: 'surfaceAlt', color: 'muted' },
  VACCINE: { icon: 'shield', tint: 'tintGreen', color: 'success' },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "Today", "Yesterday", or "Sun, 1 Nov" -- by farm day, so 01:30 sits under the day it belongs to. */
export function dayLabel(day: number, now: Date): string {
  const today = farmDayNumber(now);
  if (day === today) return 'Today';
  if (day === today - 1) return 'Yesterday';
  return new Date(day * DAY_MS).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** When, as two short lines: "14:32" over "Today" / "16 Oct". No made-up time when only the day is known. */
export function activityStamp(
  entry: Pick<ActivityEntry, 'at' | 'day_only'>,
  now: Date,
): { time: string | null; day: string } {
  const at = new Date(entry.at);
  const day = farmDayNumber(at);
  const today = farmDayNumber(now);
  const label =
    day === today
      ? 'Today'
      : day === today - 1
        ? 'Yesterday'
        : new Date(day * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return { time: entry.day_only ? null : hhmm(at), day: label };
}

/** The second line: what the server added, then who and which batch. */
export function activityMeta(entry: ActivityEntry): string {
  return [entry.detail, entry.by, entry.batch_code].filter(Boolean).join(' · ');
}

/** Consecutive entries (already newest first) bundled under their farm day. */
export function groupByDay(entries: ActivityEntry[], now: Date): { label: string; entries: ActivityEntry[] }[] {
  const groups: { day: number; label: string; entries: ActivityEntry[] }[] = [];
  for (const e of entries) {
    const day = farmDayNumber(new Date(e.at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(e);
    else groups.push({ day, label: dayLabel(day, now), entries: [e] });
  }
  return groups.map(({ label, entries: list }) => ({ label, entries: list }));
}

/** Just the time, for rows already under a day heading. */
export const activityTime = (entry: Pick<ActivityEntry, 'at' | 'day_only'>) => ({
  time: entry.day_only ? '—' : hhmm(new Date(entry.at)),
  day: null,
});
