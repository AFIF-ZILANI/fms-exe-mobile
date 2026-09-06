import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { classifyScan, markSent, newScanState, releaseScan } from '@/lib/scan';

export type ScanRow = {
  id: string;
  /** Tail of the code, which is how the label is read. */
  label: string;
  state: 'ok' | 'error';
  message?: string;
};

type QrScannerProps = {
  open: boolean;
  onClose: () => void;
  /** Shown in the header so the operator can see what they're linking into. */
  context: string;
  /** Performs the bind. Resolves to null on success, or a message to show. */
  onScan: (id: string) => Promise<string | null>;
  /** Rows for this session, newest first. Owned by the parent. */
  rows: ScanRow[];
  /** Emits one row per completed attempt; the parent prepends it. Passing a
   *  single row rather than the whole array means this component never needs
   *  to read the current list, so no ref-during-render. */
  onScanned: (row: ScanRow) => void;
  /** Blocks scanning — this screen deliberately requires a connection. */
  offline?: boolean;
};

/**
 * Continuous QR scanning against one target. The camera stays open and the
 * operator works through a pallet without returning to a form between codes —
 * the whole point of the screen. docs/layout/18-link-items.md.
 */
export function QrScanner({
  open,
  onClose,
  context,
  onScan,
  rows,
  onScanned,
  offline,
}: QrScannerProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<null | { state: 'ok' | 'error'; text: string }>(null);

  // Session state is a ref, not React state: onBarcodeScanned fires many times
  // a second and every one of them must see the latest set, not a value closed
  // over from the last render.
  const session = useRef(newScanState());
  const inFlight = useRef(false);

  const show = (state: 'ok' | 'error', text: string) => {
    setFlash({ state, text });
    setTimeout(() => setFlash(null), 1400);
  };

  const handle = useCallback(
    async (payload: string) => {
      if (offline || inFlight.current) return;

      const outcome = classifyScan(session.current, payload, Date.now());

      // Duplicates and cooldown hits are silent: a label sitting in frame is
      // normal, and reporting it as an error would make the screen unusable.
      if (outcome.kind === 'cooldown' || outcome.kind === 'duplicate') return;

      if (outcome.kind === 'invalid') {
        show('error', 'Not a ZeroD stock code');
        return;
      }

      inFlight.current = true;
      markSent(session.current, outcome.id);

      try {
        const error = await onScan(outcome.id);
        const label = `…${outcome.id.slice(-7)}`;

        if (error) {
          // Released so the operator can fix the problem and rescan the same
          // label without waiting out a session.
          releaseScan(session.current, outcome.id);
          show('error', error);
          onScanned({ id: outcome.id, label, state: 'error', message: error });
          return;
        }

        show('ok', `Linked ${label}`);
        onScanned({ id: outcome.id, label, state: 'ok' });
      } finally {
        inFlight.current = false;
      }
    },
    [offline, onScan, onScanned],
  );

  const linked = rows.filter((r) => r.state === 'ok').length;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: '#000' }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Stop scanning"
              style={styles.close}
            >
              <Icon name="x" size={24} color="onPrimary" />
            </Pressable>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" style={styles.onDark} numberOfLines={1}>
                {context}
              </AppText>
              <AppText variant="caption" style={styles.onDarkMuted}>
                {linked} linked
              </AppText>
            </View>
          </View>

          <View style={styles.viewport}>
            {offline ? (
              <Blocked
                icon="wifi-off"
                title="Linking needs a connection."
                body="Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can."
              />
            ) : !permission ? (
              <Blocked icon="camera" title="Starting the camera…" />
            ) : !permission.granted ? (
              <Blocked
                icon="camera-off"
                title="Camera access is off."
                body="ZeroD Farms needs the camera to read the code printed on each unit."
                action={{ label: 'Allow camera', onPress: () => void requestPermission() }}
              />
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => void handle(data)}
                />
                <View style={styles.reticle} pointerEvents="none">
                  <View style={[styles.frame, { borderColor: flashColor(flash, theme) }]} />
                </View>
              </>
            )}

            {flash ? (
              <View
                style={[
                  styles.flash,
                  { backgroundColor: flash.state === 'ok' ? theme.primary : theme.critical },
                ]}
              >
                <Icon name={flash.state === 'ok' ? 'check' : 'alert-circle'} size={20} color="onPrimary" />
                <AppText variant="label" color="onPrimary" style={styles.flex} numberOfLines={2}>
                  {flash.text}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={[styles.panel, { backgroundColor: theme.surface }]}>
            <View style={styles.panelHead}>
              <AppText variant="eyebrow" color="muted">
                This session
              </AppText>
              <AppText variant="figure" color={linked > 0 ? 'success' : 'muted'}>
                {linked}
              </AppText>
            </View>

            {rows.length === 0 ? (
              <AppText variant="caption" color="muted">
                Point the camera at a code. The camera stays open — scan the whole
                pallet without stopping.
              </AppText>
            ) : (
              <ScrollView style={styles.rows} keyboardShouldPersistTaps="handled">
                {rows.map((row, i) => (
                  <View key={`${row.id}-${i}`} style={styles.row}>
                    <Icon
                      name={row.state === 'ok' ? 'check-circle' : 'alert-circle'}
                      size={16}
                      color={row.state === 'ok' ? 'success' : 'critical'}
                    />
                    <AppText variant="data" color={row.state === 'ok' ? 'ink' : 'muted'}>
                      {row.label}
                    </AppText>
                    {row.message ? (
                      <AppText variant="caption" color="critical" style={styles.flex} numberOfLines={1}>
                        {row.message}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.done}>
              <Button label="Done" onPress={onClose} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function flashColor(flash: { state: 'ok' | 'error' } | null, theme: ReturnType<typeof useTheme>) {
  if (!flash) return 'rgba(255,255,255,0.6)';
  return flash.state === 'ok' ? theme.primary : theme.critical;
}

function Blocked({
  icon,
  title,
  body,
  action,
}: {
  icon: 'wifi-off' | 'camera' | 'camera-off';
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.blocked}>
      <Icon name={icon} size={32} color="onPrimary" />
      <AppText variant="h2" style={styles.onDark}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" style={[styles.onDarkMuted, styles.centre]}>
          {body}
        </AppText>
      ) : null}
      {action ? (
        <View style={styles.blockedAction}>
          <Button label={action.label} onPress={action.onPress} block={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,0.72)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewport: { flex: 1, overflow: 'hidden' },
  reticle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 220, height: 220, borderWidth: 3, borderRadius: Radius.card },
  flash: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xxl,
  },
  blockedAction: { marginTop: Spacing.sm },
  panel: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Spacing.xl,
    gap: Spacing.md,
    maxHeight: '42%',
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rows: { maxHeight: 132 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  done: { marginTop: Spacing.xs },
});
