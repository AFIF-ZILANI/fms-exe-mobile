# Navigation Shell (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New bottom bar `Home · Houses · [+ Log] · Stock · Me`, a grouped Log launcher, a first Stock tab, Me = the Profile, and a separate app-only Settings screen; Home loses the manager grid and the "My performance" button.

**Architecture:** Two pure, tested helpers carry the logic (`lib/launcher.ts` decides what each role may launch; `lib/stock-summary.ts` turns items + balances into sorted stock lines). The tab bar, launcher sheet, Stock screen, Me tab and Settings are thin presentation over them. The Profile screen moves unchanged except that settings/log-out leave it.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / TanStack Query / Bun assertion scripts. No new dependencies.

**Spec:** `mobile/docs/navigation-redesign-design.md` (this plan is its Phase 1; Phases 2–4 are separate plans).

## Global Constraints

- Branch → change → verify → merge. Work on `feat/nav-shell` in `mobile/` (own git repo); never commit to `main`. Commit messages carry **no attribution lines**.
- No new dependencies. `bunx tsc --noEmit`, `bunx expo lint` and `bun run test` clean before any task is done.
- React Compiler: no ref reads/writes and no `new Date()`/`Date.now()` during render.
- The tab bar is identical for every role: `Home · Houses · [+] · Stock · Me`. **Team is never a tab** (route stays, hidden). A Worker must never be offered a Manage item (pinned by a test) and the `(manager)` route group guard stays as is.
- Log out and Change password live in Settings only (plus Log out on Me's "couldn't load" dead end). Settings holds app settings only; the Profile screen holds nothing about the app.
- Design tokens and shared components only; 48dp targets; every status has an icon or a word; light and dark both work.
- Existing routes keep working: `/me/performance`, `/team`, `/team/[employeeId]`, `/change-password`, all `(manager)` and `scan/` and `log/` screens.

## Review Focus

- A Worker never sees Manage items or manager-only paths in the launcher; a Manager sees all groups. Pinned in Task 1.
- Launcher items carry `?house_id=` only when opened from a house, and every path is absolute. Pinned in Task 1.
- Stock lines: total balance sums every location; an item is Low only when it has a reorder level and the total is below it; an item with no reorder level is never Low; unparsable balances are ignored; inactive items are hidden; Low sorts first. Pinned in Task 1.
- While on `/team` (hidden tab) the Home tab shows as active, and no tab shows as active on an unknown route. Task 2.
- Logging out from Settings still blocks with "Sync first" when records are unsent; Me's dead-end screen still lets a signed-in user with no saved profile log out. Task 3.
- After logout, neither Me nor Settings flashes an error screen. Task 3.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/launcher.ts` (new) + `.test.ts` | Pure: what the Log launcher offers per role and house. |
| `src/lib/stock-summary.ts` (new) + `.test.ts` | Pure: items + balances → sorted stock lines, balance formatting. |
| `src/lib/types.ts` | `Item.reorder_level`. |
| `src/lib/profile-format.ts` | Export `humanise`. |
| `src/components/ui/status-pill.tsx` | `LOW` status. |
| `src/components/ui/tab-bar.tsx` | New five-slot bar; Team highlights Home. |
| `src/app/(tabs)/_layout.tsx` | Tabs: index, houses, stock, me (+ hidden team). |
| `src/components/log-sheet.tsx` | Grouped launcher UI on `buildLauncher`. |
| `src/app/(tabs)/stock/_layout.tsx`, `index.tsx` (new) | Stock tab v1. |
| `src/lib/use-logout.ts` (new) | Log out with the "sync first" guard. |
| `src/app/(tabs)/me/index.tsx` (moved from `src/app/profile.tsx`) | Me = Profile. |
| `src/app/settings.tsx` (new) | App-only Settings. |
| `src/app/(tabs)/index.tsx` | Home cleanup. |
| `package.json` | `test` script runs the two new scripts. |

---

### Task 1: Pure helpers, types, status

**Files:**
- Create: `mobile/src/lib/launcher.ts`, `mobile/src/lib/launcher.test.ts`
- Create: `mobile/src/lib/stock-summary.ts`, `mobile/src/lib/stock-summary.test.ts`
- Modify: `mobile/src/lib/types.ts` (`Item`), `mobile/src/lib/profile-format.ts` (export `humanise`), `mobile/src/components/ui/status-pill.tsx`, `mobile/package.json`

**Interfaces (exact names used by Tasks 2–3):**
- `launcher.ts`: `type LauncherItem = { label: string; description: string; path: string; icon: IconName; tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue' }`, `type LauncherGroup = { title: string; items: LauncherItem[] }`, `buildLauncher(isManager: boolean, houseId: string | null): LauncherGroup[]`
- `stock-summary.ts`: `type StockRow = { item_id: string; location_type: string; location_id: string; balance: string; location_name: string }`, `type StockLine = { item: Item; balance: number; isLow: boolean; locations: { name: string; type: string; balance: number }[] }`, `summarizeStock(items: Item[], rows: StockRow[]): StockLine[]`, `formatBalance(n: number): string`

- [ ] **Step 1: Branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
git checkout main && git checkout -b feat/nav-shell
```

- [ ] **Step 2: Write the failing launcher test** — `src/lib/launcher.test.ts`:

```ts
/** What the Log launcher offers. Run: `bun src/lib/launcher.test.ts`. */

import assert from 'node:assert/strict';

import { buildLauncher } from './launcher';

const MANAGER_ONLY_PATHS = ['/assign', '/score', '/transfer', '/feeding-program', '/link', '/adjust', '/flag-stock', '/team'];

const worker = buildLauncher(false, null);
const manager = buildLauncher(true, null);

// --- groups per role -----------------------------------------------------------
assert.deepEqual(worker.map((g) => g.title), ['Record', 'Stock']);
assert.deepEqual(manager.map((g) => g.title), ['Record', 'Stock', 'Manage']);

// --- a Worker is never offered a manager-only item ------------------------------
const workerPaths = worker.flatMap((g) => g.items.map((i) => i.path.split('?')[0]));
for (const p of MANAGER_ONLY_PATHS) {
  assert.ok(!workerPaths.includes(p), `worker must not be offered ${p}`);
}
// ...and a Manager is offered every one of them.
const managerPaths = manager.flatMap((g) => g.items.map((i) => i.path.split('?')[0]));
for (const p of MANAGER_ONLY_PATHS) {
  assert.ok(managerPaths.includes(p), `manager should be offered ${p}`);
}

// --- contents ---------------------------------------------------------------
assert.deepEqual(
  worker[0].items.map((i) => i.label),
  ['Mortality', 'Feed', 'Weight', 'Environment', 'Treatment'],
);
assert.deepEqual(worker[1].items.map((i) => i.label), ['Move to house', 'Use an item']);
assert.deepEqual(
  manager[1].items.map((i) => i.label),
  ['Move to house', 'Use an item', 'Link items', 'Report discrepancy', 'Flag low stock'],
);
assert.deepEqual(
  manager[2].items.map((i) => i.label),
  ['Assign a task', 'Give points', 'Move birds', 'Feeding plan', 'Team'],
);

// --- house context ---------------------------------------------------------------
const inHouse = buildLauncher(true, 'h-9');
const byLabel = (groups: typeof inHouse, label: string) =>
  groups.flatMap((g) => g.items).find((i) => i.label === label)!;
assert.equal(byLabel(inHouse, 'Mortality').path, '/log/mortality?house_id=h-9');
assert.equal(byLabel(inHouse, 'Move to house').path, '/scan/allocate?house_id=h-9');
assert.equal(byLabel(inHouse, 'Use an item').path, '/scan/consume?house_id=h-9');
assert.equal(byLabel(inHouse, 'Report discrepancy').path, '/adjust?house_id=h-9');
assert.equal(byLabel(inHouse, 'Team').path, '/team', 'screens that are not house-scoped never get a house_id');
assert.equal(byLabel(manager, 'Mortality').path, '/log/mortality', 'no house, no query string');

// --- hygiene -----------------------------------------------------------------------
for (const groups of [worker, manager, inHouse]) {
  const labels = groups.flatMap((g) => g.items.map((i) => i.label));
  assert.equal(new Set(labels).size, labels.length, 'labels are unique within a launcher');
  for (const item of groups.flatMap((g) => g.items)) {
    assert.ok(item.path.startsWith('/'), `${item.label} path is absolute`);
    assert.ok(item.description.length > 0, `${item.label} has a description`);
  }
}

console.log('launcher checks passed');
```

- [ ] **Step 3: Run it to verify it fails** — `bun src/lib/launcher.test.ts` → FAIL, module not found.

- [ ] **Step 4: Implement the launcher** — `src/lib/launcher.ts`:

```ts
import type { IconName } from '../components/ui/icon';

export type LauncherItem = {
  label: string;
  description: string;
  path: string;
  icon: IconName;
  tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue';
};

export type LauncherGroup = { title: string; items: LauncherItem[] };

/**
 * What the [+] launcher offers. Pure, so "a Worker is never offered a manager tool" is
 * a tested fact and not an accident of the sheet's JSX. docs/navigation-redesign-design.md.
 * `houseId` is set when the sheet was opened from a house; only house-scoped screens get it.
 */
export function buildLauncher(isManager: boolean, houseId: string | null): LauncherGroup[] {
  const withHouse = (path: string) => (houseId ? `${path}?house_id=${houseId}` : path);

  const record: LauncherItem[] = [
    { label: 'Mortality', description: 'Birds that died today', path: withHouse('/log/mortality'), icon: 'alert-circle', tint: 'tintRed' },
    { label: 'Feed', description: 'Feed or supplies drawn', path: withHouse('/log/consumption'), icon: 'package', tint: 'tintAmber' },
    { label: 'Weight', description: 'Average sample weight', path: withHouse('/log/weight'), icon: 'bar-chart-2', tint: 'tintBlue' },
    { label: 'Environment', description: 'Temperature, humidity, gas', path: withHouse('/log/environment'), icon: 'thermometer', tint: 'tintBlue' },
    { label: 'Treatment', description: 'Medication or vaccination', path: withHouse('/log/treatment'), icon: 'plus-square', tint: 'tintGreen' },
  ];

  const stock: LauncherItem[] = [
    { label: 'Move to house', description: 'Scan units into a house', path: withHouse('/scan/allocate'), icon: 'arrow-right', tint: 'tintGreen' },
    { label: 'Use an item', description: 'Scan a bottle or tool you used', path: withHouse('/scan/consume'), icon: 'box', tint: 'tintAmber' },
  ];

  const groups: LauncherGroup[] = [
    { title: 'Record', items: record },
    { title: 'Stock', items: stock },
  ];

  if (!isManager) return groups;

  stock.push(
    { label: 'Link items', description: 'Scan QR codes onto a delivery', path: '/link', icon: 'maximize', tint: 'tintGreen' },
    { label: 'Report discrepancy', description: "Stock doesn't match", path: withHouse('/adjust'), icon: 'clipboard', tint: 'tintAmber' },
    { label: 'Flag low stock', description: 'Raise a reorder signal', path: '/flag-stock', icon: 'flag', tint: 'tintAmber' },
  );

  groups.push({
    title: 'Manage',
    items: [
      { label: 'Assign a task', description: 'Put work on a dashboard', path: '/assign', icon: 'check-square', tint: 'tintGreen' },
      { label: 'Give points', description: 'Rate someone, plus or minus', path: '/score', icon: 'award', tint: 'tintAmber' },
      { label: 'Move birds', description: 'Between houses', path: '/transfer', icon: 'shuffle', tint: 'tintBlue' },
      { label: 'Feeding plan', description: 'Phases for a batch', path: '/feeding-program', icon: 'calendar', tint: 'tintGreen' },
      { label: 'Team', description: 'People, tasks and points', path: '/team', icon: 'users', tint: 'tintGreen' },
    ],
  });

  return groups;
}
```

- [ ] **Step 5: Run it to verify it passes** — `bun src/lib/launcher.test.ts` → `launcher checks passed`.

- [ ] **Step 6: Types, `humanise` export, LOW status**

In `src/lib/types.ts` add to `Item`:

```ts
  /** Decimal as a string; null/absent = no reorder level set. */
  reorder_level?: string | null;
```

In `src/lib/profile-format.ts` change `function humanise(` to `export function humanise(`.

In `src/components/ui/status-pill.tsx` add to `STATUS_MAP`: `LOW: { tone: 'warning', label: 'Low' },`

- [ ] **Step 7: Write the failing stock test** — `src/lib/stock-summary.test.ts`:

```ts
/** Stock lines. Run: `bun src/lib/stock-summary.test.ts`. */

import assert from 'node:assert/strict';

import { formatBalance, summarizeStock, type StockRow } from './stock-summary';
import type { Item } from './types';

const item = (over: Partial<Item> & { id: string; name: string }): Item => ({
  category: 'FEED',
  unit: 'KG',
  is_unit_tracked: false,
  is_active: true,
  reorder_level: null,
  ...over,
});
const row = (item_id: string, balance: string, name = 'Warehouse A', type = 'WAREHOUSE'): StockRow => ({
  item_id,
  location_type: type,
  location_id: `${type}-${name}`,
  balance,
  location_name: name,
});

const feed = item({ id: 'feed', name: 'Starter feed', reorder_level: '100' });
const vaccine = item({ id: 'vac', name: 'Newcastle vaccine', category: 'VACCINE', unit: 'ML', reorder_level: '50' });
const husk = item({ id: 'husk', name: 'Rice husk' }); // no reorder level
const old = item({ id: 'old', name: 'Retired item', is_active: false });

// --- total across every location -----------------------------------------------------
{
  const lines = summarizeStock([feed], [row('feed', '60'), row('feed', '30.5', 'House 2', 'HOUSE')]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].balance, 90.5, 'warehouse + house balances add up');
  assert.equal(lines[0].locations.length, 2);
}

// --- Low only when a reorder level exists and the total is below it ---------------------
assert.equal(summarizeStock([feed], [row('feed', '99.999')])[0].isLow, true);
assert.equal(summarizeStock([feed], [row('feed', '100')])[0].isLow, false, 'exactly at the level is not low');
assert.equal(summarizeStock([feed], [])[0].isLow, true, 'no stock rows at all is zero, which is below 100');
assert.equal(summarizeStock([husk], [row('husk', '0')])[0].isLow, false, 'no reorder level => never low');
assert.equal(summarizeStock([item({ id: 'z', name: 'Z', reorder_level: 'abc' })], [row('z', '1')])[0].isLow, false, 'a junk reorder level never flags');

// --- junk balances are ignored, zero rows are not listed as locations ---------------------
{
  const [line] = summarizeStock([feed], [row('feed', 'oops'), row('feed', '10'), row('feed', '0', 'House 3', 'HOUSE')]);
  assert.equal(line.balance, 10);
  assert.deepEqual(line.locations.map((l) => l.name), ['Warehouse A']);
}

// --- inactive items are hidden ---------------------------------------------------------------
assert.deepEqual(summarizeStock([old, husk], []).map((l) => l.item.id), ['husk']);

// --- order: Low first, then by name -------------------------------------------------------------
{
  const lines = summarizeStock([husk, vaccine, feed], [row('husk', '5'), row('vac', '10'), row('feed', '500')]);
  assert.deepEqual(lines.map((l) => l.item.name), ['Newcastle vaccine', 'Rice husk', 'Starter feed']);
  assert.deepEqual(lines.map((l) => l.isLow), [true, false, false]);
}
{
  const lines = summarizeStock([feed, vaccine], [row('feed', '1'), row('vac', '1')]);
  assert.deepEqual(lines.map((l) => l.item.name), ['Newcastle vaccine', 'Starter feed'], 'both low: alphabetical');
}

// --- display ------------------------------------------------------------------------------------
assert.equal(formatBalance(90.5), '90.5');
assert.equal(formatBalance(1200), '1,200');
assert.equal(formatBalance(0), '0');
assert.equal(formatBalance(0.12345), '0.123');
assert.equal(formatBalance(2.0), '2');

console.log('stock-summary checks passed');
```

- [ ] **Step 8: Run to verify it fails** — `bun src/lib/stock-summary.test.ts` → FAIL, module not found.

- [ ] **Step 9: Implement** — `src/lib/stock-summary.ts`:

```ts
import type { Item } from './types';

/** One row of GET /items/stock-by-location (balance is a Decimal string). */
export type StockRow = {
  item_id: string;
  location_type: string;
  location_id: string;
  balance: string;
  location_name: string;
};

export type StockLine = {
  item: Item;
  balance: number;
  isLow: boolean;
  locations: { name: string; type: string; balance: number }[];
};

/**
 * Items + per-location balances -> one line per active item: the total across every location,
 * Low when the item has a reorder level and the total is below it, Low first then A-Z.
 * Junk balances are ignored and an item with no (or unparsable) reorder level is never Low.
 */
export function summarizeStock(items: Item[], rows: StockRow[]): StockLine[] {
  const byItem = new Map<string, StockRow[]>();
  for (const r of rows) {
    const list = byItem.get(r.item_id) ?? [];
    list.push(r);
    byItem.set(r.item_id, list);
  }

  const lines = items
    .filter((item) => item.is_active)
    .map((item): StockLine => {
      const all = (byItem.get(item.id) ?? [])
        .map((r) => ({ name: r.location_name, type: r.location_type, balance: Number(r.balance) }))
        .filter((l) => Number.isFinite(l.balance));
      const balance = all.reduce((sum, l) => sum + l.balance, 0);
      const reorder = item.reorder_level == null ? null : Number(item.reorder_level);
      const isLow = reorder !== null && Number.isFinite(reorder) && balance < reorder;
      return { item, balance, isLow, locations: all.filter((l) => l.balance !== 0) };
    });

  return lines.sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.item.name.localeCompare(b.item.name));
}

/** "1,200", "90.5", "0" — up to three decimals, no trailing zeros. */
export function formatBalance(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}
```

- [ ] **Step 10: Run to verify it passes** — `bun src/lib/stock-summary.test.ts` → `stock-summary checks passed`.

- [ ] **Step 11: Test script** — append `&& bun src/lib/launcher.test.ts && bun src/lib/stock-summary.test.ts` to the `test` script in `package.json` (keep the existing chain). Run `bun run test` — seven "checks passed" lines.

- [ ] **Step 12: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/launcher.ts src/lib/launcher.test.ts src/lib/stock-summary.ts src/lib/stock-summary.test.ts src/lib/types.ts src/lib/profile-format.ts src/components/ui/status-pill.tsx package.json
git commit -m "feat(nav): pure launcher and stock-summary helpers, Low status"
```

---

### Task 2: Tab bar, grouped launcher, Stock tab

**Files:**
- Modify: `mobile/src/components/ui/tab-bar.tsx` (replace whole file)
- Modify: `mobile/src/app/(tabs)/_layout.tsx` (replace whole file)
- Modify: `mobile/src/components/log-sheet.tsx` (replace whole file)
- Create: `mobile/src/app/(tabs)/stock/_layout.tsx`, `mobile/src/app/(tabs)/stock/index.tsx`

**Interfaces:** Consumes `buildLauncher` and `summarizeStock`/`formatBalance`/`StockRow` (Task 1), `humanise` (profile-format), `StatusPill` `LOW`.

- [ ] **Step 1: Tab bar** — replace `src/components/ui/tab-bar.tsx` with:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four slots, in fixed order, identical for every role — docs/navigation-redesign-design.md.
 * The raised centre button opens the Log launcher rather than navigating. What differs by role
 * is only what the launcher and Home offer, never the bar.
 */
const SLOTS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'houses', label: 'Houses', icon: 'grid' },
  { route: 'stock', label: 'Stock', icon: 'archive' },
  { route: 'me', label: 'Me', icon: 'user' },
];

