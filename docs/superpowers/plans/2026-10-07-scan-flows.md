# Scan Flows (Allocate, Consume, Bind) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A worker can scan a coded unit's QR to move it into a house or use it on a batch, and a manager can bind codes to a purchase line, all through one shared scan session with manual-confirm or auto-confirm.

**Architecture:** The existing `QrScanner` (camera, dedupe, flash, result list) stays the camera layer. A pure decision module (`lib/scan-actions.ts`) decides whether a looked-up unit may be moved / used / bound. A hook (`lib/use-scan-session.ts`) wires lookup, decision, hold-for-confirm and the write. Three thin screens supply only their plan fields and their request. One server rule is added so workers may call `relocate`.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / expo-camera (already installed), TanStack Query, Bun assertion scripts for tests (`bun src/lib/<name>.test.ts`). Server: Hono + Bun (`bun test`). No new dependencies.

**Spec:** `mobile/docs/scan-flows-design.md` (decisions: whole units only; plan then scan; manual or auto confirm; quantity/unit resolved in §6.1).

## Global Constraints

- Repos: `mobile/` and `server/` are **separate git repos**. Every change follows: new branch from `main` → change → verify → merge to `main` → delete branch. Never commit to `main` directly.
- Commit messages carry **no attribution lines** (no Co-Authored-By).
- No new dependencies. Camera is `expo-camera` (already in `package.json`). Before touching any Expo/React Native API, read the matching docs per `mobile/AGENTS.md`.
- Run `bunx tsc --noEmit` and `bunx expo lint` before declaring any mobile task done; both must be clean.
- Whole units only: **no quantity field anywhere** on scan screens.
- A whole-unit consume sends `quantity: 1` and `unit: <purchase_item.unit>`, **never** `item.unit`.
- Allocate, Consume and Bind **require a connection** (the checks are server-side). Offline shows a blocked state, as Bind does today. Offline queueing is out of scope.
- UI uses design tokens and shared components (`AppText`, `Button`, `Card`, `LedgerRow`, `Icon`), 48dp targets, plain words (no jargon), every status carries an icon or word, light and dark both work.
- Icons only through `components/ui/icon.tsx` (Feather names).
- Server default-denies employees: any endpoint a worker needs must be listed in `server/src/lib/permissions.ts`.

## Review Focus

- A cancelled manual confirm can be rescanned immediately (the code is released, not stuck as "seen"). Pinned in Task 3 and Task 4.
- Scanning a unit of the wrong item when an item filter is set is rejected and nothing is written. Pinned in Task 2.
- Scanning a blank (UNASSIGNED), used-up or disposed unit for Allocate or Consume is rejected with a plain reason. Pinned in Task 2.
- A lost response followed by a rescan reuses the same idempotency key so the write can't double. Pinned in Task 2 (`newKeyStore`) and used in Task 4.
- A whole-unit consume never sends the item's base unit (1 mL instead of 1 bottle). Pinned in Task 2 (`consumptionBody`).
- Allocating a unit that is already in the chosen house is rejected before any request. Pinned in Task 2.
- A worker without the new server rule gets a friendly "no permission" line, not a raw error. Pinned in Task 3 (`scanErrorMessage`) and Task 1.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `server/src/lib/permissions.ts` | Add worker rule for `POST /stock-units/:id/relocate`. |
| `server/src/lib/permissions.test.ts` | Test for that rule. |
| `mobile/src/lib/types.ts` | `PurchaseItem.unit`; `StockUnit` relations (`purchase_item`, `houseAllocations`). |
| `mobile/src/lib/scan-actions.ts` (new) | Pure: `checkUnit`, `decideScan`, `consumptionBody`, `newKeyStore`, house helpers. |
| `mobile/src/lib/scan-actions.test.ts` (new) | Tests for the above. |
| `mobile/src/lib/scan.ts` | Add `ScanResult`, `Settled`, `scanErrorMessage`. |
| `mobile/src/lib/scan.test.ts` | Tests for `scanErrorMessage`. |
| `mobile/src/components/ui/qr-scanner.tsx` | Add `labels`, `pending` confirm card, `held` results. |
| `mobile/src/lib/use-scan-session.ts` (new) | Hook: lookup → decide → hold/commit → rows. |
| `mobile/src/components/scan-parts.tsx` (new) | `ScanModeField`, `ScanResults`, `OfflineNote`. |
| `mobile/src/app/scan/allocate.tsx` (new) | Move-to-house screen. |
| `mobile/src/app/scan/consume.tsx` (new) | Use-an-item screen. |
| `mobile/src/components/log-sheet.tsx` | Two new worker entries. |
| `mobile/src/app/(manager)/link.tsx` | Move Bind onto the shared session. |
| `mobile/package.json` | `test` script runs all three scripts. |

---

### Task 1: Let workers call relocate (server repo)

**Files:**
- Modify: `server/src/lib/permissions.ts` (RULES array, next to the `bind` rule)
- Test: `server/src/lib/permissions.test.ts`

**Interfaces:**
- Consumes: existing `canAccess(auth, method, path, query)`.
- Produces: `POST /stock-units/:id/relocate` allowed for WORKER and MANAGER (not other employee roles).

- [ ] **Step 1: Create the branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/server
git checkout main && git checkout -b feat/worker-relocate-stock-units
```

- [ ] **Step 2: Write the failing test** — add inside `describe("canAccess", ...)` in `server/src/lib/permissions.test.ts`:

```ts
    test("workers and managers may move a coded unit; other employee roles may not", () => {
        for (const who of [worker, manager]) {
            expect(canAccess(who, "POST", "/stock-units/abc/relocate", none)).toBe(true);
        }
        expect(canAccess(other, "POST", "/stock-units/abc/relocate", none)).toBe(false);
        // binding stays manager-only
        expect(canAccess(worker, "POST", "/stock-units/abc/bind", none)).toBe(false);
    });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun test src/lib/permissions.test.ts`
Expected: FAIL (worker relocate returns false).

- [ ] **Step 4: Add the rule** — in `server/src/lib/permissions.ts`, directly above the `bind` rule:

```ts
    // Scanning a coded unit into a house is floor work, not a manager action.
    { methods: POST, path: /^\/stock-units\/[^/]+\/relocate$/, level: "worker" },
