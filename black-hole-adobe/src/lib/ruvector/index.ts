/**
 * RuVector Integration Layer
 *
 * Barrel export for the RuVector vector database integration.
 * Provides in-process vector storage with cosine similarity search,
 * pattern recording/matching, trajectory tracking, and local embeddings.
 */

// Client
export { RuVectorClient, RuVectorClientError } from './client';
export type { VectorEntry, SearchResult, VectorStoreStats } from './client';

// Embeddings
export {
  generateEmbedding,
  cosineSimilarity,
  batchEmbed,
  RuVectorEmbeddingError,
} from './embeddings';
export type { EmbeddingVector } from './embeddings';

// Pattern Recorder
export { PatternRecorder } from './pattern-recorder';
export type {
  CodeFixRecord,
  MigrationOutcomeRecord,
  ContentPatternRecord,
  IntegrationTemplateRecord,
  AssessmentProfileSummary,
} from './pattern-recorder';

// Pattern Matcher
export { PatternMatcher } from './pattern-matcher';
export type {
  FixMatch,
  RiskPrediction,
  TimelineEstimation,
  ContentDuplicate,
  IntegrationTemplateMatch,
} from './pattern-matcher';

// Trajectory Recorder
export {
  TrajectoryRecorder,
  TrajectoryError,
} from './trajectory';
export type {
  TrajectoryEntry,
  QueryTrajectory,
  FeedbackTrajectory,
  OutcomeTrajectory,
} from './trajectory';

// Config (re-export for convenience)
export type {
  RuVectorConfig,
  RuVectorNamespace,
  RuVectorFeatureFlags,
  NamespaceDefinition,
} from '@/config/ruvector-config';

export {
  DEFAULT_RUVECTOR_CONFIG,
  RUVECTOR_NAMESPACES,
  VALID_NAMESPACES,
  EMBEDDING_DIMENSIONS,
} from '@/config/ruvector-config';