/** Routes that live under a tab but are not a tab themselves, and which tab should look active
 *  while you are on them. Team is reached from Home's card and the launcher. */
const ACTIVE_ALIAS: Record<string, string> = { team: 'index' };

type TabBarProps = BottomTabBarProps & {
  /** Opens the log launcher. The centre button is not a route. */
  onLogPress: () => void;
};

export function TabBar({ state, navigation, onLogPress }: TabBarProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();

  const current = state.routes[state.index]?.name;
  const activeRoute = (current && ACTIVE_ALIAS[current]) ?? current;

  const left = SLOTS.slice(0, 2);
  const right = SLOTS.slice(2);

  const renderSlot = (slot: (typeof SLOTS)[number]) => {
    const index = state.routes.findIndex((r) => r.name === slot.route);
    if (index === -1) return <View key={slot.route} style={styles.slot} />;

    const focused = activeRoute === slot.route;
    const route = state.routes[index];

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      // Pressing the focused tab pops its stack to the root; from a hidden tab (Team) it goes home.
      navigation.navigate(route.name as never);
    };

    return (
      <Pressable
        key={slot.route}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={slot.label}
        style={({ pressed }) => [styles.slot, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <View style={[styles.pill, focused && { backgroundColor: theme.primarySoft }]}>
          <Icon name={slot.icon} size={24} color={focused ? 'primary' : 'muted'} />
        </View>
        <AppText variant="label" color={focused ? 'primary' : 'muted'}>
          {slot.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          height: Size.tabBar + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {left.map(renderSlot)}

      <View style={styles.centreSlot}>
        <Pressable
          onPress={onLogPress}
          accessibilityRole="button"
          accessibilityLabel="Log or do something"
          style={({ pressed }) => [
            styles.centre,
            { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
            elevation(scheme, 'raised'),
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Icon name="plus" size={24} color="onPrimary" />
        </Pressable>
      </View>

      {right.map(renderSlot)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  slot: { flex: 1, alignItems: 'center', gap: 2 },
  pill: {
    width: 56,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreSlot: { width: Size.tabCentre + Spacing.lg, alignItems: 'center' },
  centre: {
    width: Size.tabCentre,
    height: Size.tabCentre,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Sits proud of the bar's top edge. docs/design.md §6.1.
    marginTop: -14,
  },
});
```

- [ ] **Step 2: Tabs layout** — replace `src/app/(tabs)/_layout.tsx` with:

```tsx
import { useState } from 'react';
import { Tabs } from 'expo-router';

import { LogSheet } from '@/components/log-sheet';
import { TabBar } from '@/components/ui/tab-bar';

/**
 * The bottom tab bar — docs/navigation-redesign-design.md. Four tabs plus the raised centre
 * button, identical for every role. Team is a route inside the tabs but never a tab: it is
 * reached from Home's Team card and the launcher's Manage group (and guards itself).
 */
export default function TabsLayout() {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} onLogPress={() => setLogOpen(true)} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="houses" />
        <Tabs.Screen name="stock" />
        <Tabs.Screen name="me" />
        <Tabs.Screen name="team" options={{ href: null }} />
      </Tabs>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Grouped launcher sheet** — replace `src/components/log-sheet.tsx` with:

```tsx
import { useMemo } from 'react';
import { Modal, Pressable, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { buildLauncher } from '@/lib/launcher';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

type LogSheetProps = { open: boolean; onClose: () => void };

/**
 * Opened by the tab bar's centre button: Record, Stock and (managers only) Manage. What each
 * role may launch is decided by `buildLauncher`, a tested pure function. Reads the current
 * house from the pathname so every house-scoped action carries `?house_id=` when opened from a
 * house screen. docs/navigation-redesign-design.md.
 */
export function LogSheet({ open, onClose }: LogSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pathname = usePathname();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const groups = useMemo(() => buildLauncher(isManager, houseId), [isManager, houseId]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.surface }, elevation(scheme, 'sheet')]}
        edges={['bottom']}
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />

        <View style={styles.titleBlock}>
          <AppText variant="h2">Quick actions</AppText>
          {houseId ? (
            <AppText variant="caption" color="muted">
              For the house you&apos;re in
            </AppText>
          ) : null}
        </View>

        <ScrollView bounces={false}>
          {groups.map((group) => (
            <View key={group.title}>
              <AppText variant="eyebrow" color="muted" style={styles.groupTitle}>
                {group.title}
              </AppText>
              {group.items.map((item, i) => (
                <View key={item.label}>
                  {i > 0 ? <View style={[styles.rowRule, { backgroundColor: theme.line }]} /> : null}
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(item.path as Href);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
                  >
                    <IconTile name={item.icon} tint={item.tint} />
                    <View style={styles.rowText}>
                      <AppText variant="bodyStrong">{item.label}</AppText>
                      <AppText variant="caption" color="muted">
                        {item.description}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" size={20} color="muted" />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    maxHeight: '85%',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  titleBlock: { padding: Spacing.xl, paddingBottom: Spacing.sm, gap: 2 },
  groupTitle: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1 },
  // Inset so it starts at the title, not under the tile.
  rowRule: { height: 1, marginLeft: 72 },
});
```

- [ ] **Step 4: Stock stack** — create `src/app/(tabs)/stock/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

/** The Stock tab's own stack, so item detail (Phase 4) pushes inside the tab. */
export default function StockLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Stock screen** — create `src/app/(tabs)/stock/index.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { can } from '@/lib/permissions';
import { humanise } from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import { formatBalance, summarizeStock, type StockRow } from '@/lib/stock-summary';
import type { Item } from '@/lib/types';

type Filter = 'ALL' | 'LOW';

const WORKER_SHORTCUTS: { label: string; path: string; icon: IconName }[] = [
  { label: 'Move to house', path: '/scan/allocate', icon: 'arrow-right' },
  { label: 'Use an item', path: '/scan/consume', icon: 'box' },
];

/** docs/navigation-redesign-design.md — what stock there is, what is running low, and the scan actions. */
export default function StockScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const [filter, setFilter] = useState<Filter>('ALL');

  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);

  const lines = useMemo(
    () => summarizeStock(items.data?.results ?? [], rows.data ?? []),
    [items.data, rows.data],
  );
  const lowCount = lines.filter((l) => l.isLow).length;
  const shown = filter === 'LOW' ? lines.filter((l) => l.isLow) : lines;

  const shortcuts = isManager
    ? [...WORKER_SHORTCUTS, { label: 'Link items', path: '/link', icon: 'maximize' as IconName }]
    : WORKER_SHORTCUTS;

  const isLoading = items.isLoading || rows.isLoading;
  const isError = (items.isError && !items.data) || (rows.isError && !rows.data);

  return (
    <Screen>
      <Header title="Stock" />
      <SyncBanner />

      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.path}
            onPress={() => router.push(s.path as Href)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            style={({ pressed }) => [
              styles.shortcut,
              { backgroundColor: theme.surfaceAlt },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Icon name={s.icon} size={20} color="primary" />
            <AppText variant="label" style={styles.flex}>
              {s.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['ALL', 'LOW'] as const).map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                  borderColor: active ? theme.primary : theme.line,
                },
              ]}
            >
              <AppText variant="label" color={active ? 'primary' : 'inkSoft'}>
                {f === 'ALL' ? 'All' : `Low${lowCount ? ` · ${lowCount}` : ''}`}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card rows style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load stock."
            action={{
              label: 'Retry',
              onPress: () => {
                void items.refetch();
                void rows.refetch();
              },
            }}
          />
        ) : lines.length === 0 ? (
          <EmptyState compact icon="archive" tint="surfaceAlt" title="No items yet." body="Items are set up in the admin dashboard." />
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="Nothing below reorder level right now."
            action={{ label: 'Show all', onPress: () => setFilter('ALL') }}
          />
        ) : (
          shown.map((line, i) => (
            <LedgerRow
              key={line.item.id}
              gutterNode={
                <IconTile
                  name="package"
                  tint={line.isLow ? 'tintAmber' : 'surfaceAlt'}
                  color={line.isLow ? 'warning' : 'muted'}
                  size={32}
                />
              }
              last={i === shown.length - 1}
            >
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                  {line.item.name}
                </AppText>
                <AppText variant="figure" color={line.isLow ? 'warning' : 'ink'}>
                  {formatBalance(line.balance)}
                </AppText>
              </View>
              <View style={styles.rowTop}>
                <AppText variant="caption" color="muted" style={styles.flex}>
                  {humanise(line.item.category)} · {line.item.unit.toLowerCase()}
                </AppText>
                {line.isLow ? <StatusPill status="LOW" label="Low" /> : null}
              </View>
            </LedgerRow>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs },
  shortcut: {
    width: '47.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
  },
  filters: { gap: Spacing.sm, marginTop: Spacing.md },
  chip: {
    minHeight: Size.chip,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
```

- [ ] **Step 6: Typecheck, lint, tests** — `bunx tsc --noEmit && bunx expo lint && bun run test`; all clean. If `Icon` name `'archive'` is rejected it is a valid Feather glyph; if `StatusPill` rejects the `label` prop, it accepts `label?: string`.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/tab-bar.tsx "src/app/(tabs)/_layout.tsx" src/components/log-sheet.tsx "src/app/(tabs)/stock"
git commit -m "feat(nav): five-slot tab bar, grouped launcher and a first Stock tab"
```

---

### Task 3: Me = Profile, Settings, Home cleanup

**Files:**
- Create: `mobile/src/lib/use-logout.ts`
- Create: `mobile/src/app/settings.tsx`
- Move + modify: `mobile/src/app/profile.tsx` → `mobile/src/app/(tabs)/me/index.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

**Interfaces:** Consumes `useAppearance` (lib/appearance), `triggerFlush`/`useOutboxSummary` (lib/use-outbox), `useSession`, `NavRow`/`InfoRow` (components/profile-parts), `formatRelative` (lib/format).

- [ ] **Step 1: Shared logout** — create `src/lib/use-logout.ts`:

```ts
import { Alert } from 'react-native';

import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';

/**
 * Log out — unless records on this phone have not uploaded yet. A queued write belongs to
 * whoever is signed in when it uploads, so nothing may be left behind.
 */
export function useLogout() {
  const { logout } = useSession();
  const { data: outbox } = useOutboxSummary();

  return () => {
    const pending = (outbox?.pendingCount ?? 0) + (outbox?.deadLetterCount ?? 0);
    if (pending > 0) {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
      return;
    }
    void logout();
  };
}
```

- [ ] **Step 2: Settings screen** — create `src/app/settings.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { InfoRow, NavRow } from '@/components/profile-parts';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance, type AppearancePref } from '@/lib/appearance';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useLogout } from '@/lib/use-logout';
import { triggerFlush, useOutboxSummary } from '@/lib/use-outbox';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: AppearancePref; label: string }[];

/** docs/navigation-redesign-design.md — app settings only; nothing here is about the person. */
export default function SettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { signedIn } = useSession();
  const { data: outbox } = useOutboxSummary();
  const [appearance, setAppearance] = useAppearance();
  const [syncing, setSyncing] = useState(false);
  const onLogout = useLogout();

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const pending = outbox?.pendingCount ?? 0;
  const failed = outbox?.deadLetterCount ?? 0;
  const status = failed > 0 ? `${failed} couldn't send` : pending > 0 ? `${pending} waiting to send` : 'All sent';
  const lastSynced = outbox?.lastSyncedAt ? formatRelative(new Date(outbox.lastSyncedAt)) : 'Not yet';

  const syncNow = async () => {
    setSyncing(true);
    try {
      await triggerFlush(queryClient);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <Header title="Settings" leading="back" />

      <Card rows eyebrow="Appearance" style={styles.card}>
        <View style={styles.appearance}>
          <SegmentedToggle
            height={48}
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={setAppearance}
          />
          <AppText variant="caption" color="muted">
            Match phone follows your phone&apos;s light or dark setting.
          </AppText>
        </View>
      </Card>

      <Card rows eyebrow="Sync" style={styles.card}>
        <InfoRow label="Status" value={status} />
        <InfoRow label="Last synced" value={lastSynced} />
        <View style={[styles.rule, { backgroundColor: theme.line }]} />
        <View style={styles.syncAction}>
          <Button variant="secondary" label="Sync now" icon="refresh-cw" onPress={() => void syncNow()} loading={syncing} block />
        </View>
      </Card>

      <Card rows eyebrow="Account" style={styles.card}>
        <NavRow label="Change password" onPress={() => router.push('/change-password' as Href)} last />
      </Card>

      <Card rows eyebrow="About" style={styles.card}>
        <InfoRow label="App version" value={Constants.expoConfig?.version} last />
      </Card>

      <View style={styles.logout}>
        <Button variant="destructive" label="Log out" onPress={onLogout} block />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  appearance: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  rule: { height: 1, marginLeft: Spacing.lg },
  syncAction: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  logout: { marginTop: Spacing.xl },
});
```

- [ ] **Step 3: Move the Profile to the Me tab**

```bash
git mv src/app/profile.tsx "src/app/(tabs)/me/index.tsx"
```

Then edit `src/app/(tabs)/me/index.tsx` — these are the ONLY changes:

(a) Imports: remove `Alert` from the react-native import (leave `StyleSheet, View`); remove `type Href` from the expo-router import (leave `router`); delete the lines importing `Constants`, `SegmentedToggle`, `useAppearance`/`AppearancePref`, `useOutboxSummary`; add `import { useLogout } from '@/lib/use-logout';`. Keep `Card, StatCard`, `Button`, `EmptyState`, `Icon, IconTile`, `AppText`, `InfoCard, InfoRow, NavRow, ProfileHeader, openLink`, `Radius, Spacing`, and the rest.

(b) Delete the `APPEARANCE_OPTIONS` constant.

(c) In the component: delete `const { data: outbox } = useOutboxSummary();`, `const [appearance, setAppearance] = useAppearance();` and the whole `const onLogout = () => { ... };` block; add `const onLogout = useLogout();` in their place; change the destructure to `const { employee: saved, signedIn, refresh } = useSession();` (drop `logout`).

(d) Both headers (the dead-end branch and the main one) become — no back arrow, a settings gear:

```tsx
<Header
  title="Me"
  action={{ icon: 'settings', label: 'Settings', onPress: () => router.push('/settings') }}
/>
```

(e) Replace the whole `<Card rows eyebrow="Settings" ...>…</Card>` block and the trailing `<View style={styles.logout}>…</View>` of the MAIN branch with one small card (no Log out here; it lives in Settings):

```tsx
      <Card rows style={styles.card}>
        <NavRow label="My performance" onPress={() => router.push('/me/performance')} last />
      </Card>
```

The dead-end branch keeps its `<View style={styles.logout}><Button … Log out … /></View>`.

(f) Delete the now-unused style entries `appearance` and `rule` from `StyleSheet.create`. The doc comment above the component becomes: `/** docs/profile-redesign-design.md — the Me tab: who you are at the farm. App settings live in Settings (gear). */`

- [ ] **Step 4: Home cleanup** — in `src/app/(tabs)/index.tsx`:

(a) Remove the whole `MANAGER_ACTIONS` constant and the `Icon`, `type IconName` parts of the icon import (keep `IconTile`: `import { IconTile } from '@/components/ui/icon';`), remove the now-unused `Pressable` (keep `View, StyleSheet`), remove the `Button` import.

(b) The `<Header ... />` loses its `action` prop: `<Header eyebrow={greeting()} title={employee.profile.name} />`.

(c) Delete the entire `{isManager && ( <Card eyebrow="Manager" ...>…</Card> )}` block and the trailing `<View style={styles.footerNote}> … </View>` containing the "My performance" button.

(d) Delete the now-unused styles `grid`, `gridItem`, `footerNote`.

Leave `isManager` (the Team card still uses it), the Today/Team/Houses cards and the Birds/Points tiles untouched. Let `bunx expo lint` tell you about any other leftover unused import and remove it.

- [ ] **Step 5: Typecheck, lint, tests** — `bunx tsc --noEmit && bunx expo lint && bun run test`; all clean. Grep that nothing still routes to the deleted screen: `grep -rn "'/profile'" src` must print nothing.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(nav): Me is the profile, separate app-only Settings, Home cleanup"
```

---

### Task 4: Verify, document, merge

- [ ] **Step 1: Green** — `bunx tsc --noEmit && bunx expo lint && bun run test`; seven "checks passed" lines.

- [ ] **Step 2: Browser check** as the test worker and manager, light and dark: the bar reads Home · Houses · + · Stock · Me for both; the launcher shows Record + Stock (worker) and Record + Stock + Manage (manager); Stock lists items with balances and a working Low filter; Me shows the profile with a gear; the gear opens Settings (Appearance, Sync, Account, About, Log out); Home has no gear, no manager grid and no "My performance" button; from Home, Team still opens for the manager and the Home tab stays highlighted.

- [ ] **Step 3: Docs and merge** — set the Status line in `docs/navigation-redesign-design.md` to `Status: **Phase 1 built** (2026-10-07). Phases 2–4 pending.`; add to the top of `docs/layout/00-app-shell.md`: `> **Superseded in part 2026-10-07:** the tab set and launcher are now described in docs/navigation-redesign-design.md.`

```bash
git add docs
git commit -m "docs: mark navigation phase 1 built"
git checkout main && git merge --no-ff feat/nav-shell -m "Merge feat/nav-shell: new tab bar, Stock tab, grouped launcher, Me and Settings" && git branch -d feat/nav-shell
```

---

## Self-review

- **Spec coverage:** bar `Home · Houses · [+] · Stock · Me` identical for all (T2 Steps 1–2), Team hidden but reachable and Home-highlighted (T2 Steps 1–2, Home card unchanged, launcher Manage→Team), grouped launcher with Manage managers-only (T1 + T2 Step 3), Stock v1 with scan shortcuts, All/Low, low-first, reorder-level flag (T1 + T2 Step 5), Me = Profile with gear (T3 Step 3), Settings app-only incl. Appearance/Change password/Sync status/version/Log out (T3 Step 2), Home cleanup (T3 Step 4), Log out only in Settings + Me dead end (T3). Phases 2–4 are explicitly out of this plan.
- **Placeholders:** none; the two "edit an existing file" steps (T3 Steps 3–4) list every change precisely and let lint catch residual unused imports.
- **Type consistency:** `buildLauncher`/`LauncherItem` (T1) match T2 Step 3; `summarizeStock`/`StockRow`/`formatBalance` match T2 Step 5; `humanise` exported in T1 Step 6 and imported in T2 Step 5; `useLogout` (T3 Step 1) used in T3 Steps 2 and 3; `StatusPill` `LOW` added in T1 Step 6, used in T2 Step 5.
- **Review Focus:** launcher/stock lines pinned by tests (T1); tab alias, logout guard, no-flash by T2/T3 steps and the T4 browser check.
