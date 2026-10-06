import AsyncStorage from '@react-native-async-storage/async-storage';

// ponytail: AsyncStorage, not expo-secure-store -- the offline queue and query cache already sit
// unencrypted on the same phone. Swap in secure-store here (one file) if the threat model changes.
const TOKEN_KEY = 'fms:token';

let token: string | null = null;
let unauthorizedListener: (() => void) | null = null;

export function getToken(): string | null {
  return token;
}

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  if (next) await AsyncStorage.setItem(TOKEN_KEY, next);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

/** SessionProvider registers here; apiFetch calls notifyUnauthorized() on a 401. */
export function onUnauthorized(listener: (() => void) | null): void {
  unauthorizedListener = listener;
}

export function notifyUnauthorized(): void {
  unauthorizedListener?.();
}
