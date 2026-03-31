# ADR-032: Effort Estimation Engine

## Status: Proposed

## Date: 2026-03-28

## Context

The #1 unmet need in AEM migration tooling is effort estimation. Adobe's BPA produces finding counts and severity labels (Critical/Major/Advisory/Info) but does not translate these into hours, developer-weeks, or dollars. Adobe's CAM provides qualitative "Low/Medium/High" complexity -- no numbers. Every SI firm (Oshyn, Valtech, NextRow, GSPANN, Bounteous) manually translates BPA output into effort estimates using their own proprietary methodology -- meaning there is no standardized tool for this. This manual estimation takes 2-4 weeks per engagement and is the first question every buyer asks.

Black Hole already has ADR-028 (Migration Cost Calculator) which defines a pricing model. ADR-032 extends this by defining HOW effort is estimated -- the engine that powers the calculator.

## Decision

Build an Effort Estimation Engine that maps migration finding categories to developer-week estimates, calibrated by finding type, environment complexity, and data confidence level.

### 1. Finding-to-Effort Mapping Table

Each BPA-equivalent finding code maps to an effort range:

| Finding Category | Examples | Effort Range |
|------------------|----------|--------------|
| Code-level findings | Deprecated APIs, OSGi configs | 0.5-2 developer-days per instance |
| Structural findings | Mutable/immutable violations, package restructuring | 2-5 developer-days per module |
| UI findings | Classic UI dialogs, static templates | 1-3 developer-days per component |
| Integration findings | Custom Sling Models, servlet registrations | 2-8 developer-days per integration |
| Content findings | Large nodes, vanity URLs, DAM structure | 1-5 developer-days per content area |

### 2. Complexity Multipliers

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Custom OSGi bundles | 1-10: 1x | 11-50: 1.5x | 50+: 2x |
| Content volume | < 100K pages: 1x | 100K-500K: 1.3x | 500K+: 1.8x |
| Integration count | 1-5: 1x | 6-15: 1.5x | 15+: 2.5x |
| Multi-site/multi-language | Single site: 1x | 2-5 sites: 1.3x | 5+: 1.8x |

### 3. Confidence Scoring

Each estimate carries a confidence level tied to the depth of data available:

- **External scan only** (ADR-030 data): 40-60% confidence -- "preliminary estimate"
- **BPA report uploaded**: 70-85% confidence -- "detailed estimate"
- **Full codebase analysis**: 85-95% confidence -- "high-confidence estimate"

### 4. Output Format

Every estimate produces:

- **Total effort** in developer-weeks (range, not single number)
- **Cost range** at standard blended rate ($200/hr) and premium rate ($350/hr)
- **Timeline range** based on team size (2-person, 4-person, 6-person team)
- **Top 5 effort drivers** -- which findings consume the most time
- **Industry comparison** -- estimate vs. industry average for similar-sized migrations

### 5. Learning Loop

Each completed migration feeds actual-vs-estimated data back into the model, improving accuracy over time. Target: estimates within 20% of actual after 10+ calibration data points.

## Consequences

**Positive:**

- Eliminates the 2-4 week manual estimation phase that SIs charge $25K-$75K for.
- Creates immediate value even before migration begins -- the estimate itself is a deliverable.
- Compounds in accuracy with each migration completed.

**Negative:**

- Early estimates (before calibration) may be inaccurate; must clearly label confidence levels.
- Effort estimation is inherently uncertain; must present ranges, never single numbers.
