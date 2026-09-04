// ponytail: auth stand-in -- Google OAuth replaces the profile source here,
// nothing else. Every write reads its actor id from useSession() rather than
// a picker, so the later swap is a one-file change instead of a hunt through
// every form. See docs/PRD.md §3 and server/docs/FEATURES.md §3.1.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import type { Employee } from '@/lib/types';

const STORAGE_KEY = 'fms:session';

type SessionState = {
  employee: Employee | null;
  isLoading: boolean;
};

type SessionContextValue = SessionState & {
  /** Switches identity: persists the full employee snapshot (so identity
   *  reads back instantly offline) and clears the query cache -- but NOT the
   *  outbox. A queued write already carries its own actor id, stamped at
   *  enqueue time, so it belongs to whoever wrote it regardless of who's
   *  signed in now. See docs/offline-sync.md §3. */
  switchTo: (employee: Employee) => Promise<void>;
  clear: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ employee: null, isLoading: true });
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        const employee = raw ? (JSON.parse(raw) as Employee) : null;
        setState({ employee, isLoading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ employee: null, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchTo = async (employee: Employee) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
    setState({ employee, isLoading: false });
    // Otherwise the previous person's cached tasks/scores flash on the new
    // person's dashboard until their own queries refetch.
    queryClient.clear();
  };

  const clear = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState({ employee: null, isLoading: false });
    queryClient.clear();
  };

  return (
    <SessionContext.Provider value={{ ...state, switchTo, clear }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
