/**
 * ADR-062: Migration Orchestrator (state-transition core).
 *
 * This module owns the *state transition* surface area of the migration
 * lifecycle: validation, persistence, and history logging. Background
 * execution, resume semantics, and long-running workers are implemented in
 * sibling modules and intentionally live outside this file.
 */

import type { MigrationProject } from '@/types';
import { MigrationStatus } from '@/types';
import {
  getAllowedTransitions,
  isActive,
  isTerminal,
  validateTransition,
  type TriggerSource,
} from './state-machine';
import {
  getStateHistory,
  logStateTransition,
  type StateHistoryEntry,
} from './state-history';
import { getMigration, updateMigration } from '@/lib/api/store';
import { logAuditEvent, newCorrelationId } from '@/lib/audit/migration-audit-log';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionOptions {
  triggerSource?: TriggerSource;
  triggeredBy?: string;
  /** Precondition values fed into the state machine validator. */
  context?: Record<string, unknown>;
  /** Extra metadata persisted to the state history row. */
  metadata?: Record<string, unknown>;
}

export interface OrchestratorStateSnapshot {
  current: MigrationStatus;
  history: StateHistoryEntry[];
  allowedNext: MigrationStatus[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MigrationNotFoundError extends Error {
  constructor(public readonly migrationId: string) {
    super(`Migration not found: ${migrationId}`);
    this.name = 'MigrationNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class MigrationOrchestrator {
  /**
   * Transition a migration to a new state. Validates preconditions against
   * the state machine, persists the status change, writes a state-history
   * row, and emits an audit event.
   */
  async transition(
    migrationId: string,
    to: MigrationStatus,
    options: TransitionOptions = {},
  ): Promise<MigrationProject> {
    const migration = getMigration(migrationId);
    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    const from = migration.status;
    const triggerSource: TriggerSource = options.triggerSource ?? 'system';
    const triggeredBy = options.triggeredBy ?? null;
    const metadata = options.metadata ?? {};

    // 1. Validate the transition. Throws TransitionError on failure.
    validateTransition(from, to, options.context ?? {});

    // 2. Persist the new status on the migration record.
    const updated = updateMigration(migrationId, { status: to });
    if (!updated) {
      // Shouldn't happen given the getMigration above, but stay defensive.
      throw new MigrationNotFoundError(migrationId);
    }

    // 3. Log the transition to state history.
    logStateTransition({
      migrationId,
      fromState: from,
      toState: to,
      triggerSource,
      triggeredBy,
      metadata: {
        ...metadata,
        terminal: isTerminal(to),
        active: isActive(to),
      },
    });

    // 4. Emit an audit event so the migration audit log reflects the
    //    lifecycle transition alongside operational activity.
    try {
      logAuditEvent({
        migrationId,
        correlationId: newCorrelationId('state'),
        operation: `state.transition:${from}->${to}`,
        status: 'succeeded',
        metadata: {
          fromState: from,
          toState: to,
          triggerSource,
          triggeredBy,
          ...metadata,
        },
      });
    } catch {
      // Audit logging must never break a transition.
    }

    return updated;
  }

  /**
   * Snapshot the current state of a migration: its current status, recent
   * history, and the set of allowed next states.
   */
  getState(migrationId: string): OrchestratorStateSnapshot {
    const migration = getMigration(migrationId);
    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    return {
      current: migration.status,
      history: getStateHistory(migrationId),
      allowedNext: getAllowedTransitions(migration.status),
    };
  }

  /**
   * Check whether a specific transition is currently allowed. Does not
   * consider preconditions (callers that need to check preconditions should
   * call `validateTransition` directly with an appropriate context).
   */
  canTransition(migrationId: string, to: MigrationStatus): boolean {
    const migration = getMigration(migrationId);
    if (!migration) return false;
    return getAllowedTransitions(migration.status).includes(to);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const orchestrator = new MigrationOrchestrator();
