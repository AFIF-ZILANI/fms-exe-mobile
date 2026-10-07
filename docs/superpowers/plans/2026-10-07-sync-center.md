# Sync Center (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One screen that shows what is waiting to send and what failed, in plain words, with Retry and Discard for failed records; failed records no longer trap a person on a phone they want to log out of.

**Architecture:** Two pure, tested helpers (`lib/outbox-describe.ts` turns a queued row into words; `lib/logout-decision.ts` decides whether logout is blocked, needs a discard confirmation, or may go) carry the logic. A small hook reads the queue rows into local state (not the persisted query cache, because queued bodies are personal data). A new `/sync` screen, a Settings entry, the sync banner and `useLogout` use them.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / expo-sqlite outbox (already built) / TanStack Query / Bun assertion scripts. No new dependencies.

**Spec:** `mobile/docs/navigation-redesign-design.md` §Phases 2.

## Global Constraints

- Branch → change → verify → merge. Work on `feat/sync-center` in `mobile/` (own git repo); never commit to `main`. Commit messages carry **no attribution lines**.
- No new dependencies. `bunx tsc --noEmit`, `bunx expo lint`, `bun run test` clean before any task is done.
- React Compiler: no ref reads/writes and no `new Date()`/`Date.now()` during render.
- **Failed records may only leave the phone by an explicit person's choice** (Discard, or "Log out and discard"). Pending (unsent, not failed) records still block logout: they would upload under whoever is signed in next.
- Queued request bodies are personal data: they must NOT be stored in the persisted TanStack query cache (`fms:query-cache`). Read them into component state.
- Retry means `retryDeadLetter(key)` then a flush; Discard means `discardDeadLetter(key)`. Do not change `lib/outbox.ts`.
- Plain words only (no endpoints, no HTTP codes on screen), design tokens and shared components, 48dp targets, status by icon or word, light and dark.

## Review Focus

- A row with an unknown endpoint, a missing or malformed body, or no error text still renders sensibly (a generic title, no crash, a default reason). Pinned in Task 1.
- Logout decision: any pending record blocks even when failed ones exist; only failed records ask to discard; nothing queued goes straight through. Pinned in Task 1.
- "Log out and discard" discards every failed record before logging out, and never discards pending ones. Task 2.
- Discard always asks first and says the record was never saved on the server. Task 2.
- The queue rows never reach the persisted query cache. Task 2.
- The Sync center and Settings render nothing (not an error) after logout. Task 2.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/outbox-describe.ts` (new) + `.test.ts` | Pure: queued row → title/detail; error text → plain reason. |
| `src/lib/logout-decision.ts` (new) + `.test.ts` | Pure: blocked / confirm-discard / go. |
| `src/lib/use-outbox.ts` | `useOutboxRows()` — queue rows in local state. |
| `src/app/sync.tsx` (new) | The Sync center screen. |
| `src/lib/use-logout.ts` | Use `logoutDecision`; discard-and-logout path. |
| `src/app/settings.tsx` | "Sync center" row with an attention count. |
| `src/components/ui/sync-banner.tsx` | Failed state opens the Sync center. |
| `package.json` | `test` script runs the two new scripts. |

---

### Task 1: Pure helpers

**Files:**
- Create: `mobile/src/lib/outbox-describe.ts`, `mobile/src/lib/outbox-describe.test.ts`
- Create: `mobile/src/lib/logout-decision.ts`, `mobile/src/lib/logout-decision.test.ts`
- Modify: `mobile/package.json`

**Interfaces (exact names used by Task 2):**
- `outbox-describe.ts`: `describeOutboxRow(row: Pick<OutboxRow, 'endpoint' | 'body'>): { title: string; detail: string | null }`, `plainReason(lastError: string | null | undefined): string`
- `logout-decision.ts`: `type LogoutDecision = 'blocked' | 'confirm-discard' | 'go'`, `logoutDecision(pending: number, failed: number): LogoutDecision`

- [ ] **Step 1: Branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
git checkout main && git checkout -b feat/sync-center
```

