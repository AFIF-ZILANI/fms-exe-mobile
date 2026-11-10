import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { humanise } from '@/lib/profile-format';
import { formatStock, levelRatio, stockFigure, stockState, type StockLine, type StockState } from '@/lib/stock-summary';

const CATEGORY_ICON: Record<string, IconName> = {
  FEED: 'package',
  MEDICINE: 'plus-square',
  VACCINE: 'shield',
  SUPPLEMENT: 'droplet',
  BIOSECURITY: 'shield',
  EQUIPMENT: 'tool',
  CLEANING_SUPPLIES: 'wind',
  HUSK: 'layers',
  UTILITIES: 'zap',
  MAINTENANCE: 'tool',
  TRANSPORTATION: 'truck',
};

export const categoryIcon = (category: string): IconName => CATEGORY_ICON[category] ?? 'box';

const LOOK: Record<StockState, { tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'surfaceAlt'; color: 'success' | 'warning' | 'critical' | 'muted' }> = {
  OK: { tint: 'surfaceAlt', color: 'muted' },
  LOW: { tint: 'tintAmber', color: 'warning' },
  OUT: { tint: 'tintRed', color: 'critical' },
};

/** A thin bar of how full an item is, with a tick at the reorder level (the halfway mark). */
export function LevelBar({ line }: { line: StockLine }) {
  const theme = useTheme();
  const ratio = levelRatio(line);
  if (ratio === null) return null;
  const state = stockState(line);
  const fill = state === 'OUT' ? theme.critical : state === 'LOW' ? theme.warning : theme.success;
  return (
    <View style={[styles.track, { backgroundColor: theme.line }]}>
      <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill }]} />
      <View style={[styles.tick, { backgroundColor: theme.muted }]} />
    </View>
  );
}

/** One item as a row in a grouped list: what it is, how much is left, and its level against the reorder line.
 *  The section it sits in says Low / In stock / Out, so the row doesn't repeat it. */
export function StockItemRow({ line, last }: { line: StockLine; last?: boolean }) {
  const theme = useTheme();
  const state = stockState(line);
  const look = LOOK[state];
  const figure = stockFigure(line.balance, line.item);
  const reorder = line.item.reorder_level == null ? null : Number(line.item.reorder_level);

  return (
    <Pressable
      onPress={() => router.push(`/stock/${line.item.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${line.item.name}, ${formatStock(line.balance, line.item)}${state === 'LOW' ? ', low' : state === 'OUT' ? ', out of stock' : ''}`}
      style={({ pressed }) => pressed && { backgroundColor: theme.surfaceAlt }}
    >
      <View style={styles.row}>
        <IconTile name={categoryIcon(line.item.category)} tint={look.tint} color={look.color} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {line.item.name}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {humanise(line.item.category)}
            {reorder !== null && Number.isFinite(reorder) && reorder > 0
              ? ` · reorder at ${formatStock(reorder, line.item)}`
              : ''}
          </AppText>
          <LevelBar line={line} />
        </View>
        <View style={styles.qty}>
          <AppText variant="figure" color={state === 'OK' ? 'ink' : state === 'LOW' ? 'warning' : 'critical'}>
            {figure.main}
          </AppText>
          {figure.sub ? (
            <AppText variant="caption" color="muted">
              {figure.sub}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-right" size={20} color="muted" />
      </View>
      {/* Inset to the text column, so the icons read as one column down the group. */}
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rule: { height: 1, marginLeft: Spacing.lg + 40 + Spacing.md },
  qty: { alignItems: 'flex-end', minWidth: 52 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.sm },
  fill: { height: '100%', borderRadius: Radius.pill },
  tick: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, opacity: 0.5 },
});
