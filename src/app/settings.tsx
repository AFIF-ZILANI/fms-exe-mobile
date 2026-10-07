import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { InfoRow, NavRow } from '@/components/profile-parts';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance, type AppearancePref } from '@/lib/appearance';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useLogout } from '@/lib/use-logout';
import { triggerFlush, useOutboxSummary } from '@/lib/use-outbox';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: AppearancePref; label: string }[];

/** docs/navigation-redesign-design.md — app settings only; nothing here is about the person. */
export default function SettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { signedIn } = useSession();
  const { data: outbox } = useOutboxSummary();
  const [appearance, setAppearance] = useAppearance();
  const [syncing, setSyncing] = useState(false);
  const onLogout = useLogout();

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const pending = outbox?.pendingCount ?? 0;
  const failed = outbox?.deadLetterCount ?? 0;
  const status = failed > 0 ? `${failed} couldn't send` : pending > 0 ? `${pending} waiting to send` : 'All sent';
  const lastSynced = outbox?.lastSyncedAt ? formatRelative(new Date(outbox.lastSyncedAt)) : 'Not yet';

  const syncNow = async () => {
    setSyncing(true);
    try {
      await triggerFlush(queryClient);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <Header title="Settings" leading="back" />

      <Card rows eyebrow="Appearance" style={styles.card}>
        <View style={styles.appearance}>
          <SegmentedToggle
            height={48}
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={setAppearance}
          />
          <AppText variant="caption" color="muted">
            Match phone follows your phone&apos;s light or dark setting.
          </AppText>
        </View>
      </Card>

      <Card rows eyebrow="Sync" style={styles.card}>
        <InfoRow label="Status" value={status} />
        <InfoRow label="Last synced" value={lastSynced} />
        <NavRow
          label={failed > 0 ? `Sync center · ${failed} need attention` : 'Sync center'}
          onPress={() => router.push('/sync' as Href)}
        />
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <View style={styles.syncAction}>
          <Button variant="secondary" label="Sync now" icon="refresh-cw" onPress={() => void syncNow()} loading={syncing} block />
        </View>
      </Card>

      <Card rows eyebrow="Account" style={styles.card}>
        <NavRow label="Change password" onPress={() => router.push('/change-password' as Href)} last />
      </Card>

      <Card rows eyebrow="About" style={styles.card}>
        <InfoRow label="App version" value={Constants.expoConfig?.version} last />
      </Card>

      <View style={styles.logout}>
        <Button variant="destructive" label="Log out" onPress={onLogout} block />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  appearance: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  rule: { height: 1, marginLeft: Spacing.lg },
  syncAction: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  logout: { marginTop: Spacing.xl },
});
