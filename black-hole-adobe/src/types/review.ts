/**
 * Code Review Queue Types
 *
 * Type definitions for the bulk code review system that lets developers
 * approve or reject auto-refactored code changes in bulk.
 */

import type { Severity } from '@/types';

// ============================================================
// Enums
// ============================================================

export type CodeChangeType =
  | 'osgi_config'
  | 'deprecated_api'
  | 'maven_structure'
  | 'dispatcher'
  | 'workflow'
  | 'index';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export type BulkAction =
  | 'approve_all_high_confidence'
  | 'approve_selected'
  | 'reject_selected'
  | 'skip_selected';

// ============================================================
// Core Interfaces
// ============================================================

export interface CodeReviewItem {
  id: string;
  filePath: string;
  changeType: CodeChangeType;
  before: string;
  after: string;
  confidence: number; // 0-1
  status: ReviewStatus;
  severity: Severity;
  description: string;
  autoFixApplied: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
}

export interface ReviewQueueStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  skipped: number;
  highConfidence: number;   // confidence > 0.95
  needsReview: number;      // confidence 0.80 - 0.95
  manualRequired: number;   // confidence < 0.80
}

export interface ReviewQueue {
  id: string;
  migrationId: string;
  items: CodeReviewItem[];
  stats: ReviewQueueStats;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFilter {
  confidenceMin?: number;
  confidenceMax?: number;
  changeType?: CodeChangeType[];
  status?: ReviewStatus[];
  severity?: Severity[];
}

// ============================================================
// API Request / Response Types
// ============================================================

export interface ReviewItemAction {
  itemId: string;
  action: 'approved' | 'rejected' | 'skipped';
  notes?: string;
}

export interface BulkReviewRequest {
  action: BulkAction;
  itemIds?: string[];
  filter?: ReviewFilter;
  confidenceThreshold?: number;
}
