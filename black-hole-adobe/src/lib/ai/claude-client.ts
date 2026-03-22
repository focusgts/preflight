/**
 * Black Hole - Claude API Client
 *
 * Robust wrapper around the Anthropic SDK with three-tier model routing,
 * retry logic, rate-limit awareness, streaming support, cost tracking,
 * and graceful fallback when no API key is set.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { PromptPair } from './prompts';
import {
  type ModelTier,
  type AITask,
  type CostRecord,
  MODELS,
  TASK_MODEL_MAP,
  CostTracker,
  RATE_LIMITS,
  resolveAIConfig,
  type AIFeatureFlags,
} from '@/config/ai-config';

// ============================================================
// Types
// ============================================================

export interface ClaudeClientOptions {
  /** Override the API key (defaults to ANTHROPIC_API_KEY env var). */
  apiKey?: string;
  /** Override feature flags. */
  featureFlags?: Partial<AIFeatureFlags>;
  /** Optional cost tracker instance (shared across calls). */
  costTracker?: CostTracker;
}

export interface ClaudeResponse<T = unknown> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  durationMs: number;
  fromFallback: boolean;
}

export interface StreamCallbacks {
  onText?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

// ============================================================
// Rate Limiter
// ============================================================

class RateLimiter {
  private windows: Map<ModelTier, { timestamps: number[]; tokens: number[] }> = new Map();

  canProceed(tier: ModelTier, estimatedTokens: number): boolean {
    const limits = RATE_LIMITS[tier];
    const now = Date.now();
    const windowMs = 60_000;

    let window = this.windows.get(tier);
    if (!window) {
      window = { timestamps: [], tokens: [] };
      this.windows.set(tier, window);
    }

    // Purge entries older than 1 minute
    const cutoff = now - windowMs;
    while (window.timestamps.length > 0 && window.timestamps[0] < cutoff) {
      window.timestamps.shift();
      window.tokens.shift();
    }

    const requestCount = window.timestamps.length;
    const tokenCount = window.tokens.reduce((s, t) => s + t, 0);

    return (
      requestCount < limits.maxRequestsPerMinute &&
      tokenCount + estimatedTokens < limits.maxTokensPerMinute
    );
  }

  record(tier: ModelTier, tokens: number): void {
    let window = this.windows.get(tier);
    if (!window) {
      window = { timestamps: [], tokens: [] };
      this.windows.set(tier, window);
    }
    window.timestamps.push(Date.now());
    window.tokens.push(tokens);
  }

  async waitForCapacity(tier: ModelTier, estimatedTokens: number): Promise<void> {
    const maxWaitMs = 30_000;
    const start = Date.now();

    while (!this.canProceed(tier, estimatedTokens)) {
      if (Date.now() - start > maxWaitMs) {
        throw new ClaudeClientError(
          `Rate limit wait exceeded ${maxWaitMs}ms for ${tier}`,
          'RATE_LIMIT_TIMEOUT',
        );
      }
      await sleep(500);
    }
  }
}

// ============================================================
// Client
// ============================================================

export class ClaudeClient {
  private client: Anthropic | null = null;
  private readonly costTracker: CostTracker;
  private readonly rateLimiter = new RateLimiter();
  private readonly flags: AIFeatureFlags;
  private readonly isAvailable: boolean;

  constructor(options: ClaudeClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const config = resolveAIConfig(options.featureFlags);
    this.flags = config.flags;
    this.costTracker = options.costTracker ?? new CostTracker();

    if (apiKey && apiKey.length > 0) {
      this.client = new Anthropic({ apiKey });
      this.isAvailable = true;
    } else {
      this.isAvailable = false;
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /** Whether the AI client is available (API key set and AI enabled). */
  get available(): boolean {
    return this.isAvailable && this.flags.enableAI;
  }

  /** Get current cost summary. */
  get costs(): CostTracker {
    return this.costTracker;
  }

  /**
   * Send a structured prompt and parse the JSON response.
   * Falls back to null if AI is unavailable.
   */
  async complete<T = unknown>(
    task: AITask,
    prompt: PromptPair,
    tierOverride?: ModelTier,
  ): Promise<ClaudeResponse<T> | null> {
    if (!this.available || !this.client) return null;

    const tier = tierOverride ?? TASK_MODEL_MAP[task];
    const model = MODELS[tier];

    // Estimate tokens for rate limiting (rough: 4 chars per token)
    const estimatedInputTokens = Math.ceil(
      (prompt.system.length + prompt.user.length) / 4,
    );

    await this.rateLimiter.waitForCapacity(tier, estimatedInputTokens);

    const start = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= model.retries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: model.id,
          max_tokens: model.maxOutputTokens,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        });

        const durationMs = Date.now() - start;
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const costUSD = this.costTracker.calculateCost(tier, inputTokens, outputTokens);

        this.rateLimiter.record(tier, inputTokens + outputTokens);

        const costRecord: CostRecord = {
          task,
          model: tier,
          inputTokens,
          outputTokens,
          costUSD,
          durationMs,
          timestamp: new Date().toISOString(),
        };
        this.costTracker.record(costRecord);

        // Extract text content
        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new ClaudeClientError('No text content in response', 'EMPTY_RESPONSE');
        }

