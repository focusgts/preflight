/**
 * POST /api/migrations/[id]/regression — Run regression comparison
 * GET  /api/migrations/[id]/regression — Get latest regression report
 *
 * Implements ADR-034: content-based regression testing between
 * source and target environments.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import {
  runRegression,
  compareAgainstBaseline,
  type RegressionConfig,
  type RegressionReport,
  type BaselineSnapshot,
} from '@/lib/validation/regression-engine';

type RouteParams = { params: Promise<{ id: string }> };

// In-memory cache for regression reports (one per migration)
const reportCache = new Map<string, RegressionReport>();

// Shared baseline cache (used by baseline route, accessed here)
export const baselineCache = new Map<string, BaselineSnapshot>();

// ── POST: Run regression test ─────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const body = await request.json().catch(() => ({}));
    const {
      sourceUrl,
      targetUrl,
      pageLimit = 50,
      options = {},
    } = body as {
      sourceUrl?: string;
      targetUrl?: string;
      pageLimit?: number;
      options?: {
        checkSeo?: boolean;
        checkPerformance?: boolean;
        checkContent?: boolean;
        excludePatterns?: string[];
      };
    };

    // Resolve URLs: explicit params > migration environment URLs
    const resolvedSource = sourceUrl ?? migration.sourceEnvironment?.url;
    const resolvedTarget = targetUrl ?? migration.targetEnvironment?.url;

    if (!resolvedSource) {
      return error(
        'MISSING_SOURCE',
        'Source URL is required. Provide sourceUrl in the request body or set it on the migration source environment.',
        400,
      );
    }

    if (!resolvedTarget) {
      return error(
        'MISSING_TARGET',
        'Target URL is required. Provide targetUrl in the request body or set it on the migration target environment.',
        400,
      );
    }

    const clampedLimit = Math.min(Math.max(pageLimit, 1), 1000);

    const config: RegressionConfig = {
      sourceUrl: resolvedSource,
      targetUrl: resolvedTarget,
      pageLimit: clampedLimit,
      checkSeo: options.checkSeo ?? true,
      checkPerformance: options.checkPerformance ?? true,
      checkContent: options.checkContent ?? true,
      excludePatterns: options.excludePatterns ?? [],
    };

    // If a baseline exists, compare against it (faster -- only crawls target)
    const baseline = baselineCache.get(id);
    let report: RegressionReport;

    if (baseline) {
      report = await compareAgainstBaseline(baseline, config);
    } else {
      report = await runRegression(id, config);
    }

    reportCache.set(id, report);

    console.log(
      `[API] POST /api/migrations/${id}/regression — ${report.summary.pagesCompared} pages, ` +
      `${report.summary.matchRate}% match, ${report.summary.issuesFound} issues`,
    );

    return success(report);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/regression error:', err);
    return error('INTERNAL_ERROR', 'Failed to run regression test', 500);
  }
}

// ── GET: Retrieve latest regression report ────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const report = reportCache.get(id);
    if (!report) {
      return error(
        'NO_REPORT',
        `No regression report found for migration ${id}. Run POST first.`,
        404,
      );
    }

    return success(report);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/regression error:', err);
    return error('INTERNAL_ERROR', 'Failed to retrieve regression report', 500);
  }
}
