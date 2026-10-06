// Who is logged in. The server stamps every write's actor from the session token
// (server/src/lib/current-actor.ts), so nothing here ever sends an actor id.
// `employee` keeps the shape every screen already reads; it is a snapshot of the
// logged-in person's Employees row, persisted so identity reads back offline.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api';
import { loadToken, onUnauthorized, setToken } from '@/lib/auth-token';
import type { Employee } from '@/lib/types';

const EMPLOYEE_KEY = 'fms:session';

type Me = {
  id: string;
  role: string;
  employee_id: string | null;
  must_change_password: boolean;
};

type SessionState = {
  employee: Employee | null;
  /** A token is held. May be true with `employee` null: the profile fetch is still pending or failed. */
  signedIn: boolean;
  mustChangePassword: boolean;
  /** The last request said the session is over; the login screen explains it. */
  expired: boolean;
  isLoading: boolean;
};

type SessionContextValue = SessionState & {
  login: (email: string, password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  /** Clears this phone's session. The offline queue is untouched -- callers refuse to log out while it is non-empty. */
  logout: () => Promise<void>;
  /** Re-fetch the employee snapshot (e.g. after a failed load). */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const SIGNED_OUT: SessionState = {
  employee: null,
  signedIn: false,
  mustChangePassword: false,
  expired: false,
  isLoading: false,
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ...SIGNED_OUT, isLoading: true });
  const queryClient = useQueryClient();

  const endSession = useCallback(
    async (expired: boolean) => {
      await setToken(null);
      await AsyncStorage.removeItem(EMPLOYEE_KEY);
      queryClient.clear(); // nothing from this person on the next person's dashboard
      setState({ ...SIGNED_OUT, expired });
    },
    [queryClient],
  );

  /** The employee behind the logged-in profile. Only reachable once the temp password is replaced. */
  const loadEmployee = useCallback(async (me: Me): Promise<Employee | null> => {
    if (!me.employee_id) return null;
    const employee = await apiFetch<Employee>(`/employees/${me.employee_id}`);
    await AsyncStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employee));
    return employee;
  }, []);

  // A 401 anywhere (expired, deactivated, password changed elsewhere) ends the session.
  useEffect(() => {
    onUnauthorized(() => void endSession(true));
    return () => onUnauthorized(null);
  }, [endSession]);

  // Cold start: trust the stored token and snapshot so the app opens offline, then verify in the background.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (!token) {
        if (!cancelled) setState(SIGNED_OUT);
        return;
      }
      const raw = await AsyncStorage.getItem(EMPLOYEE_KEY).catch(() => null);
      const employee = raw ? (JSON.parse(raw) as Employee) : null;
      if (!cancelled) {
        setState({ ...SIGNED_OUT, employee, signedIn: true });
      }
      try {
        const me = await apiFetch<Me>('/auth/me');
        if (cancelled) return;
        // Only a pending temp password; otherwise leave the snapshot alone.
        setState((s) => ({ ...s, mustChangePassword: me.must_change_password }));
      } catch {
        // 401 already ended the session via the listener; offline just keeps the snapshot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ profile: Me; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, client: 'mobile' }),
    });
    if (res.profile.role !== 'EMPLOYEE') {
      throw new ApiError(403, { detail: 'Admins use the web dashboard, not this app.' });
    }
    await setToken(res.token);
    queryClient.clear();
    if (res.profile.must_change_password) {
      setState({ ...SIGNED_OUT, signedIn: true, mustChangePassword: true });
      return;
    }
    const employee = await loadEmployee(res.profile);
    setState({ ...SIGNED_OUT, signedIn: true, employee });
  };

  const changePassword = async (current: string, next: string) => {
    const res = await apiFetch<{ token: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    await setToken(res.token);
    const me = await apiFetch<Me>('/auth/me');
    const employee = await loadEmployee(me);
    setState({ ...SIGNED_OUT, signedIn: true, employee });
  };

  const refresh = async () => {
    const me = await apiFetch<Me>('/auth/me');
    const employee = await loadEmployee(me);
    setState((s) => ({ ...s, employee, mustChangePassword: me.must_change_password }));
  };

  return (
    <SessionContext.Provider
      value={{ ...state, login, changePassword, logout: () => endSession(false), refresh }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
