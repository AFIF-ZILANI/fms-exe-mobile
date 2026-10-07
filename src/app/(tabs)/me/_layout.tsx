import { Stack } from 'expo-router';

// Without this, a deep push into an unvisited tab (e.g. from Home) would make
// that screen the stack's only entry, with no way back to the tab root.
export const unstable_settings = { initialRouteName: 'index' };

/** Keeps the tab route `me` while the screen stays at `/me/performance`, so
 *  existing links don't change. */
export default function MeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
