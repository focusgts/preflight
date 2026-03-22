/**
 * GET /api/reports/[id] — Get migration/assessment report
 *
 * Generates a comprehensive report for a migration, including assessment
 * results, phase progress, risk analysis, and recommendations.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration, getAssessmentByMigration, getAssessment } from '@/lib/api/store';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const reportType = request.nextUrl.searchParams.get('type') ?? 'migration';

    if (reportType === 'assessment') {
      return buildAssessmentReport(id);
    }

    return buildMigrationReport(id);
  } catch (err) {
    console.error('[API] GET /api/reports/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to generate report', 500);
  }
}

async function buildMigrationReport(id: string): Promise<Response> {
  const migration = getMigration(id);

  if (!migration) {
    return error('NOT_FOUND', `Migration ${id} not found`, 404);
  }

  const assessment = migration.assessment ?? getAssessmentByMigration(id) ?? null;

  // Compute phase summary
  const phaseSummary = migration.phases.map((phase) => ({
    name: phase.name,
    type: phase.type,
    status: phase.status,
    progress: phase.progress,
    itemCount: phase.items.length,
    completedItems: phase.items.filter((i) => i.status === 'completed').length,
    failedItems: phase.items.filter((i) => i.status === 'failed').length,
    estimatedDuration: phase.estimatedDuration,
    actualDuration: phase.actualDuration,
  }));

  // Compute cost analysis
  const costAnalysis = {
    estimated: migration.estimatedCost,
    actual: migration.actualCost,
    variance: migration.actualCost !== null
      ? migration.actualCost - migration.estimatedCost
      : null,
    variancePercent: migration.actualCost !== null
      ? Math.round(
          ((migration.actualCost - migration.estimatedCost) /
            migration.estimatedCost) *
            100,
        )
      : null,
    traditional: assessment?.traditionalEstimate ?? null,
  };

  // Compute risk summary
  const riskSummary = assessment
    ? {
        overallScore: migration.riskScore,
        riskLevel:
          migration.riskScore > 0.7
            ? 'critical'
            : migration.riskScore > 0.4
              ? 'high'
              : migration.riskScore > 0.2
                ? 'medium'
                : 'low',
        factors: assessment.riskFactors,
        topRisk: assessment.riskFactors.length > 0
          ? assessment.riskFactors.sort(
              (a, b) => b.probability - a.probability,
            )[0]
          : null,
      }
    : null;

  const report = {
    id: `report-${id}`,
    type: 'migration' as const,
    generatedAt: new Date().toISOString(),
    migration: {
      id: migration.id,
      name: migration.name,
      organization: migration.organizationName,
      migrationType: migration.migrationType,
      status: migration.status,
      progress: migration.progress,
      createdAt: migration.createdAt,
      targetCompletionDate: migration.targetCompletionDate,
      completedAt: migration.completedAt,
    },
    assessment: assessment
      ? {
          overallScore: assessment.overallScore,
          scores: {
            codeCompatibility: assessment.codeCompatibilityScore,
            contentReadiness: assessment.contentReadinessScore,
            integrationComplexity: assessment.integrationComplexityScore,
            configurationReadiness: assessment.configurationReadinessScore,
            compliance: assessment.complianceScore,
          },
          findingsSummary: {
            total: assessment.findings.length,
            critical: assessment.findings.filter((f) => f.severity === 'critical').length,
            high: assessment.findings.filter((f) => f.severity === 'high').length,
            medium: assessment.findings.filter((f) => f.severity === 'medium').length,
            low: assessment.findings.filter((f) => f.severity === 'low').length,
            autoFixable: assessment.findings.filter((f) => f.autoFixAvailable).length,
          },
          contentHealth: assessment.contentHealth,
          integrationCount: assessment.integrationMap.length,
        }
      : null,
    phases: phaseSummary,
    costAnalysis,
    riskSummary,
    recommendations: assessment?.recommendations ?? [],
    complianceRequirements: migration.complianceRequirements,
    productsInScope: migration.productsInScope,
  };

  console.log(`[API] GET /api/reports/${id} — migration report`);
  return success(report);
}

async function buildAssessmentReport(id: string): Promise<Response> {
  const assessment = getAssessment(id) ?? getAssessmentByMigration(id);

  if (!assessment) {
    return error('NOT_FOUND', `Assessment for ${id} not found`, 404);
  }

  const report = {
    id: `report-assess-${assessment.id}`,
    type: 'assessment' as const,
    generatedAt: new Date().toISOString(),
    assessment,
    analysis: {
      readinessLevel:
        assessment.overallScore >= 80
          ? 'ready'
          : assessment.overallScore >= 60
            ? 'ready_with_work'
            : assessment.overallScore >= 40
              ? 'significant_work_needed'
              : 'not_recommended',
      blockerCount: assessment.findings.filter(
        (f) => f.compatibilityLevel === 'blocker',
      ).length,
      estimatedEffortHours: assessment.findings.reduce(
        (sum, f) => sum + f.estimatedHours,
        0,
      ),
      automationRate:
        assessment.findings.length > 0
          ? Math.round(
              (assessment.findings.filter((f) => f.autoFixAvailable).length /
                assessment.findings.length) *
                100,
            )
          : 100,
      savingsVsTraditional: {
        timeSavingsWeeks:
          assessment.traditionalEstimate.durationWeeks -
          assessment.estimatedTimeline.totalWeeks,
        costSavings:
          assessment.traditionalEstimate.cost -
          assessment.estimatedCost.totalEstimate,
        timeSavingsPercent: assessment.traditionalEstimate.timeSavingsPercent,
        costSavingsPercent: assessment.traditionalEstimate.costSavingsPercent,
      },
    },
  };

  console.log(`[API] GET /api/reports/${id}?type=assessment — assessment report`);
  return success(report);
}
