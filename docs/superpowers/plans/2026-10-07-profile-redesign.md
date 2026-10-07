# Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare Profile screen with a professional employee profile (identity, at-a-glance, contact, employment, personal, emergency contact, settings with a light/dark choice, log out), read-only and honest about it.

**Architecture:** Pure formatting helpers (`lib/profile-format.ts`) and a pure appearance-preference parser (`lib/appearance-pref.ts`) carry the testable logic. A small RN layer (`lib/appearance.ts`) applies and stores the choice. Presentational pieces live in `components/profile-parts.tsx`; `app/profile.tsx` composes them from live data (`GET /employees/:id`, with the login-time copy as the instant fallback).

**Tech Stack:** Expo SDK 57 / React Native 0.86 / expo-router / expo-image + expo-constants (already installed) / TanStack Query / Bun assertion scripts (`bun src/lib/<name>.test.ts`). No new dependencies.

**Spec:** `mobile/docs/profile-redesign-design.md` (what is shown, what is deliberately not, layout, states).

## Global Constraints

- Branch → change → verify → merge. Work on `feat/profile-redesign` in `mobile/` (own git repo); never commit to `main`. Commit messages carry **no attribution lines**.
- No new dependencies. Run `bunx tsc --noEmit`, `bunx expo lint` and `bun run test` before any task is declared done; all clean.
- The project uses the React Compiler: **no ref or `Date.now()`/`new Date()` read during render** (use `useState(() => new Date())` once).
- Read-only: no profile field is editable and no write endpoint is called from this screen.
- **Never show:** salary / reference salary, religion, referee details, payout accounts, the rating number. **Mask** the National ID to its last 4 digits. Never open `tel:`/`mailto:` for a missing value.
- Missing values read "Not provided" (muted), never blank.
- Design tokens and shared components only (`AppText`, `Card`, `StatCard`, `Button`, `SegmentedToggle`, `Icon`/`IconTile`); 48dp targets; every status carries an icon or a word; light and dark both work.
- Dates are formatted from the stored UTC calendar date (UTC getters), as `D Mon YYYY` (e.g. `12 Mar 2025`), so a date never shifts a day with the phone's timezone.

## Review Focus

- A missing, empty or whitespace field shows "Not provided" and has no tap action (no `tel:`/`mailto:` for nothing). Pinned in Task 1 (`displayValue`) and Task 3.
- The full National ID never reaches the screen: only the last 4 digits. Pinned in Task 1 (`maskNid`) including 3-digit and empty IDs.
- Age and tenure are right on boundaries (birthday today, day before birthday, joined today, under a month, exactly a year). Pinned in Task 1.
- A junk or missing saved appearance value falls back to "Match phone" and never throws. Pinned in Task 2 (`parseAppearance`).
- With no emergency contact on file the screen warns clearly (icon and words), not a blank card. Pinned in Task 3 (`hasEmergencyContact`, covered by Task 1 test).
- Offline / fetch failure keeps showing the saved copy plus one quiet line, not an empty or error screen. Task 3.
- Log out keeps the "sync first" guard when records are unsent. Task 3.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/types.ts` | Extend `Profile` and `Employee` with the hire-profile fields the screen reads. |
| `src/lib/profile-format.ts` (new) | Pure: dates, tenure, age, NID mask, labels, experience, "Not provided". |
| `src/lib/profile-format.test.ts` (new) | Tests for the above. |
| `src/lib/appearance-pref.ts` (new) | Pure: `AppearancePref`, `parseAppearance`, `schemeFor`. |
| `src/lib/appearance-pref.test.ts` (new) | Tests for the above. |
| `src/lib/appearance.ts` (new) | RN layer: load/save/apply, `useAppearance` hook. |
| `src/app/_layout.tsx` | Apply the saved appearance at startup, behind the splash. |
| `src/components/profile-parts.tsx` (new) | `ProfileHeader`, `InfoRow`, `NavRow`, `openLink`. |
| `src/app/profile.tsx` | Compose the redesigned screen. |
| `package.json` | `test` script runs the two new scripts. |

---

### Task 1: Types and pure formatting helpers

**Files:**
- Modify: `mobile/src/lib/types.ts` (`Profile`, `Employee`)
- Create: `mobile/src/lib/profile-format.ts`
- Create: `mobile/src/lib/profile-format.test.ts`
- Modify: `mobile/package.json` (`test` script)

**Interfaces:**
- Consumes: nothing.
- Produces (exact names used by Task 3):
  - `formatDate(iso: string): string`
  - `formatTenure(joinedIso: string, now: Date): string` ("1 yr 7 mo", "7 mo", "12 days", "Joined today")
  - `formatTenureShort(joinedIso: string, now: Date): string` ("1y 7m", "7m", "12d", "New")
  - `ageFromDob(dobIso: string | null | undefined, now: Date): number | null`
  - `maskNid(nid: string | null | undefined): string | null`
  - `roleLabel(role: string): string`, `statusLabel(status: string | null | undefined): string | null`, `maritalLabel(v)`, `educationLabel(v)`
  - `formatExperience(years: number | null | undefined, note: string | null | undefined): string | null`
  - `displayValue(v: string | null | undefined): string | null` (trimmed, or null when missing/blank)
  - `hasEmergencyContact(e: { emergency_name?: string | null; emergency_phone?: string | null }): boolean`

- [ ] **Step 1: Branch**

```bash
cd /Users/afifzilani/code/zerod-agency/projects/fms/mobile
git checkout main && git checkout -b feat/profile-redesign
```

- [ ] **Step 2: Extend the types** — in `src/lib/types.ts` replace `Profile` and `Employee`:

```ts
export type Profile = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  is_active: boolean;
  address?: string | null;
  avatar?: { image_url: string } | null;
};

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type EmploymentStatus = 'APPOINTED' | 'PROBATION' | 'CONFIRMED' | 'TERMINATED';

