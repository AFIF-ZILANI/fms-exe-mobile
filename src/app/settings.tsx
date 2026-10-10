import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { SettingRow } from '@/components/setting-row';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { BASE_URL } from '@/lib/api';
import { useAppearance, type AppearancePref } from '@/lib/appearance';
import { formatRelative, latestTimestamp } from '@/lib/format';
import { roleLabel } from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import { useLogout } from '@/lib/use-logout';
import { triggerFlush, useOutboxSummary } from '@/lib/use-outbox';

const APPEARANCE_OPTIONS: { value: AppearancePref; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Match phone', icon: 'smartphone' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

/** The server's address without the scheme and path, e.g. "192.168.0.5:5085": enough to tell which one this phone is talking to. */
const serverHost = BASE_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/** docs/navigation-redesign-design.md — app settings, plus a way back to the person at the top. */
export default function SettingsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const queryClient = useQueryClient();
  const { signedIn, employee } = useSession();
  const { data: outbox } = useOutboxSummary();
  const [appearance, setAppearance] = useAppearance();
  const [syncing, setSyncing] = useState(false);
  // When any screen's data was last refreshed from the server. Read once and again after Sync now; the
  // "last upload" below is only when a record last left this phone, which can be long ago and is not freshness.
  const latestData = () => latestTimestamp(queryClient.getQueryCache().getAll().map((q) => q.state.dataUpdatedAt));
  const [updatedAt, setUpdatedAt] = useState(latestData);
  const onLogout = useLogout();

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const pending = outbox?.pendingCount ?? 0;
  const failed = outbox?.deadLetterCount ?? 0;
  const status = failed > 0 ? `${failed} couldn't send` : pending > 0 ? `${pending} waiting to send` : 'All sent';
  const statusIcon: IconName = failed > 0 ? 'alert-circle' : pending > 0 ? 'clock' : 'check-circle';
  const lastUpload = outbox?.lastSyncedAt ? formatRelative(new Date(outbox.lastSyncedAt)) : 'None yet';

  const syncNow = async () => {
    setSyncing(true);
    try {
      await triggerFlush(queryClient);
      setUpdatedAt(latestData());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <Header title="Settings" leading="back" />

      {employee ? (
        <Pressable
          onPress={() => router.push('/profile' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${employee.profile.name}, ${roleLabel(employee.role)}. Open profile`}
          style={({ pressed }) => [
            styles.identity,
            { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
            elevation(scheme, 'card'),
          ]}
        >
          <Avatar name={employee.profile.name} uri={employee.profile.avatar?.image_url} size={56} />
          <View style={styles.flex}>
            <AppText variant="h2" numberOfLines={1}>
              {employee.profile.name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {roleLabel(employee.role)}
              {employee.profile.email ? ` · ${employee.profile.email}` : ''}
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color="muted" />
        </Pressable>
      ) : null}

      <AppText variant="eyebrow" color="muted" style={styles.section}>
        Appearance
      </AppText>
      <View style={styles.themes}>
        {APPEARANCE_OPTIONS.map((o) => {
          const on = appearance === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setAppearance(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              style={[
                styles.theme,
                { backgroundColor: on ? theme.primarySoft : theme.surface, borderColor: on ? theme.primary : theme.line },
              ]}
            >
              <Icon name={o.icon} size={22} color={on ? 'primary' : 'muted'} />
              <AppText variant="label" color={on ? 'primary' : 'inkSoft'}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="eyebrow" color="muted" style={styles.section}>
        Sync
      </AppText>
      <Card rows>
        <SettingRow icon={statusIcon} label="Status" value={status} />
        <SettingRow icon="download-cloud" label="Data updated" value={updatedAt ? formatRelative(new Date(updatedAt)) : 'Not yet'} />
        <SettingRow icon="upload-cloud" label="Last upload" value={lastUpload} />
        <SettingRow
          icon="list"
          label="Sync center"
          badge={failed > 0 ? failed : undefined}
          onPress={() => router.push('/sync' as Href)}
          last
        />
        <View style={styles.syncAction}>
          <Button variant="secondary" label="Sync now" icon="refresh-cw" onPress={() => void syncNow()} loading={syncing} block />
        </View>
      </Card>

      <AppText variant="eyebrow" color="muted" style={styles.section}>
        Account
      </AppText>
      <Card rows>
        <SettingRow icon="lock" label="Change password" onPress={() => router.push('/change-password' as Href)} />
        <SettingRow icon="log-out" label="Log out" tone="critical" onPress={onLogout} last />
      </Card>

      <AppText variant="eyebrow" color="muted" style={styles.section}>
        About
      </AppText>
      <Card rows>
        <SettingRow icon="info" label="App version" value={Constants.expoConfig?.version ?? '—'} />
        <SettingRow icon="server" label="Connected to" value={serverHost} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.xs,
  },
  section: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  themes: { flexDirection: 'row', gap: Spacing.sm },
  theme: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    borderRadius: Radius.card,
  },
  syncAction: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
