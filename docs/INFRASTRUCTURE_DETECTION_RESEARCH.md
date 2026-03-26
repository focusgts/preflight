# Infrastructure-Level AEM Detection Research

## Research Date: 2026-03-26

## Table of Contents

1. [AEM Cloud Service Infrastructure](#1-aem-cloud-service-infrastructure)
2. [AEM Managed Services Infrastructure](#2-aem-managed-services-infrastructure)
3. [AEM On-Prem Common Patterns](#3-aem-on-prem-common-patterns)
4. [DNS Lookup Approaches](#4-dns-lookup-approaches)
5. [SSL Certificate Analysis](#5-ssl-certificate-analysis)
6. [Existing AEM Site Databases](#6-existing-aem-site-databases)
7. [Ethical and Legal Considerations](#7-ethical-and-legal-considerations)
8. [Multi-Signal Detection Strategy](#8-multi-signal-detection-strategy)
9. [Implementation Recommendations](#9-implementation-recommendations)

---

## 1. AEM Cloud Service Infrastructure

### 1.1 CDN: Fastly (Default, Always-On)

AEM as a Cloud Service uses **Fastly CDN** as its default and mandatory content delivery network. It cannot be removed, though customers can layer their own CDN ("BYOCDN") in front of it.

#### Fastly-Specific Response Headers

Fastly appends the following headers to all responses by default. These are the strongest network-level signals for identifying a Fastly-backed AEM Cloud Service site:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `x-served-by` | Identity of the cache server(s) that handled the request. Shield POP appears first, edge POP second. | `cache-iad2127-IAD, cache-jfk8100-JFK` |
| `x-cache` | Whether the response was a cache HIT or MISS. Derived from `fastly_info.state`. | `HIT`, `MISS` |
| `x-cache-hits` | Number of cache hits on the serving node. Per-cache-server, not per-datacenter. | `3`, `0` |
| `x-timer` | Fastly timing information with timestamps and duration codes. | `S1542130425.787081,VS0,VE95` |
| `via` | Standard HTTP hop indicator. Fastly sets this to `1.1 varnish`. | `1.1 varnish, 1.1 varnish` |
| `x-fastly-request-id` | Unique request identifier assigned by Fastly. | `a1b2c3d4e5f6...` |
| `age` | Seconds since the object was stored in the cache. | `120` |

**Detection Logic**: The combination of `via: 1.1 varnish` + `x-served-by` containing cache node identifiers + `x-cache` is a near-certain indicator of Fastly CDN.

#### Surrogate-Control Header

Fastly uses the `Surrogate-Control` header (Fastly-specific, stripped before reaching the client) internally for cache control. This header is not visible to external scanners but is worth noting for completeness.

### 1.2 CNAME Patterns: adobeaemcloud.com

AEM Cloud Service sites using the **Adobe Managed CDN** create DNS CNAME records pointing to:

```
cdn.adobeaemcloud.com
```

The internal origin domains follow a predictable pattern:

```
publish-p<PROGRAM_ID>-e<ENV_ID>.adobeaemcloud.com
```

Where:
- `<PROGRAM_ID>` is the Cloud Manager program numeric ID
- `<ENV_ID>` is the environment numeric ID

**Examples**:
- `publish-p12345-e67890.adobeaemcloud.com` (publish tier)
- `author-p12345-e67890.adobeaemcloud.com` (author tier)

**Detection Logic**: A DNS CNAME lookup resolving to `*.adobeaemcloud.com` or `cdn.adobeaemcloud.com` is a definitive indicator of AEM Cloud Service with Adobe Managed CDN.

When customers use BYOCDN (e.g., Akamai, Cloudflare, AWS CloudFront), the CNAME will point to their CDN, not directly to `adobeaemcloud.com`. However, the CDN's origin will be configured to `publish-p<ID>-e<ID>.adobeaemcloud.com`.

### 1.3 Adobe ASN and IP Ranges

Adobe operates under at least two Autonomous System Numbers:

| ASN | Description | Notes |
|-----|-------------|-------|
| AS15224 | Adobe Inc. | 655 domain names, 66 IP addresses |
| AS14365 | Adobe Systems Inc. | Legacy/additional range |

**Important**: AEM Cloud Service runs on Microsoft Azure infrastructure, so resolved IPs will typically belong to Azure (Microsoft ASN), not Adobe ASNs. The Adobe ASNs are more relevant for Adobe's own corporate infrastructure and some legacy hosting.

AEM Cloud Service IP ranges are **dynamic** and not published by Adobe for whitelisting purposes. Adobe instead provides dedicated egress IP addresses through Advanced Networking features for outbound connections.

### 1.4 SSL Certificates

AEM Cloud Service supports:
- **DV (Domain Validation)** certificates - most common
- **EV/OV (Extended/Organization Validation)** certificates
- **Single domain, SAN, and wildcard** certificates

Certificates are managed through Cloud Manager. When using Adobe Managed CDN:
- The certificate is typically issued by a public CA (e.g., Let's Encrypt for DV, or DigiCert for OV/EV)
- The `*.adobeaemcloud.com` default domains use Adobe-managed certificates
- Custom domains use customer-provided certificates uploaded to Cloud Manager

**Detection Logic**: There is no single certificate issuer that definitively identifies AEM Cloud Service. However, if the certificate's SAN includes `*.adobeaemcloud.com` entries alongside custom domains, that is a strong indicator.

### 1.5 AEM Cloud Service Request Headers

When a customer uses BYOCDN with AEM Cloud Service, certain headers are required in the configuration:

| Header | Purpose |
|--------|---------|
| `X-Forwarded-Host` | Domain name for AEM host header resolution |
| `X-AEM-Edge-Key` | Unique key for Adobe CDN to validate BYOCDN requests |
| `Host` | Set to `publish-p<ID>-e<ID>.adobeaemcloud.com` |

The `X-AEM-Edge-Key` is not visible in external responses, but its presence in configuration indicates AEM Cloud Service architecture.

---

## 2. AEM Managed Services (AMS) Infrastructure

### 2.1 Hosting: AWS (Amazon Web Services)

AEM Managed Services is Adobe's hosting offering for "classic" AEM 6.5. It runs on **Amazon Web Services (AWS)** infrastructure, with Adobe managing the entire stack.

**Key Differences from Cloud Service**:
- Fixed environment sizes (no autoscaling)
- Traditional AEM architecture: Author > Publisher > Dispatcher
- Apache/Dispatcher runs as a separate layer
- No mandatory Fastly CDN

### 2.2 CDN Options

AMS customers have flexibility in CDN choice:
- **No default CDN** is forced (unlike Cloud Service's mandatory Fastly)
- Common choices include Akamai, Cloudflare, AWS CloudFront, or Fastly (self-configured)
- Some AMS customers use no CDN at all (just Dispatcher caching)

### 2.3 AMS-Specific Signals

| Signal | Description | Confidence |
|--------|-------------|------------|
| `x-aem-host` containing "ams" | The `x-aem-host` header sometimes contains AMS-related values | High |
| AWS IP ranges | IPs resolving to AWS ranges may indicate AMS | Low (many things run on AWS) |
| Apache/Dispatcher headers | Standard AEM Dispatcher response headers | Medium |
| AEM 6.5 version indicators + AWS hosting | Combination signal | Medium-High |

### 2.4 Dispatcher Configuration (AMS vs Cloud Service)

The AMS Dispatcher configuration is similar to Cloud Service but with fewer restrictions:
- AMS allows `Listen` and `LogLevel` directives that Cloud Service restricts
- AMS allows `/glob`-based filter rules that Cloud Service blocks for security
- AMS Dispatcher is a standalone Apache module; Cloud Service embeds it differently

---

## 3. AEM On-Prem Common Patterns

### 3.1 Infrastructure Variety

On-premise AEM deployments have the most diverse infrastructure footprint because organizations choose their own hosting, CDN, and configuration:

- **Hosting**: Any data center or cloud provider (AWS, Azure, GCP, on-prem bare metal)
- **Web Server**: Almost always Apache HTTP Server with the Dispatcher module
- **CDN**: Customer choice (Akamai, Cloudflare, Fastly, AWS CloudFront, or none)

### 3.2 Apache Dispatcher Signatures

The AEM Dispatcher is an Apache HTTP Server module. When not explicitly stripped, it leaks the following headers:

| Header | Value/Pattern | Weight |
|--------|---------------|--------|
| `server` | `Apache` or `Apache/2.x.x` | Low (generic) |
| `x-dispatcher` | Dispatcher version or instance name | High |
| `x-vhost` | Virtual host name from Dispatcher config | Medium |
| `x-dispatcher-info` | Cache diagnostic info (if debug headers are enabled) | High |
| `x-cache-info` | Readable cache status (hit/miss/not-cacheable) | Medium |

**Important**: Security-conscious deployments strip these headers. The 3Share blog on AEM security specifically recommends disabling or obfuscating all headers that disclose technology information.

### 3.3 CDN-Specific Detection Patterns

#### Akamai (Most Common Enterprise CDN for AEM On-Prem)

| Header | Description |
|--------|-------------|
| `server: AkamaiGHost` | Server header reveals Akamai |
| `x-akamai-transformed` | Indicates Akamai content transformation |
| `x-akamai-staging` | Present on staging network |
| `x-akamai-request-id` | Unique request identifier |
| CNAME to `*.akamaized.net` or `*.edgekey.net` | DNS resolution reveals Akamai |

#### Cloudflare

| Header | Description |
|--------|-------------|
| `server: cloudflare` | Server header reveals Cloudflare |
| `cf-ray` | Unique ray ID per request (e.g., `7a1b2c3d4e5f-IAD`) |
| `cf-cache-status` | Cache status: HIT, MISS, DYNAMIC, etc. |
| CNAME to `*.cdn.cloudflare.net` | DNS resolution reveals Cloudflare |

#### AWS CloudFront

| Header | Description |
|--------|-------------|
| `x-amz-cf-id` | CloudFront request ID |
| `x-amz-cf-pop` | Edge location identifier |
| `via: ... CloudFront` | Via header mentions CloudFront |
| CNAME to `*.cloudfront.net` | DNS resolution reveals CloudFront |

---

## 4. DNS Lookup Approaches

### 4.1 CNAME Chain Analysis

DNS CNAME resolution is the single most reliable passive detection method for distinguishing AEM deployment types. It requires zero contact with the target web server.

**Expected CNAME chains by deployment type**:

```
AEM Cloud Service (Adobe Managed CDN):
  www.example.com
    -> cdn.adobeaemcloud.com
    -> [Fastly edge nodes]

AEM Cloud Service (BYOCDN with Akamai):
  www.example.com
    -> www.example.com.edgekey.net
    -> [Akamai edge nodes]
  (Origin configured as publish-p<ID>-e<ID>.adobeaemcloud.com)

AEM Cloud Service (BYOCDN with Cloudflare):
  www.example.com
    -> [Cloudflare proxy - no visible CNAME]
  (Origin configured as publish-p<ID>-e<ID>.adobeaemcloud.com)

AEM Managed Services:
  www.example.com
    -> [CDN of choice, or direct to AWS ELB]
    -> [AWS infrastructure]

AEM On-Prem (with Akamai):
  www.example.com
    -> www.example.com.edgekey.net
    -> [Akamai edge]
    -> [Customer data center]

AEM On-Prem (with Cloudflare):
  www.example.com
    -> [Cloudflare proxy]
    -> [Customer data center]

AEM On-Prem (no CDN):
  www.example.com
    -> [Direct A record to customer IP]
```

### 4.2 Free DNS Lookup APIs

#### Google DNS-over-HTTPS (DoH) JSON API

**Endpoint**: `https://dns.google/resolve`

**Key Parameters**:
- `name` (required): Domain to query
- `type`: Record type (CNAME = 5, A = 1, TXT = 16)

**Example**:
```
GET https://dns.google/resolve?name=www.example.com&type=CNAME
```

**Response** (JSON):
```json
{
  "Status": 0,
  "Answer": [
    {
      "name": "www.example.com.",
      "type": 5,
      "TTL": 3600,
      "data": "cdn.adobeaemcloud.com."
    }
  ]
}
```

**Advantages**: No rate limiting for reasonable usage, CORS-friendly, no API key needed.

#### Cloudflare DNS-over-HTTPS

**Endpoint**: `https://cloudflare-dns.com/dns-query`

**Headers**: `Accept: application/dns-json`

**Example**:
```
GET https://cloudflare-dns.com/dns-query?name=www.example.com&type=CNAME
```

### 4.3 Node.js Native DNS Module

For server-side resolution in Next.js API routes:

```typescript
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolve4 = promisify(dns.resolve4);
const resolveTxt = promisify(dns.resolveTxt);

// CNAME lookup
async function getCnameChain(hostname: string): Promise<string[]> {
  const chain: string[] = [];
  let current = hostname;

  for (let i = 0; i < 10; i++) { // max 10 hops
    try {
      const cnames = await resolveCname(current);
      if (cnames.length === 0) break;
      chain.push(cnames[0]);
      current = cnames[0];
    } catch {
      break; // No CNAME record, reached terminal
    }
  }

  return chain;
}
```

**Important**: The Node.js `dns` module uses the OS resolver by default. Use `dns.setServers(['8.8.8.8', '1.1.1.1'])` to use public resolvers, or prefer the DoH API approach for API routes to avoid any server-side DNS configuration issues.

### 4.4 Recommended Approach: Google DoH from API Route

```typescript
async function dnsLookup(
  domain: string,
  type: 'CNAME' | 'A' | 'TXT' = 'CNAME'
): Promise<string[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
  });
  const data = await res.json();

  if (data.Status !== 0 || !data.Answer) return [];

  return data.Answer
    .filter((a: { type: number }) => {
      const typeMap: Record<string, number> = { CNAME: 5, A: 1, TXT: 16 };
      return a.type === typeMap[type];
    })
    .map((a: { data: string }) => a.data.replace(/\.$/, ''));
}
```

---

## 5. SSL Certificate Analysis

### 5.1 Programmatic Certificate Inspection in Node.js

Using `tls.connect()` to inspect the certificate presented during TLS handshake:

```typescript
import tls from 'tls';

interface CertInfo {
  issuer: { O?: string; CN?: string };
  subject: { CN?: string };
  subjectaltname?: string;  // Comma-separated SANs
  valid_from: string;
  valid_to: string;
}

async function inspectCertificate(hostname: string): Promise<CertInfo | null> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        resolve({
          issuer: cert.issuer,
          subject: cert.subject,
          subjectaltname: cert.subjectaltname,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
        });
      }
    );
    socket.on('error', (err) => {
      reject(err);
    });
    setTimeout(() => {
      socket.destroy();
      reject(new Error('TLS connection timeout'));
    }, 5000);
  });
}
```

### 5.2 Certificate Patterns by Deployment Type

| Deployment | Certificate Indicators |
|-----------|----------------------|
| AEM Cloud Service (Adobe CDN) | SAN may include `*.adobeaemcloud.com`; issuer varies (Let's Encrypt, DigiCert common) |
| AEM Cloud Service (BYOCDN) | Customer's own certificate; no Adobe-specific indicators |
| AEM Managed Services | Customer's own certificate; no Adobe-specific indicators |
| AEM On-Prem | Customer's own certificate; no Adobe-specific indicators |

**Verdict**: SSL certificate analysis has **limited value** for AEM detection specifically, but can confirm Fastly CDN usage (Fastly issues certificates for its shared TLS service with specific patterns) or reveal `adobeaemcloud.com` in SANs for default domain configurations.

### 5.3 Fastly TLS Indicators

When a site uses Fastly's shared TLS service, the certificate may:
- Be issued by **GlobalSign** or **Let's Encrypt** (Fastly's typical CA partners)
- Include multiple SANs for different customer domains on the same Fastly service
- Have the Fastly organization in certificate metadata for dedicated TLS

---

## 6. Existing AEM Site Databases

### 6.1 Wappalyzer

- **Data**: 43,500+ identified AEM sites with company and contact details
- **Access**: Paid API; free Chrome/Firefox extension for individual lookups
- **Detection Method**: Regex patterns matching HTML source, headers, JavaScript variables, meta tags
- **AEM Detection Rules**: Stored in `src/technologies/` as JSON with patterns for `/etc.clientlibs/`, `data-sly-`, generator meta tags, etc.
- **Limitations**: Only detects what the public page reveals; sites that strip AEM markers will be missed
- **API**: `https://api.wappalyzer.com/v2/lookup/?urls=https://example.com` (paid, ~$0.01/lookup)

### 6.2 BuiltWith

- **Data**: Tracks AEM usage across hundreds of thousands of sites
- **Access**: Paid reports; limited free lookups at builtwith.com
- **Coverage**: Tracks current and historical technology usage
- **AEM Categories**: Distinguishes "Adobe Experience Manager" as CMS
- **API**: Available for enterprise customers

### 6.3 Open Source / Free Alternatives

| Source | Description | Access |
|--------|-------------|--------|
| Wappalyzer GitHub (archived) | Detection rules JSON files | Free (open source forks at `github.com/AliasIO/wappalyzer`) |
| WebPageTest Wappalyzer | Fork maintained by Catchpoint | `github.com/WPO-Foundation/Wappalyzer` |
| Adobe Customer Case Studies | Adobe.com showcases customer stories | Free (manual scraping required) |
| Adobe Summit speakers | Companies presenting at Summit likely use AEM | Free (public speaker lists) |
| HTTPArchive | Web technology census data | Free (BigQuery access) |

### 6.4 Building a Seed Database

For bootstrapping the detection system, combine:
1. Wappalyzer's open-source detection rules (use the regex patterns, not the paid database)
2. HTTPArchive data queried via BigQuery for sites matching AEM patterns
3. Adobe's own customer stories page
4. Manual verification of Fortune 500 / Global 2000 companies (high AEM adoption in enterprise)

---

## 7. Ethical and Legal Considerations

### 7.1 Passive vs. Active Detection Spectrum

| Category | Method | Contact with Target | Risk Level |
|----------|--------|-------------------|------------|
| **Fully Passive** | DNS CNAME lookup | None | Negligible |
| **Fully Passive** | SSL certificate inspection | TLS handshake only (standard) | Negligible |
| **Passive** | HTTP header analysis from normal page load | Single GET request | Very Low |
| **Passive** | HTML content analysis from normal page load | Single GET request | Very Low |
| **Semi-Active** | Probing known-safe paths (e.g., `/libs/granite/core/content/login.html`) | Targeted requests | Low |
| **Active** | Probing admin paths (e.g., `/system/console`, `/crx/de`) | Targeted requests to sensitive endpoints | Medium |
| **Active** | Brute-force path enumeration | Many targeted requests | High |

### 7.2 Legal Analysis

**Generally Acceptable (No Authorization Needed)**:
- DNS lookups (public records)
- SSL certificate inspection (part of standard TLS)
- Single HTTP GET to the homepage (same as any web browser)
- Analyzing publicly visible response headers
- Analyzing publicly visible HTML source

**Gray Area (Caution Recommended)**:
- Requesting specific paths that are not linked from the site
- Requesting paths associated with admin interfaces
- High-volume automated scanning

**Generally Unacceptable (Authorization Required)**:
- Attempting to access `/system/console` or `/crx/de` (admin interfaces)
- Attempting to exploit any discovered vulnerabilities
- Denial-of-service-level request volumes
- Accessing content behind authentication

### 7.3 Best Practices for Our Scanner

1. **Identify ourselves**: Use a clear User-Agent string (e.g., `BlackHole-Scanner/1.0 (AEM Health Check; https://focusgts.com/scanner)`)
2. **Respect robots.txt**: Honor crawl directives for non-homepage paths
3. **Rate limit**: Maximum 3 requests per domain per scan session
4. **No admin probing**: Never request `/system/console`, `/crx/de`, `/crx/packmgr`, or similar admin endpoints on sites we do not own
5. **Passive-first**: Use DNS and header analysis before any path probing
6. **Safe paths only**: If path probing is needed, limit to paths that serve public content (e.g., `/content/dam/` structure visible in HTML, `/etc.clientlibs/` resources already referenced)
7. **Cache results**: Avoid re-scanning the same domain within 30 minutes
8. **Opt-out mechanism**: Provide a way for site owners to request exclusion

### 7.4 Rate Limiting Considerations

- Google DoH API: No published rate limit for reasonable usage; recommend max 10 queries/second
- Direct HTTP requests to target: 1 request per scan (homepage only for passive detection)
- If doing follow-up path checks: Maximum 3 total requests, spaced 1 second apart
- Total scan duration: Aim for under 10 seconds per domain

---

## 8. Multi-Signal Detection Strategy

### 8.1 Signal Taxonomy

Each signal is classified by:
- **Weight**: How strongly it indicates AEM (1-10)
- **Confidence**: How reliably the signal can be detected (1-10)
- **Passivity**: How non-intrusive the detection method is (1-10, higher = more passive)
- **Specificity**: How specifically it identifies deployment type (1-10)

### 8.2 Signal Catalog

#### Tier 1: High-Value Passive Signals (No Contact with Target)

| Signal | What It Detects | Weight | Confidence | Passivity |
|--------|----------------|--------|------------|-----------|
| CNAME to `*.adobeaemcloud.com` | AEM Cloud Service + Adobe CDN | 10 | 10 | 10 |
| CNAME to `cdn.adobeaemcloud.com` | AEM Cloud Service + Adobe CDN | 10 | 10 | 10 |

#### Tier 2: High-Value Passive Signals (Normal Page Load)

| Signal | What It Detects | Weight | Confidence | Passivity |
|--------|----------------|--------|------------|-----------|
| `x-served-by` + `via: 1.1 varnish` | Fastly CDN (likely AEM CS) | 7 | 9 | 9 |
| `x-aem-host` header | AEM (any deployment) | 10 | 10 | 9 |
| `x-aem-cluster` header | AEM (any deployment) | 10 | 10 | 9 |
| `x-dispatcher` header | AEM Dispatcher present | 8 | 9 | 9 |
| `/etc.clientlibs/` in HTML | AEM (any deployment) | 9 | 9 | 9 |
| `/content/dam/` in HTML | AEM (any deployment) | 8 | 8 | 9 |
| `data-sly-` attributes in HTML | AEM with HTL/Sightly | 9 | 9 | 9 |
| `<meta name="generator" content="Adobe Experience Manager">` | AEM (explicit) | 10 | 10 | 9 |
| `/libs/granite/` in HTML | AEM with Granite UI | 9 | 9 | 9 |
| `cq-` prefixed attributes | AEM CQ heritage | 6 | 7 | 9 |
| Fastly headers (x-cache, x-timer, etc.) | Fastly CDN | 5 | 9 | 9 |

#### Tier 3: Medium-Value Signals

| Signal | What It Detects | Weight | Confidence | Passivity |
|--------|----------------|--------|------------|-----------|
| `server: Apache` | Possible Dispatcher | 2 | 4 | 9 |
| `/content/` in URL structure | AEM content path | 5 | 6 | 9 |
| `.html` extension on URLs | AEM URL pattern | 3 | 3 | 9 |
| `wcmmode` reference in HTML | AEM WCM mode | 5 | 7 | 9 |
| `/etc/designs/` in HTML | AEM designs (older pattern) | 7 | 7 | 9 |
| Experience Fragment paths | AEM experience fragments | 8 | 8 | 9 |
| Akamai headers (on AEM site) | Enterprise CDN (common for AEM on-prem) | 3 | 5 | 9 |

#### Tier 4: Deployment-Specific Signals

| Signal | Indicates | Weight | Notes |
|--------|-----------|--------|-------|
| CNAME to `adobeaemcloud.com` | Cloud Service | 10 | Definitive |
| Fastly headers + AEM headers | Cloud Service (probable) | 8 | High probability |
| `publish-p` or `author-p` in any header/value | Cloud Service | 9 | Internal URL leaked |
| `skyline` or `aemcs` in headers | Cloud Service | 9 | Internal codename |
| AEM 6.5 indicators + AWS IPs | Managed Services (probable) | 5 | Circumstantial |
| AEM 6.x + Akamai + non-AWS IP | On-Prem (probable) | 5 | Circumstantial |
| Coral UI 3 patterns | AEM 6.5 | 6 | Version fingerprint |
| Coral UI 2 patterns | AEM 6.4 or earlier | 6 | Version fingerprint |

### 8.3 Scoring Algorithm

```typescript
interface DetectionSignal {
  name: string;
  detected: boolean;
  weight: number;       // 1-10: importance for AEM detection
  confidence: number;   // 1-10: reliability of this signal
  deployment?: 'cloud-service' | 'managed-services' | 'on-prem';
}

interface DetectionResult {
  isAEM: boolean;
  aemConfidence: number;      // 0-100
  deployment: 'cloud-service' | 'managed-services' | 'on-prem' | 'unknown';
  deploymentConfidence: number; // 0-100
  signals: DetectionSignal[];
  version: string | null;
}

function calculateDetection(signals: DetectionSignal[]): DetectionResult {
  // AEM Detection Score
  const aemSignals = signals.filter(s => s.detected);
  const maxPossible = signals.reduce((sum, s) => sum + s.weight * s.confidence, 0);
  const achieved = aemSignals.reduce((sum, s) => sum + s.weight * s.confidence, 0);
  const aemConfidence = Math.round((achieved / maxPossible) * 100);

  // Deployment Classification
  const deploymentVotes: Record<string, number> = {
    'cloud-service': 0,
    'managed-services': 0,
    'on-prem': 0,
  };

  for (const signal of aemSignals) {
    if (signal.deployment) {
      deploymentVotes[signal.deployment] += signal.weight * signal.confidence;
    }
  }

  const topDeployment = Object.entries(deploymentVotes)
    .sort(([, a], [, b]) => b - a)[0];

  const totalDeploymentWeight = Object.values(deploymentVotes)
    .reduce((sum, v) => sum + v, 0);

  return {
    isAEM: aemConfidence >= 30,  // threshold
    aemConfidence,
    deployment: totalDeploymentWeight > 0
      ? topDeployment[0] as DetectionResult['deployment']
      : 'unknown',
    deploymentConfidence: totalDeploymentWeight > 0
      ? Math.round((topDeployment[1] / totalDeploymentWeight) * 100)
      : 0,
    signals: aemSignals,
    version: null, // determined separately
  };
}
```

### 8.4 Detection Pipeline (Ordered by Passivity)

```
Phase 1: DNS Resolution (0 requests to target)
  |
  |-- CNAME lookup via Google DoH
  |-- Check for adobeaemcloud.com in chain
  |-- Identify CDN from CNAME (Akamai, Cloudflare, Fastly, CloudFront)
  |
  v
Phase 2: SSL Certificate (TLS handshake only)
  |
  |-- tls.connect() to get peer certificate
  |-- Check SANs for adobeaemcloud.com
  |-- Check issuer for Fastly-associated CAs
  |
  v
Phase 3: Homepage Fetch (1 GET request)
  |
  |-- Analyze response headers (x-aem-*, x-dispatcher, Fastly headers, CDN headers)
  |-- Analyze HTML content (clientlibs, DAM paths, data-sly-*, generator meta)
  |-- Check URL patterns (redirects, .html extensions, /content/ paths)
  |
  v
Phase 4: Score & Classify
  |
  |-- Calculate AEM confidence score
  |-- Classify deployment type
  |-- Estimate version
  |
  v
Phase 5: (Optional) Targeted Follow-up (1-2 additional requests)
  |
  |-- Only if Phase 3 is ambiguous (score 20-50%)
  |-- Request /etc.clientlibs/ resource (already referenced in HTML)
  |-- Request /content/dam/ resource (already referenced in HTML)
  |-- Never request admin paths
```

### 8.5 Accuracy Estimation

Based on the multi-signal approach:

| Scenario | Expected Accuracy |
|----------|------------------|
| AEM Cloud Service + Adobe CDN | 99% (CNAME is definitive) |
| AEM Cloud Service + BYOCDN, not hardened | 90-95% (Fastly + HTML signals) |
| AEM Cloud Service + BYOCDN, hardened | 70-80% (HTML signals only) |
| AEM Managed Services, not hardened | 85-90% (Dispatcher + HTML signals) |
| AEM Managed Services, hardened | 60-70% (HTML signals may be stripped) |
| AEM On-Prem, not hardened | 85-90% (Dispatcher + HTML signals) |
| AEM On-Prem, fully hardened (stripped headers, custom URLs) | 40-50% (very few signals) |
| Non-AEM site correctly identified as non-AEM | 95%+ (absence of all signals) |

**Overall weighted accuracy estimate**: ~90% for AEM detection, ~75% for deployment type classification.

---

## 9. Implementation Recommendations

### 9.1 Immediate Enhancements to Existing Scanner

The current `SiteScanner` in `src/lib/scanner/site-scanner.ts` already has solid HTML and header detection. The following additions would significantly improve accuracy:

#### A. Add DNS Resolution Layer (Highest Impact)

Create a new module `src/lib/scanner/dns-resolver.ts` that:
1. Uses Google DoH API to resolve CNAME chains
2. Checks for `adobeaemcloud.com` in the chain (definitive Cloud Service indicator)
3. Identifies CDN provider from CNAME targets
4. Returns CDN and deployment classification

#### B. Add Fastly Header Detection

Extend `AEM_HEADER_PATTERNS` in `site-scanner.ts` to include:
```typescript
{ header: 'x-served-by', pattern: /cache-/, weight: 5, cdn: 'fastly' },
{ header: 'x-cache', pattern: /^(HIT|MISS)$/, weight: 3, cdn: 'fastly' },
{ header: 'x-cache-hits', weight: 2, cdn: 'fastly' },
{ header: 'x-timer', pattern: /^S\d+/, weight: 3, cdn: 'fastly' },
{ header: 'via', pattern: /varnish/, weight: 3, cdn: 'fastly' },
```

#### C. Add CDN Detection Headers

Add detection for other CDNs to help classify deployment:
```typescript
// Akamai
{ header: 'server', pattern: /AkamaiGHost/i, weight: 0, cdn: 'akamai' },
{ header: 'x-akamai-transformed', weight: 0, cdn: 'akamai' },

// Cloudflare
{ header: 'cf-ray', weight: 0, cdn: 'cloudflare' },
{ header: 'cf-cache-status', weight: 0, cdn: 'cloudflare' },

// CloudFront
{ header: 'x-amz-cf-id', weight: 0, cdn: 'cloudfront' },
{ header: 'x-amz-cf-pop', weight: 0, cdn: 'cloudfront' },
```

#### D. Enhance Deployment Detection Logic

Replace the current simple `detectDeployment` method with a multi-signal scoring approach that considers:
1. DNS CNAME resolution results
2. CDN identification
3. Header analysis
4. HTML content indicators

### 9.2 New Types to Add

```typescript
interface InfrastructureSignals {
  dns: {
    cnameChain: string[];
    resolvedIPs: string[];
    isAdobeCloudCname: boolean;
    detectedCDN: 'fastly' | 'akamai' | 'cloudflare' | 'cloudfront' | 'other' | 'none';
  };
  ssl: {
    issuer: string;
    sans: string[];
    hasAdobeSAN: boolean;
  };
  cdn: {
    provider: string;
    headers: Record<string, string>;
  };
}

// Extend PlatformDetails
interface PlatformDetails {
  detected: boolean;
  platform: string;
  version: string | null;
  deployment: 'cloud-service' | 'managed-services' | 'on-prem' | 'unknown';
  deploymentConfidence: number;  // NEW: 0-100
  indicators: string[];
  infrastructure?: InfrastructureSignals;  // NEW
}
```

### 9.3 Priority Roadmap

| Priority | Task | Effort | Impact on Accuracy |
|----------|------|--------|-------------------|
| P0 | DNS CNAME resolution via Google DoH | 4 hours | +15-20% for Cloud Service detection |
| P0 | Fastly header detection | 1 hour | +10% for Cloud Service detection |
| P1 | CDN provider identification from headers | 2 hours | +5% for deployment classification |
| P1 | Multi-signal scoring algorithm | 4 hours | +10% overall accuracy |
| P2 | SSL certificate inspection | 4 hours | +3-5% for edge cases |
| P2 | Cross-reference with known AEM site database | 8 hours | +5% for ambiguous cases |
| P3 | Cookie-based detection (`cq-author`, `cq-session`) | 1 hour | +2% for unstripped sites |
| P3 | JavaScript variable detection | 2 hours | +3% for client-rendered indicators |

### 9.4 Architecture Decision

The scanner should execute detection phases in this order within the existing `scan()` method:

```
1. DNS lookup (parallel with SSL check)
2. SSL certificate check (parallel with DNS)
3. Homepage fetch (already exists)
4. Combine all signals into scoring
5. Return enriched PlatformDetails with infrastructure data
```

Phases 1 and 2 can run in parallel with each other, and both should complete before or concurrent with Phase 3 (the existing `fetchPage` call).

---

## Sources

### AEM Cloud Service & CDN
- [CDN in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn)
- [Configuring Traffic at the CDN](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic)
- [Custom Domain Name with Adobe Managed CDN](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/content-delivery/custom-domain-name-with-adobe-managed-cdn)
- [Custom Domain Name with Customer-Managed CDN](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/content-delivery/custom-domain-names-with-customer-managed-cdn)
- [Adobe Managed CDN](https://www.aem.live/docs/byo-cdn-adobe-managed)
- [Configurability of CDN in AEM Cloud Service - adaptTo() 2024](https://adapt.to/2024/schedule/configurability-of-cdn-in-aem-cloud-service)
- [Managing SSL and Domains in AEM as a Cloud Service](https://www.albinsblog.com/2023/12/managing-ssl-and-domains-in-aem-as-a-cloud-service.html)
- [Deep Dive into CDN Capabilities Within AEM as a Cloud](https://www.albinsblog.com/2024/05/a-deep-dive-into-cdn-capabilities-within-aem-as-a-cloud.html)

### AEM Managed Services vs Cloud Service
- [AEM On-Premise, Managed Service, or Cloud Service Comparison](https://www.eggsunimedia.com/de/en/insights/blog/comparison-aem-on-premise-managed-service-cloud-service)
- [Moving from On-Prem or AMS to AEM Cloud](https://www.credera.com/insights/aem-cloud-service-moving-adobe-managed-infrastructure-aem-cloud)
- [Understanding AEM Sites Offerings and Differences](https://experienceleague.adobe.com/en/perspectives/understanding-aem-sites-offerings-and-differences)
- [Migrating Dispatcher Configuration from AMS to AEM CS](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/ams-aem)

### Dispatcher & Headers
- [Exploring AEM Request and Response Headers](https://techrevel.blog/2023/09/05/exploring-aem-request-and-response-headers-analysis-of-browser-cdn-and-dispatcher/)
- [AEM Dispatcher Configuration](https://experienceleague.adobe.com/en/docs/experience-manager-dispatcher/using/configuring/dispatcher-configuration)
- [Taking Application Security to the Next Level](https://blog.3sharecorp.com/taking-application-security-to-the-next-level)
- [Securing AEM with Dispatcher](https://labs.withsecure.com/publications/securing-aem-with-dispatcher)

### Fastly CDN Headers
- [X-Served-By - Fastly Documentation](https://www.fastly.com/documentation/reference/http/http-headers/X-Served-By/)
- [X-Cache - Fastly Documentation](https://www.fastly.com/documentation/reference/http/http-headers/X-Cache/)
- [X-Cache-Hits - Fastly Documentation](https://www.fastly.com/documentation/reference/http/http-headers/X-Cache-Hits/)
- [Checking Cache - Fastly Documentation](https://www.fastly.com/documentation/guides/full-site-delivery/caching/checking-cache/)
- [Fastly Header Reference](https://www.fastly.com/documentation/reference/http/http-headers/)

### DNS Lookup
- [Google DNS-over-HTTPS JSON API](https://developers.google.com/speed/public-dns/docs/doh/json)
- [Node.js DNS Module Documentation](https://nodejs.org/api/dns.html)
- [Configuring DNS Settings for AEM CS](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/custom-domain-names/configure-dns-settings.html)

### SSL/TLS
- [Node.js TLS Documentation](https://nodejs.org/api/tls.html)
- [TLS Certificate Inspection Example](https://gist.github.com/sandfox/1831932)

### AEM Site Databases
- [Wappalyzer - Adobe Experience Manager](https://www.wappalyzer.com/technologies/cms/adobe-experience-manager/)
- [Wappalyzer Open Source (WebPageTest fork)](https://github.com/WPO-Foundation/Wappalyzer)
- [How to Tell if a Website Uses AEM - Quora](https://www.quora.com/How-can-someone-tell-if-a-website-is-built-on-Adobe-Experience-Manager)

### Adobe Network
- [AS15224 Adobe Inc. - IPinfo](https://ipinfo.io/AS15224)
- [AS14365 Adobe Systems Inc. - IPinfo](https://ipinfo.io/AS14365)
- [Advanced Networking for AEM CS](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/configuring-advanced-networking)
- [IP Addresses Used by Experience Cloud](https://experienceleague.adobe.com/en/docs/core-services/interface/data-collection/ip-addresses)

### CDN Detection
- [Akamai Debug Headers](https://www.5centscdn.net/help/akamai-debug-headers/)
- [Cloudflare cf-cache-status Explained](https://www.debugbear.com/docs/cf-cache-status)
- [Debugging CDNs](https://www.catchpoint.com/blog/debugging-cdns)

### Ethics & Legal
- [OWASP Web Application Fingerprinting Guide](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework)
- [HTTP Fingerprinting - YesWeHack](https://www.yeswehack.com/learn-bug-bounty/recon-series-http-fingerprinting)
- [Fingerprinting in Cybersecurity - Recorded Future](https://www.recordedfuture.com/threat-intelligence-101/vulnerability-management-threat-hunting/fingerprinting-in-cybersecurity)
