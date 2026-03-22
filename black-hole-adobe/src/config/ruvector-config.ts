/**
 * RuVector Configuration
 *
 * Namespace definitions, similarity thresholds, embedding dimensions,
 * persistence paths, and feature flags for the RuVector integration layer.
 */

// ============================================================
// Namespace Definitions
// ============================================================

export interface NamespaceDefinition {
  name: string;
  description: string;
  defaultThreshold: number;
  category: 'navigator' | 'migration';
}

/** All 14 RuVector namespaces: 7 Navigator + 7 Black Hole migration. */
export const RUVECTOR_NAMESPACES: Record<string, NamespaceDefinition> = {
  // Navigator namespaces
  knowledge: {
    name: 'knowledge',
    description: 'General knowledge base entries and documentation',
    defaultThreshold: 0.7,
    category: 'navigator',
  },
  tickets: {
    name: 'tickets',
    description: 'Support tickets and issue tracking entries',
    defaultThreshold: 0.75,
    category: 'navigator',
  },
  time_patterns: {
    name: 'time_patterns',
    description: 'Time-based patterns for scheduling and estimation',
    defaultThreshold: 0.7,
    category: 'navigator',
  },
  roi_patterns: {
    name: 'roi_patterns',
    description: 'Return on investment patterns from past projects',
    defaultThreshold: 0.7,
    category: 'navigator',
  },
  assignment_patterns: {
    name: 'assignment_patterns',
    description: 'Resource assignment and team allocation patterns',
    defaultThreshold: 0.7,
    category: 'navigator',
  },
  transcripts: {
    name: 'transcripts',
    description: 'Meeting and conversation transcripts',
    defaultThreshold: 0.65,
    category: 'navigator',
  },
  memories: {
    name: 'memories',
    description: 'Agent and system memory entries',
    defaultThreshold: 0.7,
    category: 'navigator',
  },

  // Black Hole migration namespaces
  migration_patterns: {
    name: 'migration_patterns',
    description: 'Recorded migration patterns and strategies',
    defaultThreshold: 0.75,
    category: 'migration',
  },
  code_fingerprints: {
    name: 'code_fingerprints',
    description: 'Code structural fingerprints for similarity matching',
    defaultThreshold: 0.8,
    category: 'migration',
  },
  content_signatures: {
    name: 'content_signatures',
    description: 'Content hashes and signatures for duplicate detection',
    defaultThreshold: 0.85,
    category: 'migration',
  },
  risk_outcomes: {
    name: 'risk_outcomes',
    description: 'Historical risk assessment outcomes for prediction',
    defaultThreshold: 0.7,
    category: 'migration',
  },
  assessment_profiles: {
    name: 'assessment_profiles',
    description: 'Migration assessment profiles and scores',
    defaultThreshold: 0.7,
    category: 'migration',
  },
  fix_library: {
    name: 'fix_library',
    description: 'Proven code fixes indexed by problem signature',
    defaultThreshold: 0.75,
    category: 'migration',
  },
  integration_templates: {
    name: 'integration_templates',
    description: 'Integration configuration templates by source/target type',
    defaultThreshold: 0.8,
    category: 'migration',
  },
} as const;

export type RuVectorNamespace = keyof typeof RUVECTOR_NAMESPACES;

/** All valid namespace names as an array. */
export const VALID_NAMESPACES: string[] = Object.keys(RUVECTOR_NAMESPACES);

// ============================================================
// Embedding Configuration
// ============================================================

/** Dimensionality for all embeddings. */
export const EMBEDDING_DIMENSIONS = 384;

/** Number of character n-gram characters (trigrams). */
export const NGRAM_SIZE = 3;

// ============================================================
// Persistence Configuration
// ============================================================

export interface PersistenceConfig {
  vectorStorePath: string;
  trajectoryStorePath: string;
  autoSaveIntervalMs: number;
  maxEntriesPerNamespace: number;
}

export const DEFAULT_PERSISTENCE: PersistenceConfig = {
  vectorStorePath: 'data/ruvector.json',
  trajectoryStorePath: 'data/trajectories.json',
  autoSaveIntervalMs: 30_000,
  maxEntriesPerNamespace: 10_000,
};

// ============================================================
// Feature Flags
// ============================================================

export interface RuVectorFeatureFlags {
  /** Enable persistence to JSON files. */
  persistenceEnabled: boolean;
  /** Enable trajectory recording for continuous learning. */
  trajectoryRecording: boolean;
  /** Enable auto-save on mutation operations. */
  autoSaveOnMutation: boolean;
  /** Enable HNSW indexing (future: swap to pgvector). */
  hnswIndexing: boolean;
  /** Enable GNN-enhanced search (future: full RuVector). */
  gnnEnhancedSearch: boolean;
  /** Enable SONA auto-tuning (future: full RuVector). */
  sonaAutoTuning: boolean;
}

export const DEFAULT_FEATURE_FLAGS: RuVectorFeatureFlags = {
  persistenceEnabled: true,
  trajectoryRecording: true,
  autoSaveOnMutation: true,
  hnswIndexing: false,    // Future: pgvector HNSW
  gnnEnhancedSearch: false, // Future: full RuVector
  sonaAutoTuning: false,    // Future: full RuVector
};

// ============================================================
// Full Config
// ============================================================

export interface RuVectorConfig {
  persistence: PersistenceConfig;
  features: RuVectorFeatureFlags;
  embeddingDimensions: number;
  ngramSize: number;
}

export const DEFAULT_RUVECTOR_CONFIG: RuVectorConfig = {
  persistence: DEFAULT_PERSISTENCE,
  features: DEFAULT_FEATURE_FLAGS,
  embeddingDimensions: EMBEDDING_DIMENSIONS,
  ngramSize: NGRAM_SIZE,
};
