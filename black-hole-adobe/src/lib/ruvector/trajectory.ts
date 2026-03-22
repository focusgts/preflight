/**
 * RuVector Trajectory Recorder
 *
 * Records every query, result, and outcome for continuous learning.
 * Trajectories capture the full lifecycle: what was searched, what was
 * returned, and whether the result was actually useful. This data feeds
 * back into the learning network to improve future matches.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { v4 as uuid } from 'uuid';
import {
  DEFAULT_RUVECTOR_CONFIG,
  type RuVectorConfig,
} from '@/config/ruvector-config';

// ============================================================
// Types
// ============================================================

export interface TrajectoryEntry {
  id: string;
  type: 'query' | 'feedback' | 'outcome';
  namespace: string;
  timestamp: string;
  data: QueryTrajectory | FeedbackTrajectory | OutcomeTrajectory;
}

export interface QueryTrajectory {
  queryText: string;
  resultCount: number;
  resultKeys: string[];
  topSimilarity: number;
  searchDurationMs: number;
}

export interface FeedbackTrajectory {
  queryId: string;
  resultId: string;
  feedback: 'useful' | 'not_useful' | 'partially_useful';
  comment: string | null;
}

export interface OutcomeTrajectory {
  patternId: string;
  outcome: 'success' | 'partial' | 'failure';
  details: string;
  metrics: Record<string, number>;
}

interface SerializedTrajectories {
  version: number;
  savedAt: string;
  entries: TrajectoryEntry[];
}

// ============================================================
// Recorder
// ============================================================

export class TrajectoryRecorder {
  private entries: TrajectoryEntry[] = [];
  private config: RuVectorConfig;
  private maxEntries: number;

  constructor(config?: Partial<RuVectorConfig>, maxEntries: number = 10_000) {
    this.config = { ...DEFAULT_RUVECTOR_CONFIG, ...config };
    this.maxEntries = maxEntries;

    if (
      this.config.features.persistenceEnabled &&
      this.config.features.trajectoryRecording
    ) {
      this.loadFromDisk();
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Record a search query and its results.
   * Returns the trajectory ID for linking feedback.
   */
  recordQuery(
    namespace: string,
    queryText: string,
    results: Array<{ key: string; similarity: number }>,
    searchDurationMs: number = 0,
  ): string {
    if (!this.config.features.trajectoryRecording) return '';

    const id = uuid();
    const entry: TrajectoryEntry = {
      id,
      type: 'query',
      namespace,
      timestamp: new Date().toISOString(),
      data: {
        queryText,
        resultCount: results.length,
        resultKeys: results.map((r) => r.key),
        topSimilarity: results.length > 0 ? results[0].similarity : 0,
        searchDurationMs,
      },
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Record feedback on whether a search result was useful.
   */
  recordFeedback(
    queryId: string,
    resultId: string,
    feedback: 'useful' | 'not_useful' | 'partially_useful',
    comment: string | null = null,
  ): string {
    if (!this.config.features.trajectoryRecording) return '';

    const id = uuid();
    const entry: TrajectoryEntry = {
      id,
      type: 'feedback',
      namespace: this.findNamespaceForQuery(queryId),
      timestamp: new Date().toISOString(),
      data: {
        queryId,
        resultId,
        feedback,
        comment,
      },
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Record whether a recommended pattern actually worked.
   */
  recordOutcome(
    patternId: string,
    outcome: 'success' | 'partial' | 'failure',
    details: string = '',
    metrics: Record<string, number> = {},
  ): string {
    if (!this.config.features.trajectoryRecording) return '';

    const id = uuid();
    const entry: TrajectoryEntry = {
      id,
      type: 'outcome',
      namespace: 'fix_library', // Outcomes typically relate to fixes
      timestamp: new Date().toISOString(),
      data: {
        patternId,
        outcome,
        details,
        metrics,
      },
    };

    this.addEntry(entry);
    return id;
  }

  /**
   * Get recent trajectories, optionally filtered by namespace.
   */
  getTrajectories(
    namespace?: string,
    limit: number = 50,
  ): TrajectoryEntry[] {
    let filtered = this.entries;

    if (namespace) {
      filtered = filtered.filter((e) => e.namespace === namespace);
    }

    // Already in chronological order, return most recent first
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get trajectories by type.
   */
  getTrajectoriesByType(
    type: 'query' | 'feedback' | 'outcome',
    limit: number = 50,
  ): TrajectoryEntry[] {
    return this.entries
      .filter((e) => e.type === type)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get feedback statistics for a namespace.
   */
  getFeedbackStats(namespace?: string): {
    total: number;
    useful: number;
    notUseful: number;
    partiallyUseful: number;
    usefulRate: number;
  } {
    const feedbacks = this.entries.filter(
      (e) =>
        e.type === 'feedback' &&
        (!namespace || e.namespace === namespace),
    );

    const total = feedbacks.length;
    const useful = feedbacks.filter(
      (e) => (e.data as FeedbackTrajectory).feedback === 'useful',
    ).length;
    const notUseful = feedbacks.filter(
      (e) => (e.data as FeedbackTrajectory).feedback === 'not_useful',
    ).length;
    const partiallyUseful = feedbacks.filter(
      (e) => (e.data as FeedbackTrajectory).feedback === 'partially_useful',
    ).length;

    return {
      total,
      useful,
      notUseful,
      partiallyUseful,
      usefulRate: total > 0 ? useful / total : 0,
    };
  }

  /**
   * Get outcome statistics.
   */
  getOutcomeStats(): {
    total: number;
    success: number;
    partial: number;
    failure: number;
    successRate: number;
  } {
    const outcomes = this.entries.filter((e) => e.type === 'outcome');

    const total = outcomes.length;
    const success = outcomes.filter(
      (e) => (e.data as OutcomeTrajectory).outcome === 'success',
    ).length;
    const partial = outcomes.filter(
      (e) => (e.data as OutcomeTrajectory).outcome === 'partial',
    ).length;
    const failure = outcomes.filter(
      (e) => (e.data as OutcomeTrajectory).outcome === 'failure',
    ).length;

    return {
      total,
      success,
      partial,
      failure,
      successRate: total > 0 ? success / total : 0,
    };
  }

  /**
   * Get total trajectory count.
   */
  get count(): number {
    return this.entries.length;
  }

  // ----------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------

  saveToDisk(): void {
    if (
      !this.config.features.persistenceEnabled ||
      !this.config.features.trajectoryRecording
    ) {
      return;
    }

    const storePath = this.config.persistence.trajectoryStorePath;
    const dir = dirname(storePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const serialized: SerializedTrajectories = {
      version: 1,
      savedAt: new Date().toISOString(),
      entries: this.entries,
    };

    writeFileSync(storePath, JSON.stringify(serialized), 'utf-8');
  }

  loadFromDisk(): void {
    const storePath = this.config.persistence.trajectoryStorePath;
    if (!existsSync(storePath)) return;

    try {
      const raw = readFileSync(storePath, 'utf-8');
      const data: SerializedTrajectories = JSON.parse(raw);

      if (data.version !== 1) {
        throw new TrajectoryError(
          `Unsupported trajectory version: ${data.version}`
        );
      }

      this.entries = data.entries;
    } catch (error) {
      if (error instanceof TrajectoryError) throw error;
      console.warn(
        `TrajectoryRecorder: Failed to load from ${storePath}, starting fresh:`,
        error,
      );
      this.entries = [];
    }
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private addEntry(entry: TrajectoryEntry): void {
    this.entries.push(entry);

    // Enforce max entries (FIFO eviction)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(
        this.entries.length - this.maxEntries,
      );
    }

    if (this.config.features.autoSaveOnMutation) {
      this.saveToDisk();
    }
  }

  private findNamespaceForQuery(queryId: string): string {
    const queryEntry = this.entries.find(
      (e) => e.id === queryId && e.type === 'query',
    );
    return queryEntry?.namespace ?? 'unknown';
  }
}

// ============================================================
// Error Class
// ============================================================

export class TrajectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrajectoryError';
  }
}
