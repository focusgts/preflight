# ADR-090: Pre-Flight™ Experience Audit (Lighthouse) Preview

## Status: Proposed

## Date: 2026-04-15

## Context

Cloud Manager runs an "Experience Audit" step as part of the production pipeline. This step is a Google Lighthouse scan that checks performance, accessibility, best practices, and SEO on configured URLs. If scores fall below configured thresholds, the pipeline can be set to fail or warn.

Teams are often surprised by Experience Audit failures because they have no way to preview what Cloud Manager's Lighthouse step will report. They optimize their code, pass all quality gates, then get blocked at the Experience Audit step because their pages are slow, have accessibility issues, or violate SEO best practices. This is especially frustrating because Experience Audit failures are often caused by content, components, and clientlibs — not the backend code that Pre-Flight™ currently scans.

Google provides the PageSpeed Insights API, which runs the same Lighthouse analysis that Cloud Manager uses. It's free for public URLs (no API key required for low-volume usage, free API key available for higher volume). This means Pre-Flight™ can provide a "preview" of what the Experience Audit pipeline step would report — extending coverage beyond code quality into the full pipeline quality gate surface.

No AEM migration tool currently shows Lighthouse scores alongside code quality findings. This would make Pre-Flight™ the only tool that covers both static code analysis AND runtime quality gates in a single interface.

## Decision

Add an Experience Audit Preview to Pre-Flight™ that runs Lighthouse analysis via the PageSpeed Insights API for user-provided URLs and displays results alongside code quality findings.

### User Flow

1. User enters one or more URLs in an "Experience Audit" input field (separate from the code scanner)
2. Pre-Flight™ calls the PageSpeed Insights API for each URL
3. Results display in a dedicated "Experience Audit" tab alongside the code quality findings
4. Combined readiness view: "Code Quality: B (78%) | Experience Audit: C (62%) | Overall Pipeline Risk: Medium"

### PageSpeed Insights API Integration

```typescript
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface PSIRequest {
  url: string;
  category: ('performance' | 'accessibility' | 'best-practices' | 'seo')[];
  strategy: 'mobile' | 'desktop';
}

async function runExperienceAudit(url: string): Promise<LighthouseResult> {
  const params = new URLSearchParams({
    url,
    category: 'performance',
    category: 'accessibility',
    category: 'best-practices',
    category: 'seo',
    strategy: 'mobile'  // Cloud Manager defaults to mobile
  });
  
  const response = await fetch(`${PSI_API}?${params}`);
  return response.json();
}
```

### Results Display

#### Score Overview

```
┌──────────────────────────────────────────────────┐
│ Experience Audit Preview                         │
│ URL: https://acme.com/en/products                │
│                                                  │
│  Performance    Accessibility   Best Practices   │
│     72              89              91           │
│   (Orange)       (Green)         (Green)         │
│                                                  │
│     SEO         Overall Risk                     │
│     95            Medium                         │
│   (Green)       (Yellow)                         │
└──────────────────────────────────────────────────┘
```

#### Detailed Findings

For each Lighthouse audit that fails or warns:
- Audit name and description
- Score impact
- Specific elements/resources causing the issue
- Remediation guidance (from Lighthouse data)
- Link to Lighthouse documentation

#### Cloud Manager Threshold Mapping

Cloud Manager allows configuring pass/fail thresholds for Experience Audit. Show how the scores map:

| Category | Score | Default Threshold | Status |
|----------|-------|-------------------|--------|
| Performance | 72 | 50 (warn) / 25 (fail) | Pass |
| Accessibility | 89 | 50 (warn) / 25 (fail) | Pass |
| Best Practices | 91 | 50 (warn) / 25 (fail) | Pass |
| SEO | 95 | 50 (warn) / 25 (fail) | Pass |

Allow users to set custom thresholds to match their Cloud Manager configuration.

### AEM-Specific Insights

Layer AEM-specific context on top of generic Lighthouse results:

| Lighthouse Finding | AEM Context |
|-------------------|-------------|
| Render-blocking resources | "Check clientlib loading strategy — use `async` or `defer` categories" |
| Large images | "Verify Dynamic Media / Asset Compute is configured for responsive image delivery" |
| Missing alt text | "Check component dialog — ensure alt text field is required, not optional" |
| Slow server response (TTFB) | "Check Dispatcher cache hit ratio — high TTFB often indicates cache misses" |
| Unused JavaScript | "Audit clientlib categories — multiple components may be loading unused JS bundles" |
| Missing meta description | "Verify page component template includes SEO metadata component from Core Components" |

### Multi-URL Scanning

Cloud Manager typically audits 3-25 pages. Support:
- Enter multiple URLs (one per line or comma-separated)
- Run audits in parallel (PSI API supports concurrent requests)
- Summary view: average scores across all URLs
- Per-URL breakdown with individual scores
- Identify the lowest-scoring pages as priority fixes

### Limitations

- **Public URLs only:** PageSpeed Insights can only analyze publicly accessible URLs. Pages behind authentication, VPN, or not-yet-deployed content cannot be tested.
- **API rate limits:** Free tier allows ~25,000 requests/day with API key, much less without. Rate limiting is necessary.
- **Point-in-time:** Scores reflect current page state — if content changes, scores change.
- **Not identical to Cloud Manager:** Cloud Manager runs Lighthouse from specific infrastructure that may produce slightly different scores than PSI API. Scores are directionally accurate, not exact.

## Consequences

**Positive:**
- Extends Pre-Flight™ coverage from "code quality gates" to "full pipeline quality gates" — unique positioning
- No AEM tool combines code quality and Lighthouse analysis in one interface
- Prevents the frustrating surprise of Experience Audit failures after passing all code quality gates
- AEM-specific insights on top of Lighthouse findings add unique value that generic Lighthouse reports lack
- Free to implement — PageSpeed Insights API has no cost at moderate volume
- Multi-URL scanning mirrors Cloud Manager's actual behavior

**Negative:**
- Only works for publicly accessible URLs — no value for pre-deployment or staging behind auth
- PageSpeed Insights API latency is 10-30 seconds per URL — multi-URL scans take time
- Scores may differ slightly from Cloud Manager's actual Lighthouse run — could create false confidence or unnecessary alarm
- Adds a network dependency (Google API) to a tool that currently runs entirely offline
- Lighthouse results are volatile — scores fluctuate between runs by 5-10 points

**Mitigations:**
- Clear disclaimer: "This is a preview. Actual Cloud Manager Experience Audit scores may vary by +/- 10 points."
- Run each URL 3 times and show the median score to reduce volatility
- Cache results for 1 hour — no need to re-run for the same URL frequently
- Clearly separate Experience Audit results from code quality results — they're complementary, not combined into one score
- Show "Unable to test" gracefully for URLs that return errors (auth required, 404, etc.)

## Estimated Effort
- PageSpeed Insights API integration: 2 days
- Score display UI (gauges, categories): 2 days
- AEM-specific insight mapping: 2 days
- Multi-URL scanning with parallel execution: 1 day
- Cloud Manager threshold configuration: 1 day
- Result caching and error handling: 1 day
- Testing across various AEM sites: 1 day
- **Total: 2 weeks**
