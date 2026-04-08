/**
 * ADR-062: Background Execution Runtime for the Migration Orchestrator.
 *
 * A lightweight in-memory job manager that runs phase work without blocking
 * API calls. Since Next.js does not give us long-lived worker threads, this
 * runtime uses a fire-and-forget async pattern. Each running job is tracked
 * by `migrationId` and exposes progress + cancellation via an AbortController.
 *
 * Scope (Agent 2 of 4):
 *   - Background runtime + job tracking
 *   - Phase handler registration and invocation
 *   - Progress reporting
 *
 * Out of scope (handled by other agents):
 *   - State machine transitions (Agent 1)
 *   - API route refactor (Agent 3)
 *   - Resume semantics (Agent 4)
 */

import { MigrationStatus } from '@/types';
import { logAuditEvent, newCorrelationId } from '@/lib/audit/migration-audit-log';
import { classifyError } from '@/lib/errors/migration-errors';
import { getMigration } from '@/lib/api/store';

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

export type PhaseHandler = (context: PhaseContext) => Promise<PhaseResult>;

export interface PhaseContext {
  migrationId: string;
  phase: string;
  correlationId: string;
  abortSignal: AbortSignal;
  reportProgress: (current: number, total: number, message: string) => void;
}

export interface PhaseResult {
  success: boolean;
  itemsProcessed: number;
  errors: string[];
  nextState?: MigrationStatus;
}

export interface RunningJob {
  migrationId: string;
  phase: string;
  correlationId: string;
  startedAt: number;
  abortController: AbortController;
  finishedAt?: number;
  lastProgress: {
    current: number;
    total: number;
    message: string;
    updatedAt: number;
  };
}

// -----------------------------------------------------------------------
// Runtime
// -----------------------------------------------------------------------

const DEFAULT_CLEANUP_TTL_MS = 60 * 60 * 1000; // 1 hour

export class ExecutionRuntime {
  private jobs: Map<string, RunningJob> = new Map();
  private handlers: Map<string, PhaseHandler> = new Map();

  /**
   * Register a phase handler. Last registration wins.
   */
  registerHandler(phase: string, handler: PhaseHandler): void {
    this.handlers.set(phase, handler);
  }

  /**
   * Start a phase in the background. Returns immediately.
   *
   * Throws if a phase is already running for the migration, or if no handler
   * is registered for the phase.
   */
  startPhase(
    migrationId: string,
    phase: string,
  ): { correlationId: string; startedAt: string } {
    if (this.isRunning(migrationId)) {
      throw new Error(
        `Migration ${migrationId} already has a running phase: ${this.jobs.get(migrationId)?.phase}`,
      );
    }

    const handler = this.handlers.get(phase);
    if (!handler) {
      throw new Error(`No handler registered for phase "${phase}"`);
    }

    const correlationId = newCorrelationId(`phase-${phase}`);
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const abortController = new AbortController();

    const job: RunningJob = {
      migrationId,
      phase,
      correlationId,
      startedAt: startedAtMs,
      abortController,
      lastProgress: {
        current: 0,
        total: 0,
        message: 'Starting…',
        updatedAt: startedAtMs,
      },
    };

    this.jobs.set(migrationId, job);

    const ctx: PhaseContext = {
      migrationId,
      phase,
      correlationId,
      abortSignal: abortController.signal,
      reportProgress: (current, total, message) => {
        const existing = this.jobs.get(migrationId);
        if (!existing) return;
        existing.lastProgress = {
          current,
          total,
          message,
          updatedAt: Date.now(),
        };
      },
    };

    // Fire and forget. We intentionally do not await this promise — the
    // API caller has already returned. All errors must be captured and
    // logged here so they never escape as unhandled rejections.
    void this.runJob(handler, ctx);

    return { correlationId, startedAt: startedAtIso };
  }

  private async runJob(handler: PhaseHandler, ctx: PhaseContext): Promise<void> {
    const start = Date.now();
    logAuditEvent({
      migrationId: ctx.migrationId,
      correlationId: ctx.correlationId,
      operation: `phase.${ctx.phase}`,
      status: 'started',
      metadata: { phase: ctx.phase },
    });

    try {
      const result = await handler(ctx);
      const job = this.jobs.get(ctx.migrationId);
      if (job) job.finishedAt = Date.now();

      logAuditEvent({
        migrationId: ctx.migrationId,
        correlationId: ctx.correlationId,
        operation: `phase.${ctx.phase}`,
        status: result.success ? 'succeeded' : 'failed',
        durationMs: Date.now() - start,
        metadata: {
          phase: ctx.phase,
          itemsProcessed: result.itemsProcessed,
          errorCount: result.errors.length,
          nextState: result.nextState,
        },
        errorMessage: result.success ? null : result.errors.join('; ') || null,
      });
    } catch (err) {
      const classified = classifyError(err);
      const job = this.jobs.get(ctx.migrationId);
      if (job) job.finishedAt = Date.now();

      logAuditEvent({
        migrationId: ctx.migrationId,
        correlationId: ctx.correlationId,
        operation: `phase.${ctx.phase}`,
        status: 'failed',
        durationMs: Date.now() - start,
        errorCode: classified.code ?? null,
        errorCategory: classified.category ?? null,
        errorMessage: classified.message ?? String(err),
        metadata: { phase: ctx.phase },
      });
    }
  }

