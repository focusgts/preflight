# ADR-064: Public Pre-Flight Web UI

## Status: Accepted

## Date: 2026-04-05

## Context

The pre-flight engine (`POST /api/preflight`) is production-ready: all 16 Cloud Manager quality-gate rules are verified with zero false positives (see `docs/testing/sandbox-validation-plan.md` Phase 5). Today, pre-flight is only reachable from within the authenticated migration dashboard at `/migrations/[id]/preflight`, which requires a migration record to exist.

The business plan (`docs/strategy/preflight-business-plan.md`) identifies pre-flight as a potentially standalone SaaS product. Phase 1 of that GTM plan is a zero-friction public web UI: an AEM developer should be able to land on a URL, paste a Java/XML/OSGi snippet, and see Cloud Manager gate results in under a second — with no login, no migration, no setup.

This is the top-of-funnel acquisition surface for the standalone product.

## Decision

Ship a public, unauthenticated pre-flight page at `/preflight` that wraps the existing HTTP API.

### 1. Route and Access

- Public route: `/preflight` (App Router page, no auth middleware)
- Added to `PUBLIC_PATHS` in `proxy.ts` alongside `/api/preflight`
- No login, no session, no cookies required
- Indexable by search engines (SEO target: "AEM Cloud Manager quality gate checker")

### 2. UI Surface

Single-page layout:
- Hero: "Check your AEM code against Cloud Manager gates in <1 second"
- Monaco editor with AEM-appropriate language modes (Java, XML, JSON, HTL)
- "Run Pre-Flight" button → calls `POST /api/preflight`
- Results panel reusing `<PreFlightReport>` component
- Severity summary (Blocker / Critical / Major / Minor / Info counts)
- Per-finding cards with rule ID, explanation, remediation, doc link
- Sample snippet loader ("Try a failing example") with 3-4 canned bad snippets
- Share link: copies findings to clipboard as a gist-style URL (hash-encoded input)

### 3. Rate Limiting

Public endpoints need abuse protection:
- 20 runs per IP per hour (sliding window, in-memory LRU; Redis later)
- 100 KB max request body
- Graceful 429 with "Sign up for unlimited" CTA
- Rate-limit headers (`X-RateLimit-*`) on every response

### 4. Lead Capture

Non-blocking lead capture after the first successful run:
- Modal offers emailed PDF report + "pre-flight digest" newsletter
- Email field only — no passwords, no phone
- Stored in `leads` table with source=`preflight-public`
- Dismissible; users can run again without providing email

### 5. Analytics

Track the funnel:
- `preflight.page.view`
- `preflight.run.submit` (with code size, language)
- `preflight.run.result` (with severity counts, duration)
- `preflight.lead.capture`
- `preflight.cta.upgrade.click`

Use existing analytics pipeline; no third-party scripts (keep page fast and privacy-friendly).

### 6. Upgrade CTAs

Subtle, consistent CTAs that point to paid tiers described in the business plan:
- Footer: "Need this in CI? Install the CLI →"
- After 5+ findings: "Fix these automatically with Black Hole →"
- After rate limit hit: "Run unlimited — $99/team/month →"

### 7. What This Is Not

- Not a code editor/IDE — just paste-and-scan
- Not persistent — nothing saved server-side beyond analytics
- Not auth-aware — logged-in users still see the same page (but without rate limits)
- Not a replacement for the migration-linked pre-flight UI

## Consequences

### Positive
- Zero-friction top-of-funnel for the standalone product
- SEO target captures developers searching for Cloud Manager gate help
- Reuses 100% of the existing verified engine
- Viral sharing via hash-encoded URLs
- Lead capture feeds the Navigator outbound pipeline

### Negative
- Public endpoint attracts scraping and abuse; rate limiting must actually work
- Lead capture modal risks annoying developers if tuned wrong
- Brand promise ("<1 second") means we must hold the p95 line as traffic grows
- Public findings could expose rule internals to competitors (acceptable — rules are Adobe-published)

### Estimated Effort
- Public route + PUBLIC_PATHS wiring: 1 hour
- UI (editor + results + samples): 4-6 hours
- Rate limiter: 2 hours
- Lead capture modal + leads table: 2 hours
- Analytics events: 1 hour
- SEO metadata + OG image: 1 hour
- **Total: 11-13 hours**

## References
- `docs/strategy/preflight-business-plan.md` — Phase 1 GTM
- `src/app/api/preflight/route.ts` — existing engine
- `src/components/migration/preflight-report.tsx` — reusable results UI
- `docs/testing/sandbox-validation-plan.md` Phase 5 — rule coverage proof
