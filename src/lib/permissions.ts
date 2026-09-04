/**
 * Mirrors server/docs/FEATURES.md §3.5, restricted to the two roles this
 * version ships (docs/PRD.md §4). Client-side only -- shapes the UI, secures
 * nothing (no auth yet, see session.tsx). INTERN is the next role to fill in.
 */

const WORKER_CAPABILITIES = [
  'view_batch',
  'log_environment',
  'log_weight',
  'log_mortality',
  'log_consumption',
  'log_treatment',
  'view_own_performance',
] as const;

const MANAGER_CAPABILITIES = [
  ...WORKER_CAPABILITIES,
  'assign_task',
  'score_employee',
  'house_transfer',
  'feeding_program',
  'receive_stock',
  'report_discrepancy',
  'flag_low_stock',
] as const;

export const CAPABILITIES = {
  WORKER: WORKER_CAPABILITIES,
  MANAGER: MANAGER_CAPABILITIES,
} as const satisfies Record<string, readonly string[]>;

export type Capability = (typeof MANAGER_CAPABILITIES)[number];
export type Role = keyof typeof CAPABILITIES;

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role || !(role in CAPABILITIES)) return false;
  return (CAPABILITIES[role as Role] as readonly string[]).includes(capability);
}
