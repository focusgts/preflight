# ADR-027: Public AEM Health Score

## Status
Accepted

## Date
2026-03-22

## Context

Black Hole needs a viral acquisition channel that demonstrates value before requiring authentication. Similar to how Google PageSpeed Insights drives awareness of web performance issues, we need a free, public tool that shows AEM site owners their migration readiness.

The tool must:
- Require zero credentials or authentication
- Produce shareable, linkable results
- Drive organic traffic and word-of-mouth adoption
- Serve as the top-of-funnel entry point to the full Black Hole platform

## Decision

### Public Health Score Tool

We will build a free, public AEM Health Score at `/score` that:

1. **Accepts any URL** — no login, no API key, no AEM credentials needed
2. **Scans publicly accessible data only** — HTTP headers, HTML content, response metrics
3. **Produces a scored report** — 0-100 overall score with A-F grading
4. **Generates shareable URLs** — `/score/{domain}` for social sharing with OG meta tags
5. **Funnels to full assessment** — CTA to sign up for deep analysis

### Score Methodology

| Category | Weight | What We Check |
|----------|--------|---------------|
| Performance | 25% | TTFB, page size, compression, redirect chains |
| Security | 20% | HSTS, CSP, X-Frame-Options, HTTPS, other headers |
| SEO | 20% | Title, meta description, H1, canonical, structured data, OG tags |
| Migration Risk | 25% | AEM version, deployment type, version support deadline |
| Accessibility | 10% | Lang attribute, alt text, heading hierarchy, skip nav |

### AEM Detection

Detection uses a weighted scoring system based on:
- **Response headers**: X-AEM-*, Server, X-Dispatcher
- **HTML patterns**: /etc.clientlibs/, /content/dam/, data-sly-*, CQ- prefixes
- **URL patterns**: .html extensions, /content/ paths
- **Meta tags**: generator meta tag with AEM/Experience Manager
- **Version fingerprinting**: Coral UI versions, clientlib patterns, Cloud Service indicators

### Industry Benchmarking

Mock industry averages (to be replaced with real aggregate data):
- Financial Services: 52
- Healthcare: 48
- Retail: 61
- Technology: 67
- Media: 58

Percentile calculation positions the scanned site relative to its industry.

### Privacy Considerations

- **Only public data**: We only scan what any browser would see
- **No credential storage**: The tool never asks for or stores credentials
- **Rate limiting**: 10 scans per IP per hour to prevent abuse
- **Cache TTL**: Results cached for 30 minutes
- **No PII collection**: We do not collect personal information from scanned sites

### Architecture

- Scanner engine runs server-side via API route (`/api/scanner`)
- Development mode returns deterministic mock results (seeded by domain hash)
- Production mode uses `SiteScanner` class with real HTTP fetch
- Results are cached in-memory (to be migrated to SQLite/Redis)
- Shareable pages at `/score/{domain}` with client-side OG tag injection

## Consequences

### Positive
- Free tool drives organic traffic and viral sharing
- Demonstrates Black Hole value before requiring signup
- AEM version detection creates urgency (EOL countdown)
- Industry benchmarking creates competitive motivation
- Shareable URLs enable word-of-mouth growth

### Negative
- Public scanning surface limited to what HTTP requests can detect
- Mock data in development may not reflect real-world accuracy
- Rate limiting needed to prevent abuse
- Cannot detect all AEM configurations (e.g., heavily customized dispatcher rules)

### Risks
- False positives in AEM detection (mitigated by weighted scoring threshold)
- Score methodology needs calibration against real-world data
- Cached results may show stale data (mitigated by 30-minute TTL)
