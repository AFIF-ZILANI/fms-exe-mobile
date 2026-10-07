import { View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { LedgerRow } from '@/components/ui/ledger-row';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import type { ScanRow } from '@/components/ui/qr-scanner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Mode } from '@/lib/scan-actions';

/** Manual (confirm each unit) or Auto (record matching units straight away). */
export function ScanModeField({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={styles.group}>
      <AppText variant="eyebrow" color="muted">
        When I scan
      </AppText>
      <SegmentedToggle
        height={48}
        options={[
          { value: 'manual', label: 'Ask me first' },
          { value: 'auto', label: 'Record at once' },
        ]}
        value={value}
        onChange={onChange}
      />
      <AppText variant="caption" color="muted">
        {value === 'manual'
          ? 'Each unit is shown for you to confirm or cancel.'
          : 'A unit that matches is recorded straight away. Anything that does not match stops and says why.'}
      </AppText>
    </View>
  );
}

/** The session's results, newest first. Renders nothing until there is one. */
export function ScanResults({ rows, done }: { rows: ScanRow[]; done: string }) {
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.state === 'ok').length;
  return (
    <Card rows eyebrow="Scanned" note={`${ok} ${done}`} style={styles.card}>
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
          <AppText variant="bodyStrong">{row.label}</AppText>
          {row.message ? (
            <AppText variant="caption" color="critical">
              {row.message}
            </AppText>
          ) : null}
        </LedgerRow>
      ))}
    </Card>
  );
}

/** These screens check every code against the server, so they can't run offline. */
export function OfflineNote({ what }: { what: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.offline, { backgroundColor: theme.tintRed }]}>
      <Icon name="wifi-off" size={20} color="critical" />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{what} needs a connection.</AppText>
        <AppText variant="caption" color="muted">
          Each code is checked against the server as you scan. Everything else in the app still works offline.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.sm },
  card: { marginTop: Spacing.md },
  offline: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.md,
  },
});
