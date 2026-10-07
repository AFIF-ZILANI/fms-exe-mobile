/** What the person chose for light/dark. Pure, so it can be tested without React Native. */
export type AppearancePref = 'system' | 'light' | 'dark';

/** Anything but an exact saved value means "Match phone": a corrupt or missing entry
 *  must never lock someone into a theme or throw at startup. */
export function parseAppearance(raw: unknown): AppearancePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** The argument React Native's `Appearance.setColorScheme` wants: `null` follows the phone. */
export function schemeFor(pref: AppearancePref): 'light' | 'dark' | null {
  return pref === 'system' ? null : pref;
}
