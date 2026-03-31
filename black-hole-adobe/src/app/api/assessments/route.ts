/**
 * GET  /api/assessments — List all assessments
 * POST /api/assessments — Create a standalone assessment
 *
 * ADR-040: Uses real AssessmentEngine when migration data is available,
 * falls back to deterministic scoring from metadata otherwise.
 * No Math.random() — repeated assessments produce consistent results.
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  PhaseType,
} from '@/types';
import type { AssessmentResult } from '@/types';
import { success, error, paginated } from '@/lib/api/response';
import {
  listAssessments,
  createAssessment,
  getMigration,
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

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '20')));
    const migrationId = params.get('migrationId');

    let items = listAssessments();

    if (migrationId) {
      items = items.filter((a) => a.migrationProjectId === migrationId);
    }

    // Sort newest first
    items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    console.log(`[API] GET /api/assessments — ${totalItems} total`);
    return paginated(paged, page, pageSize, totalItems);
  } catch (err) {
    console.error('[API] GET /api/assessments error:', err);
    return error('INTERNAL_ERROR', 'Failed to list assessments', 500);
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const standaloneAssessmentSchema = z.object({
  migrationProjectId: z.string().min(1),
  sourcePlatform: z.string().min(1),
  sourceVersion: z.string().min(1),
  targetPlatform: z.string().min(1),
  notes: z.string().optional().default(''),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = standaloneAssessmentSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    // Attempt to load migration project for richer analysis
    const migration = getMigration(data.migrationProjectId);
    const migrationItems = migration?.phases?.flatMap((p) => p.items) ?? [];
    const connectors = listConnectors().filter((c) => c.status === 'connected');

    let assessment: AssessmentResult;

    // ── Path A: Real engine analysis when migration items exist ──
    if (migration && migrationItems.length > 0) {
      const engine = new AssessmentEngine();

      // Build content input from connector extraction or deterministic defaults
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

    // ── Path B: Deterministic scoring from metadata ──
    } else {
      const orgName = migration?.organizationName ?? data.migrationProjectId;
      const scoreInputs: DeterministicScoreInputs = {
        orgName,
        sourcePlatform: data.sourcePlatform,
        sourceVersion: data.sourceVersion,
        targetPlatform: data.targetPlatform,
        migrationType: migration?.migrationType,
        componentCount: migration?.sourceEnvironment.metadata?.componentCount as number | undefined,
        pageCount: migration?.sourceEnvironment.metadata?.pageCount as number | undefined,
        assetCount: migration?.sourceEnvironment.metadata?.assetCount as number | undefined,
        integrationCount: connectors.length || undefined,
        complianceFrameworks: migration?.complianceRequirements,
      };

      const scores = computeDeterministicScores(scoreInputs);
      const findings = generateDeterministicFindings(scoreInputs);
      const risks = generateDeterministicRisks(scoreInputs, scores, findings);
      const recommendations = generateDeterministicRecommendations(scoreInputs, scores, findings);
      const contentHealth = generateDeterministicContentHealth({
        seed: `${orgName}:${data.sourcePlatform}:${data.sourceVersion}`,
        pageCount: scoreInputs.pageCount,
        assetCount: scoreInputs.assetCount,
      });

      const { totalWeeks, confidenceLevel } = scores;

      // Build timeline phases
      const codeModWeeks = Math.max(1, Math.round(totalWeeks * 0.25));
      const contentMigWeeks = Math.max(1, Math.round(totalWeeks * 0.20));
      const testWeeks = Math.max(1, Math.round(totalWeeks * 0.10));

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
        migrationProjectId: data.migrationProjectId,
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

    console.log(`[API] POST /api/assessments — created ${assessment.id}`);
    return success(assessment, 201);
  } catch (err) {
    console.error('[API] POST /api/assessments error:', err);
    return error('INTERNAL_ERROR', 'Failed to create assessment', 500);
  }
}
