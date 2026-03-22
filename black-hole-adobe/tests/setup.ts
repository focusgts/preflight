/**
 * Vitest global test setup for Black Hole for Adobe Marketing Cloud.
 *
 * Provides global mocks for browser/node APIs that are not available
 * in the jsdom test environment.
 */

import { vi } from 'vitest';

// ---- Global fetch mock (opt-in per test) ----
// Individual tests should mock fetch as needed via vi.stubGlobal or vi.spyOn.
// We ensure it exists as a no-op so imports that reference it don't blow up.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn().mockRejectedValue(
    new Error('fetch is not mocked. Stub it in your test.'),
  ) as unknown as typeof fetch;
}

// ---- Silence console.warn / console.error in tests unless DEBUG ----
if (!process.env.DEBUG) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

// ---- Crypto.randomUUID polyfill (jsdom may not have it) ----
if (typeof globalThis.crypto === 'undefined') {
  // Minimal polyfill - uuid package uses its own implementation anyway
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 10),
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
  });
}
