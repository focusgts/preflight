# ADR-046: Public Path Lockdown & Auth Boundary Hardening

## Status: Accepted

## Date: 2026-03-31

## Context

The security scan identified that several API routes are in `PUBLIC_PATHS` (src/proxy.ts) that should require authentication:

- **CRITICAL**: `/api/migrations` is fully public — anyone can GET/PATCH/DELETE all migration data without auth. This was added to support the client portal, but it exposes the entire migrations CRUD.
- **HIGH**: `/api/connectors/aem` is fully public — connect and extract endpoints can be used to proxy requests to arbitrary AEM instances.
- **MEDIUM**: `/api/monitoring` and `/api/preflight` are public — less sensitive but should still be behind auth.

The root cause is that the portal needed to fetch migration data, so `/api/migrations` was added to PUBLIC_PATHS as a shortcut. This violates the principle of least privilege.

## Decision

### 1. Remove over-permissive public paths

Remove from `PUBLIC_PATHS` in `src/proxy.ts`:
- `/api/migrations`
- `/api/connectors/aem`
- `/api/monitoring`
- `/api/preflight`

### 2. Create dedicated portal API routes

Create scoped, read-only portal endpoints that don't expose full CRUD:

- `GET /api/portal/[orgId]/migrations` — returns only migrations for a specific org, validated by portal token
- `GET /api/portal/[orgId]/migration/[id]` — returns a single migration scoped to the org

These routes validate access via:
1. `bh_portal_token` cookie, OR
2. `?token=` query parameter, OR
3. Match against org in migration store

Add `/api/portal` to PUBLIC_PATHS (already there) — portal routes handle their own auth.

### 3. Keep only genuinely public paths

After lockdown, PUBLIC_PATHS should be:
```typescript
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
```

Every other API route requires a valid `bh_session` cookie.

## Consequences

### Positive
- Eliminates the single CRITICAL security finding
- Migration data is no longer publicly accessible
- Connector endpoints require authentication
- Portal access is properly scoped to org-specific data

### Negative
- Portal page needs to use the new `/api/portal/[orgId]/migrations` endpoint instead of `/api/migrations`
- Any frontend code that calls these endpoints without a session cookie will break — need to verify all dashboard fetch calls include credentials

### Estimated Effort
- 4-6 hours
