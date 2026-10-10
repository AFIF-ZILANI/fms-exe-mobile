import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { FormCard } from '@/components/ui/form-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { ItemPicker } from '@/components/ui/item-picker';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { Item } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'moved',
  flashOk: 'Moved',
  offlineTitle: 'Moving needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan every unit going into this house.',
};

/** docs/scan-flows-design.md — plan first (which house), then scan units into it. */
export default function AllocateScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const session = useScanSession({
    plan: { action: 'allocate', houseId: house?.id, itemId: item?.id, itemName: item?.name },
    mode,
    confirmLabel: house ? `Move to ${house.name}` : 'Move',
    commit: async (unit, key) => {
      if (!house) throw new Error('No house chosen');
      await apiFetch(`/stock-units/${unit.id}/relocate`, {
        method: 'POST',
        body: JSON.stringify({ house_id: house.id, idempotency_key: key }),
      });
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    },
  });

  return (
    <Screen>
      <Header title="Move to house" leading="back" />

      <View style={styles.form}>
        <FormCard>
          <HousePicker
            label="Move into"
            value={house}
            onChange={(h) => {
              setHouse(h);
              session.reset();
            }}
          />
        </FormCard>

        <FormCard title="Which units" hint="Optional">
          <ItemPicker
            unitTracked
            value={item}
            placeholder="Any item"
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
        <OfflineNote what="Moving" />
      ) : (
        <View style={styles.actions}>
          <Button label="Scan codes" icon="camera" disabled={!house} onPress={() => setScanning(true)} />
        </View>
      )}

      <ScanResults rows={session.rows} done="moved" />

      <QrScanner
        key={session.generation}
        open={scanning}
        onClose={() => {
          session.close();
          setScanning(false);
        }}
        context={house ? `Into ${house.name}` : ''}
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
