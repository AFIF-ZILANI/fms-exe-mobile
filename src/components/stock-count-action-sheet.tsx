import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import { Button } from '@/components/ui/button';
import { HousePicker } from '@/components/ui/house-picker';
import { Icon } from '@/components/ui/icon';
import { PillSelect } from '@/components/ui/pill-select';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch, useGetData } from '@/lib/api';
import {
  canConsume,
  consumeBlockReason,
  daysAgo,
  farmDateParam,
  type CountBatch,
  type CountUnit,
} from '@/lib/stock-count';
import type { House } from '@/lib/types';
import { alreadyDone } from '@/lib/stock-count';

export type CountAction = 'CONSUMED' | 'START' | 'MOVE' | 'RETURN' | 'DISPOSE';

/** One unit's outcome: what was done, or why it wasn't. */
export type ActionResult = { ok: true; label: string } | { ok: false; message: string };

type Props = {
  units: CountUnit[];
  /** The counted place. A unit missing from a house can be returned; one missing from a warehouse can't. */
  location: { type: 'WAREHOUSE' | 'HOUSE'; house: House | null };
  onClose: () => void;
  onDone: (results: Map<string, ActionResult>) => void;
};

const DAY_CHOICES = [0, 1, 2, 3, 4, 5, 6];
const dayLabel = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`);

/**
 * What to do with units the count didn't find: used up somewhere (the cost goes to the batch that was in
 * that house that day), opened, moved, returned, or written off. One call per unit, each with a key kept
 * across retries, so tapping again after a dropped connection can't record a unit twice.
 */
export function StockCountActionSheet({ units, location, onClose, onDone }: Props) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const consumable = canConsume(units);
  const options: { value: CountAction; label: string }[] = [
    ...(consumable ? [{ value: 'CONSUMED' as const, label: 'Used up' }] : []),
    { value: 'START', label: 'Start using' },
    { value: 'MOVE', label: 'Move to house' },
    ...(location.type === 'HOUSE' ? [{ value: 'RETURN' as const, label: 'Return to warehouse' }] : []),
    { value: 'DISPOSE', label: 'Disposed' },
  ];
  const [action, setAction] = useState<CountAction>(options[0]!.value);
  const [house, setHouse] = useState<House | null>(location.house);
  const [ago, setAgo] = useState(0);
  const [busy, setBusy] = useState(false);
  const keys = useRef(new Map<string, string>());
  const keyFor = (id: string) => {
    const k = `${id}:${action}:${house?.id ?? ''}:${ago}`;
    if (!keys.current.has(k)) keys.current.set(k, Crypto.randomUUID());
    return keys.current.get(k)!;
  };

  const needsHouse = action === 'CONSUMED' || action === 'START' || action === 'MOVE';
  const date = daysAgo(ago);
  const batchQuery = useGetData<{ batch: CountBatch }>(
    house ? `/houses/${house.id}/batch-on?date=${farmDateParam(date)}` : '',
    ['house-batch-on', house?.id ?? 'none', farmDateParam(date)],
    { enabled: action === 'CONSUMED' && !!house },
  );
  const blocked =
    action === 'CONSUMED'
      ? house
        ? batchQuery.data
          ? consumeBlockReason(batchQuery.data.batch)
          : 'loading'
        : 'house'
      : null;
  const ready = !busy && (!needsHouse || !!house) && blocked === null;

  const n = units.length;
  const what = n === 1 ? units[0]!.item.name : `${n} units`;
  const verb: Record<CountAction, string> = {
    CONSUMED: `Mark ${what} used up`,
    START: `Start using ${what}`,
    MOVE: `Move ${what} to ${house?.name ?? 'house'}`,
    RETURN: `Return ${what} to warehouse`,
    DISPOSE: `Dispose ${what}`,
  };
  const done: Record<CountAction, string> = {
    CONSUMED: `Used up in ${house?.name ?? ''}`,
    START: `In use in ${house?.name ?? ''}`,
    MOVE: `Moved to ${house?.name ?? ''}`,
    RETURN: 'Returned to warehouse',
    DISPOSE: 'Disposed',
  };

  const run = async () => {
    setBusy(true);
    const results = new Map<string, ActionResult>();
    // One at a time: the server rate-limits, and a count resolves a handful of units, not hundreds.
    for (const u of units) {
      const idempotency_key = keyFor(u.id);
      const post = (path: string, body?: object) =>
        apiFetch(`/stock-units/${u.id}/${path}`, {
          method: 'POST',
          ...(body && { body: JSON.stringify(body) }),
        });
      try {
        if (action === 'CONSUMED' || action === 'START') {
          await post('use', {
            action: action === 'CONSUMED' ? 'FINISH' : 'START',
            house_id: house!.id,
            date: date.toISOString(),
            move_here: true,
            idempotency_key,
          });
        } else if (action === 'MOVE' || action === 'RETURN') {
          await post('relocate', {
            house_id: action === 'MOVE' ? house!.id : null,
            idempotency_key,
          });
        } else {
          await post('dispose');
        }
        results.set(u.id, { ok: true, label: done[action] });
      } catch (err) {
        // A retry after a lost response finds the unit already in the state asked for: that's done, not failed.
        if (err instanceof ApiError && alreadyDone(action, err)) results.set(u.id, { ok: true, label: done[action] });
        else
          results.set(u.id, {
            ok: false,
            message: err instanceof ApiError ? err.message : "Couldn't reach the server.",
          });
      }
    }
    setBusy(false);
    onDone(results);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.ground }, elevation(scheme, 'sheet')]}
        edges={['bottom']}
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="h2">What happened?</AppText>
            <AppText variant="caption" color="muted">
              {n === 1 ? units[0]!.item.name : `${n} missing units`}
            </AppText>
          </View>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={[styles.close, { backgroundColor: theme.surfaceAlt }]}
          >
            <Icon name="x" size={20} color="inkSoft" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <PillSelect options={options} value={action} onChange={setAction} />
          {!consumable && units.some((u) => u.item.category === 'EQUIPMENT') ? (
            <AppText variant="caption" color="muted">
              Equipment isn&apos;t used up. Dispose it when it&apos;s done.
            </AppText>
          ) : null}

          {needsHouse ? (
            <HousePicker value={house} onChange={setHouse} label={action === 'CONSUMED' ? 'Used in' : 'House'} />
          ) : null}

          {action === 'CONSUMED' ? (
            <View style={styles.group}>
              <AppText variant="eyebrow" color="muted">
                When
              </AppText>
              <PillSelect
                options={DAY_CHOICES.map((d) => ({
                  value: String(d),
                  label: dayLabel(d),
                }))}
                value={String(ago)}
                onChange={(v) => setAgo(Number(v))}
              />
              <View style={[styles.batch, { backgroundColor: theme.surfaceAlt }]}>
                {!house ? (
                  <AppText variant="caption" color="muted">
                    Pick the house it was used in to see which batch pays for it.
                  </AppText>
                ) : batchQuery.isLoading ? (
                  <Skeleton width="60%" height={18} />
                ) : blocked && blocked !== 'loading' ? (
                  <AppText variant="caption" color="critical">
                    {blocked}
                  </AppText>
                ) : batchQuery.data?.batch ? (
                  <AppText variant="label">
                    Cost goes to {batchQuery.data.batch.batch_code}
                    {batchQuery.data.batch.status === 'SOLD' ? ' (sold, still open)' : ''}
                  </AppText>
                ) : null}
              </View>
            </View>
          ) : null}

          {action === 'DISPOSE' ? (
            <AppText variant="caption" color="muted">
              Written off. What was left in it leaves stock and no batch pays for it.
            </AppText>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={verb[action]}
            variant={action === 'DISPOSE' ? 'destructive' : 'primary'}
            onPress={run}
            disabled={!ready}
            loading={busy}
            block
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.lg, gap: Spacing.lg },
  group: { gap: Spacing.sm },
  batch: { borderRadius: Radius.control, padding: Spacing.md },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
});
