import { useState } from 'react';
import { Tabs } from 'expo-router';

import { LogSheet } from '@/components/log-sheet';
import { TabBar } from '@/components/ui/tab-bar';

/**
 * The bottom tab bar — docs/navigation-redesign-design.md. Four tabs plus the raised centre
 * button, identical for every role. Team is a route inside the tabs but never a tab: it is
 * reached from Home's Team card and the launcher's Manage group (and guards itself).
 */
export default function TabsLayout() {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} onLogPress={() => setLogOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="houses" />
        <Tabs.Screen name="stock" />
        <Tabs.Screen name="me" />
        <Tabs.Screen name="team" options={{ href: null }} />
      </Tabs>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
