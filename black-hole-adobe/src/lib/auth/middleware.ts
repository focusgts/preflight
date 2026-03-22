/**
 * Auth Middleware for API Routes
 *
 * Wraps route handlers with session validation. Returns 401
 * if the request has no valid session cookie. Passes user info
 * to the handler via a second argument.
 */

import { validateSession, SESSION_COOKIE } from './auth';
import type { SessionUser } from './auth';

// -----------------------------------------------------------------------
// Paths that do not require authentication
// -----------------------------------------------------------------------

const PUBLIC_API_PATHS = [
  '/api/health',
  '/api/auth/login',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

// -----------------------------------------------------------------------
// withAuth wrapper
// -----------------------------------------------------------------------

type AuthenticatedHandler = (
  request: Request,
  context: { user: SessionUser; params?: Record<string, string> },
) => Promise<Response> | Response;

/**
 * Wrap an API route handler with session-based authentication.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (request, { user }) => {
 *   return Response.json({ user });
 * });
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
): (request: Request, context?: unknown) => Promise<Response> {
  return async (request: Request, context?: unknown) => {
    const url = new URL(request.url);

    // Allow public paths through
    if (isPublicPath(url.pathname)) {
      return handler(request, {
        user: { id: '', email: '', name: '', role: '' },
        ...(context && typeof context === 'object' ? context : {}),
      });
    }

    // Extract session token from cookie header
    const cookieHeader = request.headers.get('cookie') ?? '';
    const token = parseCookie(cookieHeader, SESSION_COOKIE);

    if (!token) {
      return unauthorizedResponse('No session token provided');
    }

    const user = await validateSession(token);

    if (!user) {
      return unauthorizedResponse('Invalid or expired session');
    }

    const routeContext = context && typeof context === 'object' ? context : {};
    return handler(request, { user, ...routeContext });
  };
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function parseCookie(header: string, name: string): string | null {
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));

  if (!match) return null;
  return match.substring(name.length + 1);
}

function unauthorizedResponse(message: string): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message,
        details: null,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'auth-error',
      },
    },
    { status: 401 },
  );
}
