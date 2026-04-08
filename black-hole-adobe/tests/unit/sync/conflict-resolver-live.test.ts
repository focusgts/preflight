/**
 * Conflict Resolver — Controlled Harness Tests
 *
 * Fulfills sandbox-validation-plan Test 3.3 without requiring a live AEM
 * instance. Exercises ConflictResolver strategies directly and integrates
 * with ContentSyncEngine via a subclass that stubs fetchSourceItems /
 * fetchTargetItems with in-memory data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictResolver } from '@/lib/sync/conflict-resolver';
import { ContentSyncEngine } from '@/lib/sync/content-sync-engine';
import type {
  SnapshotItem,
  ContentChange,
  SyncSourceConfig,
  SyncTargetConfig,
} from '@/types/sync';
import {
  ChangeType,
  ConflictStrategy,
  ConflictType,
  DetectionStrategy,
} from '@/types/sync';

// ── Helpers ─────────────────────────────────────────────────────────

function makeChange(
  type: ChangeType,
  path: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
): ContentChange {
  return {
    id: `chg-${Math.random().toString(36).slice(2)}`,
    type,
    path,
    before,
    after,
    timestamp: new Date().toISOString(),
    hash: `h-${Math.random().toString(36).slice(2)}`,
    synced: false,
    syncedAt: null,
    error: null,
  };
}

function makeItem(
  path: string,
  title: string,
  extra: Record<string, unknown> = {},
): SnapshotItem {
  return {
    path,
    hash: '',
    type: 'cq:Page',
    lastModified: new Date().toISOString(),
    metadata: {
      'jcr:primaryType': 'cq:Page',
      'jcr:title': title,
      ...extra,
    },
  };
}

/**
 * Test double for ContentSyncEngine that replaces AEM network calls
 * with in-memory snapshot lists. Also counts target writes so we can
 * assert which resolved-change payload was written.
 */
class HarnessSyncEngine extends ContentSyncEngine {
  public sourceItems: SnapshotItem[] = [];
  public targetItems: SnapshotItem[] = [];
  public writes: Array<{ path: string; change: ContentChange }> = [];

  setSource(items: SnapshotItem[]): void {
    this.sourceItems = items;
  }

  setTarget(items: SnapshotItem[]): void {
    this.targetItems = items;
  }

  protected async fetchSourceItems(
    _config: SyncSourceConfig,
  ): Promise<SnapshotItem[]> {
    return this.sourceItems;
  }

  protected async fetchTargetItems(
    _config: SyncTargetConfig,
  ): Promise<SnapshotItem[]> {
    return this.targetItems;
  }

  protected async writeToTarget(
    _config: SyncTargetConfig,
    change: ContentChange,
  ): Promise<void> {
    this.writes.push({ path: change.path, change });
  }
}

// ── ConflictResolver strategies ─────────────────────────────────────

