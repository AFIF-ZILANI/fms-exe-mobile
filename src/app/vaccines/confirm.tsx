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
import { amountUnits, type VaccineScheduleRow } from '@/lib/vaccine-schedule';

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

type Bottle = { id: string; label: string; house: string; quantity: string; unit: string };

const tail = (id: string) => `…${id.slice(-7)}`;

/** Scan the bottles used, say how much of each, then confirm. The server draws every bottle, logs the
 *  vaccination and marks the row done in one go -- there is no separate "record as used" step. */
export default function ConfirmVaccineScreen() {
  const { id, batch_id } = useLocalSearchParams<{ id: string; batch_id: string }>();
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
  const units = row ? amountUnits(row.item) : [];
  const itemId = row?.item_id;
  const itemName = row?.item.name;
  const defaultUnit = units[0] ?? '';

  const onScan = async (code: string): Promise<ScanResult> => {
    if (bottles.some((b) => b.id === code))
      return { ok: false, duplicate: true, message: 'Already added', retryable: false };
    try {
      const unit = await apiFetch<StockUnit>(`/stock-units/${code}`);
      const blocked = BLOCKED[unit.status];
      if (blocked) return { ok: false, message: blocked, retryable: false };
      if (unit.purchase_item?.item_id !== itemId)
        return {
          ok: false,
          message: `Not ${itemName ?? 'this vaccine'} — this is ${unit.purchase_item?.item.name ?? 'another item'}.`,
          retryable: false,
        };
      if (!unit.houseAllocations?.[0]?.house_id)
        return { ok: false, message: 'Still in the warehouse — move it to the house first.', retryable: false };
      setBottles((bs) => [
        ...bs,
        { id: code, label: tail(code), house: currentHouseName(unit), quantity: '', unit: defaultUnit },
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
      `${itemName ?? ''}\n\n${bottles.map((b) => `${b.label} · ${b.quantity} ${b.unit.toLowerCase()}`).join('\n')}\n\nThese amounts are taken out of stock.`,
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
          <FormCard title={row.item.name}>
            <AppText variant="caption" color="muted">
              Day {row.day} · {row.purpose}
              {row.method ? ` · ${row.method}` : ''}
            </AppText>
          </FormCard>

          {bottles.map((b) => (
            <FormCard key={b.id} title={`Bottle ${b.label}`} hint={b.house}>
              {units.length > 1 ? (
                <PillSelect
                  options={units.map((u) => ({ value: u, label: u.toLowerCase() }))}
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
                  Bottles must already be moved into the house.
                </AppText>
              )}
            </View>
          )}
        </View>
      )}

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={itemName ? `Bottles of ${itemName}` : ''}
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
