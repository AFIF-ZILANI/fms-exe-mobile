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
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch, useGetData } from '@/lib/api';
import { stockLabel, unitsAvailable } from '@/lib/coded-stock';
import { unitUseBody, type Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { HouseCodedStock } from '@/lib/types';

/** start: a sealed unit is opened -- no consumption is logged. finish: it's used up -- what was left in it
 *  is logged as a consumption (the server works out the amount) and it leaves stock. */
type UseAction = 'start' | 'finish';

const OFFLINE = {
  offlineTitle: 'Recording use needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
};
const LABELS: Record<UseAction, ScanLabels> = {
  start: {
    ...OFFLINE,
    done: 'started',
    flashOk: 'Started',
    hint: 'Point the camera at a code. The camera stays open — scan every unit you opened.',
    full: 'Nothing sealed left in this house',
  },
  finish: {
    ...OFFLINE,
    done: 'used up',
    flashOk: 'Used up',
    hint: 'Point the camera at a code. The camera stays open — scan every unit that is finished.',
    full: 'Nothing left in this house to use up',
  },
};

/** docs/scan-flows-design.md — a coded unit is used where it is: it has to be in this house (moved here
 *  first), one scan = one unit. "Start using" opens it; "Consumed" logs it used up. Choosing an item
 *  accepts only that item's codes; no item accepts any. The item list is what is in the house right now. */
export default function ConsumeScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [action, setAction] = useState<UseAction>('start');
  const [item, setItem] = useState<HouseCodedStock | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const { balance, isLoading: batchLoading } = useResolvedBatch(house?.id);

  // Coded units physically in this house, per item: sealed ones to start, plus opened ones when finishing.
  // Its key sits under 'house-stock', which every successful scan invalidates, so the amounts fall as you go.
  const stockQ = useGetData<HouseCodedStock[]>(
    house ? `/houses/${house.id}/coded-stock${action === 'finish' ? '?include_in_use=true' : ''}` : '',
    ['house-stock', 'available', house?.id ?? 'none', action],
    { enabled: !!house },
  );
  const stock = stockQ.data ?? [];
  const stockLoading = !!house && stockQ.isPending;
  const available = unitsAvailable(stock, item?.item_id);
  const nothingHere = !!house && !stockLoading && stock.length === 0;

  const session = useScanSession({
    plan: {
      action,
      houseId: house?.id,
      houseName: house?.name,
      itemId: item?.item_id,
      itemName: item?.item_name,
    },
    mode,
    confirmLabel: action === 'start' ? 'Start using' : 'Record as used up',
    treatReplayAsDone: true,
    commit: async (unit, key) => {
      if (!house) throw new Error('No house chosen');
      await apiFetch(`/stock-units/${unit.id}/use`, {
        method: 'POST',
        body: JSON.stringify(unitUseBody(action, { houseId: house.id, batchId: balance?.batch_id, now: new Date(), key })),
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
        <FormCard title="What happened">
          <SegmentedToggle
            height={48}
            options={[
              { value: 'start', label: 'Start using' },
              { value: 'finish', label: 'Consumed' },
            ]}
            value={action}
            onChange={(a) => {
              setAction(a);
              // The two accept different units (sealed vs sealed + opened), so start a fresh list.
              setItem(null);
              session.reset();
            }}
          />
          <AppText variant="caption" color="muted">
            {action === 'start'
              ? 'Opening a sealed unit. Nothing is logged as used yet.'
              : 'The unit is finished. What was left in it is logged as used for this house.'}
          </AppText>
        </FormCard>

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
            getSubLabel={(l) => (l.in_use ? `${stockLabel(l)} · ${l.in_use} open` : stockLabel(l))}
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
                  Choose the house first, then scan the units.
                </AppText>
              ) : null}
            </>
          )}
        </View>
      )}

      <ScanResults rows={session.rows} done={LABELS[action].done} />

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
        labels={LABELS[action]}
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
