import { View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { formatBatchCode } from '@/lib/format';
import { dayOfCycle } from '@/lib/farm';
import type { BatchHouseBalance } from '@/lib/types';

/**
 * GET /batch-house-balances?house_id=X is the batch lookup for every form
 * needing a batch_id — it doubles as the live count display. One request
 * serves both. docs/layout/07-log-mortality.md.
 */
export function useResolvedBatch(houseId: string | undefined) {
  const { data, isLoading } = useGetData<Paginated<BatchHouseBalance>>(
    `/batch-house-balances?house_id=${houseId ?? ''}&limit=1`,
    ['batch-house-balances', houseId ?? 'none'],
    { enabled: !!houseId },
  );
  return { balance: data?.results?.[0] ?? null, isLoading: !!houseId && isLoading };
}

/**
 * The house picker's companion block — read-only, not a field. It exists so
 * the worker can check they're logging against the right flock before
 * writing, which is the most valuable thing on a log form.
 * docs/layout/07-log-mortality.md §3.
 */
export function BatchResolver({ houseId }: { houseId: string | undefined }) {
  const theme = useTheme();
  const { balance, isLoading } = useResolvedBatch(houseId);

  if (!houseId) {
    return (
      <View style={[styles.block, { backgroundColor: theme.surfaceAlt }]}>
        <AppText variant="caption" color="muted">
          Pick a house first
        </AppText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.block, { backgroundColor: theme.surfaceAlt }]}>
        <Skeleton width="60%" height={18} />
      </View>
    );
  }

  if (!balance) {
    return (
      <View style={[styles.block, styles.row, { backgroundColor: theme.tintRed }]}>
        <Icon name="alert-circle" size={20} color="critical" />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">No batch in this house</AppText>
          <AppText variant="caption" color="muted">
            Nothing can be logged here.
          </AppText>
        </View>
      </View>
    );
  }

  const batch = balance.batch;

  return (
    <View style={[styles.block, { backgroundColor: theme.tintGreen }]}>
      <View style={styles.line}>
        <AppText variant="data">{formatBatchCode(batch?.batch_code, balance.batch_id)}</AppText>
        {batch ? (
          <AppText variant="caption" color="muted">
            {batch.breed.toLowerCase()} · d{dayOfCycle(batch.starting_date)}
          </AppText>
        ) : null}
      </View>
      <View style={styles.line}>
        <AppText variant="figure">{balance.quantity.toLocaleString()}</AppText>
        <AppText variant="caption" color="muted">
          live birds
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: {
    minHeight: 64,
    justifyContent: 'center',
    gap: 2,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
});
