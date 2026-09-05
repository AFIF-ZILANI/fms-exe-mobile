import { Stack } from 'expo-router';

/** Keeps the tab route `me` while the screen stays at `/me/performance`, so
 *  existing links don't change. */
export default function MeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
