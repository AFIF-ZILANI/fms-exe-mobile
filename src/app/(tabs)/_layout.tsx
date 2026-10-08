import { useState } from 'react';
import { Tabs } from 'expo-router';

import { LogSheet } from '@/components/log-sheet';
import { TabBar } from '@/components/ui/tab-bar';

/**
 * The bottom tab bar: Home · Tasks · [+] · Performance · Profile, identical for every role.
 * Houses, Stock and Team are routes inside the tabs but never tabs: Houses from Home's card,
 * Stock from the launcher, Team from Home's Team card and the launcher's Manage group.
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
        <Tabs.Screen name="tasks" />
        <Tabs.Screen name="performance" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="houses" options={{ href: null }} />
        <Tabs.Screen name="stock" options={{ href: null }} />
        <Tabs.Screen name="team" options={{ href: null }} />
      </Tabs>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
