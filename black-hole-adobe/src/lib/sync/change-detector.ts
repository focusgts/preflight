/**
 * Change Detection Engine
 *
 * Detects content changes between snapshots using content hashing.
 * Supports additions, modifications, deletions, and moves/renames.
 */

import type {
  ContentChange,
  ContentSnapshot,
  SnapshotItem,
  SyncOptions,
} from '@/types/sync';
import { ChangeType } from '@/types/sync';

export interface ChangeCategorization {
  change: ContentChange;
  priority: 'critical' | 'high' | 'normal' | 'low';
  category: 'content' | 'asset' | 'metadata' | 'structure';
}

export class ChangeDetector {
  /**
   * Create a snapshot of the current content state by hashing each item.
   */
  snapshot(items: SnapshotItem[]): ContentSnapshot {
    return {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      items: items.map((item) => ({
        ...item,
        hash: item.hash || this.hashContent(item),
      })),
    };
  }

  /**
   * Diff two snapshots and return the list of content changes.
   * Detects additions, modifications, deletions, and moves.
   */
  diff(snapshotA: ContentSnapshot, snapshotB: ContentSnapshot): ContentChange[] {
    const changes: ContentChange[] = [];
    const mapA = new Map(snapshotA.items.map((i) => [i.path, i]));
    const mapB = new Map(snapshotB.items.map((i) => [i.path, i]));

    // Index B items by hash for move detection
    const hashToPathB = new Map<string, string[]>();
    for (const item of snapshotB.items) {
      const paths = hashToPathB.get(item.hash) ?? [];
      paths.push(item.path);
      hashToPathB.set(item.hash, paths);
    }

    const deletedPaths = new Set<string>();

    // Find deletions and modifications (items in A but changed or missing in B)
    for (const [path, itemA] of mapA) {
      const itemB = mapB.get(path);

      if (!itemB) {
        // Check if it was moved (same hash exists at a different path in B)
        const possibleMoves = hashToPathB.get(itemA.hash) ?? [];
        const newPath = possibleMoves.find((p) => !mapA.has(p));

        if (newPath) {
          changes.push(this.createChange(
            ChangeType.PAGE_MOVED,
            path,
            { path, ...this.snapshotItemToRecord(itemA) },
            { path: newPath, ...this.snapshotItemToRecord(mapB.get(newPath)!) },
            snapshotB.timestamp,
            itemA.hash,
          ));
        } else {
          deletedPaths.add(path);
          const deleteType = this.getDeleteType(itemA.type);
          changes.push(this.createChange(
            deleteType,
            path,
            this.snapshotItemToRecord(itemA),
            null,
            snapshotB.timestamp,
            itemA.hash,
          ));
        }
      } else if (itemA.hash !== itemB.hash) {
        // Modified
        const modifyType = this.getModifyType(itemA.type);
        changes.push(this.createChange(
          modifyType,
          path,
          this.snapshotItemToRecord(itemA),
          this.snapshotItemToRecord(itemB),
          snapshotB.timestamp,
          itemB.hash,
        ));
      }
    }

    // Find additions (items in B but not in A, and not from a move)
    for (const [path, itemB] of mapB) {
      if (!mapA.has(path)) {
        // Skip if this path was the target of a detected move
        const isMovedTo = changes.some(
          (c) => c.type === ChangeType.PAGE_MOVED && c.after?.['path'] === path,
        );
        if (isMovedTo) continue;

        const createType = this.getCreateType(itemB.type);
        changes.push(this.createChange(
          createType,
          path,
          null,
          this.snapshotItemToRecord(itemB),
          snapshotB.timestamp,
          itemB.hash,
        ));
      }
    }

    return changes.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  /**
   * Generate a content hash for change detection.
   * Uses a combination of title, body, and metadata fields.
   */
  hashContent(item: SnapshotItem): string {
    const parts = [
      item.path,
      item.type,
      item.lastModified,
      JSON.stringify(item.metadata),
    ];
    const str = parts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(36).padStart(8, '0');
  }

  /**
   * Classify a change by type and priority for processing order.
   */
  categorizeChange(change: ContentChange): ChangeCategorization {
    let priority: ChangeCategorization['priority'] = 'normal';
    let category: ChangeCategorization['category'] = 'content';

    // Deletions are high priority (need to propagate quickly)
    if (
      change.type === ChangeType.PAGE_DELETED ||
      change.type === ChangeType.ASSET_DELETED
    ) {
      priority = 'high';
    }

    // Moves are critical (can break references)
    if (change.type === ChangeType.PAGE_MOVED) {
      priority = 'critical';
    }

    // Assets
    if (
      change.type === ChangeType.ASSET_UPLOADED ||
      change.type === ChangeType.ASSET_MODIFIED ||
      change.type === ChangeType.ASSET_DELETED
    ) {
      category = 'asset';
    }

    // Tags are metadata changes
    if (
      change.type === ChangeType.TAG_ADDED ||
      change.type === ChangeType.TAG_REMOVED
    ) {
      category = 'metadata';
      priority = 'low';
    }

    return { change, priority, category };
  }

  /**
   * Filter changes based on include/exclude path patterns.
   */
  filterChanges(
    changes: ContentChange[],
    rules: Pick<SyncOptions, 'includePatterns' | 'excludePatterns'>,
  ): ContentChange[] {
    return changes.filter((change) => {
      // Check exclude patterns first
      if (rules.excludePatterns.length > 0) {
        for (const pattern of rules.excludePatterns) {
          if (this.matchPattern(change.path, pattern)) return false;
        }
      }

      // If include patterns are specified, path must match at least one
      if (rules.includePatterns.length > 0) {
        return rules.includePatterns.some((pattern) =>
          this.matchPattern(change.path, pattern),
        );
      }

      return true;
    });
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private createChange(
    type: ChangeType,
    path: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    timestamp: string,
    hash: string,
  ): ContentChange {
    return {
      id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      path,
      before,
      after,
      timestamp,
      hash,
      synced: false,
      syncedAt: null,
      error: null,
    };
  }

  private snapshotItemToRecord(item: SnapshotItem): Record<string, unknown> {
    return {
      path: item.path,
      type: item.type,
      hash: item.hash,
      lastModified: item.lastModified,
      ...item.metadata,
    };
  }

  private getDeleteType(itemType: string): ChangeType {
    if (itemType === 'asset') return ChangeType.ASSET_DELETED;
    if (itemType === 'tag') return ChangeType.TAG_REMOVED;
    return ChangeType.PAGE_DELETED;
  }

  private getModifyType(itemType: string): ChangeType {
    if (itemType === 'asset') return ChangeType.ASSET_MODIFIED;
    return ChangeType.PAGE_MODIFIED;
  }

  private getCreateType(itemType: string): ChangeType {
    if (itemType === 'asset') return ChangeType.ASSET_UPLOADED;
    if (itemType === 'tag') return ChangeType.TAG_ADDED;
    return ChangeType.PAGE_CREATED;
  }

  /**
   * Simple glob-like pattern matching.
   * Supports * (any segment chars) and ** (any path depth).
   */
  private matchPattern(path: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '[^/]');
    return new RegExp(`^${regex}$`).test(path);
  }
}
