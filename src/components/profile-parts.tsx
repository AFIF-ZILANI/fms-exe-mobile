import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/farm';
import { displayValue, formatDate, roleLabel, statusLabel } from '@/lib/profile-format';
import type { Employee } from '@/lib/types';

/** Opens the dialer or mail app; a phone with neither says so instead of doing nothing. */
export function openLink(url: string): void {
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open that", 'This phone has no app for it.'));
}

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: 'CURRENT',
  PROBATION: 'PENDING',
  APPOINTED: 'CURRENT',
  TERMINATED: 'CLOSED',
};

/** The identity card: photo or initials, name, role and status, joined date. */
export function ProfileHeader({ employee }: { employee: Employee }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const photo = employee.profile.avatar?.image_url;
  const status = statusLabel(employee.employment_status);
  const joined = formatDate(employee.joining_date);

  return (
    <View style={[styles.hero, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityLabel={`${employee.profile.name}'s photo`}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="stat" color="primary">
            {initials(employee.profile.name)}
          </AppText>
        </View>
      )}

      <AppText variant="h1" style={styles.centre}>
        {employee.profile.name}
      </AppText>

      <View style={styles.pills}>
        <View style={[styles.rolePill, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="label" color="primary">
            {roleLabel(employee.role)}
          </AppText>
        </View>
        {status ? (
          <StatusPill
            status={STATUS_TONE[employee.employment_status ?? ''] ?? 'CLOSED'}
            label={status}
          />
        ) : null}
      </View>

      {joined ? (
        <AppText variant="caption" color="muted" style={styles.centre}>
          Joined {joined}
        </AppText>
      ) : null}
    </View>
  );
}

type InfoRowProps = {
  label: string;
  /** Missing, empty or blank shows "Not provided" and the row is not tappable. */
  value?: string | null;
  /** Makes the row tappable (call, write). Ignored when there is no value. */
  onPress?: () => void;
  icon?: IconName;
  last?: boolean;
};

/** A label on the left, its value on the right, an optional action icon, a hairline below. */
export function InfoRow({ label, value, onPress, icon, last }: InfoRowProps) {
  const theme = useTheme();
  const shown = displayValue(value);
  const tappable = !!onPress && !!shown;

  const body = (
    <>
      <AppText variant="label" color="muted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="body" color={shown ? 'ink' : 'muted'} style={styles.rowValue}>
        {shown ?? 'Not provided'}
      </AppText>
      {tappable && icon ? <Icon name={icon} size={20} color="primary" /> : null}
    </>
  );

  return (
    <View>
      {tappable ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown}`}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </View>
  );
}

/** A tappable row that goes somewhere, with a chevron. */
export function NavRow({
  label,
  onPress,
  last,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
      >
        <AppText variant="body" style={styles.rowValue}>
          {label}
        </AppText>
        <Icon name="chevron-right" size={20} color="muted" />
      </Pressable>
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </View>
  );
}

/** A titled card of rows, edge to edge so the hairlines run the full width. */
export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card rows eyebrow={title} style={styles.card}>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    marginTop: Spacing.xs,
  },
  avatar: { width: 80, height: 80, borderRadius: Radius.pill, marginBottom: Spacing.xs },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  rolePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  card: { marginTop: Spacing.md },
  row: {
    minHeight: Size.rowSingle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
  rule: { height: 1, marginLeft: Spacing.lg },
});
