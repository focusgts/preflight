/**
 * POST /api/migrations/[id]/transition — Explicit state transition
 *
 * ADR-062: Allows the UI to explicitly drive the orchestrator state machine
 * (e.g. user approves a plan, pauses, resumes). Body: { to, context? }.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { orchestrator } from '@/lib/orchestrator/migration-orchestrator';
import type { MigrationStatus } from '@/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      to?: MigrationStatus;
      context?: Record<string, unknown>;
    };

    if (!body.to) {
      return error('INVALID_REQUEST', 'Missing required field: to', 400);
    }

    const migration = await orchestrator.transition(id, body.to, {
      triggerSource: 'user',
      context: body.context,
    });

    return success(migration);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : 'Transition failed';
    if (name === 'TransitionError') {
      return error('INVALID_TRANSITION', message, 400);
    }
    if (message.includes('not found')) {
      return error('NOT_FOUND', message, 404);
    }
    console.error('[API] POST /api/migrations/[id]/transition error:', err);
    return error('INTERNAL_ERROR', 'Failed to transition migration state', 500);
  }
}
