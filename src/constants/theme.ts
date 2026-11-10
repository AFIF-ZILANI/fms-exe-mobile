/**
 * "Hisab Khata" design tokens (2026-11-10): the ruled ledger every Bangladeshi business keeps. Ink blue
 * carries actions and selection, red is only for losses, deaths and errors, a ledger ochre marks "needs a
 * look" (waiting to upload, low stock, an unusual count). Tiro Bangla for titles, Hind Siliguri for every
 * word and every number (it carries ৳ and Bangla). One corner radius; ruled lines instead of shadows.
 *
 * The hex values live in ./ledger.js, shared with tailwind.config.js, so the NativeWind screens and the
 * screens built from these roles can't drift apart. Role names are unchanged from the previous system, so
 * every component reads the new look without edits.
 */

import '@/global.css';

import { Platform } from 'react-native';

import ledger from './ledger';

/** 10% of a colour, for tinted fills (8-digit hex). */
const tint = (hex: string) => `${hex}1A`;

function roles(p: typeof ledger.light) {
  return {
    // Foundation
    ground: p.background,
    surface: p.surface,
    surfaceAlt: p.background,
    ink: p.ink,
    inkSoft: p.muted,
    muted: p.muted,
    line: p.line,

    // Brand
    primary: p.primary,
    primaryPressed: p.primary,
    primarySoft: tint(p.primary),
    onPrimary: p.onPrimary,

    // Semantic
    success: p.success,
    critical: p.error,
    warning: p.warning,
    info: p.primary,
    neutral: p.muted,

    // Tint surfaces — card fills only
    tintGreen: tint(p.success),
    tintAmber: tint(p.warning),
    tintRed: tint(p.error),
    tintBlue: tint(p.primary),

    /** @deprecated v1 name. Use `surface` (fills) or `onPrimary` (text on a fill). */
    paper: p.surface,
    /** @deprecated v1 name. Use `surfaceAlt`. */
    field: p.background,
  };
}

