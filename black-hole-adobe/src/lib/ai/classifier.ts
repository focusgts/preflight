/**
 * Black Hole - AI-Powered Classifier
 *
 * Enhances the rule-based SortEngine with Claude AI for higher-accuracy
 * classification. Falls back to SortEngine when AI is unavailable.
 */

import type { MigrationItem } from '@/types';
import {
  AdobeProduct,
  SEACategory,
  CompatibilityLevel,
} from '@/types';
import { SortEngine, type ClassificationResult } from '@/lib/engine/sort';
import { ClaudeClient, type ClaudeResponse } from './claude-client';
import { CLASSIFY_MIGRATION_ITEM } from './prompts';
import { DEFAULT_BATCH_CONFIG, type BatchConfig } from '@/config/ai-config';

// ============================================================
// Types
// ============================================================

export interface ClassifierOptions {
  /** Minimum AI confidence to accept. Below this, falls back to rule-based. */
  confidenceThreshold: number;
  /** Batch configuration for parallel classification. */
  batch: BatchConfig;
  /** Called for each classified item. */
  onItemClassified?: (result: ClassificationResult, fromAI: boolean) => void;
  /** Called on progress updates. */
  onProgress?: (completed: number, total: number) => void;
}

interface AIClassificationResponse {
  adobeProducts: string[];
  seaCategory: string;
  compatibilityLevel: string;
  effortHours: number;
  riskScore: number;
  confidence: number;
  tags: string[];
  reasoning: string;
}

const DEFAULT_OPTIONS: ClassifierOptions = {
  confidenceThreshold: 0.6,
  batch: DEFAULT_BATCH_CONFIG,
};

// ============================================================
// Classifier
// ============================================================

export class AIClassifier {
  private readonly client: ClaudeClient;
  private readonly sortEngine: SortEngine;
  private readonly options: ClassifierOptions;

  constructor(
    client: ClaudeClient,
    sortEngine?: SortEngine,
    options?: Partial<ClassifierOptions>,
  ) {
    this.client = client;
    this.sortEngine = sortEngine ?? new SortEngine();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Classify a single item. Uses AI if available, otherwise rule-based.
   */
  async classifyItem(item: MigrationItem): Promise<ClassificationResult> {
    // Try AI classification first
    if (this.client.available) {
      try {
        const aiResult = await this.classifyWithAI(item);
        if (aiResult && aiResult.confidence >= this.options.confidenceThreshold) {
          this.options.onItemClassified?.(aiResult, true);
          return aiResult;
        }
      } catch {
        // Fall through to rule-based
      }
    }

    // Fallback to rule-based SortEngine
    const result = this.sortEngine.classifyItem(item);
    this.options.onItemClassified?.(result, false);
    return result;
  }

  /**
   * Classify a batch of items with parallel AI calls.
   * Respects concurrency limits and falls back per-item on failure.
   */
  async classifyBatch(items: MigrationItem[]): Promise<ClassificationResult[]> {
    if (items.length === 0) return [];

    // If AI is not available, use rule-based for all
    if (!this.client.available) {
      const results = items.map((item) => this.sortEngine.classifyItem(item));
      results.forEach((r) => this.options.onItemClassified?.(r, false));
      return results;
    }

    const results: ClassificationResult[] = [];
    const { classifyBatchSize, maxConcurrency, batchDelayMs } = this.options.batch;

    // Process in batches
    for (let i = 0; i < items.length; i += classifyBatchSize) {
      const batch = items.slice(i, i + classifyBatchSize);

      // Process batch items with controlled concurrency
      const batchResults = await this.processWithConcurrency(
        batch,
        maxConcurrency,
        async (item) => this.classifyItem(item),
      );

      results.push(...batchResults);
      this.options.onProgress?.(results.length, items.length);

      // Delay between batches to respect rate limits
      if (i + classifyBatchSize < items.length && batchDelayMs > 0) {
        await sleep(batchDelayMs);
      }
    }

    return results;
  }

  /**
   * Classify with AI and merge with rule-based confidence.
   * When AI confidence is high, use AI result. When low, blend.
   */
  async classifyWithConfidenceBlend(
    item: MigrationItem,
  ): Promise<ClassificationResult> {
    const ruleResult = this.sortEngine.classifyItem(item);

    if (!this.client.available) return ruleResult;

    try {
      const aiResult = await this.classifyWithAI(item);
      if (!aiResult) return ruleResult;

      // If AI confidence is very high, use AI result directly
      if (aiResult.confidence >= 0.85) return aiResult;

      // Blend: use AI classification with rule-based effort/risk adjustments
      return {
        ...aiResult,
        effortHours: weightedAverage(
          aiResult.effortHours,
          ruleResult.effortHours,
          aiResult.confidence,
        ),
        riskScore: weightedAverage(
          aiResult.riskScore,
          ruleResult.riskScore,
          aiResult.confidence,
        ),
        confidence: Math.max(aiResult.confidence, ruleResult.confidence),
        reasoning: `AI: ${aiResult.reasoning} | Rule-based: ${ruleResult.reasoning}`,
      };
    } catch {
      return ruleResult;
    }
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private async classifyWithAI(
    item: MigrationItem,
  ): Promise<ClassificationResult | null> {
    const prompt = CLASSIFY_MIGRATION_ITEM({
      name: item.name,
      type: item.type,
      sourcePath: item.sourcePath,
    });

    const response: ClaudeResponse<AIClassificationResponse> | null =
      await this.client.classify<AIClassificationResponse>(prompt);

    if (!response) return null;

    const data = response.data;

    return {
      itemId: item.id,
      adobeProducts: validateProducts(data.adobeProducts),
      seaCategory: validateSEA(data.seaCategory),
      compatibilityLevel: validateCompatibility(data.compatibilityLevel),
      effortHours: clamp(data.effortHours, 0.1, 200),
      riskScore: clamp(data.riskScore, 0, 1),
      confidence: clamp(data.confidence, 0, 1),
      tags: Array.isArray(data.tags) ? data.tags : [],
      reasoning: data.reasoning || 'AI classification',
    };
  }

  private async processWithConcurrency<TIn, TOut>(
    items: TIn[],
    maxConcurrency: number,
    processor: (item: TIn) => Promise<TOut>,
  ): Promise<TOut[]> {
    const results: TOut[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      const tracked = promise.then(() => {
        executing.delete(tracked);
      });
      executing.add(tracked);

      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}

// ============================================================
// Validation Helpers
// ============================================================

const VALID_PRODUCTS = new Set(Object.values(AdobeProduct));
const VALID_SEA = new Set(Object.values(SEACategory));
const VALID_COMPAT = new Set(Object.values(CompatibilityLevel));

function validateProducts(products: string[]): AdobeProduct[] {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => VALID_PRODUCTS.has(p as AdobeProduct)) as AdobeProduct[];
}

function validateSEA(value: string): SEACategory {
  if (VALID_SEA.has(value as SEACategory)) return value as SEACategory;
  return SEACategory.SUPPORT;
}

function validateCompatibility(value: string): CompatibilityLevel {
  if (VALID_COMPAT.has(value as CompatibilityLevel)) return value as CompatibilityLevel;
  return CompatibilityLevel.COMPATIBLE;
}

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function weightedAverage(aiValue: number, ruleValue: number, aiWeight: number): number {
  return aiValue * aiWeight + ruleValue * (1 - aiWeight);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
