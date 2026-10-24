import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { KpiTile } from '@/components/ui/kpi-tile';
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
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { codesNeeded } from '@/lib/lot-split';
import { dayLabel, summarizeLots } from '@/lib/link-summary';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { PurchaseItem, StockUnit } from '@/lib/types';

const MIN_QUERY = 3;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const quantityLabel = (p: PurchaseItem) => `${Number(p.base_quantity)} ${p.item.unit.toLowerCase()}`;
// Opening lots have no supplier or invoice -- say what they are instead of just a date.
const lotDate = (p: PurchaseItem) =>
  `${p.purchase.is_opening ? 'Opening stock, ' : ''}${formatDate(p.purchase.purchase_date)}`;

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

  // Start of the phone's day: the server counts, per line, the units linked since then.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const { data: purchaseItems, isLoading: lotsLoading } = useGetData<Paginated<PurchaseItem>>(
    `/purchase-items?limit=100&since=${encodeURIComponent(since)}`,
    ['purchase-items', since],
  );

  // StockUnitService.bind rejects a lot whose item isn't QR-tracked. Filter
  // the list rather than explain the 400 afterwards.
  const trackedLots = (purchaseItems?.results ?? []).filter((p) => p.item.is_unit_tracked);
  const linkedOf = (p: PurchaseItem) => p._count?.stockUnits ?? 0;
  const { pending, recent, kpis } = summarizeLots(trackedLots);

  // Derived from the query so the count refreshes after each link, and a lot
  // stays on screen the moment its last code lands.
  const lot = trackedLots.find((p) => p.id === lotId) ?? null;

  // The lot's bottle count: fixed once the first link saved it, until then whatever the size typed gives.
  const typedCount = lot ? codesNeeded(Number(lot.base_quantity), Number(size.replace(',', '.'))) : null;
  const cap = lot?.unit_count ?? typedCount;
  const linkedTotal = lot ? linkedOf(lot) : 0;
  const full = cap !== null && linkedTotal >= cap;
  const unitName = lot?.item.unit.toLowerCase() ?? '';
  // A saved bottle count settles the lot: no resizing, and it completes by itself when the last code
  // links. A lot without one (it predates splits) takes a size here, and is only lockable by hand once
  // every one of those bottles has a code.
  const settled = lot?.unit_count != null;
  const canLink = !full && cap !== null;
  const [completing, setCompleting] = useState(false);

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
      // Awaited: the scanner takes one code at a time, so the next one is judged against the
      // updated count rather than racing the refetch.
      await queryClient.invalidateQueries({ queryKey: ['purchase-items'] });
    },
  });

  // The last code in: close the camera after a beat, so the flash and the sound land first.
  useEffect(() => {
    if (!scanning || !full) return;
    const t = setTimeout(() => {
      session.close();
      setScanning(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [scanning, full, session]);

  const markComplete = () => {
    if (!lot || cap === null) return;
    Alert.alert(
      'Mark lot complete?',
      `Locks ${lot.item.name} at ${cap} units. You won't be able to link more codes or change the split.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark complete',
          onPress: async () => {
            setCompleting(true);
            try {
              await apiFetch(`/purchase-items/${lot.id}/complete`, {
                method: 'POST',
                body: JSON.stringify({ unit_count: cap }),
              });
            } catch (e) {
              // 409 = someone (or a double tap) already locked it; the refresh below shows that.
              if (!(e instanceof ApiError && e.status === 409)) {
                Alert.alert('Couldn’t mark complete', e instanceof Error ? e.message : 'Try again.');
                setCompleting(false);
                return;
              }
            }
            try {
              await queryClient.invalidateQueries({ queryKey: ['purchase-items'] });
              setScanning(false);
              setManual(false);
            } finally {
              setCompleting(false);
            }
          },
        },
      ],
    );
  };

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.kpiScroll}
              contentContainerStyle={styles.kpiRow}
            >
              <View style={styles.kpiCard}>
                <KpiTile
                  icon="clock"
                  tint="tintAmber"
                  tone="warning"
                  label="Pending lots"
                  value={String(kpis.pendingCount)}
                  note={
                    kpis.notSplit === 0
                      ? 'All sized'
                      : `${kpis.notSplit} ${kpis.notSplit === 1 ? 'needs' : 'need'} a size`
                  }
                />
              </View>
              <View style={styles.kpiCard}>
                <KpiTile
                  icon="grid"
                  tint="tintBlue"
                  tone="info"
                  label="Codes to link"
                  value={String(kpis.codesToLink)}
                  note="On sized lots"
                />
              </View>
              <View style={styles.kpiCard}>
                <KpiTile
                  icon="trending-up"
                  tint="tintGreen"
                  tone="success"
                  label="Linked today"
                  value={String(kpis.linkedToday)}
                  note={`Across ${kpis.lotsTouchedToday} ${kpis.lotsTouchedToday === 1 ? 'lot' : 'lots'}`}
                />
              </View>
              <View style={styles.kpiCard}>
                <KpiTile
                  icon="check-circle"
                  tint="tintGreen"
                  tone="success"
                  label="Completed"
                  value={String(kpis.completedCount)}
                  note={`${kpis.completedCount} of ${kpis.totalLots} lots`}
                  progress={kpis.totalLots === 0 ? 0 : kpis.completedCount / kpis.totalLots}
                />
              </View>
            </ScrollView>

            <View style={styles.sectionHead}>
              <AppText variant="h2">Pending</AppText>
              <AppText variant="caption" color="muted">
                {kpis.pendingCount === 0 ? 'none' : `${kpis.pendingCount} to finish`}
              </AppText>
            </View>
            {pending.length === 0 ? (
              <EmptyState
                icon="check-circle"
                tint="tintGreen"
                title="Every lot is linked."
                body="Each bottle on every delivery has a code."
              />
            ) : (
              <View style={styles.pendingList}>
                {pending.map((p) => (
                  <LotCard key={p.id} lot={p} linked={linkedOf(p)} onPress={() => choose(p)} />
                ))}
              </View>
            )}

            {recent.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <AppText variant="h2">Completed</AppText>
                  <AppText variant="caption" color="muted">
                    {kpis.completedCount > recent.length
                      ? `latest ${recent.length} of ${kpis.completedCount}`
                      : `${kpis.completedCount} so far`}
                  </AppText>
                </View>
                <Card rows>
                  {recent.map((p, i) => (
                    <DoneRow key={p.id} lot={p} first={i === 0} />
                  ))}
                </Card>
              </>
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
            {quantityLabel(lot)} · {lotDate(lot)} · …{lot.id.slice(-7)}
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
            {full ? 'all linked' : cap === null ? 'bottles — set the size' : `${cap - linkedTotal} left`}
          </AppText>
        </View>
        <BottleStrip linked={linkedTotal} total={cap} height={12} />

        {!settled ? (
          <View style={styles.sizeRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Bottle size</AppText>
              <AppText variant="caption" color={size.trim() && cap === null ? 'critical' : 'muted'}>
                {size.trim() && cap === null
                  ? `${size} ${unitName} doesn't divide ${Number(lot.base_quantity)} ${unitName} evenly.`
                  : linkedTotal > 0
                    ? `${linkedTotal} already linked. How much does one bottle hold?`
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
            Split into {lot.unit_count} × {Number((Number(lot.base_quantity) / lot.unit_count!).toFixed(2))} {unitName}
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
      ) : full && !settled ? (
        <View style={styles.actions}>
          <View style={[styles.offline, styles.noTopMargin, { backgroundColor: theme.tintGreen }]}>
            <Icon name="check-circle" size={20} color="success" />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">
                {cap === 1 ? 'The only unit is linked.' : `All ${cap} units are linked.`}
              </AppText>
              <AppText variant="caption" color="muted">
                Mark the lot complete to lock it: no more codes, no resizing.
              </AppText>
            </View>
          </View>
          <Button label="Mark lot complete" icon="lock" onPress={markComplete} loading={completing} />
        </View>
      ) : full ? (
        <View style={[styles.offline, { backgroundColor: theme.tintGreen }]}>
          <Icon name="check-circle" size={20} color="success" />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">This lot is complete — {linkedTotal} linked.</AppText>
            <AppText variant="caption" color="muted">
              It is locked: no more codes, no resizing. Change lot to link another delivery.
            </AppText>
          </View>
        </View>
      ) : !canLink ? null : (
        <View style={styles.actions}>
          <View style={styles.modeField}>
            <ScanModeField value={mode} onChange={setMode} />
          </View>
          <Button
            label="Scan codes"
            icon="camera"
            onPress={() => {
              // Another phone may have linked some since this lot was loaded.
              void queryClient.invalidateQueries({ queryKey: ['purchase-items'] });
              setScanning(true);
            }}
          />
          <Button
            variant="ghost"
            label={manual ? 'Hide manual entry' : 'Type a code instead'}
            onPress={() => setManual((m) => !m)}
            block
          />
        </View>
      )}

      {manual && !offline && canLink && (
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
        remaining={cap === null ? null : Math.max(0, cap - linkedTotal)}
      />
    </Screen>
  );
}

/** A finished lot: what it was, how it split, and when its last code went in. */
function DoneRow({ lot, first }: { lot: PurchaseItem; first: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.doneRow, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}>
      <IconTile name="check" tint="tintGreen" color="success" size={32} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {lot.item.name}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {quantityLabel(lot)} · {lot.unit_count} bottles
        </AppText>
      </View>
      {lot.last_linked_at ? (
        <AppText variant="caption" color="muted">
          {dayLabel(lot.last_linked_at)}
        </AppText>
      ) : null}
    </View>
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
              {quantityLabel(lot)} · {lotDate(lot)}
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color="muted" />
        </View>
        <BottleStrip linked={linked} total={total} />
        <AppText variant="caption" color="muted" style={styles.lotCardNote}>
          {total === null
            ? linked > 0
              ? `${linked} linked · set the bottle size to check it`
              : 'Not split yet · set the bottle size to start'
            : `${linked} of ${total} linked · ${total - linked} left`}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.md, marginTop: Spacing.lg },
  // Bleeds to the screen edges so the tiles slide under the padding instead of stopping at it.
  kpiScroll: { marginHorizontal: -Spacing.xl, marginTop: Spacing.md },
  kpiRow: { gap: Spacing.md, paddingHorizontal: Spacing.xl },
  kpiCard: { width: 168 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  pendingList: { gap: Spacing.md },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
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
  noTopMargin: { marginTop: 0, marginBottom: Spacing.sm },
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
