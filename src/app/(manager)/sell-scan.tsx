import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { QrScanner } from '@/components/ui/qr-scanner';
import { BottleStrip } from '@/components/bottle-strip';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ScanModeField, ScanResults } from '@/components/scan-parts';
import { apiFetch, useGetData } from '@/lib/api';
import { saleProgress } from '@/lib/sale-scan';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { ScanResult, ScanSale, ScanSaleDetail } from '@/lib/types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * QR sales recorded on the dashboard wait here until their packs are scanned out. Each scan is one pack:
 * the server checks it is sealed and on the sale, then takes it out of stock and marks it sold.
 *
 * Two stages on one screen, like Link items: the waiting sales, then one sale with its pack strips and
 * the scanner. Online only -- each pack is checked by the server as it is scanned. No prices here:
 * managers never see sales money.
 */
export default function SellScanScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const network = useNetworkState();
  const offline = network.isConnected === false;

  const [saleId, setSaleId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');

  const { data: waiting, isLoading } = useGetData<ScanSale[]>('/sale-scans', ['sale-scans']);
  const { data: sale } = useGetData<ScanSaleDetail>(`/sale-scans/${saleId ?? ''}`, ['sale-scans', saleId], {
    enabled: saleId !== null,
  });

  const progress = sale ? saleProgress(sale) : null;
  const done = progress?.done ?? false;

  const session = useScanSession({
    plan: { action: 'sell' },
    mode,
    confirmLabel: 'Sell this pack',
    commit: async (unit) => {
      await apiFetch<ScanResult>(`/sale-scans/${saleId}/scan`, {
        method: 'POST',
        body: JSON.stringify({ stock_unit_id: unit.id }),
      });
    },
    // The sale's counts are live; the waiting list and stock lists catch up when scanning stops.
    refresh: { live: [['sale-scans', saleId]], after: [['sale-scans'], ['stock-units']] },
  });

  // The last pack in: close the camera after a beat, so the flash and the sound land first.
  useEffect(() => {
    if (!scanning || !done) return;
    const t = setTimeout(() => {
      session.close();
      setScanning(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [scanning, done, session]);

  const choose = (next: string | null) => {
    setSaleId(next);
    session.reset();
  };

  // Opening a sale is a step inside this screen: every "back" returns to the list instead of leaving.
  usePreventRemove(saleId !== null, () => choose(null));

  if (saleId === null) {
    return (
      <Screen>
        <Header title="Sold packs" leading="back" />
        {isLoading ? (
          <View style={styles.list}>
            <Skeleton height={104} />
            <Skeleton height={104} />
          </View>
        ) : (waiting ?? []).length === 0 ? (
          <View style={styles.list}>
            <EmptyState
              icon="check-circle"
              tint="tintGreen"
              title="No packs waiting."
              body="When a QR sale is recorded on the dashboard, its packs show up here to scan out."
            />
          </View>
        ) : (
          <View style={styles.list}>
            {(waiting ?? []).map((s) => (
              <SaleCard key={s.id} sale={s} onPress={() => choose(s.id)} />
            ))}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Sold packs" leading="back" />
      {!sale || !progress ? (
        <View style={styles.list}>
          <Skeleton height={160} />
        </View>
      ) : (
        <>
          <View style={styles.saleHead}>
            <AppText variant="h2">{sale.customer_name ?? 'Walk-in'}</AppText>
            <AppText variant="caption" color="muted">
              Sold on {formatDate(sale.sale_date)}
            </AppText>
          </View>

          <Card style={styles.card}>
            <View style={styles.countRow}>
              <AppText variant="stat" color={done ? 'success' : 'ink'}>
                {progress.scanned} of {progress.needed}
              </AppText>
              <AppText variant="caption" color="muted">
                {done ? 'all scanned' : `${progress.needed - progress.scanned} left to scan`}
              </AppText>
            </View>
            {sale.lines.map((l) => (
              <View key={l.id} style={styles.line}>
                <View style={styles.lineHead}>
                  <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                    {l.item_name}
                  </AppText>
                  <AppText variant="bodyStrong" color={l.scanned >= l.quantity ? 'success' : 'ink'}>
                    {l.scanned} of {l.quantity}
                  </AppText>
                </View>
                <BottleStrip linked={l.scanned} total={l.quantity} height={12} />
              </View>
            ))}
          </Card>

          {offline ? (
            <View style={[styles.banner, { backgroundColor: theme.tintRed }]}>
              <Icon name="wifi-off" size={20} color="critical" />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Scanning needs a connection.</AppText>
                <AppText variant="caption" color="muted">
                  Each pack is checked against the server as you scan.
                </AppText>
              </View>
            </View>
          ) : done ? (
            <View style={[styles.banner, { backgroundColor: theme.tintGreen }]}>
              <Icon name="check-circle" size={20} color="success" />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">All packs scanned.</AppText>
                <AppText variant="caption" color="muted">
                  They are out of stock and marked sold. Go back for the next sale.
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <View style={styles.modeField}>
                <ScanModeField value={mode} onChange={setMode} />
              </View>
              <Button
                label="Scan packs"
                icon="camera"
                onPress={() => {
                  // Another phone may have scanned some since this sale was loaded.
                  void queryClient.invalidateQueries({ queryKey: ['sale-scans', saleId] });
                  setScanning(true);
                }}
              />
            </View>
          )}

          <ScanResults rows={session.rows} done="sold" />

          {sale.bottles.length > 0 && (
            <>
              <View style={styles.sectionHead}>
                <AppText variant="h2">Scanned</AppText>
              </View>
              <Card rows>
                {sale.bottles.map((b, i) => (
                  <LedgerRow key={b.id} last={i === sale.bottles.length - 1}>
                    <AppText variant="data">…{b.id.slice(-7)}</AppText>
                    <AppText variant="caption" color="muted">
                      {sale.lines.find((l) => l.id === b.line_id)?.item_name}, {Number(b.size)} {b.unit.toLowerCase()}
                    </AppText>
                  </LedgerRow>
                ))}
              </Card>
            </>
          )}

          <QrScanner
            key={session.generation}
            open={scanning}
            onClose={() => {
              session.close();
              setScanning(false);
            }}
            context={sale.customer_name ?? 'Walk-in'}
            onScan={session.onScan}
            rows={session.rows}
            onScanned={session.onScanned}
            pending={session.pending}
            offline={offline}
            remaining={Math.max(0, progress.needed - progress.scanned)}
            parallel={session.parallel}
          />
        </>
      )}
    </Screen>
  );
}

/** A waiting sale: who bought it, when, and one strip per item with its count. */
function SaleCard({ sale, onPress }: { sale: ScanSale; onPress: () => void }) {
  const { scanned, needed } = saleProgress(sale);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sale.customer_name ?? 'Walk-in'}, ${scanned} of ${needed} packs scanned`}
    >
      <Card>
        <View style={styles.cardHead}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {sale.customer_name ?? 'Walk-in'}
            </AppText>
            <AppText variant="caption" color="muted">
              Sold on {formatDate(sale.sale_date)}
            </AppText>
          </View>
          <AppText variant="h2">
            {scanned} of {needed}
          </AppText>
          <Icon name="chevron-right" size={20} color="muted" />
        </View>
        {sale.lines.map((l) => (
          <View key={l.id} style={styles.line}>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {l.item_name}
            </AppText>
            <BottleStrip linked={l.scanned} total={l.quantity} />
          </View>
        ))}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.md, marginTop: Spacing.lg },
  saleHead: { marginTop: Spacing.sm, gap: Spacing.xs },
  card: { marginTop: Spacing.md, gap: Spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  line: { gap: Spacing.sm, marginTop: Spacing.sm },
  lineHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md },
  sectionHead: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  modeField: { marginBottom: Spacing.md },
  actions: { gap: Spacing.xs, marginTop: Spacing.md },
  banner: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.md,
  },
});
