import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';

import { FormCard } from '@/components/ui/form-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
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
  full: '',
};

const RETURN_LABELS: ScanLabels = {
  ...LABELS,
  done: 'returned',
  flashOk: 'Returned',
  hint: 'Point the camera at a code. The camera stays open — scan every unit going back to the warehouse.',
};

type Dest = 'house' | 'warehouse';

/** docs/scan-flows-design.md — plan first (which house, or back to the warehouse), then scan units.
 *  A return lands in the warehouse the unit's lot was bought into (server-side), so there is no warehouse to pick. */
export default function AllocateScreen() {
  const params = useLocalSearchParams<{ house_id?: string; to?: string }>();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [dest, setDest] = useState<Dest>(params.to === 'warehouse' ? 'warehouse' : 'house');
  const toWarehouse = dest === 'warehouse';
  const ready = toWarehouse || !!house;
  const [scanning, setScanning] = useState(false);

  const session = useScanSession({
    plan: toWarehouse
      ? { action: 'return', itemId: item?.id, itemName: item?.name }
      : { action: 'allocate', houseId: house?.id, itemId: item?.id, itemName: item?.name },
    mode,
    confirmLabel: toWarehouse ? 'Return to warehouse' : house ? `Move to ${house.name}` : 'Move',
    commit: async (unit, key) => {
      if (!toWarehouse && !house) throw new Error('No house chosen');
      await apiFetch(`/stock-units/${unit.id}/relocate`, {
        method: 'POST',
        // null house = back to the warehouse (a RETURN)
        body: JSON.stringify({ house_id: toWarehouse ? null : house!.id, idempotency_key: key }),
      });
    },
    // The house screen's Allocated stock card and its full page, still mounted behind this one.
    refresh: { after: [['stock-units'], ['house-stock']] },
  });

  return (
    <Screen>
      <Header title={toWarehouse ? 'Return to warehouse' : 'Move to house'} leading="back" />

      <View style={styles.form}>
        <FormCard>
          <SegmentedToggle
            height={48}
            options={[
              { value: 'house', label: 'To a house' },
              { value: 'warehouse', label: 'To warehouse' },
            ]}
            value={dest}
            onChange={(d) => {
              setDest(d);
              session.reset();
            }}
          />
          {toWarehouse ? (
            <AppText variant="caption" color="muted">
              Units from any house go back to the warehouse they were bought into. Opened bottles go back with what is left in them.
            </AppText>
          ) : (
            <HousePicker
              label="Move into"
              value={house}
              onChange={(h) => {
                setHouse(h);
                session.reset();
              }}
            />
          )}
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
        <OfflineNote what={toWarehouse ? 'Returning' : 'Moving'} />
      ) : (
        <View style={styles.actions}>
          <Button label="Scan codes" icon="camera" disabled={!ready} onPress={() => setScanning(true)} />
          {!ready ? (
            <AppText variant="caption" color="muted" style={styles.hint}>
              Choose the house first, then scan the units going into it.
            </AppText>
          ) : null}
        </View>
      )}

      <ScanResults rows={session.rows} done={toWarehouse ? 'returned' : 'moved'} />

      <QrScanner
        key={session.generation}
        open={scanning}
        onClose={() => {
          session.close();
          setScanning(false);
        }}
        context={toWarehouse ? 'Back to the warehouse' : house ? `Into ${house.name}` : ''}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        offline={offline}
        labels={toWarehouse ? RETURN_LABELS : LABELS}
        pending={session.pending}
        parallel={session.parallel}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, marginTop: Spacing.xs },
  actions: { marginTop: Spacing.lg, gap: Spacing.sm },
  hint: { textAlign: 'center' },
});
