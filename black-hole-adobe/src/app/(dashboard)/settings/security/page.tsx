'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Smartphone,
  Monitor,
  Key,
  FileText,
  X,
  Check,
  Copy,
  RefreshCw,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface MFASetupData {
  secret: string;
  qrCodeURL: string;
  recoveryCodes: string[];
}

interface ActiveSession {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivityAt: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  severity: string;
  details: Record<string, unknown>;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

// -----------------------------------------------------------------------
// Security Settings Page
// -----------------------------------------------------------------------

export default function SecuritySettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<MFASetupData | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Fetch current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data.user);
      })
      .catch(() => {});
  }, []);

  // Fetch audit log for admins
  const fetchAuditLog = useCallback(async () => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) return;
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (auditFilter) params.set('action', auditFilter);
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (data.success) setAuditEvents(data.data.events);
    } catch {
      /* ignore */
    }
  }, [user, auditFilter]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // -----------------------------------------------------------------------
  // MFA Handlers
  // -----------------------------------------------------------------------

  const handleSetupMFA = async () => {
    setLoading(true);
    setMfaMessage('');
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMfaSetup(data.data);
      } else {
        setMfaMessage(data.error?.message ?? 'Setup failed');
      }
    } catch {
      setMfaMessage('Failed to set up MFA');
    }
    setLoading(false);
  };

  const handleEnableMFA = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      setMfaMessage('Enter a 6-digit code from your authenticator app');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaToken, action: 'enable' }),
      });
      const data = await res.json();
      if (data.success) {
        setMfaEnabled(true);
        setMfaMessage('MFA enabled successfully');
        setMfaToken('');
      } else {
        setMfaMessage(data.error?.message ?? 'Invalid token');
      }
    } catch {
      setMfaMessage('Verification failed');
    }
    setLoading(false);
  };

  const handleDisableMFA = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      setMfaMessage('Enter your current 6-digit code to disable MFA');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaToken, action: 'disable' }),
      });
      const data = await res.json();
      if (data.success) {
        setMfaEnabled(false);
        setMfaSetup(null);
        setMfaMessage('MFA disabled');
        setMfaToken('');
      } else {
        setMfaMessage(data.error?.message ?? 'Invalid token');
      }
    } catch {
      setMfaMessage('Failed to disable MFA');
    }
    setLoading(false);
  };

  const copyRecoveryCodes = () => {
    if (!mfaSetup) return;
    navigator.clipboard.writeText(mfaSetup.recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  // -----------------------------------------------------------------------
  // Role Permissions Display
  // -----------------------------------------------------------------------

  const rolePermissions: Record<string, string[]> = {
    super_admin: ['Full system access', 'Manage all users and roles', 'View audit logs', 'Manage security settings'],
    admin: ['Manage users', 'Manage migrations', 'View audit logs', 'Manage connectors'],
    migration_manager: ['Create and run migrations', 'Manage connectors', 'View reports'],
    reviewer: ['Review code changes', 'Approve/reject changes', 'View migrations'],
    viewer: ['View migrations (read-only)', 'View reports'],
    customer: ['View organization portal'],
  };

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-rose-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Security Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage multi-factor authentication, sessions, and audit logging.
        </p>
      </motion.div>

      {/* MFA Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card
          header={
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                <Smartphone className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Multi-Factor Authentication
                </h3>
                <p className="text-xs text-slate-400">
                  {mfaEnabled
                    ? 'MFA is enabled on your account'
                    : 'Add an extra layer of security with TOTP'}
                </p>
              </div>
              <div className="ml-auto">
                {mfaEnabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    <Check className="h-3 w-3" /> Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                    <X className="h-3 w-3" /> Disabled
                  </span>
                )}
              </div>
            </div>
          }
        >
          {!mfaSetup && !mfaEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Use an authenticator app like Google Authenticator or Authy to
                generate time-based one-time passwords.
              </p>
              <Button onClick={handleSetupMFA} loading={loading} size="sm">
                Set Up MFA
              </Button>
            </div>
          )}

          {mfaSetup && !mfaEnabled && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="mb-2 text-sm font-medium text-white">
                  1. Scan this URL in your authenticator app:
                </p>
                <code className="block break-all rounded bg-slate-900 p-2 text-xs text-cyan-400">
                  {mfaSetup.qrCodeURL}
                </code>
                <p className="mt-2 text-xs text-slate-400">
                  Or manually enter secret: <span className="font-mono text-violet-400">{mfaSetup.secret}</span>
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    2. Save your recovery codes:
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyRecoveryCodes}
                  >
                    {copiedCodes ? (
                      <><Check className="h-3 w-3" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {mfaSetup.recoveryCodes.map((code) => (
                    <code
                      key={code}
                      className="rounded bg-slate-900 px-2 py-1 text-center text-xs font-mono text-slate-300"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="mb-2 text-sm font-medium text-white">
                  3. Enter the 6-digit code from your app:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={mfaToken}
                    onChange={(e) =>
                      setMfaToken(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="000000"
                    className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-lg text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                  />
                  <Button onClick={handleEnableMFA} loading={loading} size="sm">
                    Enable MFA
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mfaEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                MFA is protecting your account. Enter your current code to
                disable it.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={mfaToken}
                  onChange={(e) =>
                    setMfaToken(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="000000"
                  className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-lg text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                />
                <Button
                  variant="danger"
                  onClick={handleDisableMFA}
                  loading={loading}
                  size="sm"
                >
                  Disable MFA
                </Button>
              </div>
            </div>
          )}

          {mfaMessage && (
            <p className="mt-2 text-sm text-amber-400">{mfaMessage}</p>
          )}
        </Card>
      </motion.div>

      {/* Active Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card
          header={
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                <Monitor className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Active Sessions
                </h3>
                <p className="text-xs text-slate-400">
                  Manage your active login sessions (max 3 concurrent)
                </p>
              </div>
            </div>
          }
        >
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400">
              Session data is managed server-side. Current session is active.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm text-white">
                      {session.userAgent.substring(0, 60)}...
                    </p>
                    <p className="text-xs text-slate-400">
                      IP: {session.ipAddress} | Last active:{' '}
                      {new Date(session.lastActivityAt).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="danger" size="sm">
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Role & Permissions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card
          header={
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                <Key className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Your Role & Permissions
                </h3>
                <p className="text-xs text-slate-400">
                  Current role:{' '}
                  <span className="font-medium text-violet-400">
                    {user?.role ?? 'loading...'}
                  </span>
                </p>
              </div>
            </div>
          }
        >
          {user && rolePermissions[user.role] ? (
            <ul className="space-y-1.5">
              {rolePermissions[user.role].map((perm) => (
                <li
                  key={perm}
                  className="flex items-center gap-2 text-sm text-slate-300"
                >
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  {perm}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Loading permissions...</p>
          )}
        </Card>
      </motion.div>

      {/* Audit Log (Admin only) */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            header={
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
                  <FileText className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Audit Log
                  </h3>
                  <p className="text-xs text-slate-400">
                    All security-relevant events
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">All actions</option>
                    <option value="auth.login">Login</option>
                    <option value="auth.login_failed">Failed Login</option>
                    <option value="auth.mfa_enabled">MFA Enabled</option>
                    <option value="migration.created">Migration Created</option>
                    <option value="admin.role_assigned">Role Changed</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchAuditLog}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            }
          >
            {auditEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No audit events found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500">
                      <th className="pb-2 pr-4">Timestamp</th>
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Resource</th>
                      <th className="pb-2">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {auditEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="py-2 pr-4 text-xs text-slate-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-300">
                          {event.userEmail ?? 'system'}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-cyan-400">
                            {event.action}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-400">
                          {event.resource}
                        </td>
                        <td className="py-2">
                          <span
                            className={`text-xs font-medium ${severityColor(event.severity)}`}
                          >
                            {event.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
