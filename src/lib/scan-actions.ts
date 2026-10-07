/**
 * What a scan means, decided without a camera or a server. The hook owns the
 * requests; this owns "may this unit go through, and what happens next".
 * docs/scan-flows-design.md §3–4.
 */

import type { StockUnit, StockUnitStatus } from './types';

export type ScanAction = 'allocate' | 'consume' | 'bind';
export type Mode = 'manual' | 'auto';
export type Check = { ok: true } | { ok: false; reason: string };

export type ScanPlan = {
  action: ScanAction;
  /** allocate: the house units move into. consume: the house they're used in. */
  houseId?: string;
  /** Only units of this item pass (allocate, consume). */
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
  CONSUMED: 'Already used up.',
  DISPOSED: 'Already disposed.',
};

export function checkUnit(plan: ScanPlan, unit: StockUnit): Check {
  if (plan.action === 'bind') {
    return unit.status === 'UNASSIGNED'
      ? OK
      : fail(`Already linked · ${unit.status.toLowerCase().replace('_', ' ')}`);
  }

  // allocate / consume: only a live, bound unit makes sense.
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
export function consumptionBody(
  unit: StockUnit,
  o: { houseId: string; batchId?: string; now: Date; key: string },
) {
  const purchase = unit.purchase_item;
  if (!purchase) throw new Error('unit has no purchase record');
  return {
    house_id: o.houseId,
    item_id: purchase.item_id,
    stock_unit_id: unit.id,
    quantity: 1,
    unit: purchase.unit,
    date: o.now.toISOString(),
    ...(o.batchId ? { batch_id: o.batchId } : {}),
    idempotency_key: o.key,
  };
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
