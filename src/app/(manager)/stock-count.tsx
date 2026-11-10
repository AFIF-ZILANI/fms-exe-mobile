import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { categoryIcon } from '@/components/stock-item-row';
import { StockCountActionSheet, type ActionResult } from '@/components/stock-count-action-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormCard } from '@/components/ui/form-card';
import { Header } from '@/components/ui/header';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { Icon, IconTile } from '@/components/ui/icon';
import { ItemPicker } from '@/components/ui/item-picker';
import { PickerField } from '@/components/ui/picker-field';
import { QrScanner, type ScanLabels, type ScanRow } from '@/components/ui/qr-scanner';
import { Screen } from '@/components/ui/screen';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { SubmitBar } from '@/components/ui/submit-bar';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { codeTail } from '@/lib/house-stock';
import { isRetryable, scanErrorMessage, type Settled } from '@/lib/scan';
import { diffCount, strayNote, type CountUnit, type Stray } from '@/lib/stock-count';
import type { Item, StockUnit, Warehouse } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'counted',
  flashOk: 'Counted',
  offlineTitle: 'Counting needs a connection.',
  offlineBody: 'The list of what should be here comes from the server, so this screen needs a connection.',
  hint: 'Scan every code you can see. The camera stays open; nothing is changed until you review.',
  full: '',
};

type Kind = 'warehouse' | 'house';

/**
 * Stock count: scan everything at one place, then see what the system expected but nobody scanned --
 * bottles used without a scan whose labels are gone. Each missing unit gets what really happened to it
 * (used up, opened, moved, returned, disposed), alone or in bulk. Nothing is written while scanning; no
 * count record is kept, each unit's own history shows the fix.
 * docs/superpowers/specs/2026-11-08-batch-settlement-and-stock-count-design.md
 */
