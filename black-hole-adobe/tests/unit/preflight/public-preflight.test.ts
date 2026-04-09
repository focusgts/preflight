/**
 * Tests for ADR-064 Phase 2 — rate-limit config, public samples
 * regression guard, and PUBLIC_PATHS wiring.
 */

import { describe, it, expect } from 'vitest';
import {
  checkRateLimit,
  RATE_LIMITS,
} from '@/lib/api/rate-limiter';
import { PUBLIC_SAMPLES } from '@/lib/preflight/public-samples';
import { PreFlightEngine } from '@/lib/preflight/cloud-manager-rules';

// ── Rate limit config ────────────────────────────────────────────────────

describe('publicPreflight rate limit config', () => {
  it('is 20 requests per hour', () => {
    expect(RATE_LIMITS.publicPreflight.maxRequests).toBe(20);
    expect(RATE_LIMITS.publicPreflight.windowMs).toBe(3_600_000);
  });

  it('allows the first 20 requests and blocks the 21st', () => {
    const key = `test-phase2-${Math.random()}`;
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push(checkRateLimit(key, RATE_LIMITS.publicPreflight));
    }
    expect(results.every((r) => r.allowed)).toBe(true);
    expect(results[0].remaining).toBe(19);
    expect(results[19].remaining).toBe(0);

    const blocked = checkRateLimit(key, RATE_LIMITS.publicPreflight);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('isolates separate IPs into separate windows', () => {
    const ipA = `test-phase2-a-${Math.random()}`;
    const ipB = `test-phase2-b-${Math.random()}`;

    for (let i = 0; i < 20; i++) {
      checkRateLimit(ipA, RATE_LIMITS.publicPreflight);
    }
    const aBlocked = checkRateLimit(ipA, RATE_LIMITS.publicPreflight);
    const bAllowed = checkRateLimit(ipB, RATE_LIMITS.publicPreflight);

    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
    expect(bAllowed.remaining).toBe(19);
  });

  it('sets resetAt to now + windowMs on the first hit', () => {
    const key = `test-phase2-reset-${Math.random()}`;
    const before = Date.now();
    const result = checkRateLimit(key, RATE_LIMITS.publicPreflight);
    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(
      before + RATE_LIMITS.publicPreflight.windowMs - 50,
    );
    expect(result.resetAt).toBeLessThanOrEqual(
      after + RATE_LIMITS.publicPreflight.windowMs + 50,
    );
  });
});

// ── Public samples regression guard ──────────────────────────────────────

describe('PUBLIC_SAMPLES regression', () => {
  const engine = new PreFlightEngine();

  it('has 4 samples with unique IDs', () => {
    expect(PUBLIC_SAMPLES).toHaveLength(4);
    const ids = PUBLIC_SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(4);
  });

  it.each(PUBLIC_SAMPLES.map((s) => [s.id, s] as const))(
    'sample %s triggers its expected rule IDs',
    (_id, sample) => {
      const report = engine.runPreFlight([
        { path: sample.filePath, content: sample.code },
      ]);
      const firedRuleIds = new Set(report.findings.map((f) => f.ruleId));
      for (const expected of sample.expectedRuleIds) {
        expect(
          firedRuleIds.has(expected),
          `sample "${sample.id}" should trigger ${expected}, but only got: ${[...firedRuleIds].join(', ') || '(none)'}`,
        ).toBe(true);
      }
    },
  );

  it('every sample produces at least one blocker or critical finding', () => {
    for (const sample of PUBLIC_SAMPLES) {
      const report = engine.runPreFlight([
        { path: sample.filePath, content: sample.code },
      ]);
      const hasSevere = report.findings.some(
        (f) => f.severity === 'blocker' || f.severity === 'critical',
      );
      expect(hasSevere, `sample "${sample.id}" should produce at least one blocker/critical`).toBe(true);
    }
  });
});

// ── PUBLIC_PATHS wiring ──────────────────────────────────────────────────
//
// We can't easily import the proxy module from a test (it imports
// next/server which bails outside of an edge runtime), so we assert on
// the raw source. This catches someone silently removing /preflight.

describe('PUBLIC_PATHS wiring', () => {
  it('includes /preflight, /api/preflight, and the support routes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../src/proxy.ts'),
      'utf8',
    );
    expect(src).toContain("'/preflight'");
    expect(src).toContain("'/api/preflight'");
    expect(src).toContain("'/api/leads/preflight'");
    expect(src).toContain("'/api/analytics'");
  });
});
