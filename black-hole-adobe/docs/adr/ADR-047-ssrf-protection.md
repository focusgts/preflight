# ADR-047: SSRF Protection for Scanner & Outbound Requests

## Status: Accepted

## Date: 2026-03-31

## Context

The health score scanner, dispatcher security scanner, integration detector, and regression engine all make outbound HTTP requests to user-provided URLs. There is no validation to prevent scanning internal network addresses. An attacker could use the scanner endpoints to:

- Probe internal infrastructure (127.0.0.1, 10.x, 192.168.x, 172.16-31.x)
- Access cloud metadata endpoints (169.254.169.254 on AWS/GCP/Azure)
- Scan localhost services running on the same server
- Bypass firewall rules by using the server as a proxy

This is a Server-Side Request Forgery (SSRF) vulnerability — OWASP A10:2021.

## Decision

### 1. Create a URL validator module

Create `src/lib/security/url-validator.ts`:

```typescript
function isInternalUrl(url: string): boolean
function validateScanTarget(url: string): { valid: boolean; reason?: string }
```

Block these IP ranges:
- `127.0.0.0/8` — loopback
- `10.0.0.0/8` — private class A
- `172.16.0.0/12` — private class B
- `192.168.0.0/16` — private class C
- `169.254.0.0/16` — link-local (cloud metadata)
- `0.0.0.0/8` — unspecified
- `::1`, `fc00::/7`, `fe80::/10` — IPv6 equivalents
- `localhost`, `*.local`

Also block:
- Non-HTTP(S) schemes (ftp://, file://, data://)
- Ports below 80 or above 65535 (except 443, 8080, 8443, 4502, 4503 — common AEM ports)

### 2. Wire into all outbound request points

Apply validation before any fetch() call in:
- `src/lib/scanner/site-scanner.ts` — main scan entry point
- `src/lib/scanner/dispatcher-security.ts` — security probes
- `src/lib/scanner/path-prober.ts` — path probes
- `src/lib/validation/regression-engine.ts` — regression crawling
- `src/lib/monitoring/drift-monitor.ts` — drift check scans
- `src/lib/sync/aem-content-fetcher.ts` — AEM content fetching

### 3. DNS rebinding protection

After resolving DNS, verify the resolved IP is not in a blocked range. An attacker could register a domain that resolves to 127.0.0.1. Check the resolved IP AFTER DNS resolution, BEFORE making the HTTP request.

## Consequences

### Positive
- Eliminates SSRF vulnerability across all scanner endpoints
- Prevents internal network probing via the scanner
- Blocks cloud metadata access (critical for cloud deployments)

### Negative
- Cannot scan AEM instances on internal networks (legitimate use case for on-prem customers). May need an opt-in "allow internal" flag for authenticated users only.
- DNS rebinding check adds latency (one extra DNS lookup per scan)

### Estimated Effort
- 4-6 hours
