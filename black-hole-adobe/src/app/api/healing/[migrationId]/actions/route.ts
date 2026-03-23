/**
 * GET  /api/healing/[migrationId]/actions — List all healing actions
 * PATCH /api/healing/[migrationId]/actions — Approve or reject a suggested remedy
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { HealingEngine } from '@/lib/healing';

// Shared engine instance (in production, use DI or singleton)
const healingEngine = new HealingEngine();

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  try {
    const { migrationId } = await params;

    if (!migrationId) {
      return error('MISSING_ID', 'Migration ID is required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const actionFilter = searchParams.get('action');

    let actions = healingEngine.getActions(migrationId);

    if (statusFilter) {
      actions = actions.filter((a) => a.result === statusFilter);
    }

    if (actionFilter) {
      actions = actions.filter((a) => a.action === actionFilter);
    }

    return success(actions);
  } catch (err) {
    return error(
      'ACTIONS_LIST_ERROR',
      err instanceof Error ? err.message : 'Failed to list actions',
      500,
    );
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  actionId: z.string(),
  decision: z.enum(['approve', 'reject']),
  decidedBy: z.string().optional().default('user'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  try {
    const { migrationId } = await params;

    if (!migrationId) {
      return error('MISSING_ID', 'Migration ID is required', 400);
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        'VALIDATION_ERROR',
        'Invalid request body',
        400,
        { issues: parsed.error.issues },
      );
    }

    const { actionId, decision, decidedBy } = parsed.data;

    let updatedAction;
    if (decision === 'approve') {
      updatedAction = await healingEngine.approveSuggestion(
        migrationId,
        actionId,
        decidedBy,
      );
    } else {
      updatedAction = healingEngine.rejectSuggestion(
        migrationId,
        actionId,
        decidedBy,
      );
    }

    if (!updatedAction) {
      return error(
        'ACTION_NOT_FOUND',
        `Action ${actionId} not found or not in suggested state`,
        404,
      );
    }

    return success(updatedAction);
  } catch (err) {
    return error(
      'ACTION_UPDATE_ERROR',
      err instanceof Error ? err.message : 'Failed to update action',
      500,
    );
  }
}
