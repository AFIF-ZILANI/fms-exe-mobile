import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { PickerField } from '@/components/ui/picker-field';
import { useHouseSupplies } from '@/components/house-stock';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { bagSize, formatBalance, formatStock, usableUnits } from '@/lib/stock-summary';
import type { HouseSupply } from '@/lib/house-stock';
import { humanise } from '@/lib/profile-format';
import { goBack } from '@/lib/nav';

/**
 * "Use supplies": feed, husk and any other item without QR codes, used up in a house. One POST /consumptions
 * without stock_unit_id (the aggregate branch of ConsumptionService); coded items are used by scan instead
 * (scan/consume.tsx). Quantity can be typed in any usable unit (bags, not just kg); the server converts it
 * to Item.unit, and the house can only use what was moved into it, so that is checked here in the base unit.
 */
export default function UseSuppliesScreen() {
  const params = useLocalSearchParams<{ house_id?: string; item_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [picked, setPicked] = useState<{ houseId: string; itemId: string } | null>(null);
  const [unitCode, setUnitCode] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  // Only what this house holds: items without codes, moved in, not chicks. Same queries as the house page.
  const houseStock = useHouseSupplies(house?.id ?? '');
  const supplies = house ? (houseStock.supplies ?? []) : [];
  // Opened from a house's supplies list the item comes pre-chosen. A pick made for another house is dropped.
  const wantedId = picked && picked.houseId === house?.id ? picked.itemId : params.item_id;
  const supply: HouseSupply | null = supplies.find((s) => s.item.id === wantedId) ?? null;
  const item = supply?.item ?? null;

  const units = item ? usableUnits(item) : [];
  // Falls back to the base unit when nothing (or a unit of the previous item) is picked.
  const unit = units.find((u) => u.unit === unitCode) ?? units[0] ?? null;
  const unitText = (code: string | undefined) => (code ? humanise(code).toLowerCase() : '');
  const baseText = unitText(item?.unit);
  // Feed (anything kept in bags) reads "X Bag Y kg"; everything else as a number and its unit.
  const bagged = !!item && bagSize(item) > 0;
  const stock = (n: number): string => (item ? formatStock(n, item) : `${formatBalance(n)} ${baseText}`);

  const onHand = supply?.balance ?? null;
  const quantityNum = Number(quantity);
  const baseQty = quantityNum * (unit?.factor ?? 1);
  // The server refuses more than the house holds, so catch it here rather than as a failed sync.
  const overStock = onHand !== null && baseQty > onHand;
  const isValid = !!house && !!item && quantityNum > 0 && !overStock;

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
          unit: unit?.unit ?? item.unit,
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
      title="Use supplies"
      hint="Feed, husk and other items without QR codes, used in a house. It comes off that house's stock."
      dirty={!!picked || !!quantity || !!note}
      submit={{
        label: quantityNum > 0 && item ? `Use ${bagged ? stock(baseQty) : `${quantity} ${unitText(unit?.unit)}`} ${item.name.toLowerCase()}` : 'Use supplies',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <FormCard>
        <HousePicker value={house} onChange={setHouse} />
        <BatchResolver houseId={house?.id} />
      </FormCard>

      <FormCard title="What, how much">
        <PickerField
          label="Item"
          value={supply}
          options={supplies}
          getKey={(s) => s.item.id}
          getLabel={(s) => s.item.name}
          getSubLabel={(s) => `${formatStock(s.balance, s.item)} in this house`}
          onChange={(s) => {
            if (!house) return;
            setPicked({ houseId: house.id, itemId: s.item.id });
            setUnitCode(null);
          }}
          disabled={!house}
          loading={!!house && houseStock.isPending}
          placeholder={house ? 'Choose what was used' : 'Pick the house first'}
          emptyLabel="Nothing without a QR code is in this house. Move supplies in first."
        />

        {units.length > 1 ? (
          <View style={styles.group}>
            <AppText variant="eyebrow" color="muted">
              Unit
            </AppText>
            <PillSelect
              options={units.map((u) => ({
                value: u.unit,
                label: u.factor === 1 ? humanise(u.unit) : `${humanise(u.unit)} · ${formatBalance(u.factor)} ${baseText}`,
              }))}
              value={unit?.unit ?? null}
              onChange={setUnitCode}
            />
          </View>
        ) : null}

        {/* No steppers: quantities are typed, not nudged, and a stepper on a decimal field is a mis-tap generator. */}
        <NumberField
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          unit={unit ? humanise(unit.unit) : undefined}
          autoFocus={!!params.house_id && !!params.item_id}
          warn={overStock}
          helper={
            onHand === null
              ? undefined
              : overStock
                ? `This house only has ${stock(onHand)}.`
                : (bagged || (unit && unit.factor !== 1)) && quantityNum > 0
                  ? `= ${stock(baseQty)} · ${stock(onHand)} in this house`
                  : `${stock(onHand)} in this house`
          }
          helperColor={overStock ? 'critical' : 'muted'}
        />

        <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
      </FormCard>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
});
