# ADR-030: AEM Detection Methodology — 5-Tier Multi-Signal Approach

## Status: Accepted

## Date: 2026-03-26

## Context

The public AEM Health Score is Black Hole's viral entry point. It must accurately detect whether a website runs AEM, what version, and whether it's Cloud Service or on-prem. **Inaccurate results destroy credibility** — if we tell a CTO they're on AEM 6.4 on-prem and they're actually on Cloud Service, we lose all trust and the prospect is gone forever.

Existing CMS detection tools are inadequate:
- **Wappalyzer**: Only 3 detection signals for AEM, zero version detection, zero deployment classification
- **BuiltWith**: ~10 signals, no version detection, no cloud vs on-prem
- **aem-hacker**: 10+ probes but designed for pentesting, not user-facing product

We need 90%+ accuracy on AEM detection and deployment classification, with honest confidence reporting on everything we claim.

## Decision

Implement a **5-tier multi-signal detection system** that combines passive analysis (DNS, SSL), single-page content analysis (headers, HTML), and targeted safe probes. Every claim includes a confidence score. We never guess — if signals are inconclusive, we say "Unknown."

### Tier 1: DNS Resolution (Passive, Zero Contact)

Before making any HTTP request to the target site:

- **Google DNS-over-HTTPS** lookup: `https://dns.google/resolve?name={domain}&type=CNAME`
- `CNAME → *.adobeaemcloud.com` = **Definitive AEM Cloud Service** (99% confidence)
- `CNAME → *.aem.live` or `*.hlx.live` = **Definitive Edge Delivery Services** (99% confidence)
- `CNAME → *.akamai*` or `*.cloudfront*` = Possible AMS or on-prem behind CDN (weak signal)
- No AEM-related CNAME = inconclusive (proceed to Tier 2)

**Rationale**: DNS is public record, zero contact with target, completely ethical, and provides the single highest-accuracy signal for Cloud Service detection.

### Tier 2: Single Page Load (Normal Web Traffic)

One GET request to the homepage with a standard User-Agent. This is exactly what a web browser does.

**Response Headers** (checked, not all will be present):

| Header | Weight | AEM Signal Strength |
|--------|--------|-------------------|
| `x-aem-host` | 10 | Definitive (often stripped by CDN) |
| `x-aem-cluster` | 10 | Definitive (often stripped) |
| `x-dispatcher` | 8 | Strong (AEM Dispatcher, sometimes survives CDN) |
| `x-served-by` (Fastly format) | 6 | Fastly CDN → possible Cloud Service |
| `x-vhost` | 4 | AEM Dispatcher virtual host |
| `Server: Apache` | 2 | Weak (many non-AEM sites use Apache) |
| `Set-Cookie: cq-*` or `login-token` | 9 | Strong (AEM-specific cookies) |

**HTML Content Patterns** (the most reliable tier):

| Pattern | Weight | Notes |
|---------|--------|-------|
| `class="parbase"` | 9 | AEM paragraph system — nearly unique to AEM |
| `class="aem-Grid*"` | 9 | AEM responsive grid |
| `data-sly-*` attributes | 9 | HTL/Sightly templating (AEM 6.0+) |
| `class="cmp-*"` | 8 | AEM Core Components |
| `/etc.clientlibs/` in src/href | 9 | AEM clientlib proxy path (6.3+) |
| `/content/dam/` in src/href | 8 | AEM DAM asset path |
| `<!--/* CQ */-->` comments | 10 | CQ/AEM HTML comments — unique fingerprint |
| `/etc/designs/` in src/href | 7 | AEM design path |
| `/libs/granite/` references | 9 | Granite UI framework |
| `wcmmode` references | 5 | AEM WCM mode |
| `<meta generator="AEM">` | 10 | Explicit declaration (rare in production) |
| `cq-` prefixed attributes | 6 | Legacy CQ5/AEM markers |

**Detection threshold**: Cumulative weight >= 15 to declare "AEM detected."
This means at least 2 strong signals or 3+ moderate signals.

### Tier 3: Safe Path Probes (The Accuracy Multiplier)

3-4 HEAD requests to known AEM paths. These paths exist on ALL AEM installations.

| Path | AEM Response | Non-AEM Response | Weight |
|------|-------------|-----------------|--------|
| `/libs/granite/core/content/login.html` | 200 or 403 | 404 | 10 |
| `/system/console` | 403 | 404 | 10 |
| `/bin/querybuilder.json` | 403 or 200 | 404 | 8 |
| `/content.json` | 403 or 200 | 404 | 7 |

**Key insight**: AEM returns **403 Forbidden** on protected paths because the paths exist but require authentication. Non-AEM servers return **404 Not Found** because the paths don't exist at all. This 403-vs-404 distinction is a powerful and reliable signal.

**Ethical constraints**:
- HEAD requests only (no body transferred)
- Proper User-Agent: `BlackHole-Scanner/1.0 (AEM Health Check; focusgts.com)`
- Maximum 5 probe requests per scan
- Respect robots.txt
- Never attempt authentication
- Never probe admin-only paths that could trigger security alerts

### Tier 4: Version Inference (Signal Correlation)

