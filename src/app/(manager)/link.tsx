import { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { PickerField } from '@/components/ui/picker-field';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { QrScanner, type ScanRow } from '@/components/ui/qr-scanner';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { bindErrorMessage } from '@/lib/scan';
import type { PurchaseItem, StockUnit } from '@/lib/types';

const MIN_QUERY = 3;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * docs/layout/18-link-items.md — bind pre-printed QR codes to the delivery lot
 * they arrived on, standing at the farm gate.
 *
 * Lot first, then many codes: the camera stays open so a whole pallet goes
 * through without returning to a form between units. This replaced the
 * unit-first Receive stock screen, whose manual search survives here as the
 * fallback for a torn or unreadable label.
 *
 * The QR payload IS the StockUnit id (schema.prisma), so a scan needs no
 * lookup step — it goes straight to the bind.
 *
 * **This screen requires a connection**, unlike every other write in the app.
 * Each bind is validated by the server as it happens, because linking the
 * wrong unit to a lot is expensive and silent, and the checks that catch it
 * (already bound, wrong item, unknown code) only exist server-side.
 */
export default function LinkItemsScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const queryClient = useQueryClient();
  const network = useNetworkState();

  const [lot, setLot] = useState<PurchaseItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');

  const { data: purchaseItems, isLoading: lotsLoading } = useGetData<Paginated<PurchaseItem>>(
    '/purchase-items?limit=100',
    ['purchase-items'],
  );

  // StockUnitService.bind rejects a lot whose item isn't QR-tracked. Filter
  // the list rather than explain the 400 afterwards.
  const trackedLots = (purchaseItems?.results ?? []).filter((p) => p.item.is_unit_tracked);

  const trimmed = query.trim();
  const { data: units, isLoading: unitsLoading } = useGetData<Paginated<StockUnit>>(
    manual && trimmed.length >= MIN_QUERY
      ? `/stock-units?q=${encodeURIComponent(trimmed)}&status=UNASSIGNED&limit=25`
      : '',
    ['stock-units', 'search', trimmed],
    { enabled: manual && trimmed.length >= MIN_QUERY },
  );

  const offline = network.isConnected === false;
  const linked = rows.filter((r) => r.state === 'ok').length;

  /** Returns null on success, or a message to show beside the code. */
  const bind = async (id: string): Promise<string | null> => {
    if (!lot) return 'Pick a lot first.';
    try {
      await apiFetch(`/stock-units/${id}/bind`, {
        method: 'POST',
        body: JSON.stringify({
          purchase_item_id: lot.id,
          ...(employee?.profile.id && { bound_by_id: employee.profile.id }),
        }),
      });
      // Anything showing unit counts or unassigned units is now stale.
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
      return null;
    } catch (err) {
      if (err instanceof ApiError) return bindErrorMessage(err.status, err.message);
      return 'Something went wrong.';
    }
  };

  const bindManually = async (id: string) => {
    const error = await bind(id);
    const label = `…${id.slice(-7)}`;
    setRows((prev) => [
      { id, label, state: error ? 'error' : 'ok', ...(error && { message: error }) },
      ...prev,
    ]);
    if (!error) {
      setQuery('');
      setManual(false);
    }
  };

  return (
    <Screen>
      <Header title="Link items" leading="back" />

      <PickerField
        label="Purchase lot"
        value={lot}
        options={trackedLots}
        getKey={(p) => p.id}
        getLabel={(p) => p.item.name}
        getSubLabel={(p) => `${p.base_quantity} · ${formatDate(p.purchase.purchase_date)}`}
        onChange={(next) => {
          setLot(next);
          // A new lot is a new session — carrying counts across would
          // misreport what went into which delivery.
          setRows([]);
        }}
        loading={lotsLoading}
        emptyLabel="No QR-tracked purchase lots. Lots are recorded in the admin dashboard."
      />

      {lot ? (
        <>
          <Card style={styles.card}>
            <View style={styles.lotHead}>
              <IconTile name="package" tint="tintAmber" color="warning" />
              <View style={styles.flex}>
                <AppText variant="h2">{lot.item.name}</AppText>
                <AppText variant="caption" color="muted">
                  {lot.item.category?.toLowerCase()}
                </AppText>
              </View>
            </View>

            <View style={[styles.rule, { backgroundColor: theme.line }]} />

            <Detail label="Quantity" value={String(lot.base_quantity)} mono />
            <Detail label="Received" value={formatDate(lot.purchase.purchase_date)} />
            <Detail label="Lot" value={`…${lot.id.slice(-7)}`} mono />

            <View style={[styles.rule, { backgroundColor: theme.line }]} />

            <View style={styles.countRow}>
              <AppText variant="eyebrow" color="muted">
                Linked this session
              </AppText>
              <AppText variant="stat" color={linked > 0 ? 'success' : 'ink'}>
                {linked}
              </AppText>
            </View>
          </Card>

          {offline ? (
            <View style={[styles.offline, { backgroundColor: theme.tintRed }]}>
              <Icon name="wifi-off" size={20} color="critical" />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Linking needs a connection.</AppText>
                <AppText variant="caption" color="muted">
                  Each code is checked against the server as you scan. Everything
                  else in the app still works offline.
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label="Scan codes" icon="camera" onPress={() => setScanning(true)} />
              <Button
                variant="ghost"
                label={manual ? 'Hide manual entry' : 'Type a code instead'}
                onPress={() => setManual((m) => !m)}
                block
              />
            </View>
          )}

          {manual && !offline && (
            <Card style={styles.card}>
              <AppText variant="eyebrow" color="muted">
                Find a unit by code
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  style={[styles.searchInput, { color: theme.ink }]}
                />
              </View>
              <AppText variant="caption" color="muted">
                For a torn or unreadable label. Partial codes work.
              </AppText>

              {trimmed.length >= MIN_QUERY &&
                (unitsLoading ? (
                  <Skeleton height={36} />
                ) : (units?.results.length ?? 0) === 0 ? (
                  <AppText variant="caption" color="muted">
                    No unassigned unit matches that — try fewer characters.
                  </AppText>
                ) : (
                  units?.results.map((u, i) => (
                    <LedgerRow
                      key={u.id}
                      gutterNode={<IconTile name="box" tint="surfaceAlt" color="muted" size={32} />}
                      last={i === (units?.results.length ?? 0) - 1}
                      onPress={() => void bindManually(u.id)}
                    >
                      <AppText variant="data">…{u.id.slice(-7)}</AppText>
                      <AppText variant="caption" color="muted">
                        {u.status.toLowerCase()}
                      </AppText>
                    </LedgerRow>
                  ))
                ))}
            </Card>
          )}

          {rows.length > 0 && (
            <Card rows eyebrow="Scanned" note={`${linked} linked`} style={styles.card}>
              {rows.map((row, i) => (
                <LedgerRow
                  key={`${row.id}-${i}`}
                  gutterNode={
                    <Icon
                      name={row.state === 'ok' ? 'check-circle' : 'alert-circle'}
                      size={20}
                      color={row.state === 'ok' ? 'success' : 'critical'}
                    />
                  }
                  last={i === rows.length - 1}
                >
                  <AppText variant="data">{row.label}</AppText>
                  {row.message ? (
                    <AppText variant="caption" color="critical">
                      {row.message}
                    </AppText>
                  ) : null}
                </LedgerRow>
              ))}
            </Card>
          )}
        </>
      ) : (
        <View style={styles.card}>
          <EmptyState
            icon="package"
            tint="surfaceAlt"
            title="Pick a lot to link into."
            body="Choose the delivery these units arrived on, then scan their codes."
          />
        </View>
      )}

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={lot?.item.name ?? ''}
        onScan={bind}
        rows={rows}
        onScanned={(row) => setRows((prev) => [row, ...prev])}
        offline={offline}
      />
    </Screen>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detail}>
      <AppText variant="label" color="muted" style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant={mono ? 'data' : 'body'} style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  lotHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rule: { height: 1, marginVertical: Spacing.lg },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minHeight: 28 },
  detailLabel: { width: 88 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { gap: Spacing.xs, marginTop: Spacing.md },
  offline: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 56,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 15 },
});
