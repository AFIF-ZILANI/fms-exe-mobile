import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { dayOfCycle, expectedCycleDays } from '@/lib/farm';
import { formatBatchCode } from '@/lib/format';
import { cycleProgress, type HouseLine } from '@/lib/houses-summary';
import { humanise } from '@/lib/profile-format';

/**
 * One house as a card: the house number as a small badge, the name leading, its status on the right;
 * a running house shows its live birds large with the batch code and where the cycle stands, an empty
 * one stays short and quiet. The name leads (not the number) because house numbers are not unique.
 * docs/houses-redesign-design.md.
 */
export function HouseCard({ line }: { line: HouseLine }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { house, balance, running } = line;
  const batch = balance?.batch;

  const meta = [humanise(house.type), house.capacity ? `capacity ${house.capacity.toLocaleString()}` : null]
    .filter(Boolean)
    .join(' · ');
  const progress = batch ? cycleProgress(dayOfCycle(batch.starting_date), expectedCycleDays(batch)) : null;

  return (
    <Pressable
      onPress={() => router.push(`/houses/${house.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${house.name}, ${
        running && balance ? `${balance.quantity.toLocaleString()} birds` : 'empty'
      }`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        elevation(scheme, 'card'),
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="data" color="primary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {house.number ?? '—'}
          </AppText>
        </View>
        <View style={styles.titleBlock}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {house.name}
          </AppText>
          {meta ? (
            <AppText variant="caption" color="muted">
              {meta}
            </AppText>
          ) : null}
        </View>
        <StatusPill status={running ? 'RUNNING' : 'EMPTY'} />
      </View>

      {running && balance ? (
        <>
          <View style={styles.countRow}>
            <View style={styles.count}>
              <AppText variant="stat">{balance.quantity.toLocaleString()}</AppText>
              <AppText variant="caption" color="muted">
                birds
              </AppText>
            </View>
            {batch ? (
              <AppText variant="data" color="muted">
                {formatBatchCode(batch.batch_code, balance.batch_id)}
              </AppText>
            ) : null}
          </View>

          {progress ? (
            <View style={styles.progress}>
              <View
                style={[styles.track, { backgroundColor: theme.line }]}
                accessibilityLabel={progress.label}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round(progress.ratio * 100)}%`,
                      backgroundColor: progress.over ? theme.warning : theme.primary,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" color={progress.over ? 'warning' : 'muted'}>
                {progress.over ? `${progress.label} · past plan` : progress.label}
              </AppText>
            </View>
          ) : null}
        </>
      ) : (
        <AppText variant="caption" color="muted" style={styles.emptyNote}>
          No batch placed
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: {
    // Grows for a long house number instead of cutting it off, up to a cap.
    minWidth: 40,
    maxWidth: 76,
    height: 40,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  titleBlock: { flex: 1, gap: 2 },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  progress: { marginTop: Spacing.sm, gap: Spacing.xs },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: Radius.pill },
  emptyNote: { marginTop: Spacing.md },
});
