# ADR-013: Session-Based Authentication

## Status

Accepted

## Date

2026-03-21

## Context

Black Hole needs authentication to protect the dashboard and API routes. The application is a single Next.js instance used by a small team, not a multi-tenant SaaS platform.

Options considered:

1. **Session cookies with SQLite** -- Server-side sessions stored in the database, referenced by an httpOnly cookie.
2. **JWT (JSON Web Tokens)** -- Stateless tokens signed with a secret, sent as Bearer tokens or cookies.
3. **OAuth / OpenID Connect** -- Delegated authentication via an identity provider (Auth0, Okta, Adobe IMS).
4. **NextAuth.js / Auth.js** -- Framework-specific auth library that supports multiple providers.

## Decision

We chose **session cookies stored in SQLite** as the authentication mechanism.

## Rationale

- **Simplicity**: Session-based auth is straightforward to implement and debug. No token parsing, no refresh token flows, no JWK key management.
- **httpOnly cookies are secure**: The session token is stored in an httpOnly, SameSite cookie. It cannot be accessed by JavaScript, which eliminates XSS-based token theft. This is strictly more secure than storing JWTs in localStorage.
- **Server-side revocation**: Sessions can be immediately invalidated by deleting them from the database. JWT revocation requires maintaining a blocklist, which negates the "stateless" advantage.
- **No external dependencies**: We already have SQLite. No need for a third-party auth service, no API keys, no additional billing.
- **JWT is not needed**: JWT's main advantage is stateless verification across distributed services. Black Hole is a single-node application talking to its own database. The "stateless" benefit provides no value here.
- **OAuth deferred**: Adobe IMS integration will be added in a future milestone when multi-tenant support is needed. The session infrastructure will remain as the local session layer even with OAuth.

## Consequences

- **24-hour expiry**: Sessions expire after 24 hours. Users must re-authenticate daily. This is acceptable for an internal tool.
- **No refresh tokens**: There is no silent renewal. When the session expires, the user is redirected to the login page.
- **Password hashing**: Passwords are hashed with PBKDF2 (100,000 iterations, SHA-512) using Node.js crypto. No external dependency (bcrypt) is needed.
- **Default admin**: A default admin user (admin@blackhole.io / admin123) is created on first run for demo purposes. This must be changed or removed before production deployment.
- **Proxy-level check**: Next.js 16 Proxy (formerly Middleware) performs an optimistic cookie-presence check for fast redirects. Full session validation happens in API route handlers.
- **Future upgrade path**: When OAuth is added, the session table will store OAuth access tokens and the login flow will redirect to the identity provider instead of showing a local form.