```

- [ ] **Step 5: Run it to verify it passes**

Run: `bun test src/lib/permissions.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit and merge**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "feat(permissions): let workers relocate coded stock units"
git checkout main && git merge --no-ff feat/worker-relocate-stock-units -m "Merge feat/worker-relocate-stock-units" && git branch -d feat/worker-relocate-stock-units
```

---

### Task 2: Unit types and the pure decision module (mobile)

**Files:**
- Modify: `mobile/src/lib/types.ts` (`PurchaseItem`, `StockUnit`)
- Create: `mobile/src/lib/scan-actions.ts`
- Create: `mobile/src/lib/scan-actions.test.ts`
- Modify: `mobile/package.json` (`test` script)

**Interfaces:**
- Consumes: `StockUnit`, `StockUnitStatus` from `types.ts`.
- Produces (exact names used by Tasks 4–7):
  - `type ScanAction = 'allocate' | 'consume' | 'bind'`
  - `type Mode = 'manual' | 'auto'`
  - `type Check = { ok: true } | { ok: false; reason: string }`
  - `type ScanPlan = { action: ScanAction; houseId?: string; itemId?: string; itemName?: string; purchaseItemId?: string }`
  - `type Decision = { kind: 'duplicate' } | { kind: 'reject'; reason: string } | { kind: 'hold' } | { kind: 'commit' }`
  - `currentHouseId(unit): string | null`, `currentHouseName(unit): string`
  - `checkUnit(plan, unit): Check`
  - `decideScan(mode, check, alreadyDone): Decision`
  - `consumptionBody(unit, { houseId, batchId?, now, key })`
  - `newKeyStore(gen): { keyFor(id): string; drop(id): void }`

- [ ] **Step 1: Branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
git checkout main && git checkout -b feat/scan-flows
```

- [ ] **Step 2: Extend the types** — in `src/lib/types.ts`:

Add `unit: string;` to `PurchaseItem`:

```ts
export type PurchaseItem = {
  id: string;
  purchase_id: string;
  item_id: string;
  /** The unit this line was bought in (e.g. BOTTLE). A coded StockUnit is one of these. */
  unit: string;
  base_quantity: string;
  item: Item;
  purchase: Purchase;
};
```

Replace `StockUnit`:

```ts
export type StockUnit = {
  id: string;
  purchase_item_id: string | null;
  status: StockUnitStatus;
  bound_at: string | null;
  bound_by_id: string | null;
  /** Present on GET /stock-units/:id and the list (server withRelations). */
  purchase_item?: { id: string; item_id: string; unit: string; item: Item } | null;
  /** Newest first, at most one: the latest allocation is the unit's current location. */
  houseAllocations?: { house_id: string | null; house?: { id: string; name: string } | null }[];
};
```

- [ ] **Step 3: Write the failing tests** — create `src/lib/scan-actions.test.ts`:

```ts
/**
 * The scan session's decisions, verifiable without a camera or a server.
 * Run: `bun src/lib/scan-actions.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  checkUnit,
  consumptionBody,
  currentHouseId,
  currentHouseName,
  decideScan,
  newKeyStore,
  type ScanPlan,
} from './scan-actions';
import type { StockUnit } from './types';

const ITEM = { id: 'item-1', name: 'Newcastle vaccine', category: 'VACCINE', unit: 'ML', is_unit_tracked: true, is_active: true };
const OTHER = { ...ITEM, id: 'item-2', name: 'Antibiotic' };

function unit(over: Partial<StockUnit> = {}): StockUnit {
  return {
    id: 'u-1',
    purchase_item_id: 'pi-1',
    status: 'IN_STOCK',
    bound_at: null,
    bound_by_id: null,
    purchase_item: { id: 'pi-1', item_id: ITEM.id, unit: 'BOTTLE', item: ITEM },
    houseAllocations: [],
    ...over,
  };
}

const allocate: ScanPlan = { action: 'allocate', houseId: 'h-2' };
const consume: ScanPlan = { action: 'consume', houseId: 'h-2' };
const bind: ScanPlan = { action: 'bind', purchaseItemId: 'pi-1' };

// --- location -----------------------------------------------------------------
assert.equal(currentHouseId(unit()), null, 'no allocations = warehouse');
assert.equal(currentHouseName(unit()), 'Warehouse');
const inH1 = unit({ houseAllocations: [{ house_id: 'h-1', house: { id: 'h-1', name: 'House 1' } }] });
assert.equal(currentHouseId(inH1), 'h-1');
assert.equal(currentHouseName(inH1), 'House 1');
const returned = unit({ houseAllocations: [{ house_id: null, house: null }] });
assert.equal(currentHouseName(returned), 'Warehouse', 'a RETURN event puts it back in the warehouse');

// --- allocate -----------------------------------------------------------------
assert.deepEqual(checkUnit(allocate, unit()), { ok: true });
assert.deepEqual(checkUnit(allocate, inH1), { ok: true }, 'moving house to house is fine');
assert.deepEqual(
  checkUnit({ ...allocate, houseId: 'h-1' }, inH1),
  { ok: false, reason: 'Already in House 1.' },
  'already in the chosen house is rejected before any request',
);
assert.deepEqual(checkUnit(allocate, unit({ status: 'UNASSIGNED', purchase_item: null })), {
  ok: false,
  reason: 'Not linked to a purchase yet.',
});
assert.deepEqual(checkUnit(allocate, unit({ status: 'CONSUMED' })), { ok: false, reason: 'Already used up.' });
assert.deepEqual(checkUnit(allocate, unit({ status: 'DISPOSED' })), { ok: false, reason: 'Already disposed.' });

