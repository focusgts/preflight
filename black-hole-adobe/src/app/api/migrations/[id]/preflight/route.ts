/**
 * POST /api/migrations/[id]/preflight — Run Cloud Manager pre-flight on migration code
 * GET  /api/migrations/[id]/preflight — Return latest pre-flight report for a migration
 *
 * ADR-036: Cloud Manager Pre-Flight Simulation.
 * Validates migration code against quality gate rules that BPA does not cover.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import {
  PreFlightEngine,
  type PreFlightItem,
} from '@/lib/preflight/cloud-manager-rules';
import {
  storePreflightReport,
  getPreflightReport,
} from '@/lib/monitoring/drift-monitor';

type RouteParams = { params: Promise<{ id: string }> };

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

    // Gather files to analyse — either from migration phases or request body
    let items: PreFlightItem[] = [];

    // Try to extract code items from migration phases
    const migrationItems = migration.phases?.flatMap((p) => p.items) ?? [];
    if (migrationItems.length > 0) {
      // Build PreFlightItems from migration items that have sourcePath content
      // In a real implementation these would be fetched from the connector/storage
      items = migrationItems
        .filter((mi) => mi.sourcePath && mi.type)
        .map((mi) => ({
          path: mi.sourcePath,
          content: '', // placeholder — real impl would read from storage
        }))
        .filter((item) => item.content.length > 0);
    }

    // If no items from migration, accept uploaded code in request body
    if (items.length === 0) {
      const body = await request.json().catch(() => null);

      if (!body || !Array.isArray(body?.files) || body.files.length === 0) {
        return error(
          'NO_CODE',
          'No code available for pre-flight analysis. Either connect a source repository or provide files in the request body as { files: [{ path, content }] }.',
          422,
        );
      }

      items = (body.files as Array<{ path?: string; content?: string }>)
        .filter((f): f is PreFlightItem => typeof f.path === 'string' && typeof f.content === 'string')
        .map((f) => ({ path: f.path, content: f.content }));

      if (items.length === 0) {
        return error(
          'INVALID_FILES',
          'Files must be an array of { path: string, content: string } objects.',
          422,
        );
      }
    }

    const engine = new PreFlightEngine();
    const report = engine.runPreFlight(items);

    // Store the report for later retrieval (SQLite-backed)
    storePreflightReport(id, report);

    console.log(
      `[API] POST /api/migrations/${id}/preflight — ${report.findings.length} findings, ` +
      `${report.summary.blockers} blockers, success probability: ${report.successProbability}`,
    );

    return success(report, 201);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/preflight error:', err);
    return error('INTERNAL_ERROR', 'Failed to run pre-flight analysis', 500);
  }
}

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

    const report = getPreflightReport(id);

    if (!report) {
      return error(
        'NO_REPORT',
        `No pre-flight report found for migration ${id}. Run POST /api/migrations/${id}/preflight first.`,
        404,
      );
    }

    return success(report);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/preflight error:', err);
    return error('INTERNAL_ERROR', 'Failed to retrieve pre-flight report', 500);
  }
}
