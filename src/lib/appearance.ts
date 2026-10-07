import { useCallback, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseAppearance, schemeFor, type AppearancePref } from '@/lib/appearance-pref';

export type { AppearancePref };

const KEY = 'fms:appearance';

/** The saved choice, or "Match phone" when there is none or storage is unavailable. */
export async function loadAppearance(): Promise<AppearancePref> {
  try {
    return parseAppearance(await AsyncStorage.getItem(KEY));
  } catch {
    return 'system';
  }
}

/** Every screen reads the scheme through one hook, so overriding it here re-themes the app. */
export function applyAppearance(pref: AppearancePref): void {
  // ponytail: type assertion for React Native 0.86 type definitions that don't properly type null
  Appearance.setColorScheme(schemeFor(pref) as any);
}

async function saveAppearance(pref: AppearancePref): Promise<void> {
  applyAppearance(pref);
  try {
    await AsyncStorage.setItem(KEY, pref);
  } catch {
    // The choice still applies for this session; it just won't survive a restart.
  }
}

/** The current choice and a setter that applies and saves it. */
export function useAppearance() {
  const [pref, setPref] = useState<AppearancePref>('system');

  useEffect(() => {
    let alive = true;
    void loadAppearance().then((p) => {
      if (alive) setPref(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const choose = useCallback((next: AppearancePref) => {
    setPref(next);
    void saveAppearance(next);
  }, []);

  return [pref, choose] as const;
}
