/**
 * POST /api/migrations/[id]/regression/baseline — Capture baseline snapshot
 * GET  /api/migrations/[id]/regression/baseline — Retrieve stored baseline
 *
 * Captures a pre-migration baseline of the source site for later comparison.
 * The baseline stores page inventory, metadata, and content metrics.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import { captureBaseline } from '@/lib/validation/regression-engine';
import { baselineCache } from '../route';

type RouteParams = { params: Promise<{ id: string }> };

// ── POST: Capture baseline ────────────────────────────────────

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
      pageLimit = 50,
      excludePatterns = [],
    } = body as {
      sourceUrl?: string;
      pageLimit?: number;
      excludePatterns?: string[];
    };

    const resolvedSource = sourceUrl ?? migration.sourceEnvironment?.url;

    if (!resolvedSource) {
      return error(
        'MISSING_SOURCE',
        'Source URL is required. Provide sourceUrl in the request body or set it on the migration source environment.',
        400,
      );
    }

    const clampedLimit = Math.min(Math.max(pageLimit, 1), 1000);

    const baseline = await captureBaseline(
      id,
      resolvedSource,
      clampedLimit,
      excludePatterns,
    );

    baselineCache.set(id, baseline);

    console.log(
      `[API] POST /api/migrations/${id}/regression/baseline — ` +
      `${baseline.pageCount} pages captured in ${baseline.durationMs}ms`,
    );

    return success(baseline);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/regression/baseline error:', err);
    return error('INTERNAL_ERROR', 'Failed to capture baseline snapshot', 500);
  }
}

// ── GET: Retrieve stored baseline ─────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const baseline = baselineCache.get(id);
    if (!baseline) {
      return error(
        'NO_BASELINE',
        `No baseline snapshot found for migration ${id}. Run POST first to capture one.`,
        404,
      );
    }

    return success(baseline);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/regression/baseline error:', err);
    return error('INTERNAL_ERROR', 'Failed to retrieve baseline snapshot', 500);
  }
}
