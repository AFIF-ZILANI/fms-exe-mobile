/** How many bottles a lot splits into: 10 L in 1 L bottles = 10 codes. null unless size divides the total evenly. */
export function codesNeeded(total: number, size: number): number | null {
  if (!(total > 0) || !(size > 0)) return null;
  const n = total / size;
  const whole = Math.round(n);
  return whole >= 1 && Math.abs(n - whole) < 1e-9 ? whole : null;
}
