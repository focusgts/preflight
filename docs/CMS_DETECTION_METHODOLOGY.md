# CMS Detection Methodology Research

> Comprehensive analysis of how leading technology detection tools identify Adobe Experience Manager (AEM) and determine versions. Research conducted March 2026.

---

## Table of Contents

1. [Wappalyzer / WebAppAnalyzer (Open Source)](#1-wappalyzer--webappanalyzer-open-source)
2. [BuiltWith](#2-builtwith)
3. [WhatRuns](#3-whatruns)
4. [Netcraft](#4-netcraft)
5. [Real-World AEM Detection Signals](#5-real-world-aem-detection-signals)
6. [AEM-Specific URL Probes](#6-aem-specific-url-probes)
7. [DNS-Based Detection](#7-dns-based-detection)
8. [Certificate-Based Detection](#8-certificate-based-detection)
9. [Comparison with Other CMS Detection Rules](#9-comparison-with-other-cms-detection-rules)
10. [Recommendations for Our Implementation](#10-recommendations-for-our-implementation)

---

## 1. Wappalyzer / WebAppAnalyzer (Open Source)

### Source Repositories

- **Original (archived):** `github.com/wappalyzer/wappalyzer` (now deleted/privatized)
- **Active fork (HTTPArchive):** `github.com/HTTPArchive/wappalyzer`
- **Active fork (enthec):** `github.com/enthec/webappanalyzer`
- **Specification:** `docs.wappalyzer.com/dev/specification.html`

### Detection Schema Format

Wappalyzer uses a JSON schema with the following detection fields. Each technology entry can contain any combination of these:

| Field | Type | What It Checks |
|-------|------|----------------|
| `headers` | Object | HTTP response header names and value patterns |
| `cookies` | Object | Cookie names and value patterns |
| `html` | Array/String | HTML source code regex patterns (must include HTML tag to avoid false matches) |
| `dom` | Array/String | DOM element selectors (CSS selectors with attribute/property/text checks) |
| `meta` | Object | `<meta>` tag name-content pairs (e.g., `generator`) |
| `js` | Object | JavaScript global variable/property existence and value patterns |
| `scriptSrc` | Array/String | Patterns matched against `<script src="">` URLs |
| `scripts` | Array/String | Patterns matched against inline/external script content |
| `url` | Array/String | Patterns matched against the page URL |
| `xhr` | String | Patterns matched against hostnames of XHR requests |
| `dns` | Object | DNS record patterns (MX, TXT, SOA, NS) - NPM driver only |
| `certIssuer` | String | SSL certificate issuer pattern |
| `probe` | Object | URL paths to request and match response content - NPM driver only |
| `robots` | String | Patterns matched against robots.txt content |
| `text` | String | Patterns matched against visible page text |
| `css` | String | Patterns matched against CSS content |
| `implies` | Array/String | Other technologies implied by this detection |
| `excludes` | Array/String | Technologies that cannot coexist with this one |
| `requires` | Array/String | Technologies that must be present for this detection |
| `cats` | Array | Category IDs this technology belongs to |
| `cpe` | String | Common Platform Enumeration identifier |

### Pattern Syntax and Modifiers

Patterns are JavaScript-compatible regular expressions written as strings. Two special modifiers exist:

```
\;version:\1    - Extract version from capture group (e.g., "^WordPress(?: ([\\d.]+))?\\;version:\\1")
\;confidence:N  - Set confidence percentage (0-100, default 100)
```

**Confidence scoring:** Default confidence is 100% per pattern. Multiple patterns for the same technology have their confidence values combined additively toward a target of 100%. Lower confidence values indicate less reliable patterns that may produce false positives.

### AEM Detection Rules (Exact from Repository)

From `github.com/enthec/webappanalyzer/main/src/technologies/a.json`:

```json
{
  "Adobe Experience Manager": {
    "cats": [1],
    "cpe": "cpe:2.3:a:adobe:experience_manager:*:*:*:*:*:*:*:*",
    "description": "Adobe Experience Manager (AEM) is a content management solution for building websites, mobile apps and forms.",
    "dom": [
      "div[class*='parbase'], div[data-component-path*='jcr:'], div[class*='aem-Grid']"
    ],
    "html": [
      "<div class=\"[^\"]*parbase",
      "<div[^>]+data-component-path=\"[^\"+]jcr:",
      "<div class=\"[^\"]*aem-Grid"
    ],
    "icon": "Adobe Experience Platform.svg",
    "implies": ["Java"],
    "pricing": ["poa"],
    "saas": true,
    "scriptSrc": [
      "/etc/designs/",
      "/etc/clientlibs/",
      "/etc\\.clientlibs/"
    ],
    "scripts": [
      "aem-(?:GridColumn|apps/)|AEMMode"
    ],
    "website": "https://www.adobe.com/marketing/experience-manager.html"
  }
}
```

#### What Wappalyzer Checks for AEM

| Signal Type | Pattern | What It Detects |
|-------------|---------|-----------------|
| **HTML** | `<div class="[^"]*parbase` | AEM paragraph base component system |
| **HTML** | `<div[^>]+data-component-path="[^"+]jcr:` | JCR (Java Content Repository) data attributes |
| **HTML** | `<div class="[^"]*aem-Grid` | AEM responsive grid layout system |
| **DOM** | `div[class*='parbase']` | Paragraph base CSS class |
| **DOM** | `div[data-component-path*='jcr:']` | JCR component path attributes |
| **DOM** | `div[class*='aem-Grid']` | AEM grid system classes |
| **scriptSrc** | `/etc/designs/` | AEM design clientlib path |
| **scriptSrc** | `/etc/clientlibs/` | AEM classic clientlib path |
| **scriptSrc** | `/etc\.clientlibs/` | AEM proxy clientlib path (modern) |
| **scripts** | `aem-(?:GridColumn\|apps/)\|AEMMode` | AEM grid column or AEM mode references in script content |

#### AEM Edge Delivery Services Detection

```json
{
  "Adobe Experience Manager Edge Delivery Services": {
    "cats": [1],
    "scriptSrc": [
      "^.+/scripts/aem\\.js$",
      "^.+/scripts/lib-franklin\\.js$"
    ]
  }
}
```

#### AEM Franklin Detection

```json
{
  "Adobe Experience Manager Franklin": {
    "js": {
      "hlx.RUM_MANUAL_ENHANCE": ""
    },
    "scriptSrc": [
      "^.+/scripts/lib-franklin\\.js$"
    ]
  }
}
```

### What Wappalyzer Does NOT Check for AEM

Notably absent from Wappalyzer's AEM detection:

- **No header checks** (no X-Dispatcher, no Server header patterns)
- **No cookie checks** (no cq-authoring-mode, no login-token)
- **No meta tag checks** (no generator tag - AEM rarely sets one)
- **No JavaScript global variable checks** (no CQ, no Granite, no WCMMode)
- **No URL pattern checks** (no /content/ path detection)
- **No DNS checks** (no adobeaemcloud.com CNAME detection)
- **No certificate checks** (no Adobe-managed cert detection)
- **No probe checks** (no login.html or CSRF token endpoint probing)
- **No version detection at all** (no version extraction patterns)

This represents a significant opportunity for us to improve upon their methodology.

### Related Adobe Technology Detections

Wappalyzer also detects adjacent Adobe technologies that often accompany AEM:

| Technology | Detection Method |
|-----------|-----------------|
| Adobe Analytics | JS: `s_c_il.0._c = "s_c"`, `AppMeasurement` constructor |
| Adobe Audience Manager | Cookies: `Demdex`, `aam_uuid` |
| Adobe Client Data Layer | JS: `adobeDataLayer.version` (with version extraction) |
| Adobe DTM | JS: `_satellite.buildDate` |
| Adobe Experience Platform Launch | JS: `_satellite.buildInfo` |
| Adobe Target | JS: `adobe.target`, `adobe.target.VERSION` (with version) |
| Adobe Dynamic Media Classic | DOM: `source[srcset*='.scene7.com/']`, Header: CSP contains `.scene7.com` |

### Confidence Scoring Details

- Default confidence per pattern: **100%**
- Multiple patterns combine additively
- Example: `"acsb": "\\;confidence:50"` means AccessiBe JS detection is only 50% confident
- A technology is reported when combined confidence reaches 100%
- AEM detection has no explicit confidence modifiers (all patterns are 100%)

---

## 2. BuiltWith

### Detection Methodology

BuiltWith is a proprietary, closed-source technology profiling service. Their exact detection rules are not published, but through analysis of their results and public documentation, their methodology includes:

### Known Detection Signals Used

| Signal | Pattern | Description |
|--------|---------|-------------|
| **URL paths** | `/content/`, `/etc.clientlibs/`, `/etc/designs/`, `/content/dam/` | Standard AEM content and asset paths |
| **ClientLib references** | Script/CSS `src` containing `/etc.clientlibs/` or `/etc/clientlibs/` | AEM client library loading pattern |
| **Asset paths** | `/content/dam/` in image/media URLs | AEM Digital Asset Manager paths |
| **HTTP headers** | Dispatcher-related headers | X-Dispatcher and related reverse proxy headers |
| **Cookies** | `cq-author`, `cq-session` | AEM authoring/session cookies |
| **HTML markup** | `parsys`, `foundation/components` references | AEM component system patterns |

### BuiltWith Capabilities vs Wappalyzer

| Capability | BuiltWith | Wappalyzer |
|-----------|-----------|------------|
| Version detection | Partial (major versions) | None for AEM |
| Cloud vs on-prem differentiation | Not confirmed publicly | No |
| Historical tracking | Yes (technology changes over time) | No |
| Confidence/accuracy claims | Not published | ~94-95% overall |
| Market share data | Yes | Yes |
| Cost | Commercial (paid API) | Freemium + open source |

### BuiltWith Tracking Page

BuiltWith maintains an AEM tracking list at `trends.builtwith.com/websitelist/Adobe-Experience-Manager` with site-by-site data.

---

## 3. WhatRuns

### Detection Methodology

WhatRuns is a browser extension that uses pattern recognition to identify technologies. Their approach:

- **Browser-based detection:** Runs as a Chrome/Firefox extension with access to the full DOM, JavaScript runtime, network requests, and response headers
- **Pattern recognition algorithm:** Proprietary algorithm that matches against known technology signatures
- **Detection scope:** Beyond CMS identification, also detects fonts, analytics tools, frameworks, and plugins
- **Real-time analysis:** Inspects the live page rather than just source HTML

### AEM Detection

WhatRuns detects AEM through similar clientlib patterns, HTML structure analysis, and JavaScript object detection. Having browser-level access gives them an advantage over server-side-only scanners because they can inspect:

- Runtime JavaScript objects (CQ, Granite namespaces)
- Dynamically loaded clientlibs
- DOM elements added after initial page load
- Network requests to AEM-specific endpoints

---

## 4. Netcraft

### Detection Methodology

Netcraft is a long-established internet security services company that performs large-scale web surveys. Their detection methodology includes:

| Method | Description |
|--------|-------------|
| **HTTP header analysis** | Server headers, custom headers, technology-specific headers |
| **SSL/TLS certificate inspection** | Certificate issuer, subject, SANs |
| **DNS analysis** | Name server patterns, CNAME chains, MX records |
| **HTML content analysis** | Meta tags, generator tags, framework-specific markup |
| **Cookie analysis** | Session cookie names, cookie attributes |
| **Infrastructure fingerprinting** | IP ranges, hosting providers, CDN detection |

### AEM-Specific Detection

Netcraft's `sitereport.netcraft.com` tool can identify AEM as part of its technology profiling. They likely use a combination of:

- Server response header patterns
- Content structure analysis
- Infrastructure correlation (Adobe-managed infrastructure)
- Historical site data correlation

---

## 5. Real-World AEM Detection Signals

### Comprehensive Signal Catalog

Based on research from security tools (aem-hacker), penetration testing guides (HackTricks, Pen Test Partners, Maerisec), and Adobe's own documentation.

### 5.1 HTTP Headers

| Header | Value/Pattern | Confidence | Notes |
|--------|---------------|------------|-------|
| `X-Dispatcher` | Any value (e.g., `hu1`) | High | Added by AEM Dispatcher reverse proxy |
| `X-Cache-Info` | Cache status info | Medium | Dispatcher debug header |
| `Server` | Contains `Day-Servlet-Engine` or `CQSE` | Very High | Older AEM/CQ5 versions; usually removed in production |
| `WWW-Authenticate` | Contains `Day`, `Sling`, `AEM`, `Communique`, or `Adobe` | Very High | Authentication realm reveals AEM |
| `Dispatcher` | `no-cache` | Medium | Internal dispatcher directive (sometimes leaked) |

### 5.2 Cookies

| Cookie | Description | Confidence |
|--------|-------------|------------|
| `cq-authoring-mode` | Set to `CLASSIC` or `TOUCH`; indicates AEM authoring mode | Very High |
| `login-token` | AEM authentication token | High |
| `cq-session` | AEM session cookie | Very High |
| `cq-author` | Indicates AEM author instance access | Very High |
| `JSESSIONID` | Generic Java session (weak signal alone) | Low |

### 5.3 HTML Patterns

| Pattern | What It Indicates | Confidence |
|---------|-------------------|------------|
| `class="parbase"` or `class="...parbase..."` | AEM paragraph base component | High |
| `data-component-path="...jcr:"` | JCR content repository reference | Very High |
| `class="aem-Grid"` or `class="aem-GridColumn"` | AEM responsive grid system | Very High |
| `<!--/* CQ */-->` | AEM/CQ HTML comment | Very High |
| `/etc.clientlibs/` in script/link tags | AEM proxy clientlib path | Very High |
| `/etc/clientlibs/` in script/link tags | AEM classic clientlib path | Very High |
| `/etc/designs/` in script/link tags | AEM design path | High |
| `/content/dam/` in img/media URLs | AEM Digital Asset Manager | High |
| `data-cq-component` attributes | AEM component markers | Very High |
| `data-sly-` attributes (Sightly/HTL) | AEM HTL templating language | Very High |
| `parsys` in class names | AEM paragraph system | High |

### 5.4 JavaScript Variables and Objects

| Variable/Object | Description | Confidence |
|----------------|-------------|------------|
| `CQ` | AEM/CQ5 global namespace | Very High |
| `CQ.WCM` | Web Content Management object (null in publish mode) | Very High (author) |
| `CQ.WCM.isEditMode()` | Authoring mode check | Very High (author) |
| `Granite` | AEM Granite UI namespace | Very High |
| `granite.resource` | Granite resource API | Very High |
| `adobeDataLayer` | Adobe Client Data Layer | High |
| `adobeDataLayer.version` | ACDL version number | High |
| `_satellite` | Adobe Launch/DTM tag manager | Medium (not AEM-specific) |
| `hlx.RUM_MANUAL_ENHANCE` | AEM Franklin/Helix/Edge Delivery | Very High |
| `Coral` | AEM Coral UI framework | Very High (author) |

### 5.5 URL Path Patterns

| URL Pattern | Detection Use | Confidence |
|-------------|--------------|------------|
| `/content/` prefix in page URLs | AEM content structure | Medium |
| `/content/dam/` in asset URLs | AEM Digital Asset Manager | High |
| `.html` suffix on content pages | Sling resource resolution | Low (very common) |
| URLs with selectors: `.infinity.json`, `.1.json` | Sling JSON rendering | Very High |
| `/etc.clientlibs/` | Proxy clientlib serving | Very High |
| `/libs/` in resource paths | AEM library path | High |
| `/apps/` in resource paths | AEM application path | High |

### 5.6 Meta Tags

AEM rarely sets a `<meta name="generator">` tag by default, unlike WordPress or Drupal. However:

| Meta Tag | Pattern | Confidence |
|----------|---------|------------|
| `generator` | Rarely set by AEM | N/A |
| `viewport` | Not AEM-specific | N/A |
| Custom meta tags | May reference AEM-specific content paths | Low |

---

## 6. AEM-Specific URL Probes

### From the aem-hacker Tool (aem_discoverer.py)

The `aem-hacker` tool by 0ang3el is the most comprehensive AEM detection tool available. It uses the following probe categories:

### 6.1 Login Page Detection

| Endpoint | Expected Response | Safety |
|----------|-------------------|--------|
| `/libs/granite/core/content/login.html` | 200 + "Welcome to Adobe Experience Manager" | Safe (GET only) |

### 6.2 CSRF Token Detection

| Endpoint | Expected Response | Safety |
|----------|-------------------|--------|
| `/libs/granite/csrf/token.json` | 200 + JSON with `"token"` field | Safe (GET only) |

### 6.3 Geometrixx Sample Content

| Endpoint | Expected Response | Safety |
|----------|-------------------|--------|
| `/content/geometrixx/en.html` | 200 + "Geometrixx has been selling" | Safe (GET, only on demo instances) |

### 6.4 DefaultGetServlet / JCR Node Access

Probes the following base paths with multiple extension combinations:

**Base paths:** `/`, `/content`, `/content/dam`, `/bin`, `/etc`, `/var`

**Extensions tried:**
```
.json, .1.json, .childrenlist.json, .childrenlist.html, .ext.json,
.children.json, ...4.2.1...json
```

**Dispatcher bypass extensions:**
```
.json/a.css, .json/a.html, .json/a.png, .json/a.ico,
.json;%0aa.css, .json;%0aa.html, .json;%0aa.png, .json;%0aa.ico,
.json?a.css, .json?a.ico, .json?a.html
```

**Success indicators:**
- `"jcr:primaryType":` in response body
- `data-coral-columnview-path` in response body
- Valid JSON with `jcr:primaryType` key
- Valid JSON with `parent.resourceType` key
- Valid JSON array with `type` key in first element

**Safety:** GET requests only; revealing but not modifying.

### 6.5 Authentication Realm Detection (/bin/receive)

**Paths:** `/bin/receive{ext}?sling:authRequestLogin=1`

**Extensions:** `.css`, `.html`, `.js`, `.ico`, `.png`, `.gif`, `.1.json`, `...4.2.1...json`

**Success indicator:** HTTP 401 with `WWW-Authenticate` header containing any of: `day`, `sling`, `aem`, `communique`, `adobe`

**Safety:** Safe GET request that triggers authentication challenge.

### 6.6 Login Status Servlet

**Paths:** `/system/sling/loginstatus{ext}`, `///system///sling///loginstatus{ext}`

**Success indicator:** 200 + `authenticated=` in response body

**Safety:** Safe GET request.

### 6.7 CRX/DE Detection

**Paths:**
```
/crx/de/index.jsp
/crx/explorer/browser/index.jsp
/crx/packmgr/index.jsp
```

**With bypass extensions:** `;%0aa.css`, `;%0aa.html`, `?a.css`, `/a.html`, etc.

**Success indicators:** `CRXDE Lite`, `Content Explorer`, or `CRX Package Manager` in response

**Safety:** Safe GET request; indicates serious misconfiguration if accessible.

### 6.8 ClientLib/CSS/JS Detection

**Known AEM clientlib paths:**
```
/etc/clientlibs/wcm/foundation/main.css
/etc/clientlibs/social/connect.js
/etc/clientlibs/foundation/main.css
/etc/clientlibs/mobile/user.js
/etc/clientlibs/screens/player/bootloader/js/bootloader.js
/system/sling.js
```

**Success indicators:** `ADOBE CONFIDENTIAL` or `JCR repository` in response content

**Safety:** Safe GET request.

### 6.9 GQL Search Servlet

**Path:** `/bin/wcm/search/gql.servlet.json?query=type:base%20limit:..1&pathPrefix=`

**Success indicator:** JSON response with `hits` key

**Safety:** Safe GET request; read-only search.

### 6.10 Siren API

**Path:** `/api/content.json` (with various bypass extensions)

**Success indicator:** 200 + `"links":` in response

**Safety:** Safe GET request.

### 6.11 Additional Detection Endpoints (from HackTricks)

| Endpoint | Purpose | Expected Result |
|----------|---------|-----------------|
| `/system/console/status-productinfo` | Product version info | Version string (if accessible) |
| `/system/console/bundles` | OSGi bundle listing | Bundle versions and states |
| `/libs/cq/AuditlogSearchServlet.json` | Audit log access | Audit data |
| `/libs/cq/ui/content/dumplibs.html` | ClientLibs dump | Full clientlib listing |
| `/adminui/debug` | Forms OGNL evaluator | Debug interface |
| `/etc/groovyconsole/**` | Groovy script execution | Console interface |

### 6.12 Summary: Status Code Interpretation

| Status Code | At AEM-Specific Endpoint | Interpretation |
|-------------|--------------------------|----------------|
| 200 | /libs/granite/core/content/login.html | Confirmed AEM |
| 200 | /.json | Likely AEM (JSON rendering of JCR root) |
| 200 | /etc.clientlibs/ | Likely AEM |
| 302 | /libs/granite/core/content/login.html | Possibly AEM (redirect to custom login) |
| 401 | /bin/receive with AEM WWW-Authenticate | Confirmed AEM |
| 403 | /crx/de/index.jsp | Possibly AEM (blocked but path exists) |
| 404 | All AEM-specific paths | Probably not AEM |
| 503 | With X-Dispatcher header | AEM behind dispatcher |

### 6.13 Which Probes Are Safe/Ethical

**Safe (read-only GET requests):**
- Login page check (`/libs/granite/core/content/login.html`)
- CSRF token endpoint (`/libs/granite/csrf/token.json`)
- Static clientlib requests (`/etc.clientlibs/...`)
- JSON rendering of public content (`/content/...json`)
- Login status (`/system/sling/loginstatus`)

**Caution needed (may trigger security alerts):**
- Multiple rapid requests to administrative paths
- Dispatcher bypass attempts (semicolon/encoded paths)
- System console access attempts (`/system/console/`)
- CRX/CRXDE access attempts (`/crx/de/`)

**Avoid (active exploitation territory):**
- POST requests to any path
- QueryBuilder with user enumeration queries
- Package manager upload attempts
- Any write operations

---

## 7. DNS-Based Detection

### 7.1 AEM Cloud Service CNAME Patterns

AEM as a Cloud Service uses predictable DNS patterns:

| DNS Record | Pattern | Description |
|-----------|---------|-------------|
| **CNAME** | `cdn.adobeaemcloud.com` | Standard AEM Cloud Service CDN endpoint |
| **Default domain** | `*.adobeaemcloud.com` | Default domain before custom domain setup |
| **TXT record** | Adobe domain verification TXT records | Used during custom domain setup |

**Detection approach:**
1. Perform DNS lookup (CNAME) on the target domain
2. Check if CNAME chain resolves to `cdn.adobeaemcloud.com` or `*.adobeaemcloud.com`
3. If yes: confirmed AEM Cloud Service

### 7.2 AEM Edge Delivery Services DNS

| Pattern | Description |
|---------|-------------|
| `*.aem.live` | AEM Edge Delivery default domain |
| `*.hlx.live` | AEM Franklin/Helix default domain |
| `*.hlx.page` | AEM Franklin/Helix preview domain |

### 7.3 AEM Managed Services / On-Premises

On-premises and Managed Services AEM do not have predictable DNS patterns since customers use their own infrastructure. Detection must rely on HTTP-level signals.

### 7.4 DNS Lookup Tools/APIs

| Tool/API | Description |
|----------|-------------|
| `dig` (CLI) | Standard DNS query tool |
| `nslookup` (CLI) | Cross-platform DNS lookup |
| Google DNS-over-HTTPS API | `dns.google/resolve?name=example.com&type=CNAME` |
| Cloudflare DNS-over-HTTPS | `cloudflare-dns.com/dns-query` |
| `dns.resolve()` (Node.js) | Programmatic DNS resolution |
| `whois` data | Domain registration details |

### 7.5 Detection Before HTTP Request

Yes, DNS-based detection can determine AEM Cloud Service usage before making any HTTP request:

```bash
# Check if domain points to AEM Cloud Service
dig +short CNAME example.com
# If returns: *.cdn.adobeaemcloud.com -> confirmed AEM Cloud Service

# Full CNAME chain resolution
dig +trace CNAME example.com

# Check for Edge Delivery
dig +short CNAME example.com
# If returns: *.aem.live or *.hlx.live -> confirmed Edge Delivery
```

---

## 8. Certificate-Based Detection

### 8.1 AEM Cloud Service Certificate Patterns

| Signal | Pattern | Description |
|--------|---------|-------------|
| **Adobe-managed DV cert** | Domain Validation cert provisioned by Adobe | Default for AEM Cloud Service |
| **Certificate issuer** | Let's Encrypt (common for DV), DigiCert (common for OV/EV) | Not AEM-specific alone |
| **SAN entries** | May include `*.adobeaemcloud.com` alongside custom domain | Strong AEM indicator |
| **Customer-managed OV/EV** | Customer-provided cert uploaded to Cloud Manager | No Adobe-specific pattern |

### 8.2 Certificate Detection Approach

```bash
# Check SSL certificate for AEM indicators
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -text | grep -i "adobe\|aem\|adobeaemcloud"

# Check Subject Alternative Names
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -ext subjectAltName
```

### 8.3 Reliability Assessment

Certificate-based detection is **low reliability** for AEM identification because:
- Customers typically use their own certificates
- Adobe-managed DV certificates don't visibly contain "Adobe" in the issuer
- The certificate issuer (Let's Encrypt, DigiCert) is not unique to AEM
- SAN entries usually only show the custom domain, not adobeaemcloud.com

Certificate analysis is best used as a **supplementary signal** rather than a primary detection method.

---

## 9. Comparison with Other CMS Detection Rules

### 9.1 WordPress Detection (Wappalyzer)

WordPress has the most comprehensive detection rules of any CMS in Wappalyzer:

```json
{
  "WordPress": {
    "headers": {
      "X-Pingback": "/xmlrpc\\.php$",
      "link": "rel=\"https://api\\.w\\.org/\""
    },
    "html": [
      "<link rel=[\"']stylesheet[\"'] [^>]+/wp-(?:content|includes)/",
      "<link[^>]+s\\d+\\.wp\\.com"
    ],
    "dom": [
      "div[class*='wp-block-group'] > div[class*='wp-block-']",
      "link[rel=stylesheet][href*='/wp-content/']",
      "link[rel=stylesheet][href*='/wp-includes/']",
      "link[href*='.wp.com']"
    ],
    "js": {
      "wp.ajax": "",
      "wp.receiveEmbedMessage": "",
      "wp_username": "",
      "wpb_prepare_tab_content": ""
    },
    "meta": {
      "generator": "^WordPress(?: ([\\d.]+))?\\;version:\\1"
    },
    "scriptSrc": [
      "/wp-(?:content|includes)/",
      "wp-embed\\.min\\.js"
    ],
    "implies": ["PHP", "MySQL"]
  }
}
```

**Lessons for AEM detection:**
- WordPress uses **7 different signal types** (headers, html, dom, js, meta, scriptSrc, implies)
- WordPress has **version extraction** via meta generator tag
- WordPress checks both **headers** and **content**
- Multiple patterns provide **redundancy** for different site configurations

### 9.2 Drupal Detection (Wappalyzer)

```json
{
  "Drupal": {
    "cookies": {
      "SESS[a-f0-9]{32}": ""
    },
    "headers": {
      "Expires": "19 Nov 1978",
      "X-Drupal-Cache": "",
      "X-Generator": "^Drupal(?:\\s([\\d.]+))?\\;version:\\1"
    },
    "html": [
      "<(?:link|style)[^>]+\"/sites/(?:default|all)/(?:themes|modules)/"
    ],
    "dom": [
      "link[href*='/sites/default/themes/'], ..."
    ],
    "js": { "Drupal": "" },
    "meta": {
      "generator": "^Drupal(?:\\s([\\d.]+))?\\;version:\\1"
    },
    "scriptSrc": ["drupal\\.js"]
  }
}
```

**Lessons for AEM detection:**
- Drupal uses a **unique cookie pattern** (session ID with hex hash) -- AEM could use `cq-authoring-mode`
- Drupal checks the famous **"Expires: 19 Nov 1978"** header (Dries Buytaert's birthday) -- unique constant values are highly reliable
- Drupal has **custom response headers** (`X-Drupal-Cache`, `X-Generator`) -- AEM has `X-Dispatcher`
- Drupal extracts **version from both headers and meta tags**

### 9.3 Sitecore Detection (Wappalyzer)

```json
{
  "Sitecore": {
    "cookies": {
      "SC_ANALYTICS_GLOBAL_COOKIE": "",
      "SC_OS_SessionId": "",
      "sc_expview": "",
      "sxa_site": ""
    },
    "dom": [
      "link[href*='/_sitecore/']",
      "img[src^='/-/media/']",
      "img[src*='/~/media/.+\\.ashx']"
    ],
    "headers": {
      "Content-Security-Policy": "\\.sitecore\\.com"
    },
    "js": { "SitecoreUtilities": "" },
    "probe": {
      "/layouts/System/VisitorIdentification.aspx": "sc_Contact"
    },
    "implies": ["Microsoft ASP.NET"]
  }
}
```

**Lessons for AEM detection:**
- Sitecore uses **4 cookie patterns** -- AEM should check multiple cookies
- Sitecore uses a **probe** endpoint -- AEM could probe `/libs/granite/core/content/login.html`
- Sitecore checks **CSP headers** for domain patterns -- AEM could check for `.scene7.com` or `.adobeaemcloud.com`
- Sitecore checks **asset URL patterns** (`/-/media/`) -- AEM could check `/content/dam/`

### 9.4 Detection Depth Comparison

| Feature | WordPress | Drupal | Sitecore | AEM (current) | AEM (proposed) |
|---------|-----------|--------|----------|----------------|----------------|
| Header checks | 2 | 3 | 1 | 0 | 3+ |
| Cookie checks | 0 | 1 | 4 | 0 | 4+ |
| HTML patterns | 2 | 1 | 0 | 3 | 5+ |
| DOM selectors | 4 | 1 | 3 | 1 | 5+ |
| JS variables | 4 | 1 | 1 | 0 | 5+ |
| Meta tags | 1 | 1 | 0 | 0 | 0 |
| Script sources | 2 | 1 | 0 | 3 | 4+ |
| URL patterns | 0 | 0 | 0 | 0 | 2+ |
| DNS checks | 0 | 0 | 0 | 0 | 3+ |
| Cert checks | 0 | 0 | 0 | 0 | 1+ |
| Probe endpoints | 0 | 0 | 1 | 0 | 3+ |
| Version detection | Yes | Yes | No | No | Yes |
| **Total signals** | **15** | **10** | **10** | **7** | **40+** |

---

## 10. Recommendations for Our Implementation

### 10.1 Detection Tier Strategy

We should implement a tiered detection approach, ordered from least to most intrusive:

#### Tier 1: Passive / Zero-Request Detection

These can be done before or without HTTP requests:

| Check | Signal | Confidence |
|-------|--------|------------|
| DNS CNAME lookup | `cdn.adobeaemcloud.com` | Very High (Cloud Service) |
| DNS CNAME lookup | `*.aem.live` / `*.hlx.live` | Very High (Edge Delivery) |
| Certificate SAN inspection | `adobeaemcloud.com` in SANs | High (Cloud Service) |

#### Tier 2: Single-Page Analysis (from normal page load)

These use only data from loading the homepage:

| Check | Signal | Confidence Weight |
|-------|--------|-------------------|
| HTML: `class="parbase"` | AEM component system | 25 |
| HTML: `data-component-path="...jcr:"` | JCR references | 30 |
| HTML: `class="aem-Grid"` | AEM grid system | 30 |
| HTML: `<!--/* CQ */-->` | CQ comment marker | 35 |
| HTML: `data-sly-` attributes | HTL templating | 30 |
| Script src: `/etc.clientlibs/` | Proxy clientlibs | 30 |
| Script src: `/etc/clientlibs/` | Classic clientlibs | 25 |
| Script src: `/etc/designs/` | Design clientlibs | 20 |
| Script content: `aem-GridColumn` / `AEMMode` | AEM-specific JS | 25 |
| Asset URLs: `/content/dam/` | DAM paths | 20 |
| Headers: `X-Dispatcher` present | AEM Dispatcher | 25 |
| Headers: `WWW-Authenticate` contains AEM terms | Auth realm | 40 |
| Cookies: `cq-authoring-mode` | Authoring cookie | 40 |
| Cookies: `cq-session` or `login-token` | Session cookies | 35 |
| JS globals: `CQ` namespace | CQ object | 35 |
| JS globals: `Granite` namespace | Granite UI | 35 |
| JS globals: `Coral` namespace | Coral UI | 30 |
| JS globals: `adobeDataLayer` | ACDL presence | 15 |
| JS globals: `hlx.RUM_MANUAL_ENHANCE` | Edge Delivery | 40 |

**Threshold:** Report AEM if combined confidence >= 50

#### Tier 3: Targeted Safe Probes (additional requests)

| Probe | Expected Response | Confidence |
|-------|-------------------|------------|
| GET `/libs/granite/core/content/login.html` | 200 + "Adobe Experience Manager" | 50 |
| GET `/libs/granite/csrf/token.json` | 200 + JSON with `"token"` | 40 |
| GET `/system/sling/loginstatus.json` | 200 + `authenticated=` | 45 |
| GET `/etc.clientlibs/` | 200 or 403 (vs 404 for non-AEM) | 20 |
| GET `/.json` | 200 + `jcr:primaryType` in JSON | 45 |

#### Tier 4: Version Detection

| Method | Signal | Version Identified |
|--------|--------|-------------------|
| `/system/console/status-productinfo` | Version string in response | Exact version (if accessible) |
| ClientLib paths containing version numbers | `/etc.clientlibs/.../clientlib-site.lc-HASH.min.js` | Build hash (not version directly) |
| Known AEM clientlib file presence | `/etc/clientlibs/wcm/foundation/main.css` | Indicates AEM 6.x classic UI |
| Coral UI version | Coral 3 = AEM 6.3+, Coral 2 = AEM 6.0-6.2 | Major version range |
| HTL/Sightly usage | `data-sly-*` attributes = AEM 6.0+ | Minimum version |
| Edge Delivery scripts | `scripts/aem.js` | AEM Cloud (Edge Delivery) |
| Franklin scripts | `scripts/lib-franklin.js` | AEM Cloud (Franklin) |
| Grid system classes | `aem-Grid` = AEM 6.3+ responsive grid | Minimum version |
| AEM Cloud indicators | CNAME to `adobeaemcloud.com` | AEM as a Cloud Service |

#### Tier 5: Deployment Type Detection

| Signal | Deployment Type |
|--------|----------------|
| CNAME to `cdn.adobeaemcloud.com` | AEM as a Cloud Service |
| CNAME to `*.aem.live` / `*.hlx.live` | AEM Edge Delivery Services |
| No Adobe CNAME + AEM detected | On-Premises or Managed Services |
| Adobe-managed DV certificate | Likely Cloud Service |
| Customer infrastructure (AWS, Azure, etc.) + AEM detected | Likely Managed Services or On-Prem |

### 10.2 Confidence Scoring Algorithm

```
totalConfidence = 0
signals = []

for each check in [Tier1, Tier2, Tier3]:
    if check.matches:
        totalConfidence += check.confidenceWeight
        signals.append(check)

# Cap at 100
totalConfidence = min(totalConfidence, 100)

# Classification
if totalConfidence >= 80: result = "Confirmed AEM"
elif totalConfidence >= 50: result = "Likely AEM"
elif totalConfidence >= 25: result = "Possibly AEM"
else: result = "Not detected as AEM"
```

### 10.3 Version Confidence Matrix

| Evidence | Version Range | Confidence |
|----------|--------------|------------|
| `/system/console/status-productinfo` accessible | Exact version (e.g., 6.5.21.0) | 100% |
| Cloud CNAME + Cloud-specific headers | AEM as a Cloud Service | 95% |
| Edge Delivery scripts detected | AEM Edge Delivery Services | 95% |
| Coral UI 3 + HTL + responsive grid | AEM 6.3+ | 80% |
| Classic UI clientlibs only | AEM 6.0-6.2 | 70% |
| CQ5 patterns (CQ namespace, older paths) | CQ 5.x / AEM 5.x | 75% |
| No version-specific signals | "AEM (version unknown)" | N/A |

### 10.4 Improvement Opportunities Over Existing Tools

| Gap in Existing Tools | Our Improvement |
|-----------------------|-----------------|
| No DNS-level detection | CNAME chain analysis for Cloud Service and Edge Delivery |
| No version detection for AEM | Multi-signal version inference engine |
| No cloud vs on-prem differentiation | Deployment type classification |
| No confidence scoring (Wappalyzer AEM) | Weighted multi-signal confidence scoring |
| Limited header checks | Full dispatcher/CDN header analysis |
| No cookie checks | cq-authoring-mode, login-token, cq-session |
| No JS global checks | CQ, Granite, Coral, adobeDataLayer namespaces |
| No probe endpoints | Login page, CSRF token, loginstatus |
| No related technology correlation | Adobe Analytics, Target, Audience Manager co-detection |
| Binary yes/no detection | Granular confidence with signal breakdown |
| No Edge Delivery detection | Franklin/Helix/aem.js script detection |
| No historical/temporal analysis | Track detection signals over time for accuracy improvement |

### 10.5 Ethical Considerations

Our detection approach should:

1. **Use only safe GET requests** -- never POST, PUT, DELETE
2. **Respect robots.txt** -- check before probing
3. **Rate limit** -- no more than 5-10 requests per second to any single host
4. **Minimize probe endpoints** -- use Tier 1 and 2 first; only use Tier 3 if needed
5. **Avoid dispatcher bypass techniques** -- these are penetration testing tactics, not detection
6. **Document all probes** -- full transparency about what URLs we request
7. **Provide opt-out** -- allow sites to signal they don't want to be profiled

---

## Appendix A: Complete AEM Detection URL Reference

### Detection-Safe URLs (GET only, read-only, non-invasive)

```
/libs/granite/core/content/login.html
/libs/granite/csrf/token.json
/system/sling/loginstatus.json
/etc.clientlibs/
/etc/clientlibs/wcm/foundation/main.css
/etc/clientlibs/foundation/main.css
/content/geometrixx/en.html
/.json
/content.json
/api/content.json
```

### Administrative URLs (may trigger security alerts)

```
/system/console/status-productinfo
/system/console/bundles
/crx/de/index.jsp
/crx/explorer/browser/index.jsp
/crx/packmgr/index.jsp
/bin/querybuilder.json
/bin/wcm/search/gql.servlet.json
/etc/groovyconsole/
/adminui/debug
/libs/cq/AuditlogSearchServlet.json
/libs/cq/ui/content/dumplibs.html
```

## Appendix B: DNS Detection Commands

```bash
# AEM Cloud Service detection
dig +short CNAME example.com
# Look for: cdn.adobeaemcloud.com or *.adobeaemcloud.com

# Edge Delivery Services detection
dig +short CNAME example.com
# Look for: *.aem.live, *.hlx.live, *.hlx.page

# Full chain resolution
dig +trace example.com

# Node.js programmatic approach
# dns.resolveCname('example.com', callback)
```

## Appendix C: Key Source References

- Wappalyzer/WebAppAnalyzer technology definitions: `github.com/enthec/webappanalyzer`
- Wappalyzer specification: `docs.wappalyzer.com/dev/specification.html`
- aem-hacker detection tool: `github.com/0ang3el/aem-hacker`
- aemscan vulnerability scanner: `github.com/Raz0r/aemscan`
- HackTricks AEM guide: `hacktricks.wiki/en/network-services-pentesting/pentesting-web/aem-adobe-experience-cloud.html`
- Pen Test Partners AEM guide: `pentestpartners.com/security-blog/quick-wins-with-adobe-experience-manager/`
- Maerisec AEM pentesting guide: `maerisec.eu/posts/pentesting-aem/`
- Adobe Experience League - Custom Domain Names: `experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/custom-domain-names/introduction`
- Adobe Experience League - SSL Certificates: `experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/manage-ssl-certificates/introduction-to-ssl-certificates`
- Adobe Dispatcher Configuration: `experienceleague.adobe.com/en/docs/experience-manager-dispatcher/using/configuring/dispatcher-configuration`
- AEM Request/Response Headers Analysis: `techrevel.blog/2023/09/05/exploring-aem-request-and-response-headers-analysis-of-browser-cdn-and-dispatcher/`
- BuiltWith AEM tracking: `trends.builtwith.com/websitelist/Adobe-Experience-Manager`
- WhatRuns: `whatruns.com`
- Netcraft Site Report: `sitereport.netcraft.com`
- WhatCMS: `whatcms.org`
