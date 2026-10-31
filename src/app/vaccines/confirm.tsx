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
import { TextField } from '@/components/ui/text-field';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { QrScanner, type ScanLabels, type ScanRow } from '@/components/ui/qr-scanner';
import { OfflineNote } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { ApiError, apiFetch, useGetData } from '@/lib/api';
import { goBack } from '@/lib/nav';
import { isStockCode, scanErrorMessage, type ScanResult } from '@/lib/scan';
import type { StockUnit } from '@/lib/types';
import { METHOD_LABEL, bottleProblem, type VaccineScheduleRow } from '@/lib/vaccine-schedule';

const LABELS: ScanLabels = {
  done: 'added',
  flashOk: 'Added',
  offlineTitle: 'Confirming a vaccine needs a connection.',
  offlineBody: "Each bottle is checked against the server as you scan, so this screen can't work offline.",
  hint: 'Point the camera at a bottle. Scan every bottle you used for this vaccine.',
  full: '',
};

type Bottle = { id: string; label: string; vaccine: string };

const tail = (id: string) => `…${id.slice(-7)}`;

/** Scan (or type) the bottles used, then confirm. Each bottle counts as used up: the server records whatever
 *  was left in it, logs the vaccination and marks this house confirmed in one go -- nobody types an amount,
 *  and there is no separate "record as used" step. */
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
  // Typed codes, for a label the camera can't read.
  const [typed, setTyped] = useState('');
  const [typedNote, setTypedNote] = useState<{ ok: boolean; text: string } | null>(null);

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
      const problem = bottleProblem(unit, house_id, houseName ?? 'this house');
      if (problem) return { ok: false, message: problem, retryable: false };
      setBottles((bs) => [...bs, { id: code, label: tail(code), vaccine: unit.purchase_item?.item.name ?? '' }]);
      return { ok: true, label: tail(code) };
    } catch (err) {
      if (err instanceof ApiError)
        return { ok: false, message: scanErrorMessage(err.status, err.message), retryable: err.status === 0 };
      return { ok: false, message: 'Something went wrong.', retryable: true };
    }
  };

  const addTyped = async () => {
    const code = typed.trim().toLowerCase();
    if (!isStockCode(code)) return setTypedNote({ ok: false, text: "That isn't a bottle code — check it and try again." });
    const result = await onScan(code);
    if ('held' in result) return;
    if (result.ok) setTyped('');
    setTypedNote(result.ok ? { ok: true, text: `Added ${tail(code)}` } : { ok: false, text: result.message });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/batch-vaccine-schedules/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: key,
          house_id,
          bottles: bottles.map((b) => ({ stock_unit_id: b.id })),
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
      `${purposeLabel ?? ''} · ${houseName ?? ''}\n\n${bottles.map((b) => `${b.vaccine} ${b.label}`).join('\n')}\n\n${bottles.length === 1 ? 'This bottle is' : `These ${bottles.length} bottles are`} recorded as used up — everything left in them comes out of stock.`,
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

          {bottles.length ? (
            <FormCard title={`${bottles.length} bottle${bottles.length === 1 ? '' : 's'}`} hint="Used up">
              {bottles.map((b) => (
                <View key={b.id} style={styles.bottle}>
                  <AppText style={styles.bottleName}>
                    {b.vaccine} {b.label}
                  </AppText>
                  <Button
                    variant="ghost"
                    label="Remove"
                    icon="trash-2"
                    onPress={() => setBottles((bs) => bs.filter((x) => x.id !== b.id))}
                  />
                </View>
              ))}
            </FormCard>
          ) : null}

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
              <FormCard title="Can't scan it?" hint="Type the code">
                <TextField
                  label="Bottle code"
                  value={typed}
                  onChangeText={(t) => {
                    setTyped(t);
                    setTypedNote(null);
                  }}
                  placeholder="e.g. 3f2a9c1e-…"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {typedNote ? (
                  <AppText variant="caption" color={typedNote.ok ? 'success' : 'critical'}>
                    {typedNote.text}
                  </AppText>
                ) : null}
                <Button variant="secondary" label="Add bottle" icon="plus" disabled={!typed.trim()} onPress={() => void addTyped()} />
              </FormCard>
              {bottles.length ? (
                <Button
                  label="Confirm"
                  icon="check"
                  disabled={bottles.length === 0}
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
  bottle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  bottleName: { flex: 1 },
});
