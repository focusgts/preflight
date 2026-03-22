/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password. Returns the user profile
 * and sets an httpOnly session cookie.
 */

import { getDatabase } from '@/lib/db';
import {
  verifyPassword,
  createSession,
  ensureDefaultAdmin,
  SESSION_COOKIE,
} from '@/lib/auth/auth';

export async function POST(request: Request): Promise<Response> {
  try {
    // Ensure default admin exists on first login attempt
    await ensureDefaultAdmin();

    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
        },
        { status: 400 },
      );
    }

    const db = getDatabase();
    const user = db.getUserByEmail(email);

    if (!user) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.password);

    if (!valid) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        },
        { status: 401 },
      );
    }

    const token = await createSession(user.id);

    const response = Response.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      },
      { status: 200 },
    );

    // Set httpOnly cookie
    response.headers.set(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    );

    return response;
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
      },
      { status: 500 },
    );
  }
}
