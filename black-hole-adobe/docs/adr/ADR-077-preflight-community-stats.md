# ADR-077: Pre-Flight™ Community Statistics and Leaderboard

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ currently operates as an isolated tool — each user scans their code in a vacuum with no awareness of how their results compare to the broader AEM community. Aggregate statistics create social proof ("12,000 scans this month"), surface industry trends ("most common failure: mutable content paths"), and create a reason for users to come back.

Community stats turn a one-time tool into a platform with network effects.

## Decision

Collect anonymous, aggregated scan statistics and display them publicly on the Pre-Flight™ page.

### Data Collected (Anonymous Only)

For each scan, record:
- Timestamp
- Language (java/xml/json/htl)
- Number of findings by severity
- Rule IDs triggered (which rules failed — NOT the code)
- Scan duration
- Readiness score (ADR-074)

**NOT collected:** Code content, file paths, company names, user identity, IP addresses.

### Display

1. **Stats bar:** Visible on the landing page and tool page:
   - "X scans run this month"
   - "Y blockers caught before deployment"
   - "Average readiness score: Z%"

2. **Most common failures:** Top 5 triggered rules with percentages:
   - "68% of scans trigger: Mutable content under /apps"
   - "41% of scans trigger: JCR session handling in servlet"

3. **Score distribution:** Histogram showing grade distribution across all scans (anonymized)

4. **Weekly digest:** Optional email (from lead gate) with community stats and new rule alerts

### Implementation

- **Lightweight analytics endpoint:** `POST /api/preflight-stats` accepts anonymous scan metadata
- **No code transmitted:** Only severity counts and rule IDs — never code content
- **Client-side opt-in:** Stats submission happens only after lead gate is completed (user has already consented)
- **Aggregation:** Stats are aggregated server-side into daily/weekly/monthly rollups
- **Display:** Stats fetched via `GET /api/preflight-stats/summary` (public, cached, no auth)

### Privacy

- No code content is ever included in stats
- No personally identifiable information in stats payloads
- Rule IDs and severity counts are inherently anonymous
- Stats submission is non-blocking — tool works even if stats endpoint is down
- Documented on the security page (ADR security.html update)

## Consequences

**Positive:**
- Social proof drives adoption ("12,000 developers use this")
- Industry benchmarks create unique content no competitor has
- "Most common failure" data is genuinely useful for the AEM community
- Score distribution helps users contextualize their results
- Creates content marketing opportunities (monthly report, blog posts)
- Community stats make Pre-Flight™ feel like a platform, not a utility

**Negative:**
- Requires a server endpoint (first server-side component in Pre-Flight™)
- Even anonymous stats require careful privacy communication
- Stats could be gamed (automated scans to inflate numbers)
- "Most common failure" data could theoretically help competitors understand rule coverage

**Mitigations:**
- Rate limiting on stats endpoint (same IP can submit max 20 stats/hour)
- Privacy page explicitly documents what is and isn't collected
- Stats are aggregate-only — no individual scan data is retrievable
- Competitor concern is minimal — our rules are based on publicly documented Adobe gates

## Estimated Effort
- Stats collection endpoint: 3 hours
- Client-side stats submission: 2 hours
- Aggregation pipeline: 3 hours
- Stats display UI: 3 hours
- Privacy documentation update: 1 hour
- **Total: 12 hours**

## Dependencies
- Requires a server/API endpoint (could use Vercel serverless functions or Cloud Run)
- Should be implemented after the tool has sufficient organic usage to produce meaningful stats (target: 500+ scans)
