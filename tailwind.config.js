/**
 * The Hisab Khata design system (picked 2026-11-10): the ruled ledger every Bangladeshi business keeps.
 * Ink blue for actions, red only for losses and deaths, Tiro Bangla headings, Hind Siliguri for everything
 * else (it carries ৳ and Bangla).
 *
 * The palette, spacing and radius *replace* Tailwind's defaults rather than extend them, so a class can
 * only ever produce an approved value. Font names are the keys `FontAssets` loads them under
 * (constants/theme.ts).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    colors: {
      transparent: 'transparent',
      ...require('./src/constants/ledger'),
    },
    spacing: {
      0: '0px',
      px: '1px',
      1: '4px',
      2: '8px',
      4: '16px',
      6: '24px',
      10: '40px',
    },
    borderRadius: {
      none: '0px',
      DEFAULT: '10px',
      // Circles only (avatars, badges), never a second corner radius.
      full: '9999px',
    },
    fontFamily: {
      heading: ['TiroBangla_400Regular'],
      body: ['HindSiliguri_400Regular'],
      'body-medium': ['HindSiliguri_500Medium'],
      'body-semibold': ['HindSiliguri_600SemiBold'],
      'body-bold': ['HindSiliguri_700Bold'],
    },
    fontSize: {
      caption: ['13px', '18px'],
      label: ['15px', '22px'],
      body: ['17px', '26px'],
      title: ['24px', '30px'],
      figure: ['26px', '32px'],
      display: ['32px', '38px'],
      stat: ['40px', '46px'],
    },
    extend: {
      // Sizes, not spacing: tap targets and fixed glyph boxes.
      height: { bar: '6px', avatar: '40px', icon: '48px', tap: '56px' },
      width: { avatar: '40px', icon: '48px' },
      minHeight: { tap: '56px', row: '64px' },
    },
  },
  plugins: [],
};
