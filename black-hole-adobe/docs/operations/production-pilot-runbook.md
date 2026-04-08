# Production Pilot Runbook

## Purpose

This runbook defines how Focus GTS conducts Black Hole migration pilots. Three pilots run in sequence, each with increasing risk and scope. A pilot only advances to the next stage after meeting its success criteria.

The gating condition is simple: **Black Hole is not sold as a migration execution platform until Pilot 3 completes successfully.** Until then, Black Hole is positioned as the best AEM assessment and planning platform on the market, with execution features in active pilot testing.

---

## Pilot 1 — Focus GTS Internal (Dual Sandbox)

### Goal
Prove end-to-end execution works against real AEMaaCS instances without any customer involvement.

### Setup

**Source environment**: Focus GTS sandbox (`p192456-e1992925`) with WKND content deployed
**Target environment**: A second Focus GTS sandbox we provision for this pilot
**Content scope**: Full WKND sample project (31 pages, 589 DAM assets, 240 components, 86 workflows)
**Timeline**: 1-2 weeks of active testing
**Team**: 2 Focus GTS engineers

### Success Criteria

| Criterion | Target |
|-----------|--------|
| Content count match | Target pages and assets equal source (+/- 1%) |
| Regression test | Visual diff < 5% across all pages |
| Pre-flight rules | All 16 rules fire correctly against planted test code |
| Drift monitoring | Baseline captured automatically after go-live |
| Audit log completeness | Every operation logged, no gaps |
| Migration duration | Under 4 hours total wall-clock time |
| State machine transitions | All phase transitions complete without manual SQL intervention |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Sandbox hibernation mid-test | Pre-warm both sandboxes before starting |
| Cloud Manager API rate limits | Batch requests, respect Retry-After headers |
| Token expiry mid-migration | Refresh token every 12 hours as part of the test script |
| Unexpected bugs | Reset target and retry freely — zero customer impact |

### Deliverables

- End-to-end test report
- Bug list with severities (critical/high/medium/low)
- Performance baseline document (throughput, latency, resource usage)
- Updated runbook for Pilot 2 based on findings

### Go/No-Go Gate
Advance to Pilot 2 only after:
- All success criteria met
- Zero critical bugs remaining
- Performance baseline established and acceptable
- Runbook updated with lessons learned

---

## Pilot 2 — Navigator (Friendly Customer)

### Goal
Prove Black Hole handles real customer content patterns, not just WKND demo content.

### Setup

**Source environment**: Navigator's existing AEM instance, or a greenfield AEM 6.5 instance Focus GTS helps them stand up
**Target environment**: AEMaaCS sandbox created specifically for the pilot
**Content scope**: Subset of real Navigator content — 100 pages max, 500 assets max, including at least one custom component and one integration
**Timeline**: 2-4 weeks
**Team**: 2 Focus GTS engineers + 1 Navigator point of contact

### Pre-Pilot Requirements

1. Written consent from Navigator
2. Pilot agreement document specifying:
   - Non-production status
   - Scope boundaries
   - Rollback criteria
   - Communication cadence
   - Post-mortem commitment
3. Navigator point of contact identified
4. Slack channel or equivalent for real-time communication
5. Scheduled post-mortem interview before the pilot begins

### Success Criteria

Pilot 1 criteria, plus:

| Criterion | Target |
|-----------|--------|
| Content preservation | Every source page exists in target (100% count match) |
| Metadata preservation | SEO tags, publication dates, authors all preserved |
| Custom component migration | At least one custom component type migrates successfully |
| Integration reconnection | At least one integration (analytics, search, etc.) reconnected and verified |
| Navigator sign-off | Navigator team signs off on migrated content quality |
| Post-mortem completion | Interview conducted within 1 week of pilot completion |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Unknown content patterns break the migrator | Pilot scope limited to 100 pages; rollback fast |
| Relationship damage if pilot fails | Clear non-production status in agreement; no customer-facing impact |
| Navigator team unavailable | Schedule check-ins in advance; have backup contact |
| Scope creep during pilot | Written scope document referenced at every status meeting |

