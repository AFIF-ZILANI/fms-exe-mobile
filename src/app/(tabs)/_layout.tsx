import { useState } from 'react';
import { Tabs } from 'expo-router';

import { LogSheet } from '@/components/log-sheet';
import { TabBar } from '@/components/ui/tab-bar';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

/**
 * The bottom tab bar — docs/layout/00-app-shell.md. Four slots plus a raised
 * centre button that opens the log sheet rather than navigating.
 *
 * Team is removed for a Worker (`href: null`), never rendered disabled: a
 * Worker seeing a greyed "Team" learns the app is withholding something.
 * <TabBar> holds the column open so the centre button doesn't shift.
 */
export default function TabsLayout() {
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} onLogPress={() => setLogOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="houses" />
        <Tabs.Screen name="team" options={{ href: isManager ? undefined : null }} />
        <Tabs.Screen name="me" />
      </Tabs>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