describe('ConflictResolver — strategy matrix (Test 3.3)', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('both-modified conflicts', () => {
    const path = '/content/site/page-a';
    const before = { 'jcr:title': 'Original' };
    const sourceAfter = { 'jcr:title': 'Source Edit' };
    const targetAfter = { 'jcr:title': 'Target Edit' };

    function buildConflicts() {
      const sourceChange = makeChange(ChangeType.PAGE_MODIFIED, path, before, sourceAfter);
      const targetChange = makeChange(ChangeType.PAGE_MODIFIED, path, before, targetAfter);
      return resolver.detectConflicts([sourceChange], [targetChange]);
    }

    it('SOURCE_WINS picks the source version', () => {
      const conflicts = buildConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.BOTH_MODIFIED);

      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.SOURCE_WINS);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolution?.strategy).toBe(ConflictStrategy.SOURCE_WINS);
      expect(resolved[0].resolution?.resolvedChange.after).toEqual(sourceAfter);
      expect(resolved[0].resolvedBy).toBe('auto');
      expect(resolved[0].flaggedForReview).toBe(false);
    });

    it('TARGET_WINS picks the target version', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.TARGET_WINS);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolution?.strategy).toBe(ConflictStrategy.TARGET_WINS);
      expect(resolved[0].resolution?.resolvedChange.after).toEqual(targetAfter);
    });

    it('MANUAL leaves the conflict unresolved and flags it for review', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.MANUAL);

      expect(resolved).toHaveLength(0);
      expect(conflicts[0].resolution).toBeNull();
      expect(conflicts[0].flaggedForReview).toBe(true);
      expect(conflicts[0].resolvedBy).toBeNull();
    });
  });

  describe('delete-vs-modify conflicts', () => {
    const path = '/content/site/page-b';
    const before = { 'jcr:title': 'Original' };

    function buildConflicts() {
      const sourceChange = makeChange(ChangeType.PAGE_DELETED, path, before, null);
      const targetChange = makeChange(
        ChangeType.PAGE_MODIFIED,
        path,
        before,
        { 'jcr:title': 'Target Edit' },
      );
      return resolver.detectConflicts([sourceChange], [targetChange]);
    }

    it('classifies as SOURCE_DELETED_TARGET_MODIFIED', () => {
      const conflicts = buildConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe(ConflictType.SOURCE_DELETED_TARGET_MODIFIED);
    });

    it('SOURCE_WINS resolves to the delete', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.SOURCE_WINS);
      expect(resolved[0].resolution?.resolvedChange.type).toBe(ChangeType.PAGE_DELETED);
    });

    it('TARGET_WINS keeps the target modification', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.TARGET_WINS);
      expect(resolved[0].resolution?.resolvedChange.type).toBe(ChangeType.PAGE_MODIFIED);
      expect(resolved[0].resolution?.resolvedChange.after).toEqual({ 'jcr:title': 'Target Edit' });
    });

    it('MANUAL flags for review without resolution', () => {
      const conflicts = buildConflicts();
      resolver.autoResolve(conflicts, ConflictStrategy.MANUAL);
      expect(conflicts[0].resolution).toBeNull();
      expect(conflicts[0].flaggedForReview).toBe(true);
    });
  });

  describe('both-modified with different field values', () => {
    const path = '/content/site/page-c';
    const before = { 'jcr:title': 'Original', description: 'Orig desc' };

    function buildConflicts() {
      const sourceChange = makeChange(ChangeType.PAGE_MODIFIED, path, before, {
        'jcr:title': 'Source Title',
        description: 'Source desc',
      });
      const targetChange = makeChange(ChangeType.PAGE_MODIFIED, path, before, {
        'jcr:title': 'Target Title',
        description: 'Target desc',
      });
      return resolver.detectConflicts([sourceChange], [targetChange]);
    }

    it('SOURCE_WINS preserves all source fields', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.SOURCE_WINS);
      expect(resolved[0].resolution?.resolvedChange.after).toEqual({
        'jcr:title': 'Source Title',
        description: 'Source desc',
      });
    });

    it('TARGET_WINS preserves all target fields', () => {
      const conflicts = buildConflicts();
      const resolved = resolver.autoResolve(conflicts, ConflictStrategy.TARGET_WINS);
      expect(resolved[0].resolution?.resolvedChange.after).toEqual({
        'jcr:title': 'Target Title',
        description: 'Target desc',
      });
    });

    it('MANUAL defers resolution', () => {
      const conflicts = buildConflicts();
      resolver.autoResolve(conflicts, ConflictStrategy.MANUAL);
      expect(conflicts[0].flaggedForReview).toBe(true);
      expect(conflicts[0].resolution).toBeNull();
    });
  });
});

// ── ContentSyncEngine integration with stubbed fetches ──────────────

