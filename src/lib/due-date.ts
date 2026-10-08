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
