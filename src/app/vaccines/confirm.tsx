import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { FormCard } from '@/components/ui/form-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { QrScanner, type ScanLabels, type ScanRow } from '@/components/ui/qr-scanner';
import { OfflineNote } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { ApiError, apiFetch, useGetData } from '@/lib/api';
import { goBack } from '@/lib/nav';
import { scanErrorMessage, type ScanResult } from '@/lib/scan';
import { currentHouseName } from '@/lib/scan-actions';
import type { StockUnit } from '@/lib/types';
import { METHOD_LABEL, amountUnits, type VaccineScheduleRow } from '@/lib/vaccine-schedule';

const LABELS: ScanLabels = {
  done: 'added',
  flashOk: 'Added',
  offlineTitle: 'Confirming a vaccine needs a connection.',
  offlineBody: "Each bottle is checked against the server as you scan, so this screen can't work offline.",
  hint: 'Point the camera at a bottle. Scan every bottle you used for this vaccine.',
  full: '',
};

const BLOCKED: Partial<Record<StockUnit['status'], string>> = {
  UNASSIGNED: 'Not linked to a purchase yet.',
  PRINTED: 'Not linked to a purchase yet.',
  CONSUMED: 'Already used up.',
  DISPOSED: 'Already disposed.',
};

type Bottle = {
  id: string;
  label: string;
  vaccine: string;
  house: string;
  units: string[];
  quantity: string;
  unit: string;
};

type ItemWithUnits = { unit: string; itemUnits?: { unit: string; is_usable: boolean }[] };

const tail = (id: string) => `…${id.slice(-7)}`;

/** Scan the bottles used, say how much of each, then confirm. The server draws every bottle, logs the
 *  vaccination and marks the row done in one go -- there is no separate "record as used" step. */
