# ADR-053: CDN & DNS Cutover Automation

## Status: Accepted

## Date: 2026-03-31

## Context

The `CutoverManager` in `src/lib/sync/cutover-manager.ts` has a 7-step cutover plan but steps 4-7 (DNS switch, CDN config, smoke test, go-live) are empty implementations. DNS switching and CDN configuration are manual processes that the customer must perform outside of Black Hole.

The cutover is the highest-risk moment in any migration. Automating it reduces human error and shortens the downtime window from hours to minutes.

## Decision

### 1. CDN manager with provider adapters

Create `src/lib/deployment/cdn-manager.ts` with a provider adapter pattern:

- **Fastly** (`src/lib/deployment/cdn-adapters/fastly-adapter.ts`):
  - Service configuration via Fastly API
  - Domain activation and SSL certificate verification
  - Cache purge (`POST /service/{id}/purge_all`) and selective invalidation
  - VCL configuration for origin switching

- **Cloudflare** (`src/lib/deployment/cdn-adapters/cloudflare-adapter.ts`):
  - DNS record updates via Cloudflare API (`PUT /zones/{id}/dns_records/{id}`)
  - SSL certificate verification and mode configuration
  - Cache purge and page rule updates

- **Akamai** (`src/lib/deployment/cdn-adapters/akamai-adapter.ts`):
  - Property activation via Akamai OPEN API
  - Cache invalidation via CCU API
  - Origin configuration updates

- **Generic** (`src/lib/deployment/cdn-adapters/generic-adapter.ts`):
  - Manual checklist with verification probes
  - DNS propagation checker (query multiple resolvers)
  - HTTP probe to verify target responds correctly

### 2. Wire cutover steps 4-7

- **Step 4 — DNS Switch:** Update DNS records via provider API, or generate step-by-step instructions for manual switch. Verify DNS propagation across multiple resolvers before proceeding.
- **Step 5 — CDN Config:** Purge CDN cache, verify SSL certificate is valid for target domain, warm cache for critical pages (top 50 URLs from analytics).
- **Step 6 — Smoke Test:** Run the visual regression engine (ADR-034) against the target URL. Compare HTTP status codes, page load times, and critical user journeys.
- **Step 7 — Go Live:** Mark migration status as COMPLETED in the database, start drift monitoring (ADR-035), send notification to stakeholders.

### 3. Rollback

- Reverse DNS records to point back to source
- Revert CDN origin configuration
- Restart content sync from source
- Rollback is automated and triggered by smoke test failure or manual abort

### 4. Dry-run cutover

- Support `POST /api/migrations/[id]/cutover?dryRun=true` that validates API access, DNS propagation timing, SSL readiness, and CDN configuration without actually switching traffic
- Report estimated downtime window based on DNS TTL values

## Consequences

**Positive:**
- Automated go-live reduces human error during the highest-risk migration moment
- Dry-run mode lets teams rehearse cutover without risk
- Rollback automation provides a safety net if issues are detected post-switch
- Provider adapters are extensible — new CDN/DNS providers can be added without changing core logic

**Negative:**
- CDN/DNS API access requires customer to provide API keys for their specific provider
- DNS propagation is inherently unpredictable — some ISPs cache aggressively
- Generic fallback with manual instructions is always available but requires human execution
- Each CDN provider adapter must be maintained separately as APIs evolve

**Estimated effort:** 16-24 hours
