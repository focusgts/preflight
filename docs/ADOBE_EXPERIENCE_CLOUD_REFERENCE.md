# Adobe Experience Cloud -- Exhaustive Product Reference

**Version**: 1.0
**Last Updated**: 2026-03-21
**Purpose**: Comprehensive reference for Black Hole ingestion engine platform tagging, ticket classification, and knowledge base generation.

---

## Table of Contents

1. [Adobe Experience Manager (AEM)](#1-adobe-experience-manager-aem)
2. [Adobe Analytics](#2-adobe-analytics)
3. [Adobe Target](#3-adobe-target)
4. [Adobe Campaign](#4-adobe-campaign)
5. [Adobe Journey Optimizer (AJO)](#5-adobe-journey-optimizer-ajo)
6. [Adobe Experience Platform (AEP)](#6-adobe-experience-platform-aep)
7. [Adobe Commerce (Magento)](#7-adobe-commerce-magento)
8. [Adobe Marketo Engage](#8-adobe-marketo-engage)
9. [Adobe Workfront](#9-adobe-workfront)
10. [GenStudio for Performance Marketing](#10-genstudio-for-performance-marketing)
11. [Adobe Mix Modeler](#11-adobe-mix-modeler)
12. [Other Products](#12-other-products)
13. [Integration Layer](#13-integration-layer)
14. [Common Infrastructure](#14-common-infrastructure)
15. [Platform Tag Reference (for Black Hole)](#15-platform-tag-reference-for-black-hole)

---

## 1. Adobe Experience Manager (AEM)

### 1.1 Overview

AEM is Adobe's enterprise content management and digital asset management platform. It combines web content management (Sites), digital asset management (Assets), forms management (Forms), and digital signage (Screens) into a unified platform.

**Current Version**: AEM as a Cloud Service (continuously updated, no version numbers); AEM 6.5 (on-premises, latest service pack 6.5.22+)
**Deployment Models**: AEM as a Cloud Service (SaaS), AEM Managed Services (hosted), AEM 6.5 On-Premises

### 1.2 AEM Sites

AEM Sites is the web content management (WCM) component.

**Core Capabilities**:
- Page authoring (Touch UI editor, Classic UI deprecated)
- Content Fragments: structured, headless content stored in the DAM; defined by Content Fragment Models (CFM); delivered via GraphQL API or Assets HTTP API; supports variations, metadata, annotations
- Experience Fragments: reusable groups of components including layout; exportable to Adobe Target as offers; support variations (web, email, social, plain text)
- Editable Templates: policy-driven page templates with locked/unlocked components
- Core Components: standardized, versioned, open-source component library (maintained on GitHub); currently 40+ components
- Style System: CSS class assignment to components without code changes
- Multi-Site Manager (MSM): live copy, blueprint, rollout configurations for multi-site governance
- Language Copy: translation integration framework supporting machine and human translation vendors
- Single Page Application (SPA) Editor: React and Angular SPA development with AEM as the CMS; RemoteSPA support for decoupled SPAs
- Headless CMS: Content Fragment delivery via GraphQL (persisted queries), JSON export via Sling Model Exporter
- Universal Editor: next-generation WYSIWYG editor supporting headless and traditional content; can edit content in any renderer (React, Angular, plain HTML); context-aware editing for Edge Delivery Services content

**Edge Delivery Services (EDS)**:
- Formerly known as Franklin/Helix
- Document-based authoring: content authored in Google Docs or Microsoft SharePoint; pushed to GitHub; rendered at the edge
- Architecture: serverless infrastructure + CDN (Fastly); content converted to semantic HTML at the origin; served via CDN with aggressive caching
- Performance: Lighthouse scores of 100 across all categories out of the box
- AEM Edge Functions: execute JavaScript at the CDN layer for low-latency dynamic experiences
- Experience Modernization Agent: AI agent that automates migration of existing AEM Sites to Edge Delivery Services (announced 2026)
- Sidekick browser extension for content preview, publish, and administration
- AEM Authoring integration: can use AEM's WYSIWYG authoring (Universal Editor) as an alternative to document-based authoring
- Blocks: modular, reusable content components built in vanilla JavaScript/CSS
- Boilerplate repository on GitHub for project scaffolding

**Licensing (Sites)**:
- Metered by Content Requests per month
- Included environments: 1 Production, 1 Stage, 1 Development, 1 Rapid Development Environment (RDE)
- Storage: 1TB (Production/Stage), 200GB (Dev/RDE)
- CDN included by default (Adobe-managed Fastly)

### 1.3 AEM Assets

AEM Assets is the digital asset management (DAM) platform.

**Core Capabilities**:
- Centralized repository for images, videos, documents, 3D assets, and more
- Metadata management: custom metadata schemas, cascading metadata, metadata profiles
- Smart Tags: AI-powered automatic tagging via Adobe Sensei
- Smart Crop: AI-driven image cropping for responsive delivery
- Asset microservices: cloud-native processing for rendition generation, image recognition, auto-tagging; runs on Adobe I/O Runtime; replaces traditional AEM workflows for asset processing
- Connected Assets: remote DAM access across AEM Sites instances without copying binaries
- Brand Portal: cloud-based SaaS portal for distributing approved assets to external parties, agencies, and partners; includes asset sourcing (contribution) from external users
- Content Hub: newer alternative to Brand Portal for internal asset distribution and self-service (available with AEM Assets Prime/Ultimate)
- Asset Share Commons: open-source, customizable asset sharing solution
- Asset Compute Workers: custom asset processing via Adobe I/O Runtime; extensible microservice framework for custom renditions
- Adobe Express integration: in-context editing of assets using Adobe Express
- AEM Content Credentials: provenance tracking for assets using Content Authenticity Initiative (CAI) standards

**Dynamic Media**:
- Cloud-based image and video serving with URL-based transformations
- Dynamic Media with OpenAPI: modern API-first approach; delivery via CDN with delivery URLs; changes to DAM assets automatically reflected in URLs; no binary copy required
- Image presets, viewer presets, image sets, spin sets, mixed media sets, carousel banners
- Smart Imaging: automatic format negotiation (WebP, AVIF), quality optimization, device-aware resizing
- Interactive Video: clickable hotspots overlaid on video content
- 3D asset support: viewer for glTF, GLB, OBJ, STL formats
- Scene7 legacy infrastructure being migrated to Dynamic Media with OpenAPI

**Licensing (Assets)**:
- **AEM Assets Ultimate**: up to 15 Power Users, 15 Collaborator Users, 250 Limited Users; 5TB storage
- **AEM Assets Prime**: up to 5 Power Users, 5 Collaborator Users, 50 Limited Users; 2TB storage (max 30TB total)
- **AEM Assets Enterprise**: renewal-only legacy tier; Standard and Light Users
- As of December 1, 2024, new customers may only license Ultimate or Prime
- Dynamic Media packaged separately: Dynamic Media Prime and Dynamic Media Ultimate (as of March 6, 2025)

### 1.4 AEM Forms

AEM Forms handles form creation, data capture, and document generation.

**Core Capabilities**:
- Adaptive Forms: responsive, dynamic forms with rules engine, pre-fill services, schema binding (JSON, XSD, Form Data Model), lazy loading, repeatable panels
- Headless Adaptive Forms: forms delivered as JSON structure; rendered by any frontend (React, Angular, iOS, Android, chatbots); form logic (validation, state management, business rules) handled by Forms Web SDK; author once, render anywhere
- Edge Delivery Services Forms: Adaptive Forms Block for EDS; convert legacy PDF forms to adaptive forms
- Document Services: PDF generation (PDF/A compliance), assembly, encryption, digital signatures, barcoded forms, output service
- Communications APIs: cloud-native APIs for document generation (batch and on-demand); accessible via Adobe Developer Console and AEM Developer Console; support for XDP templates, PDF manipulation, and document security
- Document of Record (DoR): auto-generated PDF record of submitted form data
- Form Data Model (FDM): integration layer connecting forms to REST services, SOAP services, OData, and RDBMS
- AEM Forms Automated Conversion Service: AI-powered conversion of legacy PDF forms to adaptive forms
- E-signatures: integrations with Adobe Acrobat Sign, Scribble signature

**Licensing (Forms)**:
- Two base packages: Submissions (per year) and Renditions (per year)
- Submissions: up to 20 concurrent users (under 750K/year) or 40 concurrent users (750K+)
- Renditions: up to 20 concurrent users (under 10M/year) or 40 concurrent users (10M+)
- Storage: 1TB (Production/Stage), 200GB (Dev)

### 1.5 AEM Screens

AEM Screens extends AEM for digital signage and in-venue experiences.

**Core Capabilities**:
- Omnichannel content delivery to digital displays
- Sequence channels, split-screen channels, embedded channels
- Device management and remote monitoring
- Scheduling and dayparting
- Location-aware content
- Offline capability with content caching on player devices
- Players available for Chrome OS, Android, Windows, Tizen (Samsung)
- Integration with AEM Sites for content reuse

### 1.6 AEM Deployment Models Compared

| Aspect | AEM as a Cloud Service | AEM Managed Services | AEM 6.5 On-Premises |
|--------|----------------------|---------------------|-------------------|
| Hosting | Adobe-managed cloud (Azure) | Adobe-managed hosting | Customer-managed |
| Updates | Continuous, automatic | Customer-controlled SP/CFP | Customer-controlled |
| Scaling | Auto-scaling | Fixed infrastructure | Customer-managed |
| Repository | Immutable /apps, /libs; mutable /content | Full JCR access | Full JCR access |
| Custom code | OSGi bundles via Cloud Manager only | OSGi bundles, custom deploy | Any deployment method |
| Dispatcher | Managed, config via Git | Customer-managed with Adobe | Customer-managed |
| CDN | Included (Fastly) | Optional | Customer-managed |
| Cost model | Subscription + usage | Subscription | License + maintenance |

### 1.7 Cloud Manager

Cloud Manager is the CI/CD and environment management platform for AEM as a Cloud Service and AEM Managed Services.

**Capabilities**:
- CI/CD pipelines: full-stack pipelines, front-end pipelines, config pipelines, web-tier pipelines
- Code quality gates: SonarQube-based static analysis, custom quality rules
- Environment management: create/delete dev, stage, prod environments
- Rapid Development Environments (RDE): lightweight cloud environments for instant deployment (minutes vs hours); deploy via `aio` CLI; reset between sessions; set to latest AEM version automatically
- Content Transfer Tool: migrate content from AEM 6.x to AEM as a Cloud Service
- Best Practices Analyzer (BPA): assess AEM 6.x instance readiness for cloud migration
- Repository Modernizer: restructure 6.x content packages to Cloud Service-compatible format
- Dispatcher Converter: convert legacy dispatcher configs to cloud-compatible configs
- Pipeline variables and environment-specific configs
- Activity logs and audit trails

### 1.8 AEM Architecture Deep Dive

**Technology Stack**:
- **OSGi (Apache Felix)**: modular Java container; bundles for encapsulation; declarative services (DS) for component lifecycle; configurations via ConfigAdmin
- **Apache Sling**: REST-based web framework; resource resolution maps URLs to JCR nodes; scripts/servlets selected by resource type, selectors, and extension; Sling Models for strongly-typed Java POJOs bound to resources
- **JCR (Apache Jackrabbit Oak)**: hierarchical content repository; Oak for scalable persistence; Segment Tar (TarMK) for standalone; Mongo (DocumentNodeStore) for cluster; node types (nt:unstructured, cq:Page, dam:Asset, etc.)
- **Apache HTL (Sightly)**: secure, context-aware HTML templating language replacing JSP
- **Granite/Coral UI**: UI framework for Touch UI; Coral Spectrum web components

**Cloud Service Architecture**:
- Immutable code layer: /apps, /libs deployed via Cloud Manager from Git; cannot be changed at runtime
- Mutable content layer: /content, /conf, /var, /etc, /oak:index, /system, /tmp; content can be modified at runtime
- Author tier: auto-scaled based on load; stateless with shared persistence
- Publish tier: auto-scaled with CDN; Sling Content Distribution for replication
- Dispatcher: Apache HTTP server with mod_dispatcher; managed config deployed via Git; Fastly CDN in front
- Preview tier: optional, for previewing content before publish
- Golden Master: all environments created from the same base image; updates rolled out by Adobe

**Content Transfer Tool (CTT)**: extracts content from source AEM (6.3+) and ingests into Cloud Service; handles large repositories in batches; top-up/differential migration supported

### 1.9 Common Pain Points

- Cloud Service migration: custom OSGi bundles may need refactoring; workflow models need conversion; custom login pages not supported; mutable vs immutable content separation requires restructuring
- Edge Delivery Services adoption: paradigm shift from component-based to document-based authoring; limited support for complex interactive components; developer skillset shift from Java/OSGi to JavaScript/CSS
- Dispatcher configuration: strict validation in Cloud Service; rules that worked on-prem may fail cloud validation
- Performance: large DAMs (500K+ assets) can have slow search/browse; custom indexes needed for query performance
- Upgrades: AEM 6.5 customers on old service packs face cumulative upgrade complexity
- Cost: high entry price point; usage-based metering can lead to unpredictable costs

---

## 2. Adobe Analytics

### 2.1 Overview

Adobe Analytics is a web and digital analytics platform for measuring, analyzing, and optimizing digital experiences across channels.

**Current Version**: Continuously updated SaaS platform
**Deployment Model**: Cloud only (SaaS)
**Successor/Evolution**: Customer Journey Analytics (CJA) is the next-generation platform built on AEP

### 2.2 Core Components

**Analysis Workspace**:
- Drag-and-drop analysis interface
- Freeform tables, cohort analysis, flow analysis, fallout analysis, Venn diagrams
- Segment comparison, contribution analysis (algorithmic anomaly attribution)
- Calculated metrics with statistical functions
- Scheduled projects and PDF/CSV exports
- Curated projects for stakeholder sharing
- Anomaly detection and intelligent alerts

**Report Builder**:
- Excel add-in for pulling Analytics data into spreadsheets
- Scheduled report delivery
- Parameterized date ranges and segments
- Up to 10 concurrent scheduled reports per login ID

**Activity Map**:
- Visual overlay of click data on live web pages
- Link tracking and page analytics
- Heatmap and bubble visualizations
- Browser extension

### 2.3 Data Pipeline

**Processing Order**:
1. Data Collection (AppMeasurement/Web SDK) sends data to Adobe Edge/Collection servers
2. VISTA rules (custom server-side processing, configured by Adobe consultants)
3. Processing Rules (customer-configurable data transformations)
4. Marketing Channel processing rules
5. Data written to reporting (report suites)

**Key Data Concepts**:
- **Report Suites**: containers for data; global vs rollup vs virtual
- **eVars**: conversion variables with configurable expiration and allocation; up to 250 per report suite (Ultimate)
- **Props**: traffic variables for pathing analysis; up to 75 per report suite
- **Events**: custom success events (counters, currency, numeric); up to 1,000 per report suite
- **Classifications**: lookup tables for enriching variable values with metadata; SAINT classifications, classification rule builder, classification sets
- **Segments**: filters for isolating subsets of data; hit/visit/visitor scope; sequential segments; stacking
- **Virtual Report Suites (VRS)**: non-destructive views of a parent report suite with curated components and time zones

**Data Feeds**: raw, hit-level data export in delimited flat files; hourly or daily delivery to FTP/SFTP/S3/Azure Blob
**Data Warehouse**: ad-hoc SQL-like queries against the full data set; scheduled or on-demand delivery; supports very large data requests
**Data Repair API**: programmatic deletion/modification of collected data; up to 1.2 billion rows scanned per year (Ultimate)

### 2.4 Implementation Methods

| Method | Description | Status |
|--------|-------------|--------|
| **Web SDK (alloy.js)** | Unified JavaScript library sending data to AEP Edge Network; supports Analytics, Target, Audience Manager simultaneously | Recommended for new implementations |
| **AppMeasurement (s.js)** | Legacy Analytics-specific JavaScript library; sends data directly to Adobe collection servers | Maintenance mode; migration to Web SDK recommended |
| **Tags (Adobe Experience Platform Data Collection)** | Tag management system (formerly Adobe Launch); extensions for Analytics, Web SDK, and third parties; rules engine; data elements; publishing workflow with environments | Recommended deployment vehicle for both Web SDK and AppMeasurement |
| **Mobile SDK (AEP SDK)** | Native iOS (Swift) and Android (Kotlin) SDKs; Edge Network integration; lifecycle metrics; deep link tracking | Current mobile standard |
| **Server-Side (Bulk Data Insertion API)** | REST API for server-side data collection | For IoT, offline, server-side use cases |

**Web SDK Implementation Notes**:
- XDM fields auto-map to Analytics variables
- Data object can set Analytics variables directly (recommended approach)
- Processing rules can map XDM fields to Analytics (no longer recommended)
- Datastream configuration routes data to Analytics report suite

### 2.5 Customer Journey Analytics (CJA)

CJA is the next-generation analytics platform built on top of Adobe Experience Platform.

**Key Differences from Adobe Analytics**:

| Aspect | Adobe Analytics | Customer Journey Analytics |
|--------|----------------|--------------------------|
| Data Source | Direct collection (tags/SDK) | AEP datasets (any source) |
| Data Model | eVars, props, events | Flexible XDM schemas; unlimited custom dimensions/metrics |
| Processing | Collection-time (pre-computed) | Report-time (on-the-fly) |
| Cross-Channel | Web/mobile focused | Any channel (web, mobile, call center, POS, IoT, CRM) |
| Identity | Cookie-based (ECID) | Cross-device stitching (field-based, graph-based) |
| Data Scope | Digital interactions only | Digital + offline + any structured data |
| Segments | Hit/visit/visitor | Filters with flexible containers |
| Calculated Metrics | Standard functions | Derived Fields (on-the-fly transformations) |
| Data Governance | Limited | Full AEP data governance (DULE labels) |

**CJA Unique Features**:
- Connections: link to AEP datasets (event, profile, lookup)
- Data Views: virtual layer over connections; define dimensions, metrics, attribution, format, persistence; up to 1,000 data views (Ultimate)
- Cross-channel identity stitching: field-based (uses known identifiers) and graph-based (uses AEP Identity Service graph); backfill up to 25 months (Ultimate)
- Guided Analysis: product analytics workflows (trends, funnel, retention, impact, frequency, user growth)
- Content Analytics: AI-powered analysis of content performance with automatic asset feature extraction
- Audiences: publish CJA segments to AEP Real-Time Customer Profile for activation; up to 150 refreshing audiences (Ultimate)
- Full Table Export: export large analysis results; up to 300M rows (Ultimate)
- BI Extension: connect BI tools (Tableau, Power BI, Looker) directly to CJA data views via SQL
- AI Assistant: natural language querying and anomaly investigation

**Analytics Source Connector**: streams Adobe Analytics report suite data into AEP datasets; maps Analytics variables to XDM; enables CJA analysis of historical Analytics data without re-implementation; latency of ~30 minutes for streaming

**Licensing (CJA)**:
- Tiers: Foundation, Select, Prime, Ultimate
- Licensed by: Per Million Rows of Data
- Data retention: 13 months (timestamp-based)
- Sandboxes: 5 included
- Annual ingestion: up to 3x licensed volume
- See detailed tier comparison in Section 2.5 above

### 2.6 Common Pain Points

- CJA migration: re-learning Analysis Workspace concepts; loss of some legacy features (Activity Map, real-time reporting); identity stitching complexity; data latency differences
- Implementation drift: discrepancies between tag management configs across environments
- VISTA rule opacity: managed by Adobe, difficult for customers to audit or change quickly
- Marketing channel attribution: complex rule ordering; first-touch vs last-touch confusion
- Report suite architecture: global vs rollup decisions affect data quality and flexibility
- Data Feeds: schema changes between processing rule updates can break downstream ETL

---

## 3. Adobe Target

### 3.1 Overview

Adobe Target is a personalization and testing platform for optimizing digital experiences through A/B testing, multivariate testing, and AI-driven personalization.

**Current Version**: Continuously updated SaaS
**Deployment Model**: Cloud only (SaaS)
**Licensing**: Target Standard (basic testing) and Target Premium (includes AP, Auto-Target, Recommendations, Enterprise Permissions)

### 3.2 Activity Types

| Activity Type | Description | License |
|---------------|-------------|---------|
| **A/B Test** | Compare two or more experiences against a control | Standard |
| **Auto-Allocate** | A/B test that automatically shifts traffic to the winning experience | Standard |
| **Auto-Target** | ML-driven A/B testing that selects the best experience per visitor; uses Random Forest algorithm | Premium |
| **Experience Targeting (XT)** | Rules-based targeting of specific experiences to defined audiences | Standard |
| **Multivariate Test (MVT)** | Test multiple element variations simultaneously; full/partial factorial designs | Standard |
| **Automated Personalization (AP)** | ML-driven matching of offer combinations to individual visitors; uses Random Forest; tests all permutations simultaneously | Premium |
| **Recommendations** | ML-driven product/content recommendations based on user behavior; criteria (viewed/purchased/popularity), algorithms (collaborative filtering, item-based, content-based), design templates, exclusions, inclusions; can be embedded within A/B, XT, and AP activities | Premium |

### 3.3 Delivery Methods

| Method | Description | Latency | Use Cases |
|--------|-------------|---------|-----------|
| **Client-side (at.js)** | JavaScript library on the page; async or sync loading; flicker management via pre-hiding | 200-500ms | Standard web personalization |
| **Server-side SDKs** | Node.js, Java, .NET, Python SDKs; API call from application server to Target Edge | Variable (network) | SSR apps, IoT, email, kiosks |
| **On-device decisioning** | Rules artifact cached locally on server/edge; no network call to Target; artifact synced periodically | <10ms | Performance-critical experiences; supported activity types: A/B, XT, AP with specific feature constraints |
| **Web SDK (alloy.js)** | Unified SDK; Target decisions fetched via AEP Edge Network sendEvent; supports visual and form-based experiences | 200-500ms | Unified implementation with Analytics, RTCDP |
| **Mobile SDK (AEP)** | Native SDKs for iOS/Android; prefetch and execute APIs; in-app messaging | Variable | Mobile app personalization |

### 3.4 Analytics for Target (A4T)

A4T uses Adobe Analytics as the reporting source for Target activities.

- Eliminates need for Target's own reporting
- Leverages Analytics calculated metrics, segments, and Analysis Workspace
- Automatic data stitching via Supplemental Data ID (SDID)
- Supported for client-side, server-side (developer must forward analytics payload via Data Insertion API), and on-device decisioning (automatic analytics payload forwarding only)
- Web SDK implementation: analytics tokens returned in Target response; sent to Analytics via same Edge Network call
- A4T supports A/B, Auto-Allocate, Auto-Target, and XT activities
- Not supported for MVT with Analytics as reporting source in some configurations

### 3.5 Target + AEP/RTCDP Integration

- RTCDP audiences can be used as Target activity audiences
- Edge segmentation enables real-time audience qualification for Target
- Shared profile attributes from AEP Unified Profile available in Target
- Same-page and next-page personalization using Edge profile data

### 3.6 Common Pain Points

- Flicker: pre-hiding snippet needed for client-side delivery; impacts perceived performance
- On-device decisioning limitations: subset of activity types; artifact size limits; no Recommendations support
- A4T data discrepancies: timing differences between Target and Analytics hits; supplemental data ID mismatches
- Audience sharing latency: RTCDP audience changes take time to propagate to Target Edge
- Implementation complexity: multiple delivery methods create inconsistency across channels
- QA mode: activities in QA may behave differently than production due to caching

---

## 4. Adobe Campaign

### 4.1 Overview

Adobe Campaign is a cross-channel marketing automation platform for email, SMS, push, direct mail, and more. It focuses on campaign orchestration, transactional messaging, and data management.

### 4.2 Product Variants

| Variant | Status | Architecture | Database |
|---------|--------|-------------|----------|
| **Campaign Classic v7** | Maintenance mode | On-premise or hosted; monolithic | PostgreSQL, Oracle, MSSQL |
| **Campaign Standard** | End of life (migrating to v8) | Cloud-hosted; REST API-first | Azure-hosted PostgreSQL |
| **Campaign v8** | Current/Active | Hybrid: local + cloud | Local PostgreSQL + Snowflake cloud (FFDA) |

### 4.3 Campaign v8 Architecture

**Two Deployment Models**:

1. **FDA (Federated Data Access)** - P1-P3 packages:
   - Campaign connects to Snowflake via Federated Data Access
   - External data queried without importing into Campaign database
   - Suitable for moderate-scale deployments

2. **FFDA (Full Federated Data Access / Enterprise)** - P4 package:
   - Dual database architecture: local Campaign DB for real-time messaging/UI + cloud Snowflake DB for campaign execution, batch queries, and workflow execution
   - Near-unlimited scale for profiles and message volumes
   - Technical workflows replicate delivery data between local and cloud databases
   - 2025 improvements: strengthened FFDA mechanisms for key management, staging, and data replication

**Core Components**:
- **Workflow Engine**: visual drag-and-drop workflow canvas; targeting activities (query, enrichment, split, deduplication, intersection, union); flow control activities (fork, wait, scheduler, test, jump); action activities (delivery, script, external signal, approval)
- **Message Center**: transactional messaging engine for event-triggered real-time messages; REST API-based event submission; email, SMS, push notification support; separate execution instances for isolation and scaling
- **Interaction Module**: inbound/outbound real-time offer engine (being replaced by AJO Decision Management)
- **MRM (Marketing Resource Management)**: budgets, campaign plans, task management
- **Distributed Marketing**: central/local marketing model for franchise or multi-brand organizations
- **Web applications**: landing pages and survey forms (being replaced by AJO landing pages)

**2025 Release Highlights**:
- Event-based Transactional APIs now available for emails
- External delivery channel for integration with third-party messaging systems
- Multilingual delivery creation for Campaign Standard migrators (requires v8.7.4+)
- New Campaign Web UI with modernized interface matching Campaign Standard UX

### 4.4 Campaign Standard to v8 Migration

- Adobe is actively migrating all Campaign Standard customers to Campaign v8
- Migration supervised by Adobe Campaign Managed Cloud Services (ACMCS) team
- Each customer assigned a Transition Manager
- Key Campaign Standard features preserved in v8: Dynamic Reporting, centralized branding, REST APIs
- Campaign v8 Web UI replicates Campaign Standard user experience
- Some capabilities restricted to migrating customers only (require v8.7.4+ server)

**Migration Challenges**:
- Workflow logic differences between Standard and Classic/v8 workflow engines
- Custom REST API integrations need endpoint updates
- Data model differences (Standard's flat model vs v8's relational model)
- Reporting: Dynamic Reporting in v8 replaces Standard's reporting but has different capabilities
- Deliverability: IP warmup may be required when moving to new infrastructure

### 4.5 Email Deliverability Features

- Dedicated IPs and IP warmup plans
- Email rendering previews via Litmus integration
- Seed lists and control groups
- Fatigue rules: pressure management to limit message frequency per contact
- Quarantine management: automatic bounce processing (hard/soft)
- Enhanced MTA (Message Transfer Agent) for high-throughput sending
- DKIM, SPF, DMARC support

### 4.6 Campaign + AEP Integration

- Campaign v8 as a destination in AEP for audience activation
- AEP audiences can be used as targets in Campaign workflows
- Bi-directional data sync for profile enrichment
- Campaign events and tracking data can flow into AEP via source connectors

### 4.7 Licensing

- Managed Cloud Services subscription model
- Tiered by package level (P1-P4)
- Metered by: active profiles, message volumes, channels
- FFDA (P4) required for enterprise-scale deployments

### 4.8 Common Pain Points

- v8 migration complexity from Classic v7: schema migration, workflow conversion, custom code refactoring
- Campaign Standard migration: timeline pressure; feature parity gaps during transition
- Snowflake query performance: large queries can time out; requires understanding of FDA/FFDA query optimization
- Deliverability: warming new IPs takes 4-8 weeks; reputation management across shared vs dedicated IPs
- Workflow debugging: error handling in complex workflows can be opaque; limited logging in some activities
- Web UI vs console: not all console features available in Web UI yet; power users still need console access

---

## 5. Adobe Journey Optimizer (AJO)

### 5.1 Overview

AJO is Adobe's real-time journey orchestration and customer engagement platform, built natively on Adobe Experience Platform. It handles both marketing campaigns (batch) and triggered journeys (real-time, event-driven).

**Current Version**: Continuously updated SaaS (built on AEP)
**Deployment Model**: Cloud only (SaaS), runs on AEP infrastructure

### 5.2 Core Capabilities

**Journey Canvas**:
- Visual journey designer with drag-and-drop activities
- Event triggers: unitary events (individual actions), business events (batch triggers), audience qualification (segment entry/exit)
- Activities: conditions (decision splits), wait nodes, actions (channel delivery), custom action (API call to external service), audience read, audience qualification
- Journey versioning and live/draft management
- Pause and resume journeys (including bulk operations) without disrupting customer experience
- Concurrent journey execution per profile limits (configurable)
- Journey timeout and re-entry policies

**Campaign Management**:
- Scheduled campaigns for batch audience messaging
- API-triggered campaigns for integration-driven messaging
- Campaign experiments (content experiments with statistical significance measurement)

**Channels**:

| Channel | Description |
|---------|-------------|
| **Email** | Full HTML email with visual designer, code editor, AI content generation; AMP support |
| **Push Notifications** | iOS (APNs) and Android (FCM); rich push with images, deep links; now personalized with Decisioning |
| **SMS** | Outbound via configured providers; SMS webhooks for inbound and delivery receipts; provider-agnostic |
| **In-App Messaging** | Triggered in-app messages for mobile apps via AEP Mobile SDK |
| **Web** | In-browser personalization via Web SDK; full-page or element-level targeting |
| **Code-Based Experiences** | API-driven personalization for any surface (kiosks, IoT, custom apps); developer renders the content |
| **Content Cards** | Persistent, dismissible cards in mobile/web experiences; non-intrusive content delivery |
| **Direct Mail** | File extraction for offline direct mail fulfillment; batch and 1:1 journey support; time-based frequency settings |

**Legacy channel activities (separate Email, Push, SMS nodes) are deprecated in favor of a unified Action activity that consolidates all channel delivery into a single node.**

### 5.3 Decision Management (formerly Offer Decisioning)

- Centralized offer library with eligibility rules, priority, and capping
- Decision policies: ranking by priority scores, AI-driven formulas, or AI models
- Available across all channels: email, push, SMS, code-based, content cards
- Dataset lookup for decisions across all channels
- Offer representations: HTML, JSON, image URL, text
- Placement types define where offers appear
- Collection qualifiers (formerly tags) for offer organization
- Frequency capping: per profile, global, per placement
- Start/end date scheduling for offers

### 5.4 Content and Personalization

- AI Assistant Content Accelerator: generate email copy, subject lines, push text, SMS content
- Content templates: reusable email, SMS, push templates
- Fragments: reusable content blocks (visual and expression); live-update when fragment changes
- Themes: brand-consistent styling applied automatically to generated HTML, including AI-generated content from images
- Personalization engine: profile attributes, contextual attributes, offer attributes, helper functions (date, string, math, conditions)
- Dynamic content: variant blocks within a single message based on conditions
- Content experiments: A/B and multivariate testing within campaigns and journeys; statistical significance tracking

### 5.5 AJO B2B Edition

- Purpose-built for B2B marketing
- Buying group management: define buying group roles per solution interest
- Account journeys: orchestrate journeys at the account level (not just individual level)
- Account audiences and account profiles
- Integrates with Marketo Engage for lead-level engagement
- Account-level AI scoring and intent data

### 5.6 Licensing

**Three tiers**: Select, Prime, Ultimate

| Feature | Select | Prime | Ultimate |
|---------|--------|-------|----------|
| Batch orchestration | Yes | Yes | Yes |
| Real-time journey orchestration | No | Yes | Yes |
| Inbound channels (web, in-app) | No | Yes | Yes |
| Streaming segmentation | No | Yes | Yes |
| Offer Decisioning | No | No | Yes |
| Sandboxes | 5 | 5 | 5 |
| AEM Assets Essentials | 5 users | 5 users | 5 users |

- Licensed per 1,000 Engageable Profiles
- Average 60 messages per contracted Engageable Profile per year
- Peak volume: up to 60M messages/hour (without offers); 30M with offers
- Streaming segmentation: up to 1,500 inbound events per second (Prime/Ultimate)
- Computed Attributes: 25/sandbox (Select/Prime), 50/sandbox (Ultimate)

### 5.7 Common Pain Points

- Journey complexity limits: maximum journey activities, concurrent journeys per profile
- Event processing latency: not truly sub-second for all event types; depends on segmentation evaluation method
- Offer Decisioning performance: complex eligibility rules can slow response times at scale
- Channel limitation: no native voice channel; limited offline channel support beyond direct mail file extraction
- Content experiment duration: statistical significance requires sufficient traffic; small audiences need long test windows
- B2B Edition maturity: newer product; feature parity with Marketo Engage still evolving

---

## 6. Adobe Experience Platform (AEP)

### 6.1 Overview

AEP is Adobe's foundational data platform that unifies customer data from all sources into real-time customer profiles. It powers CJA, AJO, RTCDP, and other applications.

**Current Version**: Continuously updated SaaS
**Deployment Model**: Cloud only (SaaS), runs on Azure and AWS

### 6.2 Core Services

#### 6.2.1 XDM (Experience Data Model)

- Open-source data schema specification
- Schema classes: XDM Individual Profile, XDM ExperienceEvent, XDM Business Account, XDM Business Opportunity, custom classes
- Field groups: standard (Adobe-defined) and custom; reusable across schemas
- Data types: complex reusable field structures
- Schema composition: class + field groups + behaviors (union, identity, time-series)
- Schema Registry API: RESTful management of schemas
- Schema evolution: additive changes allowed after dataset association; breaking changes restricted (cannot rename/delete fields, change types, or modify identity descriptors once a dataset exists)
- Enhanced search, filtering, inline actions, user-defined tags and folders for schema management (2025 update)

#### 6.2.2 Datasets and Data Ingestion

**Batch Ingestion**:
- Upload files (CSV, Parquet, JSON) via UI or API
- Source connectors pull data on schedule
- S3, Azure Blob, GCS as staging areas
- Validation against XDM schema on ingest
- Partial ingestion: configurable error thresholds

**Streaming Ingestion**:
- HTTP API for real-time event streaming
- Web SDK, Mobile SDK, Server API as data sources
- Edge Network routes events to AEP in real-time
- Profile updates within seconds of event receipt

**Data Prep**:
- Field mapping with transformation functions
- Calculated fields during ingestion
- Data format conversion
- No-code mapping UI or API-based mapping sets

#### 6.2.3 Identity Service

- Resolves individual identities across devices, channels, and systems
- Identity namespaces: standard (ECID, AAID, Email, Phone) and custom
- Identity graphs: link multiple identifiers to a single person
- Deterministic linking: exact-match identifiers (email, CRM ID, loyalty ID)
- Probabilistic linking: statistical matching (deprecated for some use cases)
- Graph simulation tool for testing identity resolution rules
- Identity optimization algorithms to prevent graph collapse (overly large graphs from shared devices)
- B2B identity resolution: enhanced data quality and reduced duplication (2025 update)

#### 6.2.4 Real-Time Customer Profile

- Unified 360-degree view of each customer
- Merges identity-resolved data from all datasets
- Profile attributes (from Profile-class datasets) + events (from ExperienceEvent-class datasets) + computed attributes
- Merge policies: determine which data wins during merge conflicts; timestamp-ordered or dataset priority
- Profile richness limit: 75KB per Person Profile (RTCDP)
- Edge profiles: lightweight profile copies cached at Edge Network locations for sub-millisecond access; used by Target, AJO, and Web SDK for real-time personalization
- Profile API: lookup individual profiles by identity; up to 5 API calls per profile per year (RTCDP Ultimate)
- Entity API: access profile and related entities
- Computed Attributes: pre-calculated, periodically refreshed aggregate values (e.g., total purchases last 30 days); available in segments and personalization

#### 6.2.5 Segmentation Service

**Evaluation Methods**:
- **Batch segmentation**: scheduled daily evaluation; processes entire audience
- **Streaming segmentation**: real-time evaluation as events arrive; up to 1,500 inbound events/second; limited to specific rule types (simple event-based, profile attribute-based)
- **Edge segmentation**: evaluates on the Edge Network for immediate decisions; strictest rule type limits; used for same-page/next-page personalization

**Segment Builder**:
- Visual rule builder with drag-and-drop
- Profile attributes, events, existing audiences as building blocks
- Sequential event matching (A then B within time window)
- Frequency and recency conditions
- Computed attributes in segment definitions
- Account-level segmentation (B2B)

**Federated Audience Composition**:
- Build audiences using data in external data warehouses (Snowflake, BigQuery, Redshift, Databricks, Azure Synapse) without copying data into AEP
- Zero-copy architecture: queries execute in the customer's warehouse
- Compose audiences using visual canvas
- Enrich AEP audiences with warehouse attributes
- Publish federated audiences to AEP for activation

#### 6.2.6 Query Service

- SQL-based ad-hoc analysis of AEP data lake
- PostgreSQL-compatible syntax; connects via standard PostgreSQL clients
- Scheduled queries for ETL-like workloads
- Parameterized queries
- CTAS (Create Table As Select) for derived datasets
- Data Distiller: advanced SQL data processing, machine learning model training within Query Service; available as add-on
- Query accelerated store: pre-computed aggregate tables for dashboard performance

#### 6.2.7 AI/ML Services

- **Customer AI**: propensity scoring (churn, conversion, etc.); generates per-profile scores with explanatory factors
- **Attribution AI**: multi-touch attribution modeling; configurable attribution windows and models (first-touch, last-touch, linear, U-shaped, time-decay, custom algorithmic)
- **AI Assistant**: natural language interface for querying AEP concepts, troubleshooting, and data exploration; powered by Sensei GenAI; supports product knowledge questions, operational insights, and data queries
- **Agent Orchestrator**: agentic AI layer; orchestrates purpose-built agents (Audience Agent, Workflow Optimization Agent, Product Support Agent, etc.); reasoning engine interprets natural language and activates relevant agents; Agent SDK and Agent Registry for custom agent development; 10+ purpose-built agents at GA (September 2025); Agent Composer for multi-agent collaboration using Agent2Agent protocol; Brand Concierge application for consumer-facing AI agents

#### 6.2.8 Data Governance

- **DULE (Data Usage Labeling and Enforcement)**: label datasets and fields with usage restrictions (C1-C12 contract labels, I1-I2 identity labels, S1-S2 sensitive labels)
- **Policies**: marketing use case-based policies; prevent activation of labeled data to incompatible destinations
- **Consent framework**: Adobe standard or IAB TCF 2.0 consent schemas; consent enforcement across all AEP applications
- **Data hygiene**: record delete requests, dataset expiration, advanced data lifecycle management
- **Audit logs**: track all data and configuration changes; who did what, when

### 6.3 Data Collection

**Tags (formerly Adobe Launch)**:
- Web-based tag management system
- Extensions: 500+ extensions (Adobe and third-party); Analytics, Target, Web SDK, third-party pixels
- Rules engine: event-condition-action model
- Data elements: reusable data references (DOM, cookie, JavaScript variable, XDM object)
- Publishing workflow: dev -> stage -> prod environments with libraries and builds
- Self-hosted or Adobe-hosted runtime

**Event Forwarding (Server-Side)**:
- Server-side rule processing on Adobe Edge Network
- Replaces client-side vendor tags with server-side API calls
- Reduces page weight, improves Core Web Vitals
- Supports Google, Meta, Snap, TikTok, Braze, and many other third-party integrations
- Uses same rule/data element model as Tags

**Web SDK (alloy.js)**:
- Single JavaScript library replacing AppMeasurement, at.js, Audience Manager DIL, ECID service
- Sends data via XDM to AEP Edge Network
- Edge Network routes to Analytics, Target, Audience Manager, AEP simultaneously
- Consent management built-in (Adobe standard and IAB TCF 2.0)
- Streaming Media Collection extension

**Mobile SDK (AEP SDK)**:
- Native iOS (Swift) and Android (Kotlin) SDKs
- Extensions: Core, Identity, Lifecycle, Signal, Edge Network, Analytics, Target, Assurance, Places, Campaign, Messaging
- Adobe Assurance (formerly Griffon): real-time debugging and validation tool for mobile SDK implementations

**Server API**:
- RESTful API for server-to-server data collection to Edge Network
- Same Edge Network routing as Web SDK
- Used for IoT, backend services, batch event submission

### 6.4 Sources (Connectors)

200+ source connectors organized by category:

| Category | Examples |
|----------|---------|
| Adobe Applications | Analytics, Audience Manager, Campaign, Marketo Engage, Commerce |
| Cloud Storage | S3, Azure Blob, Azure Data Lake, Google Cloud Storage, SFTP |
| Databases | Azure Synapse, BigQuery, Databricks (with Unity Catalog), Google PubSub, PostgreSQL, Snowflake, SQL Server, MySQL |
| CRM | Salesforce, Microsoft Dynamics, HubSpot, ServiceNow, SugarCRM, Zoho |
| Marketing Automation | Mailchimp, Oracle Eloqua, Oracle Responsys, Salesforce Marketing Cloud |
| Advertising | Google Ads (v21, GA), Meta Ads, Pinterest Ads |
| E-Commerce | Shopify, SAP Commerce |
| Consent & Privacy | OneTrust |
| Customer Success | Gainsight |
| Streaming | HTTP API, Kafka, Kinesis |
| Data Partners | Acxiom, Merkle |

### 6.5 Destinations

Destinations for audience activation and data export:

| Category | Examples |
|----------|---------|
| Adobe | Target, Advertising DSP, Campaign, Commerce, Marketo Engage |
| Advertising | Google Ads, Google DV360, Meta, The Trade Desk, Amazon Ads, Snap, TikTok, Pinterest, LinkedIn |
| Cloud Storage | S3, Azure Blob, Data Landing Zone, Google Cloud Storage, SFTP |
| Data Warehouses | Snowflake (batch, GA 2026), Databricks |
| Email Marketing | Salesforce Marketing Cloud, Mailchimp, Oracle Responsys, Braze, Iterable |
| CRM | Salesforce, Microsoft Dynamics, HubSpot |
| Personalization | Target, Custom Personalization (same-page/next-page) |
| Survey | Qualtrics |
| Customer Engagement | Braze, Airship, Intercom |

**Destination Types**:
- Connection destinations: API-based profile/audience export
- Dataset export destinations: export raw datasets to storage
- Personalization destinations: Edge-based real-time data sharing

**Destination SDK**: build custom destinations; file-based and streaming destination types; templated and custom transformation

### 6.6 Sandboxes

- Isolated environments within a single AEP organization
- Production sandboxes: real customer data; destination activation
- Development sandboxes: testing and development; can be reset
- 5 sandboxes included by default (expandable)
- Sandbox tooling: package and transfer configurations between sandboxes

### 6.7 Licensing (AEP / RTCDP)

**Real-Time CDP B2C Edition**:
- **Prime**: per 1,000 Person Profiles; pre-built destinations only; 2,500 Collaboration Credits; 25 Computed Attributes/sandbox; 5 Look-Alike Audiences/sandbox; 500KB data export per profile/year
- **Ultimate**: per 1,000 Person Profiles; advanced enterprise source and destination connectors; Destination SDK; 5,000 Collaboration Credits; 50 Computed Attributes/sandbox; 20 Look-Alike Audiences/sandbox; 700KB data export per profile/year; 5 Profile API calls per profile/year
- Both: 75KB profile richness limit; 5 sandboxes included; 1,500 streaming events/second; 500 RTCDP Connections Outgoing Calls per profile/year

**Real-Time CDP B2B Edition**: adds account profiles, buying groups, account-based segmentation, account destinations; uses B2B XDM schemas (Account, Opportunity, Campaign, Marketing List)

**RTCDP Collaboration**: privacy-safe data collaboration between brands; purpose-built for first-party data partnerships; GA announced February 2025

### 6.8 Common Pain Points

- Data modeling: XDM schema design is foundational and difficult to change post-implementation; over-normalization vs under-normalization tradeoffs
- Identity resolution: graph collapse from shared device identifiers (e.g., household email); identity optimization requires careful namespace priority configuration
- Ingestion errors: strict schema validation rejects data with type mismatches; partial ingestion configuration needed for fault tolerance
- Profile merge: merge policy conflicts when multiple datasets contribute conflicting values
- Segmentation latency: streaming segmentation limited to simple rule types; complex segments require batch (daily)
- Cost: usage-based pricing (profiles, events, storage) can escalate rapidly; data governance strategy needed to control profile counts
- Complexity: steep learning curve; requires dedicated AEP practitioners

---

## 7. Adobe Commerce (Magento)

### 7.1 Overview

Adobe Commerce (formerly Magento Commerce) is a flexible e-commerce platform supporting both B2C and B2B use cases.

**Current Version**: Adobe Commerce 2.4.8 (with PHP 8.3/8.4)
**Deployment Models**: Adobe Commerce Cloud (PaaS), Adobe Commerce On-Premises
**Search Engine**: OpenSearch 2.x (Elasticsearch removed in 2.4.8)

### 7.2 Core Capabilities

**Storefront and Catalog**:
- Configurable, grouped, bundled, virtual, downloadable product types
- Multi-store, multi-website, multi-currency, multi-language from single admin
- Catalog staging and preview (schedule catalog changes)
- Category management with merchandising rules
- URL rewrites and SEO management

**Live Search**:
- AI-powered search powered by Adobe Sensei
- Replaces native Magento search and Elasticsearch/OpenSearch for storefront
- Faceted search with dynamic faceting
- Synonym management, search term redirects
- "Search as you type" with product recommendations in popover
- AI-refined results for improved accuracy (2026)

**Product Recommendations**:
- Adobe Sensei-powered recommendation engine
- Recommendation types: Trending, Most Viewed, Most Purchased, Recently Viewed, Recommended for You, Viewed This Viewed That, Bought This Bought That, Conversion (view-to-cart, view-to-purchase)
- Page placement rules (PDP, category, cart, checkout, home)
- Visual similarity recommendations using AI
- Available as free extension (magento/product-recommendations module 3.2.2+)

**Payment Services**:
- Adobe-native payment processing (no third-party gateway needed for basic use)
- Credit/debit cards, PayPal, Apple Pay, Google Pay, Venmo
- PCI DSS compliance managed by Adobe
- Fraud management

### 7.3 B2B Features

- **Company Accounts**: hierarchical organizational structures with parent/child accounts; custom org charts; multiple buyers per account
- **Shared Catalogs**: gated product catalogs with custom pricing per company; public shared catalog (default) and custom shared catalogs (company-specific)
- **Requisition Lists**: up to 999 per buyer; quick reorder from saved lists
- **Quick Order**: SKU-based rapid ordering via CSV upload or manual entry
- **Purchase Orders**: approval workflows with configurable rules and limits
- **Negotiable Quotes**: buyer-seller price negotiation workflow with history tracking
- **Credit and Payment on Account**: company credit limits, payment terms, purchase order payment

### 7.4 App Builder Extensibility

- Serverless extensibility framework built on Adobe I/O Runtime
- Custom integrations without modifying core code
- Event-driven architecture via Adobe I/O Events
- Starter kits for common integration patterns (ERP, CRM, PIM)
- Eliminates upgrade conflicts by keeping customizations external
- Admin UI SDK for extending the Commerce admin panel
- API Mesh: GraphQL gateway for aggregating multiple APIs (REST, GraphQL, SOAP) into a single GraphQL endpoint; reduces client-side API calls

### 7.5 Commerce + AEP Integration

- AEP source connector for Commerce event data
- Behavioral event streaming (product views, add-to-cart, purchases)
- Back-office event streaming (order status changes, shipments)
- AEP destination connector for Commerce: activate RTCDP audiences for storefront personalization
- Shared audiences between Commerce and RTCDP for consistent cross-channel experiences

### 7.6 Licensing

- Adobe Commerce Cloud: subscription-based; tiered by GMV (Gross Merchandise Value) and order volume
- Adobe Commerce On-Premises: license + annual maintenance
- Magento Open Source: free (community edition, self-hosted, no Adobe support)

### 7.7 Common Pain Points

- Upgrade complexity: major version upgrades require extensive testing; custom modules may break
- Performance at scale: large catalogs (100K+ SKUs) and high concurrency require careful tuning, Varnish caching, and infrastructure optimization
- B2B feature maturity: some B2B workflows less polished than dedicated B2B platforms
- Extension quality: third-party marketplace extensions vary in quality; can cause security vulnerabilities
- Cloud infrastructure: limited control over infrastructure compared to self-hosted; deployment pipeline learning curve
- Cost: Adobe Commerce Cloud pricing escalates with GMV; total cost includes hosting, extensions, and integrations

---

## 8. Adobe Marketo Engage

### 8.1 Overview

Marketo Engage is Adobe's B2B marketing automation platform for lead management, email marketing, revenue attribution, and account-based marketing.

**Current Version**: Continuously updated SaaS
**Deployment Model**: Cloud only (SaaS)

### 8.2 Core Capabilities

**Lead Management**:
- Lead database with custom fields and activity history
- Lead scoring: demographic scoring (fit) and behavioral scoring (engagement); multiple scoring models
- Lead lifecycle management: define lifecycle stages (MQL, SAL, SQL, Opportunity, Customer) with automated transitions
- Lead partitions: data isolation for business units
- Smart Lists: dynamic, criteria-based lead filters
- Static Lists: manually curated lead groups

**Smart Campaigns**:
- Trigger campaigns: fired by lead activities (fills out form, clicks link, visits page, score changes)
- Batch campaigns: scheduled execution against Smart List audiences
- Flow steps: change data value, send email, add to list, change score, request campaign, send alert, change program status, change revenue stage, interesting moment, etc.
- Wait steps: time-based delays in flow
- Choices in flow: conditional logic within flow steps
- Executable campaigns: reusable campaign modules called by other campaigns

**Email Marketing**:
- Visual email editor with drag-and-drop modules
- Email 2.0 templates with editable sections
- AI Assistant Content Accelerator: generate email copy, subject lines, and images
- Brand Themes: admin-defined styling configurations for brand consistency across templates
- Dynamic content: show different content blocks based on segmentation
- A/B testing: subject line, from address, send time, whole email variants
- Email deliverability dashboard
- Predictive content: AI-powered content selection from a content library
- Up to 5 million email sends per hour at highest performance tier (2025)

**Programs**:
- Program types: Email, Engagement (drip/nurture), Event (with webinar integrations), Default
- Engagement Programs: cadenced nurture streams with transition rules between streams
- Channels and statuses: define conversion funnel per program type
- Period costs: budget tracking per program
- Program tokens: reusable variables ({{my.tokenName}})

**Landing Pages**:
- Guided and free-form landing page templates
- A/B testing for landing pages
- Progressive profiling: forms that adapt based on known data
- Social share buttons, referral programs

### 8.3 Revenue Cycle Analytics

- Revenue Cycle Modeler: visual model of lead-to-revenue stages
- Revenue Explorer: multi-dimensional reporting (BI-like pivot tables)
- Program Analyzer: ROI and pipeline analysis per program
- Opportunity Influence Analyzer: map marketing touches to pipeline

### 8.4 Dynamic Chat

- AI-powered conversational chatbot embedded on website
- Trained on sales, marketing, and product knowledge
- Demandbase integration for account-level firmographic data
- Chat interactions update lead profiles in real-time
- Conversion scoring triggers campaigns from chatbot engagement
- Meeting booking directly from chat
- Conversational flow designer with branching logic

### 8.5 Marketo Measure (Bizible)

- Multi-touch attribution platform for B2B
- Tracks every marketing touchpoint across the buyer journey (100+ touchpoints per deal)
- Attribution models: first-touch, lead-creation, U-shaped, W-shaped, full-path, custom
- CRM integration (Salesforce, Microsoft Dynamics): pushes attribution data to CRM for sales visibility
- Online and offline touchpoint tracking (events, trade shows, direct mail)
- Paid media cost integration for ROI calculation
- ABM (account-based marketing) attribution

**Marketo Measure Ultimate**: AEP-native version; ingests Marketo Measure data via AEP datasets; combines with AEP audience and journey data for unified measurement

### 8.6 Marketo + AEP Integration

- **Marketo Source Connector**: streams Marketo data (leads, activities, programs, static lists) into AEP datasets in near-real-time
- **B2B XDM mapping**: Marketo entities map to B2B XDM schemas (Person, Account, Opportunity, Campaign)
- **Data Streams**: expose key events via Adobe I/O Events; stream real-time activities from Marketo to any system without waiting for scheduled syncs
- **Customer activity data streaming**: feed Marketo data into CJA for cross-channel journey analysis

### 8.7 CRM Sync

- Native bi-directional sync with Salesforce and Microsoft Dynamics
- New Salesforce CRM Sync (2025): faster, more reliable connection with increased throughput; CRM Sync dashboard for real-time visibility into sync performance
- Field mapping and conflict resolution rules
- Custom object sync
- Program-to-Campaign sync (Salesforce)

### 8.8 API and Integrations

- **REST API**: CRUD operations on leads, activities, programs, lists, custom objects; OAuth 2.0 authentication
- **SOAP API**: end of life March 31, 2026
- **access_token query parameter**: deprecated; unavailable after March 31, 2026 (must use Authorization header)
- **Webhooks**: outbound HTTP calls from flow steps
- **Adobe I/O Events**: event-based integration for real-time activity streaming
- **LaunchPoint**: integration marketplace for pre-built connectors (webinar platforms, CRMs, ABM tools)

### 8.9 Licensing

- Tiered by database size (number of leads/persons) and features
- Growth, Select, Prime, Ultimate tiers
- Add-ons: Advanced Journey Analytics, Marketo Measure, Dynamic Chat

### 8.10 Common Pain Points

- Database management: lead deduplication, data quality, merge rules; database size directly impacts licensing cost
- CRM sync issues: field-level conflicts, API call limits, sync lag; requires ongoing monitoring
- Smart Campaign performance: complex nested Smart List criteria can slow campaign processing
- Email deliverability: shared IP reputation in lower tiers; inbox placement varies by ISP
- Reporting limitations: native reporting less powerful than dedicated BI tools; Revenue Cycle Analytics has steep learning curve
- Migration to AEP: Marketo Source Connector has limitations on custom object sync; data model translation to XDM requires careful planning

---

## 9. Adobe Workfront

### 9.1 Overview

Adobe Workfront is a work management and project management platform for marketing and creative teams. It connects strategy to execution by managing work requests, projects, portfolios, and resource allocation.

**Current Version**: Continuously updated SaaS (quarterly releases: 26.Q1, 26.Q2, etc.)
**Deployment Model**: Cloud only (SaaS)

### 9.2 Core Capabilities

**Project Management**:
- Project templates with predefined tasks, assignments, and durations
- Task dependencies (finish-to-start, start-to-start, etc.)
- Milestones and milestone paths
- Gantt chart visualization
- Agile boards (Kanban and Scrum)
- Project status reporting and dashboards

**Resource Management**:
- Resource Planner: capacity planning based on roles and skill sets
- Workload Balancer: visual assignment of work across team members
- Resource pools and job roles
- Utilization reports: planned vs actual hours
- Scenario Planner: what-if analysis for resource allocation

**Request Management**:
- Request queues with routing rules and queue topics
- Custom forms: unlimited custom fields on projects, tasks, issues, portfolios, programs
- Approval processes: sequential, parallel, and conditional approvals
- Issue tracking and conversion (issue to task or project)

**Proofing**:
- Built-in proofing viewer for images, videos, PDFs, and web content
- Annotation tools for review comments
- Automated proofing workflows with review stages
- Approval and decision tracking
- Compare proof versions side-by-side

### 9.3 Workfront Planning

- Strategic planning layer above project execution
- Connected record types: link planning records to Workfront projects, campaigns, and audiences
- Timeline and calendar views with drag-and-drop
- Inline editing of connected project data
- Request forms with single-decision approver and auto-complete settings
- Taxonomy management for organizational metadata

### 9.4 Workfront Fusion (Automation)

- iPaaS (Integration Platform as a Service) for no-code/low-code automation
- Visual scenario builder with modules (triggers, actions, searches, aggregators, iterators)
- 500+ pre-built app connectors (Adobe products, Salesforce, Jira, Slack, Google, Microsoft, etc.)
- Custom webhooks for event-driven automation
- Data transformation functions
- Error handling and retry logic
- Scenario scheduling and execution history

### 9.5 Workfront + AEM Assets Integration

**Two integration paths**:

1. **Enhanced Connector (Native)**:
   - Bi-directional metadata sync between Workfront projects and AEM assets
   - Auto-publish approved assets to AEM DAM
   - Linked folders between Workfront projects and AEM
   - Proof generation from AEM assets
   - Event subscriptions for real-time sync

2. **Workfront Fusion + AEM Assets Module**:
   - Flexible automation scenarios connecting Workfront and AEM
   - Create projects with AEM workflows automatically
   - Custom data transformations during sync
   - Adobe is shifting toward Fusion-based integrations for stability and scalability

### 9.6 Licensing

- Select, Prime, Ultimate tiers
- Per-user licensing
- Fusion licensed separately or as add-on
- Planning available as add-on

### 9.7 Common Pain Points

- Configuration complexity: highly customizable but requires significant setup and governance
- Reporting: built-in reporting is powerful but has a learning curve; custom report creation requires understanding of object relationships
- User adoption: change management challenge; users resist moving from email/spreadsheets
- Integration maintenance: Fusion scenarios require ongoing monitoring and error handling
- AEM connector: enhanced connector has known limitations around linked folder depth and metadata field mapping
- Performance: large instances with years of data can experience slow page loads and report generation

---

## 10. GenStudio for Performance Marketing

### 10.1 Overview

GenStudio for Performance Marketing is Adobe's AI-powered content creation and activation platform, representing the intersection of Creative Cloud and Experience Cloud for marketing teams.

**Current Version**: GA (launched October 2024, expanded March 2025, major update October 2025)
**Deployment Model**: Cloud only (SaaS)

### 10.2 Core Capabilities

**AI-Powered Content Creation**:
- Generate on-brand marketing assets for social media, email, display ads, and web
- Powered by Adobe Firefly for image generation and text generation models
- Brand guidelines enforcement: upload brand voice, visual style, color palettes, typography, and imagery rules
- Content Production Agent: upload a marketing plan; receive automated recommendations on visual styles and tactics; generate assets automatically

**Content Supply Chain**:
- GenStudio is described as "an end-to-end content supply chain solution" for planning, creating, managing, activating, and measuring content
- Integrates with: AEM Assets (for DAM), Workfront (for workflow management), Creative Cloud (for design tools), and AJO/Campaign (for delivery)
- Connects Creative Cloud and Experience Cloud in a single application

**Channel Activation**:
- Direct integrations with ad delivery partners: Amazon Ads, Google Marketing Platform, Innovid, LinkedIn, TikTok
- Export generated assets directly to ad platforms
- Variant generation for different channels and formats from a single brief

**Brand Guidelines Enforcement**:
- Brand score: AI-evaluated compliance score for generated content
- Guardrails: prevent off-brand content from being published
- Custom model fine-tuning via Adobe Firefly Foundry (announced October 2025)

**Insights and Measurement**:
- Performance metrics for generated content
- Content attribution across channels
- A/B variant performance comparison

### 10.3 Licensing

- Standalone enterprise product
- Pricing not publicly disclosed; contact Adobe sales
- Requires AEP foundation

### 10.4 Adoption

Early adopters include Coca-Cola, dentsu, Estee Lauder, Henkel, IBM, Lumen Technologies, NFL, PepsiCo/Gatorade.

---

## 11. Adobe Mix Modeler

### 11.1 Overview

Adobe Mix Modeler is a marketing measurement and planning platform that unifies marketing mix modeling (MMM) and multi-touch attribution (MTA) into a single solution.

**Current Version**: Continuously updated SaaS
**Deployment Model**: Cloud only (SaaS), built on AEP

### 11.2 Core Capabilities

**Marketing Mix Modeling (MMM)**:
- Multiplicative nonlinear regression model
- Weekly conversions modeled as the product of baseline demand and the combined influence of marketing channels
- Accounts for: media synergies, time-varying effects, budget reallocation across time, seasonality, macroeconomic factors
- Supports summary-level data (spend, impressions, GRPs) and touchpoint-level data

**Multi-Touch Attribution (MTA)**:
- Discrete-time survival model (vs traditional logistic regression)
- Captures delayed impact of marketing in flexible, time-specific windows
- More accurate reflection of customer behavior than standard MTA
- Works with available touchpoint-level data

**Unified Framework**:
- AI/ML bi-directional transfer learning between MMM and MTA
- Ensures consistent results across measurement and planning
- Works in a cookieless world (MMM does not depend on user-level tracking)
- Single UI for both modeling approaches

**Planning Capabilities**:
- Budget optimization across channels
- Scenario planning: what-if analysis for budget reallocation
- Forecasting: predict outcomes based on planned spend changes
- Channel-level and sub-channel-level optimization

### 11.3 Integration

- Ingests data from AEP datasets
- Supports data from Adobe Analytics, CJA, and third-party sources
- Harmonized data layer maps disparate data sources to common taxonomy

### 11.4 Impact

- Adobe's own implementation drove an 80% increase in return on media spend over five years

### 11.5 Licensing

- Licensed as add-on to AEP
- Pricing based on data volume and modeling scope

---

## 12. Other Products

### 12.1 Real-Time CDP (Detailed Architecture)

See Section 6 (AEP) for detailed RTCDP architecture. Key architectural highlights:

- **Hub architecture**: central data processing in Azure/AWS regions
- **Edge architecture**: distributed Edge Network nodes for sub-millisecond profile lookups and segmentation
- **Profile store**: distributed NoSQL database; handles billions of profiles
- **Segment evaluation pipeline**: streaming (real-time), batch (scheduled), edge (at-request-time)
- **Activation pipeline**: delivers audiences to destinations via streaming APIs or scheduled file exports
- **RTCDP Collaboration**: privacy-safe data collaboration between brands for first-party data partnerships (GA February 2025)

### 12.2 Adobe Audience Manager (Legacy)

**Status**: No longer actively marketed; Adobe is migrating customers to Real-Time CDP

- DMP (Data Management Platform) for audience segmentation and activation
- Traits, segments, destinations model
- Algorithmic look-alike modeling
- Data feeds and data marketplace (third-party data)
- Profile Merge Rules for cross-device identity
- Device Co-op: deprecated August 31, 2022
- No official public end-of-life date for core platform announced, but new customer sales have stopped
- Existing customers should plan migration to RTCDP

**Migration Path**: Audience Manager to RTCDP migration guide available; concept mapping: AAM Traits -> AEP Segments; AAM Segments -> AEP Audiences; AAM Destinations -> AEP Destinations

### 12.3 Adobe Advertising

Adobe Advertising is a programmatic media buying and management platform.

**Components**:

- **Advertising DSP (Demand-Side Platform)**:
  - Programmatic media buying across display, video, CTV, audio, native, digital out-of-home
  - Campaign management with forecasting and spend recommendations
  - Audience targeting from RTCDP (authenticated and unauthenticated first-party audiences)
  - GenStudio integration: import display ad experiences from GenStudio into creative libraries (January 2026)
  - Geos dimension with Pin Code/Postal Index data
  - Package Flight dimensions for pacing and performance metrics
  - Cross-channel frequency capping

- **Advertising Search, Social & Commerce**:
  - Bid management for Google, Microsoft Bing, Yahoo, Meta, Amazon sponsored ads
  - Campaign sync and reporting aggregation
  - Portfolio optimization via AI-driven bidding
  - Conversion tracking and attribution

- **Advertising Creative 2.0**:
  - Dynamic creative optimization
  - Multi-format ad creation
  - A/B testing of creative variants
  - All-in Cost report for advertisers with both DSP and Creative (GA)

**Integration**: AEP audiences activate to Advertising DSP via the Adobe Advertising DSP destination connector; Analytics data feeds into Advertising for attribution

### 12.4 Adobe Pass

Adobe Pass provides authentication and authorization infrastructure for TV Everywhere (TVE) and premium content access.

**Core Capabilities**:
- Multi-channel video programming distributor (MVPD) authentication
- Programmer integration for content protection
- Home-Based Authentication (HBA) for automatic entitlement based on network
- Temp Pass for free preview periods
- Platform SSO: unified sign-on across devices

**API and SDK Status**:
- **REST API v2**: current standard; enables authentication sessions to be passed between devices (e.g., authenticate on mobile, stream on TV); all future development on v2
- **REST API v1**: support discontinued December 31, 2025; end of life planned by end of 2026
- **AccessEnabler SDKs**: support discontinued May 31, 2026; end of life planned by end of 2026
- **AccessEnabler JavaScript SDK v3.5**: end of life January 8, 2025
- **TVE Dashboard**: migrated to experience.adobe.com/pass/authentication (old console.auth.adobe.com deprecated March 12, 2025)

**Migration Path**: all customers must migrate to REST API v2 by end of 2026

### 12.5 Adobe Learning Manager

Adobe Learning Manager (formerly Adobe Captivate Prime) is a learning management system (LMS).

**Current Features (2025-2026)**:
- Experience Builder: branded, role-based learning portals with customizable widgets, menus, and pages
- Social learning: tagging peers in learning boards, community collaboration
- Gen AI-powered admin support: contextual guidance, troubleshooting, setup assistance
- xAPI support: captures formal and informal learning data; built-in learning record store (LRS)
- Weighted checklists: graded evaluation scales (April 2026)
- Content-level multiple attempt tracking for quizzes
- Fluidic Player enhancements: "Next" action previews

**Deployment**: Cloud-hosted SaaS
**Integration**: SCORM, xAPI, AICC content standards; SSO via SAML/IMS; REST APIs; LTI integration

### 12.6 Adobe Document Cloud Integrations

- Acrobat Sign: integrated electronic signatures across AEM Forms, Workfront, and Experience Cloud workflows
- PDF Services API: programmatic PDF generation, conversion, OCR, and manipulation
- Document Generation API: template-based document creation from JSON data
- Available via Adobe Developer Console

---

## 13. Integration Layer

### 13.1 Adobe I/O Runtime

- Serverless computing platform built on Apache OpenWhisk
- Execute custom code in response to Adobe I/O Events
- Languages: Node.js (primary), with Docker action support for others
- Used by: AEM Asset Compute Workers, App Builder actions, custom integrations
- Auto-scaling; pay-per-execution model
- Namespaces isolated per organization/project

### 13.2 Adobe Developer Console

- Central hub for managing Adobe API integrations
- Hierarchy: Organization > Project > Workspace > API
- Authentication methods: OAuth Server-to-Server (recommended), OAuth Web App, OAuth Single Page App; JWT (deprecated, end of life January 2025)
- Service Account (Server-to-Server) credentials for backend integrations
- API key management and credential rotation
- Project templates for common integration patterns

### 13.3 Adobe I/O Events

- Event-driven architecture for subscribing to Adobe product events
- Event providers: AEM, Commerce, Analytics, Campaign, Creative Cloud, Document Cloud, Experience Platform, Marketo Engage
- Delivery: webhooks (HTTP POST), Adobe I/O Runtime actions, or event journaling (pull-based)
- Near-real-time event delivery
- Event registration and management via Developer Console

### 13.4 App Builder

- Complete framework for building custom applications extending Adobe products
- Combines: Developer Console + I/O Runtime + I/O Events + React Spectrum (UI framework) + Storage/State SDKs
- Pre-integrated with Adobe APIs and authentication
- Headless (API-only) or full-stack (with UI) applications
- Project templates and scaffolding via CLI
- Primary extensibility framework for Adobe Commerce

### 13.5 API Mesh

- GraphQL gateway for Adobe Developer App Builder
- Aggregate multiple backend APIs (REST, GraphQL, SOAP, OData) into a single GraphQL endpoint
- Reduces client-side API complexity and number of network calls
- Schema stitching and type merging
- Transforms and handlers for data manipulation
- Primary use case: Adobe Commerce backend API aggregation
- Managed via `aio` CLI with API Mesh plugin

### 13.6 Tags / Adobe Experience Platform Data Collection

(See Section 6.3 for detailed coverage)

- Tag management for deploying Web SDK, Analytics, Target, and third-party scripts
- Extensions marketplace: 500+ extensions
- Event forwarding: server-side tag execution on Edge Network
- Publishing workflow with environment-based deployment

### 13.7 Adobe Exchange Marketplace

- Marketplace for third-party integrations, extensions, and apps for Adobe products
- Categories: AEM, Commerce, Analytics, Target, Campaign, Workfront, Creative Cloud
- Listings include: connectors, plugins, themes, extensions, and services
- Adobe review and certification process for listed apps

---

## 14. Common Infrastructure

### 14.1 Adobe Identity Management System (IMS)

- Centralized authentication and authorization for all Adobe products
- Cloud-based architecture with industry-standard protocols (SAML 2.0, OAuth 2.0, OpenID Connect)
- Identity types: Adobe ID (personal), Enterprise ID (organization-managed), Federated ID (SSO via customer IdP)
- User provisioning: manual via Admin Console, bulk CSV upload, User Sync Tool (automated from enterprise directory), or SCIM API
- SSO federation: SAML 2.0 or OpenID Connect with customer IdP (Okta, Azure AD, Ping, ADFS, etc.)
- Multi-factor authentication support

**2025-2026 Updates**:
- Legacy IP restrictions retired Q1 2026
- Product admin assignment per instance (GA for orgs provisioned after October 13, 2025)

### 14.2 Admin Console

- Central web console for managing users, products, and permissions across all Adobe products
- Product profiles: define feature access within each product
- User groups: logical groupings for bulk permission assignment
- Organization-level settings: domains, directories, identity types
- Package management for Creative Cloud desktop applications
- Asset migration tools for transferring assets between users
- Support case management

### 14.3 Adobe Unified Experience

- Single shell (navigation header) across all Experience Cloud applications
- Unified search across products
- Unified notifications
- Unified help and learning
- Consistent navigation model
- experience.adobe.com as the unified entry point
- Progressive rollout across all Experience Cloud products (Workfront, AJO, AEP, etc.)

### 14.4 Federated Audience Composition

(See Section 6.2.5 for detailed coverage)

- Build and activate audiences using data in external warehouses without copying data into AEP
- Supported warehouses: Snowflake, Google BigQuery, Amazon Redshift, Azure Synapse, Databricks
- Zero-copy integration
- Visual composition canvas
- Combine with AEP-native audiences

### 14.5 AI Services

**Adobe Sensei**:
- Umbrella brand for Adobe's AI and machine learning capabilities
- Powers: Smart Tags (AEM), Product Recommendations (Commerce), Auto-Target (Target), Customer AI (AEP), Attribution AI (AEP), Live Search (Commerce), Smart Crop (AEM), Anomaly Detection (Analytics)
- Being rebranded and integrated with generative AI under broader AI umbrella

**Adobe Firefly**:
- Generative AI model family for creative content
- Text-to-image, generative fill, generative recolor, text effects
- Commercially safe (trained on licensed content, Adobe Stock, public domain)
- Integrated into: GenStudio, AEM Assets, Creative Cloud (Photoshop, Illustrator, etc.)
- Firefly Foundry: custom model fine-tuning for brand-specific image generation (October 2025)
- Content Credentials: provenance metadata attached to AI-generated content

**Adobe Sensei GenAI Services**:
- Integrated across Experience Cloud: CJA (natural language insights), AEM (content generation), AJO (content accelerator), Marketo Engage (email copy generation), Commerce (product descriptions)
- AI Assistant across AEP, CJA, AJO, RTCDP for natural language querying and product knowledge
- Agentic AI capabilities via Agent Orchestrator (see Section 6.2.7)

### 14.6 Customer AI

- Propensity scoring at the individual profile level
- Models: churn prediction, conversion prediction, custom propensity models
- Automated feature engineering from AEP profile and event data
- Model transparency: influential factors reported for each score
- Scores written back to AEP profiles for segmentation and activation

### 14.7 Attribution AI

- Multi-touch attribution scoring
- Configurable: attribution windows (lookback periods), touchpoint definitions, conversion events
- Models: algorithmic (ML-driven), first-touch, last-touch, linear, U-shaped, time-decay
- Incremental impact analysis
- Scores available in AEP for analysis in CJA

### 14.8 Content AI (AJO)

- AI Assistant Content Accelerator in AJO
- Generate personalized content for email, SMS, push across channels
- Brand voice and style enforcement
- Variant generation for A/B testing
- Image generation via Firefly integration

---

## 15. Platform Tag Reference (for Black Hole)

This section provides the canonical platform tags that Black Hole should use when classifying ingested tickets.

### 15.1 Primary Platform Tags

| Tag | Full Name | Common Ticket Keywords |
|-----|-----------|----------------------|
| `AEM` | Adobe Experience Manager | AEM, CMS, content management, authoring, publishing, dispatcher, DAM, assets, pages, components, templates, workflows |
| `AEM-Sites` | AEM Sites | sites, pages, authoring, components, templates, Core Components, MSM, live copy, experience fragments, content fragments, Edge Delivery, EDS, Universal Editor |
| `AEM-Assets` | AEM Assets | DAM, assets, metadata, renditions, Dynamic Media, Brand Portal, Content Hub, smart tags, image processing |
| `AEM-Forms` | AEM Forms | forms, adaptive forms, PDF, document generation, form submissions, communications API |
| `AEM-Screens` | AEM Screens | digital signage, displays, screens, kiosk |
| `Analytics` | Adobe Analytics | analytics, report suite, eVar, prop, segment, Analysis Workspace, Report Builder, data feed, VISTA, processing rules |
| `CJA` | Customer Journey Analytics | CJA, journey analytics, data view, connection, cross-channel, stitching, guided analysis |
| `Target` | Adobe Target | target, A/B test, personalization, recommendations, auto-target, mbox, at.js, offers, activities, audiences |
| `AJO` | Adobe Journey Optimizer | journey optimizer, AJO, journeys, offers, decisioning, push notifications, in-app, content cards, decision management |
| `Campaign` | Adobe Campaign | campaign, email marketing, workflows, deliveries, transactional, Message Center, FFDA |
| `AEP` | Adobe Experience Platform | experience platform, AEP, XDM, schemas, datasets, profiles, segments, sandboxes, query service, identity |
| `RTCDP` | Real-Time CDP | RTCDP, CDP, customer data platform, audience activation, destinations, sources, identity graph, merge policies |
| `Commerce` | Adobe Commerce (Magento) | commerce, magento, storefront, catalog, cart, checkout, orders, B2B, shared catalog, Live Search, product recommendations |
| `Marketo` | Adobe Marketo Engage | marketo, marketing automation, lead scoring, nurture, smart campaign, engagement program, Dynamic Chat |
| `Workfront` | Adobe Workfront | workfront, project management, tasks, proofing, approvals, resource management, Fusion |
| `GenStudio` | GenStudio for Performance Marketing | genstudio, content generation, AI content, brand guidelines, content supply chain |
| `Mix-Modeler` | Adobe Mix Modeler | mix modeler, MMM, marketing mix, attribution model, media spend |
| `Advertising` | Adobe Advertising | advertising, DSP, programmatic, search ads, social ads, display ads |
| `Pass` | Adobe Pass | pass, TV everywhere, MVPD, authentication, entitlement, TVE |
| `Learning` | Adobe Learning Manager | learning manager, LMS, training, courses, certifications |
| `Audience-Manager` | Adobe Audience Manager (Legacy) | audience manager, AAM, DMP, traits, signals, data marketplace |

### 15.2 Infrastructure/Integration Tags

| Tag | Description |
|-----|-------------|
| `Cloud-Manager` | AEM Cloud Manager CI/CD, environments, pipelines |
| `Tags-Launch` | Tags / Adobe Launch / Data Collection |
| `Web-SDK` | Experience Platform Web SDK (alloy.js) |
| `Mobile-SDK` | AEP Mobile SDK |
| `Event-Forwarding` | Server-side event forwarding |
| `App-Builder` | Adobe App Builder / I/O Runtime |
| `API-Mesh` | API Mesh for GraphQL |
| `IO-Events` | Adobe I/O Events |
| `IMS` | Identity Management System / Admin Console |
| `Firefly` | Adobe Firefly GenAI |
| `Sensei` | Adobe Sensei AI/ML |
| `Agent-Orchestrator` | AEP Agent Orchestrator / Agentic AI |

### 15.3 Cross-Reference: Common Issue Categories by Platform

| Platform | Top Issue Categories |
|----------|---------------------|
| AEM-Sites | Publishing errors, component rendering, dispatcher cache invalidation, performance degradation, replication failures, template/policy issues, upgrade/migration issues |
| AEM-Assets | Asset processing failures, metadata sync issues, Dynamic Media rendering, Brand Portal sync, slow search, large asset upload failures |
| AEM-Forms | Form submission errors, PDF generation failures, pre-fill service issues, form rule engine bugs, communications API errors |
| Analytics | Data discrepancies, implementation tagging issues, processing rule conflicts, segment anomalies, data feed delivery failures, report suite configuration |
| CJA | Connection ingestion errors, data view configuration, stitching identity issues, derived field logic, audience publishing failures |
| Target | Activity delivery failures, flicker issues, A4T data mismatches, audience not qualifying, on-device decisioning artifact sync, Recommendations feed errors |
| AJO | Journey execution failures, offer eligibility issues, channel configuration errors, consent enforcement, event processing latency, content rendering |
| Campaign | Workflow execution failures, delivery errors, bounce management, FFDA query timeouts, transactional message failures, migration issues |
| AEP | Schema validation errors, ingestion failures, identity graph issues, merge policy conflicts, segment evaluation delays, destination activation failures |
| RTCDP | Audience activation failures, profile count discrepancies, edge profile sync, destination connector errors, consent propagation |
| Commerce | Checkout errors, payment processing failures, catalog sync issues, search indexing problems, B2B account/catalog issues, extension conflicts, upgrade failures |
| Marketo | CRM sync failures, email deliverability issues, smart campaign errors, API rate limits, lead scoring discrepancies, program status issues |
| Workfront | Fusion scenario failures, proof processing errors, custom form issues, API integration errors, reporting performance, AEM connector sync |

---

## Appendix A: Migration Paths Reference

| From | To | Official Support | Key Considerations |
|------|----|-----------------|-------------------|
| AEM 6.5 On-Prem | AEM as a Cloud Service | Yes (CTT, BPA, Repository Modernizer, Dispatcher Converter) | OSGi bundle refactoring; custom login removal; mutable/immutable separation; workflow modernization |
| AEM Sites (traditional) | AEM Edge Delivery Services | Yes (Experience Modernization Agent) | Paradigm shift to document-based authoring; JavaScript/CSS skillset; limited component complexity |
| Adobe Analytics | Customer Journey Analytics | Yes (Analytics Source Connector, evolution guides) | Data model translation (eVars/props to flexible dimensions); identity stitching setup; report recreation in CJA |
| Campaign Standard | Campaign v8 | Yes (Adobe-managed migration with Transition Manager) | Workflow logic differences; data model migration; REST API endpoint changes; IP warmup |
| Campaign Classic v7 | Campaign v8 | Yes | Schema migration; custom code refactoring; FFDA architecture adaptation |
| Audience Manager | Real-Time CDP | Yes (migration guide, concept mapping) | Trait-to-segment mapping; destination re-configuration; third-party data strategy change |
| AppMeasurement | Web SDK | Yes (migration guide) | Tag rule conversion; variable mapping to XDM; testing parallel implementation period |
| Adobe Pass REST API v1 | REST API v2 | Required by end of 2026 | SDK removal; API endpoint updates; session management changes |
| Adobe Pass AccessEnabler SDKs | REST API v2 | Required by end of 2026 | Complete SDK replacement; cross-device authentication redesign |
| Marketo SOAP API | REST API | Required by March 31, 2026 | API call pattern refactoring; authentication method changes |

---

## Appendix B: Licensing Tier Summary

### Adobe Analytics

| Feature | Select | Prime | Ultimate |
|---------|--------|-------|----------|
| eVars per Report Suite | 200 | 200 | 250 |
| Props per Report Suite | 75 | 75 | 75 |
| Events per Report Suite | 1,000 | 1,000 | 1,000 |
| Processing Rules | 150 | 150 | 150 |
| Customer Attributes | 3 | 15 | 200 |
| Contribution Analysis Tokens/month | -- | 10 | 20 |
| Data Repair API (rows/year) | -- | -- | 1.2B |
| Report Requests/month | 500K | 500K | 500K |
| Report Builder (concurrent scheduled) | 10 | 10 | 10 |

### Customer Journey Analytics

| Feature | Foundation | Select | Prime | Ultimate |
|---------|-----------|--------|-------|----------|
| Concurrent Report Requests | 5 | 6 | 8 | 10 |
| Monthly Report Requests | 500K | 750K | 1.5M | 5M |
| Data Views | 500 | 600 | 750 | 1,000 |
| Full Table Export (rows) | 3M | 30M | 150M | 300M |
| Derived Fields | -- | 100 | 200 | 500 |
| Audience Publishing | 75 | 75 | 100 | 150 |
| Field-based Stitching Backfill | -- | 13 months | 13 months | 25 months |
| Graph-based Stitching Backfill | -- | -- | 13 months | 25 months |

### Adobe Journey Optimizer

| Feature | Select | Prime | Ultimate |
|---------|--------|-------|----------|
| Batch Orchestration | Yes | Yes | Yes |
| Real-time Journey Orchestration | No | Yes | Yes |
| Inbound Channels (web, in-app) | No | Yes | Yes |
| Streaming Segmentation | No | Yes | Yes |
| Offer Decisioning | No | No | Yes |
| Computed Attributes/sandbox | 25 | 25 | 50 |

### Real-Time CDP (B2C)

| Feature | Prime | Ultimate |
|---------|-------|----------|
| Advanced Enterprise Connectors | No | Yes |
| Destination SDK | No | Yes |
| Collaboration Credits | 2,500 | 5,000 |
| Computed Attributes/sandbox | 25 | 50 |
| Look-Alike Audiences/sandbox | 5 | 20 |
| Data Export (per profile/year) | 500KB | 700KB |
| Profile API Calls | -- | 5/profile/year |

### AEM Assets

| Feature | Prime | Ultimate |
|---------|-------|----------|
| Power Users | 5 | 15 |
| Collaborator Users | 5 | 15 |
| Limited Users | 50 | 250 |
| Storage (Prod/Stage) | 2TB (max 30TB) | 5TB |

---

## Appendix C: Key API Endpoints Reference

| Product | API Type | Base URL Pattern | Auth Method |
|---------|----------|-----------------|-------------|
| AEP | REST | platform.adobe.io/data/... | OAuth S2S |
| AEM CS | REST/GraphQL | author-pXXXX-eYYYY.adobeaemcloud.com | IMS Bearer |
| Analytics | REST 2.0 | analytics.adobe.io/api/... | OAuth S2S |
| Target | REST | admin.adobe.io/target/... (admin); delivery API via Edge | OAuth S2S |
| Campaign v8 | REST | campaign.adobe.io/... | OAuth S2S |
| AJO | REST (via AEP) | platform.adobe.io/... | OAuth S2S |
| Marketo | REST | {instance}.mktorest.com/rest/... | OAuth 2.0 (client credentials) |
| Commerce | REST/GraphQL | {store-url}/rest/V1/... and /graphql | OAuth/Bearer Token |
| Workfront | REST | {instance}.workfront.com/attask/api/... | API Key or OAuth |
| Pass | REST v2 | sp.auth.adobe.com/... | Device registration |

**Authentication Note**: JWT (Service Account) credentials are deprecated. All new integrations should use OAuth Server-to-Server credentials via Adobe Developer Console.

---

*This document is maintained as part of the Black Hole ingestion engine reference data. It should be updated quarterly as Adobe releases new features and deprecates existing ones.*
