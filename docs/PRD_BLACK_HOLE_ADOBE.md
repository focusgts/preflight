# Black Hole for Adobe Marketing Cloud — Product Requirements Document

**Version**: 1.0
**Date**: March 21, 2026
**Author**: Navigator Product Team
**Status**: Draft
**Classification**: Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Opportunity & Timing](#2-market-opportunity--timing)
3. [Customer Segments](#3-customer-segments)
4. [Product Vision](#4-product-vision)
5. [Supported Migration Paths](#5-supported-migration-paths)
6. [Time & Cost Savings Analysis](#6-time--cost-savings-analysis)
7. [Product Architecture](#7-product-architecture)
8. [Phase 1: INGEST — Adobe-Specific Connectors](#8-phase-1-ingest--adobe-specific-connectors)
9. [Phase 2: SORT — Adobe Intelligence Engine](#9-phase-2-sort--adobe-intelligence-engine)
10. [Phase 3: DISTRIBUTE — Adobe Ecosystem Routing](#10-phase-3-distribute--adobe-ecosystem-routing)
11. [Module 1: AEM Migration Engine](#11-module-1-aem-migration-engine)
12. [Module 2: Analytics Migration Engine](#12-module-2-analytics-migration-engine)
13. [Module 3: Campaign & Journey Migration Engine](#13-module-3-campaign--journey-migration-engine)
14. [Module 4: CDP/DMP Migration Engine](#14-module-4-cdpdmp-migration-engine)
15. [Module 5: Commerce Migration Engine](#15-module-5-commerce-migration-engine)
16. [Module 6: DAM & Workfront Migration Engine](#16-module-6-dam--workfront-migration-engine)
17. [Cross-Platform Migration Support](#17-cross-platform-migration-support)
18. [Compliance & Security](#18-compliance--security)
19. [API Integration Layer](#19-api-integration-layer)
20. [Technical Requirements](#20-technical-requirements)
21. [Go-to-Market Strategy](#21-go-to-market-strategy)
22. [Pricing Model](#22-pricing-model)
23. [Phased Delivery Roadmap](#23-phased-delivery-roadmap)
24. [Success Metrics](#24-success-metrics)
25. [Risks & Mitigations](#25-risks--mitigations)
26. [Appendices](#26-appendices)

---

## 1. Executive Summary

### The Problem

Adobe Marketing Cloud customers face a perfect storm of migration pressure:

- **14,000-26,000 organizations** are still running AEM 6.x on-premise and must migrate to AEM as a Cloud Service before **February 2027** (core support end) or **February 2028** (extended support end)
- **Adobe Campaign Standard** is being decommissioned in **2026** — all customers must move to Campaign v8
- **Adobe Campaign Classic v7** support ends **March 31, 2027**
- **Adobe Audience Manager** is deprecated — customers must migrate to RTCDP
- Typical AEM migrations take **6-18 months** and cost **$500K-$5M+**, with **50-100% timeline overruns** being the norm
- Adobe provides assessment and content transfer tools but **no automated code refactoring, integration migration, or end-to-end orchestration**

### The Solution

**Black Hole for Adobe Marketing Cloud** is an AI-powered migration intelligence and orchestration platform that reduces Adobe migration timelines by **60-80%** and costs by **40-70%**. It extends Navigator's Black Hole ingestion engine with deep Adobe ecosystem knowledge to:

1. **Assess** — Scan, analyze, and score migration readiness across all Adobe products with AI-powered intelligence that goes beyond what BPA provides
2. **Plan** — Generate detailed migration plans with risk predictions, effort estimates, and dependency mapping based on historical migration data
3. **Transform** — Automatically refactor code, map content schemas, convert configurations, and generate test suites
4. **Execute** — Orchestrate content transfer, code deployment, integration reconnection, and validation across environments
5. **Validate** — Run automated visual regression, SEO, performance, and content integrity checks
6. **Monitor** — Detect post-migration drift, performance degradation, and author experience issues before they become critical

### Total Addressable Market

| Segment | Market Size |
|---------|------------|
| AEM on-prem to Cloud (code + content) | $7B-$13B |
| AEM Managed Services to Cloud | $1.5B-$3B |
| Cross-platform to AEM | $2B-$5B |
| Adobe Campaign migrations | $1B-$2B |
| Analytics migrations | $500M-$1.5B |
| DMP to CDP (AAM to RTCDP) | $500M-$1B |
| **Total** | **$12.5B-$25.5B** |

### Why Now

The confluence of multiple Adobe product end-of-support dates creates a **24-month window (March 2026 - March 2028)** where migration demand peaks and existing tooling cannot keep up. No competitor offers end-to-end, AI-powered, cross-product Adobe migration orchestration.

---

## 2. Market Opportunity & Timing

### 2.1 Adobe Customer Base

| Metric | Estimate |
|--------|----------|
| Total companies using AEM | 36,413-53,154 |
| Companies with 10,000+ employees using AEM | 1,204 |
| Companies with 1,000-4,999 employees | 766+ |
| Estimated still on AEM 6.x on-prem/AMS | 14,000-26,000 (40-50%) |
| US-based AEM customers | 39-60% of total |
| Global cloud migration services market (2025) | $21.66B |
| CAGR (2025-2030) | 27.8% |

### 2.2 Critical Deadlines Creating Urgency

```
TIMELINE OF FORCED MIGRATIONS
══════════════════════════════════════════════════════════════

2026 Q2-Q3  │  AEM Managed Services support ends (Aug 31, 2026)
            │  Campaign Standard decommissioned
            │
2027 Q1     │  AEM 6.5 core support ends (Feb 2027)
            │  Campaign Classic v7 support ends (Mar 31, 2027)
            │
2028 Q1     │  AEM 6.5 extended support ends (Feb 2028)
            │  ABSOLUTE DEADLINE — no patches of any kind
            │
Post-2028   │  Demand shifts to cross-platform + optimization
            │  Late migrators still need services

  ◀─── PEAK DEMAND WINDOW (24 MONTHS) ───▶
```

### 2.3 Competitive Landscape Gaps

| Tool/Vendor | What It Does | What's Missing |
|-------------|-------------|----------------|
| **Adobe BPA** | Identifies compatibility issues | Does not fix them, does not estimate effort |
| **Adobe CTT** | Transfers content | No content analysis, no merge, no intelligence |
| **Adobe CAM** | Project tracking dashboard | No automated execution |
| **Refactor.ai (Infogain)** | GenAI code refactoring | Code only — no content, integrations, or testing |
| **3\|SHARE AI** | AI code analysis, content audit | Point solution, not end-to-end |
| **EPAM Migrator** | Bulk content migration | Content only, no intelligence |
| **SI Custom Scripts** | One-off solutions | Not reusable, not maintained |

**Critical gap**: No tool manages the entire migration lifecycle. No tool handles cross-product Adobe migrations as a coordinated program. No tool provides compliance-aware, risk-quantified, AI-orchestrated migration.

**Black Hole fills every gap in this table.**

---

## 3. Customer Segments

### 3.1 By Migration Type (Priority Order)

#### Tier 1 — Highest Urgency (Forced Migrations)

| Segment | Organizations | Deadline | Avg Cost Today | Complexity |
|---------|--------------|----------|---------------|------------|
| AEM 6.x on-prem → Cloud Service | 14,000-26,000 | Feb 2027/2028 | $500K-$5M+ | Very High |
| AEM Managed Services → Cloud | Subset of above | Aug 2026 | $250K-$1.5M | High |
| Campaign Standard → Campaign v8 | All ACS customers | 2026 | $200K-$1M | High |
| Campaign Classic v7 → v8 | All ACC v7 customers | Mar 2027 | $200K-$1M | High |

#### Tier 2 — Active Migration Segments

| Segment | Driver | Complexity |
|---------|--------|------------|
| Audience Manager → RTCDP | Product deprecated | Medium-High |
| Adobe Analytics → CJA | Strategic consolidation | Medium |
| AEM 6.x version upgrades (6.1→6.5) | Pre-cloud modernization | Medium |

#### Tier 3 — Competitive Displacement

| Segment | Driver | Complexity |
|---------|--------|------------|
| WordPress/Sitecore/Drupal → AEM | Enterprise consolidation | High |
| Google Analytics → Adobe Analytics/CJA | Enterprise analytics | Medium |
| SFMC → Adobe Campaign/AJO | Platform consolidation | Very High |
| Competitor CDP → AEP/RTCDP | Data platform consolidation | High |
| Competitor DAM → AEM Assets | Asset management consolidation | Medium |
| Optimizely/VWO → Adobe Target | Testing platform consolidation | Medium |
| Jira/Asana → Adobe Workfront | Project management consolidation | Medium |

### 3.2 By Company Size

| Segment | Characteristics | Migration Timeline (Today) | Budget |
|---------|----------------|---------------------------|--------|
| Large Enterprise (50,000+) | Multi-region, 100+ sites, heavy customization | 18-30 months | $3M-$10M+ |
| Enterprise (10,000-50,000) | Multi-site, multi-language, significant custom code | 9-18 months | $1M-$3M |
| Upper Mid-Market (5,000-10,000) | Moderate complexity, some customization | 6-12 months | $500K-$1.5M |
| Mid-Market (1,000-5,000) | Limited customization, smaller footprint | 4-8 months | $250K-$750K |

### 3.3 By Industry

| Industry | % of AEM Deployments | Key Compliance | Migration Risk |
|----------|---------------------|----------------|----------------|
| Financial Services | 19.2% | SOX, PCI-DSS, GLBA | Audit trail preservation |
| Healthcare | 11.5% | HIPAA, FDA | PHI protection during transfer |
| Telecom | 11.5% | CPNI, FCC | Customer portal zero-downtime |
| Retail/CPG | ~10% | PCI-DSS, CCPA | Seasonal timing constraints |
| Government | ~8% | FedRAMP, Section 508 | 12-18 month authorization |
| Media & Entertainment | ~7% | Rights management | Massive asset volumes |
| Manufacturing | ~6% | PIM integration | Product data sync |
| Travel & Hospitality | ~5% | Seasonal constraints | Booking system integration |

---

## 4. Product Vision

### 4.1 Core Concept

Black Hole for Adobe Marketing Cloud extends Navigator's Black Hole ingestion engine from a ticket/support data ingestion tool into a **full-spectrum Adobe ecosystem migration intelligence and orchestration platform**.

**Tagline**: *"Your entire Adobe migration — assessed, planned, transformed, and validated — at the speed of AI."*

### 4.2 How It Differs from the Base Black Hole

| Capability | Base Black Hole | Adobe Black Hole |
|-----------|----------------|------------------|
| **Input** | Ticket exports (CSV, JSON) | AEM repositories, Adobe product exports, competitor platform exports, code repos, content packages, analytics configs |
| **Analysis** | Ticket classification (SEA, priority, platform) | Migration readiness scoring, code compatibility analysis, content health assessment, integration dependency mapping, risk prediction |
| **Output** | Navigator tickets, KB articles, time patterns | Migration plans, refactored code, transformed content, converted configurations, test suites, compliance reports, risk dashboards |
| **Intelligence** | Claude Haiku for ticket classification | Claude Sonnet/Opus for code refactoring, schema mapping, and migration strategy; Haiku for bulk classification and content analysis |
| **Scope** | One-time onboarding ingestion | Full migration lifecycle: assess → plan → transform → execute → validate → monitor |

### 4.3 Product Principles

1. **Intelligence over brute force** — Use AI to analyze, predict, and automate; never just copy data
2. **Full lifecycle** — Assessment through post-migration monitoring, not just one phase
3. **Cross-product orchestration** — Handle AEM + Campaign + Analytics + CDP as a unified migration program
4. **Compliance-built-in** — Automated regulatory compliance for GDPR, HIPAA, CCPA, FedRAMP
5. **Risk-quantified** — Predictive analytics on migration risk, timeline, and cost
6. **Outcome-measured** — ROI tracking that proves migration value post-completion
7. **Zero data left behind** — Full context from source systems, fully contextualized in target

---

## 5. Supported Migration Paths

### 5.1 AEM Migrations (Priority 1)

```
┌─────────────────────────────────────────────────────────────┐
│                    AEM MIGRATION MATRIX                       │
│                                                               │
│  SOURCE                        TARGET                        │
│  ──────                        ──────                        │
│  AEM 6.1/6.2/6.3/6.4     ──▶  AEM 6.5 (upgrade path)       │
│  AEM 6.5 On-Premises     ──▶  AEM as a Cloud Service        │
│  AEM Managed Services     ──▶  AEM as a Cloud Service        │
│  AEM Sites (traditional)  ──▶  AEM Edge Delivery Services    │
│  AEM 6.x + Dynamic Media  ──▶  AEM Cloud + DM with OpenAPI  │
│                                                               │
│  WordPress               ──▶  AEM Sites / Edge Delivery      │
│  Sitecore                ──▶  AEM Sites                       │
│  Drupal                  ──▶  AEM Sites                       │
│  Episerver/Optimizely    ──▶  AEM Sites                       │
│  Contentful/Sanity       ──▶  AEM Headless (GraphQL)          │
│                                                               │
│  COMPLEXITY:  ████████████████████████████  VERY HIGH         │
│  MARKET SIZE: ████████████████████████████  $7B-$13B          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Analytics Migrations (Priority 2)

| Source | Target | Complexity |
|--------|--------|------------|
| Google Analytics (GA4/UA) | Adobe Analytics | Medium |
| Google Analytics | Customer Journey Analytics (CJA) | Medium-High |
| Mixpanel | Adobe Analytics | Medium |
| Amplitude | Adobe Analytics | Medium |
| Heap | Adobe Analytics | Medium |
| Matomo/Piwik | Adobe Analytics | Low-Medium |
| Adobe Analytics | CJA | Medium (schema redesign) |

### 5.3 Campaign & Journey Migrations (Priority 2)

| Source | Target | Complexity |
|--------|--------|------------|
| Campaign Standard | Campaign v8 | High (forced) |
| Campaign Classic v7 | Campaign v8 | High (forced) |
| Salesforce Marketing Cloud | Adobe Campaign / AJO | Very High |
| HubSpot | Marketo Engage | High |
| Braze | Journey Optimizer | High |
| Mailchimp | Adobe Campaign | Medium |
| Iterable | AJO | Medium-High |
| Klaviyo | Adobe Campaign / AJO | Medium |
| Pardot | Marketo Engage | High |

### 5.4 CDP/DMP Migrations (Priority 2)

| Source | Target | Complexity |
|--------|--------|------------|
| Audience Manager | RTCDP (AEP) | High (forced) |
| Salesforce CDP | RTCDP | High |
| Tealium AudienceStream | AEP/RTCDP | Medium-High |
| Segment (Twilio) | AEP | Medium-High |
| mParticle | AEP | Medium-High |
| Treasure Data | AEP | Medium |

### 5.5 Commerce Migrations (Priority 3)

| Source | Target | Complexity |
|--------|--------|------------|
| Shopify / Shopify Plus | Adobe Commerce | High |
| Salesforce Commerce Cloud | Adobe Commerce | Very High |
| SAP Commerce (Hybris) | Adobe Commerce | Very High |
| BigCommerce | Adobe Commerce | Medium-High |
| WooCommerce | Adobe Commerce | Medium |

### 5.6 Other Migrations (Priority 3)

| Source | Target | Complexity |
|--------|--------|------------|
| Bynder / Widen / Canto | AEM Assets | Medium |
| Google Drive / SharePoint | AEM Assets | Low-Medium |
| Optimizely | Adobe Target | Medium |
| Google Optimize (sunset) | Adobe Target | Medium |
| Jira | Adobe Workfront | Medium |
| Asana / Monday.com | Adobe Workfront | Medium |

---

## 6. Time & Cost Savings Analysis

### 6.1 AEM On-Prem to Cloud Service — The Big One

This is the highest-value, highest-complexity migration path and where Black Hole delivers the most dramatic savings.

#### Traditional Migration (Without Black Hole)

```
TRADITIONAL AEM MIGRATION TIMELINE — ENTERPRISE
═══════════════════════════════════════════════════════════

Phase 1: Assessment & Planning          4-8 WEEKS
├── Run BPA, analyze report manually    ██████████
├── Inventory custom code & bundles     ██████████
├── Map integrations & dependencies     ██████████
├── Estimate effort & create plan       ██████████
└── Stakeholder alignment              ██████████

Phase 2: Code Modernization             8-20 WEEKS
├── Refactor OSGi configs               ██████████████████████
├── Replace deprecated APIs             ██████████████████████
├── Migrate custom components           ██████████████████████
├── Convert workflows                   ██████████████████████
├── Restructure Maven project           ██████████████████████
└── Update dispatcher configs           ██████████████████████

Phase 3: Content Migration              4-12 WEEKS
├── Configure CTT                       ████████████████
├── Execute proof-of-migration          ████████████████
├── Validate content integrity          ████████████████
├── Plan delta migrations               ████████████████
└── User/group IMS migration            ████████████████

Phase 4: Integration Reconnection       4-10 WEEKS
├── Reconfigure third-party systems     ██████████████
├── Update auth mechanisms              ██████████████
├── Test data flows end-to-end          ██████████████
└── Reconnect CI/CD pipelines           ██████████████

Phase 5: Testing & Cutover              4-8 WEEKS
├── Performance testing                 ████████████
├── Visual regression testing           ████████████
├── UAT with content authors            ████████████
├── SEO validation                      ████████████
├── Cutover rehearsal                   ████████████
└── Go-live & hypercare                 ████████████

TOTAL: 24-58 WEEKS (6-14 MONTHS)
COST:  $1M-$5M+ (SI engagement)
OVERRUN PROBABILITY: 50-100%
```

#### Migration With Black Hole

```
BLACK HOLE-ASSISTED AEM MIGRATION TIMELINE — ENTERPRISE
═══════════════════════════════════════════════════════════

Phase 1: AI Assessment & Planning       3-5 DAYS
├── Black Hole scans: BPA + extended    ██
│   AI analysis (code, content, deps)
├── Auto-generates migration plan       ██
│   with risk scores & effort estimates
├── Maps all integrations & APIs        ██
├── Identifies compliance requirements  ██
└── Produces executive migration brief  ██

Phase 2: Automated Code Modernization   2-6 WEEKS
├── AI refactors OSGi configs           ████████
├── AI replaces deprecated APIs         ████████  (50-60%
├── AI migrates custom components       ████████   automated,
├── AI converts workflows               ████████   human review
├── AI restructures Maven project       ████████   required)
└── AI converts dispatcher configs      ████████

Phase 3: Intelligent Content Migration  1-3 WEEKS
├── Content health scan & cleanup       ████
├── Duplicate detection & merge         ████
├── Automated CTT orchestration         ████
├── Content integrity validation        ████
├── Metadata enrichment & standardize   ████
└── User/group IMS provisioning plan    ████

Phase 4: Integration Reconnection       1-3 WEEKS
├── Auto-detected integration map       ████
├── Config templates for common         ████
│   integrations (Analytics, Target,
│   Campaign, AEP, CRM, etc.)
├── Automated auth migration            ████
└── End-to-end data flow validation     ████

Phase 5: Automated Testing & Cutover    1-2 WEEKS
├── AI-generated test suites            ███
├── Automated visual regression         ███
├── Automated SEO validation            ███
├── Performance benchmark comparison    ███
├── Author experience validation        ███
└── Cutover orchestration               ███

TOTAL: 5-15 WEEKS (1-4 MONTHS)
COST REDUCTION: 40-70% of traditional
OVERRUN PROBABILITY: <20%
```

### 6.2 Time Savings by Migration Phase

| Migration Phase | Traditional Duration | With Black Hole | Time Saved | How |
|----------------|---------------------|-----------------|------------|-----|
| **Assessment & Planning** | 4-8 weeks | 3-5 days | **85-95%** | AI scans entire codebase, content repository, integrations, and produces a scored migration plan with risk predictions and effort estimates in hours instead of weeks |
| **Code Modernization** | 8-20 weeks | 2-6 weeks | **60-75%** | AI auto-refactors 50-60% of code changes (OSGi configs, deprecated APIs, Maven restructuring, dispatcher conversion); humans review and handle complex logic |
| **Content Migration** | 4-12 weeks | 1-3 weeks | **70-80%** | Automated content health analysis, duplicate detection, CTT orchestration with intelligent batching, automated validation — eliminates manual content inventory |
| **Integration Reconnection** | 4-10 weeks | 1-3 weeks | **65-75%** | Pre-mapped integration templates for 200+ Adobe source connectors; automated auth migration; AI generates integration configs from source analysis |
| **Testing & Cutover** | 4-8 weeks | 1-2 weeks | **70-85%** | AI generates test suites from BPA findings and code diff; automated visual regression, SEO validation, performance benchmarking; author UX validation |
| **TOTAL** | **24-58 weeks** | **5-15 weeks** | **70-80%** | End-to-end orchestration eliminates handoff delays, rework, and manual processes |

### 6.3 Cost Savings by Company Size

| Company Size | Traditional Cost | With Black Hole | Savings | Savings % |
|-------------|-----------------|-----------------|---------|-----------|
| Mid-Market (1K-5K employees) | $250K-$750K | $75K-$250K | $175K-$500K | **60-70%** |
| Upper Mid-Market (5K-10K) | $500K-$1.5M | $150K-$500K | $350K-$1M | **60-70%** |
| Enterprise (10K-50K) | $1M-$3M | $300K-$1M | $700K-$2M | **55-65%** |
| Large Enterprise (50K+) | $3M-$10M+ | $900K-$3.5M | $2.1M-$6.5M | **50-65%** |

*Costs include Black Hole platform fees + reduced SI/internal hours. Human oversight still required for code review, complex business logic, and UAT.*

### 6.4 Savings Across All Migration Types

| Migration Type | Traditional Timeline | With Black Hole | Time Saved |
|---------------|---------------------|-----------------|------------|
| AEM On-Prem → Cloud (Enterprise) | 9-18 months | 2-5 months | **70-75%** |
| AEM On-Prem → Cloud (Mid-Market) | 4-8 months | 1-3 months | **65-75%** |
| AEM Managed Services → Cloud | 3-9 months | 1-3 months | **60-70%** |
| WordPress → AEM | 4-12 months | 2-4 months | **55-65%** |
| Sitecore → AEM | 6-18 months | 2-6 months | **60-70%** |
| GA → Adobe Analytics/CJA | 3-6 months | 1-2 months | **60-70%** |
| SFMC → Adobe Campaign/AJO | 6-18 months | 3-6 months | **50-65%** |
| Audience Manager → RTCDP | 3-9 months | 1-3 months | **60-70%** |
| Campaign Standard → v8 | 6-18 months | 2-5 months | **55-65%** |
| Competitor CDP → AEP/RTCDP | 3-9 months | 1-3 months | **60-70%** |
| DAM → AEM Assets | 2-6 months | 1-2 months | **55-65%** |
| Jira → Workfront | 1-3 months | 2-4 weeks | **60-70%** |

### 6.5 Where Black Hole Saves the Most Time (Automation Potential)

| Manual Task Today | Black Hole Automation | Effort Reduction |
|------------------|----------------------|------------------|
| Code compatibility analysis | AI static analysis (BPA + deep scan) | **70-80%** |
| Deprecated API refactoring | GenAI code transformation | **50-60%** |
| Content mapping & transformation | ML schema mapping + validation | **60-70%** |
| Test case generation | AI test suites from BPA + code diff | **50-70%** |
| Integration documentation | AI docs from code analysis | **60-80%** |
| Visual regression testing | Automated screenshot comparison | **80-90%** |
| SEO audit & redirect mapping | Automated URL analysis + redirect gen | **70-80%** |
| Content deduplication | ML duplicate detection + metadata enrichment | **60-70%** |
| Migration project planning | AI plans from assessment data | **30-50%** |
| Post-migration monitoring | Automated anomaly detection | **70-80%** |

### 6.6 Real-World Scenario: Enterprise AEM Migration

**Customer Profile**: Fortune 500 financial services company
- 85 AEM sites across 12 regions
- AEM 6.5 SP15 on-premise
- 350+ custom OSGi bundles
- 200+ custom components
- 15 third-party integrations (Salesforce CRM, SAP, Adobe Analytics, Target, Campaign, payment gateway, etc.)
- 1.2M content pages
- 500K DAM assets (45TB)
- 12 content author teams

**Traditional Migration**:
| Phase | Duration | Cost |
|-------|----------|------|
| Assessment | 8 weeks | $200K |
| Code modernization | 16 weeks | $1.2M |
| Content migration | 10 weeks | $400K |
| Integration reconnection | 8 weeks | $500K |
| Testing & cutover | 6 weeks | $300K |
| Post-go-live stabilization | 8 weeks | $200K |
| Content freeze impact | — | $500K (estimated revenue impact) |
| **Total** | **56 weeks** | **$3.3M** |

**With Black Hole**:
| Phase | Duration | Cost |
|-------|----------|------|
| AI Assessment | 4 days | $15K (platform) |
| AI-assisted code modernization | 5 weeks | $350K (reduced SI + platform) |
| Intelligent content migration | 2 weeks | $80K |
| Automated integration reconnection | 2 weeks | $100K |
| Automated testing & cutover | 1.5 weeks | $60K |
| Post-go-live monitoring (AI) | Continuous | $25K/year |
| Content freeze impact | — | $100K (reduced window) |
| **Total** | **11 weeks** | **$730K** |

**Savings: 45 weeks and $2.57M (78% cost reduction)**

---

## 7. Product Architecture

### 7.1 System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    BLACK HOLE FOR ADOBE                            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   INGEST     │  │    SORT      │  │     DISTRIBUTE       │   │
│  │              │  │              │  │                      │   │
│  │ Connectors:  │  │ AI Engines:  │  │  Targets:            │   │
│  │ • AEM Repo   │──▶│ • Readiness │──▶│ • AEM Cloud Service │   │
│  │ • Code Repo  │  │ • Code Scan  │  │ • AEP / RTCDP       │   │
│  │ • Analytics  │  │ • Content    │  │ • Campaign v8        │   │
│  │ • Campaign   │  │ • Compliance │  │ • CJA                │   │
│  │ • AEP/RTCDP  │  │ • Risk Score │  │ • Target             │   │
│  │ • Commerce   │  │ • Integration│  │ • Commerce           │   │
│  │ • DAM        │  │ • Schema Map │  │ • Workfront          │   │
│  │ • Workfront  │  │ • Effort Est │  │ • Navigator          │   │
│  │ • Target     │  │              │  │ • RuVector           │   │
│  │ • Competitor │  │              │  │                      │   │
│  │   Platforms  │  │              │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  MIGRATION MODULES                           │  │
│  │                                                               │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │  │
│  │  │   AEM      │ │ Analytics  │ │  Campaign   │              │  │
│  │  │ Migration  │ │ Migration  │ │  Migration  │              │  │
│  │  │ Engine     │ │ Engine     │ │  Engine     │              │  │
│  │  └────────────┘ └────────────┘ └────────────┘              │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │  │
│  │  │   CDP/DMP  │ │  Commerce  │ │  DAM &     │              │  │
│  │  │ Migration  │ │ Migration  │ │  Workfront  │              │  │
│  │  │ Engine     │ │ Engine     │ │  Engine     │              │  │
│  │  └────────────┘ └────────────┘ └────────────┘              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               SHARED SERVICES                               │   │
│  │  • Compliance Engine (GDPR, HIPAA, CCPA, FedRAMP)          │   │
│  │  • Risk Prediction Model (trained on historical migrations) │   │
│  │  • Test Generation Engine (visual, SEO, performance, a11y) │   │
│  │  • Post-Migration Monitor (drift detection, perf tracking)  │   │
│  │  • Knowledge Base (migration patterns, known issues)        │   │
│  │  • ROI Tracker (projected vs actual value measurement)      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Data Model

Extends the base Black Hole `SourceItem` with Adobe-specific models:

```python
@dataclass
class AdobeMigrationProject:
    """Top-level migration project encompassing all Adobe product migrations."""
    project_id: str
    organization: Organization
    source_environment: AdobeEnvironment
    target_environment: AdobeEnvironment
    migration_type: MigrationTypeEnum  # upgrade, cloud_migration, cross_platform
    products_in_scope: list[AdobeProduct]
    compliance_requirements: list[ComplianceFramework]
    risk_score: float  # 0.0-1.0
    estimated_duration_weeks: int
    estimated_cost: MoneyAmount
    status: MigrationStatus
    phases: list[MigrationPhase]
    created_at: datetime
    target_completion: datetime

@dataclass
class AEMMigrationAssessment:
    """Assessment results for AEM migration readiness."""
    bpa_findings: list[BPAFinding]
    extended_findings: list[ExtendedFinding]  # Black Hole's additional analysis
    custom_bundles: list[OSGiBundleAnalysis]
    custom_components: list[ComponentAnalysis]
    content_health: ContentHealthReport
    integration_map: list[IntegrationDependency]
    dispatcher_analysis: DispatcherAnalysis
    index_analysis: list[OakIndexAnalysis]
    workflow_analysis: list[WorkflowAnalysis]
    code_compatibility_score: float  # 0.0-1.0
    content_readiness_score: float
    integration_complexity_score: float
    overall_readiness_score: float
    estimated_refactoring_hours: int
    risk_factors: list[RiskFactor]
    recommended_migration_path: MigrationPath

@dataclass
class ContentMigrationJob:
    """Extends base Black Hole SourceItem for AEM content."""
    source_id: str
    source_platform: str  # aem_6x, wordpress, sitecore, etc.
    content_type: AEMContentType  # page, asset, content_fragment, experience_fragment, tag, etc.
    jcr_path: str
    node_type: str
    properties: dict[str, Any]
    children: list[ContentNode]
    references: list[ContentReference]  # cross-references to other content
    metadata: AssetMetadata | None
    renditions: list[Rendition] | None
    permissions: list[ACLEntry]
    live_copy_status: LiveCopyStatus | None
    translation_status: TranslationStatus | None
    published: bool
    last_modified: datetime
    migration_status: ItemMigrationStatus
    validation_results: list[ValidationResult]

@dataclass
class CodeMigrationUnit:
    """Represents a code artifact being migrated."""
    artifact_type: CodeArtifactType  # osgi_bundle, component, template, clientlib, workflow, config, etc.
    source_path: str
    target_path: str
    compatibility_issues: list[CompatibilityIssue]
    auto_refactored: bool
    refactoring_applied: list[RefactoringAction]
    human_review_required: bool
    review_notes: str
    test_coverage: float
    generated_tests: list[TestCase]

@dataclass
class IntegrationDependency:
    """Represents a third-party or Adobe product integration."""
    integration_name: str
    integration_type: IntegrationType  # api, webhook, event, sync, etc.
    source_config: dict
    target_config: dict | None  # generated by Black Hole
    adobe_product: str | None  # if it's an Adobe-to-Adobe integration
    auth_type: AuthType
    data_flow: DataFlowDirection  # inbound, outbound, bidirectional
    criticality: CriticalityLevel
    migration_strategy: IntegrationMigrationStrategy
    validated: bool
```

### 7.3 AI Model Usage

| Task | Model | Why | Est. Cost per Migration |
|------|-------|-----|------------------------|
| Ticket/content classification | Claude Haiku | Speed, volume, low complexity | $1-$10 |
| Code compatibility analysis | Claude Sonnet | Balance of speed and reasoning | $10-$50 |
| Code refactoring | Claude Opus | Complex reasoning for code transforms | $50-$500 |
| Schema mapping | Claude Sonnet | Pattern recognition across schemas | $5-$25 |
| Migration plan generation | Claude Opus | Strategic reasoning, risk assessment | $10-$50 |
| Test case generation | Claude Sonnet | Systematic coverage generation | $10-$50 |
| Integration config generation | Claude Sonnet | API knowledge + config generation | $5-$25 |
| Compliance analysis | Claude Sonnet | Regulatory knowledge application | $5-$20 |
| Content deduplication | Claude Haiku + RuVector | Embedding comparison + quick classification | $5-$30 |
| Post-migration monitoring | Claude Haiku | Anomaly detection, continuous | $10-$50/month |

---

## 8. Phase 1: INGEST — Adobe-Specific Connectors

### 8.1 AEM Repository Connector

Connects directly to AEM instances to extract content, code, and configuration.

**Supported Sources**:
| AEM Version | Connection Method | Data Extracted |
|-------------|------------------|----------------|
| AEM 6.3+ | Package Manager API, Sling API, QueryBuilder | Content, code, configs, indexes, workflows |
| AEM 6.5 | Above + Assets HTTP API + GraphQL | Above + Content Fragments, Experience Fragments |
| AEM Managed Services | Cloud Manager API + above | Above + environment configs |
| AEM as Cloud Service | Cloud Manager API + AEM APIs | Content, configs (code via Git) |

**Extraction Methods**:

```
AEM CONNECTOR FLOW
══════════════════

┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  AEM Instance │────▶│  Black Hole   │────▶│  Normalized  │
│              │     │  Connector    │     │  Data Store  │
│ • /content   │     │              │     │              │
│ • /apps      │     │ • JCR Crawl  │     │ ContentNode  │
│ • /conf      │     │ • API Extract│     │ CodeArtifact │
│ • /etc       │     │ • Package DL │     │ ConfigItem   │
│ • /var       │     │ • Git Clone  │     │ Integration  │
│ • /oak:index │     │ • OSGi Scan  │     │ WorkflowDef  │
│              │     │ • Dispatcher │     │ IndexDef     │
│              │     │   Parse      │     │              │
└──────────────┘     └───────────────┘     └──────────────┘
```

**Key APIs Used**:
- `GET /api/assets/{path}.json` — DAM asset inventory
- `GET /content/{path}.infinity.json` — Deep content tree extraction
- `GET /bin/querybuilder.json` — Content queries
- `GET /crx/packmgr/list.jsp` — Package inventory
- `PUT /graphql/persist.json/...` — Content Fragment extraction
- `GET /system/console/bundles.json` — OSGi bundle inventory
- `GET /system/console/configMgr` — OSGi configuration inventory

### 8.2 Code Repository Connector

Analyzes the AEM project's code repository (Maven/Git).

**What It Extracts**:
- Maven project structure (pom.xml hierarchy)
- OSGi bundle source code (Java, Sling Models, servlets)
- HTL/Sightly templates
- Client libraries (CSS/JS)
- Content packages (filter.xml, content XML)
- OSGi configurations (.cfg.json, .cfg, .config, sling:OsgiConfig)
- Dispatcher configuration (httpd.conf, dispatcher.any, vhost files)
- Custom Oak index definitions
- Workflow process step implementations
- Third-party dependencies (from pom.xml)

### 8.3 Analytics Connector

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| Adobe Analytics | Analytics 2.0 API | Report suites, dimensions, metrics, segments, calculated metrics, classifications, processing rules, marketing channels |
| Google Analytics (GA4) | GA4 Admin API + Data API | Properties, streams, events, dimensions, metrics, audiences, conversions, GTM container |
| Google Analytics (UA) | UA Reporting API | Views, goals, segments, filters, custom dimensions/metrics |
| Mixpanel | Export API | Events, properties, funnels, cohorts |
| Amplitude | Export API | Events, user properties, behavioral cohorts |

### 8.4 Campaign & Journey Connector

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| Campaign Standard | REST API | Profiles, services, workflows, deliveries, templates, landing pages |
| Campaign Classic | SOAP + REST API | Recipients, deliveries, workflows, offers, schemas |
| Campaign v8 | v8 APIs | All above + FFDA configs |
| SFMC | REST API | Data extensions, journeys, automations, content builder assets, subscriber data |
| HubSpot | REST API | Contacts, workflows, forms, landing pages, email templates |
| Marketo | REST + Bulk API | Leads, programs, smart campaigns, emails, landing pages, forms |

### 8.5 Platform Connector (AEP/RTCDP)

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| AEP | Platform APIs | Schemas (XDM), datasets, segments, destinations, identity namespaces, merge policies |
| Audience Manager | AAM API | Traits, segments, data sources, destinations, ID syncs |
| Salesforce CDP | SFDC API | Data bundles, segments, activations |
| Tealium | AudienceStream API | Audiences, attributes, connectors |
| Segment | Config API | Sources, destinations, tracking plans |

### 8.6 Commerce Connector

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| Adobe Commerce | REST + GraphQL API | Products, categories, customers, orders, CMS blocks/pages, config |
| Shopify | Admin API | Products, collections, customers, orders, themes |
| SFCC (Demandware) | OCAPI | Catalogs, customers, orders, content assets, cartridges |
| WooCommerce | REST API | Products, categories, customers, orders, settings |

### 8.7 Competitor CMS Connector

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| WordPress | REST API + WXR Export | Posts, pages, media, taxonomies, menus, widgets, theme structure |
| Sitecore | REST API + Package Export | Items, templates, layouts, media, personalization rules, xDB data |
| Drupal | JSON:API + DB Export | Nodes, content types, views, taxonomies, media, configuration |
| Contentful | Content Management API | Content types, entries, assets, locales, spaces |
| Sanity | GROQ API | Documents, schemas, assets |

### 8.8 Project Management Connector

| Source | Connection Method | Data Extracted |
|--------|------------------|----------------|
| Jira | REST API | Projects, issues, workflows, custom fields, boards, sprints |
| Asana | REST API | Projects, tasks, sections, custom fields |
| Adobe Workfront | REST API | Projects, tasks, issues, documents, custom forms |

---

## 9. Phase 2: SORT — Adobe Intelligence Engine

### 9.1 Migration Readiness Scoring

For every AEM migration, Black Hole produces a comprehensive readiness score:

```
┌──────────────────────────────────────────────────────────────┐
│              MIGRATION READINESS REPORT                        │
│              Client: Acme Corp                                 │
│              Source: AEM 6.5 SP18 On-Premise                   │
│              Target: AEM as a Cloud Service                    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  OVERALL READINESS SCORE: 62/100  ████████████░░░░░░░  62%   │
│                                                                │
│  Code Compatibility        ████████░░░░░░░░░░  42%           │
│  ├── 347 custom OSGi bundles (85 with restricted APIs)        │
│  ├── 23 deprecated API usages                                 │
│  ├── 12 custom run mode dependencies                          │
│  └── Estimated refactoring: 320 hours                         │
│                                                                │
│  Content Readiness         ██████████████░░░░  72%            │
│  ├── 1.2M pages (98% structurally valid)                      │
│  ├── 500K assets (45TB, 12% duplicates detected)              │
│  ├── 234 content fragments (all models compatible)            │
│  ├── 15 mutable/immutable path violations                     │
│  └── Estimated content transfer: 18 hours                     │
│                                                                │
│  Integration Complexity    ██████████████████  85%            │
│  ├── 15 integrations detected                                 │
│  ├── 12 have known cloud migration paths                      │
│  ├── 3 require custom reconnection                            │
│  └── Auth migration: 8 OAuth, 4 SAML, 3 API key              │
│                                                                │
│  Configuration Readiness   ██████████████░░░░  68%            │
│  ├── 89 OSGi configs (62 auto-convertible)                    │
│  ├── Dispatcher: 4 rules incompatible with cloud CDN          │
│  ├── 8 custom Oak indexes (5 auto-convertible)                │
│  └── 3 custom search implementations need refactoring         │
│                                                                │
│  Compliance Requirements   ██████████████████  92%            │
│  ├── GDPR: consent records present, migration-ready           │
│  ├── PCI-DSS: payment data isolated, no migration needed      │
│  ├── SOX: audit trail preservation plan generated             │
│  └── Data residency: US-West Azure region compatible          │
│                                                                │
│  RISK FACTORS                                                  │
│  ├── HIGH: 85 bundles using restricted JCR APIs               │
│  ├── MEDIUM: Dynamic Media Scene7 requires separate migration │
│  ├── MEDIUM: MSM blueprints across 12 regions need validation │
│  └── LOW: 12% DAM duplicates should be cleaned pre-migration  │
│                                                                │
│  ESTIMATED TIMELINE: 8-12 weeks (with Black Hole)             │
│  ESTIMATED COST: $450K-$650K (platform + reduced SI hours)    │
│  CONFIDENCE: 82%                                               │
│                                                                │
│  TRADITIONAL ESTIMATE: 40-56 weeks / $2.5M-$3.5M             │
│  SAVINGS: 70-80% time / 65-75% cost                           │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Classification Engine (Extended)

Extends the base Black Hole classification pipeline with Adobe-specific intelligence:

| Classification | Description | Method |
|---------------|-------------|--------|
| **Adobe Product Tag** | Which Adobe product(s) this item relates to | AI classification using platform keyword reference |
| **Migration Category** | Code, content, config, integration, compliance | Rule-based + AI |
| **Compatibility Level** | Compatible, auto-fixable, manual-fix, blocker | Static analysis + AI |
| **Effort Estimate** | Hours to migrate this specific item | ML model trained on historical migrations |
| **Risk Level** | Probability of causing migration failure | Risk prediction model |
| **Dependency Chain** | What other items must migrate first/together | Graph analysis |
| **Compliance Impact** | Does this item contain regulated data? | Pattern matching + AI |
| **SEA Category** | Support, Enhance, or Advise (for Navigator) | Claude Haiku classification |
| **CapEx/OpEx** | Capital vs. operating expenditure | Rule-based from migration type |
| **ROI Category** | Revenue impact, cost avoidance, speed-to-market, etc. | AI classification |

### 9.3 Platform Tag Reference

Black Hole uses an expanded platform tag taxonomy for Adobe:

| Tag | Full Name | Common Keywords |
|-----|-----------|-----------------|
| `aem-sites` | AEM Sites | pages, components, templates, authoring, publishing, MSM, live copy, experience fragments |
| `aem-assets` | AEM Assets | DAM, assets, renditions, metadata, smart tags, Dynamic Media, Brand Portal |
| `aem-forms` | AEM Forms | adaptive forms, document services, PDF, submissions |
| `aem-screens` | AEM Screens | digital signage, channels, displays |
| `aem-eds` | AEM Edge Delivery Services | Franklin, Helix, document-based, blocks, Sidekick |
| `aem-cloud-mgr` | Cloud Manager | pipelines, environments, RDE, CI/CD |
| `analytics` | Adobe Analytics | report suites, eVars, props, events, segments, Analysis Workspace |
| `cja` | Customer Journey Analytics | connections, data views, XDM, cross-channel |
| `target` | Adobe Target | A/B test, MVT, personalization, recommendations, audiences |
| `campaign` | Adobe Campaign | workflows, deliveries, profiles, transactional messages |
| `ajo` | Adobe Journey Optimizer | journeys, offers, decisioning, channels |
| `aep` | Adobe Experience Platform | schemas, datasets, ingestion, query service, sandboxes |
| `rtcdp` | Real-Time CDP | segments, destinations, identity, profiles, audiences |
| `aam` | Audience Manager | traits, segments, data sources (legacy) |
| `commerce` | Adobe Commerce | catalog, checkout, extensions, payment services |
| `marketo` | Marketo Engage | leads, programs, smart campaigns, nurture |
| `workfront` | Adobe Workfront | projects, tasks, proofing, Fusion |
| `genstudio` | GenStudio | content generation, brand guidelines |
| `mix-modeler` | Adobe Mix Modeler | attribution, marketing mix |

---

## 10. Phase 3: DISTRIBUTE — Adobe Ecosystem Routing

### 10.1 Routing Rules (Extended for Adobe)

```
┌─────────────────────────────────────────────────────────────────┐
│                ADOBE DISTRIBUTION ENGINE                          │
│                                                                   │
│  Analyzed Migration Item                                         │
│       │                                                           │
│       ├──▶ AEM CLOUD SERVICE                                     │
│       │    Content → CTT orchestration → AEM Cloud               │
│       │    Code → Cloud Manager pipeline → AEM Cloud             │
│       │    Configs → .cfg.json → Git → Cloud Manager             │
│       │    Indexes → /oak:index → Git → Cloud Manager            │
│       │                                                           │
│       ├──▶ ADOBE EXPERIENCE PLATFORM                             │
│       │    Customer data → XDM schema → Batch/Stream ingestion   │
│       │    Segments → Segmentation API → AEP                     │
│       │    Identities → Identity Service → AEP                   │
│       │    Consent records → Consent schema → AEP                │
│       │                                                           │
│       ├──▶ ADOBE ANALYTICS / CJA                                 │
│       │    Report configs → Admin API → Analytics                │
│       │    Segments → Segmentation API → Analytics               │
│       │    Classifications → Classifications API → Analytics     │
│       │    Historical data → Bulk Insertion / BigQuery → CJA     │
│       │                                                           │
│       ├──▶ ADOBE CAMPAIGN v8                                     │
│       │    Recipient data → Import workflows → Campaign          │
│       │    Templates → Campaign API → Campaign                   │
│       │    Workflows → Workflow engine → Campaign                │
│       │    Deliverability config → IP warmup plan                │
│       │                                                           │
│       ├──▶ ADOBE TARGET                                          │
│       │    Activities → Admin API → Target                       │
│       │    Audiences → Admin API → Target                        │
│       │    Offers → Admin API → Target                           │
│       │    Recommendations → Models API → Target                 │
│       │                                                           │
│       ├──▶ NAVIGATOR                                             │
│       │    Tickets (base Black Hole flow) → Navigator tickets    │
│       │    Migration tasks → Navigator project tracking          │
│       │    KB articles → Navigator knowledge base                │
│       │                                                           │
│       └──▶ RUVECTOR                                              │
│            Migration patterns → migration_patterns namespace     │
│            Code patterns → code_patterns namespace               │
│            Content patterns → content_patterns namespace         │
│            Risk patterns → risk_patterns namespace               │
│            Knowledge → knowledge namespace (KB articles)         │
│            Compliance → compliance_patterns namespace            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Module 1: AEM Migration Engine

### 11.1 AEM On-Prem to Cloud Service Migration

This is the crown jewel — the highest-value, highest-complexity migration path.

#### 11.1.1 Assessment (Extends BPA)

Black Hole's AEM assessment goes far beyond what BPA provides:

| Capability | BPA | Black Hole |
|-----------|-----|------------|
| Pattern detection | 30+ pattern detectors | All BPA patterns + 100+ additional AI-powered detectors |
| Severity scoring | 4 levels (Critical/Major/Advisory/Info) | Weighted risk score with effort estimates per finding |
| Remediation guidance | Links to documentation | AI-generated code fixes for 50-60% of findings |
| Code analysis depth | Surface-level API scanning | Deep static analysis of business logic, dependency graphs |
| Content analysis | None | Content health scoring, duplicate detection, metadata quality |
| Integration mapping | None | Automatic discovery and mapping of all integrations |
| Effort estimation | None | Hours per finding, total migration effort estimate |
| Risk prediction | None | ML-based risk model trained on historical migration data |
| Priority sequencing | None | Recommended fix order based on dependencies and risk |

#### 11.1.2 Code Modernization Engine

Automates the transformation of AEM 6.x code to Cloud Service compatibility:

**OSGi Configuration Migration**:
```
SOURCE (AEM 6.x):
  /apps/myproject/config/com.day.cq.dam.core.impl.servlet.HealthCheckServlet.xml
  (sling:OsgiConfig node type)

BLACK HOLE TRANSFORMS TO:

TARGET (AEM Cloud Service):
  /apps/myproject/osgiconfig/config/
    com.day.cq.dam.core.impl.servlet.HealthCheckServlet.cfg.json
  {
    "cq.dam.healthcheck.enabled": true
  }
```

**Deprecated API Replacement**:
```java
// SOURCE: Deprecated Sling API usage
@Reference
private SlingRepository repository;
Session session = repository.loginAdministrative(null);

// BLACK HOLE TRANSFORMS TO:
@Reference
private ResourceResolverFactory resolverFactory;
Map<String, Object> params = Map.of(
    ResourceResolverFactory.SUBSERVICE, "my-service-user"
);
ResourceResolver resolver = resolverFactory.getServiceResourceResolver(params);
```

**Maven Project Restructuring**:
```
SOURCE (AEM 6.x monolithic):               TARGET (Cloud Service):
├── pom.xml                                 ├── pom.xml
├── core/                                   ├── core/ (bundles)
├── ui.apps/                                ├── ui.apps/ (immutable code)
│   └── filter.xml (mixed)                  ├── ui.apps.structure/
└── ...                                     ├── ui.config/ (OSGi configs)
                                            ├── ui.content/ (mutable content)
                                            ├── ui.frontend/ (client libs)
                                            ├── ui.tests/ (functional tests)
                                            ├── dispatcher/ (cloud config)
                                            └── all/ (container package)
```

**Dispatcher Configuration Conversion**:
```
SOURCE (on-prem Apache):                    TARGET (Cloud CDN):
├── conf/httpd.conf                         ├── conf.d/
├── conf.d/                                 │   ├── available_vhosts/
│   ├── enabled_vhosts/                     │   ├── dispatcher_vhost.conf
│   └── rewrites/                           │   └── rewrites/
├── conf.dispatcher.d/                      ├── conf.dispatcher.d/
│   ├── available_farms/                    │   ├── available_farms/
│   ├── cache/                              │   ├── cache/
│   ├── clientheaders/                      │   ├── filters/
│   ├── filters/                            │   └── renders/
│   └── renders/                            └── opt-in/
└── ...                                         └── USE_SOURCES_DIRECTLY
```

**Workflow Migration**:
```
SOURCE (AEM 6.x custom workflow):           TARGET (Cloud Service):
─ Custom workflow process step              ─ Sling Job consumer
  (WorkflowProcess interface)                 (JobConsumer interface)
─ DAM Update Asset workflow                 ─ Asset microservices
  (20+ custom steps)                          (processing profiles)
─ Cron-based schedulers                     ─ Sling Jobs with
  (Scheduler interface)                       Cloud-compatible scheduling
```

#### 11.1.3 Content Migration Orchestration

Black Hole wraps Adobe's Content Transfer Tool (CTT) with intelligent orchestration:

```
CONTENT MIGRATION FLOW
══════════════════════

1. PRE-MIGRATION ANALYSIS
   ├── Content inventory (all JCR paths)
   ├── Content health scoring
   ├── Duplicate detection (RuVector similarity)
   ├── Metadata quality assessment
   ├── Reference integrity check
   ├── Published vs. unpublished identification
   └── Size estimation for CTT planning

2. CONTENT CLEANUP (Optional, Recommended)
   ├── Remove identified duplicates
   ├── Fix broken references
   ├── Standardize metadata
   ├── Archive stale content
   └── Fix mutable/immutable path violations

3. CTT ORCHESTRATION
   ├── Auto-configure migration sets
   ├── Intelligent batching (by site, by content type)
   ├── AzCopy pre-copy for >200GB sets
   ├── Progress monitoring via WebSocket
   ├── Incremental/top-up migration scheduling
   └── Automated retry on failure

4. POST-MIGRATION VALIDATION
   ├── Content count verification
   ├── Reference integrity check
   ├── Asset rendition verification
   ├── Metadata completeness check
   ├── Permission/ACL validation
   ├── Live copy relationship verification
   ├── Content Fragment model validation
   └── Experience Fragment export verification
```

#### 11.1.4 Integration Migration

For each integration discovered during assessment, Black Hole:

1. **Identifies** the integration type, data flow, and criticality
2. **Maps** the source configuration to target configuration
3. **Generates** target integration config (where possible)
4. **Validates** the integration works end-to-end

**Common AEM Integration Migrations**:

| Integration | Source Config | Target Config | Auto-Migratable? |
|------------|-------------|---------------|-------------------|
| Adobe Analytics | DTM/Launch property | AEP Tags + Web SDK | Yes (config generation) |
| Adobe Target | mbox.js / at.js | AEP Tags + Web SDK | Yes (config generation) |
| Adobe Campaign | Cloud service config | IMS-based cloud config | Partial |
| Salesforce CRM | Custom OSGi bundle | AEP Source Connector | Template provided |
| SAP | Custom integration | AEP Source Connector | Template provided |
| LDAP/AD auth | OSGi config | IMS + Admin Console | Guide generated |
| SSO (SAML) | SAML handler OSGi | IMS SAML integration | Guide generated |
| Custom APIs | Various | Cloud-compatible servlets | AI refactoring |

### 11.2 AEM Version Upgrades (6.x → 6.5)

For customers who need to upgrade to AEM 6.5 before migrating to Cloud:

**Supported Upgrade Paths**:
- AEM 6.1 → 6.5 (requires stepping through 6.3)
- AEM 6.2 → 6.5 (requires stepping through 6.3)
- AEM 6.3 → 6.5 (direct upgrade supported)
- AEM 6.4 → 6.5 (direct upgrade supported)

**Black Hole Provides**:
- Pattern detection for version-specific compatibility issues
- Oak Segment Tar migration analysis
- Service pack compatibility matrix
- Lazy content migration planning
- TarMK to TarMK vs. TarMK to MongoMK recommendations

### 11.3 Non-AEM CMS to AEM Migration

#### WordPress to AEM

```
WORDPRESS → AEM MAPPING ENGINE
═══════════════════════════════

WP Concept          │  AEM Equivalent        │  Auto-Mapped?
────────────────────┼────────────────────────┼──────────────
Theme               │  Page Template + Policies │  Template generated
Template files      │  HTL components          │  Structure mapped
Widgets             │  AEM Components          │  Config mapped
Posts/Pages         │  cq:Page nodes           │  Content migrated
Custom Post Types   │  Content Fragment Models  │  Schema generated
Categories/Tags     │  AEM Tags (/content/cq:tags) │  Taxonomy migrated
Media Library       │  AEM DAM (/content/dam)  │  Assets migrated
Menus               │  Navigation component    │  Structure migrated
Custom Fields (ACF) │  Component dialogs       │  Dialog generated
Permalinks          │  Sling URL mapping       │  Redirects generated
SEO (Yoast)         │  AEM SEO components      │  Meta migrated
Forms (CF7/Gravity) │  AEM Forms               │  Form structure mapped
WooCommerce         │  Adobe Commerce          │  Separate module
```

#### Sitecore to AEM

```
SITECORE → AEM MAPPING ENGINE
══════════════════════════════

Sitecore Concept    │  AEM Equivalent          │  Auto-Mapped?
────────────────────┼──────────────────────────┼──────────────
Template            │  Component + Dialog       │  Structure mapped
Layout              │  Page Template            │  Template generated
Rendering           │  AEM Component            │  Component mapped
Media Library       │  AEM DAM                  │  Assets migrated
Content Items       │  cq:Page / Content Frag   │  Content migrated
Placeholders        │  Parsys / Layout Container│  Container mapped
xDB Profiles        │  AEP Profiles             │  Schema generated
Personalization     │  Adobe Target rules       │  Rules converted
SXA Components      │  AEM Core Components      │  Component mapped
Forms               │  AEM Forms                │  Form mapped
Taxonomy            │  AEM Tags                 │  Tags migrated
Workflows           │  AEM Workflows            │  Workflow mapped
```

### 11.4 AEM Edge Delivery Services Migration

For customers migrating traditional AEM Sites to Edge Delivery Services:

**Migration Approaches**:
1. **Full Rebuild** — Recreate site using document-based authoring (Google Docs/SharePoint)
2. **Importer Tool** — Use Adobe's site importer to crawl existing site and generate EDS content
3. **Hybrid** — AEM Sites for complex pages + EDS for high-performance content pages

**Black Hole Provides**:
- Site analysis to identify which pages are EDS-candidates vs. require traditional authoring
- Automatic block generation from existing AEM component structures
- Content migration from JCR to Google Docs/SharePoint format
- Sidekick configuration generation
- Performance baseline comparison (before/after Lighthouse scores)

---

## 12. Module 2: Analytics Migration Engine

### 12.1 Google Analytics to Adobe Analytics / CJA

**Dimension/Metric Mapping** (automated by Black Hole):

| GA Concept | Adobe Analytics | CJA (via AEP) |
|-----------|-----------------|----------------|
| Sessions | Visits | Sessions (XDM) |
| Users | Unique Visitors | People (cross-device) |
| Pageviews | Page Views | Page Views (XDM) |
| Events | Custom Events (event1-1000) | XDM ExperienceEvent |
| Custom Dimensions | eVars (250) + Props (75) | Any XDM field |
| Custom Metrics | Custom Events | Any XDM metric |
| Goals | Conversion events | XDM conversion events |
| Audiences | Segments | AEP Segments |
| Source/Medium | Marketing Channels | Attribution channels |

**Implementation Swap**:
```javascript
// Black Hole generates the equivalent Web SDK implementation
// from existing gtag.js or AppMeasurement code

// Source: gtag.js
gtag('event', 'purchase', { transaction_id: 'T123', value: 49.99 });

// Generated: Adobe Web SDK (alloy.js)
alloy("sendEvent", {
  xdm: {
    eventType: "commerce.purchases",
    commerce: {
      purchases: { value: 1 },
      order: { purchaseID: "T123", priceTotal: 49.99 }
    }
  }
});
```

**Historical Data Migration Path**:
1. Export GA data via BigQuery (GA4) or Reporting API (UA)
2. Transform to XDM schema (Black Hole generates SQL transforms)
3. Ingest into AEP via Batch Ingestion API
4. Query in CJA via Data Views

### 12.2 Adobe Analytics to CJA

**Black Hole Automates**:
- XDM schema design from existing report suite configuration
- Analytics source connector setup
- Data view creation from existing report suite variables
- Segment recreation in CJA format
- Calculated metric recreation
- Workspace project recreation guidance

---

## 13. Module 3: Campaign & Journey Migration Engine

### 13.1 Campaign Standard to Campaign v8

Adobe's forced migration path. Black Hole automates:

| Component | Migration Approach |
|-----------|-------------------|
| Recipient data | Schema mapping → Campaign v8 recipient table |
| Email templates | Template conversion (HTML compatible) |
| Workflows | Workflow recreation in v8 canvas |
| Landing pages | Landing page migration |
| Reporting | Report recreation in v8 |
| Integrations | AEP integration for segmentation |
| Deliverability | IP warmup plan for new infrastructure |
| Transactional messages | Message Center migration |

### 13.2 SFMC to Adobe Campaign / AJO

The most complex cross-platform campaign migration:

```
SFMC → ADOBE MAPPING
═════════════════════

SFMC Component        │  Adobe Equivalent       │  Complexity
──────────────────────┼─────────────────────────┼───────────
Data Extensions       │  AEP Datasets (XDM)     │  High (schema redesign)
Journey Builder       │  AJO Journeys           │  High (logic conversion)
Automation Studio     │  Campaign Workflows      │  High (engine differences)
Content Builder       │  AEM Assets + Templates  │  Medium
AMPscript             │  Handlebars / Campaign   │  High (language conversion)
                      │  scripting               │
SSJS                  │  Server-side processing  │  High
Einstein Engagement   │  Adobe Sensei / AI       │  Medium
Subscriber Data       │  AEP Profiles            │  High (identity resolution)
Tracking              │  Adobe Analytics / AEP   │  Medium
Sending Domains       │  New domain config       │  Low (but critical)
IP Addresses          │  New IPs + warmup plan   │  Medium
Suppression Lists     │  Campaign suppression    │  Low
```

**IP Warmup Schedule** (auto-generated by Black Hole):

| Day | Volume | Notes |
|-----|--------|-------|
| 1-2 | 500/day | Most engaged subscribers only |
| 3-4 | 1,000/day | Expand to recent openers |
| 5-7 | 2,500/day | Include 90-day actives |
| 8-14 | 5,000-10,000/day | Gradually increase |
| 15-21 | 25,000-50,000/day | Monitor bounce rates |
| 22-30 | 100,000+/day | Full volume ramp |

---

## 14. Module 4: CDP/DMP Migration Engine

### 14.1 Audience Manager to RTCDP

Adobe's three official migration options, orchestrated by Black Hole:

| Option | Description | When to Use |
|--------|-------------|------------|
| **Side-by-side** | Run AAM and RTCDP simultaneously during transition | Gradual migration, risk-averse |
| **Audience Manager Connector** | Use AAM as source connector to RTCDP | Preserve AAM segments in AEP |
| **Full migration** | Migrate everything to RTCDP, decommission AAM | Clean break |

**What Migrates**:
- Traits → AEP Segments (rule-based conversion)
- Segments → AEP Segments
- Data sources → AEP Source connectors
- Destinations → AEP Destinations
- ID syncs → Identity Service namespaces

**What Does NOT Migrate** (Black Hole documents these):
- Algorithmic models (Lookalike models)
- Data Export Controls (replaced by AEP Data Governance)
- Visitor Profile Viewer (replaced by AEP Profile viewer)
- Audience Lab (no direct equivalent)

### 14.2 Third-Party CDP to AEP/RTCDP

For each source CDP, Black Hole:
1. Maps source data model to XDM schema
2. Generates XDM schema definitions
3. Maps source segments to AEP segments
4. Maps source integrations to AEP destinations
5. Migrates identity resolution configuration

---

## 15. Module 5: Commerce Migration Engine

### 15.1 Shopify to Adobe Commerce

| Data Type | Source API | Target API | Notes |
|-----------|-----------|-----------|-------|
| Products | Shopify Admin API | Adobe Commerce REST/GraphQL | Full catalog with variants |
| Categories | Collections API | Category API | Hierarchy preservation |
| Customers | Customer API | Customer API | Password reset required |
| Orders | Order API | Order API | Historical order preservation |
| Reviews | Product Reviews API | Reviews extension | Third-party extension needed |
| CMS Pages | Pages/Blogs API | CMS Blocks/Pages API | Content formatting differences |

**Key Limitation**: Customer passwords cannot be migrated due to hashing differences. Black Hole generates a password reset flow for post-migration.

### 15.2 SFCC (Demandware) to Adobe Commerce

| SFCC Concept | Adobe Commerce Equivalent | Complexity |
|-------------|--------------------------|------------|
| Cartridges | Extensions (App Builder) | High |
| SFRA Templates | Adobe Commerce Themes | High |
| OCAPI Endpoints | REST/GraphQL APIs | Medium |
| Business Manager | Admin Panel | Training required |
| Pipeline Architecture | Event-driven architecture | High |

---

## 16. Module 6: DAM & Workfront Migration Engine

### 16.1 Third-Party DAM to AEM Assets

**Universal DAM Migration Blueprint**:

```
SOURCE DAM → BLACK HOLE → AEM ASSETS
═════════════════════════════════════

1. INVENTORY
   ├── Crawl source DAM API
   ├── Catalog all assets with metadata
   ├── Identify collections/folders
   ├── Map metadata schema
   └── Calculate storage requirements

2. TRANSFORM
   ├── Map metadata fields to AEM schema
   ├── Convert taxonomy to AEM tags
   ├── Resize/convert formats as needed
   ├── Generate renditions
   └── Detect and flag duplicates

3. TRANSFER
   ├── Batch upload via AEM Assets API
   ├── Direct binary upload (Cloud Service)
   ├── Parallel upload streams
   ├── Progress tracking
   └── Resume on failure

4. VALIDATE
   ├── Asset count verification
   ├── Metadata completeness check
   ├── Rendition verification
   ├── Collection/folder structure
   └── Permission assignment
```

**Volume/Timeline Estimates**:

| Asset Count | Storage | Black Hole Duration | Notes |
|------------|---------|-------------------|-------|
| 10,000 | <100GB | 2-4 hours | Small DAM |
| 50,000 | 100-500GB | 8-24 hours | Medium DAM |
| 250,000 | 500GB-2TB | 2-5 days | Large DAM |
| 1,000,000+ | 2TB+ | 1-3 weeks | Enterprise DAM (parallel streams) |

### 16.2 Jira to Adobe Workfront

| Jira Concept | Workfront Equivalent | Auto-Mapped? |
|-------------|---------------------|--------------|
| Project | Project | Yes |
| Epic | Portfolio item | Yes |
| Story/Task | Task | Yes |
| Bug | Issue | Yes |
| Sprint | Iteration | Yes |
| Custom Field | Custom Form field | Template provided |
| Workflow | Status Flow | Template provided |
| Labels | Categories | Yes |
| Components | Topics | Yes |
| Attachments | Documents | Yes (file transfer) |

---

## 17. Cross-Platform Migration Support

### 17.1 Testing/Personalization Migrations

| Source | Target | Black Hole Coverage |
|--------|--------|-------------------|
| Optimizely | Adobe Target | Experiment recreation, audience mapping, feature flag migration |
| VWO | Adobe Target | Test migration, audience conversion |
| Dynamic Yield | Adobe Target | Personalization rule conversion |
| Google Optimize (sunset) | Adobe Target | All experiments and audiences |

### 17.2 Tag Management Migration

**GTM to AEP Tags**:
Black Hole analyzes the GTM container export (JSON) and generates equivalent AEP Tags configuration including:
- Extensions (Adobe Analytics, Web SDK, Target, etc.)
- Data elements (from GTM variables)
- Rules (from GTM triggers + tags)
- Publishing workflow

---

## 18. Compliance & Security

### 18.1 Compliance Engine

Black Hole includes an automated compliance engine that scans all migration data:

| Framework | What Black Hole Checks | Automated Actions |
|-----------|----------------------|-------------------|
| **GDPR** | Personal data identification, consent records, data residency | Flag PII, validate consent migration, generate DPIA |
| **CCPA/CPRA** | Consumer data classification, opt-out records | Flag regulated data, validate opt-out preservation |
| **HIPAA** | PHI identification, BAA coverage validation | Flag PHI, enforce encryption, generate BAA checklist |
| **FedRAMP** | Data residency, security controls | Validate target environment authorization |
| **PCI-DSS** | Payment data identification | Isolate payment data from migration scope |
| **SOX** | Audit trail preservation | Generate audit trail migration plan |
| **Section 508** | Accessibility compliance | Generate accessibility audit for migrated content |

### 18.2 Data Security During Migration

| Security Measure | Implementation |
|-----------------|----------------|
| Encryption in transit | TLS 1.3 for all data transfers |
| Encryption at rest | AES-256 for temporary storage |
| Data residency | Configurable Azure/AWS regions |
| Access control | Role-based access, MFA required |
| Audit logging | All operations logged with user/timestamp |
| PII detection | AI-powered scanning of all content |
| Data retention | Configurable TTL, auto-purge after migration |
| Credential handling | Vault-based secret management (no plaintext) |

### 18.3 Consent Migration

Black Hole ensures consent records are properly migrated across platforms:

```
CONSENT MIGRATION FLOW
══════════════════════

1. Identify consent records in source system
2. Map consent categories to target system's consent framework
3. Validate consent granularity is preserved (purpose-specific)
4. Transfer consent records with full audit trail
5. Validate consent withdrawal mechanisms work in target
6. Generate compliance report documenting consent migration
```

---

## 19. API Integration Layer

### 19.1 Adobe APIs Used by Black Hole

Black Hole integrates with the following Adobe APIs:

**Authentication**: OAuth 2.0 Server-to-Server credentials (via Adobe Developer Console)

| API | Purpose | Key Endpoints |
|-----|---------|--------------|
| **AEM Assets HTTP API** | Asset inventory, metadata, upload | `/api/assets/{path}.json` |
| **AEM GraphQL API** | Content Fragment extraction | `/graphql/execute.json/{path}` |
| **AEM Sling API** | Content tree extraction | `/content/{path}.infinity.json` |
| **AEM Package Manager** | Package create/download/install | `/crx/packmgr/service.jsp` |
| **Cloud Manager API** | Environment management, pipelines | `cloudmanager.adobe.io/api/...` |
| **Analytics 2.0 API** | Report suite config, segments | `analytics.adobe.io/api/...` |
| **AEP Schema Registry** | XDM schema management | `/schemaregistry/...` |
| **AEP Batch Ingestion** | Data ingestion | `/batches/...` |
| **AEP Flow Service** | Source/destination connectors | `/flows/...` |
| **AEP Segmentation** | Segment management | `/segment/definitions/...` |
| **AEP Identity Service** | Identity management | `/identity/...` |
| **Target Admin API** | Activities, audiences, offers | `mc.adobe.io/{tenant}/target/...` |
| **Campaign v8 API** | Profiles, workflows, deliveries | Campaign instance API |
| **Commerce REST/GraphQL** | Catalog, customers, orders | `/rest/V1/...` |
| **Marketo REST API** | Leads, programs, campaigns | `{instance}.mktorest.com/rest/...` |
| **Workfront REST API** | Projects, tasks, documents | `{domain}.my.workfront.com/attask/api/...` |

### 19.2 Black Hole API (for Partners and Customers)

Black Hole exposes its own API for integration with customer tools:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/migrations` | Create new migration project |
| `GET` | `/api/v1/migrations/{id}` | Get migration status and progress |
| `POST` | `/api/v1/migrations/{id}/assess` | Run assessment on connected source |
| `GET` | `/api/v1/migrations/{id}/assessment` | Get assessment results |
| `POST` | `/api/v1/migrations/{id}/plan` | Generate migration plan |
| `POST` | `/api/v1/migrations/{id}/transform` | Execute code/content transformation |
| `POST` | `/api/v1/migrations/{id}/execute` | Execute migration (CTT orchestration) |
| `POST` | `/api/v1/migrations/{id}/validate` | Run validation suite |
| `GET` | `/api/v1/migrations/{id}/report` | Get migration report |
| `GET` | `/api/v1/migrations/{id}/compliance` | Get compliance report |
| `GET` | `/api/v1/migrations/{id}/roi` | Get ROI tracking data |
| `POST` | `/api/v1/connectors` | Configure source/target connectors |
| `GET` | `/api/v1/templates` | List migration templates |
| `GET` | `/api/v1/health` | Platform health check |

---

## 20. Technical Requirements

### 20.1 Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Core Engine** | Node.js / TypeScript | Migration orchestration, API layer |
| **AI Engine** | Claude API (Haiku/Sonnet/Opus) | Classification, code refactoring, content analysis |
| **Vector Store** | RuVector (Qdrant) | Similarity search, duplicate detection, pattern matching |
| **Queue** | Redis / Bull | Job queue for batch processing |
| **Storage** | S3-compatible | Temporary migration data storage |
| **Database** | PostgreSQL | Migration project state, audit logs |
| **Realtime** | WebSocket | Progress tracking, live updates |
| **CDN** | Cloudflare | API edge caching |

### 20.2 Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                 CLIENT NETWORK                    │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ AEM 6.x  │  │ Git Repo │  │ Other    │      │
│  │ Instance │  │ (Code)   │  │ Sources  │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼──────────────┼─────────────┼────────────┘
        │              │             │
        ▼              ▼             ▼
┌─────────────────────────────────────────────────┐
│              BLACK HOLE PLATFORM                  │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Ingest  │  │  Sort   │  │Distribute│         │
│  │ Service │──▶│ Service │──▶│ Service  │         │
│  └─────────┘  └─────────┘  └─────────┘         │
│       │            │            │                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Claude  │  │RuVector │  │  Queue  │         │
│  │ API     │  │         │  │ (Redis) │         │
│  └─────────┘  └─────────┘  └─────────┘         │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │PostgreSQL│  │   S3    │  │WebSocket│         │
│  │ (State) │  │(Storage)│  │  (Live) │         │
│  └─────────┘  └─────────┘  └─────────┘         │
└─────────────────────────────────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌─────────────────────────────────────────────────┐
│              ADOBE CLOUD                          │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │AEM Cloud │  │   AEP    │  │ Campaign │      │
│  │ Service  │  │  /RTCDP  │  │   v8     │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Analytics │  │  Target  │  │ Commerce │      │
│  │  / CJA   │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

### 20.3 Performance Requirements

| Metric | Target |
|--------|--------|
| Assessment scan (1,000 pages) | < 30 minutes |
| Code analysis (100 bundles) | < 1 hour |
| Content classification (10,000 items) | < 2 hours |
| Content transfer orchestration | Limited by CTT/network |
| API response time | < 500ms (p95) |
| WebSocket update frequency | Every 5 seconds during active jobs |
| Concurrent migrations | 10+ per platform instance |

---

## 21. Go-to-Market Strategy

### 21.1 Target Customers (Initial)

**Phase 1**: Existing Navigator customers who are Adobe shops
- Already trust the platform
- Immediate need (AEM migration deadlines)
- Upsell from existing support contracts

**Phase 2**: Adobe Solution Partners
- White-label or co-branded offering
- Reduces their migration delivery costs
- Increases their migration throughput and margins
- Partners like 3|SHARE, Oshyn, Perficient who specialize in migrations

**Phase 3**: Direct enterprise sales
- Fortune 1000 companies facing AEM migration deadlines
- Companies frustrated with current SI engagement timelines/costs

### 21.2 Positioning

**For Customers**: "Migrate your entire Adobe ecosystem in weeks, not months. Black Hole's AI does in days what consultants take months to do — and catches what they miss."

**For Partners**: "10x your migration practice. Black Hole handles the heavy lifting so your consultants can focus on strategy, customization, and client relationships."

**Against SIs**: "Why spend $3M and 18 months when Black Hole can do it for $500K in 3 months? Your SI can still manage the engagement — just with dramatically less manual work."

### 21.3 Sales Motion

1. **Free Assessment** — Run Black Hole assessment on prospect's AEM instance (3-5 days, no cost)
2. **Assessment Report** — Deliver comprehensive migration readiness report with risk scores, effort estimates, and cost projections
3. **Compare** — Show side-by-side: traditional SI engagement vs. Black Hole-assisted migration
4. **Pilot** — Migrate one site/property as proof of concept
5. **Full engagement** — Migrate entire Adobe ecosystem

---

## 22. Pricing Model

### 22.1 Platform Pricing

| Tier | Target Segment | Included | Price |
|------|---------------|----------|-------|
| **Assessment** | Any | Full readiness assessment, migration plan, risk report | $5K-$15K (or free for qualified prospects) |
| **Standard** | Mid-Market | AEM migration (up to 10 sites), 1 additional product | $50K-$150K per migration |
| **Professional** | Enterprise | AEM migration (up to 50 sites), 3 additional products, compliance engine | $150K-$500K per migration |
| **Enterprise** | Large Enterprise | Unlimited sites, all products, compliance, dedicated support, custom connectors | $500K-$1.5M per migration |

### 22.2 Add-On Pricing

| Add-On | Price | Description |
|--------|-------|-------------|
| Post-migration monitoring | $2K-$10K/month | Drift detection, performance tracking, alerts |
| Additional product migration | $25K-$100K each | Campaign, Analytics, Commerce, etc. |
| Custom connector development | $15K-$50K each | For non-standard source platforms |
| Compliance certification | $10K-$25K | HIPAA, FedRAMP, SOX documentation |
| Training & enablement | $5K-$15K | Content author and admin training |

### 22.3 Partner Pricing

| Model | Description | Price |
|-------|-------------|-------|
| **Reseller** | Partner sells Black Hole under their brand | 30-40% discount from list |
| **OEM** | Black Hole embedded in partner's migration practice | Volume licensing, custom pricing |
| **Referral** | Partner refers customer, we deliver | 15-20% referral fee |

---

## 23. Phased Delivery Roadmap

### Phase 1: AEM Migration Core (Months 1-4)

**Objective**: Ship the highest-value migration path — AEM on-prem to Cloud Service.

| Deliverable | Description |
|------------|-------------|
| AEM Repository Connector | Connect to AEM 6.3-6.5 instances |
| Code Repository Connector | Analyze Maven/Git AEM projects |
| Assessment Engine | BPA-extended analysis with readiness scoring |
| Code Modernization (OSGi configs) | Automated .cfg.json conversion |
| Code Modernization (Maven restructure) | Archetype 35+ project restructuring |
| Code Modernization (Dispatcher) | Dispatcher config conversion |
| CTT Orchestration | Intelligent Content Transfer Tool wrapper |
| Content Validation | Post-migration content integrity checks |
| Assessment Report UI | Web-based readiness report |
| Migration Dashboard | Progress tracking with WebSocket updates |

### Phase 2: Code Intelligence + Testing (Months 4-7)

| Deliverable | Description |
|------------|-------------|
| AI Code Refactoring | Deprecated API replacement, workflow conversion |
| Integration Discovery | Automatic integration detection and mapping |
| Test Generation Engine | AI-generated test suites from assessment findings |
| Visual Regression Testing | Automated screenshot comparison |
| SEO Validation | URL mapping, redirect generation, meta tag validation |
| Performance Benchmarking | Before/after performance comparison |
| AEM Version Upgrade Path | Support for 6.x → 6.5 upgrades |

### Phase 3: Cross-Platform + Analytics (Months 7-10)

| Deliverable | Description |
|------------|-------------|
| WordPress → AEM Connector | WP REST API + WXR import |
| Sitecore → AEM Connector | Sitecore item export + mapping |
| GA → Adobe Analytics Connector | GTM/GA config analysis + Web SDK generation |
| Adobe Analytics → CJA Module | XDM schema generation, source connector setup |
| Audience Manager → RTCDP Module | Trait/segment migration orchestration |
| Compliance Engine v1 | GDPR + CCPA automated scanning |

### Phase 4: Campaign + Commerce + Full Platform (Months 10-14)

| Deliverable | Description |
|------------|-------------|
| Campaign Standard → v8 Module | Forced migration automation |
| SFMC → Adobe Campaign/AJO Module | Cross-platform campaign migration |
| Campaign Classic v7 → v8 Module | Campaign upgrade automation |
| Shopify → Adobe Commerce Module | Full commerce migration |
| SFCC → Adobe Commerce Module | Demandware migration |
| DAM Migration Module | Third-party DAM to AEM Assets |
| Workfront Migration Module | Jira/Asana → Workfront |
| Edge Delivery Services Module | Traditional AEM → EDS migration |

### Phase 5: Intelligence + Ecosystem (Months 14-18)

| Deliverable | Description |
|------------|-------------|
| Risk Prediction Model | ML model trained on completed migrations |
| ROI Tracker | Actual vs. projected value measurement |
| Post-Migration Monitor | Continuous drift detection |
| Partner Portal | White-label and OEM partner interface |
| Migration Template Marketplace | Community-contributed migration templates |
| HubSpot → Marketo Module | B2B marketing migration |
| Optimizely → Target Module | Testing platform migration |
| Full Compliance Suite | HIPAA, FedRAMP, SOX, PCI-DSS |

---

## 24. Success Metrics

### 24.1 Product Metrics

| Metric | Target (Year 1) | Target (Year 2) |
|--------|-----------------|-----------------|
| Migrations completed | 50 | 250 |
| Assessment scans | 200 | 1,000 |
| Average time savings vs. traditional | 65%+ | 75%+ |
| Average cost savings vs. traditional | 50%+ | 60%+ |
| Customer satisfaction (NPS) | 60+ | 70+ |
| Migration success rate (no rollback) | 95%+ | 98%+ |

### 24.2 Business Metrics

| Metric | Target (Year 1) | Target (Year 2) |
|--------|-----------------|-----------------|
| Revenue | $2M | $10M |
| Customers | 30 | 150 |
| Partner integrations | 5 | 20 |
| ARR from monitoring add-on | $200K | $2M |

### 24.3 Technical Metrics

| Metric | Target |
|--------|--------|
| Code auto-refactoring accuracy | 85%+ (human review still required) |
| Content migration data integrity | 99.99% |
| Assessment scan false positive rate | <10% |
| Platform uptime | 99.9% |
| Average assessment delivery | <1 week |

---

## 25. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Adobe releases competing end-to-end tool | Medium | High | Move fast; first-mover advantage. Adobe historically builds point tools, not orchestration platforms. Their AI IDE tooling is code-only |
| Code refactoring AI produces incorrect transforms | High | Medium | Mandatory human review for all AI-generated code. Comprehensive test generation to catch issues. Conservative auto-fix threshold |
| Customer AEM instances are too customized for automation | Medium | Medium | Graceful degradation — Black Hole handles what it can, flags remainder for manual work. Assessment accurately identifies automation ceiling |
| Adobe API changes break connectors | Medium | Low | Versioned API integration, compatibility testing against Adobe release notes |
| Compliance false negatives (missed PII) | Low | Very High | Multi-layer scanning (regex + AI + human review for regulated industries). Compliance disclaimer and shared responsibility model |
| SI partners view Black Hole as threat | Medium | Medium | Partner program with reseller margins. Position as "tool that makes SIs more profitable, not replacement" |
| Migration timeline still overruns despite Black Hole | Medium | Medium | Under-promise on timelines. Risk-adjusted estimates. Clear scope management |
| Data loss during migration | Low | Very High | Checksum validation at every stage. Rollback capability. Source data never modified or deleted |

---

## 26. Appendices

### Appendix A: Supporting Research Documents

| Document | Location | Coverage |
|----------|----------|---------|
| Adobe Experience Cloud Reference | `docs/ADOBE_EXPERIENCE_CLOUD_REFERENCE.md` | All 15+ Adobe products, capabilities, licensing |
| AEM Migration Research | `docs/AEM_MIGRATION_RESEARCH.md` | 9 official tools, upgrade paths, failure patterns |
| Cross-Platform Migrations | `docs/cross-platform-migrations-to-adobe.md` | 48+ migration paths with field mappings |
| Adobe Technical Infrastructure | `docs/ADOBE_TECHNICAL_INFRASTRUCTURE.md` | APIs, schemas, auth, release cadence |
| Migration Market Research | `docs/MIGRATION_MARKET_RESEARCH.md` | TAM, pain points, ROI, competitive landscape |

### Appendix B: Adobe Product Deprecation Timeline

| Product | Status | End Date | Impact |
|---------|--------|----------|--------|
| AEM 6.5 (Managed Services) | Active, ending | August 31, 2026 | Must migrate to Cloud |
| AEM 6.5 (On-Premises, Core) | Active, ending | February 2027 | Must migrate or go extended |
| AEM 6.5 (Extended Support) | Available | February 2028 | Absolute final deadline |
| Campaign Standard | Decommissioning | 2026 | Must migrate to v8 |
| Campaign Classic v7 | Active, ending | March 31, 2027 | Must migrate to v8 |
| Audience Manager | Deprecated (no date) | TBD | RTCDP is strategic replacement |
| JWT Credentials | Deprecated | Auto-convert by March 1, 2026 | OAuth S2S required |
| Marketo SOAP API | Deprecated | March 31, 2026 | REST API required |
| Adobe Pass REST v1 | Deprecated | End of 2026 | REST v2 required |

### Appendix C: Key Adobe API Authentication

All Black Hole integrations use **OAuth 2.0 Server-to-Server** credentials (current Adobe standard):

```
1. Create project in Adobe Developer Console
2. Add required API services (AEM, Analytics, Target, etc.)
3. Generate OAuth Server-to-Server credential
4. Required headers for all API calls:
   - Authorization: Bearer {access_token}
   - x-gw-ims-org-id: {IMS_ORG_ID}
   - x-api-key: {CLIENT_ID}
```

JWT credentials were deprecated and auto-converted by March 1, 2026.

### Appendix D: XDM Schema Reference (for AEP Migrations)

Key XDM classes used in migrations:

| Class | Purpose | Common Field Groups |
|-------|---------|-------------------|
| `XDM Individual Profile` | Person/customer data | Demographic, Personal Contact, Work Contact |
| `XDM ExperienceEvent` | Time-series behavioral data | Commerce, Web, Campaign, Advertising |
| `XDM Business Account` | B2B account data | Account Details, Account Components |
| `XDM Business Opportunity` | B2B opportunity data | Opportunity Details, Person Relation |
| `XDM Business Campaign` | Campaign data | Campaign Details, Member Details |

### Appendix E: Glossary

| Term | Definition |
|------|-----------|
| **AEMaaCS** | AEM as a Cloud Service — Adobe's SaaS deployment of AEM |
| **AMS** | Adobe Managed Services — Adobe-hosted AEM deployment |
| **BPA** | Best Practices Analyzer — Adobe's migration readiness scanner |
| **CAM** | Cloud Acceleration Manager — Adobe's migration project tracker |
| **CTT** | Content Transfer Tool — Adobe's content migration utility |
| **CJA** | Customer Journey Analytics — Adobe's next-gen analytics platform |
| **EDS** | Edge Delivery Services — Adobe's high-performance content delivery |
| **FFDA** | Full Federated Data Access — Campaign v8's Snowflake-based architecture |
| **IMS** | Identity Management System — Adobe's unified authentication |
| **JCR** | Java Content Repository — AEM's underlying content storage |
| **OSGi** | Open Service Gateway initiative — AEM's modular Java framework |
| **RDE** | Rapid Development Environment — lightweight AEM cloud dev env |
| **RTCDP** | Real-Time Customer Data Platform — Adobe's CDP offering |
| **SEA** | Support, Enhance, Advise — Navigator's ticket classification |
| **XDM** | Experience Data Model — AEP's standardized data schema framework |

---

*This PRD is a living document. It will be updated as research deepens, customer feedback is gathered, and Adobe releases new products and deprecation timelines.*

*Generated with support from 5 parallel AI research agents analyzing 6,000+ lines of Adobe ecosystem research across products, APIs, migrations, market data, and competitive intelligence.*
