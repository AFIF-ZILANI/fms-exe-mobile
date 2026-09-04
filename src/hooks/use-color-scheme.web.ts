import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
}

/**
 * Web needs the colour scheme recalculated on the client, since static
 * rendering has no `prefers-color-scheme` to read.
 *
 * useSyncExternalStore rather than the useState+useEffect the Expo template
 * ships: the server snapshot ('light') is what static rendering emits and
 * the client snapshot takes over on hydration, which is hydration-safe by
 * construction and needs no effect (React 19 flags setState-in-effect).
 */
export function useColorScheme() {
  return useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme() ?? 'light',
    () => 'light' as const,
  );
}
