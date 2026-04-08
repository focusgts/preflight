# Pre-Flight as a Standalone Product — Business Plan

**Owner**: Focus GTS
**Date created**: 2026-04-08
**Status**: Proposal — revisit after Phase 2 testing complete
**Related**: ADR-036 (Cloud Manager Pre-Flight Simulation), ADR-031 (Competitive Positioning vs Adobe BPA/CAM), Sandbox validation Phase 4 + Phase 5

## Executive Summary

Black Hole Pre-Flight was built as Gap 6 of our competitive positioning against Adobe's migration toolset — a feature of the broader Black Hole migration platform. Phase 4 and Phase 5 sandbox testing surfaced that pre-flight has capabilities and economics that make it viable as a **standalone SaaS product**, independent of any migration engagement.

This document captures the business case, market analysis, pricing strategy, and go-to-market plan so we can make an informed decision after the remaining rule coverage testing is complete.

**The one-line thesis**: Pre-flight catches Cloud Manager pipeline failures on a developer's laptop in under a second, replacing 8-15 minute Adobe Cloud Manager round trips. It is 7,200x faster than Cloud Manager, costs near-zero to run, has no direct competitor, and serves every AEM as a Cloud Service customer forever — not just those migrating.

---

## The Core Value Proposition

### The Problem

Every enterprise running AEM as a Cloud Service pushes code through Adobe Cloud Manager. Cloud Manager runs its own quality gates (SonarQube CQRules custom ruleset, OakPAL content-package validation, Java runtime compatibility checks) before allowing a deployment. The pipeline takes **8 to 15 minutes** per run. Industry data suggests **30-40% of runs fail** during active development because developers cannot validate their code against Cloud Manager's rules locally.

For a team of 10 developers doing 3-4 pipeline runs per day, this is **84-140 minutes per day of pure wait time**. Over a 6-month project that equals ~168 hours of wasted developer time at a loaded cost of roughly $33,600 — and the opportunity cost of context-switching multiplies that impact 2-3x.

### The Solution

Black Hole Pre-Flight implements the same rule categories Cloud Manager runs (SonarQube CQRules, OakPAL index validation, Java runtime compatibility) as pure regex pattern matching in JavaScript. No Maven build. No JVM startup. No network round trip. Results in under 50 milliseconds.

Developers run pre-flight locally before pushing. They fix everything pre-flight flags. Only then do they push to Cloud Manager, which passes on the first try. The 8-15 minute feedback loop becomes a 50ms feedback loop.

### The Proof Line

**49 milliseconds for 50 files. Cloud Manager takes 12 minutes for the same work.**

Benchmark verified against the Focus GTS Partner Sandbox (Phase 5 Test 5.3, 2026-04-08):

| Files | Wall Clock | Throughput |
|-------|------------|------------|
| 50 | 49ms | 1,020 files/sec |
| 100 | ~98ms | 1,020 files/sec |
| 1,000 | ~1 second | 1,020 files/sec |
| 10,000 (large enterprise) | ~10 seconds | 1,020 files/sec |

Zero false positives against Adobe's own sample WKND code (Phase 4 Test 4.2, 48 rule checks, 0 findings).

---

## Two Products, Two Markets

Pre-flight has two completely distinct use cases, and recognizing the split is critical for business strategy.

### Use Case 1: Migration Pre-Flight (embedded in Black Hole platform)

- **Customer**: On AEM 6.5 / AMS, planning to move to Cloud Service
- **Value**: Catch migration blockers before burning weeks of Cloud Manager cycles during transformation
- **Market size**: ~14,000-26,000 AEM 6.5 customers on the February 2027 / August 2026 deadlines
- **Deal shape**: One-time professional services, $50K-$1M per engagement
- **Lifetime**: Bounded — collapses after 2028 when migration demand crashes
- **Status today**: Already shipping as a feature of the Black Hole migration platform

### Use Case 2: Ongoing Development Pre-Flight (proposed standalone SaaS)

- **Customer**: Already on AEMaaCS, doing normal day-to-day development work
- **Value**: Every deployment through Cloud Manager is 8-15 minutes. Pre-flight makes the feedback loop instant for every developer, every commit, every day.
- **Market size**: Every AEMaaCS customer forever (~5,000-10,000 customers today, growing)
- **Deal shape**: Recurring SaaS subscription, $99-$499+/month
- **Lifetime**: Permanent — no deadline, no sunset
- **Status today**: The engine exists. Nothing consumer-facing is built for this use case.

**The strategic reframe**: Black Hole is not a migration platform with pre-flight as a feature. It is a **developer tooling company** with a migration product and a pre-flight product that happen to share an engine.

---

## Market Analysis

### Addressable Market (Standalone SaaS)

Conservative math based on public Adobe data:

