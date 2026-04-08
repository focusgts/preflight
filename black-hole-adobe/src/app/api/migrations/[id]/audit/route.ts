/**
 * GET /api/migrations/[id]/audit
 *
 * ADR-061: Query the structured audit log for a migration. Returns a
 * paginated list of audit entries with optional filters.
 *
 * Query params:
 *   limit          (default 100, max 1000)
 *   offset         (default 0)
 *   status         started | succeeded | failed | retried | skipped
 *   operation      operation name filter
 *   severity       network | auth | rate-limit | validation | content | fatal
 *                  (alias for error_category)
 *   startDate      ISO-8601
 *   endDate        ISO-8601
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import {
  queryAuditLog,
  countAuditLog,
  type AuditFilters,
  type AuditStatus,
} from '@/lib/audit/migration-audit-log';
import type { ErrorCategory } from '@/lib/errors/migration-errors';

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUS: AuditStatus[] = ['started', 'succeeded', 'failed', 'retried', 'skipped'];
const VALID_CATEGORY: ErrorCategory[] = [
  'network',
  'auth',
  'rate-limit',
  'validation',
  'content',
  'fatal',
];

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const migration = getMigration(id);
    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const sp = request.nextUrl.searchParams;

    const limit = Math.min(
      Math.max(parseInt(sp.get('limit') ?? '100', 10) || 100, 1),
      1000,
    );
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0);

    const filters: AuditFilters = {
      migrationId: id,
      limit,
      offset,
    };

    const status = sp.get('status');
    if (status && (VALID_STATUS as string[]).includes(status)) {
      filters.status = status as AuditStatus;
    }

    const operation = sp.get('operation');
    if (operation) filters.operation = operation;

    const severity = sp.get('severity') ?? sp.get('errorCategory');
    if (severity && (VALID_CATEGORY as string[]).includes(severity)) {
      filters.errorCategory = severity as ErrorCategory;
    }

    const startDate = sp.get('startDate');
    if (startDate) filters.startDate = startDate;

    const endDate = sp.get('endDate');
    if (endDate) filters.endDate = endDate;

    const entries = queryAuditLog(filters);
    const total = countAuditLog({ ...filters, limit: undefined, offset: undefined });

    return success({
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    });
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/audit error:', err);
    return error('INTERNAL_ERROR', 'Failed to query audit log', 500);
  }
}