### Deliverables

Pilot 1 deliverables, plus:
- Customer testimonial (if successful)
- Real-content test report
- Edge case catalog (what broke that unit tests missed)
- Navigator-specific runbook

### Go/No-Go Gate
Advance to Pilot 3 only after:
- All success criteria met
- Navigator formal written sign-off
- Edge case catalog reviewed and product updated
- All bugs from Pilot 2 fixed or documented as known issues

---

## Pilot 3 — Paid Pilot (First Real Customer)

### Goal
Prove Black Hole can migrate a paying customer's real production content under contract.

### Setup

**Source environment**: Real customer AEM 6.5 on-premises or AMS instance
**Target environment**: Customer's AEMaaCS environment (provided by Adobe)
**Content scope**: Contractually-scoped section — one microsite, one language variant, or one specific content tree. 500-2,000 pages maximum.
**Timeline**: 4-6 weeks
**Team**: 2 Focus GTS engineers + Navigator senior consultant on-call

### Pre-Pilot Requirements

1. Formal contract covering:
   - Scope of work (precise page counts and content trees)
   - Rollback provisions
   - Liability limits
   - Success criteria
   - Payment milestones (deposit, milestone, completion)
2. Insurance review of contract terms completed
3. Customer-facing SLA with realistic commitments
4. Approved rollback plan (can revert DNS in under 15 minutes)
5. Navigator senior consultant assigned as oversight
6. Customer acceptance testing plan defined upfront

### Success Criteria

Pilot 2 criteria, plus:

| Criterion | Target |
|-----------|--------|
| Customer acceptance testing | Passes customer-defined UAT suite |
| Window compliance | Migration completes within estimated window +/- 20% |
| Data loss | Zero — confirmed via content audit |
| Regression approval | Customer approves all regression test results |
| Drift monitoring | Runs continuously for 30 days post-go-live |
| Written sign-off | Customer signs off in writing |

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Production content corruption | Limited scope (not full site); strong rollback plan with tested reversal |
| Timeline slip | 20% buffer built into customer window; daily status updates |
| Customer relationship damage | Contract rollback provisions; Navigator oversight; insurance coverage |
| Edge case discovered mid-migration | Pause state machine, diagnose, fix, resume |
| Post-go-live drift | Drift monitoring runs 24/7 for 30 days, alerts on anomalies |

### Deliverables

Pilot 2 deliverables, plus:
- Signed contract case study
- Real ROI metrics (time saved, cost saved vs traditional SI estimate)
- Sales reference (with written customer permission)
- Case study document or video
- Production runbook updates

### Go/No-Go Gate

After Pilot 3 succeeds, Black Hole can be sold as a migration execution platform.

Until Pilot 3 succeeds, sales positioning is:
- "Best AEM assessment and planning platform on the market"
- "Real effort estimates with 70-90% accuracy"
- "Pre-flight analysis that catches issues Cloud Manager misses"
- "Execution features in active pilot testing with select customers"

---

## Pilot Execution Protocol

Every pilot, regardless of stage, follows this sequence.

### Phase 1 — Pre-Pilot Assessment (2-3 days)

1. Connect Black Hole to source environment
2. Run full assessment, pre-flight, effort estimate
3. Review findings with customer
4. Document agreed scope, timeline, and success criteria in writing
5. Get customer sign-off on the plan before any execution begins

### Phase 2 — Pilot Kickoff Meeting

1. Walk through the runbook with all parties
2. Confirm rollback criteria and who has authority to invoke rollback
3. Set communication cadence:
   - Daily standup during active execution
   - Dedicated Slack channel or equivalent
   - Emergency escalation path with phone numbers
4. Confirm post-mortem interview is scheduled before kickoff

