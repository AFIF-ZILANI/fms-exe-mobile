import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { useHouseOptions } from '@/components/ui/house-picker';
import { ItemPicker } from '@/components/ui/item-picker';
import { PickerField } from '@/components/ui/picker-field';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import { formatBalance, type StockRow } from '@/lib/stock-summary';
import type { Item, Warehouse } from '@/lib/types';
import { goBack } from '@/lib/nav';

type Place = { type: 'WAREHOUSE' | 'HOUSE'; id: string; name: string };

const placeKey = (p: Place) => `${p.type}:${p.id}`;

/**
 * Uncoded stock (feed, husk, supplies) moved by quantity: warehouse -> house, house -> house,
 * or back to the warehouse. One POST /stock-transfers, which writes the OUT/IN ledger pair.
 * Coded units move by scan instead (scan/allocate.tsx). Opened from a house, the house is the
 * source and the warehouse the destination, since that is the return this screen exists for.
 *
 * ponytail: quantity is in Item.unit only, like Log feed. Add a unit picker if bag counts are wanted.
 */
export default function MoveStockScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const theme = useTheme();
  const submit = useQueuedSubmit();

  const [item, setItem] = useState<Item | null>(null);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [touched, setTouched] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const warehouses = useGetData<Paginated<Warehouse>>('/warehouses?limit=100', ['warehouses']);
  const houses = useHouseOptions();
  const stockRows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);

  const places: Place[] = [
    ...(warehouses.data?.results ?? []).map((w) => ({ type: 'WAREHOUSE' as const, id: w.id, name: w.name })),
    ...(houses.data?.results ?? []).map((h) => ({ type: 'HOUSE' as const, id: h.id, name: h.name })),
  ];
  const firstWarehouse = places.find((p) => p.type === 'WAREHOUSE') ?? null;
  const prefillHouse = places.find((p) => p.type === 'HOUSE' && p.id === params.house_id) ?? null;
  // Derived until the person picks, same as usePrefillHouse.
  const source = touched ? from : (prefillHouse ?? firstWarehouse);
  const dest = touched ? to : prefillHouse ? firstWarehouse : null;

  const balanceAt = (p: Place) =>
    item
      ? (stockRows.data ?? [])
          .filter((r) => r.item_id === item.id && r.location_type === p.type && r.location_id === p.id)
          .reduce((sum, r) => sum + (Number(r.balance) || 0), 0)
      : null;

  const onHand = source ? balanceAt(source) : null;
  const quantityNum = Number(quantity);
  const samePlace = !!source && !!dest && placeKey(source) === placeKey(dest);
  const bothWarehouses = source?.type === 'WAREHOUSE' && dest?.type === 'WAREHOUSE';
  // The server refuses more than the source holds, so catch it here rather than as a failed sync.
  const overStock = onHand !== null && quantityNum > onHand;
  const isValid = !!item && !!source && !!dest && !samePlace && !bothWarehouses && quantityNum > 0 && !overStock;

  const pick = (which: 'from' | 'to', p: Place) => {
    // The first pick freezes the other side at whatever was prefilled.
    if (!touched) {
      setFrom(source);
      setTo(dest);
      setTouched(true);
    }
    if (which === 'from') setFrom(p);
    else setTo(p);
  };

  const doSubmit = async () => {
    if (!item || !source || !dest) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/stock-transfers',
        body: {
          item_id: item.id,
          from_location_type: source.type,
          from_location_id: source.id,
          to_location_type: dest.type,
          to_location_id: dest.id,
          quantity: quantityNum,
          unit: item.unit,
          ...(note.trim() && { note: note.trim() }),
        },
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const left = onHand !== null ? formatBalance(onHand - quantityNum) : null;
    Alert.alert(
      `Move ${quantity} ${item?.unit.toLowerCase()} ${item?.name.toLowerCase()}?`,
      `${source?.name} → ${dest?.name}.${left !== null ? ` ${source?.name} keeps ${left}.` : ''} A mistake needs a second move back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move', onPress: doSubmit },
      ],
    );
  };

  const placeField = (label: string, value: Place | null, which: 'from' | 'to', error?: string) => (
    <PickerField
      label={label}
      value={value}
      options={places}
      getKey={placeKey}
      getLabel={(p) => p.name}
      getSubLabel={(p) => {
        const b = balanceAt(p);
        const kind = p.type === 'WAREHOUSE' ? 'Warehouse' : 'House';
        return b === null ? kind : `${kind} · ${formatBalance(b)} ${item?.unit.toLowerCase()}`;
      }}
      onChange={(p) => pick(which, p)}
      loading={warehouses.isLoading || houses.isLoading}
      error={error}
      emptyLabel="No warehouses or houses."
    />
  );

  return (
    <FormScreen
      title="Move supplies"
      hint="Feed, husk and other uncoded stock, by quantity. Returns to the warehouse too."
      dirty={!!item || !!quantity || !!note}
      submit={{
        label: quantityNum > 0 && item ? `Move ${quantity} ${item.unit.toLowerCase()}` : 'Move stock',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <FormCard title="What">
        <ItemPicker value={item} onChange={setItem} unitTracked={false} />
      </FormCard>

      <FormCard title="From">{placeField('From', source, 'from')}</FormCard>

      <View style={styles.arrow}>
        <View style={[styles.arrowDot, { backgroundColor: theme.surfaceAlt }]}>
          <Icon name="arrow-down" size={20} color="muted" />
        </View>
      </View>

      <FormCard title="To, how much">
        {placeField(
          'To',
          dest,
          'to',
          samePlace
            ? 'Pick a different place from the source.'
            : bothWarehouses
              ? "Warehouse-to-warehouse moves aren't supported."
              : undefined,
        )}

        <NumberField
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          unit={item?.unit}
          warn={overStock}
          helper={
            onHand === null || !source
              ? undefined
              : overStock
                ? `${source.name} only has ${formatBalance(onHand)} ${item?.unit.toLowerCase()}.`
                : `${formatBalance(onHand)} ${item?.unit.toLowerCase()} at ${source.name}`
          }
          helperColor={overStock ? 'critical' : 'muted'}
        />

        <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline />
      </FormCard>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  arrow: { alignItems: 'center', marginVertical: -Spacing.xs },
  arrowDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