- [ ] **Step 2: Write the failing describe test** — `src/lib/outbox-describe.test.ts`:

```ts
/** Queued-record wording. Run: `bun src/lib/outbox-describe.test.ts`. */

import assert from 'node:assert/strict';

import { describeOutboxRow, plainReason } from './outbox-describe';

const d = (endpoint: string, body: unknown) =>
  describeOutboxRow({ endpoint, body: typeof body === 'string' ? body : JSON.stringify(body) });

// --- known endpoints get a plain title (and a detail where the body has one) ----------------
assert.deepEqual(d('/mortality-logs', { count_died: 12 }), { title: 'Mortality', detail: '12 died' });
assert.deepEqual(d('/mortality-logs', { count_died: 1 }), { title: 'Mortality', detail: '1 died' });
assert.deepEqual(d('/consumptions', { quantity: 2.5, unit: 'KG' }), { title: 'Feed or item use', detail: '2.5 kg' });
assert.deepEqual(d('/consumptions', { quantity: 1, unit: 'BOTTLE', stock_unit_id: 'u' }), {
  title: 'Feed or item use',
  detail: '1 bottle',
});
assert.deepEqual(d('/medications', { medicine_name: 'Amoxy' }), { title: 'Medication', detail: 'Amoxy' });
assert.deepEqual(d('/vaccinations', { vaccine_name: 'Newcastle' }), { title: 'Vaccination', detail: 'Newcastle' });
assert.deepEqual(d('/batch-house-allocations', { quantity: 500 }), { title: 'Birds moved', detail: '500 birds' });
assert.equal(d('/weight-records', {}).title, 'Weight sample');
assert.equal(d('/environment-records', {}).title, 'Environment readings');
assert.equal(d('/task-assignments/abc-123/complete', {}).title, 'Task marked done');
assert.equal(d('/task-assignments/abc-123/cancel', {}).title, 'Task cancelled');
assert.equal(d('/task-assignments', { title: 'Check water' }).title, 'Task assigned');
assert.equal(d('/task-assignments', { title: 'Check water' }).detail, 'Check water');
assert.equal(d('/performance-score-entries', {}).title, 'Points given');
assert.equal(d('/inventory-adjustments', {}).title, 'Stock discrepancy');
assert.equal(d('/alerts', {}).title, 'Low-stock flag');
assert.equal(d('/batch-feeding-programs', {}).title, 'Feeding plan phase');
assert.equal(d('/stock-units/9f1c/bind', {}).title, 'Item linked');

// --- no detail when the body lacks the field, or it is the wrong type ------------------------------
assert.equal(d('/mortality-logs', {}).detail, null);
assert.equal(d('/mortality-logs', { count_died: 'many' }).detail, null);
assert.equal(d('/consumptions', { quantity: 'x' }).detail, null);
assert.equal(d('/medications', { medicine_name: '   ' }).detail, null);

// --- never crashes: unknown endpoint, malformed or non-object body ------------------------------------
assert.deepEqual(d('/something-new', {}), { title: 'A record', detail: null });
assert.deepEqual(d('/mortality-logs', 'not json {'), { title: 'Mortality', detail: null });
assert.deepEqual(d('/mortality-logs', 'null'), { title: 'Mortality', detail: null });
assert.deepEqual(d('/mortality-logs', '[1,2]'), { title: 'Mortality', detail: null });
assert.deepEqual(d('', '{}'), { title: 'A record', detail: null });

// --- no raw endpoint or id ever leaks into the words ---------------------------------------------------
for (const [endpoint, body] of [
  ['/task-assignments/abc-123/complete', {}],
  ['/stock-units/9f1c/bind', {}],
  ['/mortality-logs', { count_died: 3 }],
] as const) {
  const { title, detail } = d(endpoint, body);
  assert.ok(!title.includes('/') && !title.includes('abc-123') && !title.includes('9f1c'), title);
  assert.ok(!(detail ?? '').includes('/'));
}

// --- plain reasons ---------------------------------------------------------------------------------------
assert.equal(plainReason(null), 'The server refused this record.');
assert.equal(plainReason(undefined), 'The server refused this record.');
assert.equal(plainReason('   '), 'The server refused this record.');
assert.equal(
  plainReason('"BOTTLE" is not a valid unit for using this item -- add or update the conversion via POST /item-units first'),
  "This item can't be used by that unit yet. Ask a manager to set it up.",
);
assert.equal(plainReason('Only 4 of this item is on hand at this house'), 'Only 4 of this item is on hand at this house');
assert.equal(plainReason('Error: Count must be positive'), 'Count must be positive');
assert.equal(plainReason('idempotency_key already in use'), 'Already recorded.');
{
  const long = 'x'.repeat(400);
  const out = plainReason(long);
  assert.equal(out.length, 160);
  assert.ok(out.endsWith('…'));
}

console.log('outbox-describe checks passed');
```

