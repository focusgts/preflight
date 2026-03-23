/**
 * Black Hole - Simulation Sandbox
 *
 * In-memory sandbox that creates a virtual representation of the
 * target environment. All changes are tracked with full audit trail
 * and support rollback to any point.
 *
 * Zero side effects -- nothing leaves this process boundary.
 */

import { v4 as uuid } from 'uuid';
import type { MigrationItem } from '@/types';
import type {
  SandboxState,
  SandboxItem,
  SandboxChange,
  SandboxChangeLogEntry,
  SimulationPhase,
} from '@/types/simulation';

// ============================================================
// Sandbox Engine
// ============================================================

export class Sandbox {
  private state: SandboxState;
  private initialSnapshot: SandboxItem[];

  constructor() {
    const now = new Date().toISOString();
    this.state = {
      id: uuid(),
      items: [],
      changes: [],
      changeLog: [],
      createdAt: now,
      lastModifiedAt: now,
    };
    this.initialSnapshot = [];
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Initialize sandbox from source migration items.
   * Creates a deep copy so the original data is never mutated.
   */
  createSandbox(sourceItems: MigrationItem[]): SandboxState {
    const sandboxItems: SandboxItem[] = sourceItems.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
      status: 'pending',
      metadata: {
        compatibilityLevel: item.compatibilityLevel,
        autoFixed: item.autoFixed,
        originalStatus: item.status,
      },
    }));

    this.state.items = sandboxItems;
    this.state.changes = [];
    this.state.changeLog = [];
    this.state.lastModifiedAt = new Date().toISOString();

    // Store initial snapshot for diff and reset
    this.initialSnapshot = JSON.parse(JSON.stringify(sandboxItems));

    return this.getState();
  }

  /**
   * Apply a simulated change to the sandbox.
   * Returns the change ID for optional rollback.
   */
  applyChange(change: {
    itemId: string;
    type: SandboxChange['type'];
    updates: Record<string, unknown>;
    phase: SimulationPhase;
    description: string;
  }): string {
    const item = this.state.items.find((i) => i.id === change.itemId);
    if (!item) {
      throw new SandboxError(`Item ${change.itemId} not found in sandbox`);
    }

    // Capture before state
    const before: Record<string, unknown> = {
      targetPath: item.targetPath,
      status: item.status,
      ...Object.fromEntries(
        Object.keys(change.updates).map((k) => [
          k,
          (item as unknown as Record<string, unknown>)[k],
        ]),
      ),
    };

    // Apply updates
    const after: Record<string, unknown> = { ...change.updates };
    for (const [key, value] of Object.entries(change.updates)) {
      (item as unknown as Record<string, unknown>)[key] = value;
    }

    const changeId = uuid();
    const now = new Date().toISOString();

    const sandboxChange: SandboxChange = {
      id: changeId,
      itemId: change.itemId,
      type: change.type,
      before,
      after,
      appliedAt: now,
      rolledBack: false,
    };

    this.state.changes.push(sandboxChange);
    this.state.changeLog.push({
      changeId,
      timestamp: now,
      description: change.description,
      phase: change.phase,
    });

    this.state.lastModifiedAt = now;
    return changeId;
  }

  /**
   * Undo a specific change by ID. Restores the item to its
   * pre-change state for the affected fields.
   */
  rollback(changeId: string): boolean {
    const change = this.state.changes.find(
      (c) => c.id === changeId && !c.rolledBack,
    );
    if (!change) {
      return false;
    }

    const item = this.state.items.find((i) => i.id === change.itemId);
    if (!item) {
      return false;
    }

    // Restore before state
    for (const [key, value] of Object.entries(change.before)) {
      (item as unknown as Record<string, unknown>)[key] = value;
    }

    change.rolledBack = true;

    this.state.changeLog.push({
      changeId: uuid(),
      timestamp: new Date().toISOString(),
      description: `Rolled back change ${changeId}`,
      phase: this.state.changeLog.find((l) => l.changeId === changeId)
        ?.phase ?? 'assessment',
    });

    this.state.lastModifiedAt = new Date().toISOString();
    return true;
  }

  /**
   * Rollback all changes up to a specific change ID (inclusive).
   * Changes are rolled back in reverse chronological order.
   */
  rollbackTo(changeId: string): number {
    const changeIndex = this.state.changes.findIndex(
      (c) => c.id === changeId,
    );
    if (changeIndex === -1) {
      return 0;
    }

    let rolledBackCount = 0;
    // Roll back from newest to the target (inclusive)
    for (let i = this.state.changes.length - 1; i >= changeIndex; i--) {
      const change = this.state.changes[i];
      if (!change.rolledBack) {
        this.rollback(change.id);
        rolledBackCount++;
      }
    }

    return rolledBackCount;
  }

  /**
   * Show all differences from the initial state.
   */
  diff(): SandboxDiff {
    const added: SandboxItem[] = [];
    const modified: SandboxItemDiff[] = [];
    const removed: SandboxItem[] = [];

    const initialMap = new Map(
      this.initialSnapshot.map((i) => [i.id, i]),
    );
    const currentMap = new Map(
      this.state.items.map((i) => [i.id, i]),
    );

    // Find modified and added
    for (const [id, current] of currentMap) {
      const original = initialMap.get(id);
      if (!original) {
        added.push(current);
        continue;
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      let hasChanges = false;

      for (const key of Object.keys(current) as (keyof SandboxItem)[]) {
        const origVal = JSON.stringify(original[key]);
        const curVal = JSON.stringify(current[key]);
        if (origVal !== curVal) {
          changes[key] = { from: original[key], to: current[key] };
          hasChanges = true;
        }
      }

      if (hasChanges) {
        modified.push({ itemId: id, itemName: current.name, changes });
      }
    }

    // Find removed
    for (const [id, original] of initialMap) {
      if (!currentMap.has(id)) {
        removed.push(original);
      }
    }

    return {
      added,
      modified,
      removed,
      totalChanges: added.length + modified.length + removed.length,
    };
  }

  /**
   * Run integrity checks on the current sandbox state.
   */
  validate(): SandboxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate IDs
    const ids = this.state.items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      errors.push(`Duplicate item IDs detected: ${ids.length - uniqueIds.size} duplicates`);
    }

    // Check for items without target paths that are marked processed
    const noTargetProcessed = this.state.items.filter(
      (i) => i.status === 'processed' && !i.targetPath,
    );
    if (noTargetProcessed.length > 0) {
      warnings.push(
        `${noTargetProcessed.length} items marked processed but have no target path`,
      );
    }

    // Check for orphaned changes (referencing items that no longer exist)
    const itemIds = new Set(this.state.items.map((i) => i.id));
    const orphanedChanges = this.state.changes.filter(
      (c) => !c.rolledBack && !itemIds.has(c.itemId),
    );
    if (orphanedChanges.length > 0) {
      errors.push(
        `${orphanedChanges.length} changes reference non-existent items`,
      );
    }

    // Check for path collisions
    const targetPaths = this.state.items
      .map((i) => i.targetPath)
      .filter(Boolean) as string[];
    const uniquePaths = new Set(targetPaths);
    if (uniquePaths.size !== targetPaths.length) {
      const collisionCount = targetPaths.length - uniquePaths.size;
      warnings.push(`${collisionCount} target path collisions detected`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      itemCount: this.state.items.length,
      changeCount: this.state.changes.filter((c) => !c.rolledBack).length,
    };
  }

  /**
   * Get the current sandbox state snapshot (deep copy).
   */
  getState(): SandboxState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get a specific item from the sandbox.
   */
  getItem(itemId: string): SandboxItem | undefined {
    return this.state.items.find((i) => i.id === itemId);
  }

  /**
   * Get active (non-rolled-back) changes for a phase.
   */
  getChangesForPhase(phase: SimulationPhase): SandboxChange[] {
    const phaseChangeIds = new Set(
      this.state.changeLog
        .filter((l) => l.phase === phase)
        .map((l) => l.changeId),
    );
    return this.state.changes.filter(
      (c) => phaseChangeIds.has(c.id) && !c.rolledBack,
    );
  }

  /**
   * Reset the sandbox to its initial state.
   */
  reset(): void {
    this.state.items = JSON.parse(JSON.stringify(this.initialSnapshot));
    this.state.changes = [];
    this.state.changeLog = [];
    this.state.lastModifiedAt = new Date().toISOString();
  }
}

// ============================================================
// Supporting Types
// ============================================================

export interface SandboxDiff {
  added: SandboxItem[];
  modified: SandboxItemDiff[];
  removed: SandboxItem[];
  totalChanges: number;
}

export interface SandboxItemDiff {
  itemId: string;
  itemName: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface SandboxValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  itemCount: number;
  changeCount: number;
}

// ============================================================
// Error
// ============================================================

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxError';
  }
}
