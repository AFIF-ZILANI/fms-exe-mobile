/** What the person chose for light/dark. Pure, so it can be tested without React Native. */
export type AppearancePref = 'system' | 'light' | 'dark';

/** Anything but an exact saved value means "Match phone": a corrupt or missing entry
 *  must never lock someone into a theme or throw at startup. */
export function parseAppearance(raw: unknown): AppearancePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** Native scheme for React Native 0.86.3: 'unspecified' follows the system, not null. */
export function nativeScheme(pref: AppearancePref): 'light' | 'dark' | 'unspecified' {
  return pref === 'system' ? 'unspecified' : pref;
}
