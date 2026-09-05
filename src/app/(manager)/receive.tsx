import { useState } from 'react';
import { Alert, Pressable, TextInput, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { PickerField } from '@/components/ui/picker-field';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { PurchaseItem, StockUnit } from '@/lib/types';

const MIN_QUERY = 3;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * docs/layout/18-receive-stock.md. `q` is a substring match on the unit id —
 * the last few characters printed on the label are enough, which is why v1
 * needs no camera. This is the screen QR replaces in v2: the scan fills the
 * same search field and everything downstream is unchanged, so don't
 * restructure it around a scanner that doesn't exist yet.
 */
export default function ReceiveScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<StockUnit | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<PurchaseItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY;

  const { data: units, isLoading: unitsLoading } = useGetData<Paginated<StockUnit>>(
    searching ? `/stock-units?q=${encodeURIComponent(trimmed)}&status=UNASSIGNED&limit=25` : '',
    ['stock-units', 'search', trimmed],
    { enabled: searching },
  );

  const { data: purchaseItems, isLoading: lotsLoading } = useGetData<Paginated<PurchaseItem>>(
    '/purchase-items?limit=100',
    ['purchase-items'],
  );

  // StockUnitService.bind rejects a lot whose item isn't QR-tracked. Filter
  // the list rather than explain the 400 afterwards.
  const trackedLots = (purchaseItems?.results ?? []).filter((p) => p.item.is_unit_tracked);

  const isValid = !!unit && !!purchaseItem;

  const doSubmit = async () => {
    if (!unit || !purchaseItem || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: `/stock-units/${unit.id}/bind`,
        body: { purchase_item_id: purchaseItem.id, bound_by_id: employee.profile.id },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    // Restates the unit id: it's the only thing on screen that can be wrong in
    // a way that isn't visible. Supplier names are memorable, hex isn't.
    Alert.alert(
      `Bind …${unit?.id.slice(-7)}?`,
      `${purchaseItem?.item.name}, received ${purchaseItem ? formatDate(purchaseItem.purchase.purchase_date) : ''}. This links the physical unit to the lot it arrived on.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Bind', onPress: doSubmit },
      ],
    );
  };

  return (
    <FormScreen
      title="Receive stock"
      dirty={!!query || !!unit}
      submit={{
        label: purchaseItem ? `Bind to ${purchaseItem.item.name}` : 'Bind unit',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      {unit ? (
        // Step 2 — the chosen unit replaces the search field.
        <View style={[styles.selected, { backgroundColor: theme.primarySoft }]}>
          <IconTile name="box" tint="primarySoft" color="primary" />
          <View style={styles.flex}>
            <AppText variant="data">…{unit.id.slice(-7)}</AppText>
            <AppText variant="caption" color="muted">
              Unassigned unit
            </AppText>
          </View>
          <Pressable
            onPress={() => setUnit(null)}
            accessibilityRole="button"
            accessibilityLabel="Choose a different unit"
            style={styles.clear}
          >
            <Icon name="x" size={20} color="muted" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.group}>
          <AppText variant="eyebrow" color="muted">
            Find the unit
          </AppText>

          <View
            style={[styles.search, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}
          >
            <Icon name="search" size={20} color="muted" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="a3f9"
              placeholderTextColor={theme.muted}
              // Autocorrect on a hex fragment is actively harmful.
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={[styles.searchInput, { color: theme.ink }]}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={styles.clear}
              >
                <Icon name="x" size={20} color="muted" />
              </Pressable>
            ) : null}
          </View>

          {/* Always visible — it's the instruction that makes this screen
              usable without a scanner. */}
          <AppText variant="caption" color="muted">
            Type the last few characters from the label. Partial codes work.
          </AppText>
        </View>
      )}

      {!unit && searching && (
        <Card rows>
          {unitsLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={36} />
              ))}
            </View>
          ) : (units?.results.length ?? 0) === 0 ? (
            <EmptyState
              compact
              icon="search"
              tint="surfaceAlt"
              title="No unassigned unit matches that."
              body="Partial codes work — try fewer characters."
            />
          ) : (
            units?.results.map((u, i) => (
              <LedgerRow
                key={u.id}
                gutterNode={<IconTile name="box" tint="surfaceAlt" color="muted" size={32} />}
                last={i === (units?.results.length ?? 0) - 1}
                onPress={() => setUnit(u)}
              >
                {/* Tail-anchored: the label on the sack is read from the end,
                    and ids that all start 4f8e-11ef- distinguish nothing. */}
                <AppText variant="data">…{u.id.slice(-7)}</AppText>
                <AppText variant="caption" color="muted">
                  {u.status.toLowerCase()}
                </AppText>
              </LedgerRow>
            ))
          )}
        </Card>
      )}

      {unit && (
        <PickerField
          label="Purchase lot"
          value={purchaseItem}
          options={trackedLots}
          getKey={(p) => p.id}
          getLabel={(p) => p.item.name}
          getSubLabel={(p) => `${p.base_quantity} · ${formatDate(p.purchase.purchase_date)}`}
          onChange={setPurchaseItem}
          loading={lotsLoading}
          emptyLabel="No QR-tracked purchase lots. Lots are recorded in the admin dashboard."
        />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    // Taller than a standard input — it's this screen's whole first step.
    height: 56,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
  },
  // The content is a code, so it's mono.
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 15 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skeletons: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
});
