/**
 * Black Hole - Core Engine Barrel Export
 *
 * Re-exports all engine classes, types, and error classes from a single
 * entry point for convenient consumption across the application.
 */

// Ingestion Engine
export { IngestEngine, IngestEngineError } from './ingest';
export type {
  IngestOptions,
  IngestProgress,
  IngestResult,
  IngestStats,
  IngestError,
  RawRecord,
  SourceConnector,
} from './ingest';

// Sort / Classification Engine
export { SortEngine, SortEngineError } from './sort';
export type {
  ClassificationResult,
  DuplicateGroup,
  SortOptions,
} from './sort';

// Distribution Engine
export { DistributeEngine, DistributeEngineError } from './distribute';
export type {
  RoutingRule,
  RouteResult,
  DistributionReport,
  DistributionError,
  DistributeOptions,
} from './distribute';

// Assessment Engine
export { AssessmentEngine, AssessmentEngineError } from './assessment';
export type {
  AssessmentOptions,
  AssessmentReport,
  CodeAnalysisInput,
  ContentAnalysisInput,
  IntegrationInput,
} from './assessment';

// Migration Orchestrator
export { MigrationOrchestrator, OrchestratorError } from './migration-orchestrator';
export type {
  MigrationEventType,
  MigrationEvent,
  MigrationEventHandler,
  OrchestratorOptions,
  MigrationProgress,
  PhaseProgress,
  MigrationPhaseError,
} from './migration-orchestrator';

// Validation Engine
export { ValidationEngine, ValidationEngineError } from './validator';
export type {
  ValidationReport,
  ValidationCategoryResult,
  ValidationIssue,
  SEOValidationInput,
  PerformanceBenchmark,
  ValidatorOptions,
} from './validator';
