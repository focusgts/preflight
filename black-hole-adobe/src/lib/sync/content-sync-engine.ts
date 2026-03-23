/**
 * Content Sync Engine
 *
 * Continuous content synchronization that eliminates content freeze
 * during migration. Authors keep working in the source system while
 * migration happens, and changes are automatically captured and replayed
 * in the target.
 *
 * NO COMPETITOR HAS THIS.
 */

import type {
  ContentSync,
  ContentChange,
  Conflict,
  SyncSourceConfig,
  SyncTargetConfig,
  SyncOptions,
  SyncStats,
  SnapshotItem,
  ContentSnapshot,
  SyncHealth,
} from '@/types/sync';
import {
  SyncStatus,
  ConflictStrategy,
  DetectionStrategy,
  SyncHealthLevel,
} from '@/types/sync';
import { ChangeDetector } from './change-detector';
import { ConflictResolver } from './conflict-resolver';

// ============================================================
// Types
// ============================================================

export type SyncEventType =
  | 'sync:started'
  | 'sync:stopped'
  | 'sync:paused'
  | 'sync:resumed'
  | 'sync:cycle_complete'
  | 'sync:changes_detected'
  | 'sync:changes_applied'
  | 'sync:conflict_detected'
  | 'sync:conflict_resolved'
  | 'sync:error';

export interface SyncEvent {
  type: SyncEventType;
  syncId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type SyncEventHandler = (event: SyncEvent) => void;

const DEFAULT_OPTIONS: SyncOptions = {
  interval: 300_000, // 5 minutes
  strategy: DetectionStrategy.POLLING,
  includePatterns: [],
  excludePatterns: [],
  conflictResolution: ConflictStrategy.SOURCE_WINS,
  batchSize: 100,
  autoStart: true,
};

// ============================================================
// Engine
// ============================================================

export class ContentSyncEngine {
  private syncs = new Map<string, ContentSync>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private snapshots = new Map<string, ContentSnapshot>();
  private eventHandlers: SyncEventHandler[] = [];

  private readonly changeDetector: ChangeDetector;
  private readonly conflictResolver: ConflictResolver;

  constructor(
    deps?: {
      changeDetector?: ChangeDetector;
      conflictResolver?: ConflictResolver;
    },
  ) {
    this.changeDetector = deps?.changeDetector ?? new ChangeDetector();
    this.conflictResolver = deps?.conflictResolver ?? new ConflictResolver();
  }

  // ── Event Emitter ─────────────────────────────────────────────────

