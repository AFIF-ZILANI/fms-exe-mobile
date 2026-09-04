// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite ships a WASM build for web (it backs the offline outbox --
// see docs/offline-sync.md). Metro doesn't treat .wasm as an asset by
// default, so the web bundle fails to resolve it without this.
config.resolver.assetExts.push('wasm');

// Note: the WASM build also needs SharedArrayBuffer, i.e. a cross-origin
// isolated context (COEP/COOP headers). Those are set for production builds
// via the expo-router plugin in app.json, but `expo start --web` does not
// serve them, so the local queue is unavailable in web dev. That's contained
// -- lib/outbox.ts opens the database lazily and degrades instead of
// crashing. iOS and Android use native SQLite and are unaffected.

module.exports = config;
