import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { flush, listPending, listDeadLetters, getLastSyncedAt, type OutboxRow } from '@/lib/outbox';

export type OutboxSummary = {
  pendingCount: number;
  deadLetterCount: number;
  lastSyncedAt: number | null;
};

export const SUMMARY_KEY = ['outbox-summary'];

/** Read by Settings, the Sync center and useLogout. Not stale-driven -- refetched
 *  explicitly by triggerFlush() below, since the queue only changes on a
 *  write or a flush, never on a timer. */
export function useOutboxSummary() {
  return useQuery<OutboxSummary>({
    queryKey: SUMMARY_KEY,
    queryFn: async () => {
      const [pending, deadLetters, lastSyncedAt] = await Promise.all([
        listPending(),
        listDeadLetters(),
        getLastSyncedAt(),
      ]);
      return { pendingCount: pending.length, deadLetterCount: deadLetters.length, lastSyncedAt };
    },
    staleTime: Infinity,
  });
}

/**
 * Runs the queue and refreshes everything that could have changed as a
 * result -- the outbox summary plus every list a synced write might affect.
 * Broad invalidation over precise per-endpoint tracking: this app's data
 * volume is small enough that a full refetch costs nothing a farm worker
 * would notice, and it's a lot less code than mapping each endpoint to its
 * queries by hand.
 */
export async function triggerFlush(queryClient: QueryClient): Promise<void> {
  await flush();
  await queryClient.invalidateQueries();
}

/**
 * Mounted once in the root layout. Wires two of the three automatic flush
 * triggers from docs/offline-sync.md §4.4 -- app foreground and network
 * reconnect. The third (after every enqueue) lives in use-queued-submit.ts,
 * next to the write itself; the fourth (manual "Sync now") is a plain
 * triggerFlush() call from Settings and the Sync center.
 */
export function useOutboxTriggers(): void {
  const queryClient = useQueryClient();
  const network = useNetworkState();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void triggerFlush(queryClient);
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (network.isConnected) void triggerFlush(queryClient);
  }, [network.isConnected, queryClient]);
}

export type OutboxRows = { pending: OutboxRow[]; failed: OutboxRow[] };

/**
 * The queued records themselves (not just the counts), for the Sync center. Held in component
 * state on purpose, not in the query cache: that cache is persisted to storage and a queued
 * body is personal data. Reloads whenever the summary refetches (after a flush, retry or
 * discard): the summary changes after any flush/retry/discard. `null` until the first read finishes.
 */
export function useOutboxRows(): OutboxRows | null {
  const { data: summary } = useOutboxSummary();
  const [rows, setRows] = useState<OutboxRows | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([listPending(), listDeadLetters()]).then(([pending, failed]) => {
      if (alive) setRows({ pending, failed });
    });
    return () => {
      alive = false;
    };
  }, [summary]);

  return rows;
}
