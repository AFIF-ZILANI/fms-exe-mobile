import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Size, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type HeaderProps = {
  title: string;
  /** Small line above the title — a greeting, a context label. */
  eyebrow?: string;
  /** `back` shows a chevron, `close` an ✕ (a form discards, a stack pops).
   *  docs/layout/07-log-mortality.md. */
  leading?: 'back' | 'close';
  onLeadingPress?: () => void;
  /** At most one. A second action belongs in the screen body. */
  action?: {
    icon: IconName;
    label: string;
    onPress: () => void;
    /** A count shown on the icon (e.g. active alerts). Hidden at 0; capped as "9+". */
    badge?: number;
    /** Red only when something is critical; amber otherwise. */
    badgeTone?: 'warning' | 'critical';
  };
};

/** 56dp, leading-aligned title. Never centred — several house names are
 *  Bengali and long, and a centred title truncates them from both ends.
 *  docs/layout/00-app-shell.md. */
export function Header({ title, eyebrow, leading, onLeadingPress, action }: HeaderProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const back = () => (onLeadingPress ? onLeadingPress() : router.back());

  return (
    <View style={[styles.header, { backgroundColor: theme.ground }]}>
      {leading ? (
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
          style={styles.iconButton}
        >
          <Icon name={leading === 'close' ? 'x' : 'chevron-left'} size={24} />
        </Pressable>
      ) : null}

      <View style={styles.titleBlock}>
        {eyebrow ? (
          <AppText variant="caption" color="muted">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="h1" numberOfLines={1}>
          {title}
        </AppText>
      </View>

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={
            action.badge && action.badge > 0 ? `${action.label}, ${action.badge} active` : action.label
          }
          style={styles.iconButton}
        >
          <Icon name={action.icon} size={24} />
          {action.badge && action.badge > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: action.badgeTone === 'critical' ? theme.critical : theme.warning },
              ]}
            >
              <AppText
                variant="caption"
                style={[
                  styles.badgeText,
                  // Dark text on the bright dark-theme colours and on amber; white on light-theme red.
                  { color: scheme === 'dark' || action.badgeTone !== 'critical' ? '#0F1419' : '#FFFFFF' },
                ]}
              >
                {action.badge > 9 ? '9+' : String(action.badge)}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: Size.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    // No horizontal padding: every Header sits inside <Screen>, which already
    // supplies the 20dp gutter. FormScreen, which renders it outside, adds its own.
    paddingVertical: Spacing.sm,
  },
  titleBlock: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  iconButton: {
    width: Size.iconButton,
    height: Size.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    // Pull the glyph flush with the screen padding rather than the button box.
    marginHorizontal: -Spacing.md,
  },
});
