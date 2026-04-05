# ADR-048: Production Credential Security & Cookie Hardening

## Status: Accepted

## Date: 2026-03-31

## Context

The security scan identified several credential and session management issues:

1. **HIGH**: The login page (`src/app/(auth)/login/page.tsx:175`) hardcodes and displays demo credentials (`admin@blackhole.io / admin123`). In production, this is an open invitation to compromise.

2. **MEDIUM**: The session cookie (`src/app/api/auth/login/route.ts:79`) is missing the `Secure` flag. Without it, cookies can be sent over unencrypted HTTP connections in production.

3. **LOW**: The header component (`src/components/shared/header.tsx:49`) shows a hardcoded email `admin@blackhole.dev` regardless of the logged-in user.

## Decision

### 1. Hide demo credentials in production

In `src/app/(auth)/login/page.tsx`:
- Only show the demo credentials hint when `process.env.NODE_ENV === 'development'` or when a `NEXT_PUBLIC_SHOW_DEMO_CREDS=true` env var is set
- In production: show a generic "Enter your credentials" message instead

### 2. Add Secure flag to session cookie in production

In `src/app/api/auth/login/route.ts`:
```typescript
const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=86400`
```

### 3. Show real user email in header

In `src/components/shared/header.tsx`:
- Fetch the current user from `/api/auth/me` (or accept user info as a prop from the layout)
- Display the actual logged-in user's email and name
- Fall back to "User" if the fetch fails

### 4. Enforce strong passwords in production

In `src/lib/auth/auth.ts`:
- When `NODE_ENV === 'production'`, reject the default password `admin123` on first login
- Force admin to set a new password via the settings page
- Add minimum password requirements: 8+ characters, at least one number and one letter

## Consequences

### Positive
- No credential leakage in production deployments
- Session cookies are secure over HTTPS
- User identity is accurately displayed
- Default credentials cannot persist in production

### Negative
- First-time production setup requires setting a password (slight friction)
- Demo mode still shows credentials for easy testing (acceptable)

### Estimated Effort
- 3-4 hours