- [ ] **Step 3: Run it to verify it fails** — `bun src/lib/outbox-describe.test.ts` → FAIL, module not found.

- [ ] **Step 4: Implement** — `src/lib/outbox-describe.ts`:

```ts
import type { OutboxRow } from './outbox';

export type DescribedRow = { title: string; detail: string | null };

type Body = Record<string, unknown>;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

type Rule = { match: RegExp; title: string; detail?: (b: Body) => string | null };

/** Every write the app queues, in the words a worker uses. Order does not matter: patterns are anchored. */
const RULES: Rule[] = [
  { match: /^\/mortality-logs$/, title: 'Mortality', detail: (b) => (count(b.count_died) !== null ? `${b.count_died} died` : null) },
  {
    match: /^\/consumptions$/,
    title: 'Feed or item use',
    detail: (b) => {
      const q = count(b.quantity);
      if (q === null) return null;
      const unit = text(b.unit);
      return unit ? `${q} ${unit.toLowerCase()}` : String(q);
    },
  },
  { match: /^\/weight-records$/, title: 'Weight sample' },
  { match: /^\/environment-records$/, title: 'Environment readings' },
  { match: /^\/medications$/, title: 'Medication', detail: (b) => text(b.medicine_name) },
  { match: /^\/vaccinations$/, title: 'Vaccination', detail: (b) => text(b.vaccine_name) },
  { match: /^\/task-assignments\/[^/]+\/complete$/, title: 'Task marked done' },
  { match: /^\/task-assignments\/[^/]+\/cancel$/, title: 'Task cancelled' },
  { match: /^\/task-assignments$/, title: 'Task assigned', detail: (b) => text(b.title) },
  { match: /^\/batch-house-allocations$/, title: 'Birds moved', detail: (b) => (count(b.quantity) !== null ? `${b.quantity} birds` : null) },
  { match: /^\/performance-score-entries$/, title: 'Points given' },
  { match: /^\/inventory-adjustments$/, title: 'Stock discrepancy' },
  { match: /^\/alerts$/, title: 'Low-stock flag' },
  { match: /^\/batch-feeding-programs$/, title: 'Feeding plan phase' },
  { match: /^\/stock-units\/[^/]+\/bind$/, title: 'Item linked' },
];

function parseBody(raw: string): Body {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Body) : {};
  } catch {
    return {};
  }
}

/** A queued write in plain words. Never throws: an unknown endpoint is "A record", a bad body just has no detail. */
export function describeOutboxRow(row: Pick<OutboxRow, 'endpoint' | 'body'>): DescribedRow {
  const rule = RULES.find((r) => r.match.test(row.endpoint));
  if (!rule) return { title: 'A record', detail: null };
  return { title: rule.title, detail: rule.detail ? rule.detail(parseBody(row.body)) : null };
}

/** Why the server refused a record, said plainly. The server's own sentence is kept when it is already readable. */
export function plainReason(lastError: string | null | undefined): string {
  const e = lastError?.trim();
  if (!e) return 'The server refused this record.';
  if (/not a valid unit for using this item/i.test(e)) {
    return "This item can't be used by that unit yet. Ask a manager to set it up.";
  }
  if (/idempotency/i.test(e)) return 'Already recorded.';
  const clean = e.replace(/^error:\s*/i, '');
  return clean.length > 160 ? `${clean.slice(0, 159)}…` : clean;
}
```

