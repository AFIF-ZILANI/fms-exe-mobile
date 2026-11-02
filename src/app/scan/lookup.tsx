import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { categoryIcon } from '@/components/stock-item-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { Icon, IconTile } from '@/components/ui/icon';
import { QrScanner, type ScanLabels, type ScanRow } from '@/components/ui/qr-scanner';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { codeTail } from '@/lib/house-stock';
import { isRetryable, scanErrorMessage, type Settled } from '@/lib/scan';
import { unitStatus, type UnitProfile } from '@/lib/unit-profile';
import type { StockUnit } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'found',
  flashOk: 'Found',
  offlineTitle: 'Looking up a code needs a connection.',
  offlineBody: 'The details come from the server, so this screen needs a connection. Everything else in the app works offline.',
  hint: 'Point the camera at any code to see what it is and everything that happened to it.',
  full: '',
};

/** Typing the end of a code finds it once at least this much is typed. */
const MIN_QUERY = 3;

/** "Look up a code": scan any QR label (or type the end of it when it won't scan) and open everything known
 *  about that unit. The camera opens straight away, since scanning is why someone came here. */
export default function LookupScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;
  const [scanning, setScanning] = useState(true);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [query, setQuery] = useState('');

  const open = (id: string) => router.push(`/stock-unit/${id}` as Href);

  // Fetched here so a wrong label fails in the camera, with a buzz, instead of on an empty details screen.
  // The details screen then opens from this cache.
  const look = async (id: string): Promise<Settled> => {
    try {
      const p = await queryClient.fetchQuery({
        queryKey: ['stock-unit-profile', id],
        queryFn: () => apiFetch<UnitProfile>(`/stock-units/${id}/profile`),
      });
      return { ok: true, label: p.item?.name ?? codeTail(id) };
    } catch (err) {
      if (err instanceof ApiError) return { ok: false, message: scanErrorMessage(err.status, err.message), retryable: isRetryable(err.status) };
      return { ok: false, message: "Couldn't reach the server.", retryable: true };
    }
  };

  const trimmed = query.trim();
  const search = useGetData<Paginated<StockUnit>>(
    trimmed.length >= MIN_QUERY ? `/stock-units?q=${encodeURIComponent(trimmed)}&limit=10` : '',
    ['stock-units', 'lookup', trimmed],
    { enabled: trimmed.length >= MIN_QUERY },
  );

  return (
    <Screen>
      <Header title="Look up a code" leading="back" />

      <Card style={styles.hero}>
        <IconTile name="maximize" tint="primarySoft" color="primary" size={56} />
        <AppText variant="h2" style={styles.centre}>
          Scan a QR code
        </AppText>
        <AppText variant="caption" color="muted" style={styles.centre}>
          See what it is, where it is and how much is left, the purchase it came from, and every move and use.
        </AppText>
        <View style={styles.cta}>
          <Button label="Scan a code" block onPress={() => setScanning(true)} />
        </View>
      </Card>

      <Card style={styles.gap}>
        <AppText variant="bodyStrong">Label won&apos;t scan?</AppText>
        <AppText variant="caption" color="muted">
          Type the characters printed under the code. The last few are enough.
        </AppText>
        <View style={styles.field}>
          <TextField
            label="Code"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. 3d4e5f6"
          />
        </View>
        {trimmed.length >= MIN_QUERY ? (
          search.isPending ? (
            <Skeleton height={56} />
          ) : (search.data?.results.length ?? 0) === 0 ? (
            <AppText variant="caption" color="muted">
              No code matches “{trimmed}”.
            </AppText>
          ) : (
            search.data!.results.map((u, i) => {
              const item = u.purchase_item?.item ?? null;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => open(u.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.result,
                    i > 0 && { borderTopWidth: 1, borderTopColor: theme.line },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <IconTile name={item ? categoryIcon(item.category) : 'maximize'} tint="surfaceAlt" color="muted" size={32} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item?.name ?? 'Unlinked code'}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {codeTail(u.id)} · {unitStatus(u.status, item?.category ?? null).label}
                    </AppText>
                  </View>
                  <Icon name="chevron-right" size={20} color="muted" />
                </Pressable>
              );
            })
          )
        ) : null}
      </Card>

      {/* Mounted only while open: each scan starts a fresh session, so the same code can be looked up again. */}
      {scanning ? (
        <QrScanner
          open
          onClose={() => setScanning(false)}
          context="Look up a code"
          labels={LABELS}
          offline={offline}
          onScan={look}
          rows={rows}
          onScanned={(row) => {
            setRows((r) => [row, ...r]);
            if (row.state !== 'ok') return;
            setScanning(false);
            open(row.id);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, paddingVertical: Spacing.xl },
  centre: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: Spacing.md },
  gap: { marginTop: Spacing.lg, gap: Spacing.sm },
  field: { marginTop: Spacing.xs },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
});
