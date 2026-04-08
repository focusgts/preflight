# ADR-063: Production Pilot Protocol

## Status: Proposed

## Date: 2026-04-08

## Context

Even after every engine is built, every test passes, and every ADR is implemented, running Black Hole against a real customer migration for the first time carries significant risk. Unit tests and sandbox validation cannot surface every edge case that real customer data will trigger.

A single failed production migration could:
- Damage the customer relationship permanently
- Trigger rollback costs we cannot absorb
- Create legal liability if content is lost
- Destroy Black Hole's reputation before it has one

We need a structured pilot protocol that minimizes blast radius while building real-world operational experience. The pilots also become reference case studies for sales.

## Decision

Run three pilot migrations in sequence, each with increasing risk and scope. Only advance to the next pilot after the previous one meets success criteria.

### Pilot 1 — Internal (Focus GTS Dual Sandbox)

**Goal**: Prove end-to-end execution works without a customer watching.

**Setup**:
- Source: Focus GTS sandbox (`p192456-e1992925`) with WKND content
- Target: A second Focus GTS sandbox we create via Cloud Manager
- Content: Full WKND sample project + any test content we add

**Scope**:
- All 31 pages
- All 589 DAM assets
- All 240 components (should migrate unchanged since both sandboxes are AEMaaCS)
- All 86 workflows
- Pre-flight analysis of WKND Java code

**Success Criteria**:
- Content count on target matches source (±1%)
- Regression test passes (<5% visual difference)
- All pre-flight rules fire correctly
- Drift monitoring captures baseline automatically
- Zero critical errors in audit log
- Total migration time under 4 hours
- Full state machine transitions work correctly

**Risk**: Zero. It is our own data, we can reset and retry freely.

**Duration**: 1-2 weeks of active testing

**Deliverables**:
- End-to-end test report
- Bug list with severities
- Performance baseline (throughput, latency, resource usage)
- Updated runbook for Pilot 2

### Pilot 2 — Friendly Customer (Navigator)

**Goal**: Prove we can handle real customer content patterns, not just WKND.

**Setup**:
- Source: Navigator's existing AEM instance (if they have one), or a greenfield AEM 6.5 instance we help them set up
- Target: AEMaaCS sandbox we create specifically for the pilot
- Content: Subset of their real content — 100 pages max, 500 assets max

**Scope**:
- Real customer content (not demo content)
- At least one custom component type
- At least one integration (analytics tag, search, etc.)
- One language variant or multi-site structure if available

**Success Criteria**:
- Pilot 1 criteria, plus:
- Navigator team signs off on migrated content
- No content loss (every page that existed in source exists in target)
- All metadata preserved (SEO tags, publication dates, authors)
- At least one integration reconnected successfully
- Post-mortem interview conducted within 1 week of completion

**Risk**: Low. Navigator is a friendly relationship with cushion for issues. Both teams understand this is a pilot.

**Duration**: 2-4 weeks

**Requirements**:
- Navigator consent in writing
- Pilot agreement specifying non-production status
- Agreed-upon rollback criteria
- Post-mortem interview scheduled in advance

**Deliverables**:
- Pilot 1 deliverables, plus:
- Customer testimonial (if successful)
- Real-content test report
- Edge case catalog (what broke that unit tests missed)

### Pilot 3 — Paid Pilot (AAA Washington or Similar)

**Goal**: Prove we can migrate a paying customer's real production content under contract.

**Setup**:
- Source: Real customer AEM 6.5 on-prem or AMS instance
- Target: Customer's AEMaaCS environment (provided by Adobe directly to customer)
- Content: Limited, contractually-scoped section — one microsite, one language, or one specific content tree

**Scope**:
- Limited to reduce blast radius (not the full site)
- Agreed-upon in writing before starting
- Covers 500-2,000 pages maximum
- Covers representative component usage

**Success Criteria**:
- Pilot 2 criteria, plus:
- Customer acceptance testing passes
- Migration completes within estimated window, plus or minus 20 percent
- Zero data loss confirmed via content audit
- Regression tests approved by customer
- Drift monitoring runs for 30 days post-go-live
- Customer signs off in writing