export default function ConfirmVaccineScreen() {
  const { id, batch_id, house_id } = useLocalSearchParams<{ id: string; batch_id: string; house_id: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;
  // One key per visit: a retry after a lost response returns the same confirmed row instead of drawing twice.
  const [key] = useState(() => Crypto.randomUUID());
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scheduleQ = useGetData<VaccineScheduleRow[]>(`/batch-vaccine-schedules?batch_id=${batch_id}`, [
    'batch-vaccine-schedules',
    batch_id,
  ]);
  const row = scheduleQ.data?.find((r) => r.id === id);
  const purposeLabel = row?.purposeRef.label;
  const houseName = row?.houses.find((h) => h.id === house_id)?.name;

  const onScan = async (code: string): Promise<ScanResult> => {
    if (bottles.some((b) => b.id === code))
      return { ok: false, duplicate: true, message: 'Already added', retryable: false };
    try {
      const unit = await apiFetch<StockUnit>(`/stock-units/${code}`);
      const blocked = BLOCKED[unit.status];
      if (blocked) return { ok: false, message: blocked, retryable: false };
      const item = unit.purchase_item?.item;
      if (!item) return { ok: false, message: 'This bottle has no purchase record.', retryable: false };
      // The row names a purpose, not a product: any vaccine bottle will do. Server checks the same.
      if (item.category !== 'VACCINE') return { ok: false, message: `${item.name} isn't a vaccine.`, retryable: false };
      // A split batch is confirmed house by house: the bottles have to be in this house.
      if (unit.houseAllocations?.[0]?.house_id !== house_id)
        return {
          ok: false,
          message: `In ${currentHouseName(unit)} — move it to ${houseName ?? 'this house'} first.`,
          retryable: false,
        };
      // The units this bottle's amount can be typed in (doses, litres...) come from its own item.
      const units = amountUnits(await apiFetch<ItemWithUnits>(`/items/${item.id}`));
      setBottles((bs) => [
        ...bs,
        {
          id: code,
          label: tail(code),
          vaccine: item.name,
          house: currentHouseName(unit),
          units,
          quantity: '',
          unit: units[0] ?? item.unit,
        },
      ]);
      return { ok: true, label: tail(code) };
    } catch (err) {
      if (err instanceof ApiError)
        return { ok: false, message: scanErrorMessage(err.status, err.message), retryable: err.status === 0 };
      return { ok: false, message: 'Something went wrong.', retryable: true };
    }
  };

  const patch = (bottleId: string, change: Partial<Bottle>) =>
    setBottles((bs) => bs.map((b) => (b.id === bottleId ? { ...b, ...change } : b)));

  const ready = bottles.length > 0 && bottles.every((b) => Number(b.quantity) > 0 && b.unit);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/batch-vaccine-schedules/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: key,
          house_id,
          bottles: bottles.map((b) => ({ stock_unit_id: b.id, quantity: Number(b.quantity), unit: b.unit })),
        }),
      });
      void queryClient.invalidateQueries({ queryKey: ['batch-vaccine-schedules', batch_id] });
      void queryClient.invalidateQueries({ queryKey: ['vaccinations'] });
      void queryClient.invalidateQueries({ queryKey: ['consumptions'] });
      void queryClient.invalidateQueries({ queryKey: ['house-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      goBack();
    } catch (err) {
      Alert.alert("Couldn't confirm", err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const review = () =>
    Alert.alert(
      'Confirm this vaccine?',
      `${purposeLabel ?? ''} · ${houseName ?? ''}\n\n${bottles.map((b) => `${b.vaccine} ${b.label} · ${b.quantity} ${b.unit.toLowerCase()}`).join('\n')}\n\nThese amounts are taken out of stock.`,
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Yes, confirm', onPress: () => void submit() },
      ],
    );

  return (
    <Screen>
      <Header title="Confirm vaccine" leading="back" />

      {scheduleQ.isPending ? (
        <Skeleton height={160} />
      ) : !row ? (
        <AppText color="muted">This vaccine isn&apos;t on the schedule any more.</AppText>
      ) : (
        <View style={styles.form}>
          <FormCard title={row.purposeRef.label}>
            <AppText variant="caption" color="muted">
              {houseName ?? 'This house'} · Day {row.day}
              {row.method ? ` · ${METHOD_LABEL[row.method]}` : ''}
            </AppText>
          </FormCard>

          {bottles.map((b) => (
            <FormCard key={b.id} title={`${b.vaccine} ${b.label}`} hint={b.house}>
              {b.units.length > 1 ? (
                <PillSelect
                  options={b.units.map((u) => ({ value: u, label: u.toLowerCase() }))}
                  value={b.unit}
                  onChange={(u) => patch(b.id, { unit: u })}
                />
              ) : null}
              <NumberField
                label="Amount used"
                value={b.quantity}
                onChangeText={(q) => patch(b.id, { quantity: q })}
                unit={b.unit.toLowerCase()}
              />
              <Button
                variant="ghost"
                label="Remove bottle"
                icon="trash-2"
                onPress={() => setBottles((bs) => bs.filter((x) => x.id !== b.id))}
              />
            </FormCard>
          ))}

          {offline ? (
            <OfflineNote what="Confirming a vaccine" />
          ) : (
            <View style={styles.actions}>
              <Button
                variant={bottles.length ? 'secondary' : 'primary'}
                label={bottles.length ? 'Scan another bottle' : 'Scan bottles'}
                icon="camera"
                onPress={() => setScanning(true)}
                block
              />
              {bottles.length ? (
                <Button
                  label="Confirm"
                  icon="check"
                  disabled={!ready}
                  loading={submitting}
                  onPress={review}
                  block
                />
              ) : (
                <AppText variant="caption" color="muted">
                  Bottles must already be moved into this house.
                </AppText>
              )}
            </View>
          )}
        </View>
      )}

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={purposeLabel ? `${purposeLabel} · ${houseName ?? ''}` : ''}
        onScan={onScan}
        rows={rows}
        onScanned={(r) => setRows((rs) => [r, ...rs])}
        offline={offline}
        labels={LABELS}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  actions: { gap: Spacing.sm },
});
