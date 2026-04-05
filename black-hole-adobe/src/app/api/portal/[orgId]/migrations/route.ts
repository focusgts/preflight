/**
 * GET /api/portal/[orgId]/migrations — List migrations scoped to a portal org
 *
 * Read-only endpoint that returns only migrations belonging to the given orgId.
 * Validates portal access via:
 *   1. bh_portal_token cookie matching the orgId, OR
 *   2. ?token= query parameter matching the orgId, OR
 *   3. orgId matching an organization with migrations in the store.
 *
 * Part of ADR-046 (Public Path Lockdown) — replaces the previous pattern of
 * exposing /api/migrations publicly.
 */

import { type NextRequest } from 'next/server';
import { success, error, paginated } from '@/lib/api/response';
import { listMigrations } from '@/lib/api/store';

function validatePortalAccess(
  request: NextRequest,
  orgId: string,
  orgMigrations: ReturnType<typeof listMigrations>,
): boolean {
  // Check 1: bh_portal_token cookie
  const cookieToken = request.cookies.get('bh_portal_token')?.value;
  if (cookieToken && cookieToken === `portal-${orgId}`) {
    return true;
  }

  // Check 2: ?token= query parameter
  const tokenParam = request.nextUrl.searchParams.get('token');
  if (tokenParam && tokenParam === `portal-${orgId}`) {
    return true;
  }

  // Check 3: org exists in migration store
  if (orgMigrations.length > 0) {
    return true;
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    if (!orgId || orgId.trim().length === 0) {
      return error('VALIDATION_ERROR', 'orgId is required', 400);
    }

    // Filter migrations belonging to this org
    const allMigrations = listMigrations();
    const orgSearch = orgId.toLowerCase();
    const orgMigrations = allMigrations.filter(
      (m) =>
        m.organizationId.toLowerCase() === orgSearch ||
        m.organizationName.toLowerCase().includes(orgSearch),
    );

    // Validate portal access
    if (!validatePortalAccess(request, orgId, orgMigrations)) {
      return error('UNAUTHORIZED', 'Invalid portal credentials', 401);
    }

    // Parse pagination params
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '100', 10)));

    const totalItems = orgMigrations.length;
    const start = (page - 1) * pageSize;
    const paginatedData = orgMigrations.slice(start, start + pageSize);

    return paginated(paginatedData, page, pageSize, totalItems);
  } catch (err) {
    console.error('[API] GET /api/portal/[orgId]/migrations error:', err);
    return error('INTERNAL_ERROR', 'Failed to list migrations', 500);
  }
}
