import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { CodeEntry } from '@/components/ui/code-entry';
import { EmptyState } from '@/components/ui/empty-state';
import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { QrScanner, type ScanRow } from '@/components/ui/qr-scanner';
import { Skeleton } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { goBack } from '@/lib/nav';
import { humanise } from '@/lib/profile-format';
import { formatBalance, usableUnits } from '@/lib/stock-summary';
import type { Item, StockUnit } from '@/lib/types';

/** GET /consumptions/:id -- the record and what this form needs before offering a fix. */
type ConsumptionDetail = {
  id: string;
  quantity: string;
  unit: string;
  base_quantity: string;
  date: string;
  fixed_at: string | null;
  fix_reason: string | null;
  fixed_by: { name: string } | null;
  recorded_by: { name: string };
  item: Item;
  house: { id: string; name: string };
  batch: { batch_code: string; status: 'RUNNING' | 'SOLD' | 'CLOSED' } | null;
  stock_unit: { id: string; status: StockUnit['status'] } | null;
  medications: { medicine_name: string }[];
  vaccinations: { vaccine_name: string; schedule_id: string | null }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const tail = (id: string) => `…${id.slice(-7)}`;
const usable = (u: StockUnit) => u.status === 'BOUND' || u.status === 'IN_USE';

/**
 * "Fix usage" (docs/usage-fix-design.md): a manager corrects a wrong usage record -- amount, unit, the
 * bottle that was scanned, or the day -- or removes it. Online only: the server checks current stock and
 * bottles, so it goes straight to the API, not through the offline outbox.
 */
export default function FixUsageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGetData<ConsumptionDetail>(`/consumptions/${id}`, ['consumptions', id]);
  const c = q.data;

  if (!c) {
    return (
      <FormScreen title="Fix usage" submit={{ label: 'Save fix', onPress: () => {}, disabled: true }}>
        {q.isError ? (
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this record."
            body="Fixing needs a connection."
            action={{ label: 'Retry', onPress: () => void q.refetch() }}
          />
        ) : (
          <Skeleton height={240} />
        )}
      </FormScreen>
    );
  }
  return <FixForm c={c} />;
}

