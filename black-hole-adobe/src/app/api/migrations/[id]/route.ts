/**
 * GET    /api/migrations/[id] — Get migration details
 * PATCH  /api/migrations/[id] — Update migration
 * DELETE /api/migrations/[id] — Cancel / delete migration
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { MigrationStatus } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration, updateMigration, deleteMigration } from '@/lib/api/store';

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

    console.log(`[API] GET /api/migrations/${id}`);
    return success(migration);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get migration', 500);
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.nativeEnum(MigrationStatus).optional(),
  productsInScope: z.array(z.string()).min(1).optional(),
  complianceRequirements: z.array(z.string()).optional(),
  riskScore: z.number().min(0).max(1).optional(),
  estimatedDurationWeeks: z.number().min(0).optional(),
  estimatedCost: z.number().min(0).optional(),
  progress: z.number().min(0).max(100).optional(),
  targetCompletionDate: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const existing = getMigration(id);

    if (!existing) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    // Prevent updates to completed or cancelled migrations
    if (
      existing.status === MigrationStatus.COMPLETED ||
      existing.status === MigrationStatus.CANCELLED
    ) {
      return error(
        'INVALID_STATE',
        `Cannot update a migration in ${existing.status} state`,
        409,
      );
    }

    const updated = updateMigration(id, parsed.data as Partial<typeof existing>);

    console.log(`[API] PATCH /api/migrations/${id}`);
    return success(updated);
  } catch (err) {
    console.error('[API] PATCH /api/migrations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update migration', 500);
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const existing = getMigration(id);

    if (!existing) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // If actively running, cancel rather than delete
    const activeStatuses: MigrationStatus[] = [
      MigrationStatus.ASSESSING,
      MigrationStatus.TRANSFORMING,
      MigrationStatus.EXECUTING,
      MigrationStatus.VALIDATING,
    ];

    if (activeStatuses.includes(existing.status)) {
      updateMigration(id, { status: MigrationStatus.CANCELLED });
      console.log(`[API] DELETE /api/migrations/${id} — cancelled (was active)`);
      return success({ id, action: 'cancelled' });
    }

    deleteMigration(id);
    console.log(`[API] DELETE /api/migrations/${id} — deleted`);
    return success({ id, action: 'deleted' });
  } catch (err) {
    console.error('[API] DELETE /api/migrations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to delete migration', 500);
  }
}
