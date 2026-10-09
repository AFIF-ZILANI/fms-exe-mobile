/**
 * The Android date dialog speaks in UTC midnights: it is handed, and hands back, the *calendar day* as
 * midnight UTC. Passing it a local timestamp shows the wrong day for part of every evening, and reading
 * its answer with local getters gives yesterday west of Greenwich. These two convert at the boundary.
 */

/** The local calendar day of `local`, as midnight UTC -- what the dialog wants to be shown. */
export const toPickerDay = (local: Date): Date =>
  new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));

/** The day the dialog returned, keeping `base`'s local time of day. */
export const withPickedDay = (picked: Date, base: Date): Date =>
  new Date(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate(), base.getHours(), base.getMinutes(), 0, 0);

/** The time the clock dialog returned, keeping `base`'s local day. */
export const withPickedTime = (picked: Date, base: Date): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate(), picked.getHours(), picked.getMinutes(), 0, 0);

export type QuickDue = { label: string; date: Date };

const roundUpToQuarter = (d: Date): Date => {
  const out = new Date(d);
  out.setMinutes(Math.ceil(out.getMinutes() / 15) * 15, 0, 0);
  return out;
};

/**
 * The three due times a manager actually means: in an hour, this evening, tomorrow morning. This evening
 * only appears while there is still a sensible gap before 6pm, so the list never offers a time that is
 * already gone or about to be.
 */
export function quickDueOptions(now: Date): QuickDue[] {
  const options: QuickDue[] = [{ label: 'In 1 hour', date: roundUpToQuarter(new Date(now.getTime() + 60 * 60 * 1000)) }];

  const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
  if (evening.getTime() - now.getTime() >= 90 * 60 * 1000) options.push({ label: 'Today 6 PM', date: evening });

  options.push({
    label: 'Tomorrow 8 AM',
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0),
  });
  return options;
}

/** A due time that is not after `now` would be overdue the moment it is assigned. */
export const isPastDue = (due: Date, now: Date): boolean => due.getTime() <= now.getTime();

/** Two times that fall in the same minute are the same choice, whatever their seconds. */
export const sameMinute = (a: Date, b: Date): boolean => Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);
