/**
 * ADR-062: Migration state history persistence.
 *
 * Stores every state transition (from, to, trigger, metadata) for the
 * migration orchestrator. Falls back to an in-memory store when SQLite is
 * unavailable — mirroring the pattern used by drift-monitor and the audit
 * log.
 */

import { randomUUID } from 'node:crypto';
import type { TriggerSource } from './state-machine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateHistoryEntry {
  id: string;
  migrationId: string;
  fromState: string | null;
  toState: string;
  triggerSource: TriggerSource;
  triggeredBy: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SQLite accessor (best-effort)
// ---------------------------------------------------------------------------

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
    CREATE TABLE IF NOT EXISTS migration_state_history (
      id TEXT PRIMARY KEY,
      migration_id TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      trigger_source TEXT NOT NULL,
      triggered_by TEXT,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_state_history_migration ON migration_state_history(migration_id);
    CREATE INDEX IF NOT EXISTS idx_state_history_timestamp ON migration_state_history(timestamp);
  `);
  schemaEnsured = true;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const MAX_MEMORY_ENTRIES_PER_MIGRATION = 1000;
const memoryHistory = new Map<string, StateHistoryEntry[]>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a state transition to history. Never throws — history logging
 * must not interfere with the orchestrator's execution path.
 */
export function logStateTransition(
  entry: Omit<StateHistoryEntry, 'id' | 'timestamp'>,
): StateHistoryEntry {
  const full: StateHistoryEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    migrationId: entry.migrationId,
    fromState: entry.fromState,
    toState: entry.toState,
    triggerSource: entry.triggerSource,
    triggeredBy: entry.triggeredBy,
    metadata: entry.metadata ?? {},
  };

  const db = tryGetDb();
  if (db) {
    try {
      ensureSchema(db);
      db.prepare(
        `INSERT INTO migration_state_history (
          id, migration_id, from_state, to_state,
          trigger_source, triggered_by, timestamp, metadata
        ) VALUES (
          @id, @migrationId, @fromState, @toState,
          @triggerSource, @triggeredBy, @timestamp, @metadata
        )`,
      ).run({
        id: full.id,
        migrationId: full.migrationId,
        fromState: full.fromState,
        toState: full.toState,
        triggerSource: full.triggerSource,
        triggeredBy: full.triggeredBy,
        timestamp: full.timestamp,
        metadata: full.metadata ? JSON.stringify(full.metadata) : null,
      });
      return full;
    } catch (err) {
      console.warn(
        '[StateHistory] SQLite write failed, using memory fallback:',
        err,
      );
    }
  }

  const bucket = memoryHistory.get(full.migrationId) ?? [];
  bucket.push(full);
  if (bucket.length > MAX_MEMORY_ENTRIES_PER_MIGRATION) {
    bucket.splice(0, bucket.length - MAX_MEMORY_ENTRIES_PER_MIGRATION);
  }
  memoryHistory.set(full.migrationId, bucket);
  return full;
}

/**
 * Fetch the state history for a migration, newest-first.
 */
export function getStateHistory(
  migrationId: string,
  limit = 100,
): StateHistoryEntry[] {
  const db = tryGetDb();
  if (db) {
    try {
      ensureSchema(db);
      const rows = db
        .prepare(
          `SELECT * FROM migration_state_history
           WHERE migration_id = ?
           ORDER BY timestamp DESC
           LIMIT ?`,
        )
        .all(migrationId, limit) as Record<string, unknown>[];
      return rows.map(rowToEntry);
    } catch (err) {
      console.warn(
        '[StateHistory] SQLite read failed, using memory fallback:',
        err,
      );
    }
  }

  const bucket = memoryHistory.get(migrationId) ?? [];
  return bucket.slice().reverse().slice(0, limit);
}

/**
 * Return the most recent history entry for a migration, or null if none.
 */
export function getLastState(
  migrationId: string,
): StateHistoryEntry | null {
  const history = getStateHistory(migrationId, 1);
  return history[0] ?? null;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToEntry(r: Record<string, unknown>): StateHistoryEntry {
  return {
    id: r.id as string,
    migrationId: r.migration_id as string,
    fromState: (r.from_state as string) ?? null,
    toState: r.to_state as string,
    triggerSource: r.trigger_source as TriggerSource,
    triggeredBy: (r.triggered_by as string) ?? null,
    timestamp: r.timestamp as string,
    metadata: r.metadata
      ? (JSON.parse(r.metadata as string) as Record<string, unknown>)
      : {},
  };
}
