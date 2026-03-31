/**
 * GET  /api/migrations/[id]/estimate — Effort estimate for a migration
 * POST /api/migrations/[id]/estimate — Customized estimate with parameters
 *
 * ADR-032: Effort Estimation Engine. Translates assessment findings into
 * developer-weeks, cost ranges, and team timelines. If no assessment exists,
 * returns a preliminary estimate from migration metadata.
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { getMigration, getAssessmentByMigration } from '@/lib/api/store';
import { effortEstimator, type EstimateOptions } from '@/lib/engine/effort-estimator';

type RouteParams = { params: Promise<{ id: string }> };

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // Try to use existing assessment for a richer estimate
    const assessment = getAssessmentByMigration(id);

    if (assessment) {
      const estimate = effortEstimator.estimate(assessment, id);
      console.log(`[API] GET /api/migrations/${id}/estimate — detailed estimate (${assessment.findings.length} findings)`);
      return success(estimate);
    }

    // No assessment: produce preliminary estimate from metadata
    const estimate = effortEstimator.estimateFromMetadata(migration);
    console.log(`[API] GET /api/migrations/${id}/estimate — preliminary estimate (no assessment)`);
    return success(estimate);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/estimate error:', err);
    return error('INTERNAL_ERROR', 'Failed to generate effort estimate', 500);
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const estimateOptionsSchema = z.object({
  blendedRate: z.number().min(50).max(1000).optional(),
  premiumRate: z.number().min(100).max(2000).optional(),
  teamSize: z.number().min(1).max(50).optional(),
  complianceOverhead: z.number().min(0).max(1).optional(),
  contentPages: z.number().min(0).optional(),
  osgiBundleCount: z.number().min(0).optional(),
  integrationCount: z.number().min(0).optional(),
  siteCount: z.number().min(1).optional(),
  dataSource: z.enum(['external-scan', 'assessment', 'full-codebase']).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const body = await request.json();
    const parsed = estimateOptionsSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const options: EstimateOptions = parsed.data;

    // Try assessment-based estimate first
    const assessment = getAssessmentByMigration(id);

    if (assessment) {
      const estimate = effortEstimator.estimate(assessment, id, options);
      console.log(`[API] POST /api/migrations/${id}/estimate — customized detailed estimate`);
      return success(estimate);
    }

    // Fall back to metadata-based estimate with custom options
    const estimate = effortEstimator.estimateFromMetadata(migration, options);
    console.log(`[API] POST /api/migrations/${id}/estimate — customized preliminary estimate`);
    return success(estimate);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/estimate error:', err);
    return error('INTERNAL_ERROR', 'Failed to generate effort estimate', 500);
  }
}
