import { Stack } from 'expo-router';

/** The Stock tab's own stack, so item detail (Phase 4) pushes inside the tab. */
export default function StockLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