  isRunning(migrationId: string): boolean {
    const job = this.jobs.get(migrationId);
    return !!job && job.finishedAt === undefined;
  }

  getProgress(migrationId: string): RunningJob | null {
    return this.jobs.get(migrationId) ?? null;
  }

  cancel(migrationId: string): boolean {
    const job = this.jobs.get(migrationId);
    if (!job || job.finishedAt !== undefined) return false;
    job.abortController.abort();
    logAuditEvent({
      migrationId,
      correlationId: job.correlationId,
      operation: `phase.${job.phase}`,
      status: 'failed',
      errorMessage: 'Cancelled by user',
      metadata: { phase: job.phase, cancelled: true },
    });
    return true;
  }

  listRunning(): RunningJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.finishedAt === undefined);
  }

  cleanup(ttlMs: number = DEFAULT_CLEANUP_TTL_MS): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (job.finishedAt !== undefined && now - job.finishedAt > ttlMs) {
        this.jobs.delete(id);
      }
    }
  }
}

export const executionRuntime = new ExecutionRuntime();

// -----------------------------------------------------------------------
// Phase handlers
// -----------------------------------------------------------------------
//
// These are intentionally thin adapters. The orchestrator state machine
// (Agent 1) and API route refactor (Agent 3) are responsible for moving
// migrations between states; these handlers only run the long-lived work
// for a single phase and report progress along the way.
//
// TODO(agent-3): Wire these handlers to the existing engines in
//   `@/lib/engine/*` once the API routes have been refactored to invoke
//   the orchestrator instead of running the engines inline. For now we
//   provide minimal stubs that load the migration, simulate progress,
//   honour the abort signal, and return a PhaseResult so the runtime
//   surface area can be exercised end to end.

interface StubStep {
  message: string;
  delayMs: number;
}

async function runStubPhase(
  ctx: PhaseContext,
  steps: StubStep[],
  nextState: MigrationStatus,
): Promise<PhaseResult> {
  const migration = getMigration(ctx.migrationId);
  if (!migration) {
    return {
      success: false,
      itemsProcessed: 0,
      errors: [`Migration ${ctx.migrationId} not found`],
    };
  }

  const total = steps.length;
  let processed = 0;
  const errors: string[] = [];

  for (const step of steps) {
    if (ctx.abortSignal.aborted) {
      errors.push('Aborted');
      return { success: false, itemsProcessed: processed, errors };
    }

    ctx.reportProgress(processed, total, step.message);

    // Interruptible sleep
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, step.delayMs);
      ctx.abortSignal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });

    processed += 1;
  }

  ctx.reportProgress(processed, total, 'Phase complete');
  return {
    success: true,
    itemsProcessed: processed,
    errors,
    nextState,
  };
}

executionRuntime.registerHandler('assess', (ctx) =>
  // TODO(agent-3): replace with AssessmentEngine invocation
  runStubPhase(
    ctx,
    [
      { message: 'Loading source inventory', delayMs: 200 },
      { message: 'Analyzing content', delayMs: 200 },
      { message: 'Scoring components', delayMs: 200 },
      { message: 'Producing assessment report', delayMs: 200 },
    ],
    MigrationStatus.ASSESSED,
  ),
);

executionRuntime.registerHandler('transform', (ctx) =>
  // TODO(agent-3): replace with code-modernizer + schema-mapper pipeline
  runStubPhase(
    ctx,
    [
      { message: 'Mapping schemas', delayMs: 200 },
      { message: 'Modernizing code', delayMs: 200 },
      { message: 'Generating fix list', delayMs: 200 },
    ],
    MigrationStatus.TRANSFORMING,
  ),
);

executionRuntime.registerHandler('execute', (ctx) =>
  // TODO(agent-3): replace with content-migrator batch transfer
  runStubPhase(
    ctx,
    [
      { message: 'Connecting to target', delayMs: 200 },
      { message: 'Transferring assets', delayMs: 200 },
      { message: 'Transferring pages', delayMs: 200 },
      { message: 'Reconnecting integrations', delayMs: 200 },
    ],
    MigrationStatus.EXECUTING,
  ),
);

executionRuntime.registerHandler('validate', (ctx) =>
  // TODO(agent-3): replace with ValidationEngine invocation
  runStubPhase(
    ctx,
    [
      { message: 'Running smoke tests', delayMs: 200 },
      { message: 'Comparing checksums', delayMs: 200 },
      { message: 'Computing validation score', delayMs: 200 },
    ],
    MigrationStatus.VALIDATING,
  ),
);
