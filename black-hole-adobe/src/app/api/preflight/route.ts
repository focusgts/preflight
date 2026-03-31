/**
 * POST /api/preflight — Standalone Cloud Manager pre-flight check
 *
 * ADR-036: Cloud Manager Pre-Flight Simulation.
 * Accepts code files directly (no migration required) and returns a pre-flight report.
 * Enables the "drop your code, check it" demo flow.
 *
 * Request body:
 *   { files: [{ path: string, content: string }] }
 *
 * Response:
 *   PreFlightReport with findings, success probability, and remediation guidance.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import {
  PreFlightEngine,
  type PreFlightItem,
} from '@/lib/preflight/cloud-manager-rules';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body?.files) || body.files.length === 0) {
      return error(
        'MISSING_FILES',
        'Request body must include a "files" array with at least one entry: { files: [{ path: string, content: string }] }.',
        422,
      );
    }

    const items: PreFlightItem[] = (body.files as Array<{ path?: string; content?: string }>)
      .filter((f): f is PreFlightItem => typeof f.path === 'string' && typeof f.content === 'string' && f.content.length > 0)
      .map((f) => ({ path: f.path, content: f.content }));

    if (items.length === 0) {
      return error(
        'INVALID_FILES',
        'No valid files found. Each file must have a non-empty "path" (string) and "content" (string).',
        422,
      );
    }

    const engine = new PreFlightEngine();
    const report = engine.runPreFlight(items);

    console.log(
      `[API] POST /api/preflight — ${items.length} files scanned, ` +
      `${report.findings.length} findings, success probability: ${report.successProbability}`,
    );

    return success(report, 200);
  } catch (err) {
    console.error('[API] POST /api/preflight error:', err);
    return error('INTERNAL_ERROR', 'Failed to run pre-flight analysis', 500);
  }
}
