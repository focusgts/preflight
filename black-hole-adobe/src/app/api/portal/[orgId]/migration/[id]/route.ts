/**
 * GET /api/portal/[orgId]/migration/[id] — Get a single migration scoped to a portal org
 *
 * Read-only endpoint that returns a single migration by ID, but only if it
 * belongs to the given orgId. Validates portal access via:
 *   1. bh_portal_token cookie matching the orgId, OR
 *   2. ?token= query parameter matching the orgId, OR
 *   3. orgId matching an organization with migrations in the store.
 *
 * Part of ADR-046 (Public Path Lockdown).
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMigration, listMigrations } from '@/lib/api/store';

function validatePortalAccess(
  request: NextRequest,
  orgId: string,
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
  const allMigrations = listMigrations();
  const orgSearch = orgId.toLowerCase();
  const hasOrgMigrations = allMigrations.some(
    (m) =>
      m.organizationId.toLowerCase() === orgSearch ||
      m.organizationName.toLowerCase().includes(orgSearch),
  );

  return hasOrgMigrations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> },
) {
  try {
    const { orgId, id } = await params;

    if (!orgId || orgId.trim().length === 0) {
      return error('VALIDATION_ERROR', 'orgId is required', 400);
    }

    if (!id || id.trim().length === 0) {
      return error('VALIDATION_ERROR', 'Migration ID is required', 400);
    }

    // Validate portal access
    if (!validatePortalAccess(request, orgId)) {
      return error('UNAUTHORIZED', 'Invalid portal credentials', 401);
    }

    // Fetch the migration
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', 'Migration not found', 404);
    }

    // Verify it belongs to this org
    const orgSearch = orgId.toLowerCase();
    const belongsToOrg =
      migration.organizationId.toLowerCase() === orgSearch ||
      migration.organizationName.toLowerCase().includes(orgSearch);

    if (!belongsToOrg) {
      return error('NOT_FOUND', 'Migration not found', 404);
    }

    return success(migration);
  } catch (err) {
    console.error('[API] GET /api/portal/[orgId]/migration/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get migration', 500);
  }
}
