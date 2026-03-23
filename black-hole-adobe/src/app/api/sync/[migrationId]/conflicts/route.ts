/**
 * GET   /api/sync/[migrationId]/conflicts — List unresolved conflicts
 * PATCH /api/sync/[migrationId]/conflicts — Resolve a conflict
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { ContentSyncEngine } from '@/lib/sync/content-sync-engine';
import { ConflictStrategy } from '@/types/sync';

type RouteParams = { params: Promise<{ migrationId: string }> };

// Shared engine instance (mirrors the parent route's instance)
const syncEngine = new ContentSyncEngine();
const migrationSyncMap = new Map<string, string>();

// ── Validation ──────────────────────────────────────────────────────

const resolveSchema = z.object({
  conflictId: z.string().min(1),
  strategy: z.nativeEnum(ConflictStrategy),
  notes: z.string().optional(),
});

// ── GET — List unresolved conflicts ─────────────────────────────────

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

    const conflicts = syncEngine.getUnresolvedConflicts(syncId);

    console.log(`[API] GET /api/sync/${migrationId}/conflicts — ${conflicts.length} unresolved`);
    return success({
      migrationId,
      syncId,
      unresolved: conflicts.length,
      conflicts,
    });
  } catch (err) {
    console.error('[API] GET /api/sync/[migrationId]/conflicts error:', err);
    return error('INTERNAL_ERROR', 'Failed to get conflicts', 500);
  }
}

// ── PATCH — Resolve a conflict ──────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;
    const syncId = migrationSyncMap.get(migrationId);

    if (!syncId) {
      return error('NOT_FOUND', `No sync found for migration ${migrationId}`, 404);
    }

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const { conflictId, strategy, notes } = parsed.data;

    const resolved = syncEngine.resolveConflicts(
      syncId,
      [conflictId],
      strategy,
      notes,
    );

    if (resolved.length === 0) {
      return error(
        'NOT_FOUND',
        `Conflict ${conflictId} not found or already resolved`,
        404,
      );
    }

    console.log(`[API] PATCH /api/sync/${migrationId}/conflicts — resolved ${conflictId}`);
    return success({
      migrationId,
      syncId,
      resolved: resolved[0],
    });
  } catch (err) {
    console.error('[API] PATCH /api/sync/[migrationId]/conflicts error:', err);
    return error('INTERNAL_ERROR', 'Failed to resolve conflict', 500);
  }
}