### Phase 3 — Execution (1-4 weeks)

1. Two Focus GTS engineers monitor in real-time
2. Daily customer updates including:
   - Progress (pages migrated, assets transferred, phases completed)
   - Issues encountered
   - Current ETA vs original estimate
3. Incident log for every pause, error, or manual intervention
4. Immediate rollback consideration if any success criterion is at risk
5. Escalate to Navigator oversight (Pilot 3) for any critical decision

### Phase 4 — Validation

1. Run regression tests against target
2. Customer performs acceptance testing
3. Visual review of representative pages
4. Content count reconciliation between source and target
5. Integration smoke tests

### Phase 5 — Go-Live (if applicable)

1. Coordinate DNS cutover with customer (pre-scheduled maintenance window)
2. Monitor traffic and errors for 24 hours post-cutover
3. Drift monitoring starts automatically
4. Rollback plan ready to execute if needed

### Phase 6 — Post-Mortem (within 1 week of completion)

Meeting agenda:
1. What went well
2. What broke
3. What was slower than expected
4. Customer satisfaction interview
5. Bug tickets filed for every issue found
6. Product improvements identified
7. Runbook updates captured

### Phase 7 — Documentation

1. Pilot report with success criteria results, metrics, and findings
2. Customer case study draft (if pilot succeeded)
3. Product improvement backlog updated
4. Sales enablement material (if pilot succeeded)

---

## Emergency Procedures

### Auto-Pause Triggers

The migration orchestrator automatically pauses (requires human resume) when:
- 3 consecutive batch failures
- 10% or more item failure rate across any phase
- Source or target unreachable for 60+ seconds
- Any `FatalError` thrown
- User-initiated pause via API

### Manual Pause Protocol

1. Any team member can call for a pause during active execution
2. Call in the Slack channel: "PAUSE - [reason]"
3. Engineer on duty invokes `PATCH /api/migrations/[id]` with `status: paused`
4. Review the issue with the team
5. Decide: fix and resume, or roll back
6. Document the pause in the incident log

### Rollback Protocol (Pilot 3 only)

Rollback criteria (any one triggers rollback consideration):
- Data loss detected
- Customer acceptance testing fails on critical pages
- Migration window exceeded by more than 50%
- Production traffic errors post-cutover
- Customer requests rollback

Rollback procedure:
1. Pause the migration orchestrator
2. Revert DNS records to source environment
3. Verify source is serving traffic correctly
4. Purge CDN cache
5. Communicate rollback to customer and stakeholders
6. Document in incident log
7. Schedule root cause analysis

---

## Communication Templates

### Daily Status Update

```
Pilot: [Pilot name]
Date: [Date]
Phase: [Current phase]
Progress: [X% of total, Y pages migrated, Z assets transferred]
Issues encountered today: [List or "none"]
ETA: [Original: X days / Current: Y days]
Next 24 hours: [Plan]
Blockers: [List or "none"]
```

### Incident Report

```
Incident ID: [Unique ID]
Date/Time: [When it happened]
Severity: [Critical/High/Medium/Low]
What happened: [Description]
Impact: [What was affected]
Detection: [How we noticed]
Response: [What we did]
Root cause: [Why it happened]
Resolution: [How we fixed it]
Prevention: [How to prevent next time]
```

### Customer Update (Pilot Completion)

```
Hi [Customer],

The [Pilot 3] migration is complete. Here is a summary:

- Pages migrated: X of Y planned
- Assets transferred: X of Y planned
- Total duration: X hours
- Issues encountered: X, all resolved
- Target environment validated

We will run drift monitoring for the next 30 days to ensure stability.
Please review [URL] and confirm the acceptance testing results.

Post-mortem interview scheduled for [date].

Thank you for partnering with us.
```

---

## Change Log

| Date | Author | Summary |
|------|--------|---------|
| 2026-04-08 | Focus GTS | Initial runbook creation |
