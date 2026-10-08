/**
 * Whose queued record is it? Each row is stamped with the signed-in employee's id when it is
 * queued, and the queue only lists and sends the current person's rows, so a record can never
 * upload under (or be retried by) the next person to sign in on the same phone. Rows queued
 * before the owner column existed have no owner and stay visible to anyone (the old behaviour).
 */
export function isVisibleTo(rowOwner: string | null | undefined, current: string | null): boolean {
  if (!current) return false; // nobody signed in (or profile not loaded): show and send nothing
  return !rowOwner || rowOwner === current;
}
