/**
 * ADR-062: Resume semantics for the Migration Orchestrator.
 *
 * The MigrationStatus enum has no PAUSED state, so a migration is considered
 * "resumable" when it is in FAILED. (CANCELLED is terminal and cannot be
 * resumed; we surface that as a blocker rather than throwing.)
 *
 * Resume is driven entirely by reading the existing state history and audit
 * log — no new tables, no new state fields. The plan is computed on demand:
 *   1. Find the last non-failed/non-cancelled state in the history. That is
 *      the phase we want to re-enter.
 *   2. Walk the audit log to find the last successful operation, the count
 *      of completed/failed items, and the most recent failure message.
 *   3. Transition the migration back to the resume-from state and start the
 *      corresponding phase via the execution runtime.
 *
 * TODO: phase handlers should query the audit log to skip completed items
 * on resume. The full skip logic requires the phase handlers to be
 * resume-aware, which is a follow-up effort tracked separately.
 */

import { MigrationStatus } from '@/types';
import { getMigration } from '@/lib/api/store';
import { orchestrator } from './migration-orchestrator';
import { getStateHistory } from './state-history';
import { executionRuntime } from './execution-runtime';
import { queryAuditLog } from '@/lib/audit/migration-audit-log';
import { FatalError } from '@/lib/errors/migration-errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumeOptions {
  triggeredBy?: string;
  skipValidation?: boolean;
}

export interface ResumePlan {
  migrationId: string;
  resumeFromState: MigrationStatus;
  resumeFromPhase: string;
  lastSuccessfulOperation?: {
    operation: string;
    itemPath: string | null;
    timestamp: string;
  };
  completedItemCount: number;
  failedItemCount: number;
  lastError?: string;
  canResume: boolean;
  blockers: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATE_TO_PHASE: Partial<Record<MigrationStatus, string>> = {
  [MigrationStatus.ASSESSING]: 'assess',
  [MigrationStatus.TRANSFORMING]: 'transform',
  [MigrationStatus.EXECUTING]: 'execute',
  [MigrationStatus.VALIDATING]: 'validate',
};

const RESUMABLE_STATES = new Set<MigrationStatus>([
  MigrationStatus.ASSESSING,
  MigrationStatus.TRANSFORMING,
  MigrationStatus.EXECUTING,
  MigrationStatus.VALIDATING,
]);

function isNonResumeBoundary(state: string): boolean {
  return (
    state === MigrationStatus.FAILED || state === MigrationStatus.CANCELLED
  );
}

// ---------------------------------------------------------------------------
// ResumeManager
// ---------------------------------------------------------------------------

export class ResumeManager {
  /**
   * Inspect a migration to determine if and how it can be resumed.
   * Does NOT actually resume — just produces a plan.
   */
  async inspectResume(migrationId: string): Promise<ResumePlan> {
    const blockers: string[] = [];
    const migration = getMigration(migrationId);

    if (!migration) {
      return {
        migrationId,
        resumeFromState: MigrationStatus.DRAFT,
        resumeFromPhase: '',
        completedItemCount: 0,
        failedItemCount: 0,
        canResume: false,
        blockers: [`Migration ${migrationId} not found`],
      };
    }

    // History is returned newest-first.
    const history = getStateHistory(migrationId, 200);

    if (history.length === 0) {
      blockers.push('Migration has no state history to resume from');
    }

    if (migration.status === MigrationStatus.COMPLETED) {
      blockers.push('Migration is COMPLETED — terminal state, nothing to resume');
    }
    if (migration.status === MigrationStatus.CANCELLED) {
      blockers.push('Migration is CANCELLED — terminal state, cannot resume');
    }

    // Find the most recent active state in history (skipping FAILED/CANCELLED).
    let resumeFromState: MigrationStatus | null = null;
    for (const entry of history) {
      const to = entry.toState as MigrationStatus;
      if (!isNonResumeBoundary(to) && RESUMABLE_STATES.has(to)) {
        resumeFromState = to;
        break;
      }
    }

    if (!resumeFromState) {
      blockers.push('No resumable phase found in state history');
    }

    const resumeFromPhase = resumeFromState
      ? STATE_TO_PHASE[resumeFromState] ?? ''
      : '';

    if (resumeFromState && !resumeFromPhase) {
      blockers.push(
        `State ${resumeFromState} has no associated phase handler`,
      );
    }

    // Audit log: newest-first. Pull a generous slice for the migration.
    const auditEntries = queryAuditLog({
      migrationId,
      limit: 1000,
    });

    let lastSuccessfulOperation: ResumePlan['lastSuccessfulOperation'];
    let lastError: string | undefined;
    let completedItemCount = 0;
    let failedItemCount = 0;

    for (const entry of auditEntries) {
      if (entry.status === 'succeeded') {
        completedItemCount += 1;
        if (!lastSuccessfulOperation) {
          lastSuccessfulOperation = {
            operation: entry.operation,
            itemPath: entry.itemPath,
            timestamp: entry.timestamp,
          };
        }
      } else if (entry.status === 'failed') {
        failedItemCount += 1;
        if (!lastError) {
          lastError = entry.errorMessage ?? entry.operation;
        }
      }
    }

    const inResumableStatus = migration.status === MigrationStatus.FAILED;
    if (!inResumableStatus && migration.status !== MigrationStatus.CANCELLED) {
      // The user can only resume from FAILED. Other non-terminal statuses
      // mean the migration is either already running or hasn't failed.
      blockers.push(
        `Migration is in ${migration.status} — only FAILED migrations can be resumed`,
      );
    }

    const canResume =
      blockers.length === 0 &&
      resumeFromState !== null &&
      resumeFromPhase !== '' &&
      inResumableStatus;

    return {
      migrationId,
      resumeFromState: resumeFromState ?? MigrationStatus.DRAFT,
      resumeFromPhase,
      lastSuccessfulOperation,
      completedItemCount,
      failedItemCount,
      lastError,
      canResume,
      blockers,
    };
  }

  /**
   * Resume a migration from its last known good state.
   */
  async resume(
    migrationId: string,
    options: ResumeOptions = {},
  ): Promise<{ plan: ResumePlan; correlationId: string }> {
    const plan = await this.inspectResume(migrationId);

    if (!plan.canResume) {
      throw new FatalError(
        `Migration ${migrationId} is not resumable: ${plan.blockers.join('; ')}`,
        { migrationId, blockers: plan.blockers },
      );
    }

    // Defensive: verify the orchestrator allows the FAILED -> resume-from
    // transition. The state machine declares these edges, but if the
    // migration somehow drifted state we want a clear error.
    if (
      !options.skipValidation &&
      !orchestrator.canTransition(migrationId, plan.resumeFromState)
    ) {
      throw new FatalError(
        `Cannot transition migration ${migrationId} back to ${plan.resumeFromState}`,
        { migrationId, resumeFromState: plan.resumeFromState },
      );
    }

    // Transition back into the active phase.
    await orchestrator.transition(migrationId, plan.resumeFromState, {
      triggerSource: 'user',
      triggeredBy: options.triggeredBy,
      metadata: {
        resume: true,
        resumeFromPlan: plan,
      },
    });

    // Kick off the phase in the background.
    const { correlationId } = executionRuntime.startPhase(
      migrationId,
      plan.resumeFromPhase,
    );

    return { plan, correlationId };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const resumeManager = new ResumeManager();
