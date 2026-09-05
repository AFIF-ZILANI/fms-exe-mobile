import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = ViewProps & {
  /** Uppercase section header inside the card's top row. */
  eyebrow?: string;
  /** Trailing text action in the header row, e.g. "ALL". Renders a chevron. */
  action?: string;
  onActionPress?: () => void;
  /** Right-aligned muted note in the header row — staleness, a ratio, a count.
   *  Shown instead of `action` when both are set. */
  note?: string;
  /** A card that is purely a list of rows: rows own their horizontal padding
   *  so hairlines run edge to edge. docs/layout/README.md. */
  rows?: boolean;
};

/** `surface` fill, 16dp radius, soft elevation. The base container for every
 *  grouped block in the app. docs/design.md §7. */
export function Card({
  eyebrow,
  action,
  onActionPress,
  note,
  rows = false,
  children,
  style,
  ...rest
}: CardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.card,
        rows ? styles.padRows : styles.padBody,
        { backgroundColor: theme.surface },
        elevation(scheme, 'card'),
        style,
      ]}
      {...rest}
    >
      {(eyebrow || action || note) && (
        <View style={[styles.header, rows && styles.headerInset]}>
          {eyebrow ? (
            <AppText variant="eyebrow" color="muted">
              {eyebrow}
            </AppText>
          ) : (
            <View />
          )}

          {note ? (
            <AppText variant="caption" color="muted">
              {note}
            </AppText>
          ) : action ? (
            <Pressable
              onPress={onActionPress}
              accessibilityRole="button"
              accessibilityLabel={action}
              hitSlop={Spacing.md}
              style={styles.action}
            >
              <AppText variant="label" color="primary">
                {action}
              </AppText>
              <Icon name="chevron-right" size={16} color="primary" />
            </Pressable>
          ) : null}
        </View>
      )}

      {children}
    </View>
  );
}

type StatCardProps = {
  /** The figure. Always mono — pass it formatted. */
  value: string;
  eyebrow: string;
  tint: Extract<ThemeColor, 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue'>;
  /** Colour of the figure. `ink` unless the figure *is* a status. */
  valueColor?: ThemeColor;
  icon?: React.ReactNode;
  /** A caption under the eyebrow — staleness, mostly. */
  note?: string;
  onPress?: () => void;
};

/** A tinted block holding one `stat` figure. Two per row, or three when every
 *  figure is =< 4 characters. Never four. docs/layout/README.md. */
export function StatCard({
  value,
  eyebrow,
  tint,
  valueColor = 'ink',
  icon,
  note,
  onPress,
}: StatCardProps) {
  const theme = useTheme();
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.stat, { backgroundColor: theme[tint] }]}
    >
      {icon ? <View style={styles.statIcon}>{icon}</View> : null}
      <AppText variant="stat" color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="eyebrow" color="muted" style={styles.statEyebrow}>
        {eyebrow}
      </AppText>
      {note ? (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card },
  padBody: { padding: Spacing.lg },
  padRows: { paddingVertical: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginBottom: Spacing.md,
  },
  headerInset: { paddingHorizontal: Spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stat: {
    flex: 1,
    borderRadius: Radius.card,
    padding: Spacing.lg,
  },
  statIcon: { marginBottom: Spacing.md },
  statEyebrow: { marginTop: Spacing.xs },
});
