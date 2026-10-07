export type LogoutDecision = 'blocked' | 'confirm-discard' | 'go';

/**
 * Records still waiting to send block logout: a queued write belongs to whoever is signed in
 * when it uploads. Failed records will not upload on their own, but they would be retryable by
 * the next person, so leaving them needs an explicit discard.
 */
export function logoutDecision(pending: number, failed: number): LogoutDecision {
  if (pending > 0) return 'blocked';
  return failed > 0 ? 'confirm-discard' : 'go';
}
