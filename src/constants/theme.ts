/**
 * "Field Green" design tokens — see docs/design.md.
 *
 * Brand indigo is structural: it carries primary actions, active navigation
 * and selected states, and should be visible on every screen. Green is now
 * only `success` (positive outcomes, synced). The other saturated colours stay
 * semantic — a `critical` thing is always bad news, a `warning` thing is always
 * "not on the server yet", `info` is a lighter cyan-leaning blue kept clear of
 * the indigo. Tints are card fills only, never text and never borders.
 *
 * Replaces the v1 "Field Instrument" monochrome system, whose one-colour bet
 * made every screen equally quiet and therefore none of them scannable.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Foundation
    ground: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F2F5',
    ink: '#0F1419',
    inkSoft: '#434B57',
    muted: '#636C7A',
    line: '#E3E6EB',

    // Brand
    primary: '#4F46E5',
    primaryPressed: '#3B33C4',
    primarySoft: '#ECEBFD',
    onPrimary: '#FFFFFF',

    // Semantic. `success` is its own green, no longer tied to the brand colour.
    success: '#1B8A5A',
    critical: '#DC2626',
    warning: '#D97706',
    info: '#0369A1',
    neutral: '#636C7A',

    // Tint surfaces — card fills only
    tintGreen: '#E7F5EE',
    tintAmber: '#FEF5E7',
    tintRed: '#FDECEC',
    tintBlue: '#E6F4FB',

    /** @deprecated v1 name. Use `surface` (fills) or `onPrimary` (text on a fill). */
    paper: '#FFFFFF',
    /** @deprecated v1 name. Use `surfaceAlt`. */
    field: '#F0F2F5',
  },
  dark: {
    // Foundation — a faint green cast, so both themes read as one product
    ground: '#0F1117',
    surface: '#171A22',
    surfaceAlt: '#1F232D',
    ink: '#E9ECF1',
    inkSoft: '#B0B7C3',
    muted: '#808998',
    line: '#272C37',

    // Brand
    primary: '#818CF8',
    primaryPressed: '#6366F1',
    primarySoft: '#1B1A3D',
    onPrimary: '#0B0A26',

    // Semantic
    success: '#34D399',
    critical: '#FF7B6B',
    warning: '#FBBF24',
    info: '#38BDF8',
    neutral: '#808998',

    // Tint surfaces
    tintGreen: '#12332A',
    tintAmber: '#2A2110',
    tintRed: '#2B1616',
    tintBlue: '#0F2230',

    /** @deprecated v1 name. Use `surface` (fills) or `onPrimary` (text on a fill). */
    paper: '#171A22',
    /** @deprecated v1 name. Use `surfaceAlt`. */
    field: '#1F232D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Plus Jakarta Sans (words) + IBM Plex Mono (every numeral), bundled as static
 * TTFs in assets/fonts/ and registered by name in RootLayout via expo-font's
 * useFonts.
 *
 * Static instances, not the variable build: the weight axis of a variable font
 * renders inconsistently across React Native platforms. Google Fonts publishes
 * only the variable Jakarta, so these come from the upstream project
 * (tokotype/PlusJakartaSans), same OFL licence.
 */
export const FontFamily = {
  sans: 'Jakarta-Regular',
  sansMedium: 'Jakarta-Medium',
  sansSemiBold: 'Jakarta-SemiBold',
  sansBold: 'Jakarta-Bold',
  mono: 'PlexMono-Regular',
  monoSemiBold: 'PlexMono-SemiBold',
} as const;

/** Registration map for useFonts — keys must match FontFamily's values. */
export const FontAssets = {
  [FontFamily.sans]: require('../../assets/fonts/PlusJakartaSans-Regular.ttf'),
  [FontFamily.sansMedium]: require('../../assets/fonts/PlusJakartaSans-Medium.ttf'),
  [FontFamily.sansSemiBold]: require('../../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  [FontFamily.sansBold]: require('../../assets/fonts/PlusJakartaSans-Bold.ttf'),
  [FontFamily.mono]: require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
  [FontFamily.monoSemiBold]: require('../../assets/fonts/IBMPlexMono-SemiBold.ttf'),
};

type TypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/**
 * docs/design.md §3.1 — the whole type scale. Every numeral is Plex Mono
 * (`hero`/`stat`/`figure`/`data`); every word is Jakarta. Don't add roles
 * outside this set.
 */
export const Type = {
  // Mono — figures
  hero: { fontFamily: FontFamily.monoSemiBold, fontSize: 40, lineHeight: 44 },
  stat: { fontFamily: FontFamily.monoSemiBold, fontSize: 28, lineHeight: 32 },
  figure: { fontFamily: FontFamily.monoSemiBold, fontSize: 20, lineHeight: 26 },
  data: { fontFamily: FontFamily.mono, fontSize: 13, lineHeight: 18 },

  // Sans — words
  h1: { fontFamily: FontFamily.sansBold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: FontFamily.sansSemiBold, fontSize: 20, lineHeight: 26 },
  bodyStrong: { fontFamily: FontFamily.sansSemiBold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: FontFamily.sans, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: FontFamily.sansMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FontFamily.sans, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88, // 0.08em at 11px
    textTransform: 'uppercase',
  },

  /** @deprecated v1 name. Use `hero`. */
  reading: { fontFamily: FontFamily.monoSemiBold, fontSize: 40, lineHeight: 44 },
  /** @deprecated v1 name. Use `h2`. */
  title: { fontFamily: FontFamily.sansSemiBold, fontSize: 20, lineHeight: 26 },
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

/** docs/design.md §4.1. 4dp grid, named by size so an insertion doesn't
 *  renumber the scale. The v1 ordinal names are kept as aliases. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 56,

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
  five: 32,
  /** @deprecated */
  six: 64,
} as const;

/** docs/design.md §4.2 — four values. Cards and inputs must not share a
 *  radius; v1's single 8dp value is part of why screens read as flat. */
export const Radius = {
  control: 12,
  card: 16,
  sheet: 24,
  pill: 999,
} as const;

/**
 * docs/design.md §2.6. Light uses soft shadows; dark uses a border instead,
 * because a shadow on a dark ground is invisible and only costs render time.
 * Consume via `elevation(scheme, 'card')`, never by hand.
 */
export function elevation(scheme: 'light' | 'dark', level: 'card' | 'raised' | 'sheet') {
  // `boxShadow` (RN 0.76+, new architecture) replaces the deprecated shadow* props and
  // `elevation`, and takes the two-layer card shadow design.md §2.6 actually specifies.
  if (scheme === 'dark') {
    return level === 'card'
      ? { borderWidth: 1, borderColor: Colors.dark.line }
      : {
          boxShadow:
            level === 'sheet' ? '0px -4px 24px rgba(0,0,0,0.5)' : '0px 4px 12px rgba(0,0,0,0.4)',
        };
  }

  switch (level) {
    case 'card':
      return {
        boxShadow: '0px 2px 8px rgba(15,22,19,0.05), 0px 1px 2px rgba(15,22,19,0.03)',
      };
    case 'raised':
      return { boxShadow: '0px 4px 12px rgba(79,70,229,0.24)' };
    case 'sheet':
      return { boxShadow: '0px -4px 24px rgba(15,22,19,0.12)' };
  }
}

/** docs/design.md §4.4 — fixed control sizes, so every screen agrees. */
export const Size = {
  buttonPrimary: 52,
  buttonSecondary: 48,
  buttonGhost: 44,
  input: 52,
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
