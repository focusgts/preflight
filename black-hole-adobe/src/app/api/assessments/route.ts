/**
 * GET  /api/assessments — List all assessments
 * POST /api/assessments — Create a standalone assessment
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  Severity,
  CompatibilityLevel,
  PhaseType,
} from '@/types';
import type { AssessmentResult } from '@/types';
import { success, error, paginated } from '@/lib/api/response';
import { listAssessments, createAssessment } from '@/lib/api/store';

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

    const codeScore = 70 + Math.round(Math.random() * 25);
    const contentScore = 65 + Math.round(Math.random() * 30);
    const integrationScore = 50 + Math.round(Math.random() * 40);
    const configScore = 60 + Math.round(Math.random() * 35);
    const complianceScore = 75 + Math.round(Math.random() * 25);
    const overallScore = Math.round(
      codeScore * 0.3 +
      contentScore * 0.2 +
      integrationScore * 0.2 +
      configScore * 0.15 +
      complianceScore * 0.15,
    );

    const totalWeeks = 8 + Math.round(Math.random() * 12);

    const assessment: AssessmentResult = {
      id: `assess-${uuidv4().slice(0, 8)}`,
      migrationProjectId: data.migrationProjectId,
      overallScore,
      codeCompatibilityScore: codeScore,
      contentReadinessScore: contentScore,
      integrationComplexityScore: integrationScore,
      configurationReadinessScore: configScore,
      complianceScore,
      findings: [
        {
          id: `f-${uuidv4().slice(0, 6)}`,
          category: 'General',
          subCategory: 'Platform Compatibility',
          severity: Severity.MEDIUM,
          compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
          title: `Platform migration from ${data.sourcePlatform} to ${data.targetPlatform}`,
          description: `Assessment of migration path from ${data.sourcePlatform} ${data.sourceVersion} to ${data.targetPlatform}.`,
          affectedPath: '/',
          remediationGuide: 'Follow the recommended migration playbook for this platform combination.',
          autoFixAvailable: true,
          estimatedHours: totalWeeks * 8,
          bpaPatternCode: null,
        },
      ],
      contentHealth: {
        totalPages: 500 + Math.round(Math.random() * 2000),
        totalAssets: 1000 + Math.round(Math.random() * 8000),
        totalContentFragments: Math.round(Math.random() * 150),
        totalExperienceFragments: Math.round(Math.random() * 40),
        duplicatesDetected: Math.round(Math.random() * 50),
        brokenReferences: Math.round(Math.random() * 20),
        metadataCompleteness: 60 + Math.round(Math.random() * 35),
        structuralIssues: Math.round(Math.random() * 8),
        totalSizeGB: Math.round((5 + Math.random() * 50) * 10) / 10,
        publishedPercentage: 70 + Math.round(Math.random() * 25),
      },
      integrationMap: [],
      riskFactors: [],
      estimatedTimeline: {
        totalWeeks,
        phases: [
          { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 1, endWeek: 1, parallelizable: false },
          { phase: PhaseType.PLANNING, durationWeeks: 1, startWeek: 2, endWeek: 2, parallelizable: false },
          { phase: PhaseType.CODE_MODERNIZATION, durationWeeks: Math.round(totalWeeks * 0.35), startWeek: 3, endWeek: 3 + Math.round(totalWeeks * 0.35) - 1, parallelizable: true },
          { phase: PhaseType.TESTING, durationWeeks: 2, startWeek: totalWeeks - 2, endWeek: totalWeeks - 1, parallelizable: false },
          { phase: PhaseType.CUTOVER, durationWeeks: 1, startWeek: totalWeeks, endWeek: totalWeeks, parallelizable: false },
        ],
        confidenceLevel: 0.7 + Math.round(Math.random() * 20) / 100,
      },
      estimatedCost: {
        platformFee: 10000,
        estimatedSIHours: totalWeeks * 20,
        estimatedSICost: totalWeeks * 20 * 200,
        totalEstimate: 10000 + totalWeeks * 20 * 200,
        currency: 'USD',
      },
      traditionalEstimate: {
        durationWeeks: Math.round(totalWeeks * 2.5),
        cost: Math.round((10000 + totalWeeks * 20 * 200) * 2.8),
        timeSavingsPercent: 60,
        costSavingsPercent: 64,
      },
      recommendations: [
        'Run automated compatibility checks before beginning transformation.',
        'Create a rollback plan before cutover.',
        'Validate all integrations in a staging environment first.',
      ],
      createdAt: now,
    };

    createAssessment(assessment);

    console.log(`[API] POST /api/assessments — created ${assessment.id}`);
    return success(assessment, 201);
  } catch (err) {
    console.error('[API] POST /api/assessments error:', err);
    return error('INTERNAL_ERROR', 'Failed to create assessment', 500);
  }
}