// --- item filter --------------------------------------------------------------
const filtered: ScanPlan = { ...allocate, itemId: OTHER.id, itemName: OTHER.name };
assert.deepEqual(checkUnit(filtered, unit()), {
  ok: false,
  reason: 'Not Antibiotic — this is Newcastle vaccine.',
});
assert.deepEqual(checkUnit({ ...filtered, itemId: ITEM.id }, unit()), { ok: true });

// --- consume ------------------------------------------------------------------
assert.deepEqual(checkUnit(consume, unit()), { ok: true });
assert.deepEqual(checkUnit(consume, unit({ status: 'IN_USE' })), { ok: true }, 'a bottle can be used again');
assert.equal(checkUnit(consume, unit({ status: 'CONSUMED' })).ok, false);
assert.equal(checkUnit(consume, unit({ status: 'UNASSIGNED', purchase_item: null })).ok, false);
assert.equal(
  checkUnit(consume, unit({ purchase_item: null })).ok,
  false,
  'a unit with no purchase record cannot be consumed (no item to draw)',
);

// --- bind ---------------------------------------------------------------------
assert.deepEqual(checkUnit(bind, unit({ status: 'UNASSIGNED', purchase_item: null })), { ok: true });
assert.deepEqual(checkUnit(bind, unit()), { ok: false, reason: 'Already linked · in stock' });
assert.deepEqual(checkUnit(bind, unit({ status: 'IN_USE' })), { ok: false, reason: 'Already linked · in use' });

// --- decisions ----------------------------------------------------------------
const ok = { ok: true } as const;
const bad = { ok: false, reason: 'nope' } as const;
assert.deepEqual(decideScan('auto', ok, false), { kind: 'commit' }, 'auto confirms a passing unit at once');
assert.deepEqual(decideScan('manual', ok, false), { kind: 'hold' }, 'manual waits for Confirm');
assert.deepEqual(decideScan('auto', bad, false), { kind: 'reject', reason: 'nope' });
assert.deepEqual(decideScan('manual', bad, false), { kind: 'reject', reason: 'nope' });
assert.deepEqual(decideScan('auto', ok, true), { kind: 'duplicate' }, 'already done this session');
assert.deepEqual(decideScan('manual', bad, true), { kind: 'duplicate' }, 'duplicate wins over a failing check');

// --- whole-unit consume body --------------------------------------------------
{
  const body = consumptionBody(unit(), {
    houseId: 'h-2',
    batchId: 'b-1',
    now: new Date('2026-10-07T08:00:00.000Z'),
    key: 'k-1',
  });
  assert.equal(body.quantity, 1, 'one whole unit');
  assert.equal(body.unit, 'BOTTLE', "the purchase line's unit, never the item's base unit (ML)");
  assert.notEqual(body.unit, ITEM.unit);
  assert.equal(body.item_id, ITEM.id);
  assert.equal(body.stock_unit_id, 'u-1');
  assert.equal(body.house_id, 'h-2');
  assert.equal(body.batch_id, 'b-1');
  assert.equal(body.date, '2026-10-07T08:00:00.000Z');
  assert.equal(body.idempotency_key, 'k-1');
  const noBatch = consumptionBody(unit(), { houseId: 'h-2', now: new Date(0), key: 'k' });
  assert.equal('batch_id' in noBatch, false, 'batch_id is omitted when the house has no running batch');
  assert.throws(() => consumptionBody(unit({ purchase_item: null }), { houseId: 'h', now: new Date(0), key: 'k' }));
}

// --- idempotency keys: a rescan after a lost response reuses the key -----------
{
  let n = 0;
  const keys = newKeyStore(() => `key-${++n}`);
  const first = keys.keyFor('u-1');
  assert.equal(keys.keyFor('u-1'), first, 'same unit, same key until it is dropped');
  assert.notEqual(keys.keyFor('u-2'), first);
  keys.drop('u-1');
  assert.notEqual(keys.keyFor('u-1'), first, 'after a confirmed write the next one gets a fresh key');
}

console.log('scan-actions checks passed');
```

- [ ] **Step 4: Run it to verify it fails**

Run: `bun src/lib/scan-actions.test.ts`
Expected: FAIL — `Cannot find module './scan-actions'`.

- [ ] **Step 5: Write the implementation** — create `src/lib/scan-actions.ts`:

```ts
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
 * response replays the same key (the server then recognises the write) instead of
 * minting a second one and double-recording.
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
```

- [ ] **Step 6: Run it to verify it passes**

Run: `bun src/lib/scan-actions.test.ts`
Expected: `scan-actions checks passed`

- [ ] **Step 7: Run all scripts from `npm test`** — set the `test` script in `package.json` to:

```json
    "test": "bun src/lib/format.test.ts && bun src/lib/scan.test.ts && bun src/lib/scan-actions.test.ts"
```

Run: `bun run test` — Expected: three "checks passed" lines.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/types.ts src/lib/scan-actions.ts src/lib/scan-actions.test.ts package.json
git commit -m "feat(scan): pure decision module and unit types for scan flows"
```

---

### Task 3: Scan results, error wording, and the confirm card in the scanner (mobile)

**Files:**
- Modify: `mobile/src/lib/scan.ts`
- Modify: `mobile/src/lib/scan.test.ts`
- Modify: `mobile/src/components/ui/qr-scanner.tsx`

