import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { BatchPicker } from '@/components/ui/batch-picker';
import { HousePicker } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { NumberField } from '@/components/ui/number-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Batch, BatchHouseBalance, House } from '@/lib/types';

type Reason = 'TRANSFER' | 'ADJUSTMENT';

/** docs/PRD.md §6.16. This write decrements/increments BatchHouseBalance
 *  inside a transaction -- a wrong quantity here quietly corrupts every
 *  downstream count, so the source house's live count is shown next to the
 *  field and a quantity over it is confirmed, not silently accepted. */
export default function TransferScreen() {
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [fromBalance, setFromBalance] = useState<BatchHouseBalance | null>(null);
  const [toHouse, setToHouse] = useState<House | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<Reason>('TRANSFER');
  const [submitting, setSubmitting] = useState(false);

  const { data: balances, isLoading: balancesLoading } = useGetData<Paginated<BatchHouseBalance>>(
    batch ? `/batch-house-balances?batch_id=${batch.id}&limit=100` : '',
    ['batch-house-balances', 'by-batch', batch?.id ?? 'none'],
    { enabled: !!batch },
  );

  const occupiedHouses = (balances?.results ?? []).filter((b) => b.quantity > 0);
  const quantityNum = Number(quantity);
  const isValid = !!batch && !!fromBalance && !!toHouse && quantityNum > 0 && Number.isInteger(quantityNum);

  const doSubmit = async () => {
    if (!batch || !fromBalance || !toHouse || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/batch-house-allocations',
        body: {
          batch_id: batch.id,
          from_house_id: fromBalance.house_id,
          to_house_id: toHouse.id,
          quantity: quantityNum,
          reason,
          recorded_by_id: employee.profile.id,
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (fromBalance && quantityNum > fromBalance.quantity) {
      Alert.alert(
        `Move ${quantityNum} birds?`,
        `Only ${fromBalance.quantity.toLocaleString()} are recorded in ${fromBalance.house?.name}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move anyway', style: 'destructive', onPress: doSubmit },
        ],
      );
      return;
    }
    void doSubmit();
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'House transfer' }} />
      <Section label="Batch" />
      <BatchPicker
        value={batch}
        onChange={(b) => {
          setBatch(b);
          setFromBalance(null);
        }}
      />

      <Section label="From" />
      <PickerField
        label="From house"
        value={fromBalance}
        options={occupiedHouses}
        getKey={(b) => b.house_id}
        getLabel={(b) => b.house?.name ?? b.house_id}
        getSubLabel={(b) => `${b.quantity.toLocaleString()} birds`}
        onChange={setFromBalance}
        loading={balancesLoading}
        emptyLabel={batch ? 'This batch has no birds in any house.' : 'Pick a batch first.'}
      />

      <Section label="To" />
      <HousePicker value={toHouse} onChange={setToHouse} />

      <Section label="Detail" />
      <NumberField label="Quantity" value={quantity} onChangeText={setQuantity} unit="birds"  allowDecimal={false} />
      <SegmentedToggle
        options={[
          { value: 'TRANSFER', label: 'Transfer' },
          { value: 'ADJUSTMENT', label: 'Correction' },
        ]}
        value={reason}
        onChange={setReason}
      />

      <SubmitBar label="Record move" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
