import { View, StyleSheet } from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { LedgerRow } from '@/components/ui/ledger-row';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useGetData, type Paginated } from '@/lib/api';
import type { Employee } from '@/lib/types';

/** docs/PRD.md §6.2 -- the auth stand-in, and the only place role changes.
 *  Switching clears the query cache (so the previous person's tasks don't
 *  flash) but never the outbox. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { employee, switchTo } = useSession();
  const { data, isLoading, error } = useGetData<Paginated<Employee>>('/employees?limit=100', [
    'employees',
    'all',
  ]);

  const employees = data?.results ?? [];

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Who are you?' }} />

      <View style={[styles.notice, { backgroundColor: theme.field, borderColor: theme.line }]}>
        <AppText variant="label" color="warning">
          No login yet
        </AppText>
        <AppText variant="data" color="muted">
          Pick who you are. This is temporary — Google sign-in replaces it.
        </AppText>
      </View>

      {employee && (
        <>
          <Section label="Signed in as" />
          <View style={styles.current}>
            <AppText variant="title">{employee.profile.name}</AppText>
            <AppText variant="data" color="muted">
              {employee.role.toLowerCase()} · {employee.profile.mobile}
            </AppText>
          </View>
          <LedgerRow gutter="→" onPress={() => router.push('/me/performance')}>
            <AppText variant="body">My performance</AppText>
          </LedgerRow>
        </>
      )}

      <Section label="Switch to" />
      {isLoading ? (
        <AppText variant="body" color="muted">
          Loading…
        </AppText>
      ) : error || employees.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="body" color="muted">
            {error ? "Can't reach the server." : 'No employees yet.'}
          </AppText>
          <AppText variant="data" color="muted">
            {process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5085/api'}
          </AppText>
        </View>
      ) : (
        employees.map((candidate) => (
          <LedgerRow
            key={candidate.id}
            gutter={candidate.profile.name.slice(0, 2).toUpperCase()}
            onPress={async () => {
              await switchTo(candidate);
              router.replace('/');
            }}
          >
            <AppText variant="body">{candidate.profile.name}</AppText>
            <AppText variant="data" color="muted">
              {candidate.role.toLowerCase()}
              {candidate.id === employee?.id ? ' · current' : ''}
            </AppText>
          </LedgerRow>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginTop: Spacing.three,
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.card,
    gap: Spacing.half,
  },
  current: { gap: Spacing.half, marginBottom: Spacing.two },
  empty: { gap: Spacing.half },
});
