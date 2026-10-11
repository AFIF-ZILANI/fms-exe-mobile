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
import { QrScanner } from '@/components/ui/qr-scanner';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ScanModeField, ScanResults } from '@/components/scan-parts';
import { apiFetch, useGetData, type Paginated } from '@/lib/api';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import { codesNeeded } from '@/lib/lot-split';
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
  const queryClient = useQueryClient();
  const network = useNetworkState();

  const [lotId, setLotId] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState('');

  const { data: purchaseItems, isLoading: lotsLoading } = useGetData<Paginated<PurchaseItem>>(
    '/purchase-items?limit=100',
    ['purchase-items'],
  );

  // StockUnitService.bind rejects a lot whose item isn't QR-tracked. Filter
  // the list rather than explain the 400 afterwards.
  const trackedLots = (purchaseItems?.results ?? []).filter((p) => p.item.is_unit_tracked);
  // Derived from the query so the count refreshes after each link.
  const lot = trackedLots.find((p) => p.id === lotId) ?? null;

  // The lot's bottle count: fixed once the first link saved it, until then whatever the size typed gives.
  const typedCount = lot ? codesNeeded(Number(lot.base_quantity), Number(size.replace(',', '.'))) : null;
  const cap = lot?.unit_count ?? typedCount;
  const linkedTotal = lot?._count?.stockUnits ?? 0;
  const full = cap !== null && linkedTotal >= cap;
  const unitName = lot?.item.unit.toLowerCase() ?? '';

  const trimmed = query.trim();
  const { data: units, isLoading: unitsLoading } = useGetData<Paginated<StockUnit>>(
    manual && trimmed.length >= MIN_QUERY
      ? `/stock-units?q=${encodeURIComponent(trimmed)}&status=UNASSIGNED&limit=25`
      : '',
    ['stock-units', 'search', trimmed],
    { enabled: manual && trimmed.length >= MIN_QUERY },
  );

  const offline = network.isConnected === false;

  const session = useScanSession({
    plan: { action: 'bind', purchaseItemId: lot?.id },
    mode,
    confirmLabel: 'Link',
    commit: async (unit) => {
      await apiFetch(`/stock-units/${unit.id}/bind`, {
        method: 'POST',
        body: JSON.stringify({
          purchase_item_id: lot?.id,
          // Only the first link of a lot sets its split; after that the server already knows it.
          ...(lot?.unit_count == null && cap !== null && { unit_count: cap }),
        }),
      });
      void queryClient.invalidateQueries({ queryKey: ['purchase-items'] });
      // Anything showing unit counts or unassigned units is now stale.
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    },
  });

  const bindManually = async (id: string) => {
    if (await session.runManual(id)) {
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
          setLotId(next?.id ?? null);
          setSize('');
          // A new lot is a new session — carrying counts across would
          // misreport what went into which delivery.
          session.reset();
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

            {lot.unit_count == null ? (
              <View style={styles.detail}>
                <AppText variant="label" color="muted" style={styles.detailLabel}>
                  Bottle size
                </AppText>
                <View
                  style={[styles.sizeField, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}
                >
                  <TextInput
                    value={size}
                    onChangeText={setSize}
                    placeholder="1"
                    placeholderTextColor={theme.muted}
                    keyboardType="decimal-pad"
                    style={[styles.searchInput, { color: theme.ink }]}
                  />
                  <AppText variant="caption" color="muted">
                    {unitName}
                  </AppText>
                </View>
              </View>
            ) : (
              <Detail
                label="Split into"
                value={`${lot.unit_count} × ${Number(lot.base_quantity) / lot.unit_count} ${unitName}`}
              />
            )}

            <View style={[styles.rule, { backgroundColor: theme.line }]} />

            <View style={styles.countRow}>
              <AppText variant="eyebrow" color="muted">
                Codes linked
              </AppText>
              <AppText variant="stat" color={full ? 'success' : 'ink'}>
                {linkedTotal} / {cap ?? '—'}
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
          ) : cap === null ? (
            <AppText variant="caption" color="muted" style={styles.card}>
              Enter the bottle size to see how many codes this lot needs
              {size.trim() ? ` — ${size} ${unitName} doesn't divide ${Number(lot.base_quantity)} ${unitName} evenly.` : '.'}
            </AppText>
          ) : full ? (
            <AppText variant="bodyStrong" color="success" style={styles.card}>
              All {cap} codes linked — this lot is complete.
            </AppText>
          ) : (
            <View style={styles.actions}>
              <View style={styles.modeField}>
                <ScanModeField value={mode} onChange={setMode} />
              </View>
              <Button label="Scan codes" icon="camera" onPress={() => setScanning(true)} />
              <Button
                variant="ghost"
                label={manual ? 'Hide manual entry' : 'Type a code instead'}
                onPress={() => setManual((m) => !m)}
                block
              />
            </View>
          )}

          {manual && !offline && cap !== null && !full && (
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

          <ScanResults rows={session.rows} done="linked" />
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
        key={session.generation}
        open={scanning}
        onClose={() => {
          session.close();
          setScanning(false);
        }}
        context={lot?.item.name ?? ''}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        pending={session.pending}
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
  modeField: { marginBottom: Spacing.md },
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
  sizeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 15 },
});
