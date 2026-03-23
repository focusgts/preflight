/**
 * Content Sync — Unit Tests
 *
 * Tests for change detection, conflict resolution, sync engine,
 * and cutover management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetector } from '@/lib/sync/change-detector';
import { ConflictResolver } from '@/lib/sync/conflict-resolver';
import { ContentSyncEngine } from '@/lib/sync/content-sync-engine';
import { CutoverManager } from '@/lib/sync/cutover-manager';
import type { SnapshotItem, ContentChange, Conflict, ContentSnapshot } from '@/types/sync';
import {
  ChangeType,
  ConflictType,
  ConflictStrategy,
  SyncStatus,
  CutoverStepStatus,
  DetectionStrategy,
} from '@/types/sync';

// ── Helpers ─────────────────────────────────────────────────────────

function makeItem(path: string, type: string, meta: Record<string, unknown> = {}): SnapshotItem {
  return {
    path,
    hash: '',
    type,
    lastModified: new Date().toISOString(),
    metadata: meta,
  };
}

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

// ── ChangeDetector ──────────────────────────────────────────────────

describe('ChangeDetector', () => {
  let detector: ChangeDetector;

  beforeEach(() => {
    detector = new ChangeDetector();
  });

  it('should create a snapshot with hashes', () => {
    const items = [makeItem('/content/page-1', 'page'), makeItem('/content/page-2', 'page')];
    const snap = detector.snapshot(items);

    expect(snap.id).toBeTruthy();
    expect(snap.items).toHaveLength(2);
    expect(snap.items[0].hash).toBeTruthy();
    expect(snap.items[1].hash).toBeTruthy();
  });

  it('should detect added items', () => {
    const snapA = detector.snapshot([makeItem('/content/page-1', 'page')]);
    const snapB = detector.snapshot([
      makeItem('/content/page-1', 'page'),
      makeItem('/content/page-2', 'page'),
    ]);

    const changes = detector.diff(snapA, snapB);
    const additions = changes.filter((c) => c.type === ChangeType.PAGE_CREATED);
    expect(additions).toHaveLength(1);
    expect(additions[0].path).toBe('/content/page-2');
  });

  it('should detect deleted items', () => {
    const snapA = detector.snapshot([
      makeItem('/content/page-1', 'page'),
      makeItem('/content/page-2', 'page'),
    ]);
    const snapB = detector.snapshot([makeItem('/content/page-1', 'page')]);

    const changes = detector.diff(snapA, snapB);
    const deletions = changes.filter((c) => c.type === ChangeType.PAGE_DELETED);
    expect(deletions).toHaveLength(1);
    expect(deletions[0].path).toBe('/content/page-2');
  });

  it('should detect modified items via hash change', () => {
    const item1 = makeItem('/content/page-1', 'page', { title: 'Old' });
    const item1b = makeItem('/content/page-1', 'page', { title: 'New' });

    const snapA = detector.snapshot([item1]);
    const snapB = detector.snapshot([item1b]);

    const changes = detector.diff(snapA, snapB);
    const mods = changes.filter((c) => c.type === ChangeType.PAGE_MODIFIED);
    expect(mods).toHaveLength(1);
    expect(mods[0].path).toBe('/content/page-1');
  });

  it('should detect moved items (same hash, different path)', () => {
    const item = makeItem('/content/old-path', 'page', { title: 'Page' });
    const movedItem = makeItem('/content/new-path', 'page', { title: 'Page' });

    const snapA = detector.snapshot([item]);
    // Manually set the same hash for the moved item
    const snapB = detector.snapshot([movedItem]);
    snapB.items[0].hash = snapA.items[0].hash;

    const changes = detector.diff(snapA, snapB);
    const moves = changes.filter((c) => c.type === ChangeType.PAGE_MOVED);
    expect(moves).toHaveLength(1);
  });

  it('should detect asset deletions', () => {
    const snapA = detector.snapshot([makeItem('/content/dam/image.png', 'asset')]);
    const snapB = detector.snapshot([]);

    const changes = detector.diff(snapA, snapB);
    expect(changes[0].type).toBe(ChangeType.ASSET_DELETED);
  });

  it('should detect asset uploads', () => {
    const snapA = detector.snapshot([]);
    const snapB = detector.snapshot([makeItem('/content/dam/new-image.png', 'asset')]);

    const changes = detector.diff(snapA, snapB);
    expect(changes[0].type).toBe(ChangeType.ASSET_UPLOADED);
  });

  it('should produce consistent hashes for the same content', () => {
    const item = makeItem('/content/page-1', 'page', { title: 'Test' });
    const hash1 = detector.hashContent(item);
    const hash2 = detector.hashContent(item);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const item1 = makeItem('/content/page-1', 'page', { title: 'Test A' });
    const item2 = makeItem('/content/page-1', 'page', { title: 'Test B' });
    expect(detector.hashContent(item1)).not.toBe(detector.hashContent(item2));
  });

  it('should categorize deletions as high priority', () => {
    const change = makeChange(ChangeType.PAGE_DELETED, '/content/page-1');
    const cat = detector.categorizeChange(change);
    expect(cat.priority).toBe('high');
  });

  it('should categorize moves as critical', () => {
    const change = makeChange(ChangeType.PAGE_MOVED, '/content/page-1');
    const cat = detector.categorizeChange(change);
    expect(cat.priority).toBe('critical');
  });

  it('should categorize tags as metadata/low', () => {
    const change = makeChange(ChangeType.TAG_ADDED, '/content/page-1');
    const cat = detector.categorizeChange(change);
    expect(cat.category).toBe('metadata');
    expect(cat.priority).toBe('low');
  });

  it('should filter changes by include patterns', () => {
    const changes = [
      makeChange(ChangeType.PAGE_MODIFIED, '/content/en/about'),
      makeChange(ChangeType.PAGE_MODIFIED, '/content/fr/about'),
    ];
    const filtered = detector.filterChanges(changes, {
      includePatterns: ['/content/en/**'],
      excludePatterns: [],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe('/content/en/about');
  });

  it('should filter changes by exclude patterns', () => {
    const changes = [
      makeChange(ChangeType.PAGE_MODIFIED, '/content/en/about'),
      makeChange(ChangeType.PAGE_MODIFIED, '/content/en/tmp/draft'),
    ];
    const filtered = detector.filterChanges(changes, {
      includePatterns: [],
      excludePatterns: ['/content/en/tmp/**'],
    });
    expect(filtered).toHaveLength(1);
  });

  it('should return no changes for identical snapshots', () => {
    const items = [makeItem('/content/page-1', 'page')];
    const snap = detector.snapshot(items);
    const changes = detector.diff(snap, snap);
    expect(changes).toHaveLength(0);
  });
});

// ── ConflictResolver ────────────────────────────────────────────────

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  it('should detect both_modified conflicts', () => {
    const source = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-1', { title: 'A' }, { title: 'B' })];
    const target = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-1', { title: 'A' }, { title: 'C' })];

    const conflicts = resolver.detectConflicts(source, target);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.BOTH_MODIFIED);
  });

  it('should detect source_deleted_target_modified conflicts', () => {
    const source = [makeChange(ChangeType.PAGE_DELETED, '/content/page-1', { title: 'A' }, null)];
    const target = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-1', { title: 'A' }, { title: 'B' })];

    const conflicts = resolver.detectConflicts(source, target);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.SOURCE_DELETED_TARGET_MODIFIED);
  });

  it('should detect target_deleted_source_modified conflicts', () => {
    const source = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-1', { title: 'A' }, { title: 'B' })];
    const target = [makeChange(ChangeType.PAGE_DELETED, '/content/page-1', { title: 'A' }, null)];

    const conflicts = resolver.detectConflicts(source, target);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.TARGET_DELETED_SOURCE_MODIFIED);
  });

  it('should detect both_created_same_path conflicts', () => {
    const source = [makeChange(ChangeType.PAGE_CREATED, '/content/page-new', null, { title: 'Source' })];
    const target = [makeChange(ChangeType.PAGE_CREATED, '/content/page-new', null, { title: 'Target' })];

    const conflicts = resolver.detectConflicts(source, target);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe(ConflictType.BOTH_CREATED_SAME_PATH);
  });

  it('should auto-resolve with source_wins strategy', () => {
    const conflicts: Conflict[] = [{
      id: 'c1', type: ConflictType.BOTH_MODIFIED, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: false,
      sourceChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', { t: 'A' }, { t: 'B' }),
      targetChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', { t: 'A' }, { t: 'C' }),
    }];

    const resolved = resolver.autoResolve(conflicts, ConflictStrategy.SOURCE_WINS);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolution?.strategy).toBe(ConflictStrategy.SOURCE_WINS);
    expect(resolved[0].resolvedBy).toBe('auto');
  });

  it('should auto-resolve with target_wins strategy', () => {
    const conflicts: Conflict[] = [{
      id: 'c1', type: ConflictType.BOTH_MODIFIED, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: false,
      sourceChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', { t: 'A' }, { t: 'B' }),
      targetChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', { t: 'A' }, { t: 'C' }),
    }];

    const resolved = resolver.autoResolve(conflicts, ConflictStrategy.TARGET_WINS);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolution?.strategy).toBe(ConflictStrategy.TARGET_WINS);
  });

  it('should merge non-overlapping field changes', () => {
    const sourceChange = makeChange(ChangeType.PAGE_MODIFIED, '/p', { title: 'Old', desc: 'Same' }, { title: 'New', desc: 'Same' });
    const targetChange = makeChange(ChangeType.PAGE_MODIFIED, '/p', { title: 'Old', desc: 'Same' }, { title: 'Old', desc: 'Updated' });

    const merged = resolver.mergeChanges(sourceChange, targetChange);
    expect(merged).not.toBeNull();
    expect(merged!.after!['title']).toBe('New');
    expect(merged!.after!['desc']).toBe('Updated');
  });

  it('should fail merge for overlapping field changes', () => {
    const sourceChange = makeChange(ChangeType.PAGE_MODIFIED, '/p', { title: 'Old' }, { title: 'A' });
    const targetChange = makeChange(ChangeType.PAGE_MODIFIED, '/p', { title: 'Old' }, { title: 'B' });

    const merged = resolver.mergeChanges(sourceChange, targetChange);
    expect(merged).toBeNull();
  });

  it('should flag conflicts for manual review', () => {
    const conflicts: Conflict[] = [{
      id: 'c1', type: ConflictType.BOTH_MODIFIED, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: false,
      sourceChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', {}, {}),
      targetChange: makeChange(ChangeType.PAGE_MODIFIED, '/p', {}, {}),
    }];

    const flagged = resolver.flagForReview(conflicts);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].flaggedForReview).toBe(true);
  });

  it('should generate a conflict report', () => {
    const conflicts: Conflict[] = [
      { id: 'c1', type: ConflictType.BOTH_MODIFIED, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: false, sourceChange: makeChange(ChangeType.PAGE_MODIFIED, '/a', {}, {}), targetChange: makeChange(ChangeType.PAGE_MODIFIED, '/a', {}, {}) },
      { id: 'c2', type: ConflictType.BOTH_CREATED_SAME_PATH, resolution: { strategy: ConflictStrategy.SOURCE_WINS, resolvedChange: makeChange(ChangeType.PAGE_CREATED, '/b', null, {}), notes: null }, resolvedBy: 'auto', resolvedAt: new Date().toISOString(), flaggedForReview: false, sourceChange: makeChange(ChangeType.PAGE_CREATED, '/b', null, {}), targetChange: makeChange(ChangeType.PAGE_CREATED, '/b', null, {}) },
    ];

    const report = resolver.getConflictReport('sync-1', conflicts);
    expect(report.totalConflicts).toBe(2);
    expect(report.resolved).toBe(1);
    expect(report.unresolved).toBe(1);
    expect(report.byType[ConflictType.BOTH_MODIFIED]).toBe(1);
  });

  it('should not detect conflicts when paths do not overlap', () => {
    const source = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-1')];
    const target = [makeChange(ChangeType.PAGE_MODIFIED, '/content/page-2')];

    const conflicts = resolver.detectConflicts(source, target);
    expect(conflicts).toHaveLength(0);
  });
});

// ── ContentSyncEngine ───────────────────────────────────────────────

describe('ContentSyncEngine', () => {
  let engine: ContentSyncEngine;

  beforeEach(() => {
    engine = new ContentSyncEngine();
  });

  it('should start a sync session', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://source', credentials: null, basePath: '/content' },
      { platform: 'aem_cloud', url: 'http://target', credentials: null, basePath: '/content' },
      { autoStart: false },
    );

    expect(sync.id).toBeTruthy();
    expect(sync.status).toBe(SyncStatus.SYNCING);
    expect(sync.stats.totalChangesDetected).toBe(0);
  });

  it('should stop a sync session', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://source', credentials: null, basePath: '/content' },
      { platform: 'aem_cloud', url: 'http://target', credentials: null, basePath: '/content' },
      { autoStart: false },
    );

    await engine.stopSync(sync.id);
    const { sync: updated } = engine.getSyncStatus(sync.id);
    expect(updated.status).toBe(SyncStatus.STOPPED);
  });

  it('should pause and resume a sync session', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://source', credentials: null, basePath: '/content' },
      { platform: 'aem_cloud', url: 'http://target', credentials: null, basePath: '/content' },
      { autoStart: false },
    );

    await engine.pauseSync(sync.id);
    expect(engine.getSyncStatus(sync.id).sync.status).toBe(SyncStatus.PAUSED);

    await engine.resumeSync(sync.id);
    expect(engine.getSyncStatus(sync.id).sync.status).toBe(SyncStatus.SYNCING);
  });

  it('should throw for unknown sync ID', () => {
    expect(() => engine.getSyncStatus('nonexistent')).toThrow();
  });

  it('should emit events on start/stop', async () => {
    const events: string[] = [];
    engine.on((e) => events.push(e.type));

    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );
    await engine.stopSync(sync.id);

    expect(events).toContain('sync:started');
    expect(events).toContain('sync:stopped');
  });

  it('should return empty change log initially', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );
    expect(engine.getChangeLog(sync.id)).toHaveLength(0);
  });

  it('should calculate healthy status when no errors', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );
    const { health } = engine.getSyncStatus(sync.id);
    expect(health.level).toBe('healthy');
  });
});

// ── CutoverManager ──────────────────────────────────────────────────

describe('CutoverManager', () => {
  let engine: ContentSyncEngine;
  let cutover: CutoverManager;

  beforeEach(() => {
    engine = new ContentSyncEngine();
    cutover = new CutoverManager(engine);
  });

  it('should generate a cutover plan', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );

    const plan = cutover.planCutover(sync.id);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.estimatedDurationMinutes).toBeGreaterThan(0);
    expect(plan.rollbackSteps.length).toBeGreaterThan(0);
    expect(plan.status).toBe(CutoverStepStatus.PENDING);
  });

  it('should execute cutover steps sequentially', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );

    const plan = cutover.planCutover(sync.id);
    const result = await cutover.executeCutover(plan);
    expect(result.status).toBe(CutoverStepStatus.COMPLETED);
    expect(result.steps.every((s) => s.status === CutoverStepStatus.COMPLETED)).toBe(true);
  });

  it('should validate a successful cutover', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );

    const plan = cutover.planCutover(sync.id);
    await cutover.executeCutover(plan);

    const validation = await cutover.validateCutover(plan);
    expect(validation.checks.length).toBeGreaterThan(0);
    expect(validation.overallScore).toBeGreaterThan(0);
  });

  it('should report progress during cutover', async () => {
    const sync = await engine.startSync(
      { platform: 'aem', url: 'http://s', credentials: null, basePath: '/' },
      { platform: 'aem', url: 'http://t', credentials: null, basePath: '/' },
      { autoStart: false },
    );

    const plan = cutover.planCutover(sync.id);
    const progressUpdates: number[] = [];

    await cutover.executeCutover(plan, (_step, pct) => {
      progressUpdates.push(pct);
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });
});
