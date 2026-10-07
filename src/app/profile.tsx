import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, IconTile } from '@/components/ui/icon';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { InfoCard, InfoRow, NavRow, ProfileHeader, openLink } from '@/components/profile-parts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useAppearance, type AppearancePref } from '@/lib/appearance';
import { monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import {
  ageFromDob,
  displayValue,
  educationLabel,
  formatDate,
  formatExperience,
  formatTenureShort,
  hasEmergencyContact,
  maritalLabel,
  maskNid,
  roleLabel,
  statusLabel,
} from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';
import type { Employee } from '@/lib/types';

type ScoreEntry = { id: string; points: number; employee_id: string };

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: AppearancePref; label: string }[];

/** docs/profile-redesign-design.md — who you are at the farm, your details as the farm holds them,
 *  who to call in an emergency, and the app's settings. Read-only. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { employee: saved, logout, signedIn, refresh } = useSession();
  const { data: outbox } = useOutboxSummary();
  const [appearance, setAppearance] = useAppearance();
  // Read once: calling new Date() during render is impure (the React Compiler rejects it).
  const [now] = useState(() => new Date());
  const { from, to } = useMemo(() => monthRange(now), [now]);

  // The copy saved at login shows at once; the fresh fetch replaces it. Offline keeps the saved copy.
  const { data: fresh, isError } = useGetData<Employee>(
    saved ? `/employees/${saved.id}` : '',
    ['employees', 'me', saved?.id ?? 'none'],
    { enabled: !!saved, initialData: saved ?? undefined },
  );
  const employee = fresh ?? saved;

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', 'mtd', employee?.id ?? 'none'],
    { enabled: !!employee },
  );
  const points = (scores?.results ?? []).reduce((sum, s) => sum + s.points, 0);
  const pointsReady = !!scores;

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

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  if (!employee) {
    return (
      <Screen>
        <Header title="Profile" leading="back" />
        <EmptyState
          icon="user"
          tint="primarySoft"
          title="Couldn't load your profile."
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => void refresh().catch(() => {}) }}
        />
        <View style={styles.logout}>
          <Button variant="destructive" label="Log out" onPress={onLogout} block />
        </View>
      </Screen>
    );
  }

  const p = employee.profile;
  const age = ageFromDob(employee.date_of_birth, now);
  const dob = employee.date_of_birth ? formatDate(employee.date_of_birth) : null;
  const onProbation = employee.employment_status === 'PROBATION' && !!employee.probation_end_date;
  const emergencyName = displayValue(employee.emergency_name);
  const emergencyRelation = displayValue(employee.emergency_relation);
  const emergencyPhone = displayValue(employee.emergency_phone);

  return (
    <Screen>
      <Header title="Profile" leading="back" />

      <ProfileHeader employee={employee} />

      <View style={styles.stats}>
        <StatCard
          value={pointsReady ? formatSignedPoints(points) : '…'}
          eyebrow={`Points · ${now.toLocaleDateString(undefined, { month: 'short' })}`}
          tint="tintAmber"
          valueColor={!pointsReady ? 'muted' : points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
          icon={<IconTile name="award" tint="tintAmber" color="warning" />}
          onPress={() => router.push('/me/performance')}
        />
        <StatCard
          value={formatTenureShort(employee.joining_date, now)}
          eyebrow="With the farm"
          tint="tintBlue"
          icon={<IconTile name="clock" tint="tintBlue" color="info" />}
        />
      </View>

      {isError ? (
        <AppText variant="caption" color="muted" style={styles.note}>
          Showing details saved on this phone.
        </AppText>
      ) : null}

      <InfoCard title="Contact">
        <InfoRow label="Mobile" value={p.mobile} icon="phone" onPress={() => openLink(`tel:${p.mobile}`)} />
        <InfoRow
          label="Email"
          value={p.email}
          icon="mail"
          onPress={() => openLink(`mailto:${p.email}`)}
        />
        <InfoRow label="Address" value={p.address} last />
      </InfoCard>

      <InfoCard title="Employment">
        <InfoRow label="Role" value={roleLabel(employee.role)} />
        <InfoRow label="Status" value={statusLabel(employee.employment_status)} />
        <InfoRow label="Joined" value={formatDate(employee.joining_date)} last={!onProbation} />
        {onProbation ? (
          <InfoRow label="Probation ends" value={formatDate(employee.probation_end_date as string)} last />
        ) : null}
      </InfoCard>

      <InfoCard title="Personal">
        <InfoRow label="Born" value={dob ? `${dob}${age !== null ? ` · ${age} yrs` : ''}` : null} />
        <InfoRow label="Marital status" value={maritalLabel(employee.marital_status)} />
        <InfoRow label="Education" value={educationLabel(employee.education)} />
        <InfoRow
          label="Experience"
          value={formatExperience(employee.experience_years, employee.experience)}
        />
        <InfoRow label="National ID" value={maskNid(employee.nid_number)} last />
      </InfoCard>

      <InfoCard title="Emergency contact">
        {hasEmergencyContact(employee) ? (
          <>
            <InfoRow
              label="Name"
              value={
                emergencyName
                  ? `${emergencyName}${emergencyRelation ? ` · ${emergencyRelation}` : ''}`
                  : null
              }
            />
            <InfoRow
              label="Phone"
              value={emergencyPhone}
              icon="phone"
              onPress={() => openLink(`tel:${emergencyPhone}`)}
              last
            />
          </>
        ) : (
          <View style={[styles.warning, { backgroundColor: theme.tintAmber }]}>
            <Icon name="alert-circle" size={20} color="warning" />
            <AppText variant="body" style={styles.warningText}>
              No emergency contact on file. Ask your manager to add one.
            </AppText>
          </View>
        )}
      </InfoCard>

      <AppText variant="caption" color="muted" style={styles.note}>
        Something wrong? Ask your manager. Only they can change these details.
      </AppText>

      <Card rows eyebrow="Settings" style={styles.card}>
        <View style={styles.appearance}>
          <AppText variant="label" color="muted">
            Appearance
          </AppText>
          <SegmentedToggle
            height={48}
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={setAppearance}
          />
        </View>
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <NavRow label="My performance" onPress={() => router.push('/me/performance')} />
        <NavRow label="Change password" onPress={() => router.push('/change-password' as Href)} />
        <InfoRow label="App version" value={Constants.expoConfig?.version} last />
      </Card>

      <View style={styles.logout}>
        <Button variant="destructive" label="Log out" onPress={onLogout} block />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  card: { marginTop: Spacing.md },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
  appearance: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  rule: { height: 1, marginLeft: Spacing.lg },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.control,
  },
  warningText: { flex: 1 },
  logout: { marginTop: Spacing.xl },
});