**Interfaces:**
- Consumes: existing `BindResult`, `classifyScan`, `markSent`, `releaseScan`, `isRetryable`.
- Produces:
  - `type ScanResult = { ok: true; label?: string } | { ok: false; message: string; retryable: boolean; label?: string } | { held: true }`
  - `type Settled = Exclude<ScanResult, { held: true }>`
  - `scanErrorMessage(status: number, detail: string | undefined): string`
  - From `qr-scanner.tsx`: `type ScanLabels`, `DEFAULT_LABELS`, `type PendingCard`; `QrScanner` props gain `labels?: ScanLabels`, `pending?: PendingCard | null`, and `onScan` returns `Promise<ScanResult>`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/scan.test.ts` (before its final `console.log`, add the import `scanErrorMessage` to the existing import list):

```ts
// --- scanErrorMessage: wording for any scan action ----------------------------
assert.equal(scanErrorMessage(403, 'forbidden'), "You don't have permission to do this.");
assert.equal(scanErrorMessage(404, 'not found'), 'Unknown code — not a ZeroD stock unit.');
assert.equal(scanErrorMessage(0, undefined), "Couldn't reach the server.");
assert.equal(
  scanErrorMessage(409, 'Unit is already at that house'),
  'Unit is already at that house',
  "the server's own plain wording is kept",
);
assert.equal(
  scanErrorMessage(400, '"BOTTLE" is not a valid unit for using this item'),
  '"BOTTLE" is not a valid unit for using this item',
);
assert.equal(scanErrorMessage(500, undefined), 'Failed with 500.');
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun src/lib/scan.test.ts`
Expected: FAIL — `scanErrorMessage` is not exported.

- [ ] **Step 3: Add the types and function** — append to `src/lib/scan.ts`:

```ts
/**
 * What a scan attempt resolved to, as the scanner needs to see it. `held` means
 * "waiting for the operator's Confirm/Cancel": no row, no buzz, and the code is
 * released so a cancelled one can be rescanned at once.
 */
export type ScanResult =
  | { ok: true; label?: string }
  | { ok: false; message: string; retryable: boolean; label?: string }
  | { held: true };

/** A scan that finished one way or the other (not held). */
export type Settled = Exclude<ScanResult, { held: true }>;

/** Wording for any scan action's failure. The server's own sentence is kept where
 *  it is already plain (already at that house, not a valid unit for using this item). */
