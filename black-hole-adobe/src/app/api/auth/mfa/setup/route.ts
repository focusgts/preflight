/**
 * POST /api/auth/mfa/setup
 *
 * Generate an MFA secret and return the QR code URL.
 * Requires an authenticated session.
 */

import { validateSession, SESSION_COOKIE } from '@/lib/auth/auth';
import { getMFAManager } from '@/lib/auth/mfa';
import { getAuditLogger } from '@/lib/audit/audit-logger';

export async function POST(request: Request): Promise<Response> {
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

    const mfa = getMFAManager();
    const { secret, recoveryCodes } = mfa.generateSecret(user.id);
    const qrCodeURL = mfa.generateQRCodeURL(secret, user.email);

    const audit = getAuditLogger();
    audit.log({
      userId: user.id,
      userEmail: user.email,
      action: 'auth.mfa_setup',
      resource: 'user',
      resourceId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
      details: {},
      severity: 'info',
    });

    return Response.json(
      {
        success: true,
        data: {
          secret,
          qrCodeURL,
          recoveryCodes,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[MFA] Setup error:', err);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'MFA setup failed' } },
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
