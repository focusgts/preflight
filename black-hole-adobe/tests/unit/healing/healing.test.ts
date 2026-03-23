/**
 * Self-Healing Engine Tests
 *
 * Tests for diagnostics, remedy matching, confidence-based decisions,
 * circuit breaker behavior, outcome recording, and report generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticEngine } from '@/lib/healing/diagnostics';
import { RemedyLibrary } from '@/lib/healing/remedy-library';
import { HealingEngine } from '@/lib/healing/healing-engine';
import { Severity } from '@/types';
import type { MigrationItem } from '@/types';
import type { Diagnosis, HealingAction } from '@/types/healing';
import { CONFIDENCE_THRESHOLDS, CIRCUIT_BREAKER_LIMIT } from '@/types/healing';

// ============================================================
// Helpers
// ============================================================

function makeItem(overrides: Partial<MigrationItem> = {}): MigrationItem {
  return {
    id: 'item-1',
    type: 'code',
    name: 'TestComponent.java',
    sourcePath: '/apps/mysite/components/test',
    targetPath: null,
    status: 'failed',
    compatibilityLevel: 'manual_fix',
    autoFixed: false,
    validationResult: null,
    error: 'Test error',
    processedAt: null,
    ...overrides,
  };
}

function makeItems(count: number): MigrationItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({
      id: `item-${i}`,
      name: `Item${i}.java`,
      sourcePath: `/apps/mysite/components/item${i}`,
    }),
  );
}

// ============================================================
// DiagnosticEngine Tests
// ============================================================

describe('DiagnosticEngine', () => {
  let diagnostics: DiagnosticEngine;

  beforeEach(() => {
    diagnostics = new DiagnosticEngine();
  });

  // --- Error Classification ---

  it('should classify API errors from HTTP status codes', () => {
    expect(diagnostics.classifyError('HTTP 500 Internal Server Error')).toBe('api_error');
    expect(diagnostics.classifyError('HTTP 429 Too Many Requests')).toBe('api_error');
    expect(diagnostics.classifyError('502 Bad Gateway')).toBe('api_error');
  });

  it('should classify permission denied errors', () => {
    expect(diagnostics.classifyError('Permission denied on /content/dam')).toBe('permission_denied');
    expect(diagnostics.classifyError('403 Forbidden')).toBe('permission_denied');
    expect(diagnostics.classifyError('Authentication failed for service user')).toBe('permission_denied');
  });

  it('should classify code compatibility errors', () => {
    expect(diagnostics.classifyError('Cannot resolve import com.day.cq.deprecated')).toBe('code_compatibility');
    expect(diagnostics.classifyError('OSGi bundle not resolved')).toBe('code_compatibility');
    expect(diagnostics.classifyError('Deprecated API usage detected')).toBe('code_compatibility');
  });

  it('should classify content integrity errors', () => {
    expect(diagnostics.classifyError('Broken reference to /content/page-old')).toBe('content_integrity');
    expect(diagnostics.classifyError('Invalid node type cq:SomeType')).toBe('content_integrity');
    expect(diagnostics.classifyError('Missing reference /content/dam/asset.png')).toBe('content_integrity');
  });

  it('should classify resource limit errors', () => {
    expect(diagnostics.classifyError('Request timeout after 30s')).toBe('resource_limit');
    expect(diagnostics.classifyError('Payload too large: 150MB exceeds limit')).toBe('resource_limit');
    expect(diagnostics.classifyError('Out of memory: Java heap space')).toBe('resource_limit');
  });

  it('should classify configuration errors', () => {
    expect(diagnostics.classifyError('Invalid OSGi config for pid com.day.cq')).toBe('configuration_error');
    expect(diagnostics.classifyError('Dispatcher rule syntax error')).toBe('configuration_error');
    expect(diagnostics.classifyError('Workflow step not found: CustomStep')).toBe('configuration_error');
  });

  it('should return unknown for unrecognized errors', () => {
    expect(diagnostics.classifyError('Something completely unexpected happened')).toBe('unknown');
  });

  // --- Pattern Extraction ---

  it('should extract HTTP status codes from error messages', () => {
    const patterns = diagnostics.extractPatterns('HTTP 429 Too Many Requests');
    expect(patterns).toContain('http_429');
  });

  it('should extract error codes from messages', () => {
    const patterns = diagnostics.extractPatterns('Connection failed: ECONNREFUSED');
    expect(patterns).toContain('econnrefused');
  });

  it('should extract Java exception class names', () => {
    const patterns = diagnostics.extractPatterns('Caused by: NullPointerException at line 42');
    expect(patterns.some((p) => p.includes('nullpointerexception'))).toBe(true);
  });

  it('should extract OSGi bundle identifiers', () => {
    const patterns = diagnostics.extractPatterns('bundle com.adobe.cq.dam.core cannot resolve');
    expect(patterns.some((p) => p.includes('bundle:com.adobe.cq.dam.core'))).toBe(true);
  });

  it('should extract file paths from error messages', () => {
    const patterns = diagnostics.extractPatterns('Failed at path /apps/mysite/components/header');
    expect(patterns.some((p) => p.startsWith('path:'))).toBe(true);
  });

  // --- Full Diagnosis ---

  it('should produce a complete diagnosis', () => {
    const item = makeItem({ error: 'HTTP 503 Service Unavailable' });
    const diagnosis = diagnostics.analyze(
      'HTTP 503 Service Unavailable',
      'mig-1',
      'content_migration',
      item,
    );

    expect(diagnosis.id).toBeTruthy();
    expect(diagnosis.errorType).toBe('api_error');
    expect(diagnosis.errorMessage).toBe('HTTP 503 Service Unavailable');
    expect(diagnosis.patterns.length).toBeGreaterThan(0);
    expect(diagnosis.rootCause).toBeTruthy();
    expect(diagnosis.severity).toBe(Severity.HIGH);
    expect(diagnosis.httpStatus).toBe(503);
    expect(diagnosis.context.migrationId).toBe('mig-1');
  });

  // --- Related Items ---

  it('should find related items with same type and path prefix', () => {
    const failedItem = makeItem({ sourcePath: '/apps/mysite/components/header' });
    const allItems = [
      failedItem,
      makeItem({ id: 'item-2', sourcePath: '/apps/mysite/components/footer' }),
      makeItem({ id: 'item-3', sourcePath: '/content/dam/images/logo', type: 'asset' }),
    ];

    const related = diagnostics.findRelatedItems(failedItem, allItems);
    expect(related.length).toBe(1);
    expect(related[0].id).toBe('item-2');
  });

  // --- Root Cause Suggestion ---

  it('should suggest rate limit root cause for 429 errors', () => {
    const cause = diagnostics.suggestRootCause('api_error', 'HTTP 429', ['http_429']);
    expect(cause).toContain('rate limit');
  });

  it('should suggest bundle dependency root cause for OSGi errors', () => {
    const cause = diagnostics.suggestRootCause('code_compatibility', 'OSGi bundle not resolved', []);
    expect(cause).toContain('bundle');
  });
});

// ============================================================
// RemedyLibrary Tests
// ============================================================

describe('RemedyLibrary', () => {
  let library: RemedyLibrary;

  beforeEach(() => {
    library = new RemedyLibrary();
  });

  it('should have built-in remedies registered', () => {
    expect(library.size).toBe(10);
  });

  it('should match OSGi bundle errors to bundle resolution remedy', () => {
    const diagnosis: Diagnosis = {
      id: 'diag-1',
      errorType: 'code_compatibility',
      errorMessage: 'OSGi bundle com.mysite.core cannot resolve',
      patterns: ['bundle:com.mysite.core'],
      rootCause: 'Missing bundle dependencies',
      relatedItemIds: [],
      severity: Severity.MEDIUM,
      httpStatus: null,
      stackTrace: null,
      context: {
        migrationId: 'mig-1',
        phase: 'code_modernization',
        itemId: 'item-1',
        itemType: 'code',
        sourcePath: '/apps/mysite',
        targetPath: null,
      },
      createdAt: new Date().toISOString(),
    };

    const matches = library.findRemedy(diagnosis);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].remedy.name).toBe('OSGi Bundle Resolution');
  });

  it('should match rate limit errors to backoff remedy', () => {
    const diagnosis: Diagnosis = {
      id: 'diag-2',
      errorType: 'api_error',
      errorMessage: 'Rate limit exceeded: 429 Too Many Requests',
      patterns: ['http_429'],
      rootCause: null,
      relatedItemIds: [],
      severity: Severity.HIGH,
      httpStatus: 429,
      stackTrace: null,
      context: {
        migrationId: 'mig-1',
        phase: 'content_migration',
        itemId: 'item-1',
        itemType: 'content',
        sourcePath: '/content/mysite',
        targetPath: null,
      },
      createdAt: new Date().toISOString(),
    };

    const matches = library.findRemedy(diagnosis);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].remedy.name).toBe('API Rate Limit Backoff');
  });

  it('should match dispatcher errors to dispatcher fix', () => {
    const diagnosis: Diagnosis = {
      id: 'diag-3',
      errorType: 'configuration_error',
      errorMessage: 'Dispatcher rule contains unsupported directive',
      patterns: [],
      rootCause: null,
      relatedItemIds: [],
      severity: Severity.MEDIUM,
      httpStatus: null,
      stackTrace: null,
      context: {
        migrationId: 'mig-1',
        phase: 'code_modernization',
        itemId: 'item-1',
        itemType: 'config',
        sourcePath: '/dispatcher/rules',
        targetPath: null,
      },
      createdAt: new Date().toISOString(),
    };

    const matches = library.findRemedy(diagnosis);
    expect(matches.some((m) => m.remedy.name === 'Dispatcher Rule Fix')).toBe(true);
  });

  it('should match content too large errors', () => {
    const diagnosis: Diagnosis = {
      id: 'diag-4',
      errorType: 'resource_limit',
      errorMessage: 'Payload too large: node exceeds max size',
      patterns: [],
      rootCause: null,
      relatedItemIds: [],
      severity: Severity.HIGH,
      httpStatus: null,
      stackTrace: null,
      context: {
        migrationId: 'mig-1',
        phase: 'content_migration',
        itemId: 'item-1',
        itemType: 'content',
        sourcePath: '/content/dam/bignode',
        targetPath: null,
      },
      createdAt: new Date().toISOString(),
    };

    const matches = library.findRemedy(diagnosis);
    expect(matches.some((m) => m.remedy.name === 'Content Node Split')).toBe(true);
  });

  it('should match broken reference errors', () => {
    const diagnosis: Diagnosis = {
      id: 'diag-5',
      errorType: 'content_integrity',
      errorMessage: 'Broken reference to /content/oldsite/page1',
      patterns: [],
      rootCause: null,
      relatedItemIds: [],
      severity: Severity.MEDIUM,
      httpStatus: null,
      stackTrace: null,
      context: {
        migrationId: 'mig-1',
        phase: 'content_migration',
        itemId: 'item-1',
        itemType: 'page',
        sourcePath: '/content/mysite/page2',
        targetPath: null,
      },
      createdAt: new Date().toISOString(),
    };

    const matches = library.findRemedy(diagnosis);
    expect(matches.some((m) => m.remedy.name === 'Content Reference Repair')).toBe(true);
  });

  it('should record successful outcomes and update confidence', () => {
    library.recordOutcome('remedy-rate-limit', true);
    library.recordOutcome('remedy-rate-limit', true);
    library.recordOutcome('remedy-rate-limit', false);

    const stats = library.getRemedyStats();
    const rateLimitStat = stats.find((s) => s.remedyId === 'remedy-rate-limit');
    expect(rateLimitStat).toBeDefined();
    expect(rateLimitStat!.usageCount).toBeGreaterThan(40);
  });

  it('should return sorted remedy stats', () => {
    const stats = library.getRemedyStats();
    expect(stats.length).toBe(10);
    // Should be sorted by usage count descending
    for (let i = 1; i < stats.length; i++) {
      expect(stats[i - 1].usageCount).toBeGreaterThanOrEqual(stats[i].usageCount);
    }
  });
});

// ============================================================
// HealingEngine Tests
// ============================================================

describe('HealingEngine', () => {
  let engine: HealingEngine;

  beforeEach(() => {
    engine = new HealingEngine(undefined, undefined, {
      autoApplyEnabled: true,
      maxRetryAfterFix: 1,
    });
  });

  it('should handle a failure and return a healing result', async () => {
    const item = makeItem({
      error: 'Rate limit exceeded: 429 Too Many Requests',
    });

    const result = await engine.handleFailure(
      'mig-1',
      'content_migration',
      item,
      new Error('Rate limit exceeded: 429 Too Many Requests'),
    );

    expect(result.action).toBeDefined();
    expect(result.action.migrationId).toBe('mig-1');
    expect(result.action.itemId).toBe('item-1');
  });

  it('should auto-apply high confidence remedies', async () => {
    const item = makeItem({
      error: 'Rate limit exceeded: 429 Too Many Requests',
    });

    const result = await engine.handleFailure(
      'mig-1',
      'content_migration',
      item,
      new Error('Rate limit exceeded: 429 Too Many Requests'),
    );

    // Rate limit remedy has high confidence and success count
    expect(result.action.action).toBe('auto_applied');
    expect(result.shouldRetry).toBe(true);
  });

  it('should escalate when no remedy matches', async () => {
    const item = makeItem({
      error: 'Completely unique error nobody has seen before xyz123',
    });

    const result = await engine.handleFailure(
      'mig-1',
      'content_migration',
      item,
      new Error('Completely unique error nobody has seen before xyz123'),
    );

    expect(result.action.action).toBe('escalated');
    expect(result.shouldRetry).toBe(false);
  });

  it('should trip circuit breaker after 3 failures', async () => {
    const item = makeItem({
      id: 'circuit-item',
      error: 'Completely unique error xyz',
    });

    // Fail 3 times on the same item
    for (let i = 0; i < CIRCUIT_BREAKER_LIMIT; i++) {
      await engine.handleFailure(
        'mig-1',
        'content_migration',
        item,
        new Error('Completely unique error xyz'),
      );
    }

    // 4th attempt should be circuit-broken
    const result = await engine.handleFailure(
      'mig-1',
      'content_migration',
      item,
      new Error('Completely unique error xyz'),
    );

    expect(result.action.action).toBe('escalated');
    expect(result.action.errorMessage).toContain('Circuit breaker');
    expect(result.shouldRetry).toBe(false);
  });

  it('should generate a healing report', async () => {
    const item1 = makeItem({ id: 'item-a', error: '429 Too Many Requests' });
    const item2 = makeItem({ id: 'item-b', error: 'Unknown mystery error' });

    await engine.handleFailure('mig-1', 'content_migration', item1, new Error('429 Too Many Requests'));
    await engine.handleFailure('mig-1', 'content_migration', item2, new Error('Unknown mystery error'));

    const report = engine.getHealingReport('mig-1');

    expect(report.migrationId).toBe('mig-1');
    expect(report.totalFailures).toBe(2);
    expect(report.actions.length).toBe(2);
    expect(report.topRemedies.length).toBeGreaterThan(0);
    expect(report.healingRate).toBeGreaterThanOrEqual(0);
    expect(report.healingRate).toBeLessThanOrEqual(1);
  });

  it('should return empty report for unknown migration', () => {
    const report = engine.getHealingReport('nonexistent');
    expect(report.totalFailures).toBe(0);
    expect(report.actions).toEqual([]);
  });

  it('should call onAutoApply callback for auto-applied fixes', async () => {
    let captured: HealingAction | null = null;
    const engine2 = new HealingEngine(undefined, undefined, {
      autoApplyEnabled: true,
      maxRetryAfterFix: 1,
      onAutoApply: (action) => { captured = action; },
    });

    const item = makeItem({ error: '429 Too Many Requests' });
    await engine2.handleFailure('mig-1', 'migration', item, new Error('429 Too Many Requests'));

    expect(captured).not.toBeNull();
    expect(captured!.action).toBe('auto_applied');
  });

  it('should call onEscalation callback for escalated items', async () => {
    let captured: HealingAction | null = null;
    const engine2 = new HealingEngine(undefined, undefined, {
      autoApplyEnabled: true,
      maxRetryAfterFix: 1,
      onEscalation: (action) => { captured = action; },
    });

    const item = makeItem({ error: 'Some random error nobody knows' });
    await engine2.handleFailure('mig-1', 'migration', item, new Error('Some random error nobody knows'));

    expect(captured).not.toBeNull();
    expect(captured!.action).toBe('escalated');
  });

  it('should approve a suggested action', async () => {
    // Create an engine where auto-apply is disabled so remedies get suggested
    const engine3 = new HealingEngine(undefined, undefined, {
      autoApplyEnabled: false,
    });

    const item = makeItem({ error: 'Dispatcher rule syntax error on line 42' });
    const result = await engine3.handleFailure(
      'mig-1',
      'code_modernization',
      item,
      new Error('Dispatcher rule syntax error on line 42'),
    );

    // When auto-apply is off, any match should be either suggested or escalated
    if (result.action.action === 'suggested') {
      const approved = await engine3.approveSuggestion('mig-1', result.action.id, 'admin');
      expect(approved).not.toBeNull();
      expect(approved!.result).toBe('success');
      expect(approved!.resolvedBy).toBe('admin');
    }
  });

  it('should reject a suggested action', async () => {
    const engine3 = new HealingEngine(undefined, undefined, {
      autoApplyEnabled: false,
    });

    const item = makeItem({ error: 'Dispatcher rule syntax error' });
    const result = await engine3.handleFailure(
      'mig-1',
      'code_modernization',
      item,
      new Error('Dispatcher rule syntax error'),
    );

    if (result.action.action === 'suggested') {
      const rejected = engine3.rejectSuggestion('mig-1', result.action.id, 'admin');
      expect(rejected).not.toBeNull();
      expect(rejected!.result).toBe('rejected');
    }
  });

  it('should get actions for a migration', async () => {
    const item = makeItem({ error: '429 rate limit' });
    await engine.handleFailure('mig-1', 'migration', item, new Error('429 rate limit'));

    const actions = engine.getActions('mig-1');
    expect(actions.length).toBe(1);
    expect(actions[0].migrationId).toBe('mig-1');
  });

  it('should expose the remedy library', () => {
    const lib = engine.getRemedyLibrary();
    expect(lib.size).toBe(10);
  });

  it('should record action timestamps', async () => {
    const item = makeItem({ error: '429 rate limit' });
    const result = await engine.handleFailure('mig-1', 'migration', item, new Error('429 rate limit'));

    expect(result.action.timestamp).toBeTruthy();
    const ts = new Date(result.action.timestamp);
    expect(ts.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should handle Error objects and string errors', async () => {
    const item = makeItem({ error: 'string error' });

    const result1 = await engine.handleFailure('mig-1', 'p', item, new Error('HTTP 500 Internal'));
    expect(result1.action.errorMessage).toBe('HTTP 500 Internal');

    const item2 = makeItem({ id: 'item-str', error: 'string' });
    const result2 = await engine.handleFailure('mig-1', 'p', item2, 'HTTP 502 Bad Gateway');
    expect(result2.action.errorMessage).toBe('HTTP 502 Bad Gateway');
  });
});
