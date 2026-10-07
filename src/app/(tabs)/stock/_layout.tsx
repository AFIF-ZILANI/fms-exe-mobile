import { Stack } from 'expo-router';

// Without this, a deep push into an unvisited tab (e.g. from Home) would make
// that screen the stack's only entry, with no way back to the tab root.
export const unstable_settings = { initialRouteName: 'index' };

/** The Stock tab's own stack, so item detail (Phase 4) pushes inside the tab. */
export default function StockLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
