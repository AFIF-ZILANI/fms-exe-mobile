import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SettingRowProps = {
  icon: IconName;
  label: string;
  /** A muted value on the right. */
  value?: string;
  /** Makes the row tappable and adds a chevron. */
  onPress?: () => void;
  /** `critical` for a destructive row such as Log out. */
  tone?: 'default' | 'critical';
  /** A small count on the right, e.g. records that need attention. */
  badge?: number;
  last?: boolean;
};

/** One line of a settings list: a small icon tile, the label, then a value or a chevron. */
export function SettingRow({ icon, label, value, onPress, tone = 'default', badge, last }: SettingRowProps) {
  const theme = useTheme();
  const critical = tone === 'critical';

  const body = (
    <>
      <IconTile name={icon} tint={critical ? 'tintRed' : 'surfaceAlt'} color={critical ? 'critical' : 'inkSoft'} size={32} />
      <AppText variant="body" color={critical ? 'critical' : 'ink'} style={styles.flex}>
        {label}
      </AppText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.critical }]}>
          <AppText variant="data" color="onPrimary">
            {badge}
          </AppText>
        </View>
      ) : null}
      {value ? (
        <AppText variant="label" color="muted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {onPress && !critical ? <Icon name="chevron-right" size={20} color="muted" /> : null}
    </>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}, ${value}` : label}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    minHeight: Size.rowSingle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  value: { maxWidth: '50%' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 32 + Spacing.md },
});
