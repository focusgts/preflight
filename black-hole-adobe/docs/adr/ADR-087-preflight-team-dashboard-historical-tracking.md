# ADR-087: Pre-Flight™ Team Dashboard with Historical Tracking

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ currently operates as a stateless tool — each scan is independent, and results are lost when the browser session ends. This works for individual engineers validating code snippets, but it fails for the team use case: tracking migration progress over time across a multi-month migration project.

Migration projects are marathons, not sprints. A team of 4 developers working on a 6-month AEM Cloud Service migration needs to answer questions like:
- "Are we getting closer to Cloud Service readiness, or are new issues being introduced?"
- "Which of our 12 modules has improved the most this month?"
- "Can we show leadership a trend line proving the migration is on track?"
- "Which developer's changes caused the score to drop?"

No AEM migration tool provides historical tracking. SonarCloud and Codacy do this for general code quality — their success proves the model works. But none of them understand AEM Cloud Service rules, package structure, or Dispatcher configuration.

Historical tracking also justifies an enterprise paid tier. Stateless tools are hard to charge for (someone will just re-run the scan). Persistent dashboards with team features create ongoing value that warrants a subscription.

## Decision

Add a Team Dashboard to Pre-Flight™ that stores scan results over time and provides trend visualization, multi-project comparison, and compliance reporting.

### Core Features

#### 1. Project Registration

- User creates a "project" with a name (e.g., "ACME Corp — AEM Migration")
- Each project gets a unique ID used to associate scans with the project
- Projects can have multiple members (via email invite)
- Projects support multiple modules (e.g., `ui.apps`, `ui.content`, `dispatcher`)

#### 2. Historical Score Tracking

For each scan associated with a project:
- Store: timestamp, readiness score, grade, finding count by severity, scanned file count
- Display: line chart showing score over time with data points for each scan
- Annotate: mark key milestones ("Completed deprecated API migration", "Restructured packages")
- Granularity: daily/weekly/monthly views

```
Score
100 ┤
 90 ┤                                          ╭──●  A
 80 ┤                              ╭──●───●──╮╯
 70 ┤                    ╭──●───●─╯          
 60 ┤          ╭──●───●─╯                     
 50 ┤    ●───●─╯                               
 40 ┤──●╯                                      
    └──────────────────────────────────────────
     Jan   Feb   Mar   Apr   May   Jun   Jul
```

#### 3. Multi-Project Comparison

- Side-by-side score comparison across projects
- Useful for: enterprise teams with multiple AEM instances, consultancies managing multiple clients, organizations with regional AEM deployments
- Leaderboard view: rank projects by readiness score
- Export comparison as branded PDF for executive reporting

#### 4. Module-Level Drill-Down

- Per-module score tracking (ui.apps: 78%, ui.content: 92%, dispatcher: 45%)
- Identify the lowest-scoring module to prioritize work
- Module-level trend lines
- Color-coded module heatmap

#### 5. Finding Trend Analysis

Beyond the overall score:
- Track individual rule finding counts over time
- Identify rules where findings are increasing (new code introducing old patterns)
- "Resolved vs. New" chart: how many findings were fixed vs. introduced per scan
- Alert when a previously clean rule starts showing violations again

#### 6. Compliance Reports

- Exportable reports showing migration progress over a date range
- Format: PDF with charts (extends ADR-068) and CSV for data
- Content: score trend, findings resolved, remaining work, projected completion date
- Useful for: steering committee updates, audit documentation, vendor progress reporting

### Data Storage

#### Option A: Cloud Storage (Recommended)

- Scan results stored in a backend database (Supabase, Firebase, or custom API)
- Users authenticate via GitHub OAuth, Google OAuth, or email/password
- Data encrypted at rest and in transit
- Projects isolated by account — no cross-tenant data access
- Retention: 2 years of scan history per project

#### Option B: Local Storage (Fallback)

- For users who don't want to create accounts
- Scan history stored in IndexedDB in the browser
- Limited to single device, no team sharing
- Export/import as JSON for portability
- Maximum 100 scans per project (storage limits)

### Team Features

| Feature | Description |
|---------|-------------|
| Member roles | Owner, Admin, Developer, Viewer |
| Activity feed | "Dave scanned ui.apps — score improved from 67% to 72%" |
| Scan scheduling | Reminder notifications: "No scan in 7 days — score may be stale" |
| Threshold alerts | "Project dropped below B grade" email notification |
| Shared annotations | Team members can add notes to any scan data point |

### API for CI/CD Integration

```bash
# Upload scan results from CI pipeline
curl -X POST https://focusgts.com/preflight/api/v1/scans \
  -H "Authorization: Bearer $PREFLIGHT_TOKEN" \
  -d '{
    "projectId": "proj_abc123",
    "module": "ui.apps",
    "score": 78,
    "grade": "B",
    "findings": [...],
    "commit": "abc1234",
    "branch": "feature/migration"
  }'
```

This enables automatic score tracking from CI pipelines — every commit gets a score, every merge shows progress.

## Consequences

**Positive:**
- Transforms Pre-Flight™ from a one-time tool into an ongoing platform — dramatically increases stickiness
- Historical tracking makes migration progress visible to leadership — generates executive buy-in for continued investment
- Multi-project comparison creates competitive dynamics within organizations ("Why is Team B ahead of Team A?")
- CI/CD API integration makes Pre-Flight™ part of the development workflow, not a separate step
- Justifies enterprise pricing — persistent dashboards with team features are the standard SaaS model
- Compliance reports serve audit and governance requirements that individual scans cannot

**Negative:**
- Requires backend infrastructure — significant departure from the current zero-server architecture
- User authentication introduces complexity, security obligations, and GDPR/privacy concerns
- Database storage of scan results means code-adjacent data leaves the browser (even if code itself doesn't)
- Team features require invitation/permission management — adds UX complexity
- Ongoing infrastructure costs (hosting, database, authentication services)

**Mitigations:**
- Ship local storage (IndexedDB) first for individual users — no backend needed
- Add cloud storage as a paid tier upgrade — backend costs covered by subscription revenue
- Scan results store findings metadata only (rule IDs, line numbers, severities) — never store the actual scanned code
- Privacy-first: explicit opt-in for cloud storage with clear data retention policies
- Use managed services (Supabase/Firebase) to minimize infrastructure management burden

## Estimated Effort
- IndexedDB local storage layer: 3 days
- Score trend chart UI: 3 days
- Multi-project comparison view: 2 days
- Module drill-down: 2 days
- Finding trend analysis: 2 days
- Cloud storage backend (Supabase): 3-4 days
- Authentication (OAuth): 2-3 days
- Team features (roles, invites, activity feed): 3-4 days
- CI/CD API endpoint: 2 days
- Compliance report export: 2 days
- **Total: 3-4 weeks**
