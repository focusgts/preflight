/**
 * POST /api/migrations/[id]/assess — Start assessment for a migration
 *
 * ADR-040: Uses real AssessmentEngine when migration items are available,
 * falls back to deterministic scoring from migration metadata otherwise.
 * No Math.random() — repeated assessments produce consistent results.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  MigrationStatus,
  PhaseType,
} from '@/types';
import type { AssessmentResult, MigrationPhase } from '@/types';
import { success, error } from '@/lib/api/response';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import {
  getMigration,
  updateMigration,
  createAssessment,
  listConnectors,
} from '@/lib/api/store';
import {
  AssessmentEngine,
  type ContentAnalysisInput,
  type IntegrationInput,
} from '@/lib/engine/assessment';
import {
  computeDeterministicScores,
  generateDeterministicFindings,
  generateDeterministicRisks,
  generateDeterministicRecommendations,
  generateDeterministicContentHealth,
  type DeterministicScoreInputs,
} from '@/lib/engine/deterministic-scoring';
import { effortEstimator } from '@/lib/engine/effort-estimator';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const ip = _request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, resetAt } = checkRateLimit(ip, RATE_LIMITS.authenticatedWrite);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Try again later.', 429, { retryAfter: Math.ceil((resetAt - Date.now()) / 1000) });
  }

  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // Only allow assessment from DRAFT status
    if (migration.status !== MigrationStatus.DRAFT) {
      return error(
        'INVALID_STATE',
        `Cannot assess migration in ${migration.status} state. Must be in draft state.`,
        409,
      );
    }

    // If an assessment already exists, return conflict
    if (migration.assessment) {
      return error(
        'ALREADY_ASSESSED',
        'Migration already has an assessment. Create a new migration to re-assess.',
        409,
      );
    }

    const now = new Date().toISOString();

    // Gather migration items from existing phases (if any)
    const migrationItems = migration.phases?.flatMap((p) => p.items) ?? [];

    // Get connected connectors
    const connectors = listConnectors().filter((c) => c.status === 'connected');

    let assessment: AssessmentResult;

    // ── Path A: Real engine analysis when migration items exist ──
    if (migrationItems.length > 0) {
      const engine = new AssessmentEngine();

      // Build content input from migration metadata or deterministic defaults
      const contentInput: ContentAnalysisInput = {
        totalPages: (migration.sourceEnvironment.metadata?.pageCount as number) ?? 500,
        totalAssets: (migration.sourceEnvironment.metadata?.assetCount as number) ?? 1000,
        totalContentFragments: (migration.sourceEnvironment.metadata?.contentFragments as number) ?? 50,
        totalExperienceFragments: (migration.sourceEnvironment.metadata?.experienceFragments as number) ?? 15,
        references: [],
        metadata: [],
        totalSizeGB: (migration.sourceEnvironment.metadata?.totalSizeGB as number) ?? 20,
        publishedCount: (migration.sourceEnvironment.metadata?.publishedCount as number) ?? 400,
      };

      // Build integration inputs from connected connectors
      const integrationInputs: IntegrationInput[] = connectors.map((c) => ({
        id: c.id,
        name: c.name,
        type: (c.type as IntegrationInput['type']) ?? 'api',
        authType: (c.connectionDetails?.authType as string) ?? 'api_key',
        dataFlow: 'outbound' as const,
        sourceConfig: c.connectionDetails ?? {},
      }));

      assessment = await engine.runAssessment(
        migration,
        migrationItems,
        contentInput,
        integrationInputs,
      );

      // Override the ID to use our format
      assessment.id = `assess-${uuidv4().slice(0, 8)}`;
      assessment.createdAt = now;

    // ── Path B: Deterministic scoring from migration metadata ──
    } else {
      const scoreInputs: DeterministicScoreInputs = {
        orgName: migration.organizationName,
        sourcePlatform: migration.sourceEnvironment.platform,
        sourceVersion: migration.sourceEnvironment.version,
        targetPlatform: migration.targetEnvironment.platform,
        migrationType: migration.migrationType,
        componentCount: migration.sourceEnvironment.metadata?.componentCount as number | undefined,
        pageCount: migration.sourceEnvironment.metadata?.pageCount as number | undefined,
        assetCount: migration.sourceEnvironment.metadata?.assetCount as number | undefined,
        integrationCount: connectors.length || undefined,
        complianceFrameworks: migration.complianceRequirements,
      };

      const scores = computeDeterministicScores(scoreInputs);
      const findings = generateDeterministicFindings(scoreInputs);
      const risks = generateDeterministicRisks(scoreInputs, scores, findings);
      const recommendations = generateDeterministicRecommendations(scoreInputs, scores, findings);
      const contentHealth = generateDeterministicContentHealth({
        seed: `${migration.organizationName}:${migration.sourceEnvironment.platform}:${migration.sourceEnvironment.version}`,
        pageCount: scoreInputs.pageCount,
        assetCount: scoreInputs.assetCount,
      });

      const { totalWeeks, confidenceLevel } = scores;

      // Build timeline phases proportionally
      const codeModWeeks = Math.max(1, Math.round(totalWeeks * 0.25));
      const contentMigWeeks = Math.max(1, Math.round(totalWeeks * 0.20));
      const testWeeks = Math.max(1, Math.round(totalWeeks * 0.15));

      const siHourlyRate = 200;
      const platformFee = 25000;
      const estimatedSIHours = totalWeeks * 20;
      const estimatedSICost = estimatedSIHours * siHourlyRate;
      const totalEstimate = platformFee + estimatedSICost;

      const traditionalMultiplier = 3.5;
      const tradWeeks = Math.round(totalWeeks * traditionalMultiplier);
      const tradCost = Math.round(estimatedSICost * traditionalMultiplier);
      const timeSavingsPercent = Math.round(((tradWeeks - totalWeeks) / tradWeeks) * 100);
      const costSavingsPercent = Math.round(((tradCost - totalEstimate) / tradCost) * 100);

      assessment = {
        id: `assess-${uuidv4().slice(0, 8)}`,
        migrationProjectId: id,
        overallScore: scores.overallScore,
        codeCompatibilityScore: scores.codeScore,
        contentReadinessScore: scores.contentScore,
        integrationComplexityScore: scores.integrationScore,
        configurationReadinessScore: scores.configScore,
        complianceScore: scores.complianceScore,
        findings,
        contentHealth,
        integrationMap: [],
        riskFactors: risks,
        estimatedTimeline: {
          totalWeeks,
          phases: [
            { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 1, endWeek: 1, parallelizable: false },
            { phase: PhaseType.PLANNING, durationWeeks: 1, startWeek: 2, endWeek: 2, parallelizable: false },
            { phase: PhaseType.CODE_MODERNIZATION, durationWeeks: codeModWeeks, startWeek: 3, endWeek: 3 + codeModWeeks - 1, parallelizable: true },
            { phase: PhaseType.CONTENT_MIGRATION, durationWeeks: contentMigWeeks, startWeek: 3, endWeek: 3 + contentMigWeeks - 1, parallelizable: true },
            { phase: PhaseType.TESTING, durationWeeks: testWeeks, startWeek: totalWeeks - testWeeks, endWeek: totalWeeks - 1, parallelizable: false },
            { phase: PhaseType.CUTOVER, durationWeeks: 1, startWeek: totalWeeks, endWeek: totalWeeks, parallelizable: false },
          ],
          confidenceLevel,
        },
        estimatedCost: {
          platformFee,
          estimatedSIHours,
          estimatedSICost,
          totalEstimate,
          currency: 'USD',
        },
        traditionalEstimate: {
          durationWeeks: tradWeeks,
          cost: tradCost,
          timeSavingsPercent: Math.max(0, timeSavingsPercent),
          costSavingsPercent: Math.max(0, costSavingsPercent),
        },
        recommendations,
        createdAt: now,
      };
    }

    createAssessment(assessment);

    // Generate effort estimate from the assessment (ADR-032)
    const effortEstimate = effortEstimator.estimate(assessment, id, {}, migration);

    // Derive risk score from overall assessment score
    // Risk score expressed on a 0-100 scale (higher = riskier)
    const riskScore = Math.max(1, Math.round(100 - assessment.overallScore));

    // Build assessment phase record
    const assessPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.ASSESSMENT,
      name: 'Assessment',
      status: MigrationStatus.COMPLETED,
      progress: 100,
      items: [],
      startedAt: now,
      completedAt: now,
      estimatedDuration: 24,
      actualDuration: 0,
    };

    updateMigration(id, {
      status: MigrationStatus.ASSESSED,
      assessment,
      riskScore,
      estimatedDurationWeeks: assessment.estimatedTimeline.totalWeeks,
      estimatedCost: assessment.estimatedCost.totalEstimate,
      progress: 10,
      phases: [assessPhase],
    });

    console.log(`[API] POST /api/migrations/${id}/assess — assessment ${assessment.id} created`);
    return success({ assessment, effortEstimate }, 201);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/assess error:', err);
    return error('INTERNAL_ERROR', 'Failed to start assessment', 500);
  }
}