function FixForm({ c }: { c: ConsumptionDetail }) {
  const queryClient = useQueryClient();
  const item = c.item;
  const coded = c.stock_unit !== null;
  const usedUp = c.stock_unit?.status === 'CONSUMED';
  const amountEditable = item.category !== 'EQUIPMENT' && !usedUp;
  const closed = c.batch?.status === 'CLOSED';
  const units = usableUnits(item);

  const [quantity, setQuantity] = useState(formatBalance(Number(c.quantity)).replace(/,/g, ''));
  const [unitCode, setUnitCode] = useState(c.unit);
  // 'keep' = the day it was recorded on; otherwise how many days back from today.
  const [daysBack, setDaysBack] = useState('keep');
  const [bottle, setBottle] = useState<StockUnit | null>(null);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read once: `new Date()` during render is impure. The day picks are the record's day and the last few.
  const [now] = useState(() => Date.now());
  const recordedBack = Math.max(0, Math.round((now - new Date(c.date).getTime()) / DAY_MS));
  const dayOptions = [
    { value: 'keep', label: 'As recorded' },
    ...[0, 1, 2, 3]
      .filter((d) => d !== recordedBack)
      .map((d) => ({ value: String(d), label: d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago` })),
  ];

  const quantityNum = Number(quantity);
  const body: Record<string, unknown> = {};
  if (amountEditable && quantityNum > 0 && quantityNum !== Number(c.quantity)) body.quantity = quantityNum;
  if (amountEditable && unitCode !== c.unit) body.unit = unitCode;
  if (bottle) body.stock_unit_id = bottle.id;
  // Same time of day, that many days back: lands on the picked farm day without guessing its start hour.
  if (daysBack !== 'keep') body.date = new Date(now - Number(daysBack) * DAY_MS).toISOString();
  const changed = Object.keys(body).length > 0;
  const canSave = changed && reason.trim().length > 0 && !closed && (!amountEditable || quantityNum > 0);

  /** A code for the right bottle, scanned or typed: checked here so a wrong one says why straight away. */
  const pickBottle = (u: StockUnit): string | null => {
    if (u.id === c.stock_unit?.id) return "That's the bottle already on this record.";
    if (!usable(u)) return `That bottle is ${humanise(u.status).toLowerCase()}.`;
    setBottle(u);
    return null;
  };

  const typeCode = async () => {
    const t = code.trim();
    setLooking(true);
    try {
      const found = await apiFetch<Paginated<StockUnit>>(`/stock-units?q=${encodeURIComponent(t)}&limit=2`);
      if (found.results.length !== 1) {
        setCodeMsg({ ok: false, text: found.results.length ? 'More than one code matches. Type more of it.' : 'No code matches.' });
        return;
      }
      const why = pickBottle(found.results[0]!);
      setCodeMsg(why ? { ok: false, text: why } : { ok: true, text: `Picked ${tail(found.results[0]!.id)}` });
    } catch (e) {
      setCodeMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Lookup failed.' });
    } finally {
      setLooking(false);
    }
  };

  const finish = async (path: string, init: RequestInit, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(path, init);
      // A fix moves stock, batch cost, bottle status and the vaccine schedule: refetch everything shown.
      queryClient.removeQueries({ queryKey: ['consumptions', c.id] });
      await queryClient.invalidateQueries();
      Alert.alert(done);
      goBack();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? "You're offline. Fixing needs a connection." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    void finish(`/consumptions/${c.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, reason: reason.trim() }) }, 'Usage fixed');

  const links = [
    ...c.medications.map((m) => `the treatment (${m.medicine_name})`),
    ...c.vaccinations.map((v) => (v.schedule_id ? `the vaccine schedule confirm (${v.vaccine_name})` : `the vaccination (${v.vaccine_name})`)),
  ];
  const remove = () => {
    if (!reason.trim()) {
      setError('Write why first, then remove.');
      return;
    }
    Alert.alert(
      'Remove this usage?',
      `Stock goes back to the house${coded ? ' and the bottle' : ''}.${links.length ? ` ${links.join(', ')} will be removed too.` : ''}`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void finish(`/consumptions/${c.id}/remove`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }, 'Usage removed'),
        },
      ],
    );
  };

  return (
    <FormScreen
      title="Fix usage"
      hint="Enter what really happened. Stock and the batch's cost follow."
      dirty={changed || !!reason}
      submit={{
        label: 'Save fix',
        onPress: save,
        disabled: !canSave || busy,
        loading: busy,
        secondary: closed ? undefined : { label: 'Remove this usage', onPress: remove },
      }}
    >
      <FormCard>
        <AppText variant="bodyStrong">
          {formatBalance(Number(c.quantity))} {humanise(c.unit).toLowerCase()} {item.name}
        </AppText>
        <AppText variant="caption" color="muted">
          {[c.house.name, c.batch?.batch_code, c.recorded_by.name, new Date(c.date).toLocaleDateString('en-GB')].filter(Boolean).join(' · ')}
        </AppText>
        {c.fixed_at ? (
          <AppText variant="caption" color="muted">
            Fixed before by {c.fixed_by?.name ?? 'someone'}: {c.fix_reason}
          </AppText>
        ) : null}
        {closed ? (
          <AppText variant="caption" color="critical">
            Batch {c.batch?.batch_code} is closed, so this record can&apos;t be changed.
          </AppText>
        ) : null}
      </FormCard>

      <FormCard title="What really happened">
        {amountEditable ? (
          <>
            {units.length > 1 ? (
              <View style={styles.group}>
                <AppText variant="eyebrow" color="muted">
                  Unit
                </AppText>
                <PillSelect
                  options={units.map((u) => ({
                    value: u.unit,
                    label: u.factor === 1 ? humanise(u.unit) : `${humanise(u.unit)} · ${formatBalance(u.factor)} ${humanise(item.unit).toLowerCase()}`,
                  }))}
                  value={unitCode}
                  onChange={setUnitCode}
                />
              </View>
            ) : null}
            <NumberField label="Quantity" value={quantity} onChangeText={setQuantity} unit={humanise(unitCode)} warn={!(quantityNum > 0)} />
          </>
        ) : usedUp ? (
          <AppText variant="caption" color="muted">
            This bottle was used up, so the amount is what was left in it. Change the bottle, or remove the record.
          </AppText>
        ) : null}

        {coded ? (
          <View style={styles.group}>
            <AppText variant="eyebrow" color="muted">
              Right bottle (only if the wrong one was scanned)
            </AppText>
            {bottle ? (
              <AppText variant="bodyStrong">
                {bottle.purchase_item?.item.name ?? 'Bottle'} · {tail(bottle.id)}
              </AppText>
            ) : null}
            <Button variant="secondary" icon="camera" label={bottle ? 'Scan a different bottle' : 'Scan the right bottle'} onPress={() => setScanning(true)} />
            <CodeEntry
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setCodeMsg(null);
              }}
              onSubmit={() => void typeCode()}
              ready={code.trim().length >= 3}
              busy={looking}
              message={codeMsg}
              actionLabel="Find"
            />
          </View>
        ) : null}

        <View style={styles.group}>
          <AppText variant="eyebrow" color="muted">
            Day (only if it was another day)
          </AppText>
          <PillSelect options={dayOptions} value={daysBack} onChange={setDaysBack} />
        </View>

        <TextField label="Why (required)" value={reason} onChangeText={setReason} placeholder="e.g. typed 2 kg, it was 2 bags" />
        {error ? (
          <AppText variant="caption" color="critical">
            {error}
          </AppText>
        ) : null}
      </FormCard>

      {coded ? (
        <QrScanner
          open={scanning}
          onClose={() => setScanning(false)}
          context={`Fix: ${item.name}`}
          remaining={1}
          labels={{
            done: 'picked',
            flashOk: 'Picked',
            offlineTitle: 'Fixing needs a connection.',
            offlineBody: 'The bottle is checked against the server, so this needs signal.',
            hint: 'Point the camera at the bottle that was really used.',
            full: 'Bottle picked',
          }}
          rows={rows}
          onScanned={(r) => setRows((prev) => [r, ...prev])}
          onScan={async (scanned) => {
            try {
              const u = await apiFetch<StockUnit>(`/stock-units/${scanned}`);
              const why = pickBottle(u);
              if (why) return { ok: false, message: why, retryable: false, label: tail(scanned) };
              setScanning(false);
              return { ok: true, label: tail(scanned) };
            } catch (e) {
              const status = e instanceof ApiError ? e.status : 0;
              return { ok: false, message: status === 404 ? 'Unknown code.' : (e as Error).message, retryable: status === 0, label: tail(scanned) };
            }
          }}
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
});
