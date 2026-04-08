/**
 * Shared helpers for wiring phase API routes to the migration orchestrator.
 *
 * ADR-062: Phase routes (assess/transform/execute/validate) retain their
 * existing synchronous behaviour for backward compatibility, but every
 * state change is mirrored through the orchestrator so the state machine
 * history, audit log, and allowed-transition metadata stay authoritative.
 *
 * When the client requests async execution via `?async=true`, the route
 * short-circuits the inline work and delegates to the execution runtime,
 * returning 202 Accepted with a correlation ID.
 */

import type { NextRequest } from 'next/server';
import { orchestrator } from '@/lib/orchestrator/migration-orchestrator';
import { executionRuntime } from '@/lib/orchestrator/execution-runtime';
import { success, error } from '@/lib/api/response';
import { MigrationStatus } from '@/types';

export type PhaseName = 'assess' | 'transform' | 'execute' | 'validate';

const RUNNING_STATE: Record<PhaseName, MigrationStatus> = {
  assess: MigrationStatus.ASSESSING,
  transform: MigrationStatus.TRANSFORMING,
  execute: MigrationStatus.EXECUTING,
  validate: MigrationStatus.VALIDATING,
};

/** True when the caller explicitly requested async execution. */
export function isAsyncRequest(request: NextRequest): boolean {
  try {
    return new URL(request.url).searchParams.get('async') === 'true';
  } catch {
    return false;
  }
}

/**
 * Start a phase through the orchestrator + execution runtime and return
 * a 202 Accepted response immediately. Used when the caller opts into
 * async mode via `?async=true`.
 */
export async function startPhaseAsync(
  migrationId: string,
  phase: PhaseName,
): Promise<Response> {
  const running = RUNNING_STATE[phase];
  try {
    if (!orchestrator.canTransition(migrationId, running)) {
      return error(
        'INVALID_TRANSITION',
        `Cannot start ${phase} phase — migration is not in a state that permits transition to ${running}.`,
        409,
      );
    }

    await orchestrator.transition(migrationId, running, {
      triggerSource: 'user',
      context: { phase },
    });

    const job = executionRuntime.startPhase(migrationId, phase);
    return success(
      {
        migrationId,
        phase,
        status: running,
        correlationId: job.correlationId,
        startedAt: job.startedAt,
        async: true,
      },
      202,
    );
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : 'Failed to start phase';
    if (name === 'TransitionError') {
      return error('INVALID_TRANSITION', message, 409);
    }
    if (message.includes('not found')) {
      return error('NOT_FOUND', message, 404);
    }
    console.error(`[orchestrator] startPhaseAsync(${phase}) error:`, err);
    return error('INTERNAL_ERROR', `Failed to start ${phase} phase`, 500);
  }
}

/**
 * Best-effort orchestrator transition used by synchronous phase routes
 * after the inline work has succeeded. We do NOT throw — the inline path
 * already mutated the store, so failing here must not break the caller.
 * Any transition error is logged and swallowed so the route still returns
 * its historical payload shape.
 */
export async function recordPhaseTransition(
  migrationId: string,
  toState: MigrationStatus,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!orchestrator.canTransition(migrationId, toState)) {
      return;
    }
    await orchestrator.transition(migrationId, toState, {
      triggerSource: 'system',
      context,
    });
  } catch (err) {
    console.warn(
      `[orchestrator] recordPhaseTransition(${migrationId} -> ${toState}) failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}
