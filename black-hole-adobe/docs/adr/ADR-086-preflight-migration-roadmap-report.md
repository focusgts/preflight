# ADR-086: Pre-Flight™ Migration Roadmap Report

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ currently delivers scan results as a flat list of findings with pass/fail verdicts. This is useful for engineers actively fixing code, but it doesn't answer the question that project managers, architects, and leadership are actually asking: "How much work is the migration, and in what order should we do it?"

That question is currently answered by consultancies charging $50,000-$100,000 for a "Cloud Service Readiness Assessment." These assessments involve a team of consultants spending 2-4 weeks reviewing code, interviewing stakeholders, and producing a PowerPoint deck with a phased migration plan. The actual technical analysis in those assessments overlaps significantly with what Pre-Flight™ already detects — the consultancy value is in the prioritization, effort estimation, and phasing, not the detection.

Pre-Flight™ can generate a comparable migration roadmap automatically. Not a replacement for deep architectural consulting, but a "first 80%" that gives teams a credible starting point — and makes the remaining 20% of consulting work more focused and valuable.

This is also the primary monetization unlock for Pre-Flight™. The free tier provides detection (the score, the findings). The paid tier provides planning (the roadmap, the effort estimates, the phased plan). Detection creates the urgency; planning captures the value.

## Decision

Add a Migration Roadmap Report that transforms scan findings into a prioritized, effort-estimated, phased remediation plan.

### Roadmap Structure

#### 1. Executive Summary

- Overall readiness score and grade (ADR-074)
- Total estimated effort (hours) to reach Cloud Service readiness
- Number of findings by severity
- Recommended migration timeline (weeks) based on team size input
- One-paragraph plain-English assessment: "This codebase has 47 issues requiring an estimated 120 hours of remediation. The primary blockers are deprecated API usage (40 hours) and content package restructuring (30 hours). A team of 2 developers could complete this migration in approximately 8 weeks."

#### 2. Workstream Breakdown

Group findings into logical workstreams that map to how teams actually organize migration work:

| Workstream | Description | Findings | Est. Hours |
|------------|-------------|----------|------------|
| Code Modernization | Deprecated APIs, legacy patterns, Java compatibility | 23 | 46 |
| Content Restructuring | Package structure, mutable/immutable separation | 8 | 32 |
| Configuration Migration | OSGi configs, run modes, RepoInit conversion | 12 | 18 |
| Dispatcher Migration | Dispatcher config, rewrite rules, cache config | 6 | 16 |
| Security Remediation | XSS, hardcoded credentials, unsafe patterns | 3 | 6 |
| Template/Component Modernization | HTL updates, Classic UI removal, Core Components | 5 | 12 |

#### 3. Effort Estimation Model

Each rule has an associated effort estimate based on typical remediation complexity:

```typescript
interface RuleEffort {
  ruleId: string;
  baseHours: number;         // effort for first occurrence
  additionalHours: number;   // effort for each additional occurrence (usually less due to pattern repetition)
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
}

const EFFORT_MAP: RuleEffort[] = [
  { ruleId: 'AMSCORE-553', baseHours: 2, additionalHours: 0.5, complexity: 'moderate' },
  { ruleId: 'ImmutableMutableMixed', baseHours: 8, additionalHours: 2, complexity: 'complex' },
  { ruleId: 'LegacyConfigFormat', baseHours: 0.25, additionalHours: 0.1, complexity: 'trivial' },
  { ruleId: 'UnsupportedRunMode', baseHours: 0.5, additionalHours: 0.25, complexity: 'simple' },
  // ... all rules
];

function estimateEffort(findings: Finding[]): number {
  let totalHours = 0;
  const grouped = groupBy(findings, f => f.ruleId);
  for (const [ruleId, ruleFfindings] of grouped) {
    const effort = EFFORT_MAP[ruleId];
    totalHours += effort.baseHours + (ruleFfindings.length - 1) * effort.additionalHours;
  }
  return totalHours;
}
```

