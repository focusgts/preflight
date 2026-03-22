/**
 * RuVector Pattern Matcher
 *
 * Queries the pattern database for matches using cosine similarity search.
 * Provides domain-specific methods for finding similar fixes, predicting
 * risk, estimating timelines, detecting duplicates, and looking up
 * integration templates.
 */

import { RuVectorClient, type SearchResult } from './client';
import { generateEmbedding } from './embeddings';
import type {
  CodeFixRecord,
  MigrationOutcomeRecord,
  ContentPatternRecord,
  IntegrationTemplateRecord,
  AssessmentProfileSummary,
} from './pattern-recorder';

// ============================================================
// Types
// ============================================================

export interface FixMatch {
  problem: string;
  fix: string;
  outcome: 'success' | 'partial' | 'failure';
  similarity: number;
  confidence: number;
  successRate: number;
}

export interface RiskPrediction {
  predictedRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-1
  confidence: number;
  basedOnSamples: number;
  commonIssues: string[];
  reasoning: string;
}

export interface TimelineEstimation {
  estimatedWeeks: number;
  confidence: number;
  basedOnSamples: number;
  rangeMin: number;
  rangeMax: number;
  reasoning: string;
}

export interface ContentDuplicate {
  originalKey: string;
  contentSignature: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface IntegrationTemplateMatch {
  sourceType: string;
  targetType: string;
  config: Record<string, unknown>;
  validated: boolean;
  usageCount: number;
  similarity: number;
}

// ============================================================
// Matcher
// ============================================================

export class PatternMatcher {
  constructor(private readonly client: RuVectorClient) {}

  // ----------------------------------------------------------
  // Fix Matching
  // ----------------------------------------------------------

  /**
   * Find proven fixes for similar problems.
   * Returns matches sorted by similarity with confidence scores.
   */
  async findSimilarFixes(
    problemDescription: string,
    limit: number = 5,
  ): Promise<FixMatch[]> {
    const embedding = generateEmbedding(problemDescription);
    const results = await this.client.search('fix_library', embedding, limit);

    return results.map((result) => {
      const record = JSON.parse(result.entry.value) as CodeFixRecord;
      const successRate =
        record.totalCount > 0
          ? record.successCount / record.totalCount
          : 0;

      return {
        problem: record.problem,
        fix: record.fix,
        outcome: record.outcome,
        similarity: result.similarity,
        confidence: this.calculateConfidence(result, record.totalCount),
        successRate,
      };
    });
  }

  // ----------------------------------------------------------
  // Risk Prediction
  // ----------------------------------------------------------

