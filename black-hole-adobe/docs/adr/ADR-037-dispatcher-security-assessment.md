# ADR-037: Dispatcher Security & Configuration Assessment

## Status: Proposed

## Date: 2026-03-28

## Context

Dispatcher configuration assessment is Adobe BPA's single largest documented scope exclusion -- explicitly out of scope. Yet the Dispatcher is one of the most critical and complex components of any AEM migration, and one of the most common sources of security vulnerabilities. Adobe provides a separate Dispatcher Converter tool that restructures config files from on-prem to Cloud Service format, but this tool handles only structural conversion -- it does not assess security posture, detect misconfigurations, or validate that converted rules behave correctly with Fastly CDN.

WithSecure Labs published detailed research on AEM Dispatcher bypass techniques. The Burp AEM Scanner project demonstrates active probes for common Dispatcher misconfigurations. The open-source SecureAEM tool (Cognifide/WTTech) covers some checks but is dormant and not a SaaS product.

Common AEM Dispatcher security issues that go undetected:

- Content-grabbing selectors (.infinity.json, .tidy.-1.json, .model.json) exposed to the public
- /crx/de (CRXDE Lite) accessible through Dispatcher
- /system/console (Apache Felix Web Console) not blocked
- Default credentials on author (admin/admin) with Dispatcher not blocking author paths
- Missing referrer filter configuration allowing CSRF attacks
- Cache poisoning via unvalidated selectors
- .htm extension not required, allowing content scraping via .html, .xml, .json selectors

## Decision

Build a Dispatcher Security & Configuration Assessment module that operates at two levels:

### 1. External Security Probes (from health score scan, ADR-030)

Add Dispatcher-specific security checks to the existing 5-tier scanner:

- Probe common sensitive paths with HEAD requests:
  - /crx/de/index.jsp (CRXDE)
  - /system/console (Felix Console)
  - /bin/querybuilder.json (Query Builder)
  - /.json (root JSON selector)
  - /content.infinity.json (content grabbing)
  - /etc/mobile/useragent-test.html (AEM fingerprint)
  - /libs/granite/security/content/useradmin.html (User Admin)
- A 200 response on any of these = CRITICAL security finding
- A 403 = correctly blocked (expected)
- A 404 = not AEM or properly configured
- Include in health score report as "Security Posture" section
- Confidence: high (direct observation of what is publicly accessible)

### 2. Dispatcher Configuration Analysis (paid tier -- requires config files)

- Parse Apache httpd.conf and Dispatcher .any/.farm files
- Detect missing filter deny rules for:
  - /crx, /system, /bin, /libs/granite/security, /admin
  - Content-grabbing selectors (.infinity, .tidy, .childrenlist, .permissions, .query)
  - Dangerous HTTP methods (DELETE, PUT, TRACE)
- Detect missing security headers:
  - X-Frame-Options
  - X-Content-Type-Options
  - Content-Security-Policy
  - Strict-Transport-Security
  - X-XSS-Protection
- Detect cache configuration issues:
  - Caching authenticated content (privacy violation)
  - Missing Vary headers causing cache poisoning
  - Overly broad cache rules that cache dynamic content
- Detect AEMaaCS compatibility issues:
  - Custom Apache modules not available in Cloud Service
  - Direct filesystem references that will not work in containerized environment
  - Static IP dependencies that need Advanced Networking
  - SSL/TLS configuration that is now managed by Adobe CDN

### 3. Cloud Service Dispatcher Migration Path

- Map on-prem rules to AEMaaCS Dispatcher structure (conf.d/, conf.dispatcher.d/)
- Identify rules that have no Cloud Service equivalent
- Generate recommended Fastly CDN VCL snippets for rules that move from Dispatcher to CDN layer
- Validate converted configuration against AEMaaCS Dispatcher Validator rules

### 4. Security Assessment Report

- External scan: traffic-light security posture (Green/Yellow/Red)
- Per-probe results with severity and remediation
- Configuration analysis: rules inventory, missing protections, AEMaaCS compatibility
- OWASP correlation (which OWASP Top 10 risks are addressed/unaddressed)
- Remediation priority: Critical (fix immediately, publicly exploitable) to Low (best practice)

## Consequences

**Positive:**

- Fills BPA's single largest documented gap with high-value security intelligence.
- External security probes enhance the free health score with immediately actionable findings.
- Security findings create urgency -- a publicly exposed /crx/de is a "fix this today" conversation.
- Positions Black Hole as security-conscious, not just migration-focused.

**Negative:**

- Security probing must be clearly disclosed and ethical -- only HEAD requests, no exploitation.
- False positives on honeypots or WAF-protected endpoints could mislead.
- Some customers may already have separate security tools (Qualys, Nessus); need to show AEM-specific value beyond generic vulnerability scanning.