| Segment | Estimate |
|---------|----------|
| Total AEMaaCS customers today | 5,000-10,000 |
| Growing at | ~20-30% annually (Adobe pushing cloud migration) |
| Average AEM developer team size | 5-15 devs |
| Customers likely to adopt dev tools in CI/CD | ~70% |
| Realistic market (year 1) | 3,500-7,000 customers |

At **5% capture** over 24 months: **175-350 paying customers**
At **$24K average ACV** (Team tier, see pricing): **$4.2M-$8.4M ARR**

This is not a hand-wavy TAM exercise. This is the conservative slice after applying realistic capture rates. The actual upside is 3-5x larger if a partner program with SIs like Bounteous, Perficient, Wunderman Thompson materializes.

### Customer ROI Math

For a typical customer (10 AEM developers, actively building on AEMaaCS):

**Cost of doing nothing**:
- 10 devs × 4 runs/day × 35% failure rate × 10 min/failure = **140 minutes/day of pure Cloud Manager wait time**
- 2.3 hours/day × 260 working days = **~600 hours/year**
- Loaded cost at $200/hour = **$120,000/year wasted**
- Plus 2-3x opportunity cost from context-switching = **$240,000-$360,000/year impact**

**Pre-flight investment**:
- Team tier: **$99/month = $1,188/year**
- Enterprise tier (larger org): **$499/month + $20/seat × 10 = $8,388/year**

**ROI**: 100x to 300x. Payback period: first week of use.

The pricing power is strong because the customer's own math sells the product.

---

## Competitive Landscape

Full competitive research documented in the 2026-04-08 report. Summary:

| Category | Count | Notes |
|----------|-------|-------|
| **Direct competitor** | **0** | No tool in market runs local sub-second Cloud Manager quality gates |
| **Adjacent (Adobe)** | 4 | aemanalyser-maven-plugin (Maven, tens of seconds), OakPAL CLI (JVM, seconds), AEM Rules for SonarQube (server-side), aio cloudmanager CLI (API wrapper only) |
| **Adjacent (third-party)** | 3 | SonarLint connected mode (closest in shape, missing OakPAL + Java runtime + aggregation), Publicis Sapient Slingshot (refactor, not gate-check), Infogain Refactor.ai (code transformation) |
| **Referenced only** | 5+ | SI internal scripts (Bounteous, Perficient, Valtech, Wipro, Accenture) — none productized |
| **Commercial products (Snyk, Veracode, etc.)** | 0 | No AEM-specific rule packs sold as SKUs |

**Category gap confirmed.** No anchor price below us. Pricing power is strong.

### Defensibility Concerns

Three honest risks to flag:

1. **Rules are open source**: Adobe publishes aemanalyser-maven-plugin, CQRules, and OakPAL. Anyone can fork. The moat is not rules — it is speed, UX, aggregation, IDE integration, and the Black Hole learning network.

2. **Adobe could ship `aio aem preflight` tomorrow**: The most serious long-term threat. Adobe owns the rules and could commoditize this with a free CLI. Mitigation: ship pre-flight as a feature of the broader Black Hole platform so Adobe commoditizing a feature doesn't zero our business. Also: ship the free CLI ourselves first to brand the category.

3. **SI internal tools productizing**: Bounteous, Perficient, and others likely have internal Maven profiles wired to the analyser plugin. None have productized. If pre-flight succeeds, they will. Mitigation: speed to market (12-24 month first-mover window), IDE polish they won't match, partner channel program that converts them into distribution partners instead of competitors.

---

## Pricing Strategy

### Recommended Tier Structure

#### Web UI — Free Forever (no signup)
- Unlimited runs via `/preflight` web form
- Paste code, see results instantly
- Rate-limited at 100 runs/hour per IP
- No history, no sharing, no reports, no auth
- **Purpose**: Top-of-funnel lead generation. Zero friction viral tool.

#### Starter — Free (with signup)
- Unlimited web UI runs
- Free CLI (`npx @blackhole/preflight`) with anonymous usage
- 1 connected project (single repo)
- 100 CI/CD runs per month (GitHub Actions, pre-commit hooks)
- 30-day findings history
- Shareable report URLs
- **Purpose**: Individual developer tier. Developers adopt without permission, then advocate internally.

#### Team — $99/month
- Everything in Starter
- Up to 5 connected projects
- Unlimited CI/CD runs
- Forever findings history
- Up to 10 team members
- Email + Slack notifications
- PDF report export
- Priority rule updates
- **Purpose**: Under the procurement threshold ($100/month). Any tech lead can expense it on a corporate card.