**Risk**: Medium. Paying customer, real production content, real expectations. Limited scope and strong rollback plan mitigate.

**Duration**: 4-6 weeks

**Requirements**:
- Formal contract with Focus GTS covering:
  - Scope of work
  - Rollback provisions
  - Liability limits
  - Success criteria
  - Payment milestones
- Navigator oversight (senior AEM consultant on-call)
- Customer-facing SLA with realistic commitments
- Insurance review of contract terms
- Approved rollback plan

**Deliverables**:
- Pilot 2 deliverables, plus:
- Signed contract case study
- Real ROI metrics (time saved, cost saved vs traditional SI estimate)
- Sales reference (with customer permission)
- Case study video or write-up

### Pilot Protocol (Applies to All Three)

Every pilot follows this sequence:

1. **Pre-pilot assessment** (2-3 days)
   - Connect Black Hole to source environment
   - Run full assessment, pre-flight, effort estimate
   - Review findings with customer
   - Agree on scope, timeline, success criteria in writing

2. **Pilot kickoff meeting**
   - Walk through the runbook
   - Confirm rollback criteria and decision authority
   - Set communication cadence (daily standups, Slack channel)
   - Confirm emergency escalation path

3. **Execution** (1-4 weeks depending on scope)
   - Two Focus GTS engineers monitor in real-time
   - Daily customer updates with progress, issues, ETA
   - Incident log for every pause, error, manual intervention
   - Immediate rollback if any success criteria is at risk

4. **Validation**
   - Run regression tests against target
   - Customer performs acceptance testing
   - Visual review of representative pages
   - Content count reconciliation

5. **Go-live** (if applicable)
   - Coordinate DNS cutover with customer
   - Monitor traffic and errors for 24 hours
   - Drift monitoring starts automatically
   - Rollback plan ready to execute

6. **Post-mortem** (within 1 week)
   - What went well
   - What broke
   - What was slower than expected
   - Customer satisfaction interview
   - Bug tickets filed for every issue
   - Product improvements identified

7. **Documentation**
   - Pilot report (success criteria, metrics, findings)
   - Customer case study draft
   - Product improvement backlog
   - Sales enablement material

### Go/No-Go Gates Between Pilots

**After Pilot 1**:
- All success criteria met
- Zero critical bugs remaining
- Performance baseline established
- **If any fail**: fix, re-run Pilot 1

**After Pilot 2**:
- All success criteria met
- Navigator formal sign-off
- Edge case catalog reviewed and product updated
- **If any fail**: fix, re-run Pilot 2 with adjusted scope

**After Pilot 3**:
- All success criteria met
- Customer acceptance and reference permission
- Runbook refined based on real execution
- Operational readiness confirmed
- **If successful**: Black Hole can be sold as a migration execution platform

### Gating Condition for Selling Execution

**Do not sell Black Hole as a "migration execution platform" until Pilot 3 completes successfully.**

Until then, the pitch is:
- "Best AEM assessment and planning platform on the market"
- "Real effort estimates with 70-90% accuracy"
- "Pre-flight analysis that catches issues Cloud Manager misses"
- "Execution features in active pilot testing with select customers"

This honesty protects the product reputation and creates natural urgency ("join our pilot program to be first").

## Consequences

### Positive
- Real operational experience before customer exposure
- Case studies and references built into the pilot program
- Bugs surface in controlled environments with forgiving customers
- Sales pitch becomes credible because every claim is backed by pilot data
- Navigator relationship strengthened through Pilot 2
- Paid pilot funds some of the work

### Negative
- 2 to 3 months of calendar time before we can sell execution
- Requires active engineering oversight during pilots (no "spawn and forget")
- Pilot failures could damage the Navigator relationship (mitigated by written pilot agreements)
- Paid pilot requires contract legal review
- Pilot scope limits mean some edge cases won't surface until full production

### Estimated Effort
- Pilot 1 planning and execution: 40-60 hours
- Pilot 2 planning and execution: 80-120 hours
- Pilot 3 planning and execution: 160-240 hours
- Bug fixes surfaced across all pilots: 80-160 hours
- Documentation, case studies, sales enablement: 40-60 hours
- **Total: 400-640 hours plus 2-3 months of calendar time**
