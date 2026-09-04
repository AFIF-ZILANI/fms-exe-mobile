/**
 * "Field Instrument" design tokens — see docs/design.md.
 *
 * Colour is a data channel here, not decoration: the five foundation tokens
 * are the entire UI (ink/paper/field/line/muted); the five semantic tokens
 * are the ONLY saturated values allowed anywhere on screen, and only when a
 * value means something (a mortality figure, a negative score, a queued
 * write). Names match web/docs/design.md §2.3 so one word means one thing
 * across both clients.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    ink: '#101418',
    paper: '#FFFFFF',
    field: '#F1F3F5',
    line: '#DFE3E8',
    muted: '#626E7A',

    success: '#11784A',
    critical: '#C0342B',
    warning: '#B26A00',
    info: '#1F6FEB',
    neutral: '#626E7A',
  },
  dark: {
    ink: '#E8ECEF',
    paper: '#0D1014',
    field: '#171B20',
    line: '#262C33',
    muted: '#8A959F',

    success: '#3DD68C',
    critical: '#FF6B5E',
    warning: '#E8A33D',
    info: '#5AA3FF',
    neutral: '#8A959F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * IBM Plex Sans + IBM Plex Mono, bundled as static TTFs (assets/fonts/) and
 * registered by name in RootLayout via expo-font's useFonts. Every numeral in
 * the app is Plex Mono — see docs/design.md §3.2, "no exceptions".
 */
export const FontFamily = {
  sans: 'PlexSans-Regular',
  sansMedium: 'PlexSans-Medium',
  sansSemiBold: 'PlexSans-SemiBold',
  mono: 'PlexMono-Regular',
  monoSemiBold: 'PlexMono-SemiBold',
} as const;

/** Registration map for useFonts — keys must match FontFamily's values. */
export const FontAssets = {
  [FontFamily.sans]: require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
  [FontFamily.sansMedium]: require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
  [FontFamily.sansSemiBold]: require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
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

/** docs/design.md §3.1 — the whole type scale. Don't add roles outside this set. */
export const Type: Record<
  'reading' | 'figure' | 'data' | 'title' | 'body' | 'label' | 'eyebrow',
  TypeRole
> = {
  reading: { fontFamily: FontFamily.monoSemiBold, fontSize: 44, lineHeight: 40 },
  figure: { fontFamily: FontFamily.monoSemiBold, fontSize: 24, lineHeight: 28 },
  data: { fontFamily: FontFamily.mono, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: FontFamily.sansSemiBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: FontFamily.sans, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: FontFamily.sansMedium, fontSize: 14, lineHeight: 20 },
  eyebrow: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88, // 0.08em at 11px
    textTransform: 'uppercase',
  },
};

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** docs/design.md §5 — one radius, not a scale. This app has six surfaces, not forty. */
export const Radius = 8;

/** Minimum touch target and gap — gloved, wet, or dirty hands. */
export const MinTouchTarget = 48;
export const MinTouchGap = 12;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
