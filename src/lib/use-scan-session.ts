import { useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import type { PendingCard, ScanRow } from '@/components/ui/qr-scanner';
import { ApiError, apiFetch } from '@/lib/api';
import { isRetryable, scanErrorMessage, type ScanResult, type Settled } from '@/lib/scan';
import {
  checkUnit,
  currentHouseName,
  decideScan,
  newKeyStore,
  type Mode,
  type ScanPlan,
} from '@/lib/scan-actions';
import type { StockUnit } from '@/lib/types';

type Options = {
  plan: ScanPlan;
  mode: Mode;
  /** Performs the write; throw ApiError on failure. `key` is stable per unit until the
   *  write succeeds, so a rescan after a lost response can't double-record. */
  commit: (unit: StockUnit, key: string) => Promise<void>;
  /** Text on the Confirm button in manual mode, e.g. "Move to House 3". */
  confirmLabel: string;
  /** Consume: a replay conflict (409 idempotency_key) means the write already landed, so it counts as done. */
  treatReplayAsDone?: boolean;
};

const tail = (id: string) => `…${id.slice(-7)}`;

function failure(err: unknown): Settled {
  if (err instanceof ApiError) {
    return {
      ok: false,
      message: scanErrorMessage(err.status, err.message),
      retryable: isRetryable(err.status),
    };
  }
  return { ok: false, message: 'Something went wrong.', retryable: true };
}

function toRow(id: string, result: Settled): ScanRow {
  return {
    id,
    label: result.label ?? tail(id),
    state: result.ok ? 'ok' : 'error',
    ...(result.ok ? {} : { message: result.message }),
  };
}

type KeyStore = ReturnType<typeof newKeyStore>;

/**
 * One scan session: look the unit up, decide (pure, see scan-actions.ts), then either
 * write straight away (auto), hold for Confirm/Cancel (manual), or explain why not.
 * docs/scan-flows-design.md §3.
 */
export function useScanSession({ plan, mode, commit, confirmLabel, treatReplayAsDone }: Options) {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [held, setHeld] = useState<StockUnit | null>(null);
  const [busy, setBusy] = useState(false);
  // Mutated only inside callbacks, never read during render.
  const done = useRef(new Set<string>());
  const keyStore = useRef<KeyStore | null>(null);
  // Bumped by reset(); screens use it as the QrScanner key so its seen-codes list restarts too.
  const [generation, setGeneration] = useState(0);

  const keys = () => (keyStore.current ??= newKeyStore(() => Crypto.randomUUID()));

  const labelOf = (unit: StockUnit) => `${unit.purchase_item?.item.name ?? 'Unit'} ${tail(unit.id)}`;

  const finish = async (unit: StockUnit): Promise<Settled> => {
    try {
      await commit(unit, keys().keyFor(unit.id));
    } catch (err) {
      if (!(treatReplayAsDone && err instanceof ApiError && err.isReplayConflict())) return failure(err);
    }
    done.current.add(unit.id);
    keys().drop(unit.id);
    return { ok: true, label: labelOf(unit) };
  };

  const scan = async (id: string, as: Mode): Promise<ScanResult> => {
    let unit: StockUnit;
    try {
      unit = await apiFetch<StockUnit>(`/stock-units/${id}`);
    } catch (err) {
      return failure(err);
    }

    const decision = decideScan(as, checkUnit(plan, unit), done.current.has(unit.id));
    switch (decision.kind) {
      case 'duplicate':
        return { ok: false, message: 'Already done in this session.', retryable: false, duplicate: true };
      case 'reject':
        return { ok: false, message: decision.reason, retryable: false, label: labelOf(unit) };
      case 'hold':
        setHeld(unit);
        return { held: true };
      case 'commit':
        return finish(unit);
    }
  };

  /** The scanner turns this into a row, buzz and flash exactly like an auto result. */
  const confirm = async (): Promise<Settled> => {
    if (!held) return { ok: false, message: 'Nothing to confirm.', retryable: false };
    setBusy(true);
    try {
      return await finish(held);
    } finally {
      setHeld(null);
      setBusy(false);
    }
  };

  const pending: PendingCard | null = held
    ? {
        title: held.purchase_item?.item.name ?? 'Stock unit',
        subtitle: tail(held.id),
        details: [
          { label: 'Status', value: held.status.toLowerCase().replace('_', ' ') },
          { label: 'Now at', value: currentHouseName(held) },
        ],
        confirmLabel,
        busy,
        onConfirm: confirm,
        onCancel: () => setHeld(null),
      }
    : null;

  return {
    rows,
    onScan: (id: string) => scan(id, mode),
    generation,
    onScanned: (row: ScanRow) => setRows((prev) => [row, ...prev]),
    pending,
    /** A typed code (no camera): same pipeline, result goes straight into the list. */
    runManual: async (id: string): Promise<boolean> => {
      // Tapping a specific unit is already deliberate, so never hold for a card nobody can see.
      const result = await scan(id, 'auto');
      if ('held' in result) return false;
      setRows((prev) => [toRow(id, result), ...prev]);
      return result.ok;
    },
    /** A changed plan is a new session — counts and the done-set must not carry over. */
    reset: () => {
      setRows([]);
      setHeld(null);
      done.current.clear();
      // A retried unit must not replay its old key against a different house.
      keyStore.current = null;
      setGeneration((g) => g + 1);
    },
    /** Closing the scanner abandons any unit still waiting on Confirm. */
    close: () => setHeld(null),
  };
}
