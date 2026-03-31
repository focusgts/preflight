# ADR-031: Competitive Positioning vs. Adobe BPA/CAM

## Status: Accepted

## Date: 2026-03-28

## Context

Adobe provides two free migration readiness tools for AEM customers: **Best Practices Analyzer (BPA)** and **Cloud Acceleration Manager (CAM)**. These are the incumbent tools that Black Hole competes against. Understanding their exact capabilities and limitations is critical to positioning Black Hole's value proposition.

**BPA** is a closed-source AEM package that must be installed inside the customer's AEM instance. It requires admin access to a running AEM author environment and produces a raw findings report of migration incompatibilities.

**CAM** is a SaaS dashboard at `experience.adobe.com` that ingests BPA reports and presents them alongside migration guidance. It requires Adobe IMS login and active AEM entitlement — meaning only existing Adobe customers can access it.

Together, these tools cover the basics of migration readiness assessment. However, they were designed as checklists for Adobe's own migration path, not as comprehensive assessment platforms. This leaves structural gaps that no amount of incremental improvement will close, because Adobe's incentive is to sell Cloud Service subscriptions, not to provide deep pre-sales diagnostics.

## Decision

Black Hole positions against Adobe's tools across **10 structural gaps** that Adobe has deliberately left unfilled.

### Gap 1: No Numeric Score

CAM gives qualitative Low/Medium/High severity ratings. There is no weighted numeric health score, no single number a CTO can track over time or compare across projects. Black Hole provides weighted numeric health scores (see ADR-005, ADR-027) that translate complex findings into an actionable number.

### Gap 2: No Effort/Cost Estimation

BPA counts findings. It tells you there are 47 incompatible OSGi configurations but never translates that into developer-weeks or dollars. Black Hole translates findings to effort and cost estimates (see ADR-028, ADR-032), giving decision-makers the data they need for budgeting.

### Gap 3: No Dispatcher Assessment

Dispatcher configuration assessment is **explicitly out of scope** for BPA. This is a major gap — Dispatcher misconfigurations are one of the top causes of post-migration production incidents. Black Hole covers Dispatcher security and configuration assessment (see ADR-037).

### Gap 4: No Security Posture Check

BPA checks migration compatibility only. It does not assess whether the AEM instance has security misconfigurations, exposed endpoints, or vulnerable configurations. Black Hole adds AEM-specific security posture assessment alongside migration readiness.

### Gap 5: No Third-Party Integration Assessment

BPA ignores integrations entirely. It cannot tell you which custom integrations will break, which third-party connectors need replacement, or how many integration points exist. Black Hole provides integration discovery and mapping (see ADR-033).

### Gap 6: No Cloud Manager Pre-Flight

Customers pass BPA then fail Cloud Manager pipelines. This is a known and common pain point — BPA checks content and code patterns but does not run the same validation rules that Cloud Manager enforces during deployment. Black Hole runs OakPAL and SonarQube rules locally before migration begins (see ADR-036).

### Gap 7: No Continuous Scanning

BPA is point-in-time. You run it, get a report, and if the codebase changes over the next 3 months of migration work, the report is stale. Black Hole offers post-migration drift monitoring (see ADR-035) to catch regressions continuously.

### Gap 8: Requires On-Instance Install

BPA needs admin access to a running AEM instance. This means prospects cannot evaluate migration readiness without involving their AEM operations team, getting change management approval, and scheduling a maintenance window. Black Hole's 5-tier external scanner works with zero install, zero credentials, and zero access to the customer's infrastructure (see ADR-030).

### Gap 9: No Benchmark Comparison

There is no way to compare one AEM instance's readiness against other AEM customers. Every assessment exists in isolation. Black Hole can provide percentile rankings — "your migration readiness is better than 73% of AEM 6.5 instances we've assessed" — giving context to the numbers.

### Gap 10: No Cross-Product Orchestration

CAM covers AEM only. For organizations running multiple Adobe products, there is no unified view of migration readiness across the Marketing Cloud. Black Hole covers the full Adobe Marketing Cloud stack: AEM, Campaign, Analytics, Audience Manager, and Commerce.

### Additional Competitive Intelligence

**Adobe Experience Modernization Agent** (`aemcoder.adobe.io`) covers Edge Delivery Services only. The traditional on-prem-to-AEMaaCS migration path — which represents the vast majority of enterprise migration projects — has zero AI tooling from Adobe. Black Hole occupies this space entirely.

**BPA's open-source migration tools** (Repository Modernizer, Dispatcher Converter, Index Converter) handle structural transformations: moving content packages to the correct structure, converting Dispatcher configs to cloud-compatible format, updating Oak index definitions. These are useful but perform zero semantic code refactoring. They cannot understand what a custom OSGi service does and suggest how to rewrite it for Cloud Service APIs.

**No learning network**: Adobe's tools start from scratch each time. Every migration is isolated — there is no accumulated intelligence from previous migrations. Black Hole builds a learning network across engagements, improving estimates and recommendations with each migration completed.

## Consequences

### Positive

- Clear differentiation in every sales conversation. The sales team can articulate exactly where Adobe's tools end and Black Hole begins, gap by gap.
- Black Hole captures pre-contract leads that Adobe's tools structurally cannot. No Adobe account is required — the free health score (ADR-027) serves as a proof point that converts visitors into pipeline.
- The 10-gap framework provides a repeatable competitive narrative for RFPs, demos, and partner conversations.

### Negative

- Adobe could close these gaps in future BPA/CAM releases. Must monitor the BPA/CAM roadmap quarterly and update this positioning accordingly.
- Some customers may perceive competition with Adobe's own tools as risky ("will Adobe blacklist us?"). Positioning must be **complementary, not competitive** — Black Hole fills the gaps that Adobe's tools were never designed to cover. We make their migration to Cloud Service more successful, which is aligned with Adobe's goals.

### Neutral

- Need to maintain up-to-date knowledge of BPA/CAM capabilities as Adobe releases updates.
- Competitive positioning must be validated against real customer objections and refined based on sales feedback.