#### Enterprise — $499/month base + $20/seat
- Everything in Team
- Unlimited projects
- Unlimited seats
- SSO / SAML
- Audit log (leveraging ADR-061 infrastructure)
- Custom rule packs (bring your own internal rules)
- On-premises deployment option (critical for banks, healthcare, government)
- Priority support, SLA, dedicated Slack channel
- Quarterly business review with Focus GTS Navigator
- **Purpose**: Real enterprise SaaS contract. VP Engineering buy.

#### White-Label / Partner — Custom
- SI partners (Bounteous, Perficient, Wunderman Thompson, etc.) resell under their own brand
- Bulk seat discounts
- Revenue share on new Focus GTS leads they source
- **Purpose**: Distribution via existing AEM consultancy channels.

### Why This Structure Works

1. **Genuinely free tier**, not a 14-day trial. Developers trust products with real free tiers. A paywall-after-trial tool gets uninstalled by day 15. A free-forever tool gets embedded.

2. **Upgrade trigger is success, not failure**. You don't pay because you hit a limit. You pay because you're using it enough that it's saving real time. That conversion feels good.

3. **$99/month is below procurement**. Critical for bottom-up adoption. Above $100 you're in a 4-week purchase cycle.

4. **Enterprise tier has SSO and on-prem**. These are the two must-have features for regulated industries that can't send source code to a third-party cloud.

### Alternative Model: Usage-Based Instead of Tier-Based

An alternative to consider is pure usage-based pricing:
- Free: 10,000 files analyzed per month
- Paid: $0.005 per additional file

Pros: aligns cost perfectly with value. No complex tier gating.
Cons: bill is unpredictable for customers. Harder to explain. Doesn't match how buyers in this space think about software pricing.

**Recommendation**: Stick with tiers. Developers understand tiers. Finance departments understand tiers. Usage-based works for infrastructure (Vercel, AWS) but not for developer tools.

---

## Go-to-Market Strategy

### Phase 1 — Navigator Lead Generation (This Week, 0 Engineering)

No product build needed. Navigators use the existing `/api/preflight` endpoint as a diagnostic tool for lead generation:

1. Navigator asks prospect for a few Java files or a Maven module zip
2. Navigator runs pre-flight via curl or the existing dashboard
3. Gets back a findings report in <1 second
4. Sends prospect a PDF summary: "Here are X issues Cloud Manager will reject on your next push"
5. Navigator uses the report as the door-opener for a full Black Hole migration assessment

**Cost**: zero engineering, 4-6 hours for the PDF template
**Outcome**: Navigators have an immediate free qualification tool that converts to paid migration engagements

### Phase 2 — Public Free Tool (Month 1-2)

Build the public `/preflight` landing page as a viral developer acquisition tool:

- URL: `blackhole.focusgts.com/preflight` (or similar)
- Paste code → instant results → "Save this report / Get notified about new Cloud Manager rules" lead capture
- Zero auth, zero account creation
- Every submission becomes a lead in the Focus GTS CRM
- Share buttons (LinkedIn, Slack, Twitter) for viral distribution

**Cost**: 2-3 days of engineering
**Outcome**: Top-of-funnel lead machine. Every developer who pastes code is qualified.

### Phase 3 — Tier Rollout (Month 3-4)

Build the Starter / Team / Enterprise SaaS infrastructure:
- Auth, billing (Stripe), usage metering, feature flags per tier
- Findings history, team seats, Slack integration, PDF export
- GitHub Action for CI/CD integration
- First paying customers onboarded

**Cost**: 4-6 weeks of engineering, hire 1 part-time support person
**Outcome**: First recurring revenue. Prove the SaaS business model.

### Phase 4 — Enterprise & Partner (Month 6+)

- SSO, custom rule packs, on-premises deployment option
- Partner program for SIs with white-label and rev-share
- Quarterly rule updates aligned with Adobe's Cloud Manager releases

**Cost**: ongoing
**Outcome**: Enterprise contracts, SI distribution, recurring revenue scale

---

## Operational Considerations

### The Hidden Cost of Freemium SaaS

Running a freemium product is operationally heavier than most companies estimate. Real costs include:

- **Auth system**: already have it
- **Billing infrastructure**: Stripe integration, ~$10/month + 2.9% of revenue
- **Usage metering**: build or use a service like Openmeter
- **Feature flag system**: per-tier gating
- **Support burden**: free users still ask for help, and they consume support time disproportionately
- **Churn management**: ongoing customer success work
- **Fraud and abuse**: rate limiting, IP blocklists, prevent API key sharing

For a consulting shop like Focus GTS, adding a freemium SaaS is a real commitment. It means at minimum **one full-time person** whose job is keeping the SaaS running. This is not "ship and forget."

### The Lower-Operational-Cost Alternative

If the operational overhead of freemium feels too heavy, the alternative is **seeded free**:

- Ship the free CLI with no account, no metering, no billing
- Anyone can use it forever for free
- For paid features (history, team seats, CI/CD integration), customer contacts Focus GTS for a custom contract
- Each contract is sold as professional services with a negotiated price