- [ ] **Step 5: Run it to verify it passes** — `bun src/lib/outbox-describe.test.ts` → `outbox-describe checks passed`.

- [ ] **Step 6: Logout decision test** — `src/lib/logout-decision.test.ts`:

```ts
/** Whether logging out is allowed. Run: `bun src/lib/logout-decision.test.ts`. */

import assert from 'node:assert/strict';

import { logoutDecision } from './logout-decision';

// Nothing queued: straight through.
assert.equal(logoutDecision(0, 0), 'go');

// Records still waiting to send block, because they would upload under whoever signs in next.
assert.equal(logoutDecision(3, 0), 'blocked');
assert.equal(logoutDecision(1, 0), 'blocked');

// Only failed records: ask, and the answer may be to discard them.
assert.equal(logoutDecision(0, 2), 'confirm-discard');

// A pending record blocks even when failed ones exist.
assert.equal(logoutDecision(1, 5), 'blocked');

// Junk counts never open the door by accident.
assert.equal(logoutDecision(0, -1), 'go');
assert.equal(logoutDecision(Number.NaN, 0), 'go');

console.log('logout-decision checks passed');
```

- [ ] **Step 7: Run to verify it fails**, then implement — `src/lib/logout-decision.ts`:

```ts
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
```

Run `bun src/lib/logout-decision.test.ts` → `logout-decision checks passed`.

- [ ] **Step 8: Test script** — append `&& bun src/lib/outbox-describe.test.ts && bun src/lib/logout-decision.test.ts` to the `test` script in `package.json` (keep the existing chain). `bun run test` → nine "checks passed" lines.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/outbox-describe.ts src/lib/outbox-describe.test.ts src/lib/logout-decision.ts src/lib/logout-decision.test.ts package.json
git commit -m "feat(sync): plain-words outbox rows and the logout decision"
```

---

### Task 2: Rows hook, Sync center screen, logout, entry points

**Files:**
- Modify: `mobile/src/lib/use-outbox.ts` (add `useOutboxRows`)
- Create: `mobile/src/app/sync.tsx`
- Modify: `mobile/src/lib/use-logout.ts` (replace)
- Modify: `mobile/src/app/settings.tsx`
- Modify: `mobile/src/components/ui/sync-banner.tsx`

**Interfaces:** Consumes Task 1 helpers; `listPending`, `listDeadLetters`, `retryDeadLetter`, `discardDeadLetter`, `OutboxRow` (lib/outbox); `triggerFlush`, `useOutboxSummary`; `formatRelative`; `EmptyState`, `Card`, `Button`, `AppText`, `Icon`.

- [ ] **Step 1: The rows hook** — in `src/lib/use-outbox.ts`: change the first import to `import { useEffect, useState } from 'react';`, extend the outbox import to `import { flush, listPending, listDeadLetters, getLastSyncedAt, type OutboxRow } from '@/lib/outbox';`, and append:

```ts
export type OutboxRows = { pending: OutboxRow[]; failed: OutboxRow[] };

