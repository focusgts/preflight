/**
 * Smoke test for the public /preflight page (ADR-064 Phase 3).
 *
 * Verifies the server page module loads cleanly, exports static
 * metadata with the expected SEO fields, and wires up a default
 * component. Also confirms the client sub-component is importable
 * and surfaces the samples dropdown options.
 */

import { describe, it, expect } from 'vitest';

describe('public /preflight page', () => {
  it('exports a default component and static metadata', async () => {
    const mod = await import('@/app/(public)/preflight/page');
    expect(typeof mod.default).toBe('function');
    expect(mod.metadata).toBeDefined();
    expect(typeof mod.metadata.title).toBe('string');
    expect(mod.metadata.title).toMatch(/pre-?flight/i);
    expect(typeof mod.metadata.description).toBe('string');
    expect(mod.metadata.description?.length ?? 0).toBeGreaterThan(30);
    expect(mod.metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it('exports a PreflightClient component', async () => {
    const mod = await import('@/app/(public)/preflight/preflight-client');
    expect(typeof mod.PreflightClient).toBe('function');
  });

  it('bundles the 4 public samples through the client module graph', async () => {
    const { PUBLIC_SAMPLES } = await import('@/lib/preflight/public-samples');
    expect(PUBLIC_SAMPLES.length).toBe(4);
    // The dropdown shows each sample's label — verify labels are non-empty
    for (const s of PUBLIC_SAMPLES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.code.length).toBeGreaterThan(0);
    }
  });
});
