/**
 * RuVector Pattern Recorder
 *
 * Records migration patterns for the learning network. Stores code fixes,
 * migration outcomes, content signatures, integration templates, and
 * assessment profiles into their respective namespaces with auto-generated
 * embeddings for similarity search.
 */

import { v4 as uuid } from 'uuid';
import { RuVectorClient, type VectorEntry } from './client';
import { generateEmbedding } from './embeddings';

// ============================================================
// Types
// ============================================================

export interface CodeFixRecord {
  id: string;
  problem: string;
  fix: string;
  outcome: 'success' | 'partial' | 'failure';
  successCount: number;
  totalCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MigrationOutcomeRecord {
  id: string;
  assessmentProfile: AssessmentProfileSummary;
  actualTimelineWeeks: number;
  actualCost: number;
  issues: string[];
  completedAt: string;
}

export interface ContentPatternRecord {
  id: string;
  contentSignature: string;
  duplicateOf: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationTemplateRecord {
  id: string;
  sourceType: string;
  targetType: string;
  config: Record<string, unknown>;
  validated: boolean;
  usageCount: number;
  createdAt: string;
}

export interface AssessmentProfileSummary {
  environment: string;
  migrationType: string;
  scores: {
    overall: number;
    codeCompatibility: number;
    contentReadiness: number;
    integrationComplexity: number;
  };
  findings: string[];
}

// ============================================================
// Recorder
// ============================================================

export class PatternRecorder {
  constructor(private readonly client: RuVectorClient) {}

  // ----------------------------------------------------------
  // Code Fix Patterns
  // ----------------------------------------------------------

  /**
   * Record a code fix pattern in fix_library.
   * Auto-embeds the problem description for similarity search.
   */
  async recordCodeFix(
    problem: string,
    fix: string,
    outcome: 'success' | 'partial' | 'failure',
    metadata: Record<string, unknown> = {},
  ): Promise<VectorEntry> {
    const id = uuid();
    const embedding = generateEmbedding(problem);

    // Check if a similar fix already exists to update counts
    const existing = await this.client.search(
      'fix_library',
      embedding,
      1,
      0.95,
    );

    let successCount = outcome === 'success' ? 1 : 0;
    let totalCount = 1;
    let key = `fix-${id}`;

    if (existing.length > 0) {
      // Update existing pattern's counts
      const prevData = JSON.parse(existing[0].entry.value) as CodeFixRecord;
      successCount = prevData.successCount + (outcome === 'success' ? 1 : 0);
      totalCount = prevData.totalCount + 1;
      key = existing[0].entry.key;
    }

    const record: CodeFixRecord = {
      id,
      problem,
      fix,
      outcome,
      successCount,
      totalCount,
      metadata,
      createdAt: new Date().toISOString(),
    };

    return this.client.store(
      'fix_library',
      key,
      JSON.stringify(record),
      embedding,
      ['code-fix', `outcome:${outcome}`],
      { problem, outcome, successCount, totalCount },
    );
  }

  // ----------------------------------------------------------
  // Migration Outcomes
  // ----------------------------------------------------------

  /**
   * Record a migration outcome in risk_outcomes.
   * Links assessment profiles to actual results for risk prediction.
   */
  async recordMigrationOutcome(
    assessmentProfile: AssessmentProfileSummary,
    actualTimelineWeeks: number,
    actualCost: number,
    issues: string[],
  ): Promise<VectorEntry> {
    const id = uuid();
    const description = [
      `Environment: ${assessmentProfile.environment}`,
      `Type: ${assessmentProfile.migrationType}`,
      `Overall score: ${assessmentProfile.scores.overall}`,
      `Code compatibility: ${assessmentProfile.scores.codeCompatibility}`,
      `Content readiness: ${assessmentProfile.scores.contentReadiness}`,
      `Issues: ${issues.join(', ')}`,
    ].join('. ');

    const embedding = generateEmbedding(description);

    const record: MigrationOutcomeRecord = {
      id,
      assessmentProfile,
      actualTimelineWeeks,
      actualCost,
      issues,
      completedAt: new Date().toISOString(),
    };

    return this.client.store(
      'risk_outcomes',
      `outcome-${id}`,
      JSON.stringify(record),
      embedding,
      [
        'migration-outcome',
        `type:${assessmentProfile.migrationType}`,
        `env:${assessmentProfile.environment}`,
      ],
      {
        actualTimelineWeeks,
        actualCost,
        issueCount: issues.length,
        overallScore: assessmentProfile.scores.overall,
      },
    );
  }

