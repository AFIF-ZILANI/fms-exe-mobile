import { useState } from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { QrScanner } from '@/components/ui/qr-scanner';
import { BottleStrip } from '@/components/bottle-strip';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ScanModeField, ScanResults } from '@/components/scan-parts';
import { apiFetch, useGetData, type Paginated } from '@/lib/api';
import { codesNeeded, isLotComplete } from '@/lib/lot-split';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { PurchaseItem, StockUnit } from '@/lib/types';

const MIN_QUERY = 3;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const quantityLabel = (p: PurchaseItem) => `${Number(p.base_quantity)} ${p.item.unit.toLowerCase()}`;

/**
 * docs/layout/18-link-items.md — bind pre-printed QR codes to the delivery lot
 * they arrived on, standing at the farm gate.
 *
 * Two stages on one screen. With no lot chosen it lists the lots that still
 * need codes, each with a strip of one segment per bottle; finished lots sit
 * below, greyed out and not tappable. Opening a lot shows that strip large, the
 * bottle-size field (until the first link saves the split) and the scan actions.
 *
 * The QR payload IS the StockUnit id (schema.prisma), so a scan needs no
 * lookup step — it goes straight to the bind.
 *
 * **This screen requires a connection**, unlike every other write in the app.
 * Each bind is validated by the server as it happens, because linking the
 * wrong unit to a lot is expensive and silent, and the checks that catch it
 * (already bound, wrong item, lot full, unknown code) only exist server-side.
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
  const linkedOf = (p: PurchaseItem) => p._count?.stockUnits ?? 0;
  const openLots = trackedLots.filter((p) => !isLotComplete(p.unit_count, linkedOf(p)));
  const doneLots = trackedLots.filter((p) => isLotComplete(p.unit_count, linkedOf(p)));

  // Derived from the query so the count refreshes after each link, and a lot
  // stays on screen the moment its last code lands.
  const lot = trackedLots.find((p) => p.id === lotId) ?? null;

  // The lot's bottle count: fixed once the first link saved it, until then whatever the size typed gives.
  const typedCount = lot ? codesNeeded(Number(lot.base_quantity), Number(size.replace(',', '.'))) : null;
  const cap = lot?.unit_count ?? typedCount;
  const linkedTotal = lot ? linkedOf(lot) : 0;
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
      // Anything showing unit counts or unassigned units is now stale.
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-items'] });
    },
  });

  const bindManually = async (id: string) => {
    if (await session.runManual(id)) {
      setQuery('');
      setManual(false);
    }
  };

  // A new lot is a new session — carrying counts across would misreport what
  // went into which delivery.
  const choose = (next: PurchaseItem | null) => {
    setLotId(next?.id ?? null);
    setSize('');
    setManual(false);
    setQuery('');
    session.reset();
  };

  if (!lot) {
    return (
      <Screen>
        <Header title="Link items" leading="back" />

        {lotsLoading ? (
          <View style={styles.list}>
            <Skeleton height={104} />
            <Skeleton height={104} />
          </View>
        ) : trackedLots.length === 0 ? (
          <View style={styles.list}>
            <EmptyState
              icon="package"
              tint="surfaceAlt"
              title="No QR-tracked lots."
              body="Lots are recorded in the admin dashboard."
            />
          </View>
        ) : (
          <>
            {openLots.length === 0 ? (
              <View style={styles.list}>
                <EmptyState
                  icon="check-circle"
                  tint="tintGreen"
                  title="Every lot is linked."
                  body="Each bottle on every delivery has a code."
                />
              </View>
            ) : (
              <>
                <AppText variant="body" color="muted" style={styles.intro}>
                  Pick the delivery these units arrived on, then scan their codes.
                </AppText>
                <View style={styles.list}>
                  {openLots.map((p) => (
                    <LotCard key={p.id} lot={p} linked={linkedOf(p)} onPress={() => choose(p)} />
                  ))}
                </View>
              </>
            )}

            {doneLots.length > 0 && (
              <Card rows eyebrow="Complete" note={`${doneLots.length}`} style={styles.list}>
                {doneLots.map((p, i) => (
                  <LedgerRow
                    key={p.id}
                    gutterNode={<IconTile name="check" tint="tintGreen" color="success" size={32} />}
                    last={i === doneLots.length - 1}
                  >
                    <AppText variant="bodyStrong">{p.item.name}</AppText>
                    <AppText variant="caption" color="muted">
                      {quantityLabel(p)} · {formatDate(p.purchase.purchase_date)} · {linkedOf(p)} /{' '}
                      {p.unit_count} linked
                    </AppText>
                  </LedgerRow>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Link items" leading="back" />

      <View style={styles.lotHead}>
        <IconTile name="package" tint="tintAmber" color="warning" />
        <View style={styles.flex}>
          <AppText variant="h2" numberOfLines={1}>
            {lot.item.name}
          </AppText>
          <AppText variant="caption" color="muted">
            {quantityLabel(lot)} · {formatDate(lot.purchase.purchase_date)} · …{lot.id.slice(-7)}
          </AppText>
        </View>
        <Button variant="ghost" label="Change" onPress={() => choose(null)} />
      </View>

      <Card style={styles.card}>
        <View style={styles.countRow}>
          <AppText variant="stat" color={full ? 'success' : 'ink'}>
            {linkedTotal} / {cap ?? '—'}
          </AppText>
          <AppText variant="caption" color="muted">
            {full ? 'complete' : cap === null ? 'bottles — set the size' : `${cap - linkedTotal} left`}
          </AppText>
        </View>
        <BottleStrip linked={linkedTotal} total={cap} height={12} />

        {lot.unit_count == null ? (
          <View style={styles.sizeRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Bottle size</AppText>
              <AppText variant="caption" color={size.trim() && cap === null ? 'critical' : 'muted'}>
                {size.trim() && cap === null
                  ? `${size} ${unitName} doesn't divide ${Number(lot.base_quantity)} ${unitName} evenly.`
                  : `How much one bottle holds. Fixes the split at the first link.`}
              </AppText>
            </View>
            <View style={[styles.sizeField, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
              <TextInput
                value={size}
                onChangeText={setSize}
                placeholder="1"
                placeholderTextColor={theme.muted}
                keyboardType="decimal-pad"
                style={[styles.sizeInput, { color: theme.ink }]}
              />
              <AppText variant="caption" color="muted">
                {unitName}
              </AppText>
            </View>
          </View>
        ) : (
          <AppText variant="caption" color="muted" style={styles.split}>
            Split into {lot.unit_count} × {Number(lot.base_quantity) / lot.unit_count} {unitName}
          </AppText>
        )}
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
      ) : full ? (
        <View style={[styles.offline, { backgroundColor: theme.tintGreen }]}>
          <Icon name="check-circle" size={20} color="success" />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">All {cap} bottles have a code.</AppText>
            <AppText variant="caption" color="muted">
              This lot is done and leaves the list. Change lot to link another delivery.
            </AppText>
          </View>
        </View>
      ) : cap === null ? null : (
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

      <QrScanner
        key={session.generation}
        open={scanning}
        onClose={() => {
          session.close();
          setScanning(false);
        }}
        context={lot.item.name}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        pending={session.pending}
        offline={offline}
      />
    </Screen>
  );
}

/** An open lot in the list: what it is, and how far along its bottles are. */
function LotCard({ lot, linked, onPress }: { lot: PurchaseItem; linked: number; onPress: () => void }) {
  const total = lot.unit_count;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${lot.item.name}, ${total === null ? 'not split yet' : `${linked} of ${total} linked`}`}
    >
      <Card>
        <View style={styles.lotCardHead}>
          <IconTile name="package" tint="tintAmber" color="warning" />
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {lot.item.name}
            </AppText>
            <AppText variant="caption" color="muted">
              {quantityLabel(lot)} · {formatDate(lot.purchase.purchase_date)}
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color="muted" />
        </View>
        <BottleStrip linked={linked} total={total} />
        <AppText variant="caption" color="muted" style={styles.lotCardNote}>
          {total === null
            ? linked > 0
              ? `${linked} linked · set the bottle size to see how many it needs`
              : 'Not split yet · set the bottle size to start'
            : `${linked} of ${total} linked · ${total - linked} left`}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { marginTop: Spacing.xs },
  list: { gap: Spacing.md, marginTop: Spacing.lg },
  card: { marginTop: Spacing.md, gap: Spacing.md },
  lotCardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  lotCardNote: { marginTop: Spacing.sm },
  lotHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  split: { marginTop: Spacing.xs },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  sizeField: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
  },
  sizeInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 17 },
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
  searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 15 },
});
