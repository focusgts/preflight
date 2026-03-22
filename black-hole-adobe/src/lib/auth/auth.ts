/**
 * Session-Based Authentication
 *
 * Uses crypto.subtle for password hashing (no bcrypt dependency needed).
 * Sessions are stored in SQLite with 24-hour expiry.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase } from '@/lib/db';
import type { DbUser, DbSession } from '@/lib/db';

// -----------------------------------------------------------------------
// Password Hashing (PBKDF2 via Node crypto)
// -----------------------------------------------------------------------

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha-512';

export async function hashPassword(password: string): Promise<string> {
  const { pbkdf2, randomBytes } = await import('node:crypto');
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, 'sha512', (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const { pbkdf2 } = await import('node:crypto');
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, 'sha512', (err, key) => {
      if (err) return reject(err);
      resolve(key.toString('hex') === hash);
    });
  });
}

// -----------------------------------------------------------------------
// Session Management
// -----------------------------------------------------------------------

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDatabase();

  // Clean up expired sessions periodically
  db.deleteExpiredSessions();

  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  db.createSession({
    id: token,
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return token;
}

export async function validateSession(
  token: string,
): Promise<SessionUser | null> {
  const db = getDatabase();
  const session = db.getSession(token);

  if (!session) return null;

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    db.deleteSession(token);
    return null;
  }

  const user = db.getUserById(session.userId);
  if (!user) {
    db.deleteSession(token);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function deleteSession(token: string): Promise<boolean> {
  const db = getDatabase();
  return db.deleteSession(token);
}

// -----------------------------------------------------------------------
// Default Admin User (created on first run)
// -----------------------------------------------------------------------

export async function ensureDefaultAdmin(): Promise<void> {
  const db = getDatabase();
  const existing = db.getUserByEmail('admin@blackhole.io');
  if (existing) return;

  const hashedPw = await hashPassword('admin123');

  db.createUser({
    id: randomUUID(),
    email: 'admin@blackhole.io',
    name: 'Admin',
    password: hashedPw,
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log('[Auth] Default admin user created (admin@blackhole.io)');
}

// -----------------------------------------------------------------------
// Session Cookie Name
// -----------------------------------------------------------------------

export const SESSION_COOKIE = 'bh_session';