  // ----------------------------------------------------------
  // Content Patterns
  // ----------------------------------------------------------

  /**
   * Record a content signature in content_signatures.
   * Used for duplicate detection across migrations.
   */
  async recordContentPattern(
    contentSignature: string,
    duplicateOf: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<VectorEntry> {
    const id = uuid();
    const embedding = generateEmbedding(contentSignature);

    const record: ContentPatternRecord = {
      id,
      contentSignature,
      duplicateOf,
      metadata,
      createdAt: new Date().toISOString(),
    };

    const tags = ['content-signature'];
    if (duplicateOf) tags.push('duplicate');

    return this.client.store(
      'content_signatures',
      `content-${id}`,
      JSON.stringify(record),
      embedding,
      tags,
      metadata,
    );
  }

  // ----------------------------------------------------------
  // Integration Templates
  // ----------------------------------------------------------

  /**
   * Record an integration template in integration_templates.
   * Indexed by source and target type for lookup.
   */
  async recordIntegrationTemplate(
    sourceType: string,
    targetType: string,
    config: Record<string, unknown>,
    validated: boolean,
  ): Promise<VectorEntry> {
    const templateKey = `${sourceType}-to-${targetType}`;
    const description = `Integration template from ${sourceType} to ${targetType}`;
    const embedding = generateEmbedding(description);

    // Check for existing template with same key
    const existing = await this.client.retrieve(
      'integration_templates',
      templateKey,
    );

    let usageCount = 1;
    if (existing) {
      const prev = JSON.parse(existing.value) as IntegrationTemplateRecord;
      usageCount = prev.usageCount + 1;
    }

    const id = uuid();
    const record: IntegrationTemplateRecord = {
      id,
      sourceType,
      targetType,
      config,
      validated,
      usageCount,
      createdAt: new Date().toISOString(),
    };

    return this.client.store(
      'integration_templates',
      templateKey,
      JSON.stringify(record),
      embedding,
      [
        'integration-template',
        `source:${sourceType}`,
        `target:${targetType}`,
        validated ? 'validated' : 'unvalidated',
      ],
      { sourceType, targetType, validated, usageCount },
    );
  }

  // ----------------------------------------------------------
  // Assessment Profiles
  // ----------------------------------------------------------

  /**
   * Record an assessment profile in assessment_profiles.
   * Captures the full environment/score/findings snapshot.
   */
  async recordAssessmentProfile(
    environment: string,
    scores: AssessmentProfileSummary['scores'],
    findings: string[],
  ): Promise<VectorEntry> {
    const id = uuid();
    const description = [
      `Assessment for ${environment}`,
      `Overall: ${scores.overall}`,
      `Code: ${scores.codeCompatibility}`,
      `Content: ${scores.contentReadiness}`,
      `Integration: ${scores.integrationComplexity}`,
      `Findings: ${findings.slice(0, 10).join(', ')}`,
    ].join('. ');

    const embedding = generateEmbedding(description);

    const profile: AssessmentProfileSummary = {
      environment,
      migrationType: 'unknown', // Set at the assessment level
      scores,
      findings,
    };

    return this.client.store(
      'assessment_profiles',
      `profile-${id}`,
      JSON.stringify(profile),
      embedding,
      [
        'assessment-profile',
        `env:${environment}`,
        `score:${Math.round(scores.overall / 10) * 10}`,
      ],
      { environment, ...scores },
    );
  }
}
