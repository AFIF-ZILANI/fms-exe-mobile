import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { FormScreen } from '@/components/ui/form-screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { QrScanner, type ScanLabels, type ScanRow } from '@/components/ui/qr-scanner';
import { OfflineNote } from '@/components/scan-parts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const [typing, setTyping] = useState(false);
  const theme = useTheme();

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

  // Named once per product, not once per bottle: three bottles of one vaccine read as one line.
  const byProduct = [...new Set(bottles.map((b) => b.vaccine))].map((name) => ({
    name,
    codes: bottles.filter((b) => b.vaccine === name),
  }));
  const count = `${bottles.length} bottle${bottles.length === 1 ? '' : 's'}`;

  const review = () =>
    Alert.alert(
      `Confirm ${purposeLabel ?? 'this vaccine'} in ${houseName ?? 'this house'}?`,
      `${byProduct.map((p) => `${p.name} × ${p.codes.length}`).join('\n')}\n\n${
        bottles.length === 1 ? 'The bottle is' : `All ${bottles.length} bottles are`
      } recorded as used up.`,
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Confirm', onPress: () => void submit() },
      ],
    );

  return (
    <FormScreen
      title="Confirm vaccine"
      hint={row ? [row.purposeRef.label, houseName, `Day ${row.day}`, row.method ? METHOD_LABEL[row.method] : null].filter(Boolean).join(' · ') : undefined}
      dirty={bottles.length > 0}
      submit={{
        label: bottles.length ? `Confirm · ${count} used` : 'Scan a bottle first',
        onPress: review,
        disabled: !row || bottles.length === 0 || offline,
        loading: submitting,
      }}
    >
      {scheduleQ.isPending ? (
        <Skeleton height={160} />
      ) : !row ? (
        <Card>
          <EmptyState compact icon="alert-circle" tint="surfaceAlt" title="This vaccine isn't on the schedule any more." />
        </Card>
      ) : (
        <>
          {offline ? <OfflineNote what="Confirming a vaccine" /> : null}

          <Card rows eyebrow="Bottles used" note={bottles.length ? String(bottles.length) : undefined}>
            {bottles.length === 0 ? (
              <EmptyState
                compact
                icon="camera"
                tint="surfaceAlt"
                title="No bottles yet."
                body="Scan each bottle you used. Each one is recorded as used up."
              />
            ) : (
              byProduct.map((p, gi) => (
                <View key={p.name} style={[styles.group, gi > 0 && { borderTopColor: theme.line, borderTopWidth: 1 }]}>
                  <AppText variant="bodyStrong" numberOfLines={2} style={styles.product}>
                    {p.name}
                  </AppText>
                  {p.codes.map((b) => (
                    <View key={b.id} style={[styles.code, { borderTopColor: theme.line }]}>
                      <AppText variant="data" style={styles.flex}>
                        {b.label}
                      </AppText>
                      <Pressable
                        onPress={() => setBottles((bs) => bs.filter((x) => x.id !== b.id))}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove bottle ${b.label}`}
                        hitSlop={Spacing.xs}
                        style={({ pressed }) => [styles.remove, pressed && { backgroundColor: theme.surfaceAlt }]}
                      >
                        <Icon name="x" size={20} color="muted" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}
          </Card>

          {offline ? null : (
            <View style={styles.actions}>
              <Button
                variant="secondary"
                label={bottles.length ? 'Scan another bottle' : 'Scan bottles'}
                icon="camera"
                onPress={() => setScanning(true)}
                block
              />
              {typing ? (
                <Card style={styles.typed}>
                  <TextField
                    label="Bottle code"
                    value={typed}
                    onChangeText={(t) => {
                      setTyped(t);
                      setTypedNote(null);
                    }}
                    placeholder="The code printed under the QR"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  {typedNote ? (
                    <AppText variant="caption" color={typedNote.ok ? 'success' : 'critical'}>
                      {typedNote.text}
                    </AppText>
                  ) : null}
                  <Button variant="secondary" label="Add bottle" disabled={!typed.trim()} onPress={() => void addTyped()} block />
                </Card>
              ) : (
                <Button variant="ghost" label="Type a code instead" onPress={() => setTyping(true)} />
              )}
            </View>
          )}
        </>
      )}

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={[purposeLabel, houseName].filter(Boolean).join(' · ')}
        onScan={onScan}
        rows={rows}
        onScanned={(r) => setRows((rs) => [r, ...rs])}
        offline={offline}
        labels={LABELS}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { paddingTop: Spacing.md },
  product: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    borderTopWidth: 1,
  },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control },
  actions: { gap: Spacing.sm },
  typed: { gap: Spacing.md },
});
