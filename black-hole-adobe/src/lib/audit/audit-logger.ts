/**
 * Comprehensive Audit Logger
 *
 * Records all significant actions for SOC 2 Type II compliance.
 * Persists to JSON file with automatic rotation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.mfa_setup'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.mfa_verified'
  | 'auth.mfa_failed'
  | 'auth.session_created'
  | 'auth.session_revoked'
  | 'auth.rate_limited'
  // Migration operations
  | 'migration.created'
  | 'migration.assessment_started'
  | 'migration.started'
  | 'migration.completed'
  | 'migration.cancelled'
  | 'migration.deleted'
  // Data access
  | 'data.assessment_viewed'
  | 'data.report_downloaded'
  | 'data.export'
  // Configuration
  | 'config.connector_added'
  | 'config.connector_updated'
  | 'config.connector_removed'
  | 'config.settings_updated'
  | 'config.role_changed'
  // Review actions
  | 'review.code_approved'
  | 'review.code_rejected'
  | 'review.bulk_approved'
  // Admin actions
  | 'admin.user_created'
  | 'admin.user_deleted'
  | 'admin.role_assigned'
  | 'admin.session_revoked_admin'
  | 'admin.audit_exported';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
  severity: AuditSeverity;
}

export interface AuditQueryFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: AuditAction;
  resource?: string;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByDay: Record<string, number>;
  eventsBySeverity: Record<string, number>;
}

// -----------------------------------------------------------------------
// AuditLogger (Singleton)
// -----------------------------------------------------------------------

const MAX_IN_MEMORY = 10_000;
const DEFAULT_DATA_DIR = 'data';
const AUDIT_FILE = 'audit-log.json';

export class AuditLogger {
  private entries: AuditEvent[] = [];
  private dataDir: string;
  private filePath: string;
  private initialized = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? path.resolve(process.cwd(), DEFAULT_DATA_DIR);
    this.filePath = path.join(this.dataDir, AUDIT_FILE);
  }

  /**
   * Ensure the data directory exists and load existing entries.
   */
  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Only keep the most recent MAX_IN_MEMORY entries in memory
          this.entries = parsed.slice(-MAX_IN_MEMORY);
        }
      }
    } catch (err) {
      console.warn('[AuditLogger] Failed to load existing log:', err);
      this.entries = [];
    }
  }

  /**
   * Record an audit event.
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    this.initialize();

    const entry: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.entries.push(entry);

    // Rotate if over limit
    if (this.entries.length > MAX_IN_MEMORY) {
      this.archiveOldEntries();
    }

    // Persist asynchronously (fire-and-forget)
    this.persistToDisk();

    return entry;
  }

  /**
   * Query audit log with filters.
   */
  query(filters: AuditQueryFilters = {}): AuditEvent[] {
    this.initialize();

    let results = [...this.entries];

    if (filters.startDate) {
      results = results.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      results = results.filter((e) => e.timestamp <= filters.endDate!);
    }

    if (filters.userId) {
      results = results.filter((e) => e.userId === filters.userId);
    }

    if (filters.action) {
      results = results.filter((e) => e.action === filters.action);
    }

    if (filters.resource) {
      results = results.filter((e) => e.resource === filters.resource);
    }

    if (filters.severity) {
      results = results.filter((e) => e.severity === filters.severity);
    }

    // Sort newest first
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Export audit log as JSON or CSV.
   */
  export(
    format: 'json' | 'csv',
    filters: AuditQueryFilters = {},
  ): string {
    const events = this.query({ ...filters, limit: MAX_IN_MEMORY });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    // CSV format
    const headers = [
      'id',
      'timestamp',
      'userId',
      'userEmail',
      'action',
      'resource',
      'resourceId',
      'ipAddress',
      'severity',
      'details',
    ];

    const rows = events.map((e) =>
      headers
        .map((h) => {
          const val = e[h as keyof AuditEvent];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val).includes(',')
            ? `"${String(val)}"`
            : String(val);
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get aggregate statistics for a date range.
   */
  getStats(dateRange?: { start: string; end: string }): AuditStats {
    this.initialize();

    let events = this.entries;

    if (dateRange) {
      events = events.filter(
        (e) =>
          e.timestamp >= dateRange.start && e.timestamp <= dateRange.end,
      );
    }

    const eventsByAction: Record<string, number> = {};
    const eventsByUser: Record<string, number> = {};
    const eventsByDay: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    for (const event of events) {
      // By action
      eventsByAction[event.action] =
        (eventsByAction[event.action] ?? 0) + 1;

      // By user
      const userKey = event.userEmail ?? event.userId ?? 'anonymous';
      eventsByUser[userKey] = (eventsByUser[userKey] ?? 0) + 1;

      // By day
      const day = event.timestamp.substring(0, 10);
      eventsByDay[day] = (eventsByDay[day] ?? 0) + 1;

      // By severity
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] ?? 0) + 1;
    }

    return {
      totalEvents: events.length,
      eventsByAction,
      eventsByUser,
      eventsByDay,
      eventsBySeverity,
    };
  }

  /**
   * Get the total number of entries in memory.
   */
  getEntryCount(): number {
    this.initialize();
    return this.entries.length;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private archiveOldEntries(): void {
    // Keep only the newest MAX_IN_MEMORY entries
    const overflow = this.entries.length - MAX_IN_MEMORY;
    if (overflow <= 0) return;

    const archived = this.entries.splice(0, overflow);

    // Append archived entries to a separate archive file
    try {
      const archivePath = path.join(
        this.dataDir,
        `audit-archive-${new Date().toISOString().substring(0, 10)}.json`,
      );
      let existing: AuditEvent[] = [];
      if (fs.existsSync(archivePath)) {
        existing = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
      }
      fs.writeFileSync(
        archivePath,
        JSON.stringify([...existing, ...archived], null, 2),
      );
    } catch (err) {
      console.warn('[AuditLogger] Failed to archive old entries:', err);
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.entries, null, 2),
      );
    } catch (err) {
      console.warn('[AuditLogger] Failed to persist audit log:', err);
    }
  }

  /**
   * Clear all entries (used in testing).
   */
  _clear(): void {
    this.entries = [];
  }
}

// -----------------------------------------------------------------------
// Singleton
// -----------------------------------------------------------------------

let _auditInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!_auditInstance) {
    _auditInstance = new AuditLogger();
  }
  return _auditInstance;
}
