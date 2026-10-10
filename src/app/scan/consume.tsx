import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { FormCard } from '@/components/ui/form-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { ItemPicker } from '@/components/ui/item-picker';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { consumptionBody, type Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { Item } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'used',
  flashOk: 'Used',
  offlineTitle: 'Recording use needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan every unit you used.',
};

/** docs/scan-flows-design.md — a coded unit is used whole: no quantity, one scan = one unit used. */
export default function ConsumeScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const { balance, isLoading: batchLoading } = useResolvedBatch(house?.id);

  const session = useScanSession({
    plan: { action: 'consume', houseId: house?.id, itemId: item?.id, itemName: item?.name },
    mode,
    confirmLabel: 'Record as used',
    treatReplayAsDone: true,
    commit: async (unit, key) => {
      if (!house) throw new Error('No house chosen');
      await apiFetch('/consumptions', {
        method: 'POST',
        body: JSON.stringify(
          consumptionBody(unit, {
            houseId: house.id,
            batchId: balance?.batch_id,
            now: new Date(),
            key,
          }),
        ),
      });
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
      void queryClient.invalidateQueries({ queryKey: ['consumptions'] });
    },
  });

  return (
    <Screen>
      <Header title="Use an item" leading="back" />

      <View style={styles.form}>
        <FormCard>
          <HousePicker
            label="Used in"
            value={house}
            onChange={(h) => {
              setHouse(h);
              session.reset();
            }}
          />
          <BatchResolver houseId={house?.id} />
          {house && !batchLoading && !balance ? (
            <AppText variant="caption" color="muted">
              Will be saved without a batch.
            </AppText>
          ) : null}
        </FormCard>

        <FormCard title="Which units" hint="Optional">
          <ItemPicker
            unitTracked
            value={item}
            onChange={(i) => {
              setItem(i);
              session.reset();
            }}
            onClear={() => {
              setItem(null);
              session.reset();
            }}
          />
          <ScanModeField value={mode} onChange={setMode} />
        </FormCard>
      </View>

      {offline ? (
        <OfflineNote what="Recording use" />
      ) : (
        <View style={styles.actions}>
          <Button label="Scan codes" icon="camera" disabled={!house || batchLoading} onPress={() => setScanning(true)} />
        </View>
      )}

      <ScanResults rows={session.rows} done="used" />

      <QrScanner
        key={session.generation}
        open={scanning}
        onClose={() => {
          session.close();
          setScanning(false);
        }}
        context={house ? `Used in ${house.name}` : ''}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        offline={offline}
        labels={LABELS}
        pending={session.pending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, marginTop: Spacing.xs },
  actions: { marginTop: Spacing.lg },
});
