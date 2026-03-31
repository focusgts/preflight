/**
 * /api/monitoring/[migrationId]/baseline
 *
 * POST — Captures a new baseline snapshot for a migration
 * GET  — Returns the current stored baseline
 */

import { success, error } from '@/lib/api/response';
import {
  DriftMonitor,
  getBaseline,
} from '@/lib/monitoring/drift-monitor';

interface RouteContext {
  params: Promise<{ migrationId: string }>;
}

// ── POST: Capture a new baseline ─────────────────────────────

export async function POST(request: Request, context: RouteContext) {
  const { migrationId } = await context.params;

  let body: { siteUrl?: string };
  try {
    body = await request.json();
  } catch {
    return error('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const { siteUrl } = body;

  if (!siteUrl || typeof siteUrl !== 'string') {
    return error(
      'INVALID_INPUT',
      'Field "siteUrl" is required (the URL of the migrated site to monitor).',
      400,
    );
  }

  // Basic URL validation
  try {
    let u = siteUrl.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const parsed = new URL(u);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      throw new Error('Invalid hostname');
    }
  } catch {
    return error(
      'INVALID_URL',
      'Please provide a valid site URL.',
      400,
    );
  }

  try {
    const monitor = new DriftMonitor();
    const baseline = await monitor.captureBaseline(migrationId, siteUrl);

    console.log(
      `[DriftMonitor] Baseline captured for "${migrationId}" — url: ${siteUrl}, score: ${baseline.healthScore}`,
    );

    return success(baseline, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[DriftMonitor] Baseline capture failed for "${migrationId}":`,
      message,
    );

    if (message.includes('abort') || message.includes('timeout')) {
      return error(
        'SCAN_TIMEOUT',
        'The site took too long to respond while capturing baseline.',
        504,
      );
    }

    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      return error(
        'SITE_UNREACHABLE',
        'Could not resolve the domain. Please check the URL.',
        502,
      );
    }

    return error(
      'BASELINE_FAILED',
      `Failed to capture baseline: ${message}`,
      500,
    );
  }
}

// ── GET: Return current baseline ─────────────────────────────

export async function GET(request: Request, context: RouteContext) {
  const { migrationId } = await context.params;

  const baseline = getBaseline(migrationId);
  if (!baseline) {
    return error(
      'NOT_FOUND',
      `No baseline found for migration "${migrationId}".`,
      404,
    );
  }

  return success(baseline);
}
