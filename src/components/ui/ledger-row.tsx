import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { Divider } from '@/components/ui/divider';
import { MinTouchTarget, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LedgerRowProps = {
  /** House token, signed points, initials, or "—" -- whatever the list is
   *  actually keyed by. docs/design.md §4.1. */
  gutter: string;
  gutterColor?: ThemeColor;
  onPress?: () => void;
  children: ReactNode;
};

/** The 44dp gutter device -- location (or whatever the list is keyed by) is
 *  the first thing scanned for, so it gets its own column, not a decoration. */
export function LedgerRow({ gutter, gutterColor, onPress, children }: LedgerRowProps) {
  const theme = useTheme();
  const Wrapper = onPress ? Pressable : View;

  return (
    <View>
      <Wrapper
        onPress={onPress}
        style={styles.row}
        accessibilityRole={onPress ? 'button' : undefined}
      >
        <View style={[styles.gutter, { borderRightColor: theme.line }]}>
          <AppText variant="data" color={gutterColor ?? 'muted'}>
            {gutter}
          </AppText>
        </View>
        <View style={styles.content}>{children}</View>
      </Wrapper>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: MinTouchTarget, alignItems: 'center' },
  gutter: {
    width: 44,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderRightWidth: 1,
    paddingVertical: Spacing.two,
  },
  content: { flex: 1, paddingLeft: Spacing.two, paddingVertical: Spacing.two, gap: Spacing.half },
});
