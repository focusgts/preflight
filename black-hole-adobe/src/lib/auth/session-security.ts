/**
 * Session Security Hardening
 *
 * Provides session fingerprinting, concurrent session control,
 * activity/absolute timeouts, revocation, and login rate limiting.
 */

import { randomUUID } from 'node:crypto';

// -----------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------

const MAX_CONCURRENT_SESSIONS = 3;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_PER_IP = 5;
const MAX_LOGIN_PER_EMAIL = 10;

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface SessionRecord {
  sessionId: string;
  userId: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivityAt: number;
  revoked: boolean;
}

export interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

interface RateLimitEntry {
  identifier: string;
  type: 'ip' | 'email';
  attempts: { timestamp: number }[];
}

// -----------------------------------------------------------------------
// SessionSecurity
// -----------------------------------------------------------------------

export class SessionSecurity {
  private sessions = new Map<string, SessionRecord>();
  private rateLimits = new Map<string, RateLimitEntry>();

  /**
   * Create a fingerprint from user agent and IP range.
   * Uses the /24 subnet for IP to allow minor IP changes.
   */
  private createFingerprint(ctx: RequestContext): string {
    const ipParts = ctx.ipAddress.split('.');
    const ipRange =
      ipParts.length === 4
        ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`
        : ctx.ipAddress;

    return `${ipRange}|${ctx.userAgent}`;
  }

  /**
   * Register a new session. Returns the session record.
   */
  createSession(userId: string, ctx: RequestContext): SessionRecord {
    const now = Date.now();
    const record: SessionRecord = {
      sessionId: randomUUID(),
      userId,
      fingerprint: this.createFingerprint(ctx),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      createdAt: now,
      lastActivityAt: now,
      revoked: false,
    };

    this.sessions.set(record.sessionId, record);
    return record;
  }

  /**
   * Validate that a session's fingerprint matches the current request context.
   * Returns false if the fingerprint does not match (possible session hijack).
   */
  validateSessionContext(
    sessionId: string,
    ctx: RequestContext,
  ): { valid: boolean; reason?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    if (session.revoked) {
      return { valid: false, reason: 'session_revoked' };
    }

    const now = Date.now();

    // Check absolute timeout
    if (now - session.createdAt > ABSOLUTE_TIMEOUT_MS) {
      session.revoked = true;
      return { valid: false, reason: 'absolute_timeout' };
    }

    // Check inactivity timeout
    if (now - session.lastActivityAt > INACTIVITY_TIMEOUT_MS) {
      session.revoked = true;
      return { valid: false, reason: 'inactivity_timeout' };
    }

    // Check fingerprint
    const currentFingerprint = this.createFingerprint(ctx);
    if (session.fingerprint !== currentFingerprint) {
      return { valid: false, reason: 'fingerprint_mismatch' };
    }

    // Update last activity
    session.lastActivityAt = now;
    return { valid: true };
  }

  /**
   * Check and enforce concurrent session limits.
   * Returns sessions that need to be revoked (oldest first) if limit exceeded.
   */
  checkConcurrentSessions(userId: string): {
    allowed: boolean;
    activeSessions: number;
    sessionsToRevoke: string[];
  } {
    const userSessions = this.getActiveSessions(userId);

    if (userSessions.length < MAX_CONCURRENT_SESSIONS) {
      return {
        allowed: true,
        activeSessions: userSessions.length,
        sessionsToRevoke: [],
      };
    }

    // Revoke the oldest sessions to make room
    const sorted = userSessions.sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const toRevoke = sorted.slice(
      0,
      sorted.length - MAX_CONCURRENT_SESSIONS + 1,
    );

    for (const session of toRevoke) {
      session.revoked = true;
    }

    return {
      allowed: true,
      activeSessions: userSessions.length,
      sessionsToRevoke: toRevoke.map((s) => s.sessionId),
    };
  }

  /**
   * Check rate limit for login attempts.
   * Returns whether the attempt is allowed.
   */
  checkRateLimit(
    identifier: string,
    type: 'ip' | 'email',
  ): { allowed: boolean; retryAfterMs: number } {
    const key = `${type}:${identifier}`;
    const now = Date.now();
    const maxAttempts =
      type === 'ip' ? MAX_LOGIN_PER_IP : MAX_LOGIN_PER_EMAIL;

    let entry = this.rateLimits.get(key);
    if (!entry) {
      entry = { identifier, type, attempts: [] };
      this.rateLimits.set(key, entry);
    }

    // Prune old attempts outside the window
    entry.attempts = entry.attempts.filter(
      (a) => now - a.timestamp < RATE_LIMIT_WINDOW_MS,
    );

    if (entry.attempts.length >= maxAttempts) {
      const oldestInWindow = entry.attempts[0].timestamp;
      const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    // Record this attempt
    entry.attempts.push({ timestamp: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  /**
   * Revoke all sessions for a user.
   */
  revokeAllSessions(userId: string): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revoked) {
        session.revoked = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Revoke a specific session.
   */
  revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.revoked) return false;
    session.revoked = true;
    return true;
  }

  /**
   * Get all active (non-revoked, non-expired) sessions for a user.
   */
  getActiveSessions(userId: string): SessionRecord[] {
    const now = Date.now();
    const results: SessionRecord[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId !== userId) continue;
      if (session.revoked) continue;
      if (now - session.createdAt > ABSOLUTE_TIMEOUT_MS) continue;
      if (now - session.lastActivityAt > INACTIVITY_TIMEOUT_MS) continue;
      results.push(session);
    }

    return results;
  }

  /**
   * Get a specific session record.
   */
  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up expired sessions from memory.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions.entries()) {
      const expired =
        session.revoked ||
        now - session.createdAt > ABSOLUTE_TIMEOUT_MS ||
        now - session.lastActivityAt > INACTIVITY_TIMEOUT_MS;

      if (expired) {
        this.sessions.delete(id);
        removed++;
      }
    }

    // Clean up old rate limit entries
    for (const [key, entry] of this.rateLimits.entries()) {
      entry.attempts = entry.attempts.filter(
        (a) => now - a.timestamp < RATE_LIMIT_WINDOW_MS,
      );
      if (entry.attempts.length === 0) {
        this.rateLimits.delete(key);
      }
    }

    return removed;
  }

  /**
   * Clear all state (for testing).
   */
  _clear(): void {
    this.sessions.clear();
    this.rateLimits.clear();
  }
}

// -----------------------------------------------------------------------
// Singleton
// -----------------------------------------------------------------------

let _sessionSecurityInstance: SessionSecurity | null = null;

export function getSessionSecurity(): SessionSecurity {
  if (!_sessionSecurityInstance) {
    _sessionSecurityInstance = new SessionSecurity();
  }
  return _sessionSecurityInstance;
}
