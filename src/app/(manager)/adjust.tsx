import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { ItemPicker } from '@/components/ui/item-picker';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { Reading } from '@/components/ui/reading';
import { AppText } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Item, StockByLocation, Warehouse } from '@/lib/types';

type LocationKind = 'warehouse' | 'house';

/** docs/PRD.md §6.19. The server takes quantity_before/quantity_after and
 *  derives the delta itself -- shown here before submit so the manager sees
 *  exactly what they're asserting. */
export default function AdjustScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [item, setItem] = useState<Item | null>(null);
  const [kind, setKind] = useState<LocationKind>(params.house_id ? 'house' : 'warehouse');
  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: warehouses, isLoading: warehousesLoading } = useGetData<Paginated<Warehouse>>(
    '/warehouses?limit=100',
    ['warehouses'],
  );
  const { data: stock } = useGetData<StockByLocation[]>('/items/stock-by-location', [
    'items',
    'stock-by-location',
  ]);

  const locationId = kind === 'house' ? house?.id : warehouse?.id;
  const onRecord = Number(
    stock?.find(
      (s) =>
        s.item_id === item?.id &&
        s.location_id === locationId &&
        s.location_type === (kind === 'house' ? 'HOUSE' : 'WAREHOUSE'),
    )?.balance ?? 0,
  );

  const countedNum = Number(counted);
  const delta = countedNum - onRecord;
  const isValid =
    !!item && !!locationId && counted.trim() !== '' && Number.isFinite(countedNum) && reason.trim() !== '';

  const handleSubmit = async () => {
    if (!item || !locationId || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/inventory-adjustments',
        body: {
          item_id: item.id,
          ...(kind === 'house' ? { house_id: locationId } : { warehouse_id: locationId }),
          quantity_before: onRecord,
          quantity_after: countedNum,
          reason: reason.trim(),
          recorded_by_id: employee.profile.id,
          ...(note.trim() && { note: note.trim() }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Stock discrepancy' }} />
      <Section label="Item" />
      <ItemPicker value={item} onChange={setItem} />

      <Section label="Where" />
      <SegmentedToggle
        options={[
          { value: 'warehouse', label: 'Warehouse' },
          { value: 'house', label: 'House' },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === 'house' ? (
        <HousePicker value={house} onChange={setHouse} />
      ) : (
        <PickerField
          label="Warehouse"
          value={warehouse}
          options={warehouses?.results ?? []}
          getKey={(w) => w.id}
          getLabel={(w) => w.name}
          onChange={setWarehouse}
          loading={warehousesLoading}
          emptyLabel="No warehouses."
        />
      )}

      <Section label="Count" />
      <View style={{ gap: 4 }}>
        <AppText variant="label" color="muted">
          On record
        </AppText>
        <AppText variant="figure" color="muted">
          {onRecord.toLocaleString()} {item?.unit ?? ''}
        </AppText>
      </View>
      <NumberField label="Counted" value={counted} onChangeText={setCounted} unit={item?.unit}  />

      {item && counted.trim() !== '' && Number.isFinite(countedNum) && (
        <View style={{ marginTop: 8 }}>
          <Reading
            value={`${delta > 0 ? '+' : ''}${delta.toLocaleString()}`}
            label="Difference"
            color={delta === 0 ? 'muted' : delta > 0 ? 'success' : 'critical'}
          />
        </View>
      )}

      <Section label="Why" />
      <TextField label="Reason" value={reason} onChangeText={setReason}  />
      <TextField label="Note" value={note} onChangeText={setNote} multiline />

      <SubmitBar label="Report discrepancy" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
