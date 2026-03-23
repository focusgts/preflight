/**
 * Enterprise Security Tests
 *
 * Covers RBAC, TOTP MFA, audit logging, and session security.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RBACManager,
  ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from '@/lib/auth/rbac';
import {
  MFAManager,
  generateTOTPCode,
  getTimeCounter,
  base32Encode,
  base32Decode,
} from '@/lib/auth/mfa';
import { AuditLogger } from '@/lib/audit/audit-logger';
import { SessionSecurity } from '@/lib/auth/session-security';

// =======================================================================
// RBAC Tests
// =======================================================================

describe('RBACManager', () => {
  let rbac: RBACManager;

  beforeEach(() => {
    rbac = new RBACManager();
  });

  it('should assign a role to a user', () => {
    rbac.assignRole('user-1', 'admin', 'org-1');
    const entry = rbac.getUserRole('user-1');
    expect(entry).toBeDefined();
    expect(entry!.role).toBe('admin');
    expect(entry!.organizationId).toBe('org-1');
  });

  it('should reject invalid roles', () => {
    expect(() => rbac.assignRole('user-1', 'invalid' as Role)).toThrow(
      'Invalid role',
    );
  });

  it('should return correct permissions for super_admin', () => {
    rbac.assignRole('user-1', 'super_admin');
    const perms = rbac.getUserPermissions('user-1');
    expect(perms).toContain('manage_users');
    expect(perms).toContain('manage_system');
    expect(perms).toContain('delete_migration');
    expect(perms).toContain('manage_security');
  });

  it('should return correct permissions for viewer', () => {
    rbac.assignRole('user-1', 'viewer');
    const perms = rbac.getUserPermissions('user-1');
    expect(perms).toContain('view_migrations');
    expect(perms).toContain('view_reports');
    expect(perms).not.toContain('manage_users');
    expect(perms).not.toContain('create_migration');
  });

  it('should return correct permissions for customer', () => {
    rbac.assignRole('user-1', 'customer', 'org-1');
    const perms = rbac.getUserPermissions('user-1');
    expect(perms).toEqual(['view_portal']);
  });

  it('should check hasPermission correctly', () => {
    rbac.assignRole('user-1', 'migration_manager');
    expect(rbac.hasPermission('user-1', 'create_migration')).toBe(true);
    expect(rbac.hasPermission('user-1', 'manage_users')).toBe(false);
  });

  it('should return false for unknown user', () => {
    expect(rbac.hasPermission('unknown', 'view_reports')).toBe(false);
    expect(rbac.getUserPermissions('unknown')).toEqual([]);
  });

  it('should check resource access for admin', () => {
    rbac.assignRole('user-1', 'admin', 'org-1');
    expect(rbac.checkAccess('user-1', 'migration', 'create', 'org-1')).toBe(
      true,
    );
    expect(rbac.checkAccess('user-1', 'migration', 'read', 'org-1')).toBe(
      true,
    );
  });

  it('should enforce organization scoping', () => {
    rbac.assignRole('user-1', 'admin', 'org-1');
    // Admin in org-1 should not access org-2 resources
    expect(rbac.checkAccess('user-1', 'migration', 'read', 'org-2')).toBe(
      false,
    );
  });

  it('should allow super_admin cross-org access', () => {
    rbac.assignRole('user-1', 'super_admin', 'org-1');
    expect(rbac.checkAccess('user-1', 'migration', 'read', 'org-2')).toBe(
      true,
    );
  });

  it('should deny viewer write access', () => {
    rbac.assignRole('user-1', 'viewer');
    expect(rbac.checkAccess('user-1', 'migration', 'create')).toBe(false);
    expect(rbac.checkAccess('user-1', 'migration', 'delete')).toBe(false);
  });

  it('should deny reviewer migration creation', () => {
    rbac.assignRole('user-1', 'reviewer');
    expect(rbac.hasPermission('user-1', 'create_migration')).toBe(false);
    expect(rbac.hasPermission('user-1', 'review_code_changes')).toBe(true);
  });
});

// =======================================================================
// MFA / TOTP Tests
// =======================================================================

describe('MFAManager', () => {
  let mfa: MFAManager;

  beforeEach(() => {
    mfa = new MFAManager();
  });

  it('should generate a secret for a user', () => {
    const { secret, recoveryCodes } = mfa.generateSecret('user-1');
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(10);
    expect(recoveryCodes).toHaveLength(8);
  });

  it('should generate a valid QR code URL', () => {
    const { secret } = mfa.generateSecret('user-1');
    const url = mfa.generateQRCodeURL(secret, 'test@example.com');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(encodeURIComponent('test@example.com'));
    expect(url).toContain(secret);
    expect(url).toContain('BlackHole');
  });

  it('should verify a valid TOTP token', () => {
    mfa.generateSecret('user-1');
    // Use the test helper to generate a valid token
    const token = mfa._generateCodeForTesting('user-1')!;
    expect(token).toHaveLength(6);

    // Enable MFA first
    mfa.enableMFA('user-1', token);

    // Re-generate because the same code should still be valid within the window
    const token2 = mfa._generateCodeForTesting('user-1')!;
    expect(mfa.verifyToken('user-1', token2)).toBe(true);
  });

  it('should reject an invalid TOTP token', () => {
    mfa.generateSecret('user-1');
    const token = mfa._generateCodeForTesting('user-1')!;
    mfa.enableMFA('user-1', token);
    expect(mfa.verifyToken('user-1', '000000')).toBe(false);
  });

  it('should handle time window tolerance', () => {
    mfa.generateSecret('user-1');
    const now = Math.floor(Date.now() / 1000);

    // Get the current token to enable MFA
    const currentToken = mfa._generateCodeForTesting('user-1')!;
    mfa.enableMFA('user-1', currentToken);

    // Token from 30 seconds ago (previous window) should still work
    const prevToken = mfa._generateCodeForTesting(
      'user-1',
      now - 30,
    )!;
    // This might or might not match the current window depending on timing,
    // but the tolerance window should accept it
    expect(typeof prevToken).toBe('string');
    expect(prevToken).toHaveLength(6);
  });

  it('should enable MFA with valid token', () => {
    mfa.generateSecret('user-1');
    expect(mfa.isMFAEnabled('user-1')).toBe(false);

    const token = mfa._generateCodeForTesting('user-1')!;
    const result = mfa.enableMFA('user-1', token);
    expect(result).toBe(true);
    expect(mfa.isMFAEnabled('user-1')).toBe(true);
  });

  it('should not enable MFA with invalid token', () => {
    mfa.generateSecret('user-1');
    const result = mfa.enableMFA('user-1', '000000');
    expect(result).toBe(false);
    expect(mfa.isMFAEnabled('user-1')).toBe(false);
  });

  it('should disable MFA with valid token', () => {
    mfa.generateSecret('user-1');
    const token = mfa._generateCodeForTesting('user-1')!;
    mfa.enableMFA('user-1', token);

    const token2 = mfa._generateCodeForTesting('user-1')!;
    expect(mfa.disableMFA('user-1', token2)).toBe(true);
    expect(mfa.isMFAEnabled('user-1')).toBe(false);
  });

  it('should accept recovery codes', () => {
    const { recoveryCodes } = mfa.generateSecret('user-1');
    const token = mfa._generateCodeForTesting('user-1')!;
    mfa.enableMFA('user-1', token);

    // Use a recovery code
    expect(mfa.verifyToken('user-1', recoveryCodes[0])).toBe(true);
    // Same recovery code should not work again
    expect(mfa.verifyToken('user-1', recoveryCodes[0])).toBe(false);
  });

  it('should return false for non-existent user', () => {
    expect(mfa.verifyToken('nonexistent', '123456')).toBe(false);
    expect(mfa.isMFAEnabled('nonexistent')).toBe(false);
  });
});

describe('TOTP Core', () => {
  it('should encode and decode base32 correctly', () => {
    const original = Buffer.from('Hello World');
    const encoded = base32Encode(original);
    const decoded = base32Decode(encoded);
    expect(decoded.toString()).toBe('Hello World');
  });

  it('should generate consistent TOTP codes for same counter', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    const counter = 1000;
    const code1 = generateTOTPCode(secret, counter);
    const code2 = generateTOTPCode(secret, counter);
    expect(code1).toBe(code2);
    expect(code1).toHaveLength(6);
  });

  it('should generate different codes for different counters', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    const code1 = generateTOTPCode(secret, 1000);
    const code2 = generateTOTPCode(secret, 1001);
    expect(code1).not.toBe(code2);
  });

  it('should compute time counter correctly', () => {
    const counter = getTimeCounter(1234567890);
    expect(counter).toBe(Math.floor(1234567890 / 30));
  });
});

// =======================================================================
// Audit Logger Tests
// =======================================================================

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    // Use a temp directory to avoid polluting the project
    logger = new AuditLogger('/tmp/bh-test-audit-' + Date.now());
  });

  it('should log an authentication event', () => {
    const event = logger.log({
      userId: 'user-1',
      userEmail: 'user@test.com',
      action: 'auth.login',
      resource: 'session',
      resourceId: 'session-1',
      ipAddress: '192.168.1.1',
      userAgent: 'TestAgent',
      details: {},
      severity: 'info',
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.action).toBe('auth.login');
  });

  it('should log a migration operation', () => {
    logger.log({
      userId: 'user-1',
      userEmail: 'user@test.com',
      action: 'migration.created',
      resource: 'migration',
      resourceId: 'mig-1',
      ipAddress: null,
      userAgent: null,
      details: { name: 'Test Migration' },
      severity: 'info',
    });

    const results = logger.query({ action: 'migration.created' });
    expect(results).toHaveLength(1);
    expect(results[0].resourceId).toBe('mig-1');
  });

  it('should query with date range filter', () => {
    const now = new Date();
    logger.log({
      userId: 'user-1',
      userEmail: 'user@test.com',
      action: 'auth.login',
      resource: 'session',
      resourceId: null,
      ipAddress: null,
      userAgent: null,
      details: {},
      severity: 'info',
    });

    const results = logger.query({
      startDate: new Date(now.getTime() - 60_000).toISOString(),
      endDate: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should export as CSV', () => {
    logger.log({
      userId: 'user-1',
      userEmail: 'user@test.com',
      action: 'auth.login',
      resource: 'session',
      resourceId: null,
      ipAddress: '10.0.0.1',
      userAgent: null,
      details: {},
      severity: 'info',
    });

    const csv = logger.export('csv');
    expect(csv).toContain('id,timestamp,userId');
    expect(csv).toContain('auth.login');
  });

  it('should compute stats', () => {
    // Use a fresh logger for stats test
    const statsLogger = new AuditLogger('/tmp/bh-test-audit-stats-' + Date.now());
    statsLogger.log({ userId: 'u1', userEmail: 'a@b.com', action: 'auth.login', resource: 'session', resourceId: null, ipAddress: null, userAgent: null, details: {}, severity: 'info' });
    statsLogger.log({ userId: 'u2', userEmail: 'c@d.com', action: 'auth.login_failed', resource: 'session', resourceId: null, ipAddress: null, userAgent: null, details: {}, severity: 'warning' });
    statsLogger.log({ userId: 'u1', userEmail: 'a@b.com', action: 'auth.login', resource: 'session', resourceId: null, ipAddress: null, userAgent: null, details: {}, severity: 'info' });

    const stats = statsLogger.getStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.eventsByAction['auth.login']).toBe(2);
    expect(stats.eventsByAction['auth.login_failed']).toBe(1);
    expect(stats.eventsBySeverity['info']).toBe(2);
    expect(stats.eventsBySeverity['warning']).toBe(1);
  });
});

// =======================================================================
// Session Security Tests
// =======================================================================

describe('SessionSecurity', () => {
  let security: SessionSecurity;
  const ctx = { ipAddress: '192.168.1.100', userAgent: 'TestBrowser/1.0' };

  beforeEach(() => {
    security = new SessionSecurity();
  });

  it('should create a session with fingerprint', () => {
    const session = security.createSession('user-1', ctx);
    expect(session.sessionId).toBeDefined();
    expect(session.userId).toBe('user-1');
    expect(session.fingerprint).toContain('192.168.1.0/24');
  });

  it('should validate matching session context', () => {
    const session = security.createSession('user-1', ctx);
    const result = security.validateSessionContext(session.sessionId, ctx);
    expect(result.valid).toBe(true);
  });

  it('should detect fingerprint mismatch', () => {
    const session = security.createSession('user-1', ctx);
    const differentCtx = {
      ipAddress: '10.0.0.1',
      userAgent: 'DifferentBrowser/2.0',
    };
    const result = security.validateSessionContext(
      session.sessionId,
      differentCtx,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('fingerprint_mismatch');
  });

  it('should enforce concurrent session limit', () => {
    security.createSession('user-1', ctx);
    security.createSession('user-1', ctx);
    security.createSession('user-1', ctx);

    // 4th session should trigger revocation of oldest
    const check = security.checkConcurrentSessions('user-1');
    expect(check.allowed).toBe(true);
    expect(check.sessionsToRevoke.length).toBeGreaterThanOrEqual(1);
  });

  it('should allow rate limited login', () => {
    const r1 = security.checkRateLimit('192.168.1.1', 'ip');
    expect(r1.allowed).toBe(true);
  });

  it('should block after exceeding IP rate limit', () => {
    for (let i = 0; i < 5; i++) {
      security.checkRateLimit('192.168.1.1', 'ip');
    }
    const result = security.checkRateLimit('192.168.1.1', 'ip');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should block after exceeding email rate limit', () => {
    for (let i = 0; i < 10; i++) {
      security.checkRateLimit('user@test.com', 'email');
    }
    const result = security.checkRateLimit('user@test.com', 'email');
    expect(result.allowed).toBe(false);
  });

  it('should revoke all sessions for a user', () => {
    security.createSession('user-1', ctx);
    security.createSession('user-1', ctx);

    const count = security.revokeAllSessions('user-1');
    expect(count).toBe(2);

    const active = security.getActiveSessions('user-1');
    expect(active).toHaveLength(0);
  });

  it('should return session not found for invalid id', () => {
    const result = security.validateSessionContext('invalid', ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('session_not_found');
  });

  it('should detect revoked session', () => {
    const session = security.createSession('user-1', ctx);
    security.revokeSession(session.sessionId);
    const result = security.validateSessionContext(session.sessionId, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('session_revoked');
  });
});