  on(handler: SyncEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(event: SyncEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Event handlers must not break the sync engine
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Begin continuous content sync between source and target.
   */
  async startSync(
    sourceConfig: SyncSourceConfig,
    targetConfig: SyncTargetConfig,
    options?: Partial<SyncOptions>,
  ): Promise<ContentSync> {
    const opts: SyncOptions = { ...DEFAULT_OPTIONS, ...options };
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sync: ContentSync = {
      id: syncId,
      migrationId: '',
      status: SyncStatus.INITIALIZING,
      sourceConfig,
      targetConfig,
      options: opts,
      stats: this.createEmptyStats(),
      changeLog: [],
      conflicts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncAt: null,
    };

    this.syncs.set(syncId, sync);

    // Take initial snapshot of source
    const sourceItems = await this.fetchSourceItems(sourceConfig);
    const initialSnapshot = this.changeDetector.snapshot(sourceItems);
    this.snapshots.set(syncId, initialSnapshot);

    sync.status = SyncStatus.SYNCING;
    sync.updatedAt = new Date().toISOString();

    this.emit({
      type: 'sync:started',
      syncId,
      data: { sourceConfig, targetConfig },
      timestamp: new Date().toISOString(),
    });

    // Start polling if using polling strategy
    if (opts.strategy === DetectionStrategy.POLLING && opts.autoStart) {
      this.startPolling(syncId, opts.interval);
    }

    return sync;
  }

  /**
   * Stop syncing and clean up resources.
   */
  async stopSync(syncId: string): Promise<void> {
    const sync = this.getSync(syncId);
    this.stopPolling(syncId);
    sync.status = SyncStatus.STOPPED;
    sync.updatedAt = new Date().toISOString();

    this.emit({
      type: 'sync:stopped',
      syncId,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Pause syncing (preserves state, stops polling).
   */
  async pauseSync(syncId: string): Promise<void> {
    const sync = this.getSync(syncId);
    this.stopPolling(syncId);
    sync.status = SyncStatus.PAUSED;
    sync.updatedAt = new Date().toISOString();

    this.emit({
      type: 'sync:paused',
      syncId,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resume a paused sync.
   */
  async resumeSync(syncId: string): Promise<void> {
    const sync = this.getSync(syncId);
    if (sync.status !== SyncStatus.PAUSED) {
      throw new SyncError(`Cannot resume sync in ${sync.status} state`);
    }
    sync.status = SyncStatus.SYNCING;
    sync.updatedAt = new Date().toISOString();
    this.startPolling(syncId, sync.options.interval);

    this.emit({
      type: 'sync:resumed',
      syncId,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current sync status, stats, and health.
   */
  getSyncStatus(syncId: string): { sync: ContentSync; health: SyncHealth } {
    const sync = this.getSync(syncId);
    return { sync: { ...sync }, health: this.calculateHealth(sync) };
  }

  /**
   * Detect content changes since the last snapshot.
   */
  async detectChanges(syncId: string): Promise<ContentChange[]> {
    const sync = this.getSync(syncId);
    const previousSnapshot = this.snapshots.get(syncId);
    if (!previousSnapshot) {
      throw new SyncError(`No baseline snapshot for sync ${syncId}`);
    }

    const currentItems = await this.fetchSourceItems(sync.sourceConfig);
    const currentSnapshot = this.changeDetector.snapshot(currentItems);

    let changes = this.changeDetector.diff(previousSnapshot, currentSnapshot);

    // Apply include/exclude filters
    changes = this.changeDetector.filterChanges(changes, sync.options);

    // Update snapshot for next cycle
    this.snapshots.set(syncId, currentSnapshot);

    if (changes.length > 0) {
      this.emit({
        type: 'sync:changes_detected',
        syncId,
        data: { count: changes.length },
        timestamp: new Date().toISOString(),
      });
    }

    return changes;
  }

  /**
   * Apply detected changes to the target system.
   * Handles conflict detection if target also has changes.
   */
  async applyChanges(
    syncId: string,
    changes: ContentChange[],
  ): Promise<{ applied: number; conflicts: Conflict[]; errors: string[] }> {
    const sync = this.getSync(syncId);
    const errors: string[] = [];
    let applied = 0;

    // Detect target-side changes for conflict detection
    const targetItems = await this.fetchTargetItems(sync.targetConfig);
    const targetSnapshot = this.changeDetector.snapshot(targetItems);
    const previousTargetSnapshot = this.snapshots.get(`${syncId}-target`);

    let targetChanges: ContentChange[] = [];
    if (previousTargetSnapshot) {
      targetChanges = this.changeDetector.diff(previousTargetSnapshot, targetSnapshot);
    }
    this.snapshots.set(`${syncId}-target`, targetSnapshot);

    // Detect conflicts
    const conflicts = this.conflictResolver.detectConflicts(changes, targetChanges);

    if (conflicts.length > 0) {
      // Auto-resolve what we can
      this.conflictResolver.autoResolve(conflicts, sync.options.conflictResolution);
      sync.conflicts.push(...conflicts);
      sync.stats.totalConflicts += conflicts.length;
      sync.stats.totalConflictsResolved += conflicts.filter((c) => c.resolution !== null).length;

      for (const conflict of conflicts) {
        this.emit({
          type: conflict.resolution ? 'sync:conflict_resolved' : 'sync:conflict_detected',
          syncId,
          data: { conflictId: conflict.id, type: conflict.type },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Get the paths that have unresolved conflicts
    const conflictedPaths = new Set(
      conflicts
        .filter((c) => c.resolution === null)
        .map((c) => c.sourceChange.path),
    );

    // Apply non-conflicted changes
    const batch = changes.slice(0, sync.options.batchSize);
    for (const change of batch) {
      if (conflictedPaths.has(change.path)) continue;

      try {
        await this.writeToTarget(sync.targetConfig, change);
        change.synced = true;
        change.syncedAt = new Date().toISOString();
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        change.error = msg;
        errors.push(`${change.path}: ${msg}`);
        sync.stats.totalErrors++;
      }

      sync.changeLog.push(change);
    }

    // Also apply resolved conflict changes
    for (const conflict of conflicts) {
      if (!conflict.resolution) continue;
      try {
        await this.writeToTarget(sync.targetConfig, conflict.resolution.resolvedChange);
        conflict.resolution.resolvedChange.synced = true;
        conflict.resolution.resolvedChange.syncedAt = new Date().toISOString();
        applied++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`conflict ${conflict.id}: ${msg}`);
      }
    }

    sync.stats.totalChangesDetected += changes.length;
    sync.stats.totalChangesSynced += applied;
    sync.updatedAt = new Date().toISOString();

    this.emit({
      type: 'sync:changes_applied',
      syncId,
      data: { applied, errors: errors.length, conflicts: conflicts.length },
      timestamp: new Date().toISOString(),
    });

    return { applied, conflicts, errors };
  }

  /**
   * Resolve conflicts using the specified strategy, or flag for manual review.
   */
  resolveConflicts(
    syncId: string,
    conflictIds: string[],
    strategy: ConflictStrategy,
    notes?: string,
  ): Conflict[] {
    const sync = this.getSync(syncId);
    const toResolve = sync.conflicts.filter(
      (c) => conflictIds.includes(c.id) && c.resolution === null,
    );

    if (strategy === ConflictStrategy.MANUAL) {
      return this.conflictResolver.flagForReview(toResolve);
    }

    const resolved = this.conflictResolver.autoResolve(toResolve, strategy);

    // Apply notes if provided
    if (notes) {
      for (const c of resolved) {
        if (c.resolution) {
          c.resolution.notes = notes;
          c.resolvedBy = 'manual';
        }
      }
    }

    sync.stats.totalConflictsResolved += resolved.length;
    sync.updatedAt = new Date().toISOString();

    return resolved;
  }

  /**
   * Get the full change log for a sync session.
   */
  getChangeLog(syncId: string): ContentChange[] {
    const sync = this.getSync(syncId);
    return [...sync.changeLog];
  }

  /**
   * Get unresolved conflicts for a sync session.
   */
  getUnresolvedConflicts(syncId: string): Conflict[] {
    const sync = this.getSync(syncId);
    return sync.conflicts.filter((c) => c.resolution === null);
  }

  /**
   * Run a single sync cycle manually (detect + apply).
   */
  async runSyncCycle(syncId: string): Promise<void> {
    const sync = this.getSync(syncId);
    if (sync.status !== SyncStatus.SYNCING && sync.status !== SyncStatus.PAUSED) {
      throw new SyncError(`Cannot run sync cycle in ${sync.status} state`);
    }

    const start = Date.now();

    const changes = await this.detectChanges(syncId);
    if (changes.length > 0) {
      await this.applyChanges(syncId, changes);
    }

    const duration = Date.now() - start;
    sync.stats.syncCyclesCompleted++;
    sync.stats.lastSyncDurationMs = duration;
    sync.stats.averageSyncDurationMs = Math.round(
      (sync.stats.averageSyncDurationMs * (sync.stats.syncCyclesCompleted - 1) + duration) /
        sync.stats.syncCyclesCompleted,
    );
    sync.lastSyncAt = new Date().toISOString();
    sync.updatedAt = new Date().toISOString();

    this.emit({
      type: 'sync:cycle_complete',
      syncId,
      data: { changes: changes.length, durationMs: duration },
      timestamp: new Date().toISOString(),
    });
  }

  // ── Internal ──────────────────────────────────────────────────────

  private getSync(syncId: string): ContentSync {
    const sync = this.syncs.get(syncId);
    if (!sync) throw new SyncError(`Sync ${syncId} not found`);
    return sync;
  }

  private startPolling(syncId: string, intervalMs: number): void {
    this.stopPolling(syncId);
    const timer = setInterval(async () => {
      try {
        const sync = this.syncs.get(syncId);
        if (!sync || sync.status !== SyncStatus.SYNCING) {
          this.stopPolling(syncId);
          return;
        }
        await this.runSyncCycle(syncId);
      } catch (err) {
        this.emit({
          type: 'sync:error',
          syncId,
          data: { error: err instanceof Error ? err.message : String(err) },
          timestamp: new Date().toISOString(),
        });
      }
    }, intervalMs);
    this.timers.set(syncId, timer);
  }

  private stopPolling(syncId: string): void {
    const timer = this.timers.get(syncId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(syncId);
    }
  }

  private calculateHealth(sync: ContentSync): SyncHealth {
    const unresolvedConflicts = sync.conflicts.filter((c) => !c.resolution).length;
    const pendingChanges = sync.changeLog.filter((c) => !c.synced).length;
    const errorRate =
      sync.stats.totalChangesDetected > 0
        ? sync.stats.totalErrors / sync.stats.totalChangesDetected
        : 0;

    let level = SyncHealthLevel.HEALTHY;
    let message = 'Sync is running normally';

    if (errorRate > 0.1 || sync.status === SyncStatus.ERROR) {
      level = SyncHealthLevel.ERROR;
      message = `High error rate (${Math.round(errorRate * 100)}%) or sync in error state`;
    } else if (unresolvedConflicts > 5 || errorRate > 0.02 || pendingChanges > 50) {
      level = SyncHealthLevel.DEGRADED;
      message = `${unresolvedConflicts} unresolved conflicts, ${pendingChanges} pending changes`;
    }

    return { level, message, unresolvedConflicts, pendingChanges, errorRate };
  }

  private createEmptyStats(): SyncStats {
    return {
      totalChangesDetected: 0,
      totalChangesSynced: 0,
      totalConflicts: 0,
      totalConflictsResolved: 0,
      totalErrors: 0,
      averageSyncDurationMs: 0,
      lastSyncDurationMs: null,
      syncCyclesCompleted: 0,
    };
  }

  /**
   * Fetch content items from the source system.
   * In production, this would call the source CMS API.
   */
  protected async fetchSourceItems(
    _config: SyncSourceConfig,
  ): Promise<SnapshotItem[]> {
    // Override in subclass or mock for real connector integration
    return [];
  }

  /**
   * Fetch content items from the target system.
   */
  protected async fetchTargetItems(
    _config: SyncTargetConfig,
  ): Promise<SnapshotItem[]> {
    return [];
  }

  /**
   * Write a change to the target system.
   */
  protected async writeToTarget(
    _config: SyncTargetConfig,
    _change: ContentChange,
  ): Promise<void> {
    // Override in subclass or mock for real connector integration
  }
}

// ============================================================
// Error Class
// ============================================================

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}
