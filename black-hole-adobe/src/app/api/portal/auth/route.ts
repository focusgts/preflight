/**
 * POST /api/portal/auth — Validate portal access token
 *
 * Accepts { orgId, token } and validates against stored portal tokens.
 * For MVP: access is granted if:
 *   1. A valid `bh_portal_token` cookie matches the orgId, OR
 *   2. The orgId matches an organization with migrations in the system.
 *
 * This allows demos without complex token infrastructure.
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { listMigrations } from '@/lib/api/store';

const authSchema = z.object({
  orgId: z.string().min(1),
  token: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = authSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const { orgId, token } = parsed.data;

    // Check 1: validate bh_portal_token cookie
    const cookieToken = request.cookies.get('bh_portal_token')?.value;
    if (cookieToken && cookieToken === `portal-${orgId}`) {
      return success({
        authenticated: true,
        orgId,
        method: 'cookie',
      });
    }

    // Check 2: validate provided token (simple format: portal-{orgId})
    if (token && token === `portal-${orgId}`) {
      return success({
        authenticated: true,
        orgId,
        method: 'token',
      });
    }

    // Check 3: orgId matches an organization with migrations in the system
    const migrations = listMigrations();
    const orgSearch = orgId.toLowerCase();
    const orgMigrations = migrations.filter(
      (m) =>
        m.organizationId.toLowerCase() === orgSearch ||
        m.organizationName.toLowerCase().includes(orgSearch),
    );

    if (orgMigrations.length > 0) {
      return success({
        authenticated: true,
        orgId,
        organizationName: orgMigrations[0].organizationName,
        method: 'org_match',
      });
    }

    return error('UNAUTHORIZED', 'Invalid portal credentials', 401);
  } catch (err) {
    console.error('[API] POST /api/portal/auth error:', err);
    return error('INTERNAL_ERROR', 'Failed to authenticate', 500);
  }
}
