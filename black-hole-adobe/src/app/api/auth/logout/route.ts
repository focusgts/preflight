/**
 * POST /api/auth/logout
 *
 * Deletes the current session and clears the session cookie.
 */

import { deleteSession, SESSION_COOKIE } from '@/lib/auth/auth';

export async function POST(request: Request): Promise<Response> {
  try {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const token = parseCookie(cookieHeader, SESSION_COOKIE);

    if (token) {
      await deleteSession(token);
    }

    const response = Response.json(
      { success: true, data: null },
      { status: 200 },
    );

    // Clear the cookie
    response.headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );

    return response;
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Logout failed' },
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
