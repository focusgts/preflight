/**
 * GET /api/audit
 *
 * Query audit log with filters. Requires admin or super_admin role.
 * Query params: startDate, endDate, userId, action, resource, severity, limit, offset
 */

import { validateSession, SESSION_COOKIE } from '@/lib/auth/auth';
import { getAuditLogger, type AuditAction, type AuditSeverity } from '@/lib/audit/audit-logger';

const ADMIN_ROLES = ['admin', 'super_admin'];

export async function GET(request: Request): Promise<Response> {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const token = parseCookie(cookieHeader, SESSION_COOKIE);

    if (!token) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const user = await validateSession(token);
    if (!user) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' } },
        { status: 401 },
      );
    }

    if (!ADMIN_ROLES.includes(user.role)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const filters = {
      startDate: url.searchParams.get('startDate') ?? undefined,
      endDate: url.searchParams.get('endDate') ?? undefined,
      userId: url.searchParams.get('userId') ?? undefined,
      action: (url.searchParams.get('action') as AuditAction) ?? undefined,
      resource: url.searchParams.get('resource') ?? undefined,
      severity: (url.searchParams.get('severity') as AuditSeverity) ?? undefined,
      limit: url.searchParams.has('limit')
        ? parseInt(url.searchParams.get('limit')!, 10)
        : 100,
      offset: url.searchParams.has('offset')
        ? parseInt(url.searchParams.get('offset')!, 10)
        : 0,
    };

    const audit = getAuditLogger();
    const events = audit.query(filters);
    const stats = audit.getStats(
      filters.startDate && filters.endDate
        ? { start: filters.startDate, end: filters.endDate }
        : undefined,
    );

    return Response.json(
      {
        success: true,
        data: {
          events,
          stats,
          total: audit.getEntryCount(),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[Audit] Query error:', err);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to query audit log' } },
      { status: 500 },
    );
  }
}

function parseCookie(header: string, name: string): string | null {
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  if (!match) return null;
  return match.substring(name.length + 1);
}
