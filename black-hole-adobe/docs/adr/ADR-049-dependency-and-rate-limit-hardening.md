# ADR-049: Dependency Remediation & Rate Limit Hardening

## Status: Accepted

## Date: 2026-03-31

## Context

The security scan identified:

1. **MEDIUM**: npm audit reports 3 vulnerabilities in `picomatch` (ReDoS via extglob quantifiers — GHSA-c2c7-rcm5-vvqj). These are in dev dependencies (vite, vitest, tinyglobby) and do not affect production runtime, but should be remediated.

2. **LOW**: Rate limiting is only applied to public scanner endpoints. Authenticated API routes have no rate limiting. A compromised session could hammer the API without restriction.

3. **LOW**: Rate limit Maps are per-process and in-memory. In a multi-process deployment (Vercel serverless, clustered Node), rate limits aren't shared across instances.

## Decision

### 1. Fix npm audit vulnerabilities

Run `npm audit fix` to remediate the picomatch ReDoS vulnerability. If `audit fix` doesn't resolve it, pin picomatch to a fixed version via `overrides` in package.json:

```json
{
  "overrides": {
    "picomatch": ">=4.0.2"
  }
}
```

### 2. Add rate limiting middleware for authenticated routes

Create `src/lib/api/rate-limiter.ts`:
- Configurable rate limiter that can be applied to any route
- Default limits:
  - Scanner endpoints (public): 10 requests/hour per IP (already implemented)
  - Authenticated read endpoints (GET): 100 requests/minute per session
  - Authenticated write endpoints (POST/PATCH/DELETE): 30 requests/minute per session
  - Connector operations: 5 requests/minute per session (expensive)
- Returns 429 with `Retry-After` header

### 3. Prepare for distributed rate limiting

Design the rate limiter with a pluggable backend interface:
```typescript
interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}
```

Default implementation: in-memory Map (current behavior).
Future: Redis adapter for multi-instance deployments.

This keeps the current behavior but makes it easy to swap in Redis later without code changes.

## Consequences

### Positive
- Known npm vulnerabilities remediated
- Authenticated endpoints protected from abuse
- Rate limiter architecture supports future scaling
- 429 responses include Retry-After for client compliance

### Negative
- In-memory rate limiting is still per-process until Redis is added
- Rate limiting adds a small amount of overhead per request
- Aggressive rate limits on connector operations could frustrate power users

### Estimated Effort
- 4-6 hours
