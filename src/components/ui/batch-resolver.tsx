import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import type { BatchHouseBalance } from '@/lib/types';

/**
 * GET /batch-house-balances?house_id=X is the batch lookup for every form
 * needing a batch_id -- it doubles as the live count display. docs/PRD.md §6.7.
 */
export function useResolvedBatch(houseId: string | undefined) {
  const { data, isLoading } = useGetData<Paginated<BatchHouseBalance>>(
    `/batch-house-balances?house_id=${houseId ?? ''}&limit=1`,
    ['batch-house-balances', houseId ?? 'none'],
    { enabled: !!houseId },
  );
  return { balance: data?.results?.[0] ?? null, isLoading: !!houseId && isLoading };
}

/** The house picker's companion line -- lets the worker confirm they're
 *  logging against the right flock before writing. */
export function BatchResolver({ houseId }: { houseId: string | undefined }) {
  const theme = useTheme();
  const { balance, isLoading } = useResolvedBatch(houseId);

  if (!houseId) return null;
  if (isLoading) return <ActivityIndicator style={styles.spinner} color={theme.muted} />;
  if (!balance) {
    return (
      <AppText variant="data" color="critical">
        No batch in this house
      </AppText>
    );
  }

  return (
    <View style={styles.row}>
      <AppText variant="data" color="muted">
        {balance.batch?.batch_code}
      </AppText>
      <AppText variant="figure" color="ink">
        {balance.quantity.toLocaleString()}
      </AppText>
      <AppText variant="data" color="muted">
        birds
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },
  spinner: { alignSelf: 'flex-start' },
});