/**
 * The queued records themselves (not just the counts), for the Sync center. Held in component
 * state on purpose, not in the query cache: that cache is persisted to storage and a queued
 * body is personal data. Reloads whenever the summary refetches (after a flush, retry or
 * discard). `null` until the first read finishes.
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
```

- [ ] **Step 2: The screen** — create `src/app/sync.tsx`:

```tsx
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRelative } from '@/lib/format';
import { discardDeadLetter, retryDeadLetter, type OutboxRow } from '@/lib/outbox';
import { describeOutboxRow, plainReason } from '@/lib/outbox-describe';
import { useSession } from '@/lib/session';
import { triggerFlush, useOutboxRows, useOutboxSummary } from '@/lib/use-outbox';

/** docs/navigation-redesign-design.md Phase 2 — what is waiting to send, what failed and why. */
export default function SyncCenterScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { signedIn } = useSession();
  const { data: summary } = useOutboxSummary();
  const rows = useOutboxRows();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const failed = rows?.failed ?? [];
  const pending = rows?.pending ?? [];
  const lastSynced = summary?.lastSyncedAt ? formatRelative(new Date(summary.lastSyncedAt)) : 'Not yet';

  const syncNow = async () => {
    setSyncing(true);
    try {
      await triggerFlush(queryClient);
    } finally {
      setSyncing(false);
    }
  };

  const retry = async (row: OutboxRow) => {
    setBusyKey(row.key);
    try {
      await retryDeadLetter(row.key);
      await triggerFlush(queryClient);
    } finally {
      setBusyKey(null);
    }
  };

  const discard = (row: OutboxRow) => {
    Alert.alert('Discard this record?', 'It was never saved on the server, and it will not be sent.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await discardDeadLetter(row.key);
            await queryClient.invalidateQueries();
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Sync center" leading="back" />

      {rows && failed.length === 0 && pending.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon="check-circle"
            tint="tintGreen"
            title="Everything is sent."
            body={`Nothing is waiting on this phone. Last synced: ${lastSynced}.`}
          />
        </View>
      ) : null}

      {failed.length > 0 ? (
        <Card eyebrow="Couldn't send" note={String(failed.length)} style={styles.card}>
          {failed.map((row, i) => {
            const { title, detail } = describeOutboxRow(row);
            return (
              <View key={row.key} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                <View style={styles.head}>
                  <Icon name="alert-circle" size={20} color="critical" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{title}</AppText>
                    {detail ? (
                      <AppText variant="body" color="inkSoft">
                        {detail}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="muted">
                      Recorded {formatRelative(new Date(row.created_at))}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color="critical">
                  {plainReason(row.last_error)}
                </AppText>
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <Button
                      variant="secondary"
                      label="Retry"
                      icon="rotate-cw"
                      onPress={() => void retry(row)}
                      loading={busyKey === row.key}
                      block
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button variant="ghost" label="Discard" onPress={() => discard(row)} disabled={busyKey === row.key} block />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card eyebrow="Waiting to send" note={String(pending.length)} style={styles.card}>
          {pending.map((row, i) => {
            const { title, detail } = describeOutboxRow(row);
            return (
              <View key={row.key} style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
                <View style={styles.head}>
                  <Icon name="clock" size={20} color="warning" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{title}</AppText>
                    {detail ? (
                      <AppText variant="body" color="inkSoft">
                        {detail}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="muted">
                      Recorded {formatRelative(new Date(row.created_at))} · sends when you&apos;re online
                    </AppText>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.syncNow}>
            <Button variant="secondary" label="Sync now" icon="refresh-cw" onPress={() => void syncNow()} loading={syncing} block />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  empty: { marginTop: Spacing.md },
  item: { gap: Spacing.sm, paddingVertical: Spacing.md },
  head: { flexDirection: 'row', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md },
  syncNow: { marginTop: Spacing.sm },
});
```

- [ ] **Step 3: Logout** — replace `src/lib/use-logout.ts` with:

```ts
import { Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { discardDeadLetter, listDeadLetters } from '@/lib/outbox';
import { logoutDecision } from '@/lib/logout-decision';
import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';

/**
 * Log out. Records still waiting to send block it (they would upload under whoever signs in next).
 * Failed records ask first: review them in the Sync center, or log out and discard them.
 */
export function useLogout() {
  const { logout } = useSession();
  const { data: outbox } = useOutboxSummary();
  const queryClient = useQueryClient();

  return () => {
    const pending = outbox?.pendingCount ?? 0;
    const failed = outbox?.deadLetterCount ?? 0;
    const decision = logoutDecision(pending, failed);

    if (decision === 'blocked') {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
      return;
    }

    if (decision === 'confirm-discard') {
      Alert.alert(
        `${failed} record${failed === 1 ? '' : 's'} couldn't send`,
        "They're only on this phone. Review them, or log out and discard them.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Review', onPress: () => router.push('/sync' as Href) },
          {
            text: 'Log out and discard',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                // Only the failed ones: pending records never reach this branch.
                for (const row of await listDeadLetters()) await discardDeadLetter(row.key);
                await queryClient.invalidateQueries();
                void logout();
              })();
            },
          },
        ],
      );
      return;
    }

    void logout();
  };
}
```

- [ ] **Step 4: Settings entry** — in `src/app/settings.tsx`, inside the `Sync` card, add directly after the `Last synced` row (before the hairline `View`):

```tsx
        <NavRow
          label={failed > 0 ? `Sync center · ${failed} need attention` : 'Sync center'}
          onPress={() => router.push('/sync' as Href)}
        />
```

(`failed`, `NavRow`, `router` and `Href` already exist in that file.)

- [ ] **Step 5: Banner** — in `src/components/ui/sync-banner.tsx`: replace the whole `if (dead) { ... return; }` block inside `handlePress` with:

```tsx
    if (dead) {
      router.push('/sync' as Href);
      return;
    }
```

add `import { router, type Href } from 'expo-router';`, and remove the imports and code that become unused (`Alert`, `listDeadLetters`, `retryDeadLetter`, and the doc comment about the native Alert fallback — replace it with a line saying a failed state opens the Sync center). Let `bunx expo lint` list any other leftover.

- [ ] **Step 6: Typecheck, lint, tests** — `bunx tsc --noEmit && bunx expo lint && bun run test`; clean, nine "checks passed" lines. Confirm no other code still imports `listDeadLetters`/`retryDeadLetter` for the old alert: `grep -rn "retryDeadLetter" src` should list only `lib/outbox.ts` and `app/sync.tsx`.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(sync): Sync center screen, logout that can discard failed records, entry points"
```

---

### Task 3: Verify, document, merge

- [ ] **Step 1: Green** — `bunx tsc --noEmit && bunx expo lint && bun run test`.

- [ ] **Step 2: Browser check (limited)** — the web build has no local queue (expo-sqlite needs SharedArrayBuffer), so the Sync center can only show its **empty state** there. Confirm: Settings → Sync card shows the new "Sync center" row; it opens `/sync` with the back arrow and "Everything is sent."; Settings Log out still goes straight through with nothing queued. Failed/pending rows, Retry, Discard and the logout dialogs need a device and are covered by the unit tests only for their wording and decision.

- [ ] **Step 3: Docs and merge** — set the Status line in `docs/navigation-redesign-design.md` to `Status: **Phases 1–2 built** (2026-10-07). Phases 3–4 pending.` (keep the existing known-oddity sentence), and append to `docs/offline-sync.md` a short section "Sync center (2026-10-07)": failed records are reviewed, retried or discarded on `/sync`; logout blocks on pending records and asks about failed ones, where "Log out and discard" deletes only failed rows.

```bash
git add docs
git commit -m "docs: mark sync center built"
git checkout main && git merge --no-ff feat/sync-center -m "Merge feat/sync-center: sync center and discard-aware logout" && git branch -d feat/sync-center
```

---

## Self-review

- **Spec coverage:** queued and failed records in plain words (T1 + T2 screen), Retry and Discard (T2), last synced (T2), replaces the raw alert (T2 Step 5), removes the logout blocker for failed records while keeping the pending block (T1 decision + T2 Step 3), entry from Settings and from the banner (T2 Steps 4–5).
- **Placeholders:** none; Step 5 of Task 2 names the exact block to replace and defers only leftover-import cleanup to lint.
- **Type consistency:** `describeOutboxRow`/`plainReason`/`logoutDecision` names match between Task 1 and Task 2; `useOutboxRows` returns `OutboxRows | null` and the screen guards `rows` for null; `OutboxRow` is imported as a type in both new modules.
- **Review Focus:** each line maps to a test (Task 1) or a Task 2 step.
