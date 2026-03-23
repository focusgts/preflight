# ADR-022: Migration Simulation (Dry-Run Mode)

**Status:** Accepted
**Date:** 2026-03-22
**Authors:** Engineering Team

## Context

The number-three deal-killing objection from enterprise prospects is: "What if the migration breaks my production environment?" Traditional migration tools offer no preview capability -- customers must commit to a live migration and hope for the best.

This fear is rational. Adobe Experience Manager migrations touch content, code, configurations, integrations, and compliance artifacts. A bad migration can break pages, corrupt assets, disable integrations, and cause SEO damage that takes months to recover from.

We need a way to run the **entire migration pipeline** in a sandbox, show customers exactly what would happen, and give them a confidence score before they commit.

## Decision

Implement a **Migration Simulation Engine** that runs the full migration lifecycle in-memory with zero side effects.

### Architecture

```
SimulationEngine
├── Sandbox (in-memory virtual environment)
├── RiskSimulator (pattern-based risk prediction)
├── Assessment phase (compatibility analysis)
├── Code Modernization phase (predicted diffs)
├── Content Migration phase (reference validation)
├── Integration Reconnection phase (config validation)
└── Validation phase (sandbox integrity checks)
```

### Key Design Decisions

**1. In-Memory Sandbox**

All simulation runs in-process using a `Sandbox` class that holds a deep copy of migration items. Changes are applied as tracked operations with full audit trail and rollback support. No external APIs are called. No database writes occur. No files are created.

The sandbox tracks every change with before/after state, enabling diff views and rollback to any point.

**2. Same Engines, Dry-Run Mode**

The simulation reuses the same assessment patterns (BPA rules), classification logic, and validation checks as the real migration. This ensures predictions match reality. The key difference: instead of executing changes against live environments, we apply them to the sandbox state.

**3. Confidence Scoring**

Each simulation phase produces a confidence score (0-1) based on:
- Simulation depth (quick: 0.65 base, standard: 0.80, thorough: 0.92)
- Item count (large sets reduce per-item confidence)
- Blocker count (each blocker penalizes confidence)
- Failure outcomes (phases predicting failure reduce overall confidence)

Overall confidence is a weighted average across phases, with code modernization and validation weighted higher than content migration.

**4. Risk Matrix (Probability x Impact)**

The `RiskSimulator` evaluates simulation results against 8 historical risk patterns (informed by RuVector data). Each triggered pattern produces a risk with probability (1-5) and impact (1-5) scores. Risks are visualized in a 5x5 grid color-coded from green to red.

Risk levels:
- Critical: score >= 20
- High: score >= 12
- Medium: score >= 6
- Low: score < 6

**5. Three Depth Levels**

| Depth | Base Confidence | Use Case |
|-------|----------------|----------|
| Quick | 0.65 | Sales demos, initial feasibility |
| Standard | 0.80 | Pre-migration planning |
| Thorough | 0.92 | Final pre-migration validation |

Depth affects the analysis multiplier applied to estimated hours and issue detection sensitivity.

**6. Post-Migration Comparison**

After the real migration completes, customers can compare simulation predictions against actual results. This builds trust for future migrations and continuously validates our prediction accuracy.

Accuracy is measured as the inverse average deviation across duration, issue count, and success rate.

## Consequences

### Positive

- **Eliminates deal-killing objection**: Customers see exactly what will happen before committing
- **Reduces migration risk**: Issues discovered before production changes
- **Builds confidence**: Quantified confidence scores replace gut feelings
- **Improves sales**: "Run a simulation first" is a low-commitment entry point
- **Self-improving**: Comparison data feeds back to improve future predictions

### Negative

- **Simulation != reality**: In-memory simulation cannot perfectly predict all runtime behaviors (network latency, external API responses, content rendering)
- **Maintenance burden**: Simulation logic must stay synchronized with real engine changes
- **Memory usage**: Large migrations (50,000+ items) will consume significant memory during simulation
- **Confidence calibration**: Initial confidence scores are heuristic-based and need calibration against real migration data

### Risks

- Customers may over-rely on simulation results for edge cases the simulation cannot predict
- Simulation may give false confidence for migrations with heavy external dependencies

### Mitigations

- Edge case detection explicitly flags scenarios the simulation cannot fully predict
- Documentation clearly states simulation limitations
- Confidence scores are conservatively calibrated (better to under-promise)

## Alternatives Considered

1. **Staging environment clone**: Too expensive, too slow, requires infrastructure provisioning
2. **Read-only assessment only**: Does not answer "what would change" -- just "what issues exist"
3. **Rollback-capable migration**: Adds complexity to the real migration path and still risks temporary production impact

## Implementation

- `src/types/simulation.ts` — Type definitions
- `src/lib/simulation/simulation-engine.ts` — Core engine
- `src/lib/simulation/sandbox.ts` — In-memory sandbox
- `src/lib/simulation/risk-simulator.ts` — Risk prediction
- `src/app/api/simulations/` — API routes
- `src/app/(dashboard)/migrations/[id]/simulate/page.tsx` — UI
- `src/components/simulation/` — Report and risk matrix components