export type Employee = {
  id: string;
  profile_id: string;
  role: EmployeeRole;
  salary: string; // Decimal -> JSON string
  joining_date: string;
  rating: number | null;
  profile: Profile;
  // Hire profile (GET /employees/:id). Optional: older rows predate it.
  date_of_birth?: string | null;
  marital_status?: MaritalStatus | null;
  education?: string | null;
  experience?: string | null;
  experience_years?: number | null;
  nid_number?: string | null;
  emergency_name?: string | null;
  emergency_relation?: string | null;
  emergency_phone?: string | null;
  employment_status?: EmploymentStatus;
  probation_end_date?: string | null;
};
```

(Religion, referee, salary and payout fields are deliberately not typed: the screen must not be able to show them by accident.)

- [ ] **Step 3: Write the failing tests** — create `src/lib/profile-format.test.ts`:

```ts
/**
 * Profile formatting — verifiable without a device. Run: `bun src/lib/profile-format.test.ts`.
 */

import assert from 'node:assert/strict';

import {
  ageFromDob,
  displayValue,
  educationLabel,
  formatDate,
  formatExperience,
  formatTenure,
  formatTenureShort,
  hasEmergencyContact,
  maritalLabel,
  maskNid,
  roleLabel,
  statusLabel,
} from './profile-format';

// --- dates: the stored UTC calendar date, never shifted by the phone's timezone ---
assert.equal(formatDate('2025-03-12T00:00:00.000Z'), '12 Mar 2025');
assert.equal(formatDate('2025-12-01T23:59:59.000Z'), '1 Dec 2025');
assert.equal(formatDate('not a date'), '—');

// --- tenure ---------------------------------------------------------------------
const now = new Date('2026-10-07T09:00:00.000Z');
assert.equal(formatTenure('2025-03-07T00:00:00.000Z', now), '1 yr 7 mo');
assert.equal(formatTenure('2026-03-07T00:00:00.000Z', now), '7 mo');
assert.equal(formatTenure('2025-10-07T00:00:00.000Z', now), '1 yr', 'exactly a year, no "0 mo"');
assert.equal(formatTenure('2026-09-25T00:00:00.000Z', now), '12 days');
assert.equal(formatTenure('2026-10-06T00:00:00.000Z', now), '1 day');
assert.equal(formatTenure('2026-10-07T01:00:00.000Z', now), 'Joined today');
assert.equal(formatTenure('2026-12-01T00:00:00.000Z', now), 'Joined today', 'a future join date never goes negative');
assert.equal(formatTenureShort('2025-03-07T00:00:00.000Z', now), '1y 7m');
assert.equal(formatTenureShort('2026-03-07T00:00:00.000Z', now), '7m');
assert.equal(formatTenureShort('2026-09-25T00:00:00.000Z', now), '12d');
assert.equal(formatTenureShort('2026-10-07T01:00:00.000Z', now), 'New');

// --- age: birthday boundaries ----------------------------------------------------
assert.equal(ageFromDob('1994-10-07T00:00:00.000Z', now), 32, 'birthday today');
assert.equal(ageFromDob('1994-10-08T00:00:00.000Z', now), 31, 'birthday tomorrow');
assert.equal(ageFromDob('1994-10-06T00:00:00.000Z', now), 32, 'birthday yesterday');
assert.equal(ageFromDob(null, now), null);
assert.equal(ageFromDob(undefined, now), null);
assert.equal(ageFromDob('garbage', now), null);
assert.equal(ageFromDob('2030-01-01T00:00:00.000Z', now), null, 'a future date of birth is not an age');

