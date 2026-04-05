/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * Protects all dashboard routes by checking for a valid session cookie.
 * Redirects unauthenticated users to /login.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Paths that do not require authentication.
 * Static assets (_next/static, favicon, etc.) are excluded via the matcher.
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/calculator',
  '/api/leads',
  '/api/scanner',
  '/api/portal',
  '/portal',
  '/calculator',
  '/score',
  '/assessment',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')),
  );
}

const SESSION_COOKIE = 'bh_session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    // If user is logged in and visits /login, redirect to /overview
    if (pathname === '/login') {
      const session = request.cookies.get(SESSION_COOKIE)?.value;
      if (session) {
        return NextResponse.redirect(new URL('/overview', request.url));
      }
    }
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    // For API routes, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 },
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists -- let the request proceed.
  // Full session validation happens in the API route handlers.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