export function scanErrorMessage(status: number, detail: string | undefined): string {
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return 'Unknown code — not a ZeroD stock unit.';
  if (status === 0) return "Couldn't reach the server.";
  return detail?.trim() || `Failed with ${status}.`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun src/lib/scan.test.ts`
Expected: `scan.ts checks passed`

- [ ] **Step 5: Generalise `QrScanner`** — in `src/components/ui/qr-scanner.tsx`:

(a) Replace the two lib imports:

```tsx
import { classifyScan, markSent, newScanState, releaseScan } from '@/lib/scan';
import type { ScanResult } from '@/lib/scan';
```

(b) Above `type QrScannerProps`, add:

```tsx
/** Everything the scanner says that depends on what the scan is *for*. Defaults are Bind's wording. */
export type ScanLabels = {
  /** "3 linked" */
  done: string;
  /** Flash after a success: "Linked …a3f9" */
  flashOk: string;
  offlineTitle: string;
  offlineBody: string;
  /** Shown while the list is empty. */
  hint: string;
};

export const DEFAULT_LABELS: ScanLabels = {
  done: 'linked',
  flashOk: 'Linked',
  offlineTitle: 'Linking needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan the whole pallet without stopping.',
};

/** A scanned unit waiting for the operator's Confirm or Cancel (manual mode). */
export type PendingCard = {
  title: string;
  subtitle?: string;
  details: { label: string; value: string }[];
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};
```

(c) In `QrScannerProps`: change `onScan` and add two props:

```tsx
  onScan: (id: string) => Promise<ScanResult>;
  /** Wording for this action. Defaults to Bind's. */
  labels?: ScanLabels;
  /** While set, scanning is paused and the card replaces the result list. */
  pending?: PendingCard | null;
```

(d) In the destructured props add `labels = DEFAULT_LABELS, pending = null,`.

(e) In `handle`: change the guard and add the held branch.

Replace `if (offline || inFlight.current) return;` with:

```tsx
      if (offline || pending || inFlight.current) return;
```

Replace `show('warn', 'Already linked in this session');` with:

```tsx
        show('warn', `Already ${labels.done} in this session`);
```

Replace these two lines:

```tsx
        const result = await onScan(outcome.id);
        const label = `…${outcome.id.slice(-7)}`;
```

with:

```tsx
        const result = await onScan(outcome.id);

        if ('held' in result) {
          // Waiting on Confirm/Cancel. Release the code so a cancelled one can be rescanned.
          releaseScan(session.current, outcome.id);
          return;
        }

        const label = result.label ?? `…${outcome.id.slice(-7)}`;
```

Replace `show('ok', \`Linked ${label}\`);` with:

```tsx
        show('ok', `${labels.flashOk} ${label}`);
```

Add `pending` and `labels` to the `useCallback` deps: `[offline, pending, labels, onScan, onScanned]`.

(f) Header count: replace `{linked} linked` with `{linked} {labels.done}`.

(g) Blocked (offline) block: replace the `title`/`body` of the offline `<Blocked>` with `title={labels.offlineTitle}` and `body={labels.offlineBody}`.

(h) Empty-list hint: replace the hard-coded "Point the camera at a code…" text with `{labels.hint}`.

(i) Replace the panel's list-and-Done region. Wrap the existing `rows.length === 0 ? … : …` ScrollView block **and** the `<View style={styles.done}>…</View>` in a conditional:

```tsx
            {pending ? (
              <View style={styles.pending}>
                <AppText variant="h2">{pending.title}</AppText>
                {pending.subtitle ? (
                  <AppText variant="data" color="muted">
                    {pending.subtitle}
                  </AppText>
                ) : null}
                {pending.details.map((d) => (
                  <View key={d.label} style={styles.detail}>
                    <AppText variant="label" color="muted" style={styles.detailLabel}>
                      {d.label}
                    </AppText>
                    <AppText variant="body" style={styles.flex}>
                      {d.value}
                    </AppText>
                  </View>
                ))}
                <Button label={pending.confirmLabel} onPress={pending.onConfirm} loading={pending.busy} />
                <Button variant="ghost" label="Cancel" onPress={pending.onCancel} disabled={pending.busy} block />
              </View>
            ) : (
              <>
                {/* the existing rows ScrollView / empty hint, unchanged apart from (h) */}
                {/* the existing <View style={styles.done}> with the Done button, unchanged */}
              </>
            )}
```

(j) Add to `StyleSheet.create`:

```tsx
  pending: { gap: Spacing.sm },
  detail: { flexDirection: 'row', gap: Spacing.sm },
  detailLabel: { width: 72 },
```

Also raise the panel's cap so the card fits: change `maxHeight: '42%'` to `maxHeight: '60%'`.

- [ ] **Step 6: Typecheck, lint, and keep Bind working**

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: clean. `link.tsx` still compiles unchanged because its `bind` returns `BindResult`, which is assignable to `ScanResult`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scan.ts src/lib/scan.test.ts src/components/ui/qr-scanner.tsx
git commit -m "feat(scan): held results, confirm card and per-action wording in the scanner"
```

---

### Task 4: The scan session hook (mobile)

**Files:**
- Create: `mobile/src/lib/use-scan-session.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` (`@/lib/api`); `buzz` (`@/lib/haptics`); `isRetryable`, `scanErrorMessage`, `ScanResult`, `Settled` (`@/lib/scan`); `checkUnit`, `currentHouseName`, `decideScan`, `newKeyStore`, `Mode`, `ScanPlan` (`@/lib/scan-actions`); `PendingCard`, `ScanRow` (`@/components/ui/qr-scanner`); `StockUnit` (`@/lib/types`).
- Produces: `useScanSession({ plan, mode, commit, confirmLabel })` returning `{ rows, onScan, onScanned, pending, runManual, reset }` where `commit: (unit: StockUnit, key: string) => Promise<void>` (throws `ApiError` on failure), `onScan: (id) => Promise<ScanResult>`, `onScanned: (row: ScanRow) => void`, `pending: PendingCard | null`, `runManual: (id) => Promise<boolean>`, `reset: () => void`.

This file is React state wiring over the pure module tested in Task 2; it is verified by typecheck and the device checks in Task 8. There is no unit test because the logic worth testing is already in `scan-actions.ts`.

- [ ] **Step 1: Create the hook** — `src/lib/use-scan-session.ts`:

```ts
import { useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import type { PendingCard, ScanRow } from '@/components/ui/qr-scanner';
import { ApiError, apiFetch } from '@/lib/api';
import { buzz } from '@/lib/haptics';
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

/**
 * One scan session: look the unit up, decide (pure, see scan-actions.ts), then either
 * write straight away (auto), hold for Confirm/Cancel (manual), or explain why not.
 * docs/scan-flows-design.md §3.
 */
export function useScanSession({ plan, mode, commit, confirmLabel }: Options) {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [held, setHeld] = useState<StockUnit | null>(null);
  const [busy, setBusy] = useState(false);
  // Mutated only inside callbacks, never read during render.
  const done = useRef(new Set<string>());
  const keys = useRef(newKeyStore(() => Crypto.randomUUID()));

  const labelOf = (unit: StockUnit) => `${unit.purchase_item?.item.name ?? 'Unit'} ${tail(unit.id)}`;

  const finish = async (unit: StockUnit): Promise<Settled> => {
    try {
      await commit(unit, keys.current.keyFor(unit.id));
      done.current.add(unit.id);
      keys.current.drop(unit.id);
      return { ok: true, label: labelOf(unit) };
    } catch (err) {
      return failure(err);
    }
  };

  const onScan = async (id: string): Promise<ScanResult> => {
    let unit: StockUnit;
    try {
      unit = await apiFetch<StockUnit>(`/stock-units/${id}`);
    } catch (err) {
      return failure(err);
    }

    const decision = decideScan(mode, checkUnit(plan, unit), done.current.has(unit.id));
    switch (decision.kind) {
      case 'duplicate':
        return { ok: false, message: 'Already done in this session.', retryable: false };
      case 'reject':
        return { ok: false, message: decision.reason, retryable: false, label: labelOf(unit) };
      case 'hold':
        setHeld(unit);
        return { held: true };
      case 'commit':
        return finish(unit);
    }
  };

  const confirm = async () => {
    if (!held) return;
    setBusy(true);
    const result = await finish(held);
    setRows((prev) => [toRow(held.id, result), ...prev]);
    buzz(result.ok ? 'success' : 'error');
    setHeld(null);
    setBusy(false);
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
        onConfirm: () => void confirm(),
        onCancel: () => setHeld(null),
      }
    : null;

  return {
    rows,
    onScan,
    onScanned: (row: ScanRow) => setRows((prev) => [row, ...prev]),
    pending,
    /** A typed code (no camera): same pipeline, result goes straight into the list. */
    runManual: async (id: string): Promise<boolean> => {
      const result = await onScan(id);
      if ('held' in result) return false;
      setRows((prev) => [toRow(id, result), ...prev]);
      return result.ok;
    },
    /** A changed plan is a new session — counts and the done-set must not carry over. */
    reset: () => {
      setRows([]);
      setHeld(null);
      done.current.clear();
    },
  };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: clean. If the React Compiler lint objects to a ref read during render, move the offending read inside a callback; `done` and `keys` are only touched in callbacks as written.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-scan-session.ts
git commit -m "feat(scan): scan session hook (lookup, decide, hold or commit)"
```

---

### Task 5: Shared scan UI parts and the Allocate screen (mobile)

**Files:**
- Create: `mobile/src/components/scan-parts.tsx`
- Create: `mobile/src/app/scan/allocate.tsx`
- Modify: `mobile/src/components/log-sheet.tsx`

**Interfaces:**
- Consumes: `useScanSession` (Task 4), `QrScanner`/`ScanLabels`/`ScanRow` (Task 3), `ScanPlan`/`Mode` (Task 2).
- Produces: `ScanModeField({ value, onChange })`, `ScanResults({ rows, done })`, `OfflineNote({ what })`; route `/scan/allocate?house_id=`.

- [ ] **Step 1: Shared parts** — `src/components/scan-parts.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { LedgerRow } from '@/components/ui/ledger-row';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import type { ScanRow } from '@/components/ui/qr-scanner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Mode } from '@/lib/scan-actions';

/** Manual (confirm each unit) or Auto (record matching units straight away). */
export function ScanModeField({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={styles.group}>
      <AppText variant="eyebrow" color="muted">
        When I scan
      </AppText>
      <SegmentedToggle
        height={48}
        options={[
          { value: 'manual', label: 'Ask me first' },
          { value: 'auto', label: 'Record at once' },
        ]}
        value={value}
        onChange={onChange}
      />
      <AppText variant="caption" color="muted">
        {value === 'manual'
          ? 'Each unit is shown for you to confirm or cancel.'
          : 'A unit that matches is recorded straight away. Anything that does not match stops and says why.'}
      </AppText>
    </View>
  );
}

/** The session's results, newest first. Renders nothing until there is one. */
export function ScanResults({ rows, done }: { rows: ScanRow[]; done: string }) {
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.state === 'ok').length;
  return (
    <Card rows eyebrow="Scanned" note={`${ok} ${done}`} style={styles.card}>
      {rows.map((row, i) => (
        <LedgerRow
          key={`${row.id}-${i}`}
          gutterNode={
            <Icon
              name={row.state === 'ok' ? 'check-circle' : 'alert-circle'}
              size={20}
              color={row.state === 'ok' ? 'success' : 'critical'}
            />
          }
          last={i === rows.length - 1}
        >
          <AppText variant="bodyStrong">{row.label}</AppText>
          {row.message ? (
            <AppText variant="caption" color="critical">
              {row.message}
            </AppText>
          ) : null}
        </LedgerRow>
      ))}
    </Card>
  );
}

/** These screens check every code against the server, so they can't run offline. */
export function OfflineNote({ what }: { what: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.offline, { backgroundColor: theme.tintRed }]}>
      <Icon name="wifi-off" size={20} color="critical" />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{what} needs a connection.</AppText>
        <AppText variant="caption" color="muted">
          Each code is checked against the server as you scan. Everything else in the app still works offline.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.sm },
  card: { marginTop: Spacing.md },
  offline: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.md,
  },
});
```

- [ ] **Step 2: The Allocate screen** — `src/app/scan/allocate.tsx`:

```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { ItemPicker } from '@/components/ui/item-picker';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import type { Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { Item } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'moved',
  flashOk: 'Moved',
  offlineTitle: 'Moving needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan every unit going into this house.',
};