// --- National ID: only the last 4 digits ever reach the screen ---------------------
assert.equal(maskNid('1234567890123'), '•••• 0123');
assert.equal(maskNid(' 1234567890 '), '•••• 7890', 'whitespace is ignored');
assert.equal(maskNid('123'), '••••', 'a short id reveals nothing');
assert.equal(maskNid('1234'), '••••', 'exactly four digits would be the whole id');
assert.equal(maskNid(''), null);
assert.equal(maskNid('   '), null);
assert.equal(maskNid(null), null);
assert.ok(!String(maskNid('9988776655')).includes('99887'), 'the head of the id is never present');

// --- labels --------------------------------------------------------------------
assert.equal(roleLabel('WORKER'), 'Worker');
assert.equal(roleLabel('MANAGER'), 'Manager');
assert.equal(roleLabel('INTERN'), 'Intern');
assert.equal(roleLabel('SHED_LEAD'), 'Shed lead', 'an unknown role is still readable');
assert.equal(statusLabel('APPOINTED'), 'Appointed');
assert.equal(statusLabel('PROBATION'), 'On probation');
assert.equal(statusLabel('CONFIRMED'), 'Confirmed');
assert.equal(statusLabel('TERMINATED'), 'Ended');
assert.equal(statusLabel(undefined), null);
assert.equal(maritalLabel('MARRIED'), 'Married');
assert.equal(maritalLabel(null), null);
assert.equal(educationLabel('SSC'), 'SSC');
assert.equal(educationLabel('BACHELOR'), "Bachelor's");
assert.equal(educationLabel('NONE'), 'No formal schooling');
assert.equal(educationLabel(undefined), null);
assert.equal(educationLabel('OTHER_THING'), 'Other thing', 'an unknown level is humanised, not hidden');

// --- experience ------------------------------------------------------------------
assert.equal(formatExperience(3, 'Layer farm, Gazipur'), '3 yrs · Layer farm, Gazipur');
assert.equal(formatExperience(1, null), '1 yr');
assert.equal(formatExperience(0, 'First job'), 'First job', 'zero years with a note shows the note only');
assert.equal(formatExperience(0, null), null);
assert.equal(formatExperience(null, '  '), null);
assert.equal(formatExperience(null, 'Poultry helper'), 'Poultry helper');

// --- "Not provided": blank and whitespace are missing ------------------------------
assert.equal(displayValue('  hello '), 'hello');
assert.equal(displayValue(''), null);
assert.equal(displayValue('   '), null);
assert.equal(displayValue(null), null);
assert.equal(displayValue(undefined), null);

// --- emergency contact on file ------------------------------------------------------
assert.equal(hasEmergencyContact({ emergency_name: 'Rahim', emergency_phone: '017' }), true);
assert.equal(hasEmergencyContact({ emergency_name: 'Rahim', emergency_phone: null }), true, 'a name alone is something to show');
assert.equal(hasEmergencyContact({ emergency_name: null, emergency_phone: '017' }), true);
assert.equal(hasEmergencyContact({ emergency_name: '  ', emergency_phone: '' }), false);
assert.equal(hasEmergencyContact({}), false);

console.log('profile-format checks passed');
```

- [ ] **Step 4: Run it to verify it fails**

Run: `bun src/lib/profile-format.test.ts`
Expected: FAIL — `Cannot find module './profile-format'`.

- [ ] **Step 5: Write the implementation** — create `src/lib/profile-format.ts`:

```ts
/**
 * Pure formatting for the Profile screen, kept out of the component so it can be
 * verified without a device. docs/profile-redesign-design.md.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `D Mon YYYY` from the stored UTC calendar date, so it never shifts a day with the phone's timezone. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function wholeMonths(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(months, 0);
}

function wholeDays(from: Date, to: Date): number {
  return Math.max(Math.floor((to.getTime() - from.getTime()) / 86_400_000), 0);
}

/** "1 yr 7 mo", "7 mo", "12 days", "Joined today". Never negative. */
export function formatTenure(joinedIso: string, now: Date): string {
  const joined = new Date(joinedIso);
  const months = wholeMonths(joined, now);
  if (months >= 1) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years ? `${years} yr` : '', rest ? `${rest} mo` : ''].filter(Boolean).join(' ');
  }
  const days = wholeDays(joined, now);
  if (days === 0) return 'Joined today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The short form for a stat tile: "1y 7m", "7m", "12d", "New". */
