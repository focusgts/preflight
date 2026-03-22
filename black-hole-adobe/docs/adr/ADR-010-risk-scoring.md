# ADR-010: Risk Prediction Model Architecture

## Status: Accepted

## Date: 2026-03-21

## Context

Every migration carries risk. Customers need to understand not just their readiness score (ADR-005) but the probability and impact of specific risks materialising during the migration. Risk scoring informs go/no-go decisions, budget contingency allocation, and mitigation planning.

Risk factors are heterogeneous: some are technical (deprecated APIs, complex integrations), some are operational (team availability, parallel projects), and some are data-related (content volume, asset sizes). A simple checklist approach fails to capture the compound effects of multiple risk factors interacting.

## Decision

We implement a multi-factor risk scoring model with the following architecture:

### Risk Factor Identification

Risk factors are identified from three sources:

1. **Assessment findings:** Each finding contributes risk proportional to its severity and compatibility level
2. **Environment characteristics:** Content volume, codebase size, integration count, and platform version age
3. **Historical patterns:** Known risk patterns for specific migration types (e.g., AEM 6.5 to Cloud Service has well-documented risk areas)

### Risk Factor Structure

Each identified risk has:

```typescript
interface RiskFactor {
  id: string;
  severity: Severity;        // critical, high, medium, low
  category: string;          // technical, timeline, data, compliance, operational
  description: string;       // What could go wrong
  probability: number;       // 0.0-1.0, likelihood of occurring
  impact: string;            // Consequence if it occurs
  mitigation: string;        // How to reduce the risk
}
```

### Overall Risk Score Calculation

The overall migration risk score (0.0-1.0) is computed using a weighted combination:

```
riskScore = 1 - (assessmentScore / 100) * adjustmentFactor

adjustmentFactor = productOf(1 - riskPenalty(factor)) for each risk factor

riskPenalty(factor) = factor.probability * severityWeight(factor.severity) * categoryWeight(factor.category)
```

**Severity weights:**

| Severity | Weight |
|----------|--------|
| Critical | 0.15 |
| High | 0.10 |
| Medium | 0.05 |
| Low | 0.02 |

**Category weights:**

| Category | Weight | Rationale |
|----------|--------|-----------|
| Technical | 1.0 | Direct impact on migration success |
| Timeline | 0.8 | Affects delivery but migration can still succeed |
| Data | 0.9 | Data loss or corruption is high-impact |
| Compliance | 0.95 | Regulatory violations have severe consequences |
| Operational | 0.6 | Usually manageable with resource adjustments |

### Risk Levels

| Score Range | Level | Meaning |
|-------------|-------|---------|
| 0.00-0.20 | Low | Migration is low risk; proceed with standard monitoring |
| 0.21-0.40 | Medium | Some risks identified; mitigation plans should be in place |
| 0.41-0.70 | High | Significant risks; consider additional assessment and dedicated risk management |
| 0.71-1.00 | Critical | Major risks present; migration should not proceed without blocker resolution |

### Compound Risk Detection

Individual risk factors can compound. The model detects these compound patterns:

1. **Integration cascade:** Multiple critical integrations + tight timeline = compounded risk (multiplied by 1.3x)
2. **Skill gap + complexity:** Complex code changes + team unfamiliar with target platform = compounded risk (multiplied by 1.2x)
3. **Volume + compliance:** Large content volume + strict data residency requirements = compounded risk (multiplied by 1.25x)
4. **Blocker accumulation:** More than 3 blocker-level findings = exponential risk increase (each additional blocker adds 1.5x to the penalty of the previous)

### Risk Trajectory

The risk score is recalculated at each phase transition. As findings are resolved and phases complete, the risk score should decrease. If it increases (e.g., new issues discovered during transformation), the system alerts stakeholders.

```
Phase:    Assess  ->  Plan  ->  Transform  ->  Execute  ->  Validate
Risk:     0.45        0.42      0.30           0.18         0.08
```

### Risk Visualisation

The dashboard displays:
- Overall risk gauge (0-1 with colour coding)
- Risk factor breakdown by category (bar chart)
- Risk trajectory over time (line chart)
- Top 3 risks with mitigation status
- Compound risk warnings (highlighted callouts)

## Consequences

**Positive:**
- Quantified risk enables data-driven go/no-go decisions instead of gut feelings
- Per-factor risk breakdown is actionable: address the highest-probability, highest-impact factors first
- Compound risk detection catches dangerous combinations that individual factor analysis misses
- Risk trajectory provides early warning when a migration is trending toward failure
- Historical risk patterns improve accuracy for common migration types

**Negative:**
- Probability values are estimates, not empirical measurements (until we have historical data)
- The model may underestimate novel risks not captured by assessment findings
- Compound risk multipliers are heuristic; they may over- or under-weight certain combinations
- Risk scores can create false confidence (a low score does not guarantee success)

**Mitigations:**
- Risk scores are presented with confidence levels and explicit caveats in reports
- The model is conservative by design: when in doubt, risk is rounded up
- As migration outcome data accumulates, probability estimates will be calibrated empirically
- Human risk review is recommended for all migrations with risk score above 0.40
- The "operational" category captures risks that automated analysis cannot assess (team readiness, organizational change management)

## Alternatives Considered

**Binary risk flags (risk/no-risk):** Too coarse. Does not help customers prioritise which risks to address first or understand the magnitude of each risk.

**FMEA (Failure Mode and Effects Analysis):** Standard risk assessment methodology. Produces similar outputs (severity x probability = risk priority number) but requires manual expert input for each failure mode. We automate the identification step and use FMEA-like scoring for the calculation.

**Monte Carlo simulation:** Produces probability distributions for timeline and cost outcomes. More sophisticated but requires historical data distributions we do not have yet. Planned for v2 when sufficient migration outcome data is available.

**Flat risk score from assessment score only:** Simply inverting the assessment score (risk = 1 - score/100) ignores the nuance of individual risk factors, compound effects, and category-specific weights. The enriched model provides much more actionable information.
