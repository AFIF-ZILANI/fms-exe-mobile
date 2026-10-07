import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

// Without this, a deep push into an unvisited tab (e.g. from Home) would make
// that screen the stack's only entry, with no way back to the tab root.
export const unstable_settings = { initialRouteName: 'index' };

/**
 * The Team stack, a hidden route (no tab) reached from Home and the
 * launcher. This guard keeps a Worker who reaches `/team` by deep link or a
 * restored route going home.
 */
export default function TeamLayout() {
  const { employee, isLoading } = useSession();
  if (isLoading) return null;
  if (!can(employee?.role, 'assign_task')) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