export function formatTenureShort(joinedIso: string, now: Date): string {
  const joined = new Date(joinedIso);
  const months = wholeMonths(joined, now);
  if (months >= 1) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years ? `${years}y` : '', rest ? `${rest}m` : ''].filter(Boolean).join(' ');
  }
  const days = wholeDays(joined, now);
  return days === 0 ? 'New' : `${days}d`;
}

/** Whole years; null for a missing, unparsable or future date of birth. */
export function ageFromDob(dobIso: string | null | undefined, now: Date): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime()) || dob.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Last four digits only. A phone can be shared or lost, so the head of the id never appears;
 *  an id of four digits or fewer would be the whole number, so it reveals nothing at all. */
export function maskNid(nid: string | null | undefined): string | null {
  const v = nid?.trim();
  if (!v) return null;
  if (v.length <= 4) return '••••';
  return `•••• ${v.slice(-4)}`;
}

function humanise(value: string): string {
  const t = value.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function roleLabel(role: string): string {
  return humanise(role);
}

const STATUS: Record<string, string> = {
  APPOINTED: 'Appointed',
  PROBATION: 'On probation',
  CONFIRMED: 'Confirmed',
  TERMINATED: 'Ended',
};

export function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS[status] ?? humanise(status);
}

export function maritalLabel(value: string | null | undefined): string | null {
  return value ? humanise(value) : null;
}

const EDUCATION: Record<string, string> = {
  NONE: 'No formal schooling',
  PRIMARY: 'Primary',
  JSC: 'JSC',
  SSC: 'SSC',
  DAKHIL: 'Dakhil',
  HSC: 'HSC',
  ALIM: 'Alim',
  DIPLOMA: 'Diploma',
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
};

export function educationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return EDUCATION[value] ?? humanise(value);
}

/** "3 yrs · Layer farm, Gazipur", or just the years, or just the note. */
export function formatExperience(
  years: number | null | undefined,
  note: string | null | undefined,
): string | null {
  const n = note?.trim() || null;
  const y = years && years > 0 ? `${years} yr${years === 1 ? '' : 's'}` : null;
  if (y && n) return `${y} · ${n}`;
  return y ?? n;
}

