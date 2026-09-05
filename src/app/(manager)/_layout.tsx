import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

/** Gates the whole Manager tier in one place rather than per screen --
 *  docs/PRD.md §2. Route groups don't affect the URL (this resolves to
 *  /assign, /score, etc.), so a Worker hitting one of these paths directly
 *  still redirects home. */
export default function ManagerLayout() {
  const { employee, isLoading } = useSession();
  if (isLoading) return null;
  if (!can(employee?.role, 'assign_task')) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
