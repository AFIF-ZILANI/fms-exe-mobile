import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { ItemPicker } from '@/components/ui/item-picker';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import type { Item } from '@/lib/types';
import { goBack } from '@/lib/nav';

/** docs/layout/08-log-consumption.md. Items filtered to is_unit_tracked:false
 *  — without QR in v1 this is the aggregate branch ConsumptionService already
 *  supports, not the coded stock_unit_id draw. */
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
          ...(balance && { batch_id: balance.batch_id }),
          ...(note.trim() && { note: note.trim() }),
        },
        taskId: params.task_id,
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      title="Log feed"
      dirty={!!item || !!quantity || !!note}
      submit={{
        label:
          quantityNum > 0 && item
            ? `Record ${quantity} ${item.unit} ${item.name.toLowerCase()}`
            : 'Record feed',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <ItemPicker value={item} onChange={setItem} unitTracked={false} />

      {/* No steppers: feed quantities are typed, not nudged, and a stepper on
          a decimal field is a mis-tap generator. The unit follows the item —
          leaving "kg" selected after switching to a piece-counted supply
          writes a quantity wrong by three orders of magnitude. */}
      <NumberField
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        unit={item?.unit}
        autoFocus={!!params.house_id}
      />

      <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
    </FormScreen>
  );
}