/** docs/scan-flows-design.md — plan first (which house), then scan units into it. */
export default function AllocateScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const session = useScanSession({
    plan: { action: 'allocate', houseId: house?.id, itemId: item?.id, itemName: item?.name },
    mode,
    confirmLabel: house ? `Move to ${house.name}` : 'Move',
    commit: async (unit, key) => {
      await apiFetch(`/stock-units/${unit.id}/relocate`, {
        method: 'POST',
        body: JSON.stringify({ house_id: house?.id, idempotency_key: key }),
      });
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    },
  });

  return (
    <Screen>
      <Header title="Move to house" leading="back" />

      <View style={styles.form}>
        <HousePicker
          label="Move into"
          value={house}
          onChange={(h) => {
            setHouse(h);
            session.reset();
          }}
        />
        <ItemPicker
          unitTracked
          value={item}
          onChange={(i) => {
            setItem(i);
            session.reset();
          }}
        />
        {item ? (
          <Button
            variant="ghost"
            label="Any item"
            onPress={() => {
              setItem(null);
              session.reset();
            }}
            block
          />
        ) : null}
        <ScanModeField value={mode} onChange={setMode} />
      </View>

      {offline ? (
        <OfflineNote what="Moving" />
      ) : (
        <View style={styles.actions}>
          <Button label="Scan codes" icon="camera" disabled={!house} onPress={() => setScanning(true)} />
        </View>
      )}

      <ScanResults rows={session.rows} done="moved" />

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={house ? `Into ${house.name}` : ''}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        offline={offline}
        labels={LABELS}
        pending={session.pending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, marginTop: Spacing.xs },
  actions: { marginTop: Spacing.lg },
});
```

- [ ] **Step 3: Log sheet entry** — in `src/components/log-sheet.tsx`, inside the `worker` array in `buildActions`, add after the Treatment entry:

```tsx
    {
      label: 'Move to house',
      description: 'Scan units into a house',
      path: withHouse('/scan/allocate'),
      icon: 'corner-down-right',
      tint: 'tintGreen',
    },
```

- [ ] **Step 4: Typecheck, lint**

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: clean. If `corner-down-right` is not an accepted `IconName`, use `'arrow-right'`; both are Feather glyphs.

- [ ] **Step 5: Smoke the screen in the browser** (the camera can't run on web, but the plan step can)

Start the web build (`CI=1 EXPO_PUBLIC_API_BASE_URL=http://localhost:5085/api bunx expo start --web --port 8099`), sign in as the test worker, open `/scan/allocate`.
Expected: house picker, item picker, "When I scan" toggle, **Scan codes disabled until a house is chosen**; picking a house enables it. Check light and dark.

- [ ] **Step 6: Commit**

```bash
git add src/components/scan-parts.tsx src/app/scan/allocate.tsx src/components/log-sheet.tsx
git commit -m "feat(scan): move-to-house screen and shared scan UI parts"
```

---

### Task 6: The Consume screen (mobile)

**Files:**
- Create: `mobile/src/app/scan/consume.tsx`
- Modify: `mobile/src/components/log-sheet.tsx`

