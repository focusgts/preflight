/**
 * GET /api/assessments/[id] — Get assessment details with full report
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getAssessment } from '@/lib/api/store';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const assessment = getAssessment(id);

    if (!assessment) {
      return error('NOT_FOUND', `Assessment ${id} not found`, 404);
    }

    // Enrich the response with computed summary data
    const totalFindings = assessment.findings.length;
    const criticalCount = assessment.findings.filter(
      (f) => f.severity === 'critical',
    ).length;
    const highCount = assessment.findings.filter(
      (f) => f.severity === 'high',
    ).length;
    const autoFixableCount = assessment.findings.filter(
      (f) => f.autoFixAvailable,
    ).length;
    const totalEstimatedHours = assessment.findings.reduce(
      (sum, f) => sum + f.estimatedHours,
      0,
    );

    const enriched = {
      ...assessment,
      summary: {
        totalFindings,
        criticalCount,
        highCount,
        autoFixableCount,
        manualFixCount: totalFindings - autoFixableCount,
        totalEstimatedHours,
        scoreBreakdown: {
          codeCompatibility: {
            score: assessment.codeCompatibilityScore,
            weight: 0.3,
            weighted: Math.round(assessment.codeCompatibilityScore * 0.3),
          },
          contentReadiness: {
            score: assessment.contentReadinessScore,
            weight: 0.2,
            weighted: Math.round(assessment.contentReadinessScore * 0.2),
          },
          integrationComplexity: {
            score: assessment.integrationComplexityScore,
            weight: 0.2,
            weighted: Math.round(assessment.integrationComplexityScore * 0.2),
          },
          configurationReadiness: {
            score: assessment.configurationReadinessScore,
            weight: 0.15,
            weighted: Math.round(assessment.configurationReadinessScore * 0.15),
          },
          compliance: {
            score: assessment.complianceScore,
            weight: 0.15,
            weighted: Math.round(assessment.complianceScore * 0.15),
          },
        },
      },
    };

    console.log(`[API] GET /api/assessments/${id}`);
    return success(enriched);
  } catch (err) {
    console.error('[API] GET /api/assessments/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get assessment', 500);
  }
}