  /**
   * Predict risk based on similar past migration outcomes.
   * Analyzes historical data to estimate risk level and common issues.
   */
  async predictRisk(
    assessmentProfile: AssessmentProfileSummary,
  ): Promise<RiskPrediction> {
    const description = [
      `Environment: ${assessmentProfile.environment}`,
      `Type: ${assessmentProfile.migrationType}`,
      `Overall score: ${assessmentProfile.scores.overall}`,
      `Code: ${assessmentProfile.scores.codeCompatibility}`,
      `Content: ${assessmentProfile.scores.contentReadiness}`,
      `Integration: ${assessmentProfile.scores.integrationComplexity}`,
    ].join('. ');

    const embedding = generateEmbedding(description);
    const results = await this.client.search(
      'risk_outcomes',
      embedding,
      10,
      0.5, // Lower threshold for risk to capture more data
    );

    if (results.length === 0) {
      return this.fallbackRiskPrediction(assessmentProfile);
    }

    // Aggregate outcomes weighted by similarity
    const issueFrequency = new Map<string, number>();
    let weightedIssueCount = 0;
    let totalWeight = 0;

    for (const result of results) {
      const record = JSON.parse(result.entry.value) as MigrationOutcomeRecord;
      const weight = result.similarity;
      totalWeight += weight;
      weightedIssueCount += record.issues.length * weight;

      for (const issue of record.issues) {
        const normalized = issue.toLowerCase().trim();
        issueFrequency.set(
          normalized,
          (issueFrequency.get(normalized) ?? 0) + weight,
        );
      }
    }

    const avgIssues = totalWeight > 0 ? weightedIssueCount / totalWeight : 0;
    const riskScore = Math.min(1, avgIssues / 10); // Normalize: 10+ issues = max risk

    // Adjust risk score based on assessment scores
    const scoreAdjustment =
      (100 - assessmentProfile.scores.overall) / 200; // 0-0.5 range
    const adjustedRisk = Math.min(1, riskScore * 0.6 + scoreAdjustment * 0.4);

    // Top common issues
    const sortedIssues = Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    const riskLevel = this.riskLevelFromScore(adjustedRisk);
    const confidence = Math.min(
      0.95,
      0.3 + results.length * 0.065,
    );

    return {
      predictedRiskLevel: riskLevel,
      riskScore: Math.round(adjustedRisk * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      basedOnSamples: results.length,
      commonIssues: sortedIssues,
      reasoning:
        `Risk prediction based on ${results.length} similar migration(s). ` +
        `Average issue count: ${avgIssues.toFixed(1)}. ` +
        `Assessment score adjustment: ${(scoreAdjustment * 100).toFixed(0)}%.`,
    };
  }

  // ----------------------------------------------------------
  // Timeline Estimation
  // ----------------------------------------------------------

  /**
   * Estimate timeline from historical data for similar assessments.
   */
  async estimateTimeline(
    assessmentProfile: AssessmentProfileSummary,
  ): Promise<TimelineEstimation> {
    const description = [
      `Environment: ${assessmentProfile.environment}`,
      `Type: ${assessmentProfile.migrationType}`,
      `Overall score: ${assessmentProfile.scores.overall}`,
      `Code: ${assessmentProfile.scores.codeCompatibility}`,
      `Content: ${assessmentProfile.scores.contentReadiness}`,
    ].join('. ');

    const embedding = generateEmbedding(description);
    const results = await this.client.search(
      'risk_outcomes',
      embedding,
      10,
      0.5,
    );

    if (results.length === 0) {
      return this.fallbackTimelineEstimation(assessmentProfile);
    }

    // Weighted average of actual timelines
    let weightedWeeks = 0;
    let totalWeight = 0;
    const timelines: number[] = [];

    for (const result of results) {
      const record = JSON.parse(result.entry.value) as MigrationOutcomeRecord;
      const weight = result.similarity;
      weightedWeeks += record.actualTimelineWeeks * weight;
      totalWeight += weight;
      timelines.push(record.actualTimelineWeeks);
    }

    const estimatedWeeks =
      totalWeight > 0
        ? Math.round(weightedWeeks / totalWeight)
        : 12;

    timelines.sort((a, b) => a - b);
    const rangeMin = timelines[0];
    const rangeMax = timelines[timelines.length - 1];

    const confidence = Math.min(0.9, 0.25 + results.length * 0.065);

    return {
      estimatedWeeks,
      confidence: Math.round(confidence * 100) / 100,
      basedOnSamples: results.length,
      rangeMin,
      rangeMax,
      reasoning:
        `Timeline estimated from ${results.length} similar migration(s). ` +
        `Range: ${rangeMin}-${rangeMax} weeks.`,
    };
  }

  // ----------------------------------------------------------
  // Duplicate Content Detection
  // ----------------------------------------------------------

  /**
   * Find semantically similar content for duplicate detection.
   */
  async findDuplicateContent(
    contentText: string,
    threshold: number = 0.85,
  ): Promise<ContentDuplicate[]> {
    const embedding = generateEmbedding(contentText);
    const results = await this.client.search(
      'content_signatures',
      embedding,
      20,
      threshold,
    );

    return results.map((result) => {
      const record = JSON.parse(result.entry.value) as ContentPatternRecord;
      return {
        originalKey: result.entry.key,
        contentSignature: record.contentSignature,
        similarity: result.similarity,
        metadata: record.metadata,
      };
    });
  }

  // ----------------------------------------------------------
  // Integration Templates
  // ----------------------------------------------------------

  /**
   * Find matching integration configuration templates.
   * First tries exact key lookup, then falls back to similarity search.
   */
  async getIntegrationTemplate(
    sourceType: string,
    targetType: string,
  ): Promise<IntegrationTemplateMatch | null> {
    // Try exact lookup first
    const templateKey = `${sourceType}-to-${targetType}`;
    const exact = await this.client.retrieve(
      'integration_templates',
      templateKey,
    );

    if (exact) {
      const record = JSON.parse(exact.value) as IntegrationTemplateRecord;
      return {
        sourceType: record.sourceType,
        targetType: record.targetType,
        config: record.config,
        validated: record.validated,
        usageCount: record.usageCount,
        similarity: 1.0,
      };
    }

    // Fallback to similarity search
    const description = `Integration template from ${sourceType} to ${targetType}`;
    const embedding = generateEmbedding(description);
    const results = await this.client.search(
      'integration_templates',
      embedding,
      1,
      0.7,
    );

    if (results.length === 0) return null;

    const record = JSON.parse(
      results[0].entry.value,
    ) as IntegrationTemplateRecord;
    return {
      sourceType: record.sourceType,
      targetType: record.targetType,
      config: record.config,
      validated: record.validated,
      usageCount: record.usageCount,
      similarity: results[0].similarity,
    };
  }

  // ----------------------------------------------------------
  // Confidence Scoring
  // ----------------------------------------------------------

  /**
   * Calculate confidence score for a search result.
   * Based on similarity, sample count, and recency.
   */
  getConfidenceScore(result: SearchResult): number {
    return this.calculateConfidence(result, 1);
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private calculateConfidence(
    result: SearchResult,
    sampleCount: number,
  ): number {
    // Similarity contributes 60%
    const similarityFactor = result.similarity * 0.6;

    // Sample count contributes 25% (diminishing returns)
    const sampleFactor = Math.min(0.25, Math.log2(sampleCount + 1) * 0.05);

    // Recency contributes 15%
    const updatedAt = new Date(result.entry.updatedAt).getTime();
    const now = Date.now();
    const ageMs = now - updatedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0, 0.15 - ageDays * 0.001);

    return Math.min(
      1,
      Math.round((similarityFactor + sampleFactor + recencyFactor) * 100) / 100,
    );
  }

  private riskLevelFromScore(
    score: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 0.25) return 'low';
    if (score < 0.5) return 'medium';
    if (score < 0.75) return 'high';
    return 'critical';
  }

  private fallbackRiskPrediction(
    profile: AssessmentProfileSummary,
  ): RiskPrediction {
    // Rule-based fallback when no historical data exists
    const avgScore =
      (profile.scores.overall +
        profile.scores.codeCompatibility +
        profile.scores.contentReadiness) /
      3;
    const riskScore = Math.round((1 - avgScore / 100) * 100) / 100;

    return {
      predictedRiskLevel: this.riskLevelFromScore(riskScore),
      riskScore,
      confidence: 0.3,
      basedOnSamples: 0,
      commonIssues: [],
      reasoning:
        'No historical data available. Using rule-based estimation from assessment scores.',
    };
  }

  private fallbackTimelineEstimation(
    profile: AssessmentProfileSummary,
  ): TimelineEstimation {
    // Rule-based fallback
    const complexity = 100 - profile.scores.overall;
    const estimatedWeeks = Math.max(4, Math.round(complexity / 5));

    return {
      estimatedWeeks,
      confidence: 0.25,
      basedOnSamples: 0,
      rangeMin: Math.max(2, estimatedWeeks - 4),
      rangeMax: estimatedWeeks + 6,
      reasoning:
        'No historical data available. Using rule-based estimation from assessment scores.',
    };
  }
}
