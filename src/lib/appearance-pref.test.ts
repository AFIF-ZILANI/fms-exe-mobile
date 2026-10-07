/** Appearance preference parsing. Run: `bun src/lib/appearance-pref.test.ts`. */

import assert from 'node:assert/strict';

import { parseAppearance, schemeFor, nativeScheme } from './appearance-pref';

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

// Native scheme for React Native 0.86.3: 'unspecified' follows the system.
assert.equal(nativeScheme('system'), 'unspecified');
assert.equal(nativeScheme('light'), 'light');
assert.equal(nativeScheme('dark'), 'dark');

console.log('appearance-pref checks passed');
