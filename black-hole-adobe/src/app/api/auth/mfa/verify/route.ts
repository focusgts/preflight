/**
 * POST /api/auth/mfa/verify
 *
 * Verify a TOTP token during login or MFA setup.
 * Body: { token: string, action?: 'enable' | 'disable' | 'verify' }
 */

import { validateSession, SESSION_COOKIE } from '@/lib/auth/auth';
import { getMFAManager } from '@/lib/auth/mfa';
import { getAuditLogger } from '@/lib/audit/audit-logger';

export async function POST(request: Request): Promise<Response> {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE);

    if (!sessionToken) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const user = await validateSession(sessionToken);
    if (!user) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { token, action = 'verify' } = body as {
      token?: string;
      action?: 'enable' | 'disable' | 'verify';
    };

    if (!token || typeof token !== 'string') {
      return Response.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Token is required' } },
        { status: 400 },
      );
    }

    const mfa = getMFAManager();
    const audit = getAuditLogger();
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    if (action === 'enable') {
      const enabled = mfa.enableMFA(user.id, token);

      audit.log({
        userId: user.id,
        userEmail: user.email,
        action: enabled ? 'auth.mfa_enabled' : 'auth.mfa_failed',
        resource: 'user',
        resourceId: user.id,
        ipAddress,
        userAgent,
        details: { action: 'enable' },
        severity: enabled ? 'info' : 'warning',
      });

      if (!enabled) {
        return Response.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' } },
          { status: 400 },
        );
      }

      return Response.json(
        { success: true, data: { mfaEnabled: true } },
        { status: 200 },
      );
    }

    if (action === 'disable') {
      const disabled = mfa.disableMFA(user.id, token);

      audit.log({
        userId: user.id,
        userEmail: user.email,
        action: disabled ? 'auth.mfa_disabled' : 'auth.mfa_failed',
        resource: 'user',
        resourceId: user.id,
        ipAddress,
        userAgent,
        details: { action: 'disable' },
        severity: disabled ? 'info' : 'warning',
      });

      if (!disabled) {
        return Response.json(
          { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' } },
          { status: 400 },
        );
      }

      return Response.json(
        { success: true, data: { mfaEnabled: false } },
        { status: 200 },
      );
    }

    // Default: verify
    const verified = mfa.verifyToken(user.id, token);

    audit.log({
      userId: user.id,
      userEmail: user.email,
      action: verified ? 'auth.mfa_verified' : 'auth.mfa_failed',
      resource: 'user',
      resourceId: user.id,
      ipAddress,
      userAgent,
      details: { action: 'verify' },
      severity: verified ? 'info' : 'warning',
    });

    if (!verified) {
      return Response.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' } },
        { status: 400 },
      );
    }

    return Response.json(
      { success: true, data: { verified: true } },
      { status: 200 },
    );
  } catch (err) {
    console.error('[MFA] Verify error:', err);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'MFA verification failed' } },
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
