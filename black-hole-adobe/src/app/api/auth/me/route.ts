/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile.
 */

import { validateSession, SESSION_COOKIE } from '@/lib/auth/auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const token = parseCookie(cookieHeader, SESSION_COOKIE);

    if (!token) {
      return Response.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        },
        { status: 401 },
      );
    }

    const user = await validateSession(token);

    if (!user) {
      return Response.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' },
        },
        { status: 401 },
      );
    }

    return Response.json(
      {
        success: true,
        data: { user },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[Auth] /me error:', err);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve user' },
      },
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
