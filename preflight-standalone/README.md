# Pre-Flight™ by Focus GTS

**Free, browser-based AEM Cloud Manager quality gate checker. 104 rules. 1,141 tests. Zero setup.**

Check your AEM code against 100+ Cloud Manager code quality patterns in seconds — no Java, no Maven, no SonarQube server, no running AEM instance required.

**[Try it now → focusgts.com/preflight](https://www.focusgts.com/preflight/)**

---

## The Problem

Cloud Manager pipelines take 45 minutes. When they fail on a code quality rule, you fix it and wait another 45 minutes. Adobe provides local validation tools (aemanalyser-maven-plugin, Dispatcher validate.sh), but they require Java, Maven, or the SDK.

There's no way to get instant feedback on your AEM code without that setup. Until now.

## What Pre-Flight™ Does

Paste your code. Get instant findings with severity, explanation, and fix suggestions. That's it.

### Languages Supported

| Language | File Types | Example Checks |
|----------|-----------|----------------|
| **Java** | `.java` | Deprecated APIs, ResourceResolver leaks, servlet path registration, thread safety, security vulnerabilities |
| **XML** | `.xml` | Oak index definitions, content package structure, mutable/immutable content separation, banned paths |
| **HTL** | `.html`, `.htl` | Missing display contexts, deprecated directives, unsafe contexts, hardcoded paths, inline scripts |
| **OSGi Config** | `.cfg.json`, `.config` | Unsupported run modes, duplicate PIDs, legacy config formats |
| **Dispatcher** | `.any`, `.conf`, `.vhost`, `.rules` | Required headers, filter patterns, cache rules, RewriteMap, FollowSymLinks |
| **JSON** | `.json` | OSGi configuration validation |

### Rule Coverage

Pre-Flight™ checks against **104 rules** across these categories:

| Category | Rules | Examples |
|----------|-------|---------|
| **SonarQube CQRules** | 30+ | CQBP-71, CQBP-72, CQBP-75, AMSCORE-553, AEMSRE-870, AEMSRE-889 |
| **OakPAL** | 16+ | Index type, async flag, compatVersion, banned paths, mixed packages, supported run modes, reindex property |
| **Java Compatibility** | 6 | javax → jakarta migration, sun.* packages, reflection usage, native libraries |
| **Deprecated API Detection** | 3 | AMSCORE-553 enforcement (active as of March 30, 2026), deprecated AEM APIs with replacements |
| **Security** | 12+ | Hardcoded credentials, XSS prevention, SQL injection, insecure ciphers, insecure temp files, weak PRNG |
| **Best Practice** | 10+ | Logger declarations, debug guards, exception handling, FIXME tags, thread safety |
| **Dispatcher** | 10 | Required headers, filter ordering, cache rules, glob avoidance, immutable files |
| **HTL** | 8 | Display context, deprecated directives, unsafe context, Classic UI widgets |
| **AEM-Specific** | 5+ | Administrative access, JCR session management, incompatible workflow processes |

**Coverage: ~89% of Adobe's ~115 Cloud Manager quality gate rules.** The remaining ~11 rules require Java bytecode analysis that cannot be performed in a browser.

## Features

### Core
- **Paste and scan** — paste Java, XML, HTL, OSGi config, or Dispatcher files
- **Drag and drop** — drop files or entire folders for multi-file analysis
- **GitHub repo scanning** — paste a GitHub URL, select a branch, scan the whole project
- **Instant results** — findings in seconds with severity, explanation, and remediation

### Analysis
- **Readiness score** — A through F grade with visual badge
- **Inline fix suggestions** — see the exact fix with copy-to-clipboard
- **Before/after comparison** — split-pane view showing original vs. fixed code
- **Cloud Manager build log comparison** — paste a build log, see what Pre-Flight™ would have caught

### Output
- **PDF report export** — branded, downloadable report with score, findings, and code
- **Cloud Service Ready badge** — shields.io-style SVG badge for your GitHub README
- **Compressed share URLs** — share findings via URL (60-80% smaller than raw encoding)

### Privacy & Security
- **100% client-side** — your code is analyzed in browser memory using local pattern-matching rules
- **No code transmitted** — zero network calls during analysis. Verifiable in browser DevTools.
- **No code stored** — code is held in React state only, discarded on page close
- **No analytics or tracking** — no Google Analytics, no Mixpanel, no telemetry on the tool page
- **No cookies** — only localStorage for the lead gate email
- **Works offline** — Service Worker caches all assets after first visit
- **Full security documentation** — [focusgts.com/preflight/security.html](https://www.focusgts.com/preflight/security.html)

## Who This Is For

- **AEM teams migrating from 6.5 to Cloud Service** — catch migration issues before pushing to Cloud Manager
- **Teams already on AEMaaCS** — stop the 45-minute feedback loop on quality gate failures
- **AEM developers** — instant validation while writing code, no context switching to CLI tools
- **Technical leads and architects** — readiness scoring and PDF reports for migration planning

## How It's Different

| | Pre-Flight™ | aemanalyser-maven-plugin | Dispatcher validate.sh | Best Practices Analyzer |
|---|---|---|---|---|
| **Setup** | None — open a browser | Java + Maven project | AEM SDK download | Running AEM instance + admin |
| **Speed** | Seconds | Minutes (full Maven build) | Seconds | Hours |
| **Scope** | Code quality + Dispatcher + HTL | OSGi bundles + packages | Dispatcher only | Content + config assessment |
| **Output** | Interactive findings + PDF + badge | Build log | Pass/fail | Report (up to 200MB) |
| **Where** | Browser | Terminal | Terminal | AEM admin console |

Pre-Flight™ is not a replacement for Adobe's tools. It's the fastest way to get feedback before committing code. Use Pre-Flight™ during development, Adobe's tools in CI/CD.

## Quality Assurance

- **1,141 tests** — every rule tested with 5+ true positives and 5+ true negatives
- **Two rounds of real-world validation** — 145 code samples from real AEM projects (WKND, ACS Commons, Core Components)
- **8 bugs caught and fixed** during testing before reaching production
- **Zero false positives** across all validation rounds

## Tech Stack

- React + TypeScript (strict mode)
- Vite build
- All analysis via regex-based pattern matching (no AST parsing, no server)
- jsPDF for PDF generation
- Pako for URL compression
- Service Worker for offline caching

## Links

- **Tool:** [focusgts.com/preflight](https://www.focusgts.com/preflight/)
- **Security:** [focusgts.com/preflight/security.html](https://www.focusgts.com/preflight/security.html)
- **Navigator (bypass lead gate):** [focusgts.com/preflight/?access=navigator](https://www.focusgts.com/preflight/?access=navigator)

## About Focus GTS

Focus GTS is a technical staffing and execution firm specializing in AI, data, cloud, and Adobe Experience Cloud. Pre-Flight™ is powered by [Navigator](https://navigator.focusgts.com), our Adobe execution platform.

[focusgts.com](https://www.focusgts.com) · [info@focusgts.com](mailto:info@focusgts.com) · 305.330.1672

---

Pre-Flight™ is a trademark of Focus Global Talent Solutions, LLC. Adobe, AEM, Adobe Experience Manager, Cloud Manager, and Adobe Experience Cloud are trademarks of Adobe Inc.
