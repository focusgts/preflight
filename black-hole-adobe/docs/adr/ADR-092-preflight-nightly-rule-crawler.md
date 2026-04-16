# ADR-092: Pre-Flight™ Nightly Rule Crawler and Auto-Update System

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™'s value is directly proportional to its rule coverage. If Adobe adds a new Cloud Manager quality gate on Tuesday and Pre-Flight™ doesn't detect it until a developer manually notices three weeks later, every team that hits the new rule in the interim loses trust in the tool. Stale rules are the fastest way to kill credibility.

Adobe updates Cloud Manager rules regularly but unpredictably. New deprecated API enforcement phases, new OakPAL checks, new security rules — these changes happen across multiple documentation pages with no single changelog or notification mechanism. Manually monitoring these pages is tedious, error-prone, and doesn't scale.

The solution is automation: a scheduled agent that crawls Adobe's documentation pages nightly, parses the rule tables, diffs against Pre-Flight™'s current rule set, and creates GitHub Issues for any new or changed rules. The human reviews and merges — the crawler identifies, the developer implements.

This approach is lightweight (a few HTTP fetches and text comparisons), requires no sophisticated ML or NLP, and runs on a simple cron schedule. It turns a "hope someone notices" process into a "guaranteed we know within 24 hours" process.

## Decision

Build a nightly scheduled agent that monitors Adobe's documentation pages for Cloud Manager rule changes and creates actionable GitHub Issues when new or modified rules are detected.

### Monitored Pages

| Page | URL | What It Contains |
|------|-----|-----------------|
| Custom Code Quality Rules | `experienceleague.adobe.com/.../custom-code-quality-rules` | Full table of SonarQube CQRules with IDs, names, severities, descriptions |
| Code Quality Testing | `experienceleague.adobe.com/.../code-quality-testing` | Overview of quality gate categories and thresholds |
| Deprecated and Removed Features | `experienceleague.adobe.com/.../deprecated-removed-features` | List of deprecated APIs with enforcement dates |
| Content Package Validation | `experienceleague.adobe.com/.../content-package-validation` | OakPAL rules and package structure requirements |
| Dispatcher in the Cloud | `experienceleague.adobe.com/.../dispatcher-in-the-cloud` | Dispatcher configuration requirements |
| Repository Modernization | `experienceleague.adobe.com/.../repository-modernization` | Package structure requirements |
| Cloud Manager Release Notes | `experienceleague.adobe.com/.../release-notes-cloud-manager` | New features and rule changes per release |

### Crawler Architecture

```
┌─────────────────────────────────────────────────┐
│ Nightly Cron (GitHub Actions / Vercel Cron)     │
│ Schedule: 02:00 UTC daily                       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Page Fetcher                                    │
│ - Fetch each monitored URL                      │
│ - Store raw HTML for parsing                    │
│ - Handle rate limiting and retries              │
│ - Detect if page structure changed (alerts)     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Rule Table Parser                               │
│ - Extract <table> elements from HTML            │
│ - Parse rows: Rule ID | Name | Severity | Desc  │
│ - Extract deprecated API lists and dates        │
│ - Normalize data into RuleDefinition format     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Diff Engine                                     │
│ - Load current rules from rules.ts              │
│ - Compare parsed rules against current set      │
│ - Detect: new rules, removed rules, changed     │
│   severity, changed description, new deprecated │
│   APIs, changed enforcement dates               │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ GitHub Issue Creator                            │
│ - If diff found: create GitHub Issue            │
│ - Label: "rule-update", severity-based priority │
│ - Body: full details + draft implementation     │
│ - If no diff: log success, no action            │
└─────────────────────────────────────────────────┘
```

### Rule Table Parser

The parser handles Adobe's Experience League table format:

```typescript
interface ParsedRule {
  id: string;           // e.g., "CQBP-71"
  name: string;         // e.g., "Hardcoded /apps and /libs Paths"
  severity: string;     // e.g., "Critical"
  description: string;  // Full description text
  category: string;     // Derived from which page it came from
  sourceUrl: string;    // The URL where this rule was found
  lastSeen: string;     // ISO date of when crawler last found it
}

interface DeprecatedAPI {
  package: string;      // e.g., "org.apache.sling.commons.json"
  replacement: string;  // e.g., "javax.json"
  enforcementDate: string;  // e.g., "2026-03-30"
  phase: string;        // e.g., "Phase 1"
}

function parseRuleTable(html: string): ParsedRule[] {
  // 1. Find all <table> elements on the page
  // 2. Identify rule tables by header columns (Rule ID, Name, Severity, etc.)
  // 3. Parse each row into a ParsedRule
  // 4. Handle colspan, nested HTML, footnotes
}
```

### Diff Detection

```typescript
interface RuleDiff {
  newRules: ParsedRule[];           // Rules in docs that aren't in our codebase
  removedRules: ParsedRule[];       // Rules in our codebase no longer in docs
  changedRules: {                   // Rules where properties changed
    rule: ParsedRule;
    changes: string[];              // e.g., ["severity: Major → Critical", "description updated"]
  }[];
  newDeprecatedAPIs: DeprecatedAPI[];
  changedEnforcementDates: {
    api: string;
    oldDate: string;
    newDate: string;
  }[];
}
```

