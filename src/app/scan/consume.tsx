import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { FormCard } from '@/components/ui/form-card';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { PickerField } from '@/components/ui/picker-field';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch, useGetData } from '@/lib/api';
import { stockLabel, unitsAvailable } from '@/lib/coded-stock';
import { consumptionBody, type Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { HouseCodedStock } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'used',
  flashOk: 'Used',
  offlineTitle: 'Recording use needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan every unit you used.',
  full: 'Nothing left in this house to use',
};

/** docs/scan-flows-design.md — a coded unit is used whole, and where it is: it has to be in this house
 *  (moved here first), one scan = one unit used. The item list is what is in the house right now. */
export default function ConsumeScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<HouseCodedStock | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const { balance, isLoading: batchLoading } = useResolvedBatch(house?.id);

  // Unused coded units physically in this house, per item. Its key sits under 'house-stock', which every
  // successful scan invalidates, so the amounts here fall as units are used.
  const stockQ = useGetData<HouseCodedStock[]>(
    house ? `/houses/${house.id}/coded-stock` : '',
    ['house-stock', 'available', house?.id ?? 'none'],
    { enabled: !!house },
  );
  const stock = stockQ.data ?? [];
  const stockLoading = !!house && stockQ.isPending;
  const available = unitsAvailable(stock, item?.item_id);
  const nothingHere = !!house && !stockLoading && stock.length === 0;

  const session = useScanSession({
    plan: {
      action: 'consume',
      houseId: house?.id,
      houseName: house?.name,
      itemId: item?.item_id,
      itemName: item?.item_name,
    },
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
      // The Stock tab's levels are still mounted behind this screen.
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      // Awaited, and it covers this house's available list and the house screen's Used stock card and page:
      // the scanner takes one code at a time, so the next one is judged against the updated count.
      await queryClient.invalidateQueries({ queryKey: ['house-stock'] });
    },
  });

  // The last unit used: close the camera after a beat, so the flash and the sound land first.
  useEffect(() => {
    if (!scanning || !house || stockQ.isFetching || available > 0) return;
    const t = setTimeout(() => {
      session.close();
      setScanning(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [scanning, house, stockQ.isFetching, available, session]);

  const canScan = !!house && !batchLoading && !stockLoading && available > 0;

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
              // What is in stock is per house, so a chosen item may not exist in the new one.
              setItem(null);
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
          <PickerField
            label="Item"
            value={item}
            options={stock}
            getKey={(l) => l.item_id}
            getLabel={(l) => l.item_name}
            getSubLabel={stockLabel}
            placeholder="Any item"
            loading={stockLoading}
            disabled={!house}
            emptyLabel={`Nothing is in ${house?.name ?? 'this house'} yet. Move items here first.`}
            helper={house ? undefined : 'Choose a house first.'}
            onChange={(l) => {
              setItem(l);
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
          {nothingHere ? (
            <FormCard>
              <AppText variant="bodyStrong">Nothing to use in {house.name} yet.</AppText>
              <AppText variant="caption" color="muted">
                A unit has to be moved into the house before it can be used there.
              </AppText>
              <Button
                variant="secondary"
                label="Move items here"
                icon="arrow-right"
                onPress={() => router.push(`/scan/allocate?house_id=${house.id}` as Href)}
                block
              />
            </FormCard>
          ) : (
            <>
              <Button label="Scan codes" icon="camera" disabled={!canScan} onPress={() => setScanning(true)} />
              {!house ? (
                <AppText variant="caption" color="muted" style={styles.hint}>
                  Choose the house first, then scan the units you used.
                </AppText>
              ) : null}
            </>
          )}
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
        remaining={house ? available : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, marginTop: Spacing.xs },
  actions: { marginTop: Spacing.lg, gap: Spacing.sm },
  hint: { textAlign: 'center' },
});
