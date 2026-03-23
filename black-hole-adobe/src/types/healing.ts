/**
 * Self-Healing Migration Types
 *
 * Type definitions for the self-healing engine that automatically detects
 * migration failures, diagnoses root causes, and applies proven fixes
 * from the RuVector pattern library.
 */

import type { Severity } from './index';

// ============================================================
// Error Classification
// ============================================================

export type HealingErrorType =
  | 'api_error'
  | 'code_compatibility'
  | 'content_integrity'
  | 'permission_denied'
  | 'resource_limit'
  | 'configuration_error'
  | 'unknown';

// ============================================================
// Diagnosis
// ============================================================

export interface Diagnosis {
  id: string;
  errorType: HealingErrorType;
  errorMessage: string;
  patterns: string[];
  rootCause: string | null;
  relatedItemIds: string[];
  severity: Severity;
  httpStatus: number | null;
  stackTrace: string | null;
  context: DiagnosisContext;
  createdAt: string;
}

export interface DiagnosisContext {
  migrationId: string;
  phase: string;
  itemId: string;
  itemType: string;
  sourcePath: string;
  targetPath: string | null;
}

// ============================================================
// Remedy
// ============================================================

export interface Remedy {
  id: string;
  name: string;
  description: string;
  errorPattern: RegExp | string;
  fix: RemedyFixFn;
  confidence: number;
  successCount: number;
  failCount: number;
  autoApplicable: boolean;
  category: HealingErrorType;
  tags: string[];
}

export type RemedyFixFn = (
  item: RemedyTarget,
  context: RemedyContext,
) => RemedyFixResult | Promise<RemedyFixResult>;

export interface RemedyTarget {
  id: string;
  type: string;
  name: string;
  sourcePath: string;
  targetPath: string | null;
  error: string | null;
  metadata?: Record<string, unknown>;
}

export interface RemedyContext {
  migrationId: string;
  phase: string;
  diagnosis: Diagnosis;
  retryCount: number;
}

export interface RemedyFixResult {
  success: boolean;
  modifiedItem: Partial<RemedyTarget>;
  description: string;
  rollbackInfo?: Record<string, unknown>;
}

export interface RemedyMatch {
  remedy: Remedy;
  confidence: number;
  source: 'builtin' | 'ruvector' | 'manual';
}

// ============================================================
// Healing Actions
// ============================================================

export type HealingActionType = 'auto_applied' | 'suggested' | 'escalated';
export type HealingActionResult = 'success' | 'failed' | 'pending' | 'rejected';

export interface HealingAction {
  id: string;
  migrationId: string;
  diagnosisId: string;
  remedyId: string | null;
  remedyName: string | null;
  itemId: string;
  itemName: string;
  action: HealingActionType;
  result: HealingActionResult;
  confidence: number;
  errorMessage: string;
  fixDescription: string | null;
  rootCause: string | null;
  severity: Severity;
  retryCount: number;
  timestamp: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ============================================================
// Healing Report
// ============================================================

export interface HealingReport {
  migrationId: string;
  totalFailures: number;
  autoHealed: number;
  suggested: number;
  escalated: number;
  healingRate: number;
  actions: HealingAction[];
  topRemedies: RemedyStat[];
  generatedAt: string;
}

export interface RemedyStat {
  remedyId: string;
  name: string;
  usageCount: number;
  successRate: number;
  category: HealingErrorType;
}

// ============================================================
// Circuit Breaker
// ============================================================

export interface CircuitBreakerState {
  itemId: string;
  failureCount: number;
  lastFailure: string;
  tripped: boolean;
}

// ============================================================
// Confidence Thresholds
// ============================================================

export const CONFIDENCE_THRESHOLDS = {
  /** Auto-apply with audit log only. */
  AUTO_APPLY: 0.95,
  /** Auto-apply with notification and rollback option. */
  AUTO_WITH_NOTIFICATION: 0.80,
  /** Suggest fix, wait for human approval. */
  SUGGEST: 0.60,
  /** Below this: escalate with no suggestion. */
  ESCALATE: 0.60,
} as const;

export const CIRCUIT_BREAKER_LIMIT = 3;
