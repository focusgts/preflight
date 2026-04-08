# ADR-061: Production-Grade Error Handling & Observability

## Status: Accepted

## Implementation Notes (2026-04-05)

Partial implementation landed — highest-value pieces only:

- **Error taxonomy** — `src/lib/errors/migration-errors.ts` with `MigrationError` base class plus `NetworkError`, `AuthError`, `RateLimitError`, `ValidationError`, `ContentError`, `FatalError`, and a `classifyError()` helper for pattern-matching raw errors into the taxonomy.
- **Structured audit logging** — `src/lib/audit/migration-audit-log.ts` persists audit entries to the `migration_audit_log` SQLite table (schema added to both `schema.sql` and the inline fallback in `database.ts`). Falls back to an in-memory ring buffer if SQLite is unavailable. Exposes `logAuditEvent`, `logAuditError`, `queryAuditLog`, `countAuditLog`, and `newCorrelationId`.
- **Audit query API** — `GET /api/migrations/[id]/audit` with filters for `limit`, `offset`, `status`, `operation`, `severity`, `startDate`, `endDate`, and pagination metadata.
- **Hook points wired** — `executeBatchTransfer()` in `aem-content-writer.ts` (started / per-item succeeded|failed / retry failed / package transfer / batch summary), `ContentSyncEngine.applyChanges()` in `content-sync-engine.ts` (per-change succeeded|failed), and the assessment route at `POST /api/migrations/[id]/assess` (started / succeeded / failed).

### Deferred

Transaction semantics for batches, mid-migration health checks, auto-pause triggers, and resume capability remain deferred. They require orchestrator changes that do not exist yet and should be sequenced after the orchestrator refactor.


## Date: 2026-04-08

## Context

Current error handling in Black Hole is minimal. When a migration execution fails mid-run, there is no structured recovery path, no detailed audit log, no way to diagnose issues after the fact. A real migration fails in ways unit tests can't predict:

- Network glitches mid-batch
- Source AEM auth token expiring during a 6-hour run
- Target AEM rate limiting after 1,000 rapid writes
- Partial writes where some properties succeed and others fail
- Disk pressure on the target causing intermittent 500s
- CDN cache invalidation failing silently
- Workflows taking longer than expected and timing out

Without robust error handling, one bad batch could corrupt a migration. Worse, without observability, a customer could ask "what happened?" and we would have no answer.

## Decision

### 1. Structured Error Taxonomy

Create `src/lib/errors/migration-errors.ts`:

```typescript
export class MigrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly category: ErrorCategory,
    public readonly retryable: boolean,
    public readonly context: Record<string, unknown>,
    message: string,
  ) { super(message); }
}

export class NetworkError extends MigrationError {
  // retryable: true, exponential backoff
}

export class AuthError extends MigrationError {
  // retryable: false, requires re-auth, pauses migration
}

export class RateLimitError extends MigrationError {
  // retryable: true, respects Retry-After header
}

export class ValidationError extends MigrationError {
  // retryable: false, item-level, continue with batch
}

export class ContentError extends MigrationError {
  // retryable: false, data integrity issue, rollback batch
}

export class FatalError extends MigrationError {
  // retryable: false, stop migration, require human
}
```

Every migration operation throws one of these typed errors. The orchestrator uses the type to decide the recovery strategy.

### 2. Transaction Semantics for Batches

Every batch operation uses a three-phase commit:

1. **Prepare**: Write all items to a "pending" namespace on the target
2. **Verify**: After all writes succeed, verify every item exists and matches expected state
3. **Commit**: Move from pending namespace to final path
4. **Rollback on failure**: If any step fails, delete all pending items for this batch

This prevents half-written batches. Either the whole batch succeeds or none of it does.

### 3. Structured Audit Logging

Create a SQLite table `migration_audit_log`:

```sql
CREATE TABLE migration_audit_log (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  operation TEXT NOT NULL,
  item_path TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_code TEXT,
  error_category TEXT,
  error_message TEXT,
  metadata TEXT
);
```

Every migration operation writes a row:
- `operation`: extract_page, write_page, upload_asset, apply_fix, etc.
- `status`: started, succeeded, failed, retried
- `correlation_id`: groups related operations (one batch, one phase)
- `metadata`: JSON with operation-specific data

API endpoint `GET /api/migrations/[id]/audit`:
- Returns the full audit trail
- Supports filtering by `timeRange`, `severity`, `operation`, `status`
- Paginated (default 100 per page)

### 4. Mid-Migration Health Checks

The orchestrator runs health checks during execution:

- **Every 5 minutes**: Ping source AEM (`/libs/granite/core/content/login.html`)
- **Every 5 minutes**: Ping target AEM
- **Every 10 batches**: Count items on target, verify matches expected
- **Every batch**: Check Adobe IMS token expiry, refresh if needed

If any health check fails:
- Pause the migration (transition to PAUSED state)
- Write audit log entry with failure reason
- Optionally notify admin via configured webhook
- Wait for manual resume

### 5. Auto-Pause Triggers

The orchestrator automatically pauses when:

- **3 consecutive batch failures** — systemic issue, stop before damage
- **10%+ item failure rate across any phase** — something fundamentally wrong
- **Source or target unreachable for 60+ seconds** — network partition
- **FatalError thrown** — unrecoverable condition
- **User-initiated pause** via `PATCH /api/migrations/[id]` with `status: paused`

Paused migrations preserve all state and can be resumed.

### 6. Resume Capability

Resuming from PAUSED or FAILED state:

1. Load migration state from SQLite (last successful batch, last processed item)
2. Verify source and target are reachable
3. Verify target state matches expected (no external changes while paused)
4. Skip items already in audit log as `succeeded`
5. Continue from the exact failure point
6. Write resume event to audit log

This makes multi-day migrations safe to run with planned maintenance windows, network interruptions, or operator shift changes.

## Consequences

### Positive
- Migrations become safe to run unattended for hours or days
- Failures are recoverable, not catastrophic
- Audit trail enables post-mortem analysis for any migration
- Customers get real answers to "what happened?" questions
- Auto-pause prevents runaway damage from systemic issues

### Negative
- Added complexity in every execution code path
- Increased SQLite writes (audit log on every operation)
- Slight throughput reduction due to verification overhead
- Operators need to understand resume semantics and when to intervene
- Rollback logic needs extensive testing — it must never make things worse

### Estimated Effort
- Error taxonomy + refactor: 8-10 hours
- Transaction semantics for batches: 8-12 hours
- Audit logging infrastructure: 6-8 hours
- Health checks + auto-pause: 4-6 hours
- Resume capability: 6-8 hours
- Integration testing: 4-8 hours
- **Total: 36-52 hours**
