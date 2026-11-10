/**
 * The Hisab Khata palette, the one place its hex values live. tailwind.config.js builds the classes from
 * it; code reads it only where a colour must be a prop rather than a class (icon glyphs).
 */
module.exports = {
  primary: '#1F3A5F',
  background: '#EEF1F4',
  surface: '#FFFFFF',
  ink: '#1A2230',
  muted: '#5B6576',
  success: '#2E7D4F',
  error: '#B3261E',
  line: '#D5DBE3',
};
