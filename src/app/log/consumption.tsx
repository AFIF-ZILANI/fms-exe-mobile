import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { ItemPicker } from '@/components/ui/item-picker';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import type { Item } from '@/lib/types';

/** docs/PRD.md §6.8. Items filtered to is_unit_tracked: false -- without QR
 *  in v1 this is the aggregate branch ConsumptionService already supports,
 *  not the coded stock_unit_id draw. */
export default function ConsumptionScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const quantityNum = Number(quantity);
  const isValid = !!house && !!item && quantityNum > 0;

  const handleSubmit = async () => {
    if (!house || !item || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/consumptions',
        body: {
          house_id: house.id,
          item_id: item.id,
          quantity: quantityNum,
          unit: item.unit,
          date: new Date().toISOString(),
          recorded_by_id: employee.profile.id,
          ...(balance && { batch_id: balance.batch_id }),
          ...(note.trim() && { note: note.trim() }),
        },
        taskId: params.task_id,
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Consumption' }} />
      <Section label="House" />
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <Section label="Item" />
      <ItemPicker value={item} onChange={setItem} unitTracked={false} />

      <Section label="Quantity" />
      <NumberField
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        unit={item?.unit}
        required
        autoFocus
      />

      <Section label="Detail" />
      <TextField label="Note" value={note} onChangeText={setNote} multiline />

      <SubmitBar
        label={quantityNum > 0 ? `Record ${quantity} ${item?.unit ?? ''}` : 'Record'}
        onPress={handleSubmit}
        disabled={!isValid}
        loading={submitting}
      />
    </Screen>
  );
}
