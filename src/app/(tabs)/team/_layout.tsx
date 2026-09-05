import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

/**
 * The Team tab's stack. The tab itself is hidden for a Worker in
 * `(tabs)/_layout.tsx`; this guard covers the other door — a Worker who
 * reaches `/team` by deep link or a restored route still goes home.
 */
export default function TeamLayout() {
  const { employee, isLoading } = useSession();
  if (isLoading) return null;
  if (!can(employee?.role, 'assign_task')) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
