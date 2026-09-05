/**
 * "Field Green" design tokens — see docs/design.md.
 *
 * Brand green is structural: it carries primary actions, active navigation,
 * selected states and positive outcomes, and should be visible on every
 * screen. The other saturated colours stay semantic — a `critical` thing is
 * always bad news, a `warning` thing is always "not on the server yet". Tints
 * are card fills only, never text and never borders.
 *
 * Replaces the v1 "Field Instrument" monochrome system, whose one-colour bet
 * made every screen equally quiet and therefore none of them scannable.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Foundation
    ground: '#F5F8F6',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F4F2',
    ink: '#0F1613',
    inkSoft: '#46534C',
    muted: '#6B7A72',
    line: '#E2E8E4',

    // Brand
    primary: '#1B8A5A',
    primaryPressed: '#146E47',
    primarySoft: '#E7F5EE',
    onPrimary: '#FFFFFF',

    // Semantic. `success` is deliberately the same value as `primary`.
    success: '#1B8A5A',
    critical: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
    neutral: '#6B7A72',

    // Tint surfaces — card fills only
    tintGreen: '#E7F5EE',
    tintAmber: '#FEF5E7',
    tintRed: '#FDECEC',
    tintBlue: '#E9F0FE',

    /** @deprecated v1 name. Use `surface` (fills) or `onPrimary` (text on a fill). */
    paper: '#FFFFFF',
    /** @deprecated v1 name. Use `surfaceAlt`. */
    field: '#F1F4F2',
  },
  dark: {
    // Foundation — a faint green cast, so both themes read as one product
    ground: '#0E1613',
    surface: '#16201C',
    surfaceAlt: '#1D2925',
    ink: '#E9EFEB',
    inkSoft: '#AEBAB3',
    muted: '#7E8D85',
    line: '#27332E',

    // Brand
    primary: '#34D399',
    primaryPressed: '#2BB983',
    primarySoft: '#12332A',
    onPrimary: '#04150E',

    // Semantic
    success: '#34D399',
    critical: '#FF7B6B',
    warning: '#FBBF24',
    info: '#60A5FA',
    neutral: '#7E8D85',

    // Tint surfaces
    tintGreen: '#12332A',
    tintAmber: '#2A2110',
    tintRed: '#2B1616',
    tintBlue: '#101E33',

    /** @deprecated v1 name. Use `surface` (fills) or `onPrimary` (text on a fill). */
    paper: '#16201C',
    /** @deprecated v1 name. Use `surfaceAlt`. */
    field: '#1D2925',
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
  if (scheme === 'dark') {
    return level === 'card'
      ? { borderWidth: 1, borderColor: Colors.dark.line }
      : {
          shadowColor: '#000',
          shadowOpacity: level === 'sheet' ? 0.5 : 0.4,
          shadowRadius: level === 'sheet' ? 24 : 12,
          shadowOffset: { width: 0, height: level === 'sheet' ? -4 : 4 },
          elevation: 8,
        };
  }

  switch (level) {
    case 'card':
      return {
        shadowColor: '#0F1613',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      };
    case 'raised':
      return {
        shadowColor: '#1B8A5A',
        shadowOpacity: 0.24,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      };
    case 'sheet':
      return {
        shadowColor: '#0F1613',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
      };
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
  tabCentre: 58,
  fab: 56,
  gutter: 44,
} as const;

/** Minimum touch target and gap — gloved, wet, or dirty hands. */
export const MinTouchTarget = 48;
export const MinTouchGap = 12;

export const MaxContentWidth = 800;