This is lower leverage (manual sales, no self-serve) but it fits Focus GTS's current consulting shape and requires zero new operational infrastructure. It is the safer starting point.

**Recommendation**: Start with seeded free (Phase 1 Navigator lead gen → Phase 2 public landing page → manually-sold contracts). Only build the tiered SaaS infrastructure (Phase 3) after there is demonstrated market pull and a clear path to enough revenue to justify the operational cost.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Adobe ships a free `aio aem preflight` CLI | Medium | High (could zero a standalone SaaS) | Ship pre-flight as part of the broader Black Hole platform, not standalone. Brand the category first. |
| SI internal tools get productized | Medium | Medium | 12-24 month first-mover window; convert SIs into distribution partners via white-label program |
| False positives damage credibility | Medium | High | Complete rule coverage testing (16/16 rules). Honest marketing: "catches 80% of Cloud Manager failures, Cloud Manager itself catches the 20% requiring real compile" |
| Free tier abused for rule discovery | Low | Low | Rate limiting, no auth required |
| Customers don't convert from free to paid | Medium | Medium | Phase 3 SaaS investment gated on Phase 1/2 lead-gen validation |
| Adobe changes quality gate rules frequently | Medium | Low | Subscribe to Adobe Cloud Manager release notes; update rules quarterly |

---

## Success Metrics

### Phase 1 (Navigator Lead Gen)
- Number of pre-flight diagnostics run for prospects (target: 10 per week)
- Conversion rate from diagnostic → paid assessment (target: 20%)
- New migration deals sourced via pre-flight (target: 2 per month)

### Phase 2 (Public Landing Page)
- Monthly unique visitors to `/preflight` (target: 1,000 in month 1, 10,000 by month 6)
- Conversion to email capture (target: 15%)
- Qualified leads generated (target: 50/month by month 6)

### Phase 3 (Tier Rollout)
- Free signups (target: 500 by end of quarter)
- Paid conversions (target: 5% of free → paid)
- MRR (target: $10K by month 6, $50K by month 12)
- Logo count (target: 20 paying customers by end of year 1)

### Phase 4 (Enterprise)
- Enterprise contracts (target: 3 by end of year 1)
- Partner program signed SIs (target: 2 by end of year 1)
- ACV (target: $50K average Enterprise contract)

---

## Open Questions to Resolve

Before committing to this as a standalone product, the following need answers:

1. **Rule coverage completeness**: 8 of 16 pre-flight rules have been tested against live data. Remaining 8 need coverage tests. **Blocking for launch.**

2. **False positive rate on real customer code**: We have zero false positives on WKND sample code. We need to test against diverse real customer codebases (5-10 samples) to measure actual false positive rate.

3. **Adobe roadmap intelligence**: Has Adobe signaled plans for a local quality gate CLI? Check Adobe Summit 2026 sessions, Cloud Manager release notes, Adobe Developer blog for keywords "shift-left," "local validation," "pre-flight."

4. **Customer willingness to pay**: Run the pricing test on 5 Navigator conversations this month. "Team tier is $99/month. Does that sound reasonable?" Calibrate based on responses.

5. **Operational commitment**: Is Focus GTS willing to hire 1 FTE support role to run a freemium SaaS? If no, the seeded-free model is the right shape.

6. **Partner appetite**: Would Adobe Navigators use pre-flight as a lead-generation tool? Would any major SI partner be willing to white-label it? One conversation with each is enough to validate.

---

## Related Documents

- `docs/adr/ADR-036-cloud-manager-preflight.md` — Original pre-flight engine ADR
- `docs/adr/ADR-031-competitive-positioning-vs-adobe-tools.md` — Gap 6 where pre-flight fits into broader Black Hole positioning
- `docs/strategy/ams-deadline-playbook.md` — Related GTM playbook for migration use case
- `docs/testing/sandbox-validation-plan.md` — Phase 4/5 testing results that validated pre-flight performance
- `src/lib/preflight/cloud-manager-rules.ts` — The rule implementation
- `src/app/api/preflight/route.ts` — Standalone pre-flight API endpoint (no migration required)

---

## Next Steps (Immediate)

1. **Complete rule coverage testing**: Write 16 single-rule test fixtures, verify all 16 rules fire correctly against targeted inputs. **~2 hours of work.**
2. **Measure false positive rate on real code**: Extract 3-5 more real WKND and learning HTL/Java files from the sandbox, run pre-flight, confirm zero false positives.
3. **Revisit this document**: After testing is complete, validate the performance claims and update the proof line numbers if needed.
4. **Decision point**: Choose Phase 1 (Navigator lead gen only) or commit to the full Phase 1-4 rollout.

Document created as a living proposal — update as testing completes and market feedback lands.
