/**
 * Black Hole - Simulation Types
 *
 * Type definitions for the migration dry-run simulation system.
 * Simulations run entirely in-memory with zero production side effects.
 */

import type { PhaseType, Severity } from './index';

// ============================================================
// Enums
// ============================================================

export type SimulationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SimulationDepth = 'quick' | 'standard' | 'thorough';

export type SimulationPhase =
  | 'assessment'
  | 'code_modernization'
  | 'content_migration'
  | 'integration_reconnection'
  | 'validation';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ============================================================
// Core Simulation Types
// ============================================================

export interface Simulation {
  id: string;
  migrationId: string;
  status: SimulationStatus;
  depth: SimulationDepth;
  options: SimulationOptions;
  results: SimulationResult[];
  report: SimulationReport | null;
  progress: SimulationProgress;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SimulationOptions {
  /** Which phases to simulate. Defaults to all. */
  phases: SimulationPhase[];
  /** Depth of simulation analysis. */
  depth: SimulationDepth;
  /** Risk threshold below which items are auto-approved (0-1). */
  riskThreshold: number;
  /** Whether to generate diffs for code modernization. */
  generateDiffs: boolean;
  /** Whether to validate integration configs. */
  validateIntegrations: boolean;
}

export interface SimulationResult {
  phase: SimulationPhase;
  predictedOutcome: 'success' | 'partial_success' | 'failure';
  confidence: number; // 0-1
  issuesFound: SimulationIssue[];
  estimatedDuration: number; // hours
  itemsAffected: number;
  itemsAutoFixable: number;
  itemsManualFix: number;
  itemsBlocker: number;
  details: Record<string, unknown>;
}

export interface SimulationIssue {
  id: string;
  phase: SimulationPhase;
  severity: Severity;
  title: string;
  description: string;
  affectedPath: string;
  suggestedFix: string;
  autoFixable: boolean;
  estimatedHours: number;
}

// ============================================================
// Simulation Report
// ============================================================

export interface SimulationReport {
  simulationId: string;
  migrationId: string;
  overallPrediction: 'will_succeed' | 'likely_succeed' | 'needs_attention' | 'high_risk';
  overallConfidence: number; // 0-1
  phaseBreakdowns: SimulationResult[];
  riskMatrix: RiskMatrixEntry[];
  recommendations: SimulationRecommendation[];
  changesSummary: ChangesSummary;
  timelinePrediction: TimelinePrediction;
  comparisonData: ComparisonData | null;
  generatedAt: string;
}

export interface RiskMatrixEntry {
  id: string;
  title: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  level: RiskLevel;
  phase: SimulationPhase;
  mitigation: string;
}

export interface SimulationRecommendation {
  priority: number; // 1 = highest
  category: string;
  title: string;
  description: string;
  action: 'proceed' | 'address_first' | 'investigate';
}

export interface ChangesSummary {
  pagesMovedCount: number;
  configsConvertedCount: number;
  apisReplacedCount: number;
  assetsTransferredCount: number;
  codeFilesModifiedCount: number;
  integrationsReconnectedCount: number;
  totalItemsCount: number;
}

export interface TimelinePrediction {
  estimatedWeeks: number;
  traditionalWeeks: number;
  timeSavingsPercent: number;
  phaseTimelines: PhaseTimeline[];
}

export interface PhaseTimeline {
  phase: SimulationPhase;
  estimatedHours: number;
  estimatedWeeks: number;
  canParallelize: boolean;
}

export interface ComparisonData {
  /** Populated after the real migration completes. */
  predictedDuration: number;
  actualDuration: number;
  predictedIssueCount: number;
  actualIssueCount: number;
  predictedSuccessRate: number;
  actualSuccessRate: number;
  accuracyScore: number; // 0-100
}

// ============================================================
// Sandbox Types
// ============================================================

export interface SandboxState {
  id: string;
  items: SandboxItem[];
  changes: SandboxChange[];
  changeLog: SandboxChangeLogEntry[];
  createdAt: string;
  lastModifiedAt: string;
}

export interface SandboxItem {
  id: string;
  type: string;
  name: string;
  sourcePath: string;
  targetPath: string | null;
  status: 'pending' | 'processed' | 'failed';
  metadata: Record<string, unknown>;
}

export interface SandboxChange {
  id: string;
  itemId: string;
  type: 'move' | 'transform' | 'create' | 'delete' | 'modify';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  appliedAt: string;
  rolledBack: boolean;
}

export interface SandboxChangeLogEntry {
  changeId: string;
  timestamp: string;
  description: string;
  phase: SimulationPhase;
}

// ============================================================
// Progress Tracking
// ============================================================

export interface SimulationProgress {
  currentPhase: SimulationPhase | null;
  completedPhases: SimulationPhase[];
  overallPercent: number; // 0-100
  phasePercents: Record<SimulationPhase, number>;
  startedAt: string | null;
  estimatedRemainingMs: number | null;
}

export type SimulationProgressCallback = (progress: SimulationProgress) => void;
