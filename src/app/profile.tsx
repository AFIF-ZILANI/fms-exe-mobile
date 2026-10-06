import { Alert, View, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';
import { initials } from '@/lib/farm';

/** docs/layout/02-profile.md — who is signed in, plus the account actions. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { employee, logout } = useSession();
  const { data: outbox } = useOutboxSummary();

  const onLogout = () => {
    const pending = (outbox?.pendingCount ?? 0) + (outbox?.deadLetterCount ?? 0);
    // A queued write belongs to whoever is signed in when it uploads, so nothing may be left behind.
    if (pending > 0) {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
      return;
    }
    void logout();
  };

  return (
    <Screen>
      <Header title="Profile" leading="back" />

      {employee ? (
        <Card style={styles.card}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
              <AppText variant="h2" color="primary">
                {initials(employee.profile.name)}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="h2">{employee.profile.name}</AppText>
              <AppText variant="caption" color="muted">
                {employee.role.toLowerCase()} · {employee.profile.mobile}
              </AppText>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              variant="secondary"
              label="My performance"
              onPress={() => router.push('/me/performance')}
              block
            />
            <Button
              variant="secondary"
              label="Change password"
              onPress={() => router.push('/change-password' as Href)}
              block
            />
            <Button variant="destructive" label="Log out" onPress={onLogout} block />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: Spacing.lg, gap: Spacing.md },
});
