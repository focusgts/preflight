# Adobe Ecosystem Intelligence Report

**Date**: March 22, 2026
**Classification**: Strategic Intelligence
**Prepared for**: Black Hole Product Team

---

## Table of Contents

1. [Adobe Summit 2026](#1-adobe-summit-2026)
2. [Experience Modernization Agent](#2-experience-modernization-agent)
3. [Cloud Acceleration Manager Updates](#3-cloud-acceleration-manager-updates)
4. [Digital Experience Partner Program](#4-digital-experience-partner-program)
5. [AEM 6.5 End-of-Support Timeline](#5-aem-65-end-of-support-timeline)
6. [Analyst Reports and Market Position](#6-analyst-reports-and-market-position)
7. [Customer Sentiment and Migration Pain](#7-customer-sentiment-and-migration-pain)
8. [AI-Powered Migration Landscape](#8-ai-powered-migration-landscape)
9. [Competitive Implications for Black Hole](#9-competitive-implications-for-black-hole)

---

## 1. Adobe Summit 2026

### Event Details

Adobe Summit 2026 takes place **April 19-22, 2026** at The Venetian in Las Vegas (and online). The theme centers on **agentic AI, generative content, and customer experience orchestration**.

### Major Announcements

**10 New AI Agents**: The headline announcement introduces 10 purpose-built AI agents across Adobe's product suite, underpinned by the Experience Platform Agent Orchestrator:

| Agent | Purpose |
|-------|---------|
| Audience Agent | Campaign targeting and segmentation |
| Data Insights Agent | Cross-source data connection and analysis |
| Site Optimization Agent | Website performance tuning |
| Journey Agent | Customer journey orchestration |
| Experience Platform Agent Orchestrator | Central reasoning engine for all agents |
| Brand Concierge | Customer-facing AI for product exploration |
| + 4 additional agents | Various marketing automation tasks |

These agents are currently in **beta testing** with select clients and will be rolled out to customers in the coming months.

**Agent Orchestrator**: Experience Platform Agent Orchestrator is the central intelligence layer. It leverages Experience Platform data and customer knowledge to power reasoning, decision-making, and problem-solving across all agents. Critically, it supports both Adobe-native agents and **third-party agent ecosystems**, positioning Adobe as an orchestration layer rather than a closed system.

**Brand Concierge**: A consumer-facing agentic AI application that supports text and voice input, generates brand-aligned responses including personalized product details, offers, and visual content.

**Semrush Acquisition**: Adobe announced a planned **$1.9 billion acquisition of Semrush** to strengthen search visibility capabilities, combining SEO data with generative engine optimization insights.

### Keynote Vision

Anil Chakravarthy, president of Adobe's digital experience business, framed the strategy: "This is now the era of customer experience orchestration, where your content, customer data, your journeys, are all working hard with AI so you anticipate what your customers want."

### Summit Session Coverage

Sessions span 13 tracks covering AI trends, B2B customer journeys, analytics, customer engagement, and developer tools.

### Partner Awards (2025 Reference)

At Summit 2025, partner awards were given to:
- **Deloitte Digital**: Americas Partner of the Year (second consecutive year)
- **Accenture**: Global Partner of the Year
- **LeapPoint**: GenStudio Partner of the Year (Americas) and Partner of the Year (UK&I)
- **Adswerve**: Americas (customer journeys and analytics)
- **Cognizant**: Central Europe (automotive and financial services)

### Black Hole Implications

- Adobe's agent strategy focuses on **marketing orchestration and personalization**, NOT migration automation
- The Agent Orchestrator does not address code refactoring, integration migration, or end-to-end migration workflows
- The Semrush acquisition signals focus on agentic web visibility, not migration tooling
- Summit sessions do not prominently feature migration acceleration tools
- **Gap confirmed**: No announcement of end-to-end, cross-product migration orchestration

---

## 2. Experience Modernization Agent

### What It Is

The Experience Modernization Agent is an AI development agent within AEM that automates website migrations specifically to **Edge Delivery Services (EDS)**. It is part of the broader Brand Experience Agent family.

### Technical Capabilities

| Capability | Description |
|-----------|-------------|
| Page Analysis | Analyzes source pages, identifies content regions (heroes, CTAs, card grids, tabs, accordions) |
| Block Mapping | Maps content to EDS block-based architecture, producing architecture-aligned output |
| Design System Extraction | Extracts color palettes, typography, button styles, spacing, section backgrounds |
| Code Generation | Generates CSS and JavaScript for new blocks and components |
| Figma Integration | Reads Figma design files via MCP server and generates EDS blocks |
| Bulk Import | Handles bulk content import workflows |

### How It Works

1. **Decomposition**: Deterministically analyzes page structure
2. **Mapping**: Converts content regions to reusable EDS blocks
3. **Design Extraction**: Pulls styling and creates block-level variants
4. **Refinement**: Developers use conversational natural-language prompts to adjust output
5. **Review**: Changes appear as GitHub diffs/PRs for standard engineering review

### User Interface

The Experience Modernization Console is hosted at **aemcoder.adobe.io** -- a web-based, AI-assisted development environment. Developers connect their GitHub project and can immediately prompt changes in natural language without local environment setup.

### Professional Services: AOE Delivery

For complex migrations, Adobe offers the **Agentic Outcome Engineer (AOE)** delivery model -- an engineering-led service that delivers production-ready Edge Delivery sites using the agent.

### Critical Limitations

**Target platform restriction**: Edge Delivery Services ONLY. Does not support:
- HTL-based AEM Publish environments
- SPA frameworks (Next.js, React)
- Headless delivery architectures
- AEM as a Cloud Service (traditional authoring)

**Platform availability restriction**: Only available for AEM as a Cloud Service and Edge Delivery Services. NOT available for:
- AEM 6.5
- AEM 6.5 LTS
- AEM On-premises
- Managed Services

**Functional gaps requiring manual work**:
- Third-party data integrations
- Commerce and search functionality
- MarTech data layers and targeting
- Multisite inheritance (MSM)
- Complex business logic (calculators, configurators)
- Design extraction is "typically close, not perfect" -- requires iterative refinement

### Does It Compete with Black Hole?

**No, but it overlaps narrowly.** The Experience Modernization Agent is a **site-building tool** that helps create new Edge Delivery Services sites by analyzing existing pages. It does NOT:

- Perform AEM 6.x to AEM Cloud Service code refactoring
- Migrate OSGi configurations, workflows, or integrations
- Handle analytics, campaign, or CDP migration
- Orchestrate end-to-end migration across Adobe products
- Provide migration readiness assessment or planning
- Support cross-platform migration paths

**Black Hole addresses the full migration lifecycle** across all Adobe products. The Experience Modernization Agent addresses only the narrow case of converting visual page structures to Edge Delivery Services blocks. These are complementary, not competitive -- Black Hole could even integrate the Modernization Agent as one step in a broader migration workflow.

---

## 3. Cloud Acceleration Manager Updates

### Cloud Manager Release 2026.3.0

Key updates relevant to migration:

| Update | Description |
|--------|-------------|
| Content Copy Wipe Option | Deletes existing content at destination before import, enabling clean-slate migrations |
| UI Extensions in Experience Hub | Custom functionality via Adobe App Builder |
| MCP Server for Cloud Manager | Exposes Cloud Manager APIs as tools for AI-enabled IDEs (Cursor, etc.) |
| Multi-Restore Operations | Sequential restores for Stage/Production without requiring new pipeline runs |
| GitHub URL Flexibility | Accepts repository URLs with or without .git suffix |

### Release Schedule

- **Cloud Manager 2026.3.0**: Released March 2026
- **Next release (2026.4.0)**: Planned for April 2, 2026
- **Feature release 2026.3.0**: March 26, 2026

### Cloud Acceleration Manager (CAM) Core Capabilities

CAM remains the primary Adobe-provided migration orchestration tool with phases:
1. **Readiness**: Best Practices Analyzer (BPA) report ingestion
2. **Implementation**: Code refactoring guidance, content transfer planning
3. **Go-Live**: Cutover planning and validation

### Black Hole Implications

- The MCP Server for Cloud Manager is significant -- it signals Adobe's move toward AI-assisted DevOps, but focuses on deployment operations, not migration transformation
- CAM continues to provide guidance and assessment but NOT automated code refactoring or cross-product orchestration
- The Content Copy Wipe Option simplifies content migration workflows but does not address code transformation
- **Gap persists**: CAM remains a planning and guidance tool, not an execution engine for migration transformation

---

## 4. Digital Experience Partner Program

### Program Launch

On **March 1, 2026**, Adobe launched the **Adobe Digital Experience Partner Program** -- a unified framework that merges the former Solution Partner Program and Technology Partner Program into a single initiative.

### Tier Structure

| Tier | Requirements | Key Benefits |
|------|-------------|-------------|
| **Community** | None; no program fee | Entry-level access to foundational resources |
| **Silver** | Program fee required | Partner Experience Hub access, sandboxes, enablement |
| **Gold** | Demonstrated Adobe expertise; program fee | All Silver benefits + growth acceleration tools |
| **Platinum** | Mature Adobe practices; category-leading integrations | All Gold benefits + premium scale support |

### Recognition and Differentiation

Partners receive recognition across multiple dimensions:
- **Specializations and certifications** for expertise validation
- **Technical validations**: App Assured, Accredited Partner Solutions
- **Co-sell designations** highlighting joint success with Adobe
- **Strategic initiative badges** for content supply chain, personalization
- **Partner Directory** with searchable profiles for visibility

### Key Infrastructure

- **Partner Experience Hub**: Centralized platform for products, sales, learning, support
- **Benefits Center**: Subscription management powered by Adobe Commerce with flexible payment (credit card, invoice, ACH)

### Migration-Specific Incentives

- **Deal registration rebates**: Enterprise Term License Agreement (ETLA) deals eligible for **10% sourcing and selling rebate** on first-year invoiced amount, up to **$500,000 USD** in eligible products
- **Performance incentives**: Rebates tied to revenue targets, vertical market goals, and demand generation
- **Marketing incentives**: Available for demand generation activities
- **Specialization paths**: Partners can attain specializations by demonstrating competence and completing required training

### Black Hole Implications

- The unified partner program creates a clearer path for Black Hole to participate in the Adobe ecosystem
- The 10% deal registration rebate on ETLA deals could be leveraged when Black Hole drives customers to Adobe Cloud migrations
- Strategic initiative badges (content supply chain, personalization) could be pursued for differentiation
- **App Assured** and **Accredited Partner Solutions** technical validations are pathways for Black Hole to gain Adobe-endorsed credibility
- The new program explicitly supports Technology Partners building integrations -- Black Hole fits this category

---

## 5. AEM 6.5 End-of-Support Timeline

### Critical Dates

| Milestone | Date | Impact |
|-----------|------|--------|
| AEM 6.5 Managed Services support ends | **August 31, 2026** | AMS customers must migrate or lose support |
| AEMaaCS deployment pipeline deactivation warning | **April 30, 2026** | Outdated Cloud Service environments risk pipeline deactivation |
| AEM 6.5.26.0 (last service pack) support ends | **February 28, 2027** | Final service pack has 18-month support window |
| AEM 6.5 Core Support ends | **February 2027** | No more patches, updates, or security fixes |
| AEM 6.5 Extended Support ends | **February 2028** | Premium-priced support extension expires |

### The AEM 6.5 LTS Option

Adobe introduced **AEM 6.5 Long-Term Support (LTS)** as an alternative to immediate cloud migration:

- Built on AEM 6.5.22 baseline
- Supports Java 17 and Java 21 (replacing end-of-life Java 8/11)
- Removes legacy components (AEM Communities, Guava, Handlebars)
- Available for on-premises and Managed Services
- Both perpetual and subscription licenses available
- Adobe has committed to supporting LTS "for the foreseeable future"

### Migration Path Decision Matrix

| Factor | AEM 6.5 LTS | AEM as a Cloud Service | Edge Delivery Services |
|--------|-------------|----------------------|----------------------|
| Infrastructure | On-prem/AMS | Cloud-native | Edge-native |
| Migration effort | Moderate (upgrade) | High (re-architecture) | High (rebuild) |
| Future migrations | Will need cloud migration eventually | None (continuous updates) | None (continuous updates) |
| Regulatory fit | Strong (data sovereignty) | Varies | Varies |
| Performance | Traditional | Cloud-scale | Sub-100ms LCP |

### Customer Pressure Indicators

- **14,000-26,000 organizations** estimated to still be running AEM 6.x on-premise
- **AMS customers face the earliest deadline**: August 31, 2026 (only 5 months away)
- Customers choosing LTS are essentially **delaying the inevitable** -- two migrations instead of one
- Industries with strict data regulations (finance, healthcare, government) face additional complexity choosing between on-prem and cloud

### Black Hole Implications

- The AMS deadline of August 31, 2026 creates **immediate urgency** for a large customer segment
- LTS buyers represent a **secondary market** -- they will need migration tooling when they eventually move to cloud
- The existence of LTS as an option means some customers will defer, reducing the immediate addressable market but extending the migration window
- Organizations running AEM 6.5 cannot use Adobe's Experience Modernization Agent, leaving them dependent on manual migration or third-party tools like Black Hole

---

## 6. Analyst Reports and Market Position

### Gartner Magic Quadrant for DXP (2025)

**Major shift**: Optimizely has overtaken Adobe as the top-ranked Leader in the Gartner Magic Quadrant for Digital Experience Platforms, ending Adobe's five-year streak.

| Vendor | Position |
|--------|----------|
| Optimizely | #1 Leader (highest in both Vision and Execution) |
| Adobe | Leader (dropped from #1 position) |
| Acquia | Leader |

**Adobe strengths cited**: Brand awareness, innovation, partner support
**Adobe cautions cited**: Price, complex product portfolio, steep technical skillset learning curve

**Why Optimizely overtook Adobe**: Businesses are prioritizing speed, flexibility, and cost-efficiency over complex legacy systems requiring costly specialists. Optimizely scored highly on platform breadth, modularity, pricing, and global momentum.

### Forrester Wave: Digital Experience Platforms, Q4 2025

Adobe named a **Leader** -- ranked **highest in the current offering category** and designated a **Customer Favorite**.

Key strengths:
- Agentic AI features (Journey Agent, Audience Agent, Agent Orchestrator)
- Cohesive platform for data harmonization, journey orchestration, personalization at scale

Forrester's evaluation explicitly shifted from composability to **agentic intelligence** as the differentiating criterion: "What separates leaders from laggards now is how well heat-seeking AI agents orchestrate those capabilities to deliver business outcomes."

### IDC MarketScape: AI-Enabled Marketing Platforms (2025)

Adobe named a **Leader** in both enterprise and midsize company evaluations.

Capabilities highlighted:
- AI-enabled writing, images, videos, campaign automation, and agents
- Adobe Journey Optimizer for real-time personalization
- Marketo Engage and Journey Optimizer B2B Edition for account-based experiences

### Gartner Magic Quadrant for Personalization Engines (2026)

Optimizely recognized as a Leader for the second consecutive year, alongside Adobe.

### Forrester Wave: Adobe Services, Q3 2024

12 significant Adobe services providers evaluated across 25 criteria. IBM ranked as a Leader, cited for GenAI and personalization capabilities and being among the first partners to achieve Adobe Content Supply Chain readiness.

### Black Hole Implications

- Adobe's slip from the #1 Gartner position signals growing market concern about complexity and cost -- exactly the problems Black Hole solves
- Forrester's pivot to evaluating agentic intelligence validates Black Hole's AI-powered approach
- The analyst community is increasingly focused on **speed and simplicity** over feature depth -- this favors migration accelerators
- Adobe's caution flags (price, complexity, learning curve) are migration inhibitors that Black Hole directly addresses

---

## 7. Customer Sentiment and Migration Pain

### Adobe Experience League Forum Findings

Community discussions reveal significant migration anxiety and frustration:

**Scale of Issues Discovered During Assessment**:
- Users report BPA scans returning **~400 Critical bugs and ~14,000 Major bugs** for migration assessment
- This volume overwhelms manual remediation capacity and drives demand for automated tools

**Content Transfer Challenges**:
- Teams using Content Transfer Tool (CTT) for AMS-to-Cloud migrations encounter multiple issues per migration cycle
- Concerns about content integrity affecting production environments
- Requests for more reliable, production-safe content transfer tools

**Functional Gaps in Cloud Service**:
- Groovy console not available in AEM as a Cloud Service (used extensively in on-prem for admin tasks)
- Asset and content compatibility issues during migration
- Workflow complexity that worked in 6.5 becomes problematic in cloud

**Decision Paralysis**:
- Community threads titled "AEM 6.5 EOL: Upgrade, Migrate, or Wait -- What's the Smart Move?" reflect widespread uncertainty
- Multiple viable paths (LTS, Cloud Service, Edge Delivery) create analysis paralysis
- Customers asking peers for guidance, signaling insufficient vendor support for decision-making

### Enterprise Migration Risk Patterns

From industry analysis, the following risk patterns emerge:

**1. Treating Cloud as Managed Hosting**: Teams assume AEMaaCS operates like AMS, carrying forward legacy assumptions about repository access, deployment timing, and infrastructure behavior.

**2. Content Structure Degradation**: Structural debt (poor content models, overloaded components, inconsistent metadata) transfers directly to cloud. "Cloud Service rewards simplicity" and exposes weaknesses faster.

**3. Custom Code Aging**: Customizations that passed migration testing behave differently after subsequent Cloud releases. Continuous platform updates introduce behavioral changes.

**4. Workflow Complexity**: Overly complex approval chains recreated wholesale discourage author adoption and encourage workarounds, leading to governance collapse.

**5. MSM Configuration Drift**: Multi-Site Manager rollouts fail silently, overrides behave differently, and inheritance assumptions break -- often discovered months later.

**6. Consumption-Based Cost Surprises**: Cloud Service contracts include consumption-based billing (page views, asset storage, CDN usage, API calls). Most companies underestimate usage, leading to unexpected cost escalation.

### Real Story Group Analysis

Real Story Group characterizes Adobe's approach as creating a difficult choice:

- License restructuring typically results in **"higher -- sometimes eye-popping -- recurring costs"**
- Enterprises face "a financial and strategic inflection point" with limited attractive options
- Modern CMS competitors offer lower TCO, faster deployment, and better MACH ecosystem integration
- Adobe's communication is perceived as **pushing cloud migration regardless of actual business needs**

### Black Hole Implications

- The volume of BPA findings (400 Critical, 14,000 Major per project) is precisely the problem Black Hole's automated remediation addresses
- Customer decision paralysis creates an opportunity for Black Hole to serve as a **migration intelligence advisor**, not just an execution tool
- Post-migration degradation patterns validate Black Hole's monitoring and drift detection capabilities
- Cost surprise concerns make Black Hole's predictive cost modeling a high-value differentiator
- Community sentiment confirms that Adobe's native tooling is **insufficient** for the scale of migration challenge

---

## 8. AI-Powered Migration Landscape

### Adobe's Native AI Migration Tools

| Tool | Function | Limitations |
|------|----------|-------------|
| Best Practices Analyzer (BPA) | Assessment and compatibility scanning | Report-only; no automated remediation |
| Cloud Acceleration Manager (CAM) | Migration planning and guidance | Guidance-only; no code transformation |
| Content Transfer Tool (CTT) | Content migration between environments | Content only; no code migration |
| Experience Modernization Agent | Visual page-to-EDS block conversion | EDS target only; no AEMaaCS support; no code refactoring |
| AEM Modernization Tools | Dialog and template conversion | Limited scope; basic pattern matching |

**Key gap**: Adobe provides no tool that performs automated code refactoring, integration migration, or end-to-end orchestration across products.

### Competitor/Partner Landscape

#### Gradial (Startup -- $55M funded)

- **Founded**: 2023, Seattle
- **Funding**: $55M total ($13M Series A led by Madrona; $35M Series B led by VMG Partners)
- **Team**: Ex-SpaceX and Microsoft founders
- **Focus**: Agentic AI platform for end-to-end content supply chain automation
- **AEM relevance**: Automates content ops workflows on AEM including migrations, QA, compliance
- **Results**: Up to 20x efficiency gains and 99.9% accuracy in content operations
- **Platform**: Built on AWS with integrations to CMS, DAM, JIRA, Adobe Workfront
- **Threat level**: **Medium** -- focused on content operations rather than full migration; strong funding and enterprise traction

#### 3|SHARE (Adobe Platinum Partner)

- **Approach**: AI-accelerated methodology using LLMs across planning, development, and QA phases
- **AI usage**: LLMs for documentation/user stories, generative AI as pair programmer, AI-generated test scripts
- **Tools**: Leverages Adobe's official modernization tools (BPA, CTT, Unified Experience plugin, All-in-One Converter)
- **Limitation**: Uses AI as a productivity enhancer for human-led migration, not as an autonomous migration engine
- **Threat level**: **Low** -- services company using AI augmentation, not a product competitor

#### Valocity Digital

- **Approach**: AI integrated throughout every migration phase (code analysis, refactoring, testing, validation)
- **Claims**: 60% timeline reduction with improved code quality and reduced post-migration defects
- **Model**: Collaborative engagement with knowledge transfer
- **Threat level**: **Low** -- consulting firm with AI-enhanced methodology, not a product

#### Other Players

- **Cognizant**: Major consulting firm offering AEM migrations and AI-driven content management
- **Bounteous**: Advisory and implementation partner focused on Edge Delivery Services strategy
- **Net Effect**: Migration risk advisory, emphasizing operational risk patterns

### Press Coverage of AI-Powered Migration

Key media coverage themes:

- **CMSWire**: "Adobe Just Turned AEM Into an AI Co-Developer" -- covering the agentic evolution of AEM, but focused on content creation, not migration
- **Bounteous**: "Adobe's Next Chapter" -- positioned EDS and AI as the future, noted AI completing content migrations (recipe transfer) in 1-2 days vs. hundreds of hours
- **Valocity Digital**: "AI-Accelerated AEM Cloud Service Migration" -- strategic guide positioning AI as essential to migration
- **GeekWire**: Gradial $13M raise coverage -- "AI marketing tech that automates content operations"
- **CMSWire**: Gradial $35M Series B -- "Agentic Marketing Automation"

### Adobe Q1 FY2026 Financial Context

| Metric | Value |
|--------|-------|
| Total Revenue | $6.40B (up 12% YoY) |
| Non-GAAP EPS | $6.06 (up 19% YoY) |
| AEP ARR Growth | 30%+ YoY |
| AEP Agentic Adoption | ~70% of customers |
| Agentic Web Trials | 650+ active (13x growth QoQ) |
| Firefly ARR | $250M+ (first disclosure) |
| AI-first ARR | 3x+ YoY |
| Large Enterprise ($10M+) | 20%+ growth YoY |
| Operating Cash Flow | $2.96B (record) |

**CEO Transition**: Shantanu Narayen is stepping down after leading Adobe since 2007 through its cloud transformation. Succession signals will be closely watched at Summit 2026.

### Black Hole Implications

- **No direct product competitor exists** in the market for end-to-end, AI-powered, cross-product Adobe migration orchestration
- Gradial is the most well-funded potential competitor but focuses on content operations, not migration
- Services firms (3|SHARE, Valocity, Cognizant) use AI to augment human-led migration, not replace it
- Adobe's own tools cover assessment and content transfer but leave massive gaps in code transformation and cross-product orchestration
- The market is ripe for a product play -- everyone else is offering services enhanced by AI, not a platform
- Adobe's strong financials and agentic AI momentum mean they *could* build migration tools, but current strategy is clearly focused on forward-looking capabilities (orchestration, personalization, agentic web) rather than backward-looking migration

---

## 9. Competitive Implications for Black Hole

### Strategic Position Summary

Black Hole occupies a **unique and defensible position** in the Adobe ecosystem:

```
                    Migration Scope
                    (Cross-Product)
                         ^
                         |
                    BLACK HOLE
                         |
        Gradial ----+----+---- 3|SHARE/Valocity
     (content ops)  |    |    (services + AI)
                    |    |
                    +----+----> Automation Level
                    |    |      (AI-Powered)
                    |    |
         Adobe CAM -+    +- Experience Modernization Agent
       (guidance)        (EDS pages only)
```

### Opportunity Windows

| Window | Timeframe | Urgency |
|--------|-----------|---------|
| AEM Managed Services EOL | Now - August 31, 2026 | CRITICAL (5 months) |
| Adobe Campaign Standard decommission | Throughout 2026 | HIGH |
| Adobe Campaign Classic v7 EOL | By March 31, 2027 | HIGH |
| AEM 6.5 Core Support EOL | By February 2027 | HIGH |
| AEM 6.5 Extended Support EOL | By February 2028 | MEDIUM |
| Audience Manager to RTCDP migration | Ongoing, no hard deadline | MEDIUM |

### Competitive Moat Assessment

| Factor | Black Hole Advantage |
|--------|---------------------|
| Scope | Only solution covering AEM + Campaign + Analytics + CDP + Commerce + DAM |
| Automation depth | Autonomous code refactoring vs. AI-augmented human services |
| Adobe tool gaps | Fills the exact gaps Adobe leaves (code transform, integration migration, orchestration) |
| Cross-product | No competitor addresses multi-product Adobe migration |
| Market timing | 24-month peak demand window with no competing product |
| Partner program | New unified program creates clear integration path |

### Risks to Monitor

1. **Adobe builds it**: Adobe could invest in automated migration tooling, but current strategy and Summit announcements show zero movement in this direction. CEO transition may shift priorities.
2. **Gradial expands scope**: Well-funded ($55M) and could pivot from content ops to migration. Monitor their roadmap and partnership announcements.
3. **LTS adoption delays migration**: AEM 6.5 LTS gives customers a "wait" option, potentially shrinking the immediate market. However, this only delays demand -- it does not eliminate it.
4. **Edge Delivery cannibalization**: If Adobe pushes all customers to EDS (not traditional AEMaaCS), the Experience Modernization Agent partially addresses page migration. But EDS does not handle enterprise complexity (commerce, integrations, workflows).
5. **Partner consolidation**: Large SIs (Deloitte, Accenture, Cognizant) could build internal migration tooling. Their current approach is services-based, but scale could justify productization.

### Recommended Actions

1. **Pursue Adobe partner program enrollment** at Silver or Gold tier immediately -- the March 1, 2026 launch is recent, and early movers in the new program gain visibility
2. **Target AMS customers first** -- they face the August 31, 2026 deadline and cannot wait
3. **Position Black Hole as complementary to Adobe's tools** -- not competitive. Black Hole uses BPA output, integrates with CAM workflow, and could incorporate the Modernization Agent for EDS components
4. **Develop case studies around BPA remediation** -- the 400 Critical / 14,000 Major finding volume is a compelling proof point for automated remediation
5. **Build integration with Cloud Manager MCP Server** -- Adobe's new MCP endpoint enables programmatic deployment orchestration from Black Hole
6. **Track Gradial closely** -- request a product demo, monitor their Adobe partnership status, and assess whether they plan to expand into migration
7. **Leverage Gartner's Adobe cautions** -- Adobe's price/complexity concerns align perfectly with Black Hole's value proposition of reducing migration cost and complexity

---

## Sources

### Adobe Summit 2026
- [Adobe Summit 2026 Official Site](https://summit.adobe.com/na/)
- [What to Expect at Adobe Summit 2026 - Stensul](https://stensul.com/blog/what-to-expect-at-adobe-summit/)
- [Adobe Summit 2026 - Grazitti](https://www.grazitti.com/blog/adobe-summit-2026-what-to-expect-from-this-years-digital-experience-conference/)
- [Adobe Summit 2026: Orchestrating Growth with AI - EPAM](https://www.epam.com/about/who-we-are/events/2026/adobe-summit-2026-orchestrating-growth-with-ai)
- [At Adobe Summit, Has Agentic AI Made Its Debut? - The Drum](https://www.thedrum.com/news/adobe-summit-has-agentic-ai-marketers-made-its-public-debut)
- [Adobe Introduces AI Agent Orchestration - CDP Institute](https://www.cdpinstitute.org/news/adobe-introduces-ai-agent-orchestration-and-brand-concierge/)

### Experience Modernization Agent
- [Experience Modernization Agent Overview - Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/modernization/overview)
- [How the Experience Modernization Agent Migrates Sites to EDS - Adobe Developer Blog](https://blog.developer.adobe.com/en/publish/2026/03/how-the-experience-modernization-agent-migrates-sites-to-edge-delivery-services)
- [The Agentic Evolution of AEM - Adobe Developer Blog](https://blog.developer.adobe.com/en/publish/2026/02/the-agentic-evolution-of-adobe-experience-manager)
- [Experience Modernization Console - Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/modernization/console)
- [AOE Delivery Model - Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/modernization/aoe-delivery)

### Cloud Acceleration Manager
- [Cloud Manager Release Notes 2026.3.0 - Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/cloud-manager/current)
- [Cloud Acceleration Manager - Adobe](https://business.adobe.com/products/experience-manager/cloud-acceleration-manager.html)
- [Introduction to CAM - Adobe Learn](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/migration/cloud-acceleration-manager/introduction)

### Partner Program
- [A New Era for Adobe Partners - Adobe](https://partners.adobe.com/digitalexperience/news/2025/11/new-era-for-partners)
- [Adobe Digital Experience Partner Program](https://partners.adobe.com/digitalexperience/about)
- [Partner Benefits Glossary - Adobe](https://partners.adobe.com/digitalexperience/activation/guide/partner-benefits-glossary)
- [2025 Adobe Partner Award Winners - Adobe Blog](https://business.adobe.com/blog/announcing-the-2025-adobe-digital-experience-partner-award-winners)

### AEM 6.5 End of Support
- [AEM 6.5 End of Support - Oshyn](https://www.oshyn.com/blog/aem-6-5-end-of-support)
- [AEM 6.5 EOL: LTS vs Cloud - WegWorks](https://www.wegworks.com/blog/aem/aem-65-end-of-life-lts-vs-cloud/)
- [AEM 6.5 EOL Community Discussion - Adobe](https://experienceleaguecommunities.adobe.com/adobe-experience-manager-sites-8/aem-6-5-eol-upgrade-migrate-or-wait-what-s-the-smart-move-227905)
- [AEM Releases Roadmap - Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-release-information/aem-release-updates/update-releases-roadmap)

### Analyst Reports
- [2025 Gartner Magic Quadrant for DXP - Adobe](https://business.adobe.com/resources/reports/gartner-mq-digital-experience-platforms-2025.html)
- [Optimizely Dethrones Adobe - Nansen](https://www.nansen.com/news/optimizely-dethrones-adobe-as-the-1-dxp----heres-why)
- [Gartner MQ for DXP 2025 Rundown - CX Today](https://www.cxtoday.com/contact-center/gartner-magic-quadrant-for-digital-experience-platforms-2025-the-rundown/)
- [Adobe Named Leader in Forrester Wave DXP Q4 2025 - Adobe](https://business.adobe.com/resources/reports/forrester-wave-dxp-2025.html)
- [Forrester Wave DXP Q4 2025 Announcement - Forrester](https://www.forrester.com/blogs/announcing-the-forrester-wave-digital-experience-platforms-q4-2025/)
- [IDC MarketScape AI-Enabled Marketing Platforms 2025 - Adobe](https://business.adobe.com/resources/reports/idc-marketscape-worldwide-ai-enabled-marketing-platforms-2025.html)

### Customer Sentiment and Migration Pain
- [AEM Migration Risks Enterprises Miss - Net Effect](https://net-effect.com/aem-migration-risks-entreprises-miss/)
- [Legacy Adobe AEM: Migrate, Pay Up, or Move On - Real Story Group](https://www.realstorygroup.com/Blog/legacy-adobe-aem-migrate-pay-or-move)
- [AEM Cloud Migration - Adobe Community](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-manager/aem-as-a-cloud-service-migration/m-p/686998)
- [AEM Migration: Is MAJOR Category Issues Must Fix? - Adobe Community](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-manager/aem-cloud-migration-is-major-categories-issue-must-have-to-fix/m-p/730681)
- [Hidden Costs in AEM Licensing - DWAO](https://dwao.com/blog/hidden-cost-in-adobe-experience-manager-licensing)

### AI-Powered Migration
- [Gradial - Official Site](https://www.gradial.com/)
- [Gradial $35M Series B - CMSWire](https://www.cmswire.com/digital-experience/gradial-raises-35m-series-b-to-scale-agentic-marketing-automation/)
- [Gradial AWS Case Study](https://aws.amazon.com/solutions/case-studies/gradial-case-study/)
- [3|SHARE AI-Powered AEM Migration](https://blog.3sharecorp.com/the-ai-powered-path-migrating-to-aem-cloud-faster-and-smarter-with-3share)
- [Valocity Digital AI-Accelerated AEM Migration](https://www.valocitydigital.com/2026/01/21/ai-accelerated-aem-cloud-service-migration/)
- [Adobe's Next Chapter - Bounteous](https://www.bounteous.com/insights/2026/01/29/adobes-next-chapter-edge-delivery-services-ai-and-evolution-adobe-experience/)

### Adobe Financials
- [Adobe Q1 FY26 Record Results - BusinessWire](https://www.businesswire.com/news/home/20260312749997/en/Adobe-Delivers-Record-Q1-Results)
- [Adobe Q1 FY26: CEO Exit, DOJ Settlement, Agentic Growth - CMSWire](https://www.cmswire.com/digital-experience/adobe-q1-fy26-ceo-exit-doj-settlement-and-13x-agentic-web-growth/)
- [Adobe Q1 2026 Earnings Call Transcript - Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/03/12/adobe-adbe-q1-2026-earnings-call-transcript/)

### Campaign and Audience Manager Migration
- [Transition from Campaign Standard to Campaign v8 - Adobe](https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/new/acs-to-v8)
- [Evolution from Audience Manager to RTCDP - Adobe](https://experienceleague.adobe.com/en/docs/experience-platform/rtcdp/evolution/aam-to-rtcdp)
- [Adobe Audience Manager Retirement - Hightouch](https://hightouch.com/blog/adobe-audience-manager)
