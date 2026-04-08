/**
 * ADR-061: Structured audit logging for migration operations.
 *
 * Every critical-path operation in the migration pipeline writes one row
 * per state transition (started / succeeded / failed / retried). The audit
 * trail powers post-mortem analysis and the `/api/migrations/[id]/audit`
 * endpoint.
 *
 * Falls back to an in-memory ring buffer if SQLite is unavailable (e.g.
 * edge runtime, missing native module).
 */

import { randomUUID } from 'node:crypto';
import type { MigrationError, ErrorCategory } from '@/lib/errors/migration-errors';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type AuditStatus = 'started' | 'succeeded' | 'failed' | 'retried' | 'skipped';

export interface AuditEntry {
  id: string;
  migrationId: string;
  correlationId: string;
  timestamp: string;
  operation: string;
  itemPath: string | null;
  status: AuditStatus;
  durationMs: number | null;
  errorCode: string | null;
  errorCategory: ErrorCategory | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditFilters {
  migrationId?: string;
  status?: AuditStatus;
  operation?: string;
  errorCategory?: ErrorCategory;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// -----------------------------------------------------------------------
// SQLite accessor (best-effort)
// -----------------------------------------------------------------------

function tryGetDb(): import('@/lib/db/database').DatabaseWrapper | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/db');
    return getDatabase();
  } catch {
    return null;
  }
}

let schemaEnsured = false;

