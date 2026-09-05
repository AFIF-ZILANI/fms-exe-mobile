import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { BASE_URL, useGetData, type Paginated } from '@/lib/api';
import { initials } from '@/lib/farm';
import type { Employee } from '@/lib/types';

/** docs/layout/02-profile.md — the auth stand-in, and the only place role
 *  changes. Switching clears the query cache (so the previous person's tasks
 *  don't flash on the new person's dashboard) but never the outbox: queued
 *  writes carry their own actor id, stamped at enqueue time. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { employee, switchTo } = useSession();
  const { data, isLoading, error, refetch } = useGetData<Paginated<Employee>>(
    '/employees?limit=100',
    ['employees', 'all'],
  );

  // Managers first, then Workers, each alphabetical.
  const employees = [...(data?.results ?? [])].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'MANAGER' ? -1 : 1;
    return a.profile.name.localeCompare(b.profile.name);
  });

  return (
    <Screen>
      <Header title="Who are you?" leading={employee ? 'back' : undefined} />

      {/* Not dismissible: the moment it can be, someone dismisses it and then
          can't explain why the app has no password. */}
      <View style={[styles.notice, { backgroundColor: theme.tintBlue }]}>
        <Icon name="info" size={20} color="info" />
        <AppText variant="body" style={styles.flex}>
          No login yet — pick who you are. This is temporary.
        </AppText>
      </View>

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

          <View style={styles.action}>
            <Button
              variant="secondary"
              label="My performance"
              onPress={() => router.push('/me/performance')}
              block
            />
          </View>
        </Card>
      ) : (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="user"
            tint="surfaceAlt"
            title="Nobody selected yet."
            body="Pick a name below to start."
          />
        </Card>
      )}

      <Card rows eyebrow="Switch to" style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} />
            ))}
          </View>
        ) : error || employees.length === 0 ? (
          // An empty employee list here is almost always connectivity, not an
          // empty database — so the diagnostic lives on this screen.
          <View style={styles.errorBlock}>
            <EmptyState
              compact
              icon="wifi-off"
              tint="tintRed"
              title={error ? "Can't reach the server." : 'No employees yet.'}
            />
            <View style={[styles.urlWell, { backgroundColor: theme.surfaceAlt }]}>
              <AppText variant="data" color="muted" selectable>
                {BASE_URL}
              </AppText>
            </View>
            <View style={styles.retry}>
              <Button variant="secondary" label="Try again" onPress={() => void refetch()} block={false} />
            </View>
          </View>
        ) : (
          employees.map((candidate, i) => {
            const current = candidate.id === employee?.id;
            return (
              <LedgerRow
                key={candidate.id}
                gutterNode={
                  <View style={[styles.initials, { backgroundColor: theme.primarySoft }]}>
                    <AppText variant="data" color="primary">
                      {initials(candidate.profile.name)}
                    </AppText>
                  </View>
                }
                last={i === employees.length - 1}
                onPress={async () => {
                  await switchTo(candidate);
                  router.replace('/');
                }}
              >
                <View style={styles.candidate}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{candidate.profile.name}</AppText>
                    <AppText variant="caption" color="muted">
                      {candidate.role.toLowerCase()}
                    </AppText>
                  </View>
                  {/* The current person stays in the list — seeing yourself is
                      what makes it legible as "everyone". */}
                  {current ? <Icon name="check" size={20} color="primary" /> : null}
                </View>
              </LedgerRow>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.xs,
  },
  card: { marginTop: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { marginTop: Spacing.lg },
  skeletons: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  errorBlock: { paddingHorizontal: Spacing.lg },
  urlWell: {
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
    alignItems: 'center',
  },
  retry: { alignItems: 'center', marginTop: Spacing.md },
  initials: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
