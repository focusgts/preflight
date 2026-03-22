/**
 * Review Engine
 *
 * Manages the bulk code review queue for auto-refactored migration changes.
 * Provides create, read, update, and bulk-action operations against an
 * in-memory store, pre-seeded with demo data on first access.
 */

import type {
  CodeReviewItem,
  ReviewQueue,
  ReviewQueueStats,
  ReviewFilter,
  ReviewStatus,
  BulkAction,
} from '@/types/review';
import { mockReviewItems, DEMO_MIGRATION_ID } from '@/config/mock-review-data';

// ── Confidence Thresholds ─────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.95,    // Safe to auto-approve
  MEDIUM: 0.80,  // Review recommended
  // Below 0.80 = Manual review required
} as const;

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'Safe to auto-approve';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'Review recommended';
  return 'Manual review required';
}

export function getConfidenceTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

// ── In-Memory Store ───────────────────────────────────────────────────

const queues = new Map<string, ReviewQueue>();

function ensureSeeded(): void {
  if (queues.size > 0) return;

  const queue: ReviewQueue = {
    id: `rq-${DEMO_MIGRATION_ID}`,
    migrationId: DEMO_MIGRATION_ID,
    items: structuredClone(mockReviewItems),
    stats: computeStats(mockReviewItems),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  queues.set(DEMO_MIGRATION_ID, queue);
}

function computeStats(items: CodeReviewItem[]): ReviewQueueStats {
  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    highConfidence: items.filter((i) => i.confidence >= CONFIDENCE_THRESHOLDS.HIGH).length,
    needsReview: items.filter(
      (i) => i.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && i.confidence < CONFIDENCE_THRESHOLDS.HIGH,
    ).length,
    manualRequired: items.filter((i) => i.confidence < CONFIDENCE_THRESHOLDS.MEDIUM).length,
  };
}

function matchesFilter(item: CodeReviewItem, filter: ReviewFilter): boolean {
  if (filter.confidenceMin !== undefined && item.confidence < filter.confidenceMin) return false;
  if (filter.confidenceMax !== undefined && item.confidence > filter.confidenceMax) return false;
  if (filter.changeType && filter.changeType.length > 0 && !filter.changeType.includes(item.changeType)) return false;
  if (filter.status && filter.status.length > 0 && !filter.status.includes(item.status)) return false;
  if (filter.severity && filter.severity.length > 0 && !filter.severity.includes(item.severity)) return false;
  return true;
}

// ── Review Engine ─────────────────────────────────────────────────────

export class ReviewEngine {
  /** Build a review queue from code modernizer output. */
  createQueue(migrationId: string, codeChanges: CodeReviewItem[]): ReviewQueue {
    ensureSeeded();

    const queue: ReviewQueue = {
      id: `rq-${migrationId}`,
      migrationId,
      items: structuredClone(codeChanges),
      stats: computeStats(codeChanges),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    queues.set(migrationId, queue);
    return queue;
  }

  /** Get the current queue for a migration, with optional filtering. */
  getQueue(migrationId: string, filter?: ReviewFilter): ReviewQueue | undefined {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return undefined;

    if (!filter) return queue;

    const filtered = queue.items.filter((item) => matchesFilter(item, filter));
    return {
      ...queue,
      items: filtered,
      stats: computeStats(filtered),
    };
  }

  /** Approve, reject, or skip a single item. */
  reviewItem(
    migrationId: string,
    itemId: string,
    action: ReviewStatus,
    notes?: string,
  ): CodeReviewItem | undefined {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return undefined;

    const item = queue.items.find((i) => i.id === itemId);
    if (!item) return undefined;

    item.status = action;
    item.reviewedBy = 'current-user';
    item.reviewedAt = new Date().toISOString();
    if (notes !== undefined) item.notes = notes;

    queue.stats = computeStats(queue.items);
    queue.updatedAt = new Date().toISOString();

    return item;
  }

  /** Approve all items matching a filter (e.g., confidence > threshold). */
  bulkApprove(migrationId: string, filter: ReviewFilter): number {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return 0;

    let count = 0;
    const now = new Date().toISOString();

    for (const item of queue.items) {
      if (item.status !== 'pending') continue;
      if (!matchesFilter(item, filter)) continue;

      item.status = 'approved';
      item.reviewedBy = 'bulk-action';
      item.reviewedAt = now;
      count++;
    }

    queue.stats = computeStats(queue.items);
    queue.updatedAt = now;
    return count;
  }

  /** Reject specific items by ID. */
  bulkReject(migrationId: string, ids: string[]): number {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return 0;

    let count = 0;
    const now = new Date().toISOString();
    const idSet = new Set(ids);

    for (const item of queue.items) {
      if (!idSet.has(item.id)) continue;
      if (item.status !== 'pending') continue;

      item.status = 'rejected';
      item.reviewedBy = 'bulk-action';
      item.reviewedAt = now;
      count++;
    }

    queue.stats = computeStats(queue.items);
    queue.updatedAt = now;
    return count;
  }

  /** Bulk skip specific items by ID. */
  bulkSkip(migrationId: string, ids: string[]): number {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return 0;

    let count = 0;
    const now = new Date().toISOString();
    const idSet = new Set(ids);

    for (const item of queue.items) {
      if (!idSet.has(item.id)) continue;
      if (item.status !== 'pending') continue;

      item.status = 'skipped';
      item.reviewedBy = 'bulk-action';
      item.reviewedAt = now;
      count++;
    }

    queue.stats = computeStats(queue.items);
    queue.updatedAt = now;
    return count;
  }

  /** Get queue statistics for a migration. */
  getStats(migrationId: string): ReviewQueueStats | undefined {
    ensureSeeded();
    return queues.get(migrationId)?.stats;
  }

  /** Export all approved changes as applicable patches. */
  exportApproved(migrationId: string): Array<{ filePath: string; before: string; after: string }> {
    ensureSeeded();

    const queue = queues.get(migrationId);
    if (!queue) return [];

    return queue.items
      .filter((item) => item.status === 'approved')
      .map(({ filePath, before, after }) => ({ filePath, before, after }));
  }

  /** Process a bulk action request. */
  processBulkAction(
    migrationId: string,
    action: BulkAction,
    itemIds?: string[],
    confidenceThreshold?: number,
  ): number {
    switch (action) {
      case 'approve_all_high_confidence':
        return this.bulkApprove(migrationId, {
          confidenceMin: confidenceThreshold ?? CONFIDENCE_THRESHOLDS.HIGH,
          status: ['pending'],
        });
      case 'approve_selected':
        if (!itemIds?.length) return 0;
        return this.bulkApproveByIds(migrationId, itemIds);
      case 'reject_selected':
        if (!itemIds?.length) return 0;
        return this.bulkReject(migrationId, itemIds);
      case 'skip_selected':
        if (!itemIds?.length) return 0;
        return this.bulkSkip(migrationId, itemIds);
      default:
        return 0;
    }
  }

  private bulkApproveByIds(migrationId: string, ids: string[]): number {
    const queue = queues.get(migrationId);
    if (!queue) return 0;

    let count = 0;
    const now = new Date().toISOString();
    const idSet = new Set(ids);

    for (const item of queue.items) {
      if (!idSet.has(item.id)) continue;
      if (item.status !== 'pending') continue;

      item.status = 'approved';
      item.reviewedBy = 'bulk-action';
      item.reviewedAt = now;
      count++;
    }

    queue.stats = computeStats(queue.items);
    queue.updatedAt = now;
    return count;
  }
}

/** Singleton instance. */
export const reviewEngine = new ReviewEngine();