function ensureSchema(db: import('@/lib/db/database').DatabaseWrapper): void {
  if (schemaEnsured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration_audit_log (
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
    CREATE INDEX IF NOT EXISTS idx_audit_migration ON migration_audit_log(migration_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON migration_audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_status ON migration_audit_log(status);
  `);
  schemaEnsured = true;
}

// -----------------------------------------------------------------------
// In-memory fallback
// -----------------------------------------------------------------------

const MAX_MEMORY_ENTRIES = 5000;
const memoryLog: AuditEntry[] = [];

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export interface NewAuditEntry {
  id?: string;
  timestamp?: string;
  migrationId: string;
  correlationId: string;
  operation: string;
  status: AuditStatus;
  itemPath?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorCategory?: ErrorCategory | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Write a single audit entry. Never throws — audit logging must not
 * interfere with the caller's execution path.
 */
export function logAuditEvent(entry: NewAuditEntry): AuditEntry {
  const full: AuditEntry = {
    id: entry.id ?? randomUUID(),
    migrationId: entry.migrationId,
    correlationId: entry.correlationId,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    operation: entry.operation,
    itemPath: entry.itemPath ?? null,
    status: entry.status,
    durationMs: entry.durationMs ?? null,
    errorCode: entry.errorCode ?? null,
    errorCategory: entry.errorCategory ?? null,
    errorMessage: entry.errorMessage ?? null,
    metadata: entry.metadata ?? null,
  };

  const db = tryGetDb();
  if (db) {
    try {
      ensureSchema(db);
      db.prepare(
        `INSERT INTO migration_audit_log (
          id, migration_id, correlation_id, timestamp, operation,
          item_path, status, duration_ms, error_code, error_category,
          error_message, metadata
        ) VALUES (
          @id, @migrationId, @correlationId, @timestamp, @operation,
          @itemPath, @status, @durationMs, @errorCode, @errorCategory,
          @errorMessage, @metadata
        )`,
      ).run({
        id: full.id,
        migrationId: full.migrationId,
        correlationId: full.correlationId,
        timestamp: full.timestamp,
        operation: full.operation,
        itemPath: full.itemPath,
        status: full.status,
        durationMs: full.durationMs,
        errorCode: full.errorCode,
        errorCategory: full.errorCategory,
        errorMessage: full.errorMessage,
        metadata: full.metadata ? JSON.stringify(full.metadata) : null,
      });
      return full;
    } catch (err) {
      console.warn('[AuditLog] SQLite write failed, using memory fallback:', err);
    }
  }

  memoryLog.push(full);
  if (memoryLog.length > MAX_MEMORY_ENTRIES) {
    memoryLog.splice(0, memoryLog.length - MAX_MEMORY_ENTRIES);
  }
  return full;
}

/**
 * Convenience helper: log a failed operation from a caught error.
 */
export function logAuditError(
  base: Omit<NewAuditEntry, 'status' | 'errorCode' | 'errorCategory' | 'errorMessage'>,
  err: MigrationError | Error | unknown,
): AuditEntry {
  let code = 'UNKNOWN_ERROR';
  let category: ErrorCategory | null = null;
  let message = 'Unknown error';

  if (err && typeof err === 'object' && 'code' in err && 'category' in err) {
    const me = err as MigrationError;
    code = me.code;
    category = me.category;
    message = me.message;
  } else if (err instanceof Error) {
    message = err.message;
    code = err.name || 'ERROR';
  } else {
    message = String(err);
  }

  return logAuditEvent({
    ...base,
    status: 'failed',
    errorCode: code,
    errorCategory: category,
    errorMessage: message,
  });
}

/**
 * Query the audit log with filters. Results ordered newest-first.
 */
export function queryAuditLog(filters: AuditFilters = {}): AuditEntry[] {
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const db = tryGetDb();
  if (db) {
    try {
      ensureSchema(db);
      const where: string[] = [];
      const params: Record<string, unknown> = {};

      if (filters.migrationId) {
        where.push('migration_id = @migrationId');
        params.migrationId = filters.migrationId;
      }
      if (filters.status) {
        where.push('status = @status');
        params.status = filters.status;
      }
      if (filters.operation) {
        where.push('operation = @operation');
        params.operation = filters.operation;
      }
      if (filters.errorCategory) {
        where.push('error_category = @errorCategory');
        params.errorCategory = filters.errorCategory;
      }
      if (filters.startDate) {
        where.push('timestamp >= @startDate');
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        where.push('timestamp <= @endDate');
        params.endDate = filters.endDate;
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      params.limit = limit;
      params.offset = offset;

      const rows = db
        .prepare(
          `SELECT * FROM migration_audit_log
           ${whereClause}
           ORDER BY timestamp DESC
           LIMIT @limit OFFSET @offset`,
        )
        .all(params) as Record<string, unknown>[];

      return rows.map(rowToEntry);
    } catch (err) {
      console.warn('[AuditLog] SQLite query failed, using memory fallback:', err);
    }
  }

  // Memory fallback
  let results = memoryLog.slice().reverse();
  if (filters.migrationId) {
    results = results.filter((e) => e.migrationId === filters.migrationId);
  }
  if (filters.status) results = results.filter((e) => e.status === filters.status);
  if (filters.operation) results = results.filter((e) => e.operation === filters.operation);
  if (filters.errorCategory) {
    results = results.filter((e) => e.errorCategory === filters.errorCategory);
  }
  if (filters.startDate) {
    results = results.filter((e) => e.timestamp >= filters.startDate!);
  }
  if (filters.endDate) {
    results = results.filter((e) => e.timestamp <= filters.endDate!);
  }
  return results.slice(offset, offset + limit);
}

/**
 * Count matching rows (for pagination). Respects the same filters as
 * `queryAuditLog` but ignores `limit` / `offset`.
 */
export function countAuditLog(filters: AuditFilters = {}): number {
  const db = tryGetDb();
  if (db) {
    try {
      ensureSchema(db);
      const where: string[] = [];
      const params: Record<string, unknown> = {};

      if (filters.migrationId) {
        where.push('migration_id = @migrationId');
        params.migrationId = filters.migrationId;
      }
      if (filters.status) {
        where.push('status = @status');
        params.status = filters.status;
      }
      if (filters.operation) {
        where.push('operation = @operation');
        params.operation = filters.operation;
      }
      if (filters.errorCategory) {
        where.push('error_category = @errorCategory');
        params.errorCategory = filters.errorCategory;
      }
      if (filters.startDate) {
        where.push('timestamp >= @startDate');
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        where.push('timestamp <= @endDate');
        params.endDate = filters.endDate;
      }
      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM migration_audit_log ${whereClause}`)
        .get(params) as { c: number };
      return row.c;
    } catch {
      // fall through
    }
  }

  return queryAuditLog({ ...filters, limit: Number.MAX_SAFE_INTEGER, offset: 0 }).length;
}

function rowToEntry(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string,
    migrationId: r.migration_id as string,
    correlationId: r.correlation_id as string,
    timestamp: r.timestamp as string,
    operation: r.operation as string,
    itemPath: (r.item_path as string) ?? null,
    status: r.status as AuditStatus,
    durationMs: (r.duration_ms as number) ?? null,
    errorCode: (r.error_code as string) ?? null,
    errorCategory: (r.error_category as ErrorCategory) ?? null,
    errorMessage: (r.error_message as string) ?? null,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : null,
  };
}

/**
 * Generate a correlation ID for grouping related audit entries (e.g. one
 * batch, one phase, one sync cycle).
 */
export function newCorrelationId(prefix = 'corr'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
