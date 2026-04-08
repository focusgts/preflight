/**
 * GET /api/migrations/[id]/state — Current state + history + allowed transitions
 *
 * ADR-062: Thin wrapper around the migration orchestrator's state machine.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { orchestrator } from '@/lib/orchestrator/migration-orchestrator';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const state = orchestrator.getState(id);
    if (!state) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }
    return success(state);
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/state error:', err);
    return error('INTERNAL_ERROR', 'Failed to read migration state', 500);
  }
}
