/**
 * ADR-062: Migration Orchestrator State Machine
 *
 * Canonical definition of allowed migration state transitions, their
 * preconditions, and helpers for validating a requested transition.
 *
 * This module is pure — no I/O, no persistence. Persistence lives in
 * `./state-history.ts` and the high-level API lives in
 * `./migration-orchestrator.ts`.
 */

import { MigrationStatus } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerSource = 'user' | 'auto' | 'system';

export interface StateTransition {
  from: MigrationStatus;
  to: MigrationStatus;
  /** Context fields that must be truthy for the transition to be allowed. */
  requires?: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Canonical transitions
// ---------------------------------------------------------------------------

/**
 * The happy-path forward transitions. Note that the `MigrationStatus` enum
 * does not (currently) include intermediate "TRANSFORMED" / "EXECUTED" /
 * "VALIDATED" states, so TRANSFORMING proceeds directly to EXECUTING and
 * VALIDATING proceeds directly to COMPLETED.
 */
export const FORWARD_TRANSITIONS: StateTransition[] = [
  {
    from: MigrationStatus.DRAFT,
    to: MigrationStatus.ASSESSING,
    requires: ['sourceConnector'],
    description: 'Begin assessment',
  },
  {
    from: MigrationStatus.ASSESSING,
    to: MigrationStatus.ASSESSED,
    description: 'Assessment complete',
  },
  {
    from: MigrationStatus.ASSESSED,
    to: MigrationStatus.PLANNING,
    description: 'User starts planning',
  },
  {
    from: MigrationStatus.PLANNING,
    to: MigrationStatus.PLANNED,
    description: 'Planning complete',
  },
  {
    from: MigrationStatus.PLANNED,
    to: MigrationStatus.TRANSFORMING,
    requires: ['approvedPlan'],
    description: 'Begin transformation',
  },
  {
    from: MigrationStatus.TRANSFORMING,
    to: MigrationStatus.EXECUTING,
    requires: ['targetConnector', 'approvedFixes'],
    description: 'Begin execution',
  },
  {
    from: MigrationStatus.EXECUTING,
    to: MigrationStatus.VALIDATING,
    description: 'Content transfer complete',
  },
  {
    from: MigrationStatus.VALIDATING,
    to: MigrationStatus.COMPLETED,
    requires: ['validationPass'],
    description: 'Migration complete',
  },
];

/**
 * States considered "active" — i.e. long-running phases that may be paused,
 * failed, or cancelled by the user or the orchestrator itself.
 */
export const ACTIVE_STATES: MigrationStatus[] = [
  MigrationStatus.ASSESSING,
  MigrationStatus.PLANNING,
  MigrationStatus.TRANSFORMING,
  MigrationStatus.EXECUTING,
  MigrationStatus.VALIDATING,
];

/**
 * Any state that is not terminal can transition to FAILED or CANCELLED.
 * We build this list so the orchestrator never has to special-case them.
 */
const FAIL_CANCEL_SOURCE_STATES: MigrationStatus[] = [
  MigrationStatus.DRAFT,
  MigrationStatus.ASSESSING,
  MigrationStatus.ASSESSED,
  MigrationStatus.PLANNING,
  MigrationStatus.PLANNED,
  MigrationStatus.TRANSFORMING,
  MigrationStatus.EXECUTING,
  MigrationStatus.VALIDATING,
  MigrationStatus.FAILED, // FAILED -> CANCELLED is allowed
];

/** Terminal states — once reached, no further transitions are possible. */
export const TERMINAL_STATES: MigrationStatus[] = [
  MigrationStatus.COMPLETED,
  MigrationStatus.CANCELLED,
];

/**
 * Full set of allowed transitions, including failure/cancel edges from every
 * non-terminal state, plus the ability to retry from FAILED back to the
 * previous active phase's re-entry point (handled at the orchestrator level;
 * here we simply allow FAILED -> ASSESSING/PLANNING/TRANSFORMING/EXECUTING/
 * VALIDATING so "resume" logic implemented by another agent can drive it).
 */
export const TRANSITIONS: StateTransition[] = [
  ...FORWARD_TRANSITIONS,
  // Failure edges
  ...FAIL_CANCEL_SOURCE_STATES.filter((s) => s !== MigrationStatus.FAILED).map(
    (from): StateTransition => ({
      from,
      to: MigrationStatus.FAILED,
      description: `Transition to FAILED from ${from}`,
    }),
  ),
  // Cancel edges
  ...FAIL_CANCEL_SOURCE_STATES.map(
    (from): StateTransition => ({
      from,
      to: MigrationStatus.CANCELLED,
      description: `Cancel from ${from}`,
    }),
  ),
  // Resume-from-failure edges (re-enter any active state)
  ...ACTIVE_STATES.map(
    (to): StateTransition => ({
      from: MigrationStatus.FAILED,
      to,
      description: `Resume ${to} after failure`,
    }),
  ),
];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TransitionError extends Error {
  constructor(
    public readonly from: MigrationStatus,
    public readonly to: MigrationStatus,
    public readonly reason: string,
  ) {
    super(`Cannot transition from ${from} to ${to}: ${reason}`);
    this.name = 'TransitionError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns all allowed next states from the given current state. */
export function getAllowedTransitions(
  current: MigrationStatus,
): MigrationStatus[] {
  const seen = new Set<MigrationStatus>();
  for (const t of TRANSITIONS) {
    if (t.from === current) seen.add(t.to);
  }
  return Array.from(seen);
}

/** Look up a transition definition, if one exists. */
export function findTransition(
  from: MigrationStatus,
  to: MigrationStatus,
): StateTransition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/**
 * Validate whether the requested transition is allowed given the current
 * state and a context bag containing precondition values. Throws
 * `TransitionError` with a clear reason when the transition is not allowed.
 */
export function validateTransition(
  from: MigrationStatus,
  to: MigrationStatus,
  context: Record<string, unknown> = {},
): void {
  if (from === to) {
    throw new TransitionError(from, to, 'already in target state');
  }

  if (isTerminal(from)) {
    throw new TransitionError(
      from,
      to,
      `source state "${from}" is terminal`,
    );
  }

  const transition = findTransition(from, to);
  if (!transition) {
    throw new TransitionError(from, to, 'transition is not defined');
  }

  if (transition.requires && transition.requires.length > 0) {
    const missing = transition.requires.filter((key) => !context[key]);
    if (missing.length > 0) {
      throw new TransitionError(
        from,
        to,
        `missing required precondition(s): ${missing.join(', ')}`,
      );
    }
  }
}

/** Check whether a state is terminal. */
export function isTerminal(state: MigrationStatus): boolean {
  return TERMINAL_STATES.includes(state);
}

/** Check whether a state is active (long-running / interruptible). */
export function isActive(state: MigrationStatus): boolean {
  return ACTIVE_STATES.includes(state);
}
