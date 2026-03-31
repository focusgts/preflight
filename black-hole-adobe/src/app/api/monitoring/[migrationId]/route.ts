/**
 * /api/monitoring/[migrationId]
 *
 * GET  — Returns drift monitoring status (latest check, history, alert level)
 * POST — Triggers a new drift check against the stored baseline
 * DELETE — Removes monitoring for this migration (baseline + history)
 */

import { success, error } from '@/lib/api/response';
import {
  DriftMonitor,
  getBaseline,
  getDriftHistory,
  deleteMonitoring,
} from '@/lib/monitoring/drift-monitor';

interface RouteContext {
  params: Promise<{ migrationId: string }>;
}

// ── GET: Current monitoring status ───────────────────────────

export async function GET(request: Request, context: RouteContext) {
  const { migrationId } = await context.params;

  const baseline = getBaseline(migrationId);
  if (!baseline) {
    return error(
      'NOT_FOUND',
      `No monitoring baseline found for migration "${migrationId}".`,
      404,
    );
  }

  const history = getDriftHistory(migrationId, 50);
  const latest = history.length > 0 ? history[0] : null;

  return success({
    migrationId,
    siteUrl: baseline.siteUrl,
    baselineCapturedAt: baseline.capturedAt,
    baselineHealthScore: baseline.healthScore,
    latestCheck: latest,
    alertLevel: latest?.alertLevel ?? 'green',
    driftScore: latest?.driftScore ?? 0,
    totalChecks: history.length,
    history,
  });
}

// ── POST: Trigger a new drift check ──────────────────────────

export async function POST(request: Request, context: RouteContext) {
  const { migrationId } = await context.params;

  const baseline = getBaseline(migrationId);
  if (!baseline) {
    return error(
      'NOT_FOUND',
      `No monitoring baseline found for migration "${migrationId}". Capture a baseline first via POST /api/monitoring/${migrationId}/baseline.`,
      404,
    );
  }

  try {
    const monitor = new DriftMonitor();
    const check = await monitor.runDriftCheck(migrationId);

    console.log(
      `[DriftMonitor] Check for "${migrationId}" — drift: ${check.driftScore}, alert: ${check.alertLevel}, changes: ${check.changes.length}`,
    );

    return success(check, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[DriftMonitor] Check failed for "${migrationId}":`, message);

    if (message.includes('abort') || message.includes('timeout')) {
      return error(
        'SCAN_TIMEOUT',
        'The site took too long to respond during drift check.',
        504,
      );
    }

    return error(
      'DRIFT_CHECK_FAILED',
      `Drift check failed: ${message}`,
      500,
    );
  }
}

// ── DELETE: Remove monitoring ────────────────────────────────

export async function DELETE(request: Request, context: RouteContext) {
  const { migrationId } = await context.params;

  const deleted = deleteMonitoring(migrationId);
  if (!deleted) {
    return error(
      'NOT_FOUND',
      `No monitoring data found for migration "${migrationId}".`,
      404,
    );
  }

  return success({ migrationId, deleted: true });
}
