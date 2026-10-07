import type { ReactNode } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Size, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LedgerRowProps = {
  /** House token, signed points, initials, or "—" — whatever the list is
   *  actually keyed by. docs/design.md §6.2. */
  gutter?: string;
  gutterColor?: ThemeColor;
  /** An avatar or icon tile in place of a text token. */
  gutterNode?: ReactNode;
  /** Wider gutter for content that doesn't fit 44dp — the feeding-program
   *  day ranges ("11–24") are the one case. */
  gutterWidth?: number;
  onPress?: () => void;
  /** Suppresses the bottom hairline. The last row in a card has none. */
  last?: boolean;
  children: ReactNode;
};

/** The gutter device — location (or whatever the list is keyed by) is the
 *  first thing scanned for, so it gets its own column, not a decoration.
 *  docs/design.md §6.2. */
export function LedgerRow({
  gutter,
  gutterColor,
  gutterNode,
  gutterWidth = Size.gutter,
  onPress,
  last,
  children,
}: LedgerRowProps) {
  const theme = useTheme();

  const inner = (
    <>
      <View style={[styles.gutter, { width: gutterWidth, borderRightColor: theme.line }]}>
        {gutterNode ?? (
          // Seed data has house numbers like 9101, so a token can outgrow the
          // 44dp column. Shrink rather than widen — the fixed width is what
          // keeps rows aligned down the list.
          <AppText
            variant="data"
            color={gutterColor ?? 'muted'}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {gutter}
          </AppText>
        )}
      </View>

      <View style={[styles.content, !onPress && styles.contentEnd]}>{children}</View>

      {onPress ? (
        <View style={styles.chevron}>
          <Icon name="chevron-right" size={20} color="muted" />
        </View>
      ) : null}
    </>
  );

  return (
    <View>
      {/* Pressable resolves a style *function*; View silently ignores one and
          would drop styles.row entirely, collapsing the gutter grid. The two
          cases are rendered separately rather than through one alias. */}
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
        >
          {inner}
        </Pressable>
      ) : (
        <View style={styles.row}>{inner}</View>
      )}

      {/* Runs the full width so the vertical gutter rule and the horizontal
          row rules form one continuous grid. */}
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: Size.row, alignItems: 'center' },
  gutter: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  content: { flex: 1, paddingLeft: Spacing.md, paddingVertical: Spacing.md, gap: 2 },
  contentEnd: { paddingRight: Spacing.lg },
  chevron: { paddingRight: Spacing.lg },
  rule: { height: 1 },
});