**Interfaces:**
- Consumes: `useScanSession`, `consumptionBody` (Task 2), `ScanModeField`/`ScanResults`/`OfflineNote` (Task 5), `useResolvedBatch`/`BatchResolver` (`@/components/ui/batch-resolver`).
- Produces: route `/scan/consume?house_id=`.

- [ ] **Step 1: The screen** — `src/app/scan/consume.tsx`:

```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { ItemPicker } from '@/components/ui/item-picker';
import { QrScanner, type ScanLabels } from '@/components/ui/qr-scanner';
import { OfflineNote, ScanModeField, ScanResults } from '@/components/scan-parts';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { consumptionBody, type Mode } from '@/lib/scan-actions';
import { useScanSession } from '@/lib/use-scan-session';
import type { Item } from '@/lib/types';

const LABELS: ScanLabels = {
  done: 'used',
  flashOk: 'Used',
  offlineTitle: 'Recording use needs a connection.',
  offlineBody:
    "Each code is checked against the server as you scan, so this screen can't work offline. Everything else in the app can.",
  hint: 'Point the camera at a code. The camera stays open — scan every unit you used.',
};

/** docs/scan-flows-design.md — a coded unit is used whole: no quantity, one scan = one unit used. */
export default function ConsumeScreen() {
  const params = useLocalSearchParams<{ house_id?: string }>();
  const queryClient = useQueryClient();
  const offline = useNetworkState().isConnected === false;

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [item, setItem] = useState<Item | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const [scanning, setScanning] = useState(false);

  const { balance } = useResolvedBatch(house?.id);

  const session = useScanSession({
    plan: { action: 'consume', houseId: house?.id, itemId: item?.id, itemName: item?.name },
    mode,
    confirmLabel: 'Record as used',
    commit: async (unit, key) => {
      if (!house) return;
      await apiFetch('/consumptions', {
        method: 'POST',
        body: JSON.stringify(
          consumptionBody(unit, {
            houseId: house.id,
            batchId: balance?.batch_id,
            now: new Date(),
            key,
          }),
        ),
      });
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
      void queryClient.invalidateQueries({ queryKey: ['consumptions'] });
    },
  });

  return (
    <Screen>
      <Header title="Use an item" leading="back" />

      <View style={styles.form}>
        <HousePicker
          label="Used in"
          value={house}
          onChange={(h) => {
            setHouse(h);
            session.reset();
          }}
        />
        <BatchResolver houseId={house?.id} />
        <ItemPicker
          unitTracked
          value={item}
          onChange={(i) => {
            setItem(i);
            session.reset();
          }}
        />
        {item ? (
          <Button
            variant="ghost"
            label="Any item"
            onPress={() => {
              setItem(null);
              session.reset();
            }}
            block
          />
        ) : null}
        <ScanModeField value={mode} onChange={setMode} />
      </View>

      {offline ? (
        <OfflineNote what="Recording use" />
      ) : (
        <View style={styles.actions}>
          <Button label="Scan codes" icon="camera" disabled={!house} onPress={() => setScanning(true)} />
        </View>
      )}

      <ScanResults rows={session.rows} done="used" />

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        context={house ? `Used in ${house.name}` : ''}
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        offline={offline}
        labels={LABELS}
        pending={session.pending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, marginTop: Spacing.xs },
  actions: { marginTop: Spacing.lg },
});
```

- [ ] **Step 2: Log sheet entry** — in `buildActions`' `worker` array, after "Move to house":

```tsx
    {
      label: 'Use an item',
      description: 'Scan a bottle or tool you used',
      path: withHouse('/scan/consume'),
      icon: 'box',
      tint: 'tintAmber',
    },
```

- [ ] **Step 3: Typecheck, lint**

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: clean.

- [ ] **Step 4: Smoke in the browser**

Sign in as the test worker, open `/scan/consume`. Expected: house + batch card + item + mode; **Scan codes disabled until a house is chosen**; picking a house shows its batch. Open the log sheet: "Move to house" and "Use an item" appear in the worker group.

- [ ] **Step 5: Commit**

```bash
git add src/app/scan/consume.tsx src/components/log-sheet.tsx
git commit -m "feat(scan): use-an-item screen (whole-unit consume by scan)"
```

---

### Task 7: Move Bind onto the shared session (mobile)

**Files:**
- Modify: `mobile/src/app/(manager)/link.tsx`

**Interfaces:**
- Consumes: `useScanSession`, `ScanModeField`, `ScanResults`.
- Produces: Link screen with the same plan/mode/confirm behaviour; default mode **auto** so a pallet still scans without stopping.

- [ ] **Step 1: Swap the imports** — remove `ApiError` and the `bindErrorMessage, isRetryable, BindResult` import and the `ScanRow` type import; add:

```tsx
import { ScanModeField, ScanResults } from '@/components/scan-parts';
import { useScanSession } from '@/lib/use-scan-session';
import type { Mode } from '@/lib/scan-actions';
```

Keep `apiFetch`, `useGetData`, `Paginated`, `QrScanner`, `useQueryClient`.

- [ ] **Step 2: Replace the session state and the bind functions.** Delete the `rows` state, the `bind` function, the `bindManually` function and the `linked` constant. After `const [scanning, setScanning] = ...` add:

```tsx
  const [mode, setMode] = useState<Mode>('auto');

  const session = useScanSession({
    plan: { action: 'bind', purchaseItemId: lot?.id },
    mode,
    confirmLabel: 'Link',
    commit: async (unit) => {
      await apiFetch(`/stock-units/${unit.id}/bind`, {
        method: 'POST',
        body: JSON.stringify({ purchase_item_id: lot?.id }),
      });
      // Anything showing unit counts or unassigned units is now stale.
      void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    },
  });

  const linked = session.rows.filter((r) => r.state === 'ok').length;

  const bindManually = async (id: string) => {
    if (await session.runManual(id)) {
      setQuery('');
      setManual(false);
    }
  };
```

