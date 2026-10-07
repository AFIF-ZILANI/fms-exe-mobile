/**
 * Pure formatting for the Profile screen, kept out of the component so it can be
 * verified without a device. docs/profile-redesign-design.md.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `D Mon YYYY` from the stored UTC calendar date, so it never shifts a day with the phone's timezone. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function wholeMonths(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(months, 0);
}

function wholeDays(from: Date, to: Date): number {
  return Math.max(Math.floor((to.getTime() - from.getTime()) / 86_400_000), 0);
}

/** "1 yr 7 mo", "7 mo", "12 days", "Joined today". Never negative. */
export function formatTenure(joinedIso: string, now: Date): string {
  const joined = new Date(joinedIso);
  const months = wholeMonths(joined, now);
  if (months >= 1) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years ? `${years} yr` : '', rest ? `${rest} mo` : ''].filter(Boolean).join(' ');
  }
  const days = wholeDays(joined, now);
  if (days === 0) return 'Joined today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The short form for a stat tile: "1y 7m", "7m", "12d", "New". */
export function formatTenureShort(joinedIso: string, now: Date): string {
  const joined = new Date(joinedIso);
  const months = wholeMonths(joined, now);
  if (months >= 1) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years ? `${years}y` : '', rest ? `${rest}m` : ''].filter(Boolean).join(' ');
  }
  const days = wholeDays(joined, now);
  return days === 0 ? 'New' : `${days}d`;
}

/** Whole years; null for a missing, unparsable or future date of birth. */
export function ageFromDob(dobIso: string | null | undefined, now: Date): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime()) || dob.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Last four digits only. A phone can be shared or lost, so the head of the id never appears;
 *  an id of four digits or fewer would be the whole number, so it reveals nothing at all. */
export function maskNid(nid: string | null | undefined): string | null {
  const v = nid?.trim();
  if (!v) return null;
  if (v.length <= 4) return '••••';
  return `•••• ${v.slice(-4)}`;
}

function humanise(value: string): string {
  const t = value.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function roleLabel(role: string): string {
  return humanise(role);
}

const STATUS: Record<string, string> = {
  APPOINTED: 'Appointed',
  PROBATION: 'On probation',
  CONFIRMED: 'Confirmed',
  TERMINATED: 'Ended',
};

export function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS[status] ?? humanise(status);
}

export function maritalLabel(value: string | null | undefined): string | null {
  return value ? humanise(value) : null;
}

const EDUCATION: Record<string, string> = {
  NONE: 'No formal schooling',
  PRIMARY: 'Primary',
  JSC: 'JSC',
  SSC: 'SSC',
  DAKHIL: 'Dakhil',
  HSC: 'HSC',
  ALIM: 'Alim',
  DIPLOMA: 'Diploma',
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
};

export function educationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return EDUCATION[value] ?? humanise(value);
}

/** "3 yrs · Layer farm, Gazipur", or just the years, or just the note. */
export function formatExperience(
  years: number | null | undefined,
  note: string | null | undefined,
): string | null {
  const n = note?.trim() || null;
  const y = years && years > 0 ? `${years} yr${years === 1 ? '' : 's'}` : null;
  if (y && n) return `${y} · ${n}`;
  return y ?? n;
}

/** Trimmed text, or null when missing or blank — null is what shows as "Not provided". */
export function displayValue(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function hasEmergencyContact(e: {
  emergency_name?: string | null;
  emergency_phone?: string | null;
}): boolean {
  return !!(displayValue(e.emergency_name) || displayValue(e.emergency_phone));
}