Effort estimates include:
- **Trivial (< 15 min):** Mechanical changes like renaming a file, changing a format
- **Simple (15-60 min):** Pattern replacement like swapping a deprecated API call
- **Moderate (1-4 hours):** Refactoring that requires understanding context, like replacing a design pattern
- **Complex (4+ hours):** Structural changes like package restructuring, RepoInit migration

#### 4. Adobe Migration Phase Mapping

Map each workstream to Adobe's recommended migration phases:

| Adobe Phase | Pre-Flight Workstreams | Typical % of Effort |
|-------------|----------------------|---------------------|
| **Readiness** | Content restructuring, configuration audit | 20% |
| **Implementation** | Code modernization, dispatcher migration, template updates | 65% |
| **Go-Live** | Security remediation, final validation, performance testing | 15% |

#### 5. Priority Matrix

| Priority | Criteria | Action |
|----------|----------|--------|
| P0 — Do First | Blockers: pipeline will fail | Fix immediately |
| P1 — Do Soon | Critical: pipeline may fail or security risk | Fix within first sprint |
| P2 — Do Next | Major: best practice violations | Fix during implementation phase |
| P3 — Do Later | Minor/Info: nice-to-have improvements | Fix as time permits |

#### 6. Timeline Calculator

User inputs:
- Number of developers available
- Hours per week per developer
- Start date

Output:
- Gantt-style timeline showing workstreams across weeks
- Critical path (which workstreams must be done first)
- Estimated completion date
- "If you add 1 more developer, you finish 3 weeks sooner"

### Report Formats

- **In-browser:** Interactive dashboard with expandable workstreams
- **PDF:** Branded document suitable for management presentation (extends ADR-068)
- **CSV/JSON:** Machine-readable for import into Jira, Azure DevOps, etc.
- **Jira import:** Generate Jira-compatible CSV with epics (workstreams) and stories (individual findings)

### Monetization Gate

- **Free tier:** Gets the readiness score, letter grade, and finding list
- **Paid tier ($15-30/month):** Gets the full migration roadmap with effort estimates, phased plan, timeline calculator, and Jira export
- **Upgrade prompt:** "Your project needs an estimated 120 hours of migration work across 6 workstreams. Unlock the full Migration Roadmap to see the prioritized plan." with a preview showing the first workstream blurred/truncated

## Consequences

**Positive:**
- Transforms Pre-Flight™ from "scanner" to "migration planning tool" — fundamentally different value proposition
- Directly competes with $50-100K consultancy assessments at $15-30/month
- The effort estimates give teams ammunition to request resources and budget for migration
- Jira export creates immediate workflow integration — findings become trackable work items
- The timeline calculator makes the abstract ("we need to migrate") into the concrete ("8 weeks with 2 developers")
- Natural monetization boundary: detection is free (drives adoption), planning is paid (captures value)

**Negative:**
- Effort estimates are inherently approximate — teams may treat them as commitments
- Wrong estimates erode credibility faster than no estimates at all
- Complex to maintain as rules are added — every new rule needs an effort estimate
- Jira export format varies across Jira versions and configurations
- The "blurred preview" monetization pattern can feel manipulative if not done tastefully

**Mitigations:**
- All estimates display as ranges ("2-4 hours") rather than precise numbers
- Clear disclaimer: "Estimates are based on typical remediation patterns. Actual effort depends on codebase complexity, team familiarity, and testing requirements."
- Effort estimates are calibrated against real migration projects (use Focus GTS project data)
- Monetization preview shows enough value to demonstrate worth without feeling like a bait-and-switch

## Estimated Effort
- Effort estimation model and data: 2 days
- Workstream grouping logic: 1 day
- Priority matrix and phase mapping: 1 day
- Timeline calculator: 2 days
- In-browser roadmap dashboard: 2 days
- PDF roadmap report: 1 day
- CSV/Jira export: 1 day
- Monetization gate UI: 1 day
- **Total: 2 weeks**
