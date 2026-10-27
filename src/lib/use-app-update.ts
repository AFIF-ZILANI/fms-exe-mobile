import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';

import { pickUpdate, type Release } from '@/lib/app-version';

// The APK is shipped as an asset on the repo's GitHub releases (see README), so the newest release
// is the newest app. Unauthenticated, which allows 60 checks an hour per IP -- fine at one every
// six hours per phone.
const LATEST_RELEASE = 'https://api.github.com/repos/AFIF-ZILANI/fms-exe-mobile/releases/latest';

/** A newer APK to offer, or null. Android release builds only: dev builds reload from Metro. */
export function useAppUpdate() {
  const current = Constants.expoConfig?.version;
  const { data } = useQuery({
    queryKey: ['app-update'],
    enabled: Platform.OS === 'android' && !__DEV__ && !!current,
    staleTime: 1000 * 60 * 60 * 6,
    queryFn: async () => {
      const res = await fetch(LATEST_RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(`Update check failed: ${res.status}`);
      return (await res.json()) as Release;
    },
  });
  return data && current ? pickUpdate(data, current) : null;
}
