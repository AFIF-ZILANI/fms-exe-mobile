import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { PickerField } from '@/components/ui/picker-field';
import { LedgerRow } from '@/components/ui/ledger-row';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { PurchaseItem, StockUnit } from '@/lib/types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * docs/PRD.md §6.18. `q` is a substring match on the unit id -- the last
 * few characters printed on the label are enough, which is why v1 needs no
 * camera. This is the screen QR replaces in v2: the scan fills the same
 * search field, everything downstream unchanged.
 */
export default function ReceiveScreen() {
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<StockUnit | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<PurchaseItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: units, isLoading: unitsLoading } = useGetData<Paginated<StockUnit>>(
    query.trim().length >= 3 ? `/stock-units?q=${encodeURIComponent(query.trim())}&status=UNASSIGNED&limit=25` : '',
    ['stock-units', 'search', query.trim()],
    { enabled: query.trim().length >= 3 },
  );

  const { data: purchaseItems, isLoading: lotsLoading } = useGetData<Paginated<PurchaseItem>>(
    '/purchase-items?limit=200',
    ['purchase-items'],
  );
  const trackedLots = (purchaseItems?.results ?? []).filter((p) => p.item.is_unit_tracked);

  const isValid = !!unit && !!purchaseItem;

  const handleSubmit = async () => {
    if (!unit || !purchaseItem || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: `/stock-units/${unit.id}/bind`,
        body: {
          purchase_item_id: purchaseItem.id,
          bound_by_id: employee.profile.id,
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Receive stock' }} />
      <Section label="Unit" />
      <TextField
        label="Search"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setUnit(null);
        }}
        placeholder="Last few characters from the label"
        autoCapitalize="none"
      />

      {query.trim().length >= 3 && !unit && (
        <View style={{ marginTop: 4 }}>
          {unitsLoading ? (
            <AppText variant="body" color="muted">
              Searching…
            </AppText>
          ) : (units?.results.length ?? 0) === 0 ? (
            <AppText variant="body" color="muted">
              No unassigned unit matches that. Partial codes work.
            </AppText>
          ) : (
            units?.results.map((u) => (
              <LedgerRow key={u.id} gutter="—" onPress={() => setUnit(u)}>
                <AppText variant="data">{u.id}</AppText>
              </LedgerRow>
            ))
          )}
        </View>
      )}

      {unit && (
        <View style={{ marginTop: 4 }}>
          <AppText variant="label" color="muted">
            Selected
          </AppText>
          <AppText variant="data">{unit.id}</AppText>
        </View>
      )}

      <Section label="Lot" />
      <PickerField
        label="Purchase lot"
        value={purchaseItem}
        options={trackedLots}
        getKey={(p) => p.id}
        getLabel={(p) => p.item.name}
        getSubLabel={(p) => formatDate(p.purchase.purchase_date)}
        onChange={setPurchaseItem}
        loading={lotsLoading}
        emptyLabel="No QR-tracked purchase lots found."
      />

      <SubmitBar label="Bind unit" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
