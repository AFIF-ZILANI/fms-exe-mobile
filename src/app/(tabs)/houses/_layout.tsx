import { Stack } from 'expo-router';

// Without this, a deep push into an unvisited tab (e.g. from Home) would make
// that screen the stack's only entry, with no way back to the tab root.
export const unstable_settings = { initialRouteName: 'index' };

/** The Houses tab's own stack, so `/houses/[id]` pushes inside the tab rather
 *  than becoming a second tab. Headers are rendered by each screen's
 *  <Screen> — docs/layout/00-app-shell.md specifies a 56dp custom header. */
export default function HousesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
