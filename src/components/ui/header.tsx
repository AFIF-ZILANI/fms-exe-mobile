import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Size, Spacing } from '@/constants/theme';
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
  action?: { icon: IconName; label: string; onPress: () => void };
};

/** 56dp, leading-aligned title. Never centred — several house names are
 *  Bengali and long, and a centred title truncates them from both ends.
 *  docs/layout/00-app-shell.md. */
export function Header({ title, eyebrow, leading, onLeadingPress, action }: HeaderProps) {
  const theme = useTheme();
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
          accessibilityLabel={action.label}
          style={styles.iconButton}
        >
          <Icon name={action.icon} size={24} />
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  titleBlock: { flex: 1 },
  iconButton: {
    width: Size.iconButton,
    height: Size.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    // Pull the glyph flush with the screen padding rather than the button box.
    marginHorizontal: -Spacing.md,
  },
});
