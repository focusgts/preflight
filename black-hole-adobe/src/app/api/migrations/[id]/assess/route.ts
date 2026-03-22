/**
 * POST /api/migrations/[id]/assess — Start assessment for a migration
 *
 * Transitions the migration to ASSESSING status, generates a simulated
 * assessment result, and stores it. In production this would kick off
 * an asynchronous assessment pipeline.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  MigrationStatus,
  Severity,
  CompatibilityLevel,
  PhaseType,
} from '@/types';
import type { AssessmentResult, MigrationPhase } from '@/types';
import { success, error } from '@/lib/api/response';
import {
  getMigration,
  updateMigration,
  createAssessment,
} from '@/lib/api/store';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
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

    // Generate assessment (in production, this would be async with AI analysis)
    const codeScore = randomScore(55, 95);
    const contentScore = randomScore(60, 98);
    const integrationScore = randomScore(40, 90);
    const configScore = randomScore(60, 95);
    const complianceScore = randomScore(70, 100);
    const overallScore = Math.round(
      codeScore * 0.3 +
      contentScore * 0.2 +
      integrationScore * 0.2 +
      configScore * 0.15 +
      complianceScore * 0.15,
    );

    const totalWeeks = Math.round(8 + Math.random() * 16);
    const riskScore = Math.round((1 - overallScore / 100) * 100) / 100;

    const assessment: AssessmentResult = {
      id: `assess-${uuidv4().slice(0, 8)}`,
      migrationProjectId: id,
      overallScore,
      codeCompatibilityScore: codeScore,
      contentReadinessScore: contentScore,
      integrationComplexityScore: integrationScore,
      configurationReadinessScore: configScore,
      complianceScore,
      findings: [
        {
          id: `f-${uuidv4().slice(0, 6)}`,
          category: 'Code Compatibility',
          subCategory: 'Deprecated APIs',
          severity: Severity.HIGH,
          compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
          title: 'Deprecated API usage detected',
          description:
            'Several deprecated API calls were found that require manual migration to their modern equivalents.',
          affectedPath: '/src/main',
          remediationGuide:
            'Replace deprecated API calls with their recommended alternatives. Refer to the migration guide for specific replacements.',
          autoFixAvailable: false,
          estimatedHours: 16,
          bpaPatternCode: 'DEP-API-001',
        },
        {
          id: `f-${uuidv4().slice(0, 6)}`,
          category: 'Configuration',
          subCategory: 'Environment Config',
          severity: Severity.MEDIUM,
          compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
          title: 'Configuration format requires update',
          description:
            'Environment configuration files use a legacy format that can be automatically converted.',
          affectedPath: '/config',
          remediationGuide:
            'Run the automated config converter to update all configuration files to the target format.',
          autoFixAvailable: true,
          estimatedHours: 2,
          bpaPatternCode: 'CFG-FMT-001',
        },
        {
          id: `f-${uuidv4().slice(0, 6)}`,
          category: 'Content',
          subCategory: 'Asset Quality',
          severity: Severity.LOW,
          compatibilityLevel: CompatibilityLevel.COMPATIBLE,
          title: 'Oversized assets detected',
          description:
            'Some assets exceed recommended size limits. Consider optimising before migration.',
          affectedPath: '/content/dam',
          remediationGuide:
            'Use the bulk asset optimiser to resize images and compress videos before migration.',
          autoFixAvailable: true,
          estimatedHours: 4,
          bpaPatternCode: null,
        },
      ],
      contentHealth: {
        totalPages: Math.round(200 + Math.random() * 3000),
        totalAssets: Math.round(500 + Math.random() * 10000),
        totalContentFragments: Math.round(10 + Math.random() * 200),
        totalExperienceFragments: Math.round(5 + Math.random() * 50),
        duplicatesDetected: Math.round(Math.random() * 100),
        brokenReferences: Math.round(Math.random() * 30),
        metadataCompleteness: randomScore(60, 95),
        structuralIssues: Math.round(Math.random() * 10),
        totalSizeGB: Math.round((5 + Math.random() * 80) * 10) / 10,
        publishedPercentage: randomScore(60, 95),
      },
      integrationMap: [],
      riskFactors: [
        {
          id: `risk-${uuidv4().slice(0, 6)}`,
          severity: Severity.MEDIUM,
          category: 'Technical',
          description: 'Custom code may require manual refactoring',
          probability: 0.6,
          impact: 'Potential timeline extension of 2-3 weeks',
          mitigation: 'Begin code review early and allocate dedicated engineering resources.',
        },
      ],
      estimatedTimeline: {
        totalWeeks,
        phases: [
          { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 1, endWeek: 1, parallelizable: false },
          { phase: PhaseType.PLANNING, durationWeeks: 1, startWeek: 2, endWeek: 2, parallelizable: false },
          { phase: PhaseType.CODE_MODERNIZATION, durationWeeks: Math.round(totalWeeks * 0.3), startWeek: 3, endWeek: 3 + Math.round(totalWeeks * 0.3) - 1, parallelizable: true },
          { phase: PhaseType.CONTENT_MIGRATION, durationWeeks: Math.round(totalWeeks * 0.2), startWeek: 3, endWeek: 3 + Math.round(totalWeeks * 0.2) - 1, parallelizable: true },
          { phase: PhaseType.TESTING, durationWeeks: Math.round(totalWeeks * 0.15), startWeek: totalWeeks - 3, endWeek: totalWeeks - 1, parallelizable: false },
          { phase: PhaseType.CUTOVER, durationWeeks: 1, startWeek: totalWeeks, endWeek: totalWeeks, parallelizable: false },
        ],
        confidenceLevel: Math.round((0.65 + Math.random() * 0.3) * 100) / 100,
      },
      estimatedCost: {
        platformFee: 10000 + Math.round(Math.random() * 15000),
        estimatedSIHours: totalWeeks * 20,
        estimatedSICost: totalWeeks * 20 * 200,
        totalEstimate: 10000 + Math.round(Math.random() * 15000) + totalWeeks * 20 * 200,
        currency: 'USD',
      },
      traditionalEstimate: {
        durationWeeks: Math.round(totalWeeks * 2.5),
        cost: Math.round((10000 + totalWeeks * 20 * 200) * 3),
        timeSavingsPercent: 60,
        costSavingsPercent: 67,
      },
      recommendations: [
        'Address high-severity findings before beginning transformation phase.',
        'Run automated fixers for all auto-fixable issues to reduce manual effort.',
        'Perform a content audit to remove duplicate and unused assets.',
      ],
      createdAt: now,
    };

    createAssessment(assessment);

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
      estimatedDurationWeeks: totalWeeks,
      estimatedCost: assessment.estimatedCost.totalEstimate,
      progress: 10,
      phases: [assessPhase],
    });

    console.log(`[API] POST /api/migrations/${id}/assess — assessment ${assessment.id} created`);
    return success(assessment, 201);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/assess error:', err);
    return error('INTERNAL_ERROR', 'Failed to start assessment', 500);
  }
}

function randomScore(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}