describe('ContentSyncEngine — conflict dispatch integration (Test 3.3)', () => {
  const sourceConfig: SyncSourceConfig = {
    platform: 'aem',
    url: 'http://source.local',
    credentials: null,
    basePath: '/content/site',
  };
  const targetConfig: SyncTargetConfig = {
    platform: 'aem',
    url: 'http://target.local',
    credentials: null,
    basePath: '/content/site',
  };
  const path = '/content/site/page-x';

  async function setupEngine(strategy: ConflictStrategy) {
    const engine = new HarnessSyncEngine();

    // Initial source snapshot (taken inside startSync) reflects "Original".
    engine.setSource([makeItem(path, 'Original')]);
    engine.setTarget([makeItem(path, 'Original')]);

    const sync = await engine.startSync(sourceConfig, targetConfig, {
      strategy: DetectionStrategy.POLLING,
      autoStart: false,
      conflictResolution: strategy,
      interval: 60_000,
    });

    // Baseline cycle: add a throwaway page on source so detectChanges
    // reports > 0 changes, which forces applyChanges to run and seeds the
    // target-side snapshot used for future conflict detection.
    engine.setSource([
      makeItem(path, 'Original'),
      makeItem('/content/site/baseline-seed', 'seed'),
    ]);
    await engine.runSyncCycle(sync.id);

    // Now diverge on the same path: source edits to "Source Edit",
    // target edits to "Target Edit".
    engine.setSource([
      makeItem(path, 'Source Edit'),
      makeItem('/content/site/baseline-seed', 'seed'),
    ]);
    engine.setTarget([
      makeItem(path, 'Target Edit'),
      makeItem('/content/site/baseline-seed', 'seed'),
    ]);

    return { engine, syncId: sync.id };
  }

  it('SOURCE_WINS: conflict detected, source payload written to target', async () => {
    const { engine, syncId } = await setupEngine(ConflictStrategy.SOURCE_WINS);
    engine.writes = [];

    await engine.runSyncCycle(syncId);

    const { sync } = engine.getSyncStatus(syncId);
    expect(sync.conflicts).toHaveLength(1);
    expect(sync.conflicts[0].type).toBe(ConflictType.BOTH_MODIFIED);
    expect(sync.conflicts[0].resolution?.strategy).toBe(ConflictStrategy.SOURCE_WINS);
    expect(sync.conflicts[0].resolvedBy).toBe('auto');

    const resolvedWrite = engine.writes.find((w) => w.path === path);
    expect(resolvedWrite).toBeDefined();
    expect(resolvedWrite!.change.after).toMatchObject({ 'jcr:title': 'Source Edit' });
  });

  it('TARGET_WINS: conflict resolved to target payload', async () => {
    const { engine, syncId } = await setupEngine(ConflictStrategy.TARGET_WINS);
    engine.writes = [];

    await engine.runSyncCycle(syncId);

    const { sync } = engine.getSyncStatus(syncId);
    expect(sync.conflicts).toHaveLength(1);
    expect(sync.conflicts[0].resolution?.strategy).toBe(ConflictStrategy.TARGET_WINS);
    expect(sync.conflicts[0].resolution?.resolvedChange.after).toMatchObject({
      'jcr:title': 'Target Edit',
    });
  });

  it('MANUAL: conflict is detected but left unresolved and flagged for review', async () => {
    const { engine, syncId } = await setupEngine(ConflictStrategy.MANUAL);
    engine.writes = [];

    await engine.runSyncCycle(syncId);

    const { sync } = engine.getSyncStatus(syncId);
    expect(sync.conflicts).toHaveLength(1);
    expect(sync.conflicts[0].resolution).toBeNull();
    expect(sync.conflicts[0].flaggedForReview).toBe(true);

    const unresolved = engine.getUnresolvedConflicts(syncId);
    expect(unresolved).toHaveLength(1);

    // The conflicted path must not have been written under MANUAL strategy.
    const resolvedWrite = engine.writes.find((w) => w.path === path);
    expect(resolvedWrite).toBeUndefined();
  });
});
