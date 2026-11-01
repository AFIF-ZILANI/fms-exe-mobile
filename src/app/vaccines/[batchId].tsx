import { RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { VaccineRow } from '@/components/vaccine-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData } from '@/lib/api';
import { dayOfCycle } from '@/lib/farm';
import { formatBatchCode } from '@/lib/format';
import type { Batch } from '@/lib/types';
import { groupRows, type VaccineScheduleRow } from '@/lib/vaccine-schedule';

/** docs/superpowers/specs/2026-10-31-vaccine-schedule-design.md — the batch's vaccine plan as the worker in
 *  this house reads it: what's theirs to confirm now, what's coming, what's done. Read-only apart from
 *  opening a due vaccine to confirm it; planning changes are made on the web. */
export default function VaccineScheduleScreen() {
  const theme = useTheme();
  // house_id: the house this was opened from -- the only one this screen can confirm for.
  const { batchId, house_id } = useLocalSearchParams<{ batchId: string; house_id?: string }>();
  const batchQ = useGetData<Batch>(`/batches/${batchId}`, ['batches', batchId]);
  const rowsQ = useGetData<VaccineScheduleRow[]>(`/batch-vaccine-schedules?batch_id=${batchId}`, [
    'batch-vaccine-schedules',
    batchId,
  ]);
  const batch = batchQ.data;
  const rows = rowsQ.data ?? [];
  const today = batch ? dayOfCycle(batch.starting_date) : 0;
  const groups = groupRows(rows, today, house_id);
  const houseName = rows[0]?.houses.find((h) => h.id === house_id)?.name;
  const canConfirm = batch?.status === 'RUNNING' && !!house_id;
  const refetch = () => void Promise.all([rowsQ.refetch(), batchQ.refetch()]);

  const section = (title: string, list: VaccineScheduleRow[], confirmable: boolean) =>
    list.length ? (
      <Card rows eyebrow={title} note={String(list.length)} style={styles.card}>
        {list.map((row, i) => (
          <VaccineRow
            key={row.id}
            row={row}
            today={today}
            startingDate={batch!.starting_date}
            houseId={house_id}
            last={i === list.length - 1}
            onPress={
              confirmable
                ? () => router.push(`/vaccines/confirm?id=${row.id}&batch_id=${batchId}&house_id=${house_id}` as Href)
                : undefined
            }
          />
        ))}
      </Card>
    ) : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={rowsQ.isRefetching} onRefresh={refetch} tintColor={theme.primary} />}>
      <Header
        title="Vaccines"
        eyebrow={batch ? [houseName ?? formatBatchCode(batch.batch_code, batch.id), `Day ${today}`].join(' · ') : undefined}
        leading="back"
      />

      {rowsQ.isPending || batchQ.isPending ? (
        <View style={styles.card}>
          <Skeleton height={180} />
        </View>
      ) : rowsQ.isError || !batch ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load the vaccine schedule."
            action={{ label: 'Retry', onPress: refetch }}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="calendar"
            tint="surfaceAlt"
            title="No vaccine schedule yet."
            body="An admin adds it from the batch on the dashboard."
          />
        </Card>
      ) : (
        <>
          {section('Due now', groups.due, canConfirm)}
          {groups.due.length && canConfirm ? (
            <AppText variant="caption" color="muted" style={styles.hint}>
              Tap a vaccine to confirm it with the bottles you used.
            </AppText>
          ) : null}
          {section('Upcoming', groups.upcoming, false)}
          {section('Done', groups.done, false)}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.lg },
  hint: { marginTop: Spacing.sm, paddingHorizontal: Spacing.xs },
});