- [ ] **Step 3: Update the JSX.**
  - In the lot `PickerField` `onChange`, replace `setRows([])` with `session.reset()`.
  - Above the "Scan codes" button (inside the non-offline branch), add `<ScanModeField value={mode} onChange={setMode} />`.
  - Replace the whole `{rows.length > 0 && (<Card …>…</Card>)}` block with `<ScanResults rows={session.rows} done="linked" />`.
  - Replace the `QrScanner` props `onScan={bind}`, `rows={rows}`, `onScanned={(row) => setRows((prev) => [row, ...prev])}` with:

```tsx
        onScan={session.onScan}
        rows={session.rows}
        onScanned={session.onScanned}
        pending={session.pending}
```

  (`labels` is omitted: the defaults are Bind's wording.)

- [ ] **Step 4: Remove now-unused imports** (`Card`, `LedgerRow` are still used by the manual-search list; `Icon`/`IconTile` still used). Let lint tell you.

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: clean, no unused-variable warnings.

- [ ] **Step 5: Smoke in the browser**

Sign in as the test manager, open `/link`. Expected: lot picker; after choosing a lot, the mode toggle and "Scan codes" appear, default "Record at once"; the typed-code fallback still works.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(manager)/link.tsx"
git commit -m "feat(scan): bind uses the shared scan session, with manual or auto confirm"
```

---

### Task 8: Verify, document, merge

**Files:**
- Modify: `mobile/docs/scan-flows-design.md` (status line)
- Modify: `mobile/docs/ux-audit-2026-10.md` (note A1, A2-coded done)

- [ ] **Step 1: Everything green**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
bun run test && bunx tsc --noEmit && bunx expo lint
```
Expected: three "checks passed" lines; no type or lint output.

- [ ] **Step 2: API smoke with the test accounts** (proves the server accepts what the app sends)

Using the test worker (credentials are in `server/.env.local`, do not print them): sign in at `POST /api/auth/login`, then with the bearer token:
1. `GET /api/stock-units?status=IN_STOCK&limit=1` — take one unit.
2. `POST /api/stock-units/<id>/relocate` with `{ "house_id": "<an active house id>" }` — expect 200 (this proves Task 1).
3. `POST /api/consumptions` with the body shape from `consumptionBody` (`quantity: 1`, `unit` = the unit's purchase line unit) — expect 201, **or** the plain 400 `"X" is not a valid unit for using this item`, which means that item still needs an `ItemUnit` row with `is_usable` (a data setup step in the admin dashboard, not an app bug).
If no IN_STOCK unit exists, provision and bind one from the admin dashboard first.

- [ ] **Step 3: Device checks** (the web build cannot run the camera; do these on a phone or simulator with a real printed or on-screen QR)

- [ ] Allocate, manual: scan → card shows item, status, "Now at"; **Cancel** then rescan the same code works at once; **Move to <house>** records it; the row appears; the unit's location changes in the web dashboard.
- [ ] Allocate, auto: a matching unit records without a card; a unit already in that house stops with "Already in <house>."
- [ ] Allocate with an item filter: a different item's unit is rejected with "Not <item> — this is <other>."
- [ ] Consume: a unit flips to in use; scanning the same unit again in the session says it's already done; a used-up or blank code is rejected.
- [ ] Bind (manager): auto mode still links a whole pallet without stopping; manual mode shows the card.
- [ ] Airplane mode: all three screens show the blocked message instead of the camera.
- [ ] Camera permission denied: "Camera access is off" with an Allow button.
- [ ] As the test **worker**, Bind is not offered in the log sheet; Allocate and Consume are.
- [ ] Dark mode on all three screens and the confirm card; text at the largest system font size does not clip.

- [ ] **Step 4: Update docs** — in `docs/scan-flows-design.md` change the status line to `Status: **Built** (Allocate, Consume, Bind upgraded). Offline queueing and dispose-by-scan are not built.` and in `docs/ux-audit-2026-10.md` section H add: `A1 and the coded-unit part of A2: built as scan flows (docs/superpowers/plans/2026-10-07-scan-flows.md).`

- [ ] **Step 5: Commit and merge**

```bash
git add docs/scan-flows-design.md docs/ux-audit-2026-10.md
git commit -m "docs: mark scan flows built"
git checkout main && git merge --no-ff feat/scan-flows -m "Merge feat/scan-flows: allocate, consume and bind by scan" && git branch -d feat/scan-flows
```

---

## Self-review

- **Spec coverage:** plan-then-scan (Tasks 5–7), manual/auto confirm (Tasks 2–4), whole units with `quantity: 1` + purchase unit (Task 2 `consumptionBody`), allocate/consume/bind requests and checks (Tasks 2, 5–7), Bind upgrade (Task 7), allocate and consume as worker actions and Bind manager-only (Task 1 permission, Task 5–6 sheet entries), offline = blocked (Tasks 5–7, constraints), shared stock-transfer id for batched allocations (**deliberately not built**: needs an aggregate `StockTransfer` created first and the server accepts an optional link; revisit if ledger noise from per-unit allocations matters), dispose-by-scan (out of scope per spec).
- **Placeholders:** none; every code step has code. Task 3(i) refers to "the existing rows block, unchanged" because it wraps existing JSX rather than replacing it; the surrounding conditional and the new card are shown in full.
- **Type consistency:** `ScanResult`/`Settled` (Task 3) are what `useScanSession` returns (Task 4); `QrScanner.onScan` accepts `Promise<ScanResult>`; `useScanSession.commit(unit, key)` matches all three screens; `consumptionBody` and `newKeyStore` signatures match Task 2's test and Task 4/6 usage; `ScanPlan.itemName` is used by `checkUnit` and set by both screens.
- **Review Focus:** each line maps to a pinned test (Tasks 1–3) or a device check (Task 8 Step 3).