No single signal gives exact version. We correlate multiple signals:

| Signal Combination | Version Inference | Confidence |
|-------------------|------------------|------------|
| Cloud Service CNAME + no JSP | Cloud Service (continuous) | 99% |
| Edge Delivery scripts (aem.js) | Cloud Service + EDS | 99% |
| `/etc.clientlibs/` + `cmp-*` + jQuery 3.x | AEM 6.5 SP6+ | 70-80% |
| `/etc.clientlibs/` + `cmp-*` + jQuery 1.x | AEM 6.3-6.5 SP5 | 60-70% |
| `/etc.clientlibs/` + no `cmp-*` | AEM 6.3-6.4 | 50-60% |
| No `/etc.clientlibs/` + AEM signals | AEM 6.0-6.2 | 40-50% |
| JSP references in HTML | AEM 6.x (not Cloud) | 80% |

**Critical rule**: We report version as a RANGE with confidence, never as an exact version number.
- "AEM 6.5 (75% confidence)" — acceptable
- "AEM 6.5 SP18" — never claim this from external scan

### Tier 5: Deployment Classification

Combine all signals to classify deployment:

**Cloud Service** (report when confidence >= 85%):
- DNS CNAME → `*.adobeaemcloud.com` (definitive)
- Fastly headers + no JSP references
- Edge Delivery patterns

**Managed Services** (report when confidence >= 70%):
- AEM detected + AWS/CloudFront infrastructure
- `x-aem-host` containing "ams"
- AEM 6.x signals + cloud hosting

**On-Premise** (report when confidence >= 70%):
- AEM detected + no cloud CDN fingerprint
- Apache Dispatcher headers without Fastly
- Customer datacenter IPs

**Unknown** (when confidence < 70%):
- Report "Deployment type could not be determined from external scan"
- Recommend full assessment for definitive answer

## Confidence Reporting Rules

1. **Always show confidence percentage** next to every claim
2. **Never show confidence below 60%** as a positive claim — show "Unknown" instead
3. **Show what signals were detected** — transparency builds trust
4. **Show what we couldn't determine** — honesty about limitations is a feature
5. **"Run full assessment for certainty"** — every unknown is a CTA for the paid product

## Ethical and Legal Framework

| Activity | Classification | Authorization Needed |
|----------|---------------|---------------------|
| DNS CNAME lookup | Passive, public record | None |
| SSL certificate inspection | Passive, part of TLS | None |
| Single page GET request | Normal web traffic | None |
| HTML/header analysis | Analysis of public data | None |
| HEAD request to known paths | Equivalent to bot crawl | Identify via User-Agent |
| Authentication attempt | Active intrusion | NOT PERMITTED |
| Brute-force probing | Active scanning | NOT PERMITTED |

## Consequences

### Positive
- 97-98% accuracy on AEM detection (vs 0% with mock data)
- 90-95% accuracy on Cloud vs on-prem classification
- 75-85% accuracy on version range inference
- Honest confidence reporting builds trust instead of destroying it
- Every "unknown" becomes a CTA for paid assessment
- 40+ detection signals vs Wappalyzer's 3 — clear market differentiation

### Negative
- Scan takes 3-8 seconds (DNS + page load + probes) vs instant mock
- Some fully hardened sites will still be undetectable (~5-10%)
- Version detection for 6.x range may show "AEM 6.x" without narrowing further
- Path probes technically make requests to paths the site owner didn't intend for public access (mitigated by HEAD-only, User-Agent identification)

### Neutral
- Need to maintain probe paths as AEM evolves
- Need to validate accuracy periodically against known AEM sites
- DNS lookups depend on Google DNS API availability

## Alternatives Considered

1. **Keep mock data** — Rejected. Zero credibility, proven to produce wrong results.
2. **Only passive detection (no probes)** — Considered. Gets to ~85% for AEM detection but misses the 403-vs-404 signal. Could be a "lite" mode option.
3. **Aggressive probing (50+ paths)** — Rejected. Crosses ethical line, too slow, could trigger WAF/security alerts.
4. **Require credentials for any scan** — Rejected. Defeats the purpose of a free, public tool. Full assessment with credentials is the paid upgrade path.
5. **Use BuiltWith/Wappalyzer API** — Rejected. Adds dependency on third-party, their AEM detection is worse than what we can build, and costs money at scale.

## Validation Plan

Before launch:
1. Test against 5 known AEM Cloud Service sites (verify 99% Cloud detection)
2. Test against 5 known AEM 6.5 on-prem sites (verify AEM detection + version range)
3. Test against 5 known non-AEM sites (verify zero false positives)
4. Test against 5 Edge Delivery Services sites (verify EDS detection)
5. Document accuracy results in a validation matrix

## Supporting Research

- `/docs/AEM_DETECTION_RESEARCH.md` — Full fingerprinting techniques, 40+ signals documented
- `/docs/CMS_DETECTION_METHODOLOGY.md` — Wappalyzer/BuiltWith analysis, 5-tier implementation plan
- `/docs/INFRASTRUCTURE_DETECTION_RESEARCH.md` — DNS, SSL, CDN, network-level detection