export const Colors = { light: roles(ledger.light), dark: roles(ledger.dark) };

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Hind Siliguri for words and numbers, Tiro Bangla for titles, all static weights from @expo-google-fonts,
 * registered by these names in RootLayout via useFonts. The `mono*` keys are kept so existing callers keep
 * working; they no longer point at a monospace face (figures read better in Hind's bold).
 */
export const FontFamily = {
  sans: 'HindSiliguri_400Regular',
  sansMedium: 'HindSiliguri_500Medium',
  sansSemiBold: 'HindSiliguri_600SemiBold',
  sansBold: 'HindSiliguri_700Bold',
  mono: 'HindSiliguri_600SemiBold',
  monoSemiBold: 'HindSiliguri_700Bold',
  serif: 'TiroBangla_400Regular',
} as const;

/** Registration map for useFonts — keys must match FontFamily's values (and tailwind.config.js's fontFamily). */
export const FontAssets = {
  TiroBangla_400Regular: require('@expo-google-fonts/tiro-bangla/400Regular/TiroBangla_400Regular.ttf'),
  HindSiliguri_400Regular: require('@expo-google-fonts/hind-siliguri/400Regular/HindSiliguri_400Regular.ttf'),
  HindSiliguri_500Medium: require('@expo-google-fonts/hind-siliguri/500Medium/HindSiliguri_500Medium.ttf'),
  HindSiliguri_600SemiBold: require('@expo-google-fonts/hind-siliguri/600SemiBold/HindSiliguri_600SemiBold.ttf'),
  HindSiliguri_700Bold: require('@expo-google-fonts/hind-siliguri/700Bold/HindSiliguri_700Bold.ttf'),
};

type TypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/**
 * The whole type scale. Figures (`hero`/`stat`/`figure`/`data`) are Hind Siliguri bold and are the largest
 * thing in their context; titles (`h1`/`h2`) are Tiro Bangla; every other word is Hind Siliguri. Sentence
 * case throughout: `eyebrow` no longer uppercases. Don't add roles outside this set.
 */
export const Type = {
  // Figures
  hero: { fontFamily: FontFamily.sansBold, fontSize: 40, lineHeight: 48 },
  stat: { fontFamily: FontFamily.sansBold, fontSize: 32, lineHeight: 40 },
  figure: { fontFamily: FontFamily.sansBold, fontSize: 22, lineHeight: 28 },
  data: { fontFamily: FontFamily.sansSemiBold, fontSize: 14, lineHeight: 20 },

  // Titles
  h1: { fontFamily: FontFamily.serif, fontSize: 28, lineHeight: 36 },
  h2: { fontFamily: FontFamily.serif, fontSize: 22, lineHeight: 28 },

  // Words
  bodyStrong: { fontFamily: FontFamily.sansSemiBold, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: FontFamily.sans, fontSize: 17, lineHeight: 26 },
  label: { fontFamily: FontFamily.sansMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: FontFamily.sans, fontSize: 14, lineHeight: 20 },
  eyebrow: { fontFamily: FontFamily.sansSemiBold, fontSize: 14, lineHeight: 20 },

  /** @deprecated v1 name. Use `hero`. */
  reading: { fontFamily: FontFamily.sansBold, fontSize: 40, lineHeight: 48 },
  /** @deprecated v1 name. Use `h2`. */
  title: { fontFamily: FontFamily.serif, fontSize: 22, lineHeight: 28 },
} satisfies Record<string, TypeRole>;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** The approved scale is 4, 8, 16, 24, 40. The names are kept so callers don't change; steps that fell
 *  between (12, 20, 32, 56) snap to the scale, so some names now share a value. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 16,
  xl: 16,
  xxl: 24,
  xxxl: 40,
  huge: 40,

  /** @deprecated v1 ordinal names. */
  half: 2,
  /** @deprecated */
  one: 4,
  /** @deprecated */
  two: 8,
  /** @deprecated */
  three: 16,
  /** @deprecated */
  four: 24,
  /** @deprecated */
  five: 40,
  /** @deprecated */
  six: 40,
} as const;

/** One corner radius, 10, for every box. `pill` is only for capsules and circles (chips, avatars, dots). */
export const Radius = {
  control: 10,
  card: 10,
  sheet: 10,
  pill: 999,
} as const;

/**
 * Cards are ruled, not lifted: a 1px line in both themes, like a ledger's ruling. Only things that float over
 * the page (raised buttons, sheets) keep a soft neutral shadow. Consume via `elevation(scheme, 'card')`.
 */
export function elevation(scheme: 'light' | 'dark', level: 'card' | 'raised' | 'sheet') {
  if (level === 'card') return { borderWidth: 1, borderColor: Colors[scheme].line };
  if (scheme === 'dark') {
    return {
      boxShadow: level === 'sheet' ? '0px -4px 24px rgba(0,0,0,0.5)' : '0px 4px 12px rgba(0,0,0,0.4)',
    };
  }
  return {
    boxShadow: level === 'sheet' ? '0px -4px 24px rgba(26,34,48,0.12)' : '0px 4px 12px rgba(26,34,48,0.16)',
  };
}

/** docs/design.md §4.4 — fixed control sizes, so every screen agrees. */
export const Size = {
  buttonPrimary: 56,
  buttonSecondary: 48,
  buttonGhost: 44,
  input: 56,
  inputNumber: 64,
  chip: 36,
  statusPill: 24,
  iconButton: 44,
  row: 64,
  rowSingle: 56,
  header: 56,
  tabBar: 64,
  tabCentre: 46,
  fab: 56,
  gutter: 44,
} as const;

/** Minimum touch target and gap — gloved, wet, or dirty hands. */
export const MinTouchTarget = 48;
export const MinTouchGap = 12;

export const MaxContentWidth = 800;
