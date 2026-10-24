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
        {/* No `href: null` here: since expo-router 58 that marks a tab hidden, and a focused hidden
            tab is redirected straight back to Home -- so these screens could never open. TabBar only
            draws its own four SLOTS, so declaring them plainly still keeps them out of the bar. */}
        <Tabs.Screen name="houses" />
        <Tabs.Screen name="stock" />
        <Tabs.Screen name="team" />
      </Tabs>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
