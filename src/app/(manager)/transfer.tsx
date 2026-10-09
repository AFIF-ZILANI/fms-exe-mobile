import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';

import { FormScreen } from '@/components/ui/form-screen';
import { BatchPicker } from '@/components/ui/batch-picker';
import { HousePicker } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { NumberField } from '@/components/ui/number-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Batch, BatchHouseBalance, House } from '@/lib/types';
import { goBack } from '@/lib/nav';

type Reason = 'TRANSFER' | 'ADJUSTMENT';

/**
 * docs/layout/16-house-transfer.md. This write decrements/increments
 * BatchHouseBalance inside a transaction — a wrong quantity quietly corrupts
 * every downstream count, so the source house's live count sits beside the
 * field and the resulting balance is restated in the confirm.
 *
 * ponytail: an over-count warns and confirms rather than hard-blocking. The
 * blueprint argued for a block, but the app's own rule is that a real event
 * must always be recordable, and a manager correcting an under-recorded count
 * legitimately needs to exceed the stored balance. Revisit if counts drift.
 *
 * INITIAL is set by BatchService.create and is not client-choosable, so it
 * never appears in the reason toggle.
 */
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
  const isValid =
    !!batch && !!fromBalance && !!toHouse && quantityNum > 0 && Number.isInteger(quantityNum);
  const overCount = !!fromBalance && quantityNum > fromBalance.quantity;

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
        },
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    // The dialog states the resulting balance, not just the quantity: "Move
    // 500" is easy to approve, "House 2 will have 4,312" is what gets checked.
    const remaining = fromBalance ? fromBalance.quantity - quantityNum : 0;
    Alert.alert(
      `Move ${quantityNum.toLocaleString()} birds?`,
      overCount
        ? `Only ${fromBalance?.quantity.toLocaleString()} are recorded in ${fromBalance?.house?.name}. This would leave ${remaining.toLocaleString()}.`
        : `${fromBalance?.house?.name} will have ${remaining.toLocaleString()}. This can't be undone — a mistake needs a second, offsetting move.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move', style: overCount ? 'destructive' : 'default', onPress: doSubmit },
      ],
    );
  };

  return (
    <FormScreen
      title="Move birds"
      dirty={!!batch || !!quantity}
      submit={{
        label:
          quantityNum > 0
            ? `Move ${quantityNum.toLocaleString()} birds`
            : reason === 'TRANSFER'
              ? 'Move birds'
              : 'Record correction',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Reason
        </AppText>
        <SegmentedToggle
          height={48}
          options={[
            { value: 'TRANSFER', label: 'Transfer' },
            { value: 'ADJUSTMENT', label: 'Correction' },
          ]}
          value={reason}
          onChange={setReason}
        />
      </View>

      <BatchPicker
        value={batch}
        onChange={(b) => {
          setBatch(b);
          // The house list below is scoped to houses this batch occupies.
          setFromBalance(null);
        }}
      />

      <PickerField
        label="From"
        value={fromBalance}
        options={occupiedHouses}
        getKey={(b) => b.house_id}
        getLabel={(b) => b.house?.name ?? b.house_id}
        getSubLabel={(b) => `${b.quantity.toLocaleString()} birds`}
        onChange={setFromBalance}
        loading={balancesLoading}
        emptyLabel={batch ? 'This batch has no birds in any house.' : 'Pick a batch first.'}
      />

      <View style={styles.arrow}>
        <Icon name="arrow-down" size={24} color="muted" />
      </View>

      <HousePicker value={toHouse} onChange={setToHouse} label="To" />

      <NumberField
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        unit="birds"
        allowDecimal={false}
        warn={overCount}
        helper={
          !fromBalance || quantityNum <= 0
            ? undefined
            : overCount
              ? `${fromBalance.house?.name} only has ${fromBalance.quantity.toLocaleString()}.`
              : `${fromBalance.house?.name} keeps ${(fromBalance.quantity - quantityNum).toLocaleString()}`
        }
        helperColor={overCount ? 'critical' : 'muted'}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  arrow: { alignItems: 'center', marginVertical: -Spacing.sm },
});