        const parsed = parseJsonResponse<T>(textBlock.text);

        return {
          data: parsed,
          model: model.id,
          inputTokens,
          outputTokens,
          costUSD,
          durationMs,
          fromFallback: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (isNonRetryable(error)) break;

        // Exponential backoff
        if (attempt < model.retries) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new ClaudeClientError(
      `Failed after ${model.retries + 1} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED',
      lastError ?? undefined,
    );
  }

  /**
   * Stream a response for long-running operations (e.g., code refactoring).
   * Returns the final parsed result after streaming completes.
   */
  async stream<T = unknown>(
    task: AITask,
    prompt: PromptPair,
    callbacks: StreamCallbacks,
    tierOverride?: ModelTier,
  ): Promise<ClaudeResponse<T> | null> {
    if (!this.available || !this.client) return null;

    const tier = tierOverride ?? TASK_MODEL_MAP[task];
    const model = MODELS[tier];

    const estimatedInputTokens = Math.ceil(
      (prompt.system.length + prompt.user.length) / 4,
    );
    await this.rateLimiter.waitForCapacity(tier, estimatedInputTokens);

    const start = Date.now();

    try {
      const stream = this.client.messages.stream({
        model: model.id,
        max_tokens: model.maxOutputTokens,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      let fullText = '';

      stream.on('text', (text) => {
        fullText += text;
        callbacks.onText?.(text);
      });

      const finalMessage = await stream.finalMessage();
      const durationMs = Date.now() - start;

      callbacks.onComplete?.(fullText);

      const inputTokens = finalMessage.usage.input_tokens;
      const outputTokens = finalMessage.usage.output_tokens;
      const costUSD = this.costTracker.calculateCost(tier, inputTokens, outputTokens);

      this.rateLimiter.record(tier, inputTokens + outputTokens);
      this.costTracker.record({
        task,
        model: tier,
        inputTokens,
        outputTokens,
        costUSD,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      const parsed = parseJsonResponse<T>(fullText);

      return {
        data: parsed,
        model: model.id,
        inputTokens,
        outputTokens,
        costUSD,
        durationMs,
        fromFallback: false,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw new ClaudeClientError(
        `Stream failed: ${err.message}`,
        'STREAM_ERROR',
        err,
      );
    }
  }

  /**
   * Classify a migration item. Convenience wrapper around complete().
   */
  async classify<T = unknown>(prompt: PromptPair): Promise<ClaudeResponse<T> | null> {
    return this.complete<T>('classify', prompt);
  }

  /**
   * Analyze code compatibility. Convenience wrapper around complete().
   */
  async analyzeCode<T = unknown>(prompt: PromptPair): Promise<ClaudeResponse<T> | null> {
    return this.complete<T>('analyzeCode', prompt);
  }

  /**
   * Refactor code using Opus with streaming.
   */
  async refactorCode<T = unknown>(
    prompt: PromptPair,
    callbacks: StreamCallbacks = {},
  ): Promise<ClaudeResponse<T> | null> {
    return this.stream<T>('refactorCode', prompt, callbacks);
  }

  /**
   * Generate XDM schema mapping.
   */
  async generateSchema<T = unknown>(
    prompt: PromptPair,
  ): Promise<ClaudeResponse<T> | null> {
    return this.complete<T>('generateSchema', prompt);
  }

  /**
   * Analyze migration readiness and generate a migration plan.
   */
  async analyzeMigration<T = unknown>(
    prompt: PromptPair,
  ): Promise<ClaudeResponse<T> | null> {
    return this.complete<T>('analyzeMigration', prompt);
  }
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a JSON response from Claude, handling markdown fences and
 * other common formatting quirks.
 */
function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try parsing directly
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find the first { ... } or [ ... ] block
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // Fall through
      }
    }

    throw new ClaudeClientError(
      `Failed to parse JSON response: ${cleaned.slice(0, 200)}...`,
      'JSON_PARSE_ERROR',
    );
  }
}

function isNonRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.AuthenticationError) return true;
  if (error instanceof Anthropic.PermissionDeniedError) return true;
  if (error instanceof Anthropic.NotFoundError) return true;
  if (error instanceof ClaudeClientError && error.code === 'JSON_PARSE_ERROR') {
    return true;
  }
  return false;
}

// ============================================================
// Error Class
// ============================================================

export class ClaudeClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ClaudeClientError';
  }
}
