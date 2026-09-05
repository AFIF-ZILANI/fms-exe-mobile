import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { ItemPicker } from '@/components/ui/item-picker';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Item, StockByLocation, Warehouse } from '@/lib/types';

type LocationKind = 'warehouse' | 'house';

/** Procedural and finite, unlike a mortality cause — so a picker, not free
 *  text. docs/layout/19-report-discrepancy.md. */
const REASONS = [
  'Damaged in storage',
  'Expired',
  'Spillage',
  'Theft suspected',
  'Miscount on receipt',
  'Other',
];

/**
 * docs/layout/19-report-discrepancy.md. The server takes quantity_before and
 * quantity_after and derives the delta itself — shown here before submit so
 * the manager sees exactly what they're asserting.
 *
 * "On record" is read-only on purpose: letting a manager hand-edit an
 * obviously-wrong ledger number is the thing this record exists to prevent,
 * and an adjustment with an edited "before" is unauditable.
 */
export default function AdjustScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const theme = useTheme();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [item, setItem] = useState<Item | null>(null);
  const [kind, setKind] = useState<LocationKind>(params.house_id ? 'house' : 'warehouse');
  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState<string | null>(null);
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
  const hasCount = counted.trim() !== '' && Number.isFinite(countedNum);
  const delta = countedNum - onRecord;
  const noteRequired = reason === 'Other';

  const isValid =
    !!item &&
    !!locationId &&
    hasCount &&
    // A zero delta has nothing to record: InventoryAdjustment can't express
    // "I counted and it matched", and a zero-quantity row would pollute the
    // ledger with entries that mean nothing.
    delta !== 0 &&
    !!reason &&
    (!noteRequired || note.trim() !== '');

  const doSubmit = async () => {
    if (!item || !locationId || !employee || !reason) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/inventory-adjustments',
        body: {
          item_id: item.id,
          ...(kind === 'house' ? { house_id: locationId } : { warehouse_id: locationId }),
          // Sent as before/after, never as a computed delta — the server
          // derives adjustment_quantity, and two sources of truth for the same
          // arithmetic is one too many.
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

  const handleSubmit = () => {
    const short = delta < 0;
    Alert.alert(
      `Report ${Math.abs(delta).toLocaleString()} ${item?.unit ?? ''} ${short ? 'short' : 'over'}?`,
      `The ledger will go from ${onRecord.toLocaleString()} to ${countedNum.toLocaleString()}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', onPress: doSubmit },
      ],
    );
  };

  const deltaTint = !hasCount
    ? 'surfaceAlt'
    : delta < 0
      ? 'tintRed'
      : delta > 0
        ? 'tintAmber'
        : 'tintGreen';
  const deltaColor = !hasCount ? 'muted' : delta < 0 ? 'critical' : delta > 0 ? 'warning' : 'success';
  const deltaLabel = !hasCount
    ? 'Enter a count'
    : delta < 0
      ? 'Short'
      : delta > 0
        ? 'Over'
        : 'Matches';

  return (
    <FormScreen
      title="Report a discrepancy"
      dirty={!!item || !!counted || !!note}
      submit={{
        label:
          hasCount && delta !== 0 && item
            ? `Report ${Math.abs(delta).toLocaleString()} ${item.unit} ${delta < 0 ? 'short' : 'over'}`
            : hasCount && delta === 0
              ? 'Nothing to report'
              : 'Report discrepancy',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <ItemPicker value={item} onChange={setItem} />

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Where
        </AppText>
        <SegmentedToggle
          options={[
            { value: 'warehouse', label: 'Warehouse' },
            { value: 'house', label: 'House' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </View>

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

      {/* Read-only, muted, no border — context rather than input. */}
      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          On record
        </AppText>
        <View style={[styles.readOnly, { backgroundColor: theme.surfaceAlt }]}>
          <AppText variant="figure" color="muted" style={styles.flex}>
            {onRecord.toLocaleString()}
          </AppText>
          <AppText variant="body" color="muted">
            {item?.unit ?? ''}
          </AppText>
        </View>
        <AppText variant="caption" color="muted">
          From the ledger
        </AppText>
      </View>

      <NumberField label="Counted" value={counted} onChangeText={setCounted} unit={item?.unit} />

      <View style={[styles.delta, { backgroundColor: theme[deltaTint] }]}>
        <AppText variant="stat" color={deltaColor}>
          {hasCount ? `${delta > 0 ? '+' : ''}${delta.toLocaleString()} ${item?.unit ?? ''}` : '—'}
        </AppText>
        <AppText variant="eyebrow" color="muted">
          {deltaLabel}
        </AppText>
      </View>

      <PickerField
        label="Reason"
        value={reason}
        options={REASONS}
        getKey={(r) => r}
        getLabel={(r) => r}
        onChange={setReason}
        searchable={false}
      />

      <TextField
        label={noteRequired ? 'Note' : 'Note (optional)'}
        value={note}
        onChangeText={setNote}
        multiline
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.xs },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.inputNumber,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.control,
  },
  delta: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.card,
    padding: Spacing.lg,
  },
});
