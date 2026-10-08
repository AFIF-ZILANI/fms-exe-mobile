import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { mergeSeen, parseSeen } from '@/lib/alerts-view';
import { useSession } from '@/lib/session';

/**
 * Which alerts this person has already opened the Alerts screen on, so the bell can count only the
 * new ones and the list can mark them. Kept on the phone, per employee, in react-query's cache so
 * Home and the Alerts screen read one value. `seen` is null until it has loaded: callers treat that
 * as "nothing new" rather than flashing every alert as new.
 */
export function useSeenAlerts() {
  const { employee } = useSession();
  const queryClient = useQueryClient();
  const id = employee?.id ?? 'none';
  const storageKey = `fms:alerts-seen:${id}`;
  const queryKey = ['alerts-seen', id];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => parseSeen(await AsyncStorage.getItem(storageKey).catch(() => null)),
    staleTime: Infinity,
    enabled: !!employee,
  });

  const markSeen = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const next = mergeSeen(queryClient.getQueryData<string[]>(queryKey) ?? [], ids);
      queryClient.setQueryData(queryKey, next);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    },
    // queryKey is rebuilt from `id` each render; `id` is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, id, storageKey],
  );

  return { seen: data ?? null, markSeen };
}
