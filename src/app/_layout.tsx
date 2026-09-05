import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { Colors, FontAssets } from '@/constants/theme';
import { SessionProvider } from '@/lib/session';
import { initOutbox } from '@/lib/outbox';
import { useOutboxTriggers } from '@/lib/use-outbox';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, gcTime: 1000 * 60 * 60 * 24 } },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'fms:query-cache' });

const navLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.ground,
    card: Colors.light.surface,
    text: Colors.light.ink,
    border: Colors.light.line,
    primary: Colors.light.primary,
  },
};

const navDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.ground,
    card: Colors.dark.surface,
    text: Colors.dark.ink,
    border: Colors.dark.line,
    primary: Colors.dark.primary,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FontAssets);

  // Started early so the sync banner has a queue to read, but deliberately
  // NOT awaited: every outbox function awaits initOutbox() itself, and
  // gating the first render on storage means a slow or wedged database
  // (expo-sqlite's web build can hang waiting on a worker) shows a blank
  // app forever instead of a usable one.
  useEffect(() => {
    void initOutbox();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? navDark : navLight}>
          <RootStack />
        </ThemeProvider>
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}

function RootStack() {
  useOutboxTriggers();

  // Every screen draws its own 56dp <Header> (docs/layout/00-app-shell.md), so
  // the navigator's header is off everywhere — left on, it stacks a second bar
  // above each screen titled with the raw route name.
  return <Stack screenOptions={{ headerShown: false }} />;
}
