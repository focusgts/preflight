/**
 * Conflict Resolution Engine
 *
 * Detects and resolves conflicts when both source and target systems
 * have changes to the same content during continuous sync.
 */

import type {
  ContentChange,
  Conflict,
  ConflictResolution,
} from '@/types/sync';
import { ChangeType, ConflictType, ConflictStrategy } from '@/types/sync';

export interface ConflictReport {
  syncId: string;
  totalConflicts: number;
  resolved: number;
  unresolved: number;
  autoResolved: number;
  manuallyResolved: number;
  byType: Record<ConflictType, number>;
  conflicts: Conflict[];
}

export class ConflictResolver {
  /**
   * Detect conflicts between source changes and target changes.
   * A conflict occurs when both systems modified the same content path.
   */
  detectConflicts(
    sourceChanges: ContentChange[],
    targetChanges: ContentChange[],
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const targetByPath = new Map<string, ContentChange[]>();

    for (const tc of targetChanges) {
      const existing = targetByPath.get(tc.path) ?? [];
      existing.push(tc);
      targetByPath.set(tc.path, existing);
    }

    for (const sc of sourceChanges) {
      const targetForPath = targetByPath.get(sc.path);
      if (!targetForPath || targetForPath.length === 0) continue;

      for (const tc of targetForPath) {
        const conflictType = this.classifyConflict(sc, tc);
        if (conflictType === null) continue;

        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sourceChange: sc,
          targetChange: tc,
          type: conflictType,
          resolution: null,
          resolvedBy: null,
          resolvedAt: null,
          flaggedForReview: false,
        });
      }
    }

    return conflicts;
  }

  /**
   * Auto-resolve conflicts using the specified strategy.
   * Returns the list of resolved conflicts.
   */
  autoResolve(
    conflicts: Conflict[],
    strategy: ConflictStrategy,
  ): Conflict[] {
    const resolved: Conflict[] = [];

    for (const conflict of conflicts) {
      if (conflict.resolution !== null) continue;

      let resolution: ConflictResolution | null = null;

      switch (strategy) {
        case ConflictStrategy.SOURCE_WINS:
          resolution = this.resolveSourceWins(conflict);
          break;

        case ConflictStrategy.TARGET_WINS:
          resolution = this.resolveTargetWins(conflict);
          break;

        case ConflictStrategy.MERGE:
          resolution = this.attemptMerge(conflict);
          break;

        case ConflictStrategy.MANUAL:
          // Flag for manual review instead of auto-resolving
          conflict.flaggedForReview = true;
          continue;
      }

      if (resolution) {
        conflict.resolution = resolution;
        conflict.resolvedBy = 'auto';
        conflict.resolvedAt = new Date().toISOString();
        resolved.push(conflict);
      } else {
        // Could not auto-resolve; flag for manual review
        conflict.flaggedForReview = true;
      }
    }

    return resolved;
  }

  /**
   * Flag conflicts for human review.
   */
  flagForReview(conflicts: Conflict[]): Conflict[] {
    for (const conflict of conflicts) {
      if (conflict.resolution === null) {
        conflict.flaggedForReview = true;
      }
    }
    return conflicts.filter((c) => c.flaggedForReview);
  }

  /**
   * Attempt to merge non-conflicting field-level changes.
   * If the same fields were modified, merge fails and returns null.
   */
  mergeChanges(
    sourceChange: ContentChange,
    targetChange: ContentChange,
  ): ContentChange | null {
    if (!sourceChange.after || !targetChange.after) return null;
    if (!sourceChange.before || !targetChange.before) return null;

    const sourceFields = this.getChangedFields(sourceChange.before, sourceChange.after);
    const targetFields = this.getChangedFields(targetChange.before, targetChange.after);

    // Check for overlapping field changes
    const overlapping = sourceFields.filter((f) => targetFields.includes(f));
    if (overlapping.length > 0) {
      // Cannot auto-merge if the same fields were changed
      return null;
    }

    // Merge: start with source.after, overlay target field changes
    const merged: Record<string, unknown> = { ...sourceChange.after };
    for (const field of targetFields) {
      merged[field] = targetChange.after[field];
    }

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: sourceChange.type,
      path: sourceChange.path,
      before: sourceChange.before,
      after: merged,
      timestamp: new Date().toISOString(),
      hash: `merged-${sourceChange.hash}-${targetChange.hash}`,
      synced: false,
      syncedAt: null,
      error: null,
    };
  }

  /**
   * Generate a summary report of all conflicts for a sync session.
   */
  getConflictReport(syncId: string, conflicts: Conflict[]): ConflictReport {
    const byType: Record<ConflictType, number> = {
      [ConflictType.BOTH_MODIFIED]: 0,
      [ConflictType.SOURCE_DELETED_TARGET_MODIFIED]: 0,
      [ConflictType.TARGET_DELETED_SOURCE_MODIFIED]: 0,
      [ConflictType.BOTH_CREATED_SAME_PATH]: 0,
    };

    let resolved = 0;
    let autoResolved = 0;
    let manuallyResolved = 0;

    for (const c of conflicts) {
      byType[c.type]++;
      if (c.resolution) {
        resolved++;
        if (c.resolvedBy === 'auto') autoResolved++;
        if (c.resolvedBy === 'manual') manuallyResolved++;
      }
    }

    return {
      syncId,
      totalConflicts: conflicts.length,
      resolved,
      unresolved: conflicts.length - resolved,
      autoResolved,
      manuallyResolved,
      byType,
      conflicts,
    };
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private classifyConflict(
    source: ContentChange,
    target: ContentChange,
  ): ConflictType | null {
    const sourceIsDelete = this.isDeleteChange(source);
    const targetIsDelete = this.isDeleteChange(target);
    const sourceIsCreate = this.isCreateChange(source);
    const targetIsCreate = this.isCreateChange(target);

    // Both created at the same path
    if (sourceIsCreate && targetIsCreate) {
      return ConflictType.BOTH_CREATED_SAME_PATH;
    }

    // Source deleted, target modified
    if (sourceIsDelete && !targetIsDelete) {
      return ConflictType.SOURCE_DELETED_TARGET_MODIFIED;
    }

    // Target deleted, source modified
    if (!sourceIsDelete && targetIsDelete) {
      return ConflictType.TARGET_DELETED_SOURCE_MODIFIED;
    }

    // Both modified
    if (!sourceIsDelete && !targetIsDelete && !sourceIsCreate && !targetIsCreate) {
      return ConflictType.BOTH_MODIFIED;
    }

    return null;
  }

  private isDeleteChange(change: ContentChange): boolean {
    return (
      change.type === ChangeType.PAGE_DELETED ||
      change.type === ChangeType.ASSET_DELETED ||
      change.type === ChangeType.TAG_REMOVED
    );
  }

  private isCreateChange(change: ContentChange): boolean {
    return (
      change.type === ChangeType.PAGE_CREATED ||
      change.type === ChangeType.ASSET_UPLOADED ||
      change.type === ChangeType.TAG_ADDED
    );
  }

  private resolveSourceWins(conflict: Conflict): ConflictResolution {
    return {
      strategy: ConflictStrategy.SOURCE_WINS,
      resolvedChange: conflict.sourceChange,
      notes: 'Auto-resolved: source wins (source is authority during migration)',
    };
  }

  private resolveTargetWins(conflict: Conflict): ConflictResolution {
    return {
      strategy: ConflictStrategy.TARGET_WINS,
      resolvedChange: conflict.targetChange,
      notes: 'Auto-resolved: target wins (post-cutover mode)',
    };
  }

  private attemptMerge(conflict: Conflict): ConflictResolution | null {
    const merged = this.mergeChanges(conflict.sourceChange, conflict.targetChange);
    if (!merged) return null;

    return {
      strategy: ConflictStrategy.MERGE,
      resolvedChange: merged,
      notes: 'Auto-resolved: non-conflicting fields merged successfully',
    };
  }

  private getChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.push(key);
      }
    }

    return changed;
  }
}