### GitHub Issue Format

When the diff engine finds new or changed rules, it creates a GitHub Issue:

```markdown
## 🔍 New Cloud Manager Rule Detected: CQBP-99

**Source:** [Custom Code Quality Rules](https://experienceleague.adobe.com/...)
**Detected:** 2026-04-16 02:15 UTC
**Category:** SonarQube CQRules
**Severity:** Critical

### Rule Details

| Field | Value |
|-------|-------|
| Rule ID | CQBP-99 |
| Name | Hardcoded Content Path References |
| Severity | Critical |
| Description | Java code should not reference content paths directly. Use Resource API or Sling mappings. |

### Draft Implementation

```typescript
{
  id: 'CQBP-99',
  name: 'Hardcoded Content Path References',
  category: 'CQRules',
  severity: 'critical',
  languages: ['java'],
  description: 'Java code should not reference content paths directly. Use Resource API or Sling mappings.',
  docUrl: 'https://experienceleague.adobe.com/...',
  check: (content: string) => {
    const pattern = /["'](\/content\/[a-zA-Z0-9\-\/]+)["']/g;
    // TODO: Refine pattern, add exclusions for test files
    return findMatches(content, pattern);
  }
}
```

### Action Required
- [ ] Review rule details for accuracy
- [ ] Implement detection pattern in `rules.ts`
- [ ] Add test cases (positive and negative)
- [ ] Update rule count in documentation
- [ ] Add to Pre-Flight™ changelog

/label rule-update priority-high
```

### Page Structure Change Detection

Adobe occasionally restructures their documentation pages. If the parser can't find expected table structures, it creates an alert issue:

```markdown
## ⚠️ Rule Crawler: Page Structure Changed

The rule crawler could not parse the expected table format on:
**Custom Code Quality Rules** (https://experienceleague.adobe.com/...)

This may mean Adobe restructured the page. Manual review required.

Last successful parse: 2026-04-15
Failed parse: 2026-04-16
```

### Execution Environment

**Option A: GitHub Actions (Recommended)**

```yaml
name: Nightly Rule Crawler
on:
  schedule:
    - cron: '0 2 * * *'  # 02:00 UTC daily
  workflow_dispatch:      # Manual trigger for testing

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/rule-crawler.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- Free for public repos (2,000 minutes/month for private)
- No additional infrastructure needed
- Manual trigger available for on-demand checks
- Logs visible in GitHub Actions tab

**Option B: Vercel Cron**

- If Pre-Flight™ is deployed on Vercel, use Vercel Cron Jobs
- Same logic, different execution environment
- Advantage: co-located with the application

### Historical Tracking

The crawler maintains a `rule-snapshots/` directory with dated JSON files:

```
rule-snapshots/
├── 2026-04-15.json
├── 2026-04-16.json
├── 2026-04-17.json
└── ...
```

This enables:
- Viewing the history of when rules were added/changed by Adobe
- Debugging parser issues by comparing raw snapshots
- Generating a "Rule changelog" for Pre-Flight™ users: "3 new rules detected this month"

## Consequences

**Positive:**
- Guarantees Pre-Flight™ knows about new rules within 24 hours of Adobe documentation updates
- Eliminates the manual monitoring burden that doesn't scale
- Draft implementations in GitHub Issues accelerate the human review-and-merge process
- Page structure change detection prevents silent parser failures
- Historical snapshots create a unique dataset: a changelog of Cloud Manager rule evolution
- Team tier users (ADR-091) who pay for "priority rule updates" receive tangible value from this automation
- Extremely low running cost — a few HTTP fetches per night on free GitHub Actions minutes

**Negative:**
- HTML scraping is brittle — any page structure change breaks the parser
- Adobe may serve different content to automated crawlers vs. browsers (rate limiting, bot detection)
- False positives: page styling changes that don't affect rule content may trigger diff alerts
- The draft implementation in issues is a starting point, not production code — still requires human effort
- Maintaining parsers for 7+ documentation pages adds ongoing maintenance surface

**Mitigations:**
- Page structure change detection alerts immediately when parsing fails — never silently misses changes
- Use standard `User-Agent` headers and respect `robots.txt` — don't behave like a scraper
- Content-only diffing (ignore HTML attributes, whitespace, styling) reduces false positives
- Parser tests with fixture HTML ensure changes are detected during development
- Fallback: if automated parsing fails for > 3 days, create an umbrella issue for manual review

## Estimated Effort
- Page fetcher with retry logic: 1 hour
- Rule table parser (7 page formats): 2-3 hours
- Diff engine: 1 hour
- GitHub Issue creator with draft implementation: 1-2 hours
- GitHub Actions workflow: 30 minutes
- Page structure change detection: 30 minutes
- Testing with fixture HTML: 1 hour
- **Total: 4-6 hours for initial crawler, ongoing maintenance as Adobe changes page structures**
