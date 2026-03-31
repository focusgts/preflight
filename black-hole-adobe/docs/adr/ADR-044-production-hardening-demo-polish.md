# ADR-044: Production Hardening & Demo Polish

## Status: Proposed

## Date: 2026-03-30

## Context

Before any live demo or deployment, several cross-cutting concerns need attention: authentication credential management, lead capture notifications, error handling across public pages, connector test realism, and general polish items that affect first impressions.

These are the small things that individually seem minor but collectively determine whether a demo feels "real product" or "prototype." A single unhandled error, a blank page, or a dead button can undo the trust built by every other feature.

## Decision

### 1. Authentication & credentials

- Document default admin credentials in a secure location (not in code)
- Make default admin email/password configurable via environment variables: `BH_ADMIN_EMAIL`, `BH_ADMIN_PASSWORD`
- Verify auth middleware (`src/proxy.ts` + `src/lib/auth/middleware.ts`) protects all dashboard routes
- Test full flow: login -> session cookie -> protected route -> logout
- Verify MFA setup/verify works end-to-end in the security settings page

### 2. Lead capture notifications

- Add webhook/email notification when a lead is captured via `POST /api/leads`
- Support configurable webhook URL via `BH_LEAD_WEBHOOK_URL` env var
- POST lead data to webhook (Slack, Zapier, CRM integration)
- Optional: SendGrid/Resend email to admin when lead is captured

### 3. Connector test realism

- Replace mock connection tests in `POST /api/connectors/[id]/test` (hardcoded `passed: true`) with real network checks
- For AEM connectors: actually call the AEM instance and verify response
- For other connector types: DNS resolution + TLS handshake at minimum
- Return meaningful error messages on failure (timeout, auth rejected, SSL error)

### 4. Error handling polish

- Health score scanner: improve error messages for unreachable domains, SSL errors, timeouts
- All dashboard pages: add loading skeletons, error boundaries, retry buttons
- All API routes: consistent error response format via `error()` helper
- No page should ever show an unhandled exception or blank white screen

### 5. Empty state design

- Dashboard with no data should show onboarding prompts ("Connect your first AEM instance")
- Migrations list empty: "Create your first migration" CTA
- Assessments empty: "Run your first assessment" CTA
- These guide first-time users instead of showing blank pages

### 6. Environment configuration

- Create `.env.example` with all configurable variables documented
- Variables: `BH_ADMIN_EMAIL`, `BH_ADMIN_PASSWORD`, `BH_LEAD_WEBHOOK_URL`, `NAVIGATOR_API_URL`, `NAVIGATOR_API_KEY`, `DATABASE_PATH`
- Document required vs optional variables with sensible defaults

## Consequences

- Positive: Application handles edge cases gracefully — no blank pages, no cryptic errors
- Positive: Lead capture actually reaches the sales team
- Positive: First-time user experience guides rather than confuses
- Positive: Environment configuration is documented and reproducible
- Negative: Webhook/email integration adds an external dependency
- Negative: Empty state design takes UI effort for each page

Estimated effort: 20-30 hours