/** Trimmed text, or null when missing or blank — null is what shows as "Not provided". */
export function displayValue(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function hasEmergencyContact(e: {
  emergency_name?: string | null;
  emergency_phone?: string | null;
}): boolean {
  return !!(displayValue(e.emergency_name) || displayValue(e.emergency_phone));
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `bun src/lib/profile-format.test.ts`
Expected: `profile-format checks passed`

- [ ] **Step 7: Wire into the test script** — in `package.json` the `test` script becomes:

```json
    "test": "bun src/lib/format.test.ts && bun src/lib/scan.test.ts && bun src/lib/scan-actions.test.ts && bun src/lib/profile-format.test.ts"
```

Run: `bun run test` — Expected: four "checks passed" lines.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/types.ts src/lib/profile-format.ts src/lib/profile-format.test.ts package.json
git commit -m "feat(profile): hire-profile types and pure formatting helpers"
```

---

### Task 2: Appearance preference (light / dark / match phone)

**Files:**
- Create: `mobile/src/lib/appearance-pref.ts`
- Create: `mobile/src/lib/appearance-pref.test.ts`
- Create: `mobile/src/lib/appearance.ts`
- Modify: `mobile/src/app/_layout.tsx`
- Modify: `mobile/package.json` (`test` script)

**Interfaces:**
- Produces: `type AppearancePref = 'system' | 'light' | 'dark'`; `parseAppearance(raw: unknown): AppearancePref`; `schemeFor(pref): 'light' | 'dark' | null`; from `appearance.ts`: `loadAppearance(): Promise<AppearancePref>`, `applyAppearance(pref): void`, `useAppearance(): readonly [AppearancePref, (next: AppearancePref) => void]`.

- [ ] **Step 1: Write the failing test** — create `src/lib/appearance-pref.test.ts`:

```ts
/** Appearance preference parsing. Run: `bun src/lib/appearance-pref.test.ts`. */

import assert from 'node:assert/strict';

import { parseAppearance, schemeFor } from './appearance-pref';

assert.equal(parseAppearance('light'), 'light');
assert.equal(parseAppearance('dark'), 'dark');
assert.equal(parseAppearance('system'), 'system');

// A missing, junk or wrong-typed saved value never throws and never picks a theme for the user.
assert.equal(parseAppearance(null), 'system');
assert.equal(parseAppearance(undefined), 'system');
assert.equal(parseAppearance(''), 'system');
assert.equal(parseAppearance('Dark'), 'system', 'case matters: only exact saved values count');
assert.equal(parseAppearance('blue'), 'system');
assert.equal(parseAppearance(1), 'system');
assert.equal(parseAppearance({ a: 1 }), 'system');

// "Match phone" is null to React Native's override API.
assert.equal(schemeFor('system'), null);
assert.equal(schemeFor('light'), 'light');
assert.equal(schemeFor('dark'), 'dark');

console.log('appearance-pref checks passed');
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun src/lib/appearance-pref.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement the pure part** — create `src/lib/appearance-pref.ts`:

```ts
/** What the person chose for light/dark. Pure, so it can be tested without React Native. */
export type AppearancePref = 'system' | 'light' | 'dark';

/** Anything but an exact saved value means "Match phone": a corrupt or missing entry
 *  must never lock someone into a theme or throw at startup. */
export function parseAppearance(raw: unknown): AppearancePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** The argument React Native's `Appearance.setColorScheme` wants: `null` follows the phone. */
export function schemeFor(pref: AppearancePref): 'light' | 'dark' | null {
  return pref === 'system' ? null : pref;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun src/lib/appearance-pref.test.ts` — Expected: `appearance-pref checks passed`

- [ ] **Step 5: The React Native layer** — create `src/lib/appearance.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseAppearance, schemeFor, type AppearancePref } from '@/lib/appearance-pref';

export type { AppearancePref };

const KEY = 'fms:appearance';

/** The saved choice, or "Match phone" when there is none or storage is unavailable. */
export async function loadAppearance(): Promise<AppearancePref> {
  try {
    return parseAppearance(await AsyncStorage.getItem(KEY));
  } catch {
    return 'system';
  }
}

/** Every screen reads the scheme through one hook, so overriding it here re-themes the app. */
export function applyAppearance(pref: AppearancePref): void {
  Appearance.setColorScheme(schemeFor(pref));
}

async function saveAppearance(pref: AppearancePref): Promise<void> {
  applyAppearance(pref);
  try {
    await AsyncStorage.setItem(KEY, pref);
  } catch {
    // The choice still applies for this session; it just won't survive a restart.
  }
}

/** The current choice and a setter that applies and saves it. */
export function useAppearance() {
  const [pref, setPref] = useState<AppearancePref>('system');

  useEffect(() => {
    let alive = true;
    void loadAppearance().then((p) => {
      if (alive) setPref(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const choose = useCallback((next: AppearancePref) => {
    setPref(next);
    void saveAppearance(next);
  }, []);

  return [pref, choose] as const;
}
```

- [ ] **Step 6: Apply it at startup, behind the splash** — in `src/app/_layout.tsx`:

(a) Change the first import line to `import { useEffect, useState } from 'react';` and add: `import { applyAppearance, loadAppearance } from '@/lib/appearance';`

(b) In `RootLayout`, directly after `const [fontsLoaded, fontError] = useFonts(FontAssets);` add:

```tsx
  // The saved light/dark choice is applied before the first frame, so there is no flash of the
  // wrong theme. loadAppearance never rejects (it falls back to "Match phone").
  const [appearanceReady, setAppearanceReady] = useState(false);
  useEffect(() => {
    void loadAppearance().then((pref) => {
      applyAppearance(pref);
      setAppearanceReady(true);
    });
  }, []);
  const ready = (fontsLoaded || !!fontError) && appearanceReady;
```

(c) Replace the splash-hide effect and the null return with:

```tsx
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;
```

- [ ] **Step 7: Wire into the test script** — append `&& bun src/lib/appearance-pref.test.ts` to the `test` script in `package.json`. Run `bun run test` — five "checks passed" lines.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx expo lint
git add src/lib/appearance-pref.ts src/lib/appearance-pref.test.ts src/lib/appearance.ts src/app/_layout.tsx package.json
git commit -m "feat(appearance): light/dark/match-phone preference, saved and applied at startup"
```

---

### Task 3: Profile components and the redesigned screen

**Files:**
- Create: `mobile/src/components/profile-parts.tsx`
- Modify: `mobile/src/app/profile.tsx` (full rewrite)

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 `useAppearance`, `useSession` (`employee`, `logout`), `useOutboxSummary`, `useGetData`, `Card`/`StatCard`, `Button`, `SegmentedToggle`, `Icon`/`IconTile`, `StatusPill`, `initials`, `monthRange`, `formatSignedPoints`.
- Produces: `ProfileHeader`, `InfoRow`, `NavRow`, `openLink`.

- [ ] **Step 1: The parts** — create `src/components/profile-parts.tsx`:

```tsx
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/farm';
import { displayValue, formatDate, roleLabel, statusLabel } from '@/lib/profile-format';
import type { Employee } from '@/lib/types';

/** Opens the dialer or mail app; a phone with neither says so instead of doing nothing. */
export function openLink(url: string): void {
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open that", 'This phone has no app for it.'));
}

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: 'CURRENT',
  PROBATION: 'PENDING',
  APPOINTED: 'CURRENT',
  TERMINATED: 'CLOSED',
};

/** The identity card: photo or initials, name, role and status, joined date. */
export function ProfileHeader({ employee }: { employee: Employee }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const photo = employee.profile.avatar?.image_url;
  const status = statusLabel(employee.employment_status);

  return (
    <View style={[styles.hero, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityLabel={`${employee.profile.name}'s photo`}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="stat" color="primary">
            {initials(employee.profile.name)}
          </AppText>
        </View>
      )}

      <AppText variant="h1" style={styles.centre}>
        {employee.profile.name}
      </AppText>

      <View style={styles.pills}>
        <View style={[styles.rolePill, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="label" color="primary">
            {roleLabel(employee.role)}
          </AppText>
        </View>
        {status ? (
          <StatusPill
            status={STATUS_TONE[employee.employment_status ?? ''] ?? 'CLOSED'}
            label={status}
          />
        ) : null}
      </View>

      <AppText variant="caption" color="muted" style={styles.centre}>
        Joined {formatDate(employee.joining_date)}
      </AppText>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  /** Missing, empty or blank shows "Not provided" and the row is not tappable. */
  value?: string | null;
  /** Makes the row tappable (call, write). Ignored when there is no value. */
  onPress?: () => void;
  icon?: IconName;
  last?: boolean;
};

/** A label on the left, its value on the right, an optional action icon, a hairline below. */
export function InfoRow({ label, value, onPress, icon, last }: InfoRowProps) {
  const theme = useTheme();
  const shown = displayValue(value);
  const tappable = !!onPress && !!shown;

  const body = (
    <>
      <AppText variant="label" color="muted" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="body" color={shown ? 'ink' : 'muted'} style={styles.rowValue}>
        {shown ?? 'Not provided'}
      </AppText>
      {tappable && icon ? <Icon name={icon} size={20} color="primary" /> : null}
    </>
  );

  return (
    <View>
      {tappable ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown}`}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </View>
  );
}

/** A tappable row that goes somewhere, with a chevron. */
export function NavRow({
  label,
  onPress,
  last,
}: {
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
      >
        <AppText variant="body" style={styles.rowValue}>
          {label}
        </AppText>
        <Icon name="chevron-right" size={20} color="muted" />
      </Pressable>
      {last ? null : <View style={[styles.rule, { backgroundColor: theme.line }]} />}
    </View>
  );
}

/** A titled card of rows, edge to edge so the hairlines run the full width. */
export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card rows eyebrow={title} style={styles.card}>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    marginTop: Spacing.xs,
  },
  avatar: { width: 80, height: 80, borderRadius: Radius.pill, marginBottom: Spacing.xs },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  rolePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  card: { marginTop: Spacing.md },
  row: {
    minHeight: Size.rowSingle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
  rule: { height: 1, marginLeft: Spacing.lg },
});
```

- [ ] **Step 2: Rewrite the screen** — replace `src/app/profile.tsx` entirely:

```tsx
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Button } from '@/components/ui/button';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, IconTile } from '@/components/ui/icon';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { InfoCard, InfoRow, NavRow, ProfileHeader, openLink } from '@/components/profile-parts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useAppearance, type AppearancePref } from '@/lib/appearance';
import { monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import {
  ageFromDob,
  displayValue,
  educationLabel,
  formatDate,
  formatExperience,
  formatTenureShort,
  hasEmergencyContact,
  maritalLabel,
  maskNid,
  roleLabel,
  statusLabel,
} from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import { useOutboxSummary } from '@/lib/use-outbox';
import type { Employee } from '@/lib/types';

type ScoreEntry = { id: string; points: number; employee_id: string };

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'Match phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: AppearancePref; label: string }[];

/** docs/profile-redesign-design.md — who you are at the farm, your details as the farm holds them,
 *  who to call in an emergency, and the app's settings. Read-only. */
export default function ProfileScreen() {
  const theme = useTheme();
  const { employee: saved, logout } = useSession();
  const { data: outbox } = useOutboxSummary();
  const [appearance, setAppearance] = useAppearance();
  // Read once: calling new Date() during render is impure (the React Compiler rejects it).
  const [now] = useState(() => new Date());
  const { from, to } = useMemo(() => monthRange(now), [now]);

  // The copy saved at login shows at once; the fresh fetch replaces it. Offline keeps the saved copy.
  const { data: fresh, isError } = useGetData<Employee>(
    saved ? `/employees/${saved.id}` : '',
    ['employees', 'me', saved?.id ?? 'none'],
    { enabled: !!saved, initialData: saved ?? undefined },
  );
  const employee = fresh ?? saved;

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', 'mtd', employee?.id ?? 'none'],
    { enabled: !!employee },
  );
  const points = (scores?.results ?? []).reduce((sum, s) => sum + s.points, 0);

  const onLogout = () => {
    const pending = (outbox?.pendingCount ?? 0) + (outbox?.deadLetterCount ?? 0);
    // A queued write belongs to whoever is signed in when it uploads, so nothing may be left behind.
    if (pending > 0) {
      Alert.alert(
        'Sync first',
        `${pending} record${pending === 1 ? '' : 's'} on this phone haven't uploaded yet. Connect to the network and let them sync, then log out.`,
      );
      return;
    }
    void logout();
  };

  if (!employee) {
    return (
      <Screen>
        <Header title="Profile" leading="back" />
        <EmptyState
          icon="user"
          tint="primarySoft"
          title="Couldn't load your profile."
          body="Check your connection and try again."
        />
      </Screen>
    );
  }

  const p = employee.profile;
  const age = ageFromDob(employee.date_of_birth, now);
  const dob = employee.date_of_birth ? formatDate(employee.date_of_birth) : null;
  const onProbation = employee.employment_status === 'PROBATION' && !!employee.probation_end_date;
  const emergencyName = displayValue(employee.emergency_name);
  const emergencyRelation = displayValue(employee.emergency_relation);
  const emergencyPhone = displayValue(employee.emergency_phone);

  return (
    <Screen>
      <Header title="Profile" leading="back" />

      <ProfileHeader employee={employee} />

      <View style={styles.stats}>
        <StatCard
          value={formatSignedPoints(points)}
          eyebrow={`Points · ${now.toLocaleDateString(undefined, { month: 'short' })}`}
          tint="tintAmber"
          valueColor={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
          icon={<IconTile name="award" tint="tintAmber" color="warning" />}
          onPress={() => router.push('/me/performance')}
        />
        <StatCard
          value={formatTenureShort(employee.joining_date, now)}
          eyebrow="With the farm"
          tint="tintBlue"
          icon={<IconTile name="clock" tint="tintBlue" color="info" />}
        />
      </View>

      {isError ? (
        <AppText variant="caption" color="muted" style={styles.note}>
          Showing details saved on this phone.
        </AppText>
      ) : null}

      <InfoCard title="Contact">
        <InfoRow label="Mobile" value={p.mobile} icon="phone" onPress={() => openLink(`tel:${p.mobile}`)} />
        <InfoRow
          label="Email"
          value={p.email}
          icon="mail"
          onPress={() => openLink(`mailto:${p.email}`)}
        />
        <InfoRow label="Address" value={p.address} last />
      </InfoCard>

      <InfoCard title="Employment">
        <InfoRow label="Role" value={roleLabel(employee.role)} />
        <InfoRow label="Status" value={statusLabel(employee.employment_status)} />
        <InfoRow label="Joined" value={formatDate(employee.joining_date)} last={!onProbation} />
        {onProbation ? (
          <InfoRow label="Probation ends" value={formatDate(employee.probation_end_date as string)} last />
        ) : null}
      </InfoCard>

      <InfoCard title="Personal">
        <InfoRow label="Born" value={dob ? `${dob}${age !== null ? ` · ${age} yrs` : ''}` : null} />
        <InfoRow label="Marital status" value={maritalLabel(employee.marital_status)} />
        <InfoRow label="Education" value={educationLabel(employee.education)} />
        <InfoRow
          label="Experience"
          value={formatExperience(employee.experience_years, employee.experience)}
        />
        <InfoRow label="National ID" value={maskNid(employee.nid_number)} last />
      </InfoCard>

      <InfoCard title="Emergency contact">
        {hasEmergencyContact(employee) ? (
          <>
            <InfoRow
              label="Name"
              value={
                emergencyName
                  ? `${emergencyName}${emergencyRelation ? ` · ${emergencyRelation}` : ''}`
                  : null
              }
            />
            <InfoRow
              label="Phone"
              value={emergencyPhone}
              icon="phone"
              onPress={() => openLink(`tel:${emergencyPhone}`)}
              last
            />
          </>
        ) : (
          <View style={[styles.warning, { backgroundColor: theme.tintAmber }]}>
            <Icon name="alert-circle" size={20} color="warning" />
            <AppText variant="body" style={styles.warningText}>
              No emergency contact on file. Ask your manager to add one.
            </AppText>
          </View>
        )}
      </InfoCard>

      <AppText variant="caption" color="muted" style={styles.note}>
        Something wrong? Ask your manager. Only they can change these details.
      </AppText>

      <Card eyebrow="Settings" style={styles.card}>
        <View style={styles.appearance}>
          <AppText variant="label" color="muted">
            Appearance
          </AppText>
          <SegmentedToggle
            height={48}
            options={APPEARANCE_OPTIONS}
            value={appearance}
            onChange={setAppearance}
          />
        </View>
      </Card>

      <Card rows style={styles.card}>
        <NavRow label="My performance" onPress={() => router.push('/me/performance')} />
        <NavRow label="Change password" onPress={() => router.push('/change-password' as Href)} />
        <InfoRow label="App version" value={Constants.expoConfig?.version ?? '—'} last />
      </Card>

      <View style={styles.logout}>
        <Button variant="destructive" label="Log out" onPress={onLogout} block />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  card: { marginTop: Spacing.md },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
  appearance: { gap: Spacing.sm },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.control,
  },
  warningText: { flex: 1 },
  logout: { marginTop: Spacing.xl },
});
```

- [ ] **Step 3: Typecheck, lint, tests**

Run: `bunx tsc --noEmit && bunx expo lint && bun run test`
Expected: clean; all test scripts pass. Fixes you may need: if `Icon` `name="phone"`/`"mail"`/`"clock"`/`"award"` is rejected, those are valid Feather glyphs; if `StatusPill` shows an unknown status in muted tone that is acceptable only for unmapped values (the screen maps through `STATUS_TONE`).

- [ ] **Step 4: Commit**

```bash
git add src/components/profile-parts.tsx src/app/profile.tsx
git commit -m "feat(profile): redesigned employee profile with details, emergency contact and appearance settings"
```

---

### Task 4: Verify, document, merge

- [ ] **Step 1: All green** — `bunx tsc --noEmit && bunx expo lint && bun run test`; expected: clean, five "checks passed" lines.

- [ ] **Step 2: Browser check as the test worker and manager** (light and dark) — open `/profile` and confirm: identity card, two stat tiles, Contact / Employment / Personal / Emergency contact cards, the manager-note line, Settings with the three-way Appearance toggle, My performance / Change password / App version rows, Log out. Tap the toggle to Dark and Light and confirm the screen re-themes; reload and confirm the choice is kept. The test accounts have no hire data, so most rows read "Not provided" and the emergency card shows the warning row — that is the expected state, and the only way to see a filled profile is a real employee with hire details.

- [ ] **Step 3: Mark docs and merge**

In `docs/profile-redesign-design.md` change the Status line to `Status: **Built** (2026-10-07). Not verified on a device: tap-to-call/mail, native appearance override, profile photo.`

```bash
git add docs/profile-redesign-design.md
git commit -m "docs: mark profile redesign built"
git checkout main && git merge --no-ff feat/profile-redesign -m "Merge feat/profile-redesign: employee profile redesign and appearance toggle" && git branch -d feat/profile-redesign
```

---

## Self-review

- **Spec coverage:** identity header (T3 `ProfileHeader`), at-a-glance tiles (T3), contact with tap-to-call/mail (T3 `InfoRow`+`openLink`), employment incl. probation end only while on probation (T3), personal with age and masked NID (T1 + T3), emergency contact with clear warning when absent (T1 `hasEmergencyContact` + T3), settings incl. appearance (T2 + T3), account/log out with sync guard (T3), not-shown list (types omit those fields; screen never references them), fetch-fresh-with-saved-fallback and the quiet "Showing details saved on this phone" line (T3), read-only note (T3), "Not provided" (T1 `displayValue` + T3 `InfoRow`), light/dark (existing tokens + T2).
- **Placeholders:** none; every code step has code.
- **Type consistency:** the helpers' names and signatures in T1's Interfaces match the imports in T3; `AppearancePref`/`useAppearance` from T2 match T3; `InfoRow`/`NavRow`/`InfoCard`/`ProfileHeader`/`openLink` are all defined in T3 Step 1 before use in Step 2.
- **Review Focus:** each line maps to a test (T1/T2) or the T3/T4 checks.
