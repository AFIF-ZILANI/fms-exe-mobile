/**
 * What a scan means, decided without a camera or a server. The hook owns the
 * requests; this owns "may this unit go through, and what happens next".
 * docs/scan-flows-design.md §3–4.
 */

import type { StockUnit, StockUnitStatus } from './types';

/** start/finish are "Use an item": open a unit (no log) / log it used up. */
export type ScanAction = 'allocate' | 'start' | 'finish' | 'bind';
export type Mode = 'manual' | 'auto';
export type Check = { ok: true } | { ok: false; reason: string };

export type ScanPlan = {
  action: ScanAction;
  /** allocate: the house units move into. start/finish: the house they're used in. */
  houseId?: string;
  /** For the "move it here first" message. */
  houseName?: string;
  /** Only units of this item pass (allocate, start, finish). None = any item. */
  itemId?: string;
  itemName?: string;
  /** bind: the purchase line the units are linked to. Unused by the checks (the server validates it). */
  purchaseItemId?: string;
};

export type Decision =
  | { kind: 'duplicate' }
  | { kind: 'reject'; reason: string }
  | { kind: 'hold' }
  | { kind: 'commit' };

const OK: Check = { ok: true };
const fail = (reason: string): Check => ({ ok: false, reason });

/** Latest allocation is the unit's current location; none, or a RETURN, means the warehouse. */
export function currentHouseId(unit: StockUnit): string | null {
  return unit.houseAllocations?.[0]?.house_id ?? null;
}

export function currentHouseName(unit: StockUnit): string {
  return unit.houseAllocations?.[0]?.house?.name ?? 'Warehouse';
}

const BLOCKED: Partial<Record<StockUnitStatus, string>> = {
  UNASSIGNED: 'Not linked to a purchase yet.',
  PRINTED: 'Not linked to a purchase yet.',
  CONSUMED: 'Already used up.',
  DISPOSED: 'Already disposed.',
};

export function checkUnit(plan: ScanPlan, unit: StockUnit): Check {
  if (plan.action === 'bind') {
    // Only a confirmed-printed label can be linked; the server enforces the same rule.
    if (unit.status === 'PRINTED') return OK;
    if (unit.status === 'UNASSIGNED') return fail('Not printed yet — confirm its print on the dashboard first.');
    return fail(`Already linked · ${unit.status.toLowerCase().replace('_', ' ')}`);
  }

  // allocate / start / finish: only a live, bound unit makes sense.
  const blocked = BLOCKED[unit.status];
  if (blocked) return fail(blocked);

  const purchase = unit.purchase_item;
  if (!purchase) return fail('This unit has no purchase record.');

  if (plan.itemId && purchase.item_id !== plan.itemId) {
    return fail(`Not ${plan.itemName ?? 'the chosen item'} — this is ${purchase.item.name}.`);
  }

  if (plan.action === 'allocate' && plan.houseId && currentHouseId(unit) === plan.houseId) {
    return fail(`Already in ${currentHouseName(unit)}.`);
  }

  if (plan.action === 'start' || plan.action === 'finish') {
    // Start opens a sealed unit; an opened one can only be finished.
    if (plan.action === 'start' && unit.status === 'IN_USE') return fail('Already in use.');
    // Equipment is used, not used up: it leaves through disposal, which the server does too.
    if (plan.action === 'finish' && purchase.item.category === 'EQUIPMENT')
      return fail("Equipment isn't used up — dispose it instead.");
    // A unit is used where it is, so it has to have been moved into this house first.
    if (plan.houseId && currentHouseId(unit) !== plan.houseId) {
      return fail(`It's at ${currentHouseName(unit)}, not ${plan.houseName ?? 'this house'} — move it here first.`);
    }
  }

  return OK;
}

/** Duplicate beats everything: a unit already done this session is never re-sent. */
export function decideScan(mode: Mode, check: Check, alreadyDone: boolean): Decision {
  if (alreadyDone) return { kind: 'duplicate' };
  if (!check.ok) return { kind: 'reject', reason: check.reason };
  return mode === 'auto' ? { kind: 'commit' } : { kind: 'hold' };
}

/**
 * POST /consumptions body for using one whole coded unit. The unit is one pack of its
 * purchase line's unit (e.g. 1 BOTTLE), so quantity is 1 and the unit is the purchase
 * line's -- never Item.unit, which is the base unit (1 ML would mean 1 mL, not 1 bottle).
 * The server converts via ItemUnit.factor_to_base.
 */
/** POST /stock-units/:id/use -- the server works out how much was left in the unit for a finish. */
export function unitUseBody(
  action: 'start' | 'finish',
  o: { houseId: string; batchId?: string; now: Date; key: string },
) {
  return {
    action: action === 'start' ? 'START' : 'FINISH',
    house_id: o.houseId,
    date: o.now.toISOString(),
    ...(o.batchId ? { batch_id: o.batchId } : {}),
    idempotency_key: o.key,
  } as const;
}

/**
 * One idempotency key per unit until its write is confirmed, so a rescan after a lost
 * response replays the same key instead of minting a second one. The server refuses a
 * repeat with 409 (it does not report the replay as success), so the guarantee is
 * "no double write", not "replay reported as success".
 */
export function newKeyStore(gen: () => string) {
  const keys = new Map<string, string>();
  return {
    keyFor(id: string): string {
      let key = keys.get(id);
      if (!key) {
        key = gen();
        keys.set(id, key);
      }
      return key;
    },
    drop(id: string): void {
      keys.delete(id);
    },
  };
}
