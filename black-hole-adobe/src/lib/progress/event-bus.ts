/**
 * Progress Event Bus
 *
 * In-memory event bus for broadcasting real-time migration progress updates.
 * Uses a singleton pattern so all API routes share the same instance.
 */

import type { ProgressEvent } from './types';

type ProgressCallback = (event: ProgressEvent) => void;

interface Subscription {
  id: string;
  migrationId: string;
  callback: ProgressCallback;
  createdAt: number;
}

/** Stale subscription threshold: 30 minutes */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

/** Cleanup interval: every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

class ProgressEventBus {
  private subscriptions = new Map<string, Subscription[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private subCounter = 0;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Subscribe to progress events for a specific migration.
   * Returns an unsubscribe function.
   */
  subscribe(migrationId: string, callback: ProgressCallback): () => void {
    const subId = `sub-${++this.subCounter}-${Date.now()}`;

    const subscription: Subscription = {
      id: subId,
      migrationId,
      callback,
      createdAt: Date.now(),
    };

    const existing = this.subscriptions.get(migrationId) ?? [];
    existing.push(subscription);
    this.subscriptions.set(migrationId, existing);

    console.log(`[EventBus] Subscribed ${subId} to migration ${migrationId} (${existing.length} total)`);

    return () => {
      this.unsubscribe(migrationId, subId);
    };
  }

  /**
   * Remove a specific subscription.
   */
  private unsubscribe(migrationId: string, subId: string): void {
    const subs = this.subscriptions.get(migrationId);
    if (!subs) return;

    const filtered = subs.filter((s) => s.id !== subId);

    if (filtered.length === 0) {
      this.subscriptions.delete(migrationId);
    } else {
      this.subscriptions.set(migrationId, filtered);
    }

    console.log(`[EventBus] Unsubscribed ${subId} from migration ${migrationId}`);
  }

  /**
   * Emit a progress event to all subscribers of a migration.
   */
  emit(migrationId: string, event: ProgressEvent): void {
    const subs = this.subscriptions.get(migrationId);
    if (!subs || subs.length === 0) return;

    console.log(`[EventBus] Emitting ${event.type} for migration ${migrationId} to ${subs.length} subscriber(s)`);

    for (const sub of subs) {
      try {
        sub.callback(event);
      } catch (err) {
        console.error(`[EventBus] Error in subscriber ${sub.id}:`, err);
      }
    }
  }

  /**
   * Emit a progress event using partial data, auto-filling defaults.
   */
  emitProgress(
    migrationId: string,
    partial: Partial<ProgressEvent> & Pick<ProgressEvent, 'type' | 'phase' | 'message'>,
  ): void {
    const event: ProgressEvent = {
      migrationId,
      progress: 0,
      timestamp: new Date().toISOString(),
      details: {},
      ...partial,
    };

    this.emit(migrationId, event);
  }

  /**
   * Get the number of active subscribers for a migration.
   */
  subscriberCount(migrationId: string): number {
    return this.subscriptions.get(migrationId)?.length ?? 0;
  }

  /**
   * Clean up stale subscriptions that have been around too long.
   */
  private cleanupStale(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [migrationId, subs] of this.subscriptions.entries()) {
      const active = subs.filter((s) => now - s.createdAt < STALE_THRESHOLD_MS);

      if (active.length === 0) {
        this.subscriptions.delete(migrationId);
        cleaned += subs.length;
      } else if (active.length < subs.length) {
        cleaned += subs.length - active.length;
        this.subscriptions.set(migrationId, active);
      }
    }

    if (cleaned > 0) {
      console.log(`[EventBus] Cleaned up ${cleaned} stale subscription(s)`);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupStale(), CLEANUP_INTERVAL_MS);
    // Allow the process to exit without waiting for this timer
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Tear down the event bus (for testing / graceful shutdown).
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.subscriptions.clear();
  }
}

/**
 * Singleton instance — shared across all API routes in the same process.
 */
const globalKey = Symbol.for('blackhole.progress-event-bus');
const globalObj = globalThis as unknown as Record<symbol, ProgressEventBus>;

export const progressEventBus: ProgressEventBus =
  globalObj[globalKey] ?? (globalObj[globalKey] = new ProgressEventBus());
