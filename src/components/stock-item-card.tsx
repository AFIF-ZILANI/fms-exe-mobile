import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { humanise } from '@/lib/profile-format';
import { formatBalance, levelRatio, stockState, type StockLine, type StockState } from '@/lib/stock-summary';

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

/** One item: what it is, how much is left against its reorder level, and whether it needs attention. */
export function StockItemCard({ line }: { line: StockLine }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const state = stockState(line);
  const look = LOOK[state];
  const unit = line.item.unit.toLowerCase();
  const reorder = line.item.reorder_level == null ? null : Number(line.item.reorder_level);

  return (
    <Pressable
      onPress={() => router.push(`/stock/${line.item.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${line.item.name}, ${formatBalance(line.balance)} ${unit}${state === 'LOW' ? ', low' : state === 'OUT' ? ', out of stock' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        elevation(scheme, 'card'),
      ]}
    >
      <IconTile name={categoryIcon(line.item.category)} tint={look.tint} color={look.color} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {line.item.name}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={state === 'OUT' ? 'critical' : 'muted'} numberOfLines={1} style={styles.flex}>
            {humanise(line.item.category)}
            {state === 'OUT'
              ? ' · out of stock'
              : reorder !== null && Number.isFinite(reorder)
                ? ` · reorder at ${formatBalance(reorder)}`
                : ''}
          </AppText>
          {state === 'LOW' ? <StatusPill status="LOW" label="Low" /> : null}
        </View>
        <LevelBar line={line} />
      </View>
      <View style={styles.qty}>
        <AppText variant="figure" color={state === 'OK' ? 'ink' : state === 'LOW' ? 'warning' : 'critical'}>
          {formatBalance(line.balance)}
        </AppText>
        <AppText variant="caption" color="muted">
          {unit}
        </AppText>
      </View>
      <Icon name="chevron-right" size={20} color="muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  qty: { alignItems: 'flex-end', minWidth: 52 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.sm },
  fill: { height: '100%', borderRadius: Radius.pill },
  tick: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, opacity: 0.5 },
});
