import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { IconTile, type IconName } from '@/components/ui/icon';
import { Spacing, type ThemeColor } from '@/constants/theme';

type EmptyStateProps = {
  icon: IconName;
  tint: Extract<
    ThemeColor,
    'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue' | 'surfaceAlt' | 'primarySoft'
  >;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  /** Inside a card, where the surrounding padding already gives room. */
  compact?: boolean;
};

/** "Nothing yet" is a normal state in a farm app, so it gets a real layout
 *  rather than a bare line of grey text. docs/layout/README.md. */
export function EmptyState({ icon, tint, title, body, action, compact }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.full]}>
      <IconTile name={icon} tint={tint} color={tint === 'surfaceAlt' ? 'muted' : 'ink'} size={compact ? 40 : 56} />
      <AppText variant="bodyStrong" style={styles.centre}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" color="muted" style={styles.centre}>
          {body}
        </AppText>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button variant="secondary" label={action.label} onPress={action.onPress} block={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.sm },
  compact: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  full: { paddingTop: Spacing.huge, paddingHorizontal: Spacing.lg },
  centre: { textAlign: 'center' },
  action: { marginTop: Spacing.md },
});
