import { RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useGetData } from '@/lib/api';
import { dayOfCycle } from '@/lib/farm';
import { formatBatchCode } from '@/lib/format';
import type { Batch } from '@/lib/types';
import { METHOD_LABEL, canConfirm, rowState, type VaccineScheduleRow } from '@/lib/vaccine-schedule';

const STATE_LABEL = {
  UPCOMING: 'Upcoming',
  DUE_TODAY: 'Due today',
  OVERDUE: 'Overdue',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
} as const;

/** docs/superpowers/specs/2026-10-31-vaccine-schedule-design.md — the batch's vaccine plan, read-only.
 *  The only action is Confirm on a row that is due or overdue; planning changes are made on the web. */
export default function VaccineScheduleScreen() {
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

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={rowsQ.isRefetching}
          onRefresh={() => void Promise.all([rowsQ.refetch(), batchQ.refetch()])}
        />
      }
    >
      <Header
        title="Vaccines"
        eyebrow={batch ? `${formatBatchCode(batch.batch_code, batch.id)} · Day ${today}` : undefined}
        leading="back"
      />

      {rowsQ.isPending || batchQ.isPending ? (
        <Skeleton height={200} />
      ) : rowsQ.isError || !batch ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load the vaccine schedule."
            action={{ label: 'Retry', onPress: () => void Promise.all([rowsQ.refetch(), batchQ.refetch()]) }}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState compact icon="calendar" tint="surfaceAlt" title="No vaccine schedule for this batch yet." />
        </Card>
      ) : (
        <Card rows>
          {rows.map((row, i) => {
            const state = rowState(row, today);
            const moved = row.day !== row.planned_day;
            const here = row.houses.find((h) => h.id === house_id);
            const housesDone = row.houses.filter((h) => h.confirm).length;
            const detail = [
              row.method ? METHOD_LABEL[row.method] : null,
              moved ? `planned Day ${row.planned_day}` : null,
              row.status === 'PENDING' && row.houses.length > 1 ? `${housesDone} of ${row.houses.length} houses done` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <LedgerRow key={row.id} gutter={`D${row.day}`} gutterWidth={52} last={i === rows.length - 1}>
                <View style={styles.title}>
                  <AppText variant="bodyStrong" style={state === 'CANCELLED' ? styles.struck : undefined}>
                    {row.purposeRef.label}
                  </AppText>
                  <StatusPill status={state === 'DUE_TODAY' ? 'PENDING' : state} label={STATE_LABEL[state]} />
                </View>
                {detail ? (
                  <AppText variant="caption" color="muted">
                    {detail}
                  </AppText>
                ) : null}
                {row.reason ? (
                  <AppText variant="caption" color="muted">
                    {row.reason}
                  </AppText>
                ) : null}
                {row.status === 'DONE' ? (
                  <AppText variant="caption" color="muted">
                    {row.confirmed_by?.name ?? 'Confirmed'} · {[...new Set(row.vaccinations.map((v) => v.vaccine_name))].join(', ')}
                  </AppText>
                ) : null}
                {row.status === 'PENDING' && here?.confirm ? (
                  <AppText variant="caption" color="muted">
                    {here.name} done · {here.confirm.confirmed_by.name}
                  </AppText>
                ) : batch.status === 'RUNNING' && canConfirm(state, row, house_id) ? (
                  <View style={styles.action}>
                    <Button
                      label="Confirm"
                      icon="check"
                      variant="secondary"
                      onPress={() =>
                        router.push(`/vaccines/confirm?id=${row.id}&batch_id=${batchId}&house_id=${house_id}` as Href)
                      }
                    />
                  </View>
                ) : state === 'UPCOMING' ? (
                  <AppText variant="caption" color="muted">
                    Opens on Day {row.day}
                  </AppText>
                ) : null}
              </LedgerRow>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  action: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
});