export default function StockCountScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [kind, setKind] = useState<Kind>(params.house_id ? 'house' : 'warehouse');
  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [started, setStarted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [scanned, setScanned] = useState<string[]>([]);
  // Codes are checked several at a time (parallel scanner), so "seen" can't wait for a re-render.
  const seen = useRef(new Set<string>());
  // Names of units acted on, kept for the Fixed list after they drop off the refetched expected list.
  const [names, setNames] = useState(() => new Map<string, string>());
  const [strays, setStrays] = useState(() => new Map<string, StockUnit | null>());
  const [resolved, setResolved] = useState(() => new Map<string, ActionResult>());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<CountUnit[] | null>(null);
  const [movingStray, setMovingStray] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [typedMsg, setTypedMsg] = useState<string | null>(null);
  // Remounted after each counted code: on Android, setting value to '' leaves the keyboard's
  // in-progress word in the native field, and the next code gets typed onto the end of it.
  const [fieldKey, setFieldKey] = useState(0);

  const { data: warehouses, isLoading: warehousesLoading } = useGetData<Paginated<Warehouse>>('/warehouses?limit=100', [
    'warehouses',
  ]);

  const locationId = kind === 'house' ? house?.id : warehouse?.id;
  const locationType = kind === 'house' ? 'HOUSE' : 'WAREHOUSE';
  const placeName = kind === 'house' ? house?.name : warehouse?.name;
  const query = new URLSearchParams({
    location_type: locationType,
    location_id: locationId ?? '',
  });
  if (item) query.set('item_id', item.id);
  const expected = useGetData<{ units: CountUnit[] }>(
    `/stock-units/at-location?${query.toString()}`,
    ['stock-units', 'at-location', locationType, locationId ?? 'none', item?.id ?? 'all'],
    // Never served from cache: a count is only as good as the list it checks against, so each count starts
    // from the server's current view. Refetches after a fix are fine -- a fixed unit leaves the list for real.
    { enabled: started && !!locationId, gcTime: 0 },
  );
  const units = useMemo(() => expected.data?.units ?? [], [expected.data]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const result = useMemo(() => diffCount(units, scanned, strays), [units, scanned, strays]);
  const missing = result.missing.filter((u) => !resolved.get(u.id)?.ok);
  // From the results, not the expected list: once a unit is used up or disposed the refetched list no
  // longer has it, but the manager still wants to see what was done.
  const fixed = [...resolved.entries()]
    .filter((e): e is [string, { ok: true; label: string }] => e[1].ok)
    .map(([id, r]) => ({ id, label: r.label }));

  // A code is checked against the expected list locally; anything else is looked up so the review can
  // say where the system thinks it is. Nothing is written here.
  const onScan = async (id: string): Promise<Settled> => {
    if (seen.current.has(id))
      return {
        ok: false,
        message: 'Already counted',
        retryable: false,
        duplicate: true,
      };
    const own = byId.get(id);
    if (own) {
      seen.current.add(id);
      setScanned((s) => [...s, id]);
      return { ok: true, label: own.item.name };
    }
    try {
      const unit = await apiFetch<StockUnit>(`/stock-units/${id}`);
      seen.current.add(id);
      setStrays((m) => new Map(m).set(id, unit));
      setScanned((s) => [...s, id]);
      return {
        ok: true,
        label: `${unit.purchase_item?.item.name ?? 'Unlinked code'} · not recorded here`,
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        seen.current.add(id);
        setStrays((m) => new Map(m).set(id, null));
        setScanned((s) => [...s, id]);
      }
      if (err instanceof ApiError)
        return {
          ok: false,
          message: scanErrorMessage(err.status, err.message),
          retryable: isRetryable(err.status),
        };
      return {
        ok: false,
        message: "Couldn't reach the server.",
        retryable: true,
      };
    }
  };

  // The printed characters under a torn label: matched against what should be here first, then the server.
  const typeCode = async () => {
    const tail = code.trim().toLowerCase();
    if (tail.length < 3) return;
    const local = units.filter((u) => u.id.endsWith(tail));
    let id = local.length === 1 ? local[0]!.id : undefined;
    if (!id) {
      try {
        const found = await apiFetch<Paginated<StockUnit>>(`/stock-units?q=${encodeURIComponent(tail)}&limit=2`);
        if (found.results.length === 1) id = found.results[0]!.id;
        else setTypedMsg(found.results.length ? 'More than one code matches. Type more of it.' : 'No code matches.');
      } catch {
        setTypedMsg("Couldn't reach the server.");
      }
    }
    if (!id) return;
    const r = await onScan(id);
    setTypedMsg(r.ok ? `Counted: ${r.label ?? codeTail(id)}` : r.message);
    if (r.ok) {
      setCode('');
      setFieldKey((k) => k + 1);
    }
  };

  const finishActions = (results: Map<string, ActionResult>) => {
    const named = new Map<string, string>();
    for (const id of results.keys()) {
      const name = byId.get(id)?.item.name ?? strays.get(id)?.purchase_item?.item.name;
      if (name) named.set(id, name);
    }
    setNames((m) => new Map([...m, ...named]));
    setResolved((m) => new Map([...m, ...results]));
    setSelected((s) => new Set([...s].filter((id) => !results.get(id)?.ok)));
    setActing(null);
    void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    void queryClient.invalidateQueries({ queryKey: ['houses'] });
  };

  // "Found here": the system has it elsewhere; put its record where it physically is.
  const moveHere = async (s: Stray) => {
    setMovingStray(s.id);
    try {
      await apiFetch(`/stock-units/${s.id}/relocate`, {
        method: 'POST',
        body: JSON.stringify({
          house_id: kind === 'house' ? house!.id : null,
          idempotency_key: Crypto.randomUUID(),
        }),
      });
      finishActions(new Map([[s.id, { ok: true, label: `Moved to ${placeName ?? 'here'}` }]]));
    } catch (err) {
      finishActions(
        new Map([
          [
            s.id,
            {
              ok: false,
              message: err instanceof ApiError ? err.message : "Couldn't reach the server.",
            },
          ],
        ]),
      );
    } finally {
      setMovingStray(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = missing.length > 0 && missing.every((u) => selected.has(u.id));

  const restart = () => {
    queryClient.removeQueries({ queryKey: ['stock-units', 'at-location'] });
    setStarted(false);
    setScanned([]);
    seen.current = new Set();
    setStrays(new Map());
    setResolved(new Map());
    setSelected(new Set());
    setRows([]);
    setCode('');
    setTypedMsg(null);
    setFieldKey((k) => k + 1);
  };

  if (!started) {
    return (
      <Screen>
        <Header title="Count stock" leading="back" />
        <AppText variant="caption" color="muted" style={styles.lead}>
          Scan every coded item at one place. Anything the system expects there that you don&apos;t scan shows up as
          missing, and you say what happened to it.
        </AppText>
        <FormCard title="Where are you counting?">
          <SegmentedToggle
            options={[
              { value: 'warehouse', label: 'Warehouse' },
              { value: 'house', label: 'House' },
            ]}
            value={kind}
            onChange={setKind}
          />
          {kind === 'house' ? (
            <HousePicker value={house} onChange={setHouse} />
          ) : (
            <PickerField
              label="Warehouse"
              value={warehouse}
              options={warehouses?.results ?? []}
              getKey={(w) => w.id}
              getLabel={(w) => w.name}
              onChange={setWarehouse}
              loading={warehousesLoading}
              emptyLabel="No warehouses."
            />
          )}
          <ItemPicker
            value={item}
            onChange={setItem}
            unitTracked
            placeholder="All items"
            onClear={() => setItem(null)}
          />
        </FormCard>
        <View style={styles.cta}>
          <Button
            label="Start counting"
            block
            disabled={!locationId || offline}
            onPress={() => {
              setStarted(true);
              setScanning(true);
            }}
          />
          {offline ? (
            <AppText variant="caption" color="muted" style={styles.centre}>
              Counting needs a connection.
            </AppText>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.ground }]}>
      <Screen bottomInset={Spacing.xl}>
        <Header title="Count stock" leading="back" />

        <Card style={styles.summary}>
          <AppText variant="eyebrow" color="muted">
            {placeName}
            {item ? ` · ${item.name}` : ''}
          </AppText>
          {expected.isLoading ? (
            <Skeleton width="50%" height={28} />
          ) : expected.isError ? (
            <AppText color="critical">Couldn&apos;t load what should be here. Go back and try again.</AppText>
          ) : (
            <>
              <AppText variant="stat">
                {result.counted.length} of {units.length}
              </AppText>
              <AppText variant="caption" color="muted">
                counted · {result.missing.length} missing
                {result.foundHere.length ? ` · ${result.foundHere.length} not recorded here` : ''}
              </AppText>
            </>
          )}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label="Keep scanning" variant="secondary" onPress={() => setScanning(true)} block />
            </View>
            <View style={styles.flex}>
              <Button label="Start over" variant="ghost" onPress={restart} block />
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <AppText variant="bodyStrong">Label won&apos;t scan?</AppText>
          <TextField
            key={fieldKey}
            label="Type the end of the code"
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setTypedMsg(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            selectTextOnFocus
            // Android: a plain keyboard with no word composition. Gboard otherwise keeps its in-progress
            // "word" and types the next code onto the end of the last one.
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            placeholder="e.g. 3d4e5f6"
            onSubmitEditing={typeCode}
            returnKeyType="done"
            helper={typedMsg ?? undefined}
          />
          <Button
            label="Count this code"
            variant="secondary"
            onPress={typeCode}
            disabled={code.trim().length < 3}
            block
          />
        </Card>

        {missing.length > 0 ? (
          <Card
            eyebrow={`Missing · ${missing.length}`}
            rows
            style={styles.section}
            action={allSelected ? 'NONE' : 'ALL'}
            onActionPress={() => setSelected(allSelected ? new Set() : new Set(missing.map((u) => u.id)))}
          >
            {missing.map((u, i) => {
              const on = selected.has(u.id);
              const failed = resolved.get(u.id);
              return (
                <View key={u.id} style={[styles.unit, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                  <Pressable
                    onPress={() => toggle(u.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Select ${u.item.name} ${codeTail(u.id)}`}
                    hitSlop={8}
                    style={[
                      styles.check,
                      {
                        borderColor: on ? theme.primary : theme.line,
                        backgroundColor: on ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {on ? <Icon name="check" size={16} color="onPrimary" /> : null}
                  </Pressable>
                  <IconTile name={categoryIcon(u.item.category)} tint="surfaceAlt" color="muted" size={32} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {u.item.name}
                    </AppText>
                    <AppText variant="caption" color={failed && !failed.ok ? 'critical' : 'muted'} numberOfLines={2}>
                      {failed && !failed.ok
                        ? failed.message
                        : `${codeTail(u.id)} · ${u.status === 'IN_USE' ? 'in use' : 'in storage'}`}
                    </AppText>
                  </View>
                  <Button label="Action" variant="ghost" onPress={() => setActing([u])} />
                </View>
              );
            })}
          </Card>
        ) : !expected.isLoading && units.length > 0 && result.missing.length === 0 ? (
          <Card style={styles.section}>
            <AppText variant="bodyStrong">Everything is here.</AppText>
            <AppText variant="caption" color="muted">
              Every unit the system expects at {placeName} was scanned.
            </AppText>
          </Card>
        ) : null}

        {result.foundHere.filter((s) => !resolved.get(s.id)?.ok).length > 0 ? (
          <Card eyebrow="Found here, recorded elsewhere" rows style={styles.section}>
            {result.foundHere
              .filter((s) => !resolved.get(s.id)?.ok)
              .map((s, i) => {
                const where = s.unit?.houseAllocations?.[0]?.house?.name ?? 'the warehouse';
                const failed = resolved.get(s.id);
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.unit,
                      i > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: theme.line,
                      },
                    ]}
                  >
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {s.unit?.purchase_item?.item.name ?? 'Unlinked code'}
                      </AppText>
                      <AppText variant="caption" color={failed && !failed.ok ? 'critical' : 'muted'} numberOfLines={2}>
                        {failed && !failed.ok ? failed.message : `${codeTail(s.id)} · system says ${where}`}
                      </AppText>
                    </View>
                    <Button
                      label="Move here"
                      variant="ghost"
                      loading={movingStray === s.id}
                      onPress={() => moveHere(s)}
                    />
                  </View>
                );
              })}
          </Card>
        ) : null}

        {result.notes.length > 0 ? (
          <Card eyebrow="Also scanned" rows style={styles.section}>
            {result.notes.map((s, i) => (
              <View key={s.id} style={[styles.unit, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {s.unit?.purchase_item?.item.name ?? codeTail(s.id)}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {strayNote(s)}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {fixed.length > 0 ? (
          <Card eyebrow={`Fixed · ${fixed.length}`} rows style={styles.section}>
            {fixed.map((u, i) => {
              const name = names.get(u.id) ?? codeTail(u.id);
              return (
                <View key={u.id} style={[styles.unit, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                  <Icon name="check-circle" size={20} color="success" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {name}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {codeTail(u.id)} · {u.label}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </Screen>

      {missing.length > 0 ? (
        <SubmitBar
          label={selected.size > 0 ? `What happened to ${selected.size} selected?` : 'Select missing units'}
          disabled={selected.size === 0}
          onPress={() => setActing(missing.filter((u) => selected.has(u.id)))}
        />
      ) : null}

      {scanning ? (
        <QrScanner
          open
          onClose={() => setScanning(false)}
          context={`Counting ${placeName ?? ''} · ${result.counted.length} of ${units.length}`}
          labels={LABELS}
          offline={offline}
          onScan={onScan}
          rows={rows}
          onScanned={(row) => setRows((r) => [row, ...r])}
          parallel
        />
      ) : null}

      {acting ? (
        <StockCountActionSheet
          units={acting}
          location={{
            type: locationType,
            house: kind === 'house' ? house : null,
          }}
          onClose={() => setActing(null)}
          onDone={finishActions}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  centre: { textAlign: 'center', marginTop: Spacing.sm },
  cta: { marginTop: Spacing.lg },
  summary: { marginTop: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  section: { marginTop: Spacing.lg },
  unit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.control / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
