# ADR-009: Six-Phase Migration Lifecycle

## Status: Accepted

## Date: 2026-03-21

## Context

Enterprise migrations are complex multi-week projects that involve code changes, content transfers, integration rewiring, testing, and production cutover. Without a structured lifecycle, migrations devolve into ad-hoc processes where critical steps are skipped, dependencies are missed, and rollback becomes impossible.

Adobe's own migration documentation recommends a phased approach, but the specific phases vary by product. Black Hole needs a unified lifecycle model that works across all migration types (AEM, Analytics, Campaign, AEP/RTCDP, etc.) while being flexible enough to skip irrelevant phases for simpler migrations.

## Decision

We define a six-phase migration lifecycle:

### Phase 1: Assess

**Purpose:** Understand the current state of the source environment and determine migration readiness.

**Activities:**
- Connect to source environment via connector
- Scan code, content, configuration, and integrations
- Run AI-powered compatibility analysis
- Generate readiness score (see ADR-005)
- Identify risk factors and blockers
- Produce cost and timeline estimates
- Compare with traditional (manual) migration estimates

**Exit criteria:** Assessment report generated with overall score >= 40 (below 40 = "not recommended")

**Duration:** Typically 1-2 days for automated assessment; 1 week if manual review is included

### Phase 2: Plan

**Purpose:** Create a detailed migration plan based on assessment findings.

**Activities:**
- Prioritise findings by severity and dependency order
- Assign findings to transformation categories (auto-fix, guided fix, manual)
- Create work packages for manual items
- Define integration migration strategy
- Establish rollback procedures
- Set up staging environments
- Define success criteria for each subsequent phase

**Exit criteria:** Migration plan approved by stakeholder

**Duration:** Typically 1 week

### Phase 3: Transform

**Purpose:** Modernise code and configuration for the target platform.

**Activities:**
- Apply automated code transformations (see ADR-006)
- Convert configuration formats
- Migrate Oak index definitions
- Update dependency declarations
- Run guided fixes with developer assistance
- Manual refactoring for complex architectural changes
- Continuous integration testing against target SDK

**Exit criteria:** All code compiles against target SDK; no blocker findings remain

**Duration:** 2-8 weeks depending on codebase size and complexity

### Phase 4: Execute

**Purpose:** Deploy transformed code and transfer content to the target environment.

**Activities:**
- Deploy code packages to target environment
- Transfer content using incremental content transfer
- Migrate DAM assets with metadata preservation
- Configure target environment (run modes, cloud configs, etc.)
- Re-establish integrations on target platform
- DNS and SSL configuration for cutover

**Exit criteria:** All content and code deployed to target; integrations functional

**Duration:** 1-3 weeks depending on content volume

### Phase 5: Validate

**Purpose:** Verify that the migration meets quality, performance, and compliance standards.

**Activities:**
- Functional parity testing (page-by-page comparison)
- Performance benchmarking (Core Web Vitals comparison)
- SEO validation (meta tags, canonical URLs, sitemaps, redirects)
- Accessibility audit (WCAG 2.1 AA)
- Integration end-to-end testing
- Compliance verification (PII scan, consent check, data residency)
- User acceptance testing

**Exit criteria:** All validation suites pass or pass with accepted warnings

**Duration:** 1-3 weeks

### Phase 6: Monitor

**Purpose:** Observe the production environment post-cutover to catch issues early.

**Activities:**
- Real-time error monitoring
- Performance regression detection
- SEO ranking tracking (watch for search ranking drops)
- Analytics data continuity verification
- User feedback collection
- Rollback readiness maintenance (keep source environment available)

**Exit criteria:** 2 weeks of stable production operation with no critical issues

**Duration:** 2-4 weeks

### Phase Transitions

```
DRAFT -> [assess] -> ASSESSED -> [plan] -> PLANNED -> [transform] -> TRANSFORMING
  -> [execute] -> EXECUTING -> [validate] -> VALIDATING -> [complete] -> COMPLETED
```

At any point, a migration can transition to FAILED or CANCELLED. Rollback procedures are defined per phase.

### Phase Parallelisation

Some phases can overlap:
- Transform: code modernisation and content migration can run in parallel
- Execute: code deployment and content transfer can partially overlap
- Validate: different validation suites can run concurrently

The `parallelizable` flag on PhaseEstimate indicates which phases support overlap.

## Consequences

**Positive:**
- Clear progression model gives all stakeholders visibility into where the migration stands
- Each phase has explicit exit criteria, preventing premature advancement
- Phase-level progress tracking (0-100%) provides granular status reporting
- Rollback is possible at each phase boundary
- The model works across all migration types; irrelevant phases are simply skipped (e.g., analytics migrations skip Code Modernisation)
- Timeline and cost estimates can be broken down per phase for budgeting

**Negative:**
- Six phases may feel heavyweight for simple migrations (e.g., a small WordPress-to-AEM migration)
- Phase boundaries are somewhat artificial; real work often bleeds across phases
- The linear model does not capture well the iterative nature of some migrations (fix-test-fix cycles)

**Mitigations:**
- Simple migrations can combine phases (Transform + Execute as a single step)
- Phase status allows "processing" items to exist alongside "completed" ones, supporting iterative work
- The Monitor phase is optional for non-production migrations (dev/staging environments)

## Alternatives Considered

**Three-phase model (Prepare, Migrate, Verify):** Too coarse. Lumps assessment, planning, and transformation into "Prepare", making progress tracking meaningless for multi-week efforts.

**Continuous/agile model (no phases):** Works well for iterative development but poorly for migrations, which have a definitive start, end, and cutover moment. Stakeholders need to know "when will DNS switch over?" which requires a phase model.

**Adobe's Cloud Acceleration Manager phases:** CAM uses Readiness, Implementation, Go-Live. We expand this to six phases because CAM's "Implementation" phase is too broad (it covers both code changes and content migration, which have very different progress profiles and risk characteristics).
