import { Pressable, StyleSheet, View } from 'react-native';

import { CycleBar } from '@/components/cycle-bar';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { dayOfCycle, expectedCycleDays } from '@/lib/farm';
import { formatBatchCode } from '@/lib/format';
import { daysLeft, type Freshness } from '@/lib/house-detail';
import { cycleProgress } from '@/lib/houses-summary';
import { humanise } from '@/lib/profile-format';
import type { BatchHouseBalance, House } from '@/lib/types';

/**
 * The top card of a house: number badge, type and capacity, status; live birds large, the batch, and
 * where the cycle stands. An empty house says so and why logging is off. docs/house-detail-redesign-design.md.
 */
export function HouseHero({ house, balance }: { house: House; balance: BatchHouseBalance | null }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const running = !!balance && balance.quantity > 0;
  const batch = running && balance ? balance.batch : undefined;

  const meta = [humanise(house.type), house.capacity ? `capacity ${house.capacity.toLocaleString()}` : null]
    .filter(Boolean)
    .join(' · ');
  const day = batch ? dayOfCycle(batch.starting_date) : 0;
  const expected = batch ? expectedCycleDays(batch) : 0;
  const progress = batch ? cycleProgress(day, expected) : null;
  const left = batch ? daysLeft(day, expected) : null;

  return (
    <View style={[styles.hero, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="data" color="primary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {house.number ?? '—'}
          </AppText>
        </View>
        <AppText variant="caption" color="muted" style={styles.flex}>
          {meta}
        </AppText>
        <StatusPill status={running ? 'RUNNING' : 'EMPTY'} />
      </View>

      {running && balance ? (
        <>
          <AppText variant="hero" style={styles.centre}>
            {balance.quantity.toLocaleString()}
          </AppText>
          <AppText variant="eyebrow" color="muted" style={[styles.centre, styles.birdsLabel]}>
            Live birds
          </AppText>

          {batch ? (
            <View style={styles.batch}>
              <View style={styles.row}>
                <AppText variant="data">{formatBatchCode(batch.batch_code, balance.batch_id)}</AppText>
                <AppText variant="caption" color="muted">
                  {humanise(batch.breed)} · {humanise(batch.phase)}
                </AppText>
              </View>
              {progress ? (
                <>
                  <CycleBar progress={progress} />
                  <View style={styles.row}>
                    <AppText variant="caption" color={progress.over ? 'warning' : 'muted'}>
                      {progress.label}
                    </AppText>
                    {left?.text ? (
                      <AppText variant="caption" color={left.warn ? 'warning' : 'muted'}>
                        {left.text}
                      </AppText>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyBlock}>
          <AppText variant="h2" color="muted" style={styles.centre}>
            Empty house
          </AppText>
          <AppText variant="caption" color="muted" style={styles.centre}>
            Logging needs a batch in this house.
          </AppText>
        </View>
      )}
    </View>
  );
}

type LogTileProps = {
  label: string;
  icon: IconName;
  tint: Extract<ThemeColor, 'tintRed' | 'tintAmber' | 'tintBlue' | 'tintGreen'>;
  freshness: Freshness;
  width: number;
  onPress: () => void;
};

/** A log action that also answers "has this been done today?": the last-logged time sits under the label,
 *  with a check and the word "Today" when it has (never colour alone). */
export function LogTile({ label, icon, tint, freshness, width, onPress }: LogTileProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${label.toLowerCase()}. ${freshness.text}`}
      style={({ pressed }) => [
        styles.tile,
        { width, backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        elevation(scheme, 'card'),
      ]}
    >
      <IconTile name={icon} tint={tint} />
      <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {label}
      </AppText>
      <View style={styles.fresh}>
        {freshness.today ? <Icon name="check" size={14} color="success" /> : null}
        <AppText variant="caption" color={freshness.today ? 'success' : 'muted'} numberOfLines={1}>
          {freshness.text}
        </AppText>
      </View>
    </Pressable>
  );
}

/** A two-up shortcut button (scan actions), the same style as the Stock tab's. */
export function ShortcutTile({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.shortcut,
        { backgroundColor: theme.surfaceAlt },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <Icon name={icon} size={20} color="primary" />
      <AppText variant="label" style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  hero: { borderRadius: Radius.card, padding: Spacing.xl, marginTop: Spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  badge: {
    minWidth: 40,
    maxWidth: 76,
    height: 40,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  birdsLabel: { marginTop: Spacing.sm },
  batch: { marginTop: Spacing.lg, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  emptyBlock: { gap: Spacing.xs, paddingVertical: Spacing.md },
  tile: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.card,
    // Tight sides: three tiles share the row, and "Environment" must fit on one line.
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  fresh: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  shortcut: {
    width: '47.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
  },
});
