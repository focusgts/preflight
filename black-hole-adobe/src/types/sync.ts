/**
 * Content Sync Types
 *
 * Type definitions for the continuous content synchronization system
 * that eliminates content freeze during migration.
 */

// ============================================================
// Enums
// ============================================================

export enum SyncStatus {
  INITIALIZING = 'initializing',
  SYNCING = 'syncing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  CUTOVER_IN_PROGRESS = 'cutover_in_progress',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum ChangeType {
  PAGE_CREATED = 'page_created',
  PAGE_MODIFIED = 'page_modified',
  PAGE_DELETED = 'page_deleted',
  PAGE_MOVED = 'page_moved',
  ASSET_UPLOADED = 'asset_uploaded',
  ASSET_MODIFIED = 'asset_modified',
  ASSET_DELETED = 'asset_deleted',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
}

export enum ConflictType {
  BOTH_MODIFIED = 'both_modified',
  SOURCE_DELETED_TARGET_MODIFIED = 'source_deleted_target_modified',
  TARGET_DELETED_SOURCE_MODIFIED = 'target_deleted_source_modified',
  BOTH_CREATED_SAME_PATH = 'both_created_same_path',
}

export enum ConflictStrategy {
  SOURCE_WINS = 'source_wins',
  TARGET_WINS = 'target_wins',
  MANUAL = 'manual',
  MERGE = 'merge',
}

export enum DetectionStrategy {
  POLLING = 'polling',
  WEBHOOK = 'webhook',
  DIFF = 'diff',
}

export enum CutoverStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

// ============================================================
// Core Interfaces
// ============================================================

export interface ContentChange {
  id: string;
  type: ChangeType;
  path: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  hash: string;
  synced: boolean;
  syncedAt: string | null;
  error: string | null;
}

export interface ContentSnapshot {
  id: string;
  timestamp: string;
  items: SnapshotItem[];
}

export interface SnapshotItem {
  path: string;
  hash: string;
  type: string;
  lastModified: string;
  metadata: Record<string, unknown>;
}

export interface Conflict {
  id: string;
  sourceChange: ContentChange;
  targetChange: ContentChange;
  type: ConflictType;
  resolution: ConflictResolution | null;
  resolvedBy: 'auto' | 'manual' | null;
  resolvedAt: string | null;
  flaggedForReview: boolean;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  resolvedChange: ContentChange;
  notes: string | null;
}

// ============================================================
// Sync Configuration
// ============================================================

export interface SyncOptions {
  /** Polling interval in milliseconds (default: 300000 = 5 min). */
  interval: number;
  /** Change detection strategy. */
  strategy: DetectionStrategy;
  /** Glob patterns for paths to include. */
  includePatterns: string[];
  /** Glob patterns for paths to exclude. */
  excludePatterns: string[];
  /** Conflict resolution strategy. */
  conflictResolution: ConflictStrategy;
  /** Maximum changes to process per sync cycle. */
  batchSize: number;
  /** Whether to auto-start syncing. */
  autoStart: boolean;
}

export interface SyncSourceConfig {
  platform: string;
  url: string;
  credentials: Record<string, unknown> | null;
  basePath: string;
}

export interface SyncTargetConfig {
  platform: string;
  url: string;
  credentials: Record<string, unknown> | null;
  basePath: string;
}

// ============================================================
// Sync State
// ============================================================

export interface ContentSync {
  id: string;
  migrationId: string;
  status: SyncStatus;
  sourceConfig: SyncSourceConfig;
  targetConfig: SyncTargetConfig;
  options: SyncOptions;
  stats: SyncStats;
  changeLog: ContentChange[];
  conflicts: Conflict[];
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
}

export interface SyncStats {
  totalChangesDetected: number;
  totalChangesSynced: number;
  totalConflicts: number;
  totalConflictsResolved: number;
  totalErrors: number;
  averageSyncDurationMs: number;
  lastSyncDurationMs: number | null;
  syncCyclesCompleted: number;
}

// ============================================================
// Cutover Types
// ============================================================

export interface CutoverPlan {
  id: string;
  syncId: string;
  steps: CutoverStep[];
  estimatedDurationMinutes: number;
  rollbackSteps: CutoverStep[];
  createdAt: string;
  status: CutoverStepStatus;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CutoverStep {
  id: string;
  order: number;
  name: string;
  description: string;
  status: CutoverStepStatus;
  estimatedDurationMinutes: number;
  actualDurationMinutes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  rollbackable: boolean;
}

// ============================================================
// API Types
// ============================================================

export interface StartSyncRequest {
  sourceConfig: SyncSourceConfig;
  targetConfig: SyncTargetConfig;
  options?: Partial<SyncOptions>;
}

export interface ResolvConflictRequest {
  conflictId: string;
  strategy: ConflictStrategy;
  notes?: string;
}

export interface SyncStatusResponse {
  sync: ContentSync;
  health: SyncHealth;
}

export enum SyncHealthLevel {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  ERROR = 'error',
}

export interface SyncHealth {
  level: SyncHealthLevel;
  message: string;
  unresolvedConflicts: number;
  pendingChanges: number;
  errorRate: number;
}
