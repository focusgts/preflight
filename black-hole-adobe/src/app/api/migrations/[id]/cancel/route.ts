/**
 * POST /api/migrations/[id]/cancel — Cancel a running migration
 *
 * ADR-062: Stops background execution via the runtime and drives the
 * orchestrator to the terminal CANCELLED state.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { orchestrator } from '@/lib/orchestrator/migration-orchestrator';
import { executionRuntime } from '@/lib/orchestrator/execution-runtime';
import { MigrationStatus } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const cancelled = executionRuntime.cancel(id);

    const migration = await orchestrator.transition(id, MigrationStatus.CANCELLED, {
      triggerSource: 'user',
      context: { runtimeCancelled: cancelled },
    });

    return success({ migration, runtimeCancelled: cancelled });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : 'Cancel failed';
    if (name === 'TransitionError') {
      return error('INVALID_TRANSITION', message, 400);
    }
    if (message.includes('not found')) {
      return error('NOT_FOUND', message, 404);
    }
    console.error('[API] POST /api/migrations/[id]/cancel error:', err);
    return error('INTERNAL_ERROR', 'Failed to cancel migration', 500);
  }
}
