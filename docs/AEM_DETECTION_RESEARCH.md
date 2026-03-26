# AEM External Detection Research

## Comprehensive Guide to Detecting Adobe Experience Manager Version and Deployment Type from External Scans

**Goal**: Achieve 90-100% accuracy in detecting AEM presence, version, and deployment type (on-prem, AMS, Cloud Service, Edge Delivery Services) from external-only observation of public websites.

**Date**: 2026-03-26

---

## Table of Contents

1. [Known AEM Fingerprinting Techniques](#1-known-aem-fingerprinting-techniques)
2. [AEM Version-Specific Artifacts](#2-aem-version-specific-artifacts)
3. [AEM Cloud Service vs On-Prem Detection](#3-aem-cloud-service-vs-on-prem-detection)
4. [Multi-Page Probing Strategy](#4-multi-page-probing-strategy)
5. [DNS and Infrastructure Analysis](#5-dns-and-infrastructure-analysis)
6. [Existing CMS Detection Tool Methodology](#6-existing-cms-detection-tool-methodology)
7. [Creative and Unconventional Approaches](#7-creative-and-unconventional-approaches)
8. [Building a Reference Database](#8-building-a-reference-database)
9. [Accuracy Validation Methodology](#9-accuracy-validation-methodology)
10. [Composite Scoring Model](#10-composite-scoring-model)
11. [Implementation Recommendations](#11-implementation-recommendations)

---

## 1. Known AEM Fingerprinting Techniques

### 1.1 HTTP Response Headers

| Header | Pattern | What It Reveals | Accuracy | Works Behind CDN |
|--------|---------|----------------|----------|-----------------|
| `X-Dispatcher` | Present (e.g., `hu1`) | AEM Dispatcher in use | 5/5 | Sometimes stripped |
| `X-Vhost` | Present | AEM Dispatcher virtual host config | 4/5 | Sometimes stripped |
| `Server` | Contains "Apache" with Dispatcher module | AEM's standard web tier | 2/5 | Usually stripped |
| `X-Content-Type-Options` | `nosniff` | Common but not AEM-specific | 1/5 | Passes through |
| `Surrogate-Control` | Present | Fastly CDN (AEM Cloud Service) | 4/5 | Stripped by Fastly before client |
| `X-Cache` | `HIT` / `MISS` | CDN caching layer present | 2/5 | Yes, this IS the CDN header |
| `x-aem-debug` | `byocdn=true,edge=true,...` | AEM Cloud Service with BYOCDN | 5/5 | Only with debug request |
| `x-aem-client-country` | ISO country code | AEM Cloud Service Fastly CDN | 5/5 | Rarely exposed |
| `Dispatcher: no-cache` | Present | AEM Dispatcher communication | 4/5 | Stripped before client |
| `X-AEM-Instance` | Instance identifier | Direct AEM instance (misconfigured) | 5/5 | Stripped in production |
| `X-AEM-Server` | Server identifier | Direct AEM instance (misconfigured) | 5/5 | Stripped in production |

**False Positive Risk**: Low for AEM-specific headers (X-Dispatcher, X-Vhost, X-AEM-*). High for generic headers (X-Content-Type-Options).

**False Negative Risk**: High. Most production AEM sites behind CDN/Dispatcher strip identifying headers. This technique alone achieves ~30% detection rate.

**Ethical/Legal**: Fully ethical. Passive observation of public HTTP responses.

### 1.2 HTML Source Code Patterns

| Pattern | Regex | Accuracy | False Positive Risk |
|---------|-------|----------|-------------------|
| Parsys div class | `<div class="[^"]*parbase` | 5/5 | Very low |
| JCR component path | `<div[^>]+data-component-path="[^"]+jcr:` | 5/5 | Very low |
| AEM Grid classes | `<div class="[^"]*aem-Grid` | 5/5 | Very low |
| HTL/Sightly attributes | `data-sly-(use\|test\|list\|repeat\|include\|resource\|call\|template\|set\|text\|attribute\|element\|unwrap)` | 5/5 | Very low |
| CQ comments | `<!--/\* CQ \*/-->` or `<!--cq\{` | 5/5 | Very low |
| Core Component classes | `class="[^"]*cmp-(teaser\|title\|text\|image\|button\|list\|tabs\|accordion\|carousel\|container\|breadcrumb\|navigation\|languagenavigation\|search\|embed\|separator\|progressbar\|pdfviewer\|contentfragment)` | 5/5 | Very low |
| Sling resource type | `data-sly-resource` attribute | 5/5 | Very low |
| AEM author layer class | `aem-AuthorLayer-(Preview\|Edit)` | 5/5 | Very low (only on author) |

**Key Insight**: HTML patterns are the single most reliable external detection method. Even behind CDN, the rendered HTML retains AEM-specific markup. The `parbase` class, `aem-Grid` class, `data-sly-*` attributes, and `cmp-*` Core Component prefixes are essentially unique to AEM.

**False Positive Risk**: Very low. These patterns are unique to AEM's HTL templating engine and component framework.

**False Negative Risk**: Medium. Heavily customized sites may override default class names. Some sites use headless AEM (API-only) with no AEM HTML on the frontend.

**Works Behind CDN**: Yes. HTML content passes through CDN unchanged.

**Ethical/Legal**: Fully ethical. Reading public HTML source code.

### 1.3 URL Path Patterns

| Path Pattern | What It Indicates | Accuracy | Notes |
|-------------|-------------------|----------|-------|
| `/etc.clientlibs/` | AEM client library proxy path (6.3+) | 5/5 | Very strong indicator |
| `/etc/clientlibs/` | AEM client library path (legacy) | 5/5 | Older AEM versions |
| `/etc/designs/` | AEM design configurations | 5/5 | Strong indicator |
| `/content/dam/` | AEM Digital Asset Manager | 5/5 | Very common in asset URLs |
| `/content/experience-fragments/` | AEM Experience Fragments | 5/5 | AEM-unique feature |
| `/libs/granite/` | Granite UI framework resources | 5/5 | AEM-specific |
| `/etc.clientlibs/clientlibs/` | Client library aggregation | 5/5 | AEM pattern |
| `/jcr:content` or `/_jcr_content` | JCR content node reference | 5/5 | Sling/JCR specific |
| Script `src` containing `clientlibs` | AEM clientlib loading | 4/5 | Very common |
| Image `src` containing `/content/dam/` | AEM DAM asset reference | 5/5 | Very common |

**Detection Method**: Scan all `<script src>`, `<link href>`, `<img src>`, `<a href>` attributes in the HTML source for these path patterns.

**False Positive Risk**: Very low for `/etc.clientlibs/` and `/content/dam/`. Slightly higher for `/content/` alone (other CMSs may use similar paths).

**Works Behind CDN**: Yes. URL paths in HTML are preserved.

### 1.4 Cookie Patterns

| Cookie Name | Context | Accuracy | Notes |
|------------|---------|----------|-------|
| `login-token` | AEM authentication token | 5/5 | Only on authenticated sessions |
| `cq-authoring-mode` | AEM authoring UI mode (Touch/Classic) | 5/5 | Only on author instances |
| `wcmmode` | WCM mode indicator (edit/preview/disabled) | 5/5 | Only on author instances |
| `cq-author` | AEM author session | 5/5 | Rarely exposed publicly |
| `cq-session` | AEM session identifier | 5/5 | Rarely exposed publicly |
| `asgard` | AEM Dispatcher session | 3/5 | Uncommon |
| `granite.csrf.token` | Granite CSRF token | 4/5 | Set on form interactions |

**Key Insight**: Cookie detection is highly accurate when cookies are present, but most cookies are only set on author instances or authenticated sessions. On public publish instances, cookie-based detection has very limited utility.

**False Negative Risk**: Very high on publish instances.

**Ethical/Legal**: Ethical. Cookies are sent in HTTP responses to public requests.

### 1.5 JavaScript and CSS File Path Conventions

| Path Pattern | AEM Version | Accuracy |
|-------------|-------------|----------|
| `/etc.clientlibs/*/clientlibs/site.min.js` | 6.3+ (proxy pattern) | 5/5 |
| `/etc/clientlibs/*/clientlibs.min.js` | Pre-6.3 (direct pattern) | 5/5 |
| `/etc.clientlibs/clientlibs/granite/jquery.min.js` | All versions (jQuery bundled) | 4/5 |
| `/etc.clientlibs/granite/coralui2/` | AEM using CoralUI 2 | 4/5 |
| `/etc.clientlibs/granite/coralui3/` | AEM using CoralUI 3 (6.5+) | 4/5 |
| JS comments containing `@adobe` or `granite` | Various | 3/5 |
| Versioned clientlib hash: `/etc.clientlibs/...lc-*.min.js` | ACS Commons versioned clientlibs | 4/5 |

### 1.6 Error Page Signatures

| Error Type | AEM Signature | Accuracy | Notes |
|-----------|--------------|----------|-------|
| Default 404 page | Contains "Sling" or "Resource not found" text | 4/5 | Only on uncustomized instances |
| Default 404 page | HTTP status with Sling-specific error structure | 4/5 | Dispatcher may override |
| Default 500 page | Stack trace containing `org.apache.sling` | 5/5 | Only on misconfigured instances |
| 403 on blocked paths | Specific response from Dispatcher vs AEM | 3/5 | Behavior difference is subtle |
| Login redirect on 401 | Redirect to `/libs/granite/core/content/login.html` | 5/5 | Strong indicator |

**Technique**: Request a known-nonexistent path (e.g., `/this-page-does-not-exist-xyz123`) and analyze the 404 response body for AEM-specific text patterns.

### 1.7 Robots.txt Patterns

AEM sites commonly have robots.txt entries like:
```
Disallow: /content/dam/
Disallow: /etc/
Disallow: /bin/
Disallow: /libs/
Disallow: /apps/
Disallow: /tmp/
Disallow: /var/
Sitemap: /content/<sitename>/sitemap.xml
```

The presence of `/content/dam/`, `/etc/`, `/bin/`, `/libs/` in robots.txt is a strong AEM indicator. The sitemap path format `/content/<name>/sitemap.xml` is characteristic of AEM's sitemap servlet.

**Accuracy**: 3/5 (many sites customize robots.txt)
**False Positive Risk**: Medium (some paths like `/etc/` could appear in non-AEM sites)

### 1.8 Sitemap.xml Patterns

AEM sitemaps generated by the built-in servlet or ACS Commons Sitemap Servlet follow patterns:
- URL path: `/content/<sitename>.sitemap.xml` (using Sling selector)
- URLs within sitemap contain `/content/` path prefix
- Namespace declarations may reference AEM-specific schemas

---

## 2. AEM Version-Specific Artifacts

### 2.1 Core Components Version to AEM Version Mapping

| Core Components Release | AEM 6.4 | AEM 6.5 | AEM Cloud Service |
|------------------------|---------|---------|-------------------|
| 1.0.0 - 1.1.0 | Yes | Yes | No |
| 2.0.0 - 2.17.14 | Yes | Yes | Yes |
| 2.18.0 - 2.24.x | No | Yes | Yes |
| 2.25.0+ | No | Yes (6.5.13+) | Yes |
| 2.30.0+ | No | Yes (6.5.21+ LTS) | Yes |

**Detection Method**: Identify Core Component version by examining:
1. CSS class names: newer versions add new component types (e.g., `cmp-pdfviewer` added in v2.10.0)
2. HTML structure: component markup structure changes between versions
3. Data attributes: newer versions add additional data attributes

### 2.2 Coral UI Version Indicators

| Indicator | AEM Version |
|-----------|-------------|
| CoralUI 2 clientlibs (`/libs/clientlibs/granite/coralui2`) | AEM 6.1 - 6.4 |
| CoralUI 3 clientlibs (`/libs/clientlibs/granite/coralui3`) | AEM 6.2+ (6.5 default) |
| CoralUI 3 only (no CoralUI 2 fallback) | AEM Cloud Service |
| Granite UI Foundation (`granite.ui.foundation`) | AEM 6.1+ |
| Granite UI Coral Foundation (`granite.ui.coral.foundation`) | AEM 6.2+ |

### 2.3 jQuery Version Bundled

| jQuery Version | AEM Version |
|---------------|-------------|
| jQuery 1.11.0 | AEM 6.1 - 6.3 |
| jQuery 1.12.4 | AEM 6.4 |
| jQuery 3.x | AEM 6.5 SP6+ / Cloud Service |

**Detection Method**: Check `/etc/clientlibs/granite/jquery/source/` path or parse jQuery version from loaded scripts.

### 2.4 HTL (Sightly) vs JSP Indicators

| Template Technology | AEM Version |
|--------------------|-------------|
| JSP templates (`.jsp` extensions in paths) | AEM 6.0 and earlier (CQ5) |
| HTL/Sightly (`data-sly-*` attributes) | AEM 6.1+ |
| HTL only (no JSP support) | AEM Cloud Service |

### 2.5 Clientlib Naming Conventions Per Version

| Pattern | Version Indicator |
|---------|-------------------|
| `/etc/designs/` for clientlibs | AEM 6.0 - 6.2 (pre-proxy) |
| `/etc.clientlibs/` proxy path | AEM 6.3+ (allowProxy=true) |
| Versioned clientlib hashes (lc-*.min.js) | ACS Commons present |
| `/etc.clientlibs/core/wcm/components/` | Core Components in use |

### 2.6 Default Error Page Content Per Version

| AEM Version | 404 Page Characteristics |
|-------------|------------------------|
| AEM 6.1-6.3 | "Cannot serve request to /path" with Sling branding |
| AEM 6.4-6.5 | Cleaner error page, may show "Resource not found" |
| AEM Cloud Service | Custom 404.html from repository root, or CDN error |
| Edge Delivery Services | Minimal plain HTML 404 |

### 2.7 Component Resource Type Patterns

| Resource Type Pattern | Version Indicator |
|----------------------|-------------------|
| `foundation/components/*` | Legacy Foundation Components (pre-6.3) |
| `wcm/foundation/components/*` | WCM Foundation (6.1-6.5, deprecated) |
| `core/wcm/components/*` | Core Components (6.3+) |
| Custom `/apps/` resource types only | Heavily customized (any version) |

---

## 3. AEM Cloud Service vs On-Prem Detection

### 3.1 Decision Matrix

| Signal | AEM Cloud Service | AEM Managed Services (AMS) | AEM On-Premise |
|--------|-------------------|---------------------------|----------------|
| **CDN** | Fastly (built-in) or BYOCDN | Akamai, CloudFront, or custom | Any or none |
| **Domain pattern** | `*.adobeaemcloud.com` (origin) | Custom domain | Custom domain |
| **DNS CNAME** | `cdn.adobeaemcloud.com` | Varies (Akamai, CloudFront) | Customer datacenter |
| **SSL Certificate** | Adobe-managed or customer DV/OV/EV | Customer-managed | Customer-managed |
| **X-AEM-Edge-Key** | Present (for BYOCDN) | Not present | Not present |
| **Fastly headers** | `x-served-by`, `x-cache` (Fastly PoP IDs) | Not present (unless using Fastly separately) | Not present |
| **Surrogate-Control** | Present (stripped by Fastly) | Not present | Not present |
| **Dispatcher behavior** | Cloud Dispatcher (immutable config) | Traditional Dispatcher | Traditional Dispatcher |
| **CoralUI 2 support** | None (CoralUI 3 only) | May have both | May have both |
| **JSP support** | None (HTL only) | JSP supported | JSP supported |

### 3.2 AEM Cloud Service Detection Signals (Ranked)

1. **DNS CNAME to `cdn.adobeaemcloud.com`** or A records to Adobe's CDN IPs -- Accuracy: 5/5
2. **Origin hostname pattern `publish-p<PROGRAM_ID>-e<ENV_ID>.adobeaemcloud.com`** -- Accuracy: 5/5
3. **Fastly PoP identifiers in `x-served-by` header** (e.g., `cache-iad-kcgs7200064`) -- Accuracy: 4/5 (Fastly used by other services too)
4. **`x-aem-debug` response header** when requesting with `x-aem-debug: edge=true` -- Accuracy: 5/5
5. **Absence of CoralUI 2 references** in clientlibs -- Accuracy: 3/5
6. **Modern Core Components version (2.25+)** detected via HTML patterns -- Accuracy: 3/5
7. **No JSP file references** anywhere in HTML source -- Accuracy: 2/5

### 3.3 AEM Managed Services (AMS) Detection Signals

1. **CNAME to Akamai (`*.edgesuite.net`, `*.akamaized.net`)** or CloudFront (`*.cloudfront.net`) -- Accuracy: 3/5 (not unique to AMS)
2. **Adobe's known IP ranges for AMS hosting** -- Accuracy: 4/5
3. **Traditional Dispatcher headers** without Fastly indicators -- Accuracy: 3/5
4. **Both CoralUI 2 and CoralUI 3 references** present -- Accuracy: 2/5

### 3.4 AEM On-Premise Detection Signals

1. **IP address resolves to customer's own datacenter** (not Adobe or major CDN) -- Accuracy: 3/5
2. **No CDN headers present** -- Accuracy: 2/5
3. **Older AEM version indicators** (6.1, 6.2, 6.3) -- Accuracy: 4/5 (Cloud Service is always current)
4. **JSP file references** in HTML source -- Accuracy: 4/5 (not supported on Cloud Service)

### 3.5 Edge Delivery Services (EDS) Detection

Edge Delivery Services (formerly Franklin/Helix) has a completely different architecture:

| Signal | Accuracy | Notes |
|--------|----------|-------|
| Domain pattern `*.aem.live` or `*.aem.page` | 5/5 | Production and preview domains |
| Domain pattern `*.hlx.live` or `*.hlx.page` | 5/5 | Legacy domain pattern |
| HTML structure: minimal, clean markup | 3/5 | Not unique |
| No `/etc.clientlibs/` paths | 3/5 | Absence indicator |
| No `parbase` or `aem-Grid` classes | 3/5 | Absence indicator |
| JavaScript: `aem.js` or `lib-franklin.js` loaded | 5/5 | EDS-specific library |
| GitHub-based content source | 4/5 | Detectable from source |
| `/.well-known/` paths with EDS config | 4/5 | EDS configuration |

**Key Distinction**: EDS shares the "AEM" brand but has zero technical overlap with traditional AEM Sites. It is a completely separate system using serverless microservices, GitHub for code, and Google Docs/SharePoint for authoring. Detection requires entirely separate logic.

---

## 4. Multi-Page Probing Strategy

### 4.1 High-Value Probe Paths

Instead of only scanning the homepage, probe these additional paths and analyze the responses:

| Path | Expected Response on AEM | What It Reveals | Risk Level |
|------|-------------------------|----------------|------------|
| `/libs/granite/core/content/login.html` | 200 with "AEM Sign In" or redirect | Confirms AEM, may show version | Low |
| `/system/console` | 403 (blocked by Dispatcher) or 404 | 403 = AEM present, Dispatcher blocking | Low |
| `/crx/de` | 403 or 404 | 403 = AEM present, CRXDE blocked | Low |
| `/content.json` | 200 with JSON or 403 | 200 = serious misconfiguration; 403 = AEM present | Low |
| `/content.1.json` | 200 with JSON or 403 | Sling JSON export | Low |
| `/bin/querybuilder.json` | 403 or 404 | 403 = AEM present | Low |
| `/etc.clientlibs/*.js` | 200 with JS content | Confirms AEM, reveals clientlib structure | Low |
| `/content/dam.json` | 200 or 403 | 200 = DAM exposed; 403 = AEM present | Low |
| `/libs/cq/core/content/welcome.html` | 200 or 403 | AEM welcome page | Low |
| `/.json` | 200 with JCR root or 403/404 | DefaultGetServlet exposure | Low |
| `/.1.json` | 200 with JCR root (depth 1) or 403/404 | DefaultGetServlet with depth | Low |
| `/libs/granite/csrf/token.json` | 200 with CSRF token or 403 | AEM CSRF endpoint | Low |
| `/etc/groovyconsole/` | 403 or 404 | ACS AEM Tools present | Low |

### 4.2 Response Code Analysis Matrix

| Path | 200 | 301/302 | 403 | 404 | Interpretation |
|------|-----|---------|-----|-----|---------------|
| `/system/console` | AEM misconfigured (critical) | Likely AEM | AEM with Dispatcher | Not AEM or heavily custom | |
| `/crx/de` | AEM misconfigured (critical) | Redirect to login (AEM) | AEM with Dispatcher | Possibly not AEM | |
| `/content.json` | AEM misconfigured | N/A | Likely AEM | Possibly not AEM | |
| `/libs/granite/core/content/login.html` | AEM (may show version) | AEM (auth redirect) | AEM (Dispatcher blocking) | Likely not AEM | |
| `/.json` | AEM misconfigured | N/A | Likely AEM | Sling not present or blocked | |
| `/bin/querybuilder.json` | AEM misconfigured (critical) | N/A | Likely AEM | Possibly not AEM | |

**Key Insight**: A 403 response on AEM-specific paths is almost as informative as a 200. A well-secured AEM instance returns 403 on `/system/console`, `/crx/de`, `/bin/querybuilder.json`, etc. A non-AEM site would return 404 for these paths. The 403 vs 404 distinction is a powerful detection signal.

### 4.3 Dispatcher Bypass Probes (for confirming AEM)

These are NOT for exploitation but for confirming AEM presence when standard paths return 404:

| Technique | Example | What It Reveals |
|-----------|---------|----------------|
| Semicolon extension bypass | `/content.json;.css` | If returns JSON instead of 404, confirms AEM + vulnerable Dispatcher |
| Encoded path | `/%2fcontent.json` | If behavior differs from `/content.json`, confirms AEM Dispatcher |
| Selector appending | `/nonexistent.infinity.json` | Sling selector handling behavior |
| Extension variation | `/content.xml` vs `/content.html` | Sling extension resolution |

**Ethical/Legal Note**: These probes send normal HTTP GET requests. They do not attempt authentication bypass, data extraction, or exploitation. They simply observe how the server handles URL variations, which is passive fingerprinting.

---

## 5. DNS and Infrastructure Analysis

### 5.1 DNS Record Analysis

| DNS Pattern | Deployment Type | Accuracy |
|-------------|----------------|----------|
| CNAME to `cdn.adobeaemcloud.com` | AEM Cloud Service | 5/5 |
| A records to Adobe CDN IP ranges | AEM Cloud Service | 4/5 |
| CNAME to `*.adobeaemcloud.com` | AEM Cloud Service (origin) | 5/5 |
| CNAME to `*.edgesuite.net` or `*.akamaized.net` | Likely AMS or on-prem with Akamai | 3/5 |
| CNAME to `*.cloudfront.net` | Likely AMS with CloudFront | 3/5 |
| CNAME to `*.fastly.net` (but NOT adobeaemcloud) | Could be AEM Cloud with BYOCDN | 3/5 |
| IP resolves to AWS/Azure datacenter | AMS or customer cloud | 2/5 |
| IP resolves to corporate datacenter | On-premise | 3/5 |
| CNAME to `*.aem.live` | Edge Delivery Services | 5/5 |

### 5.2 SSL/TLS Certificate Analysis

| Certificate Attribute | What It Reveals | Accuracy |
|----------------------|----------------|----------|
| SAN includes `*.adobeaemcloud.com` | AEM Cloud Service origin | 5/5 |
| Issued by Let's Encrypt with Fastly | Likely AEM Cloud Service | 3/5 |
| Issued by DigiCert with Adobe org | AMS or Adobe-managed | 4/5 |
| Issued by customer organization | On-premise or customer-managed CDN | 2/5 |

### 5.3 IP Range Analysis

Adobe's known infrastructure IP ranges can be identified through:
- Shodan queries: `"AEM Sign In"` in HTTP title
- Censys certificate searches for `*.adobeaemcloud.com`
- BGP/ASN lookup for Adobe's network blocks

**Accuracy**: 3/5 (useful for correlation, not definitive alone)
**Works Behind CDN**: No (CDN hides origin IP)

---

## 6. Existing CMS Detection Tool Methodology

### 6.1 Wappalyzer Detection Rules (Open Source)

Wappalyzer (now community-maintained as "wapalyzer") uses these specific patterns for AEM:

**HTML patterns** (checked against page source):
```regex
<div class="[^"]*parbase
<div[^>]+data-component-path="[^"]+jcr:
<div class="[^"]*aem-Grid
```

**Script source patterns** (checked against `<script src>`):
```regex
/etc/designs/
/etc/clientlibs/
/etc\.clientlibs/
```

**Script attribute patterns**:
```regex
aem-(?:GridColumn|apps/)
```

**Metadata**:
- Category: CMS (Content Management System)
- CPE: `cpe:2.3:a:adobe:experience_manager:*:*:*:*:*:*:*:*`
- Implies: Java
- SaaS: True

**Key Observation**: Wappalyzer's AEM detection is relatively basic. It does not attempt version detection, deployment type identification, or multi-path probing. There is significant room for improvement.

### 6.2 BuiltWith Detection Methods

BuiltWith combines multiple signals:
1. URL paths containing `/content/`, `/etc.clientlibs/`, `/etc/designs/`, `/etc/packages/`, `/etc/acs-commons/`
2. Script/stylesheet sources referencing clientlib paths
3. Cookie names (cq-author, cq-session, asgard)
4. HTTP response headers (X-AEM-Instance, X-AEM-Server)
5. Media URLs containing `/content/dam/`

**Current BuiltWith AEM data**: Tracks approximately 40,000-60,000 known AEM sites.

### 6.3 WhatCMS Detection Methods

WhatCMS uses:
1. HTML markup patterns (uniquely identifiable AEM markup)
2. Network tab analysis for `clientlibs`, `dam`, `granite` in request URLs
3. Source code search for `clientlibrary` or `parsys` terms
4. Cookie and header analysis

### 6.4 Shodan/Nuclei Detection

Security researchers use:
1. Shodan dork: `"http.title:AEM Sign In"` -- targets the login page title
2. Nuclei templates for AEM-specific vulnerabilities
3. SSL certificate SAN analysis for `adobeaemcloud.com` domains
4. Banner grabbing on AEM-specific ports

### 6.5 Specialized AEM Security Tools

**aem-hacker** (0ang3el/aem-hacker):
- 28+ vulnerability checks
- Servlet exposure detection (DefaultGetServlet, QueryBuilder, GQL, Login, etc.)
- Administrative interface detection (CRXDE, Felix Console, Groovy Console)
- SSRF vulnerability checks
- Dispatcher bypass techniques
- Default credential testing
- Version fingerprinting through error responses

**aemscan** (Raz0r/aemscan):
- Default credential bruteforce
- Info leak via default error page
- WebDAV support check
- Version detection
- Useful paths scanner

**burp-aem-scanner** (thomashartm/burp-aem-scanner):
- Burp Suite extension for AEM fingerprinting
- Active scanning for misconfigurations
- Security hole detection

---

## 7. Creative and Unconventional Approaches

### 7.1 Response Timing Analysis

| Technique | Description | Accuracy | Feasibility |
|-----------|-------------|----------|-------------|
| First Byte Time (TTFB) comparison | AEM sites typically have 200-800ms TTFB for uncached pages due to JCR query overhead | 2/5 | Medium |
| Cached vs uncached timing delta | AEM Dispatcher cache has characteristic timing patterns (fast cache hit vs slow miss) | 2/5 | Medium |
| Multi-path timing correlation | Specific AEM paths have predictable timing signatures | 1/5 | Low |

**Verdict**: Timing analysis is unreliable for AEM detection. Too many variables (CDN, geography, server load) affect response times.

### 7.2 Response Size Analysis

Not practical for detection. AEM page sizes vary enormously based on content and components used.

### 7.3 HTTP/2 and HTTP/3 Behavior

AEM Cloud Service supports HTTP/2 through Fastly. On-premise may or may not support HTTP/2. Not a reliable differentiator.

### 7.4 WebPageTest / CrUX Data

- WebPageTest can provide detailed performance data including headers and resource loading patterns
- Chrome UX Report (CrUX) data available via BigQuery may correlate with AEM performance profiles
- These are supplementary signals, not primary detection methods

### 7.5 Shodan and Censys Queries

| Query | Platform | What It Finds |
|-------|----------|---------------|
| `http.title:"AEM Sign In"` | Shodan | AEM author instances with exposed login page |
| `ssl.cert.subject.cn:*.adobeaemcloud.com` | Censys | AEM Cloud Service origins |
| `http.html:"parbase"` | Shodan | AEM publish instances |
| `http.headers:"X-Dispatcher"` | Shodan | AEM Dispatcher instances |

**Accuracy**: 4/5 for finding AEM instances. Limited for version/deployment type detection.

### 7.6 Adobe Customer Lists and Case Studies

Adobe publicly lists some customers:
- Adobe Summit speaker companies
- Adobe Experience League customer stories
- Adobe partner case studies
- Adobe blog featured implementations

This provides a ground truth database for validation but cannot be the primary detection method.

### 7.7 Wayback Machine Historical Analysis

The Internet Archive's Wayback Machine can reveal:
- Historical HTTP headers that may have been stripped later
- Historical HTML source that may have contained more AEM markers
- Migration timeline (when a site moved to/from AEM)
- Version progression over time

**Use Case**: When current detection is inconclusive, check Wayback Machine for historical evidence of AEM usage.

### 7.8 Google Dork Discovery

| Query | What It Finds |
|-------|---------------|
| `site:example.com inurl:"/content/dam/"` | AEM DAM assets indexed by Google |
| `site:example.com inurl:"/etc.clientlibs/"` | AEM clientlib URLs in Google index |
| `site:example.com inurl:"jcr:content"` | JCR content paths indexed |
| `site:example.com inurl:"/content/usergenerated/"` | AEM user-generated content |

---

## 8. Building a Reference Database

### 8.1 Data Sources for Known AEM Sites

| Source | Estimated Count | Data Quality | Update Frequency |
|--------|----------------|--------------|-----------------|
| BuiltWith | ~40,000-60,000 sites | High | Monthly |
| Wappalyzer | ~43,500 sites | Medium | Continuous |
| WebTechSurvey | ~59,789 sites | Medium | Periodic |
| W3Techs | Market share data | High | Monthly |
| Adobe customer case studies | ~500-1,000 | Very High (ground truth) | Quarterly |
| Adobe Summit attendee companies | ~2,000-5,000 | Medium | Annual |
| Shodan scans | Variable | Medium | Continuous |

### 8.2 Cross-Referencing Strategy

1. **Seed list**: Combine BuiltWith + Wappalyzer data for initial known AEM sites
2. **Verify**: Run our detection against seed list to calculate baseline accuracy
3. **Expand**: Use seed list patterns to discover new AEM sites
4. **Validate**: Cross-reference with Adobe public customer data for ground truth
5. **Version enrichment**: For sites where version is known (e.g., from Shodan login page scans), add version data to reference

### 8.3 Crowdsource Verification

Potential sources for crowdsourced verification:
- AEM community forums (Adobe Experience League)
- AEM consulting partner networks (who know their clients' deployments)
- AEM conference attendees
- Open-source AEM project contributors

### 8.4 Estimated Reference Database Size

A realistic reference database could contain:
- **60,000+** known AEM sites (from BuiltWith/Wappalyzer)
- **5,000+** sites with confirmed version information
- **2,000+** sites with confirmed deployment type (cloud/AMS/on-prem)
- **500+** sites with ground truth from direct knowledge

---

## 9. Accuracy Validation Methodology

### 9.1 Ground Truth Sources

| Source | Reliability | Coverage |
|--------|-------------|----------|
| Own AEM instances (test matrix) | 5/5 | Full control over version/deployment |
| Adobe partner client data | 4/5 | Known versions, limited sharing |
| Shodan/Censys exposed login pages | 4/5 | Version visible on login page |
| BuiltWith historical data | 3/5 | Detection may have errors |
| Public case studies with version mentioned | 5/5 | Very limited coverage |

### 9.2 Test Matrix Approach

Create AEM instances at each version for validation:

| Instance | Version | Deployment | Purpose |
|----------|---------|------------|---------|
| Test 1 | AEM 6.3 | On-premise (Docker) | Baseline fingerprinting |
| Test 2 | AEM 6.4 | On-premise (Docker) | Version differentiation |
| Test 3 | AEM 6.5 | On-premise (Docker) | Version differentiation |
| Test 4 | AEM 6.5 + ACS Commons | On-premise (Docker) | ACS Commons detection |
| Test 5 | AEM Cloud Service | Adobe sandbox | Cloud vs on-prem differentiation |
| Test 6 | AEM Cloud Service + BYOCDN | Adobe sandbox + custom CDN | BYOCDN detection |
| Test 7 | Edge Delivery Services | aem.live | EDS detection |

### 9.3 Accuracy Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **AEM Detection Precision** | True AEM sites / All sites flagged as AEM | > 95% |
| **AEM Detection Recall** | True AEM sites detected / All actual AEM sites | > 90% |
| **Version Accuracy** | Correct version / All version predictions | > 75% |
| **Deployment Type Accuracy** | Correct type / All type predictions | > 85% |
| **F1 Score (AEM Detection)** | Harmonic mean of precision and recall | > 92% |

### 9.4 Validation Process

1. **Phase 1**: Test against own instances (full control) -- establish baseline
2. **Phase 2**: Test against known AEM sites from BuiltWith (large scale) -- measure recall
3. **Phase 3**: Test against known non-AEM sites (WordPress, Drupal, Sitecore) -- measure precision
4. **Phase 4**: Test against ambiguous sites -- measure edge case handling
5. **Phase 5**: Blind test with partner network validation -- final accuracy measurement

---

## 10. Composite Scoring Model

### 10.1 Weighted Signal Scoring

To achieve 90%+ accuracy, combine multiple signals with weighted scores:

```
AEM_CONFIDENCE_SCORE = (
    HTML_PATTERNS_SCORE * 0.35 +
    URL_PATH_SCORE * 0.25 +
    PROBE_RESPONSE_SCORE * 0.15 +
    DNS_INFRASTRUCTURE_SCORE * 0.10 +
    HEADER_SCORE * 0.05 +
    COOKIE_SCORE * 0.02 +
    ERROR_PAGE_SCORE * 0.05 +
    ROBOTS_TXT_SCORE * 0.03
)
```

### 10.2 Signal Weight Rationale

| Signal Category | Weight | Rationale |
|----------------|--------|-----------|
| HTML Patterns | 35% | Most reliable, works behind CDN, AEM-unique |
| URL Path Patterns | 25% | Very reliable, present in script/link/img tags |
| Multi-Path Probe Responses | 15% | 403 vs 404 on AEM-specific paths is highly informative |
| DNS/Infrastructure | 10% | Good for deployment type, less for AEM detection |
| HTTP Headers | 5% | Usually stripped by CDN, low availability |
| Cookies | 2% | Rarely present on publish instances |
| Error Pages | 5% | Useful when available, many sites customize |
| Robots.txt | 3% | Supplementary signal |

### 10.3 Confidence Thresholds

| Score Range | Classification | Action |
|-------------|---------------|--------|
| 0.85 - 1.00 | **Confirmed AEM** | Report as AEM with high confidence |
| 0.65 - 0.84 | **Likely AEM** | Report as probable AEM, flag for review |
| 0.40 - 0.64 | **Possible AEM** | Inconclusive, needs manual review |
| 0.00 - 0.39 | **Not AEM** | Report as non-AEM |

### 10.4 Deployment Type Scoring

After AEM is confirmed, run deployment type classification:

```
CLOUD_SERVICE_SCORE = (
    DNS_CNAME_ADOBEAEMCLOUD * 0.40 +
    FASTLY_HEADERS_PRESENT * 0.25 +
    NO_CORALUI2_REFERENCES * 0.10 +
    NO_JSP_REFERENCES * 0.10 +
    MODERN_CORE_COMPONENTS * 0.10 +
    SSL_CERT_ADOBE_MANAGED * 0.05
)

EDS_SCORE = (
    AEM_LIVE_DOMAIN * 0.50 +
    EDS_JS_LIBRARY * 0.30 +
    NO_CLIENTLIB_PATHS * 0.10 +
    MINIMAL_HTML_STRUCTURE * 0.10
)

// If neither Cloud Service nor EDS scores high:
// Classify as AMS or On-Premise based on:
// - CDN provider (Akamai = likely AMS)
// - IP ownership (Adobe ranges = likely AMS)
// - AEM version (older = likely on-prem)
```

### 10.5 Version Estimation Logic

```
IF Core Components cmp-* classes found:
    Analyze component types present to estimate Core Components version
    Map to AEM version using compatibility table

IF /etc.clientlibs/ proxy path used:
    AEM >= 6.3

IF /etc/designs/ path used (without proxy):
    AEM <= 6.2 (possibly 6.3 without allowProxy)

IF CoralUI 2 only:
    AEM 6.1 - 6.3

IF CoralUI 3 present:
    AEM >= 6.2

IF CoralUI 3 only (no CoralUI 2):
    Likely AEM Cloud Service

IF jQuery 1.x detected:
    AEM 6.1 - 6.4

IF jQuery 3.x detected:
    AEM 6.5 SP6+ or Cloud Service

IF data-sly-* attributes present but no cmp-* classes:
    AEM 6.1 - 6.3 with custom components (no Core Components)

IF JSP references found:
    NOT Cloud Service (AEM 6.x on-prem/AMS)
```

---

## 11. Implementation Recommendations

### 11.1 Recommended Scan Sequence

Execute in this order for optimal efficiency:

**Phase 1: Quick Check (< 2 seconds)**
1. Fetch homepage HTML
2. Check HTML for `parbase`, `aem-Grid`, `data-sly-*`, `cmp-*` patterns
3. Check all resource URLs for `/etc.clientlibs/`, `/content/dam/` patterns
4. If confidence > 0.65, proceed to Phase 2

**Phase 2: Path Probing (< 5 seconds)**
5. HEAD request to `/libs/granite/core/content/login.html`
6. HEAD request to `/system/console`
7. HEAD request to `/crx/de`
8. HEAD request to `/bin/querybuilder.json`
9. GET request to `/robots.txt`
10. Analyze response codes (403 vs 404 pattern)

**Phase 3: Infrastructure Analysis (< 3 seconds)**
11. DNS CNAME lookup
12. SSL certificate SAN analysis
13. HTTP response header collection

**Phase 4: Deep Analysis (< 10 seconds)**
14. Fetch 2-3 additional pages and analyze HTML
15. Check specific clientlib URLs for version information
16. Error page analysis (request nonexistent path)
17. Check for EDS-specific indicators

### 11.2 Rate Limiting and Politeness

- Maximum 10 requests per site per scan
- 100ms delay between requests to same host
- Respect robots.txt `Crawl-delay` directives
- Use a descriptive User-Agent string
- Do not attempt authentication or exploitation

### 11.3 Data Storage Schema

```typescript
interface AEMDetectionResult {
  url: string;
  scanDate: string;

  // Overall classification
  isAEM: boolean;
  confidence: number; // 0.0 - 1.0

  // Deployment type
  deploymentType: 'cloud-service' | 'managed-services' | 'on-premise' | 'edge-delivery' | 'unknown';
  deploymentConfidence: number;

  // Version estimation
  estimatedVersion: string | null; // e.g., "6.5", "6.4", "Cloud Service"
  versionConfidence: number;
  servicePackEstimate: string | null; // e.g., "SP17"

  // Detected signals
  signals: {
    htmlPatterns: SignalDetail[];
    urlPaths: SignalDetail[];
    probeResponses: ProbeResult[];
    headers: HeaderSignal[];
    cookies: string[];
    dnsRecords: DNSRecord[];
    sslCertificate: CertificateInfo | null;
    robotsTxt: RobotsTxtInfo | null;
    errorPageAnalysis: ErrorPageInfo | null;
  };

  // Scoring breakdown
  scores: {
    htmlPatterns: number;
    urlPaths: number;
    probeResponses: number;
    dnsInfrastructure: number;
    headers: number;
    cookies: number;
    errorPages: number;
    robotsTxt: number;
    composite: number;
  };
}
```

### 11.4 Expected Accuracy by Approach

| Approach | AEM Detection | Version Detection | Deployment Type |
|----------|---------------|-------------------|----------------|
| HTML patterns only | 85% | 40% | 20% |
| HTML + URL paths | 92% | 55% | 30% |
| HTML + URL + path probing | 95% | 60% | 45% |
| Full composite (all signals) | 97% | 75% | 85% |
| Full composite + reference DB | 98% | 80% | 90% |

### 11.5 Known Limitations

1. **Headless AEM**: Sites using AEM as a headless CMS with a separate frontend (React, Next.js) may show zero AEM HTML patterns. Detection falls to path analysis and infrastructure signals.
2. **Heavy customization**: Sites that completely override default class names, rewrite all URLs, and strip all headers are very difficult to detect.
3. **Reverse proxy masking**: Sites behind non-standard reverse proxies that rewrite paths and headers may produce false negatives.
4. **False positives from forks**: Apache Sling projects outside AEM may share some URL patterns.
5. **Version granularity**: Distinguishing service packs (e.g., 6.5 SP17 vs SP18) is extremely difficult from external observation.

---

## Appendix A: Complete AEM Probe Path List

```
# Primary AEM detection paths
/libs/granite/core/content/login.html
/system/console
/crx/de
/crx/packmgr/index.jsp
/bin/querybuilder.json
/content.json
/content.1.json
/.json
/.1.json
/libs/cq/core/content/welcome.html
/etc.clientlibs/
/content/dam.json

# Administrative paths (expect 403 on secured instances)
/system/console/bundles
/system/console/status-productinfo
/system/console/configMgr
/etc/groovyconsole/
/bin/crxde/logs
/adminui/debug

# Information disclosure paths
/libs/granite/security/currentuser.json
/system/sling/loginstatus.json
/libs/cq/AuditlogSearchServlet.json
/libs/cq/ui/content/dumplibs.html
/bin/wcm/search/gql.json

# Content access paths
/content/usergenerated/
/home/users/.json
/content/dam/.json

# CSRF and authentication paths
/libs/granite/csrf/token.json

# Sitemap and SEO paths
/sitemap.xml
/robots.txt

# Edge Delivery Services specific
/.well-known/
```

## Appendix B: AEM Version Timeline

| Version | Release Date | Key Indicators |
|---------|-------------|----------------|
| CQ 5.x | 2009-2013 | `cq:` namespace, JSP only, Classic UI |
| AEM 6.0 | 2014 | Touch UI introduced, `/etc/designs/` clientlibs |
| AEM 6.1 | 2015 | HTL/Sightly introduced, `data-sly-*` attributes |
| AEM 6.2 | 2016 | CoralUI 3 introduced alongside CoralUI 2 |
| AEM 6.3 | 2017 | Core Components v1, `/etc.clientlibs/` proxy, `cmp-*` classes begin |
| AEM 6.4 | 2018 | Core Components v2, modern Granite UI |
| AEM 6.5 | 2019-present | CoralUI 3 default, ongoing SPs (currently SP20+) |
| AEM Cloud Service | 2020-present | Always latest, Fastly CDN, no JSP, no CoralUI 2 |
| Edge Delivery Services | 2023-present | Serverless, `aem.live` domain, document-based authoring |

## Appendix C: Ethical and Legal Considerations

| Technique | Ethical | Legal | Notes |
|-----------|---------|-------|-------|
| HTML source analysis | Yes | Yes | Public information |
| HTTP header observation | Yes | Yes | Public response data |
| DNS lookups | Yes | Yes | Public records |
| SSL certificate analysis | Yes | Yes | Public certificates |
| robots.txt reading | Yes | Yes | Public file |
| HEAD/GET requests to common paths | Yes | Yes | Standard web browsing |
| Dispatcher bypass probes | Borderline | Likely legal | Sends crafted but non-malicious requests |
| Default credential testing | No | Potentially illegal | Unauthorized access attempt |
| Shodan/Censys queries | Yes | Yes | Querying public databases |
| Google dorking | Yes | Yes | Using public search engines |
| Wayback Machine research | Yes | Yes | Public archive |

**Recommendation**: Stick to techniques rated "Yes" for both ethical and legal columns. Avoid default credential testing and exploitation attempts. All detection should be passive observation of public HTTP responses.

---

## Sources

- [Wappalyzer AEM Detection Rules (GitHub fork by Lissy93)](https://github.com/Lissy93/wapalyzer)
- [aem-hacker - AEM Vulnerability Scanner (0ang3el)](https://github.com/0ang3el/aem-hacker)
- [aemscan - AEM Vulnerability Scanner (Raz0r)](https://github.com/Raz0r/aemscan)
- [Burp AEM Scanner (thomashartm)](https://github.com/thomashartm/burp-aem-scanner)
- [HackTricks - AEM Adobe Experience Cloud](https://hacktricks.wiki/en/network-services-pentesting/pentesting-web/aem-adobe-experience-cloud.html)
- [Pen Test Partners - Quick Wins with AEM](https://www.pentestpartners.com/security-blog/quick-wins-with-adobe-experience-manager/)
- [Trickest - AEM Vulnerabilities at Scale](https://trickest.com/blog/adobe-experience-manager-vulnerabilities-at-scale/)
- [Adobe CDN in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn)
- [Adobe Core Components Versions](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/versions)
- [AEM Core WCM Components CSS Conventions](https://github.com/adobe/aem-core-wcm-components/wiki/css-coding-conventions)
- [AEM Cloud Service CDN Documentation (GitHub)](https://github.com/AdobeDocs/experience-manager-cloud-service.en/blob/main/help/implementing/dispatcher/cdn.md)
- [AEM WKND Dispatcher Default Filters](https://github.com/adobe/aem-guides-wknd/blob/main/dispatcher/src/conf.dispatcher.d/filters/default_filters.any)
- [AEM Request/Response Headers Analysis (TechRevel)](https://techrevel.blog/2023/09/05/exploring-aem-request-and-response-headers-analysis-of-browser-cdn-and-dispatcher/)
- [AEM Path Payloads List (GitHub Gist)](https://gist.github.com/mrtouch93/6b2f545e0f1f8944bab7006bf9e80d6d)
- [3ShareCorp - AEM Application Security](https://blog.3sharecorp.com/taking-application-security-to-the-next-level)
- [AEM Dispatcher Optimizer Tool Rules](https://github.com/adobe/aem-dispatcher-optimizer-tool/blob/main/docs/Rules.md)
- [BuiltWith AEM Market Share](https://trends.builtwith.com/cms/Adobe-Experience-Manager)
- [Wappalyzer AEM Data](https://www.wappalyzer.com/technologies/cms/adobe-experience-manager/)
- [W3Techs AEM Usage Statistics](https://w3techs.com/technologies/details/cm-adobeexperiencemanager)
- [Searchlight Cyber - Finding Critical Bugs in AEM](https://slcyber.io/research-center/finding-critical-bugs-in-adobe-experience-manager/)
- [AEM Edge Delivery Services Architecture](https://www.aem.live/docs/architecture)
- [Pentest Book - Adobe AEM](https://www.pentest-book.com/enumeration/webservices/adobe-aem)
- [AEM Security Checklist (Adobe)](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/security/security-checklist)
- [AEM Frontend Stack - Granite and Coral UI (StackKnowledge)](https://stacknowledge.in/blogs/aem-frontend-granite-coral/)
- [Fastly Debug Headers Documentation](https://www.fastly.com/documentation/reference/http/http-headers/Fastly-Debug/)
- [AEM Caching in Cloud Service (Adobe)](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/caching)
