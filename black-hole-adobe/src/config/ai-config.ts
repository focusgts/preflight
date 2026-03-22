/**
 * Black Hole - AI Configuration
 *
 * Centralised configuration for model selection, token limits, cost tracking,
 * and feature flags controlling AI vs rule-based fallback behaviour.
 */

// ============================================================
// Model Definitions
// ============================================================

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  maxOutputTokens: number;
  maxInputTokens: number;
  costPerInputToken: number;   // USD per token
  costPerOutputToken: number;  // USD per token
  timeoutMs: number;
  retries: number;
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  haiku: {
    id: 'claude-haiku-4-20250414',
    tier: 'haiku',
    maxOutputTokens: 4096,
    maxInputTokens: 200_000,
    costPerInputToken: 0.00000025,
    costPerOutputToken: 0.00000125,
    timeoutMs: 15_000,
    retries: 3,
  },
  sonnet: {
    id: 'claude-sonnet-4-20250514',
    tier: 'sonnet',
    maxOutputTokens: 8192,
    maxInputTokens: 200_000,
    costPerInputToken: 0.000003,
    costPerOutputToken: 0.000015,
    timeoutMs: 30_000,
    retries: 2,
  },
  opus: {
    id: 'claude-opus-4-20250514',
    tier: 'opus',
    maxOutputTokens: 16384,
    maxInputTokens: 200_000,
    costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075,
    timeoutMs: 60_000,
    retries: 1,
  },
};

// ============================================================
// Task-to-Model Routing
// ============================================================

export type AITask =
  | 'classify'
  | 'analyzeCode'
  | 'refactorCode'
  | 'generateSchema'
  | 'analyzeMigration'
  | 'analyzeContent'
  | 'assessRisk'
  | 'generateTestCases'
  | 'generateMigrationPlan';

/**
 * Default model routing: which tier handles each task type.
 * Can be overridden at runtime via AIFeatureFlags.
 */
export const TASK_MODEL_MAP: Record<AITask, ModelTier> = {
  classify: 'haiku',
  analyzeCode: 'sonnet',
  refactorCode: 'opus',
  generateSchema: 'sonnet',
  analyzeMigration: 'sonnet',
  analyzeContent: 'sonnet',
  assessRisk: 'sonnet',
  generateTestCases: 'sonnet',
  generateMigrationPlan: 'opus',
};

// ============================================================
// Feature Flags
// ============================================================

export interface AIFeatureFlags {
  /** Master switch: when false, all AI calls fall back to rule-based. */
  enableAI: boolean;
  /** Per-task overrides. When false, that task uses rule-based fallback. */
  enableClassification: boolean;
  enableCodeAnalysis: boolean;
  enableCodeRefactoring: boolean;
  enableSchemaMapping: boolean;
  enableContentAnalysis: boolean;
  enableRiskAssessment: boolean;
  enableMigrationPlanning: boolean;
  enableTestGeneration: boolean;
}

export const DEFAULT_FEATURE_FLAGS: AIFeatureFlags = {
  enableAI: true,
  enableClassification: true,
  enableCodeAnalysis: true,
  enableCodeRefactoring: true,
  enableSchemaMapping: true,
  enableContentAnalysis: true,
  enableRiskAssessment: true,
  enableMigrationPlanning: true,
  enableTestGeneration: true,
};

// ============================================================
// Cost Tracking
// ============================================================

export interface CostRecord {
  task: AITask;
  model: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  durationMs: number;
  timestamp: string;
}

export interface CostSummary {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  byTier: Record<ModelTier, { calls: number; costUSD: number }>;
  byTask: Record<string, { calls: number; costUSD: number }>;
}

export class CostTracker {
  private records: CostRecord[] = [];

  record(entry: CostRecord): void {
    this.records.push(entry);
  }

  calculateCost(model: ModelTier, inputTokens: number, outputTokens: number): number {
    const config = MODELS[model];
    return (
      inputTokens * config.costPerInputToken +
      outputTokens * config.costPerOutputToken
    );
  }

  getSummary(): CostSummary {
    const byTier: CostSummary['byTier'] = {
      haiku: { calls: 0, costUSD: 0 },
      sonnet: { calls: 0, costUSD: 0 },
      opus: { calls: 0, costUSD: 0 },
    };
    const byTask: Record<string, { calls: number; costUSD: number }> = {};

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;

    for (const r of this.records) {
      totalCost += r.costUSD;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;

      byTier[r.model].calls++;
      byTier[r.model].costUSD += r.costUSD;

      if (!byTask[r.task]) byTask[r.task] = { calls: 0, costUSD: 0 };
      byTask[r.task].calls++;
      byTask[r.task].costUSD += r.costUSD;
    }

    return {
      totalCostUSD: Math.round(totalCost * 1_000_000) / 1_000_000,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCalls: this.records.length,
      byTier,
      byTask,
    };
  }

  reset(): void {
    this.records = [];
  }
}

// ============================================================
// Rate Limiting
// ============================================================

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
}

export const RATE_LIMITS: Record<ModelTier, RateLimitConfig> = {
  haiku: { maxRequestsPerMinute: 500, maxTokensPerMinute: 2_000_000 },
  sonnet: { maxRequestsPerMinute: 200, maxTokensPerMinute: 800_000 },
  opus: { maxRequestsPerMinute: 100, maxTokensPerMinute: 400_000 },
};

// ============================================================
// Batch Configuration
// ============================================================

export interface BatchConfig {
  /** Max items per batch for classification. */
  classifyBatchSize: number;
  /** Max concurrent API calls. */
  maxConcurrency: number;
  /** Delay between batches (ms) to respect rate limits. */
  batchDelayMs: number;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  classifyBatchSize: 20,
  maxConcurrency: 5,
  batchDelayMs: 100,
};

/**
 * Resolve the active AI config from environment + overrides.
 */
export function resolveAIConfig(overrides?: Partial<AIFeatureFlags>): {
  apiKeySet: boolean;
  flags: AIFeatureFlags;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const apiKeySet = Boolean(apiKey && apiKey.length > 0);

  const flags: AIFeatureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    ...overrides,
  };

  // If no API key, force all AI features off
  if (!apiKeySet) {
    flags.enableAI = false;
  }

  return { apiKeySet, flags };
}
