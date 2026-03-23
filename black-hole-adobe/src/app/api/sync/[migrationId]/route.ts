/**
 * POST   /api/sync/[migrationId] — Start content sync for a migration
 * GET    /api/sync/[migrationId] — Get sync status and stats
 * DELETE /api/sync/[migrationId] — Stop sync
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { ContentSyncEngine } from '@/lib/sync/content-sync-engine';
import { ConflictStrategy, DetectionStrategy } from '@/types/sync';

type RouteParams = { params: Promise<{ migrationId: string }> };

// Shared engine instance (in production, use a proper singleton/DI container)
const syncEngine = new ContentSyncEngine();

// Map migration IDs to sync IDs
const migrationSyncMap = new Map<string, string>();

// ── Validation ──────────────────────────────────────────────────────

const startSyncSchema = z.object({
  sourceConfig: z.object({
    platform: z.string().min(1),
    url: z.string().min(1),
    credentials: z.record(z.string(), z.unknown()).nullable().optional(),
    basePath: z.string().min(1),
  }),
  targetConfig: z.object({
    platform: z.string().min(1),
    url: z.string().min(1),
    credentials: z.record(z.string(), z.unknown()).nullable().optional(),
    basePath: z.string().min(1),
  }),
  options: z
    .object({
      interval: z.number().min(5000).max(3_600_000).optional(),
      strategy: z.nativeEnum(DetectionStrategy).optional(),
      includePatterns: z.array(z.string()).optional(),
      excludePatterns: z.array(z.string()).optional(),
      conflictResolution: z.nativeEnum(ConflictStrategy).optional(),
      batchSize: z.number().min(1).max(1000).optional(),
      autoStart: z.boolean().optional(),
    })
    .optional(),
});

// ── POST — Start sync ───────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;

    // Check if sync already active for this migration
    const existingSyncId = migrationSyncMap.get(migrationId);
    if (existingSyncId) {
      try {
        const status = syncEngine.getSyncStatus(existingSyncId);
        if (
          status.sync.status === 'syncing' ||
          status.sync.status === 'paused'
        ) {
          return error(
            'SYNC_ACTIVE',
            `Sync already active for migration ${migrationId}`,
            409,
          );
        }
      } catch {
        // Previous sync no longer exists; allow creating a new one
      }
    }

    const body = await request.json();
    const parsed = startSyncSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const { sourceConfig, targetConfig, options } = parsed.data;

    const sync = await syncEngine.startSync(
      { ...sourceConfig, credentials: sourceConfig.credentials ?? null },
      { ...targetConfig, credentials: targetConfig.credentials ?? null },
      options,
    );

    migrationSyncMap.set(migrationId, sync.id);

    console.log(`[API] POST /api/sync/${migrationId} — started sync ${sync.id}`);
    return success(sync, 201);
  } catch (err) {
    console.error('[API] POST /api/sync/[migrationId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to start sync', 500);
  }
}

// ── GET — Sync status ───────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;
    const syncId = migrationSyncMap.get(migrationId);

    if (!syncId) {
      return error('NOT_FOUND', `No sync found for migration ${migrationId}`, 404);
    }

    const status = syncEngine.getSyncStatus(syncId);

    console.log(`[API] GET /api/sync/${migrationId}`);
    return success(status);
  } catch (err) {
    console.error('[API] GET /api/sync/[migrationId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get sync status', 500);
  }
}

// ── DELETE — Stop sync ──────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;
    const syncId = migrationSyncMap.get(migrationId);

    if (!syncId) {
      return error('NOT_FOUND', `No sync found for migration ${migrationId}`, 404);
    }

    await syncEngine.stopSync(syncId);
    migrationSyncMap.delete(migrationId);

    console.log(`[API] DELETE /api/sync/${migrationId} — stopped`);
    return success({ migrationId, syncId, action: 'stopped' });
  } catch (err) {
    console.error('[API] DELETE /api/sync/[migrationId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to stop sync', 500);
  }
}
