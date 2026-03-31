/**
 * GET /api/migrations/[id]/metrics
 *
 * Returns current migration metrics computed from real migration store data.
 * Derives progress, throughput, and event feeds from actual phase information.
 */

import { type NextRequest } from 'next/server';
import { MigrationStatus } from '@/types';
import type { MigrationProject, MigrationPhase } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import type { LiveMetrics, LivePhase, LiveEvent } from '@/config/mock-live-data';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Map a MigrationPhase to the LivePhase shape the UI expects.
 */
function toLivePhase(phase: MigrationPhase): LivePhase {
  let status: LivePhase['status'];
  if (
    phase.status === MigrationStatus.COMPLETED ||
    phase.status === MigrationStatus.ASSESSED ||
    phase.status === MigrationStatus.PLANNED
  ) {
    status = 'completed';
  } else if (
    phase.status === MigrationStatus.DRAFT ||
    phase.status === MigrationStatus.CANCELLED
  ) {
    status = 'pending';
  } else {
    // ASSESSING, PLANNING, TRANSFORMING, EXECUTING, VALIDATING, FAILED
    status = phase.progress >= 100 ? 'completed' : 'active';
  }

  const durationSeconds = phase.actualDuration != null
    ? phase.actualDuration * 3600
    : phase.startedAt
      ? Math.round(
          (Date.now() - new Date(phase.startedAt).getTime()) / 1000,
        )
      : null;

  return {
    name: phase.name,
    status,
    progress: phase.progress,
    itemsProcessed: phase.items.filter(
      (i) => i.status === 'completed' || i.status === 'failed' || i.status === 'skipped',
    ).length,
    itemsTotal: phase.items.length,
    durationSeconds,
    startedAt: phase.startedAt,
    completedAt: phase.completedAt,
  };
}

/**
 * Build an event feed from recent phase transitions and item statuses.
 */
function buildEvents(migration: MigrationProject): LiveEvent[] {
  const events: LiveEvent[] = [];
  let eventIdx = 0;

  for (const phase of migration.phases) {
    // Phase start event
    if (phase.startedAt) {
      events.push({
        id: `evt-${eventIdx++}`,
        timestamp: phase.startedAt,
        type: 'info',
        message: `Phase "${phase.name}" started.`,
      });
    }

    // Recent item events (last 10 processed items per phase)
    const processedItems = phase.items
      .filter((i) => i.processedAt)
      .sort((a, b) => (b.processedAt ?? '').localeCompare(a.processedAt ?? ''))
      .slice(0, 10);

    for (const item of processedItems) {
      if (item.status === 'completed') {
        events.push({
          id: `evt-${eventIdx++}`,
          timestamp: item.processedAt!,
          type: 'success',
          message: `${item.name} completed.`,
        });
      } else if (item.status === 'failed') {
        events.push({
          id: `evt-${eventIdx++}`,
          timestamp: item.processedAt!,
          type: 'error',
          message: `${item.name} failed: ${item.error ?? 'Unknown error'}.`,
        });
      }
    }

    // Phase completion event
    if (phase.completedAt) {
      events.push({
        id: `evt-${eventIdx++}`,
        timestamp: phase.completedAt,
        type: 'success',
        message: `Phase "${phase.name}" completed.`,
      });
    }
  }

  // Sort descending by timestamp and return latest 20
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return events.slice(0, 20);
}

/**
 * Compute real metrics from the migration's phase and item data.
 */
function computeMetrics(migration: MigrationProject): LiveMetrics {
  const phases = migration.phases.map(toLivePhase);

  // Aggregate item counts across all phases
  let totalItems = 0;
  let processedItems = 0;
  let failedItems = 0;
  let pageItems = 0;
  let pageProcessed = 0;
  let assetItems = 0;
  let assetProcessed = 0;
  let codeItems = 0;
  let codeProcessed = 0;
  let testItems = 0;
  let testProcessed = 0;

  for (const phase of migration.phases) {
    for (const item of phase.items) {
      totalItems++;
      const isDone = item.status === 'completed' || item.status === 'skipped';
      const isFail = item.status === 'failed';
      if (isDone || isFail) processedItems++;
      if (isFail) failedItems++;

      // Categorize by type
      const t = item.type.toLowerCase();
      if (t.includes('page') || t.includes('content') || t === 'content_migration') {
        pageItems++;
        if (isDone) pageProcessed++;
      } else if (t.includes('asset') || t.includes('dam')) {
        assetItems++;
        if (isDone) assetProcessed++;
      } else if (t.includes('code') || t.includes('modernization') || t === 'code_modernization') {
        codeItems++;
        if (isDone) codeProcessed++;
      } else if (t.includes('test') || t.includes('validation')) {
        testItems++;
        if (isDone) testProcessed++;
      } else {
        // Count as general items toward pages bucket
        pageItems++;
        if (isDone) pageProcessed++;
      }
    }
  }

  // Compute throughput from earliest phase start to now
  let earliestStart: number | null = null;
  for (const phase of migration.phases) {
    if (phase.startedAt) {
      const t = new Date(phase.startedAt).getTime();
      if (earliestStart === null || t < earliestStart) earliestStart = t;
    }
  }

  const elapsedMinutes = earliestStart
    ? Math.max(1, (Date.now() - earliestStart) / 60000)
    : 1;
  const throughput = processedItems > 0
    ? Math.round(processedItems / elapsedMinutes)
    : 0;

  // ETA
  const remaining = totalItems - processedItems;
  const etaSeconds = throughput > 0
    ? Math.round((remaining / throughput) * 60)
    : 0;

  const events = buildEvents(migration);

  // Determine migration type label
  const typeLabel = migration.migrationType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    migrationId: migration.id,
    organizationName: migration.organizationName,
    migrationType: typeLabel,
    overallProgress: migration.progress,
    pages: { processed: pageProcessed, total: Math.max(pageItems, 1) },
    assets: { processed: assetProcessed, total: Math.max(assetItems, 0) },
    codeChanges: { processed: codeProcessed, total: Math.max(codeItems, 0) },
    tests: { processed: testProcessed, total: Math.max(testItems, 0) },
    throughput,
    etaSeconds,
    phases,
    events,
  };
}

/**
 * Return zero-state metrics when no phase data exists.
 */
function emptyMetrics(id: string, migration?: MigrationProject): LiveMetrics {
  const name = migration?.organizationName ?? 'Unknown';
  const typeLabel = migration
    ? migration.migrationType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';
  return {
    migrationId: id,
    organizationName: name,
    migrationType: typeLabel,
    overallProgress: migration?.progress ?? 0,
    pages: { processed: 0, total: 0 },
    assets: { processed: 0, total: 0 },
    codeChanges: { processed: 0, total: 0 },
    tests: { processed: 0, total: 0 },
    throughput: 0,
    etaSeconds: 0,
    phases: [],
    events: [],
  };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;

    if (!id) {
      return error('BAD_REQUEST', 'Migration ID is required', 400);
    }

    console.log(`[API] GET /api/migrations/${id}/metrics`);

    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // If the migration has no phases with items, return zeros
    const hasPhaseData = migration.phases.some((p) => p.items.length > 0);
    if (!hasPhaseData) {
      return success(emptyMetrics(id, migration));
    }

    const metrics = computeMetrics(migration);
    return success(metrics);
  } catch (err) {
    console.error('[API] Error fetching migration metrics:', err);
    return error(
      'INTERNAL_ERROR',
      'Failed to fetch migration metrics',
      500,
    );
  }
}
