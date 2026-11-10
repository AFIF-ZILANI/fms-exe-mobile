/**
 * The Hisab Khata palette, the one place its hex values live. constants/theme.ts builds the app's colour roles
 * from it, and tailwind.config.js turns it into classes (through the CSS variables `ledgerVars` makes, so a class
 * follows light and dark).
 *
 * Light: approved 2026-11-10. `warning` (a ledger ochre) added on request the same day, for "needs a look"
 * states (waiting to upload, low stock, an unusual count) so red stays for losses, deaths and errors.
 * Dark: derived from light (deep ink ground, the same hues lifted for contrast); shipped in 1.0.11 for the user to judge on the phone.
 */
const light = {
  primary: '#1F3A5F',
  onPrimary: '#FFFFFF',
  background: '#EEF1F4',
  surface: '#FFFFFF',
  ink: '#1A2230',
  muted: '#5B6576',
  line: '#D5DBE3',
  success: '#2E7D4F',
  warning: '#8A5A00',
  error: '#B3261E',
};

const dark = {
  primary: '#9DB7DB',
  onPrimary: '#0F1B2D',
  background: '#121821',
  surface: '#1A222E',
  ink: '#E7EBF1',
  muted: '#9BA5B4',
  line: '#2B3545',
  success: '#6FC293',
  warning: '#E2B25C',
  error: '#F2877D',
};

/** '#1F3A5F' -> '31 58 95', the form Tailwind's `rgb(var(--x) / <alpha-value>)` needs. */
const triplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** CSS variables for one palette, set on the root view so every class resolves against the current scheme. */
const ledgerVars = (palette) =>
  Object.fromEntries(Object.entries(palette).map(([role, hex]) => [`--ledger-${role}`, triplet(hex)]));

module.exports = { light, dark, ledgerVars };
