import { Stack } from 'expo-router';

/** The Houses tab's own stack, so `/houses/[id]` pushes inside the tab rather
 *  than becoming a second tab. Headers are rendered by each screen's
 *  <Screen> — docs/layout/00-app-shell.md specifies a 56dp custom header. */
export default function HousesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
