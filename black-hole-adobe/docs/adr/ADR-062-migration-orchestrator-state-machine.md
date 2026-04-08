# ADR-062: Migration Orchestrator State Machine

## Status: Accepted

## Date: 2026-04-08

## Context

The current migration flow is a loose collection of independently-invoked API endpoints: `/assess`, `/transform`, `/execute`, `/validate`, `/modernize`, `/preflight`. Each endpoint does its work and updates the migration's status field. There is no central state machine ensuring phases run in order, no coordination between concurrent operations, and no resume capability if a long-running phase fails partway through.

A real AEM migration is not a 30-second HTTP request. It is a multi-hour, multi-phase, partially-restartable process that may include:
- Initial content extraction (1-4 hours for large sites)
- Code modernization and review (hours to days with human approval)
- Content transfer in batches (hours)
- Cutover coordination (minutes, but critical timing)
- Validation and smoke tests (1-2 hours)
- Drift monitoring (ongoing, post go-live)

Without an orchestrator:
- Phases can be invoked out of order (execute before assess)
- There is no background execution — API calls block or return 202 without real tracking
- Failed phases cannot be resumed from the point of failure
- Multiple phases cannot run in parallel (content extraction alongside code analysis)
- There is no global timeout or watchdog

## Decision

Create a central migration orchestrator at `src/lib/orchestrator/migration-orchestrator.ts` that owns the lifecycle of every migration.

### 1. State Machine Definition

```
DRAFT (initial)
  ↓ start assessment
ASSESSING
  ↓ assessment complete
ASSESSED
  ↓ user approves plan
PLANNING → PLANNED
  ↓ start transform
TRANSFORMING
  ↓ transform complete
TRANSFORMED
  ↓ user approves fixes
EXECUTING
  ↓ content transfer complete
EXECUTED
  ↓ start validation
VALIDATING
  ↓ validation passes
VALIDATED
  ↓ cutover complete
COMPLETED (terminal)

Any state can transition to:
  PAUSED (temporary, can resume)
  FAILED (can retry from last successful state)
  CANCELLED (terminal, preserved for audit)
```

### 2. Phase Transition Preconditions

The orchestrator enforces preconditions before allowing any transition:

- DRAFT → ASSESSING: requires source connector configured
- ASSESSED → PLANNING: requires assessment completed with scores
- PLANNED → TRANSFORMING: requires user approval of migration plan
- TRANSFORMING → EXECUTING: requires target connector configured AND user approval of fixes
- EXECUTING → VALIDATING: requires all content items in `completed` or `skipped` status
- VALIDATING → COMPLETED: requires validation overall score > threshold

Transitions that violate preconditions throw `TransitionError` with a clear message.

### 3. Persistence

Every state change writes a row to `migration_state_history`:

```sql
CREATE TABLE migration_state_history (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  trigger TEXT NOT NULL,   -- 'user', 'auto', 'system'
  triggered_by TEXT,        -- user ID or system component
  timestamp TEXT NOT NULL,
  metadata TEXT             -- JSON with transition context
);
```

Queryable via `GET /api/migrations/[id]/history` for UI timelines and audit.

### 4. Long-Running Background Execution

Phases like EXECUTING can take hours. The orchestrator:
- Accepts the API request, transitions state, returns 202 immediately
- Kicks off execution in a background worker (Node worker thread or separate process)
- Streams progress via SSE at `/api/migrations/[id]/progress`
- Updates SQLite state incrementally as batches complete
- Handles worker crashes via restart and resume

The API caller never blocks on long operations. Progress is polled or streamed.

### 5. Resume Semantics

When resuming from PAUSED or FAILED:

1. Load migration state from SQLite
2. Query audit log for last successful operation
3. Verify last successful item still exists on target (hash check)
4. Verify source and target are reachable
5. Skip items already marked as succeeded
6. Continue from the exact failure point
7. Write `RESUMED` event to state history

Resume is idempotent — running it twice produces the same result.

### 6. Cancellation

`CANCELLED` is terminal. When a user cancels:
- Orchestrator stops background execution
- Partial work is preserved in audit log
- Migration is marked CANCELLED
- No automatic rollback (manual cleanup if needed)
- Resources are released (connections closed, workers stopped)

### 7. Phase Timeouts

Each phase has a configurable maximum duration:
- Assessment: 1 hour
- Transform: 30 minutes (fast, just analysis)
- Execute: 12 hours (bulk content transfer)
- Validate: 2 hours

If a phase exceeds its timeout without making progress (no audit log entries for 15 minutes), the orchestrator:
- Writes timeout event to audit log
- Transitions to PAUSED
- Notifies admin via webhook
- Waits for manual resume

### 8. Parallel Phases

Some phases can run concurrently to speed up migration:
- Code modernization analysis can run in parallel with content extraction
- Asset optimization can run in parallel with page transfer
- Integration reconnection can run in parallel with code fixes

The orchestrator tracks which phases are mutually compatible and can run them concurrently when the user allows.

### 9. Integration with Existing Endpoints

The existing API endpoints (`/assess`, `/transform`, etc.) become thin wrappers that delegate to the orchestrator:

```typescript
// Before
export async function POST() {
  const migration = getMigration(id);
  const assessment = runAssessmentLogic(migration);
  updateMigration(id, { status: ASSESSED, assessment });
  return success(assessment);
}

// After
export async function POST() {
  const result = await orchestrator.startPhase(id, 'assess');
  return success(result);
}
```

The orchestrator handles state transitions, audit logging, error handling, background execution, and progress streaming.

## Consequences

### Positive
- Migrations become truly long-running, fault-tolerant operations
- Recovery is automatic and deterministic
- Audit trail is complete and queryable
- Users get real progress updates instead of opaque "processing" states
- Parallel phases unlock significant performance gains
- Cancellation is clean — no orphan workers or leaked resources

### Negative
- Significant refactor of existing API routes to delegate to orchestrator
- Background workers add operational complexity (process management, health checks)
- State machine transitions need extensive testing — bugs here corrupt every migration
- Learning curve for operators to understand the state model
- Existing integrations (UI polling, SSE streaming) need to be updated

### Estimated Effort
- State machine core: 12-16 hours
- Preconditions and transition logic: 8-10 hours
- Persistence and history: 4-6 hours
- Background execution runtime: 10-14 hours
- Resume semantics: 6-8 hours
- API endpoint refactor: 8-12 hours
- Testing: 8-12 hours
- **Total: 56-78 hours**
