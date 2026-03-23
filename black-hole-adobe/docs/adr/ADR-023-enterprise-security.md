# ADR-023: Enterprise Security (RBAC, MFA, Audit Logging, Session Hardening)

## Status

Accepted

## Date

2026-03-22

## Context

Enterprise procurement requires three foundational security capabilities before vendor approval:

1. **Role-Based Access Control (RBAC)** -- granular permissions to prevent unauthorized actions
2. **Multi-Factor Authentication (MFA)** -- second factor to protect against credential theft
3. **Comprehensive Audit Logging** -- tamper-evident record of all significant actions

Without these, no enterprise customer will pass the platform through their security review (SOC 2 Type II, ISO 27001, or equivalent frameworks).

## Decision

### RBAC Model

Six predefined roles with escalating privileges:

| Role | Scope | Key Permissions |
|------|-------|----------------|
| `super_admin` | Global | Full system access, cross-org |
| `admin` | Organization | User management, migrations, audit logs |
| `migration_manager` | Organization | Create/run migrations, manage connectors |
| `reviewer` | Organization | Review and approve/reject code changes |
| `viewer` | Organization | Read-only access to migrations and reports |
| `customer` | Organization | Portal-only access |

Organization scoping: non-super-admin users can only access resources belonging to their assigned organization. This is enforced at the `checkAccess` level.

Permissions are defined as typed constants (`ROLE_PERMISSIONS`) and mapped to resource-action pairs through `RESOURCE_ACTION_MAP`.

### TOTP MFA

We implement RFC 6238 TOTP (Time-based One-Time Password) natively using HMAC-SHA1:

- **No external TOTP library dependency** -- reduces supply chain risk
- **Compatible with**: Google Authenticator, Authy, 1Password, Bitwarden
- **30-second time windows** with +/-1 window tolerance (handles clock drift)
- **8 single-use recovery codes** generated at setup time
- **Timing-safe comparison** to prevent side-channel attacks

The TOTP implementation uses Node.js `crypto.createHmac` for HMAC-SHA1 and custom base32 encoding/decoding per RFC 4648.

### Audit Logging

Every significant action is recorded with:

- Event ID (UUID)
- Timestamp (ISO 8601)
- User ID and email
- Action type (typed enum: `auth.login`, `migration.created`, etc.)
- Resource type and ID
- IP address and user agent
- Severity level (info, warning, critical)
- Freeform details object

**Storage strategy:**

- In-memory buffer of 10,000 most recent entries for fast queries
- Persisted to `data/audit-log.json` on every write
- Automatic archival of overflow entries to dated archive files
- Export as JSON or CSV for compliance reporting

### Session Hardening

- **Fingerprinting**: Sessions bound to user agent + IP /24 subnet
- **Concurrent limit**: Maximum 3 active sessions per user (oldest auto-revoked)
- **Inactivity timeout**: 30 minutes of no activity
- **Absolute timeout**: 24 hours maximum session lifetime
- **Rate limiting**: 5 attempts/minute per IP, 10 attempts/minute per email
- **Admin revocation**: Administrators can kill any session

## SOC 2 Type II Alignment

| SOC 2 Criterion | Implementation |
|-----------------|----------------|
| CC6.1 - Logical access | RBAC with organization scoping |
| CC6.2 - Authentication | TOTP MFA with recovery codes |
| CC6.3 - Access revocation | Session revocation, role removal |
| CC7.1 - Monitoring | Comprehensive audit logging |
| CC7.2 - Anomaly detection | Fingerprint mismatch detection, rate limiting |
| CC7.3 - Incident response | Audit log export, admin session kill |

## Alternatives Considered

1. **OAuth2/OIDC SSO only** -- Rejected because not all enterprise customers have a compatible IdP, and we still need local auth for initial admin setup.
2. **Third-party TOTP library (otplib)** -- Rejected to minimize supply chain attack surface. TOTP is a simple algorithm (HMAC + dynamic truncation).
3. **Database-backed audit log** -- Deferred. JSON file persistence is sufficient for current scale. Migration to SQLite or a dedicated audit table is planned for Phase 2.

## Consequences

- All new API routes must integrate audit logging for significant actions
- Login flow must check MFA status and prompt for second factor when enabled
- Future features must define their permissions in `ROLE_PERMISSIONS` and `RESOURCE_ACTION_MAP`
- Session cookie validation should incorporate fingerprint checking via `SessionSecurity`

## File Inventory

| File | Purpose |
|------|---------|
| `src/lib/auth/rbac.ts` | RBAC manager, roles, permissions |
| `src/lib/auth/mfa.ts` | TOTP MFA implementation |
| `src/lib/auth/session-security.ts` | Session hardening |
| `src/lib/audit/audit-logger.ts` | Audit logging |
| `src/app/api/auth/mfa/setup/route.ts` | MFA setup endpoint |
| `src/app/api/auth/mfa/verify/route.ts` | MFA verification endpoint |
| `src/app/api/audit/route.ts` | Audit log query endpoint |
| `src/app/(dashboard)/settings/security/page.tsx` | Security settings UI |
| `tests/unit/security/security.test.ts` | 30+ security tests |
