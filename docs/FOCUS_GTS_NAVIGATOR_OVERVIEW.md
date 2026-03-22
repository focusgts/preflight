# Focus GTS & Navigator Ecosystem — Comprehensive Overview

**Generated**: March 22, 2026
**Source**: Deep exploration of all Focus GTS and Navigator repositories

---

## 1. Focus GTS — Who They Are

**Focus GTS** is a specialized talent delivery and execution firm focused on Adobe, AI/GenAI, data, and martech. Their mission is to **remove friction from enterprise technology execution**.

**Core Problem They Solve**: The "Execution Gap" — companies invest heavily in platforms (Adobe, AI, data) but execution stalls, backlogs grow, and ROI suffers.

**Two Integrated Layers**:
1. **Talent Delivery** — Contract roles, full-time placements, executive search across Adobe, AI/GenAI, data science, martech, cloud engineering
2. **Navigator** — An AI-augmented, managed service platform that enhances how talent is identified, matched, deployed, and aligned to execution

**Positioning Philosophy**: Operators, not recruiters. Results over activity. Speed creates momentum.

---

## 2. Navigator — The Intelligent Managed Service Layer

**Navigator** is a **Service-as-a-Service (SaaS) subscription** that provides ongoing access to elite on-shore specialists who work across the **SEA Model: Support, Enhance, Advise**.

### The Three-Part Delivery Model

| **SEA Category** | **Definition** | **Examples** |
|---|---|---|
| **Support** | Resolving issues and maintaining platform stability | Troubleshooting AEM publishing, fixing analytics discrepancies, debugging integrations |
| **Enhance** | Improving and expanding the existing platform environment | Implementing new AEM features, optimizing workflows, accelerating backlog items |
| **Advise** | Helping teams make better technical and strategic decisions | Architecture reviews, best practices guidance, roadmap development, vendor evaluation |

### Pricing Model

- **Navigator 20hr**: $5,600/month (20 hours, $280/hr)
- **Navigator 40hr**: $10,400/month (40 hours, $260/hr)
- **Custom**: Variable hours and pricing
- **Overage rates**: 20hr=$280/hr, 40hr=$260/hr
- **Project management is FREE** (doesn't count against hours)
- **Minimum term**: 6 months (after 30-day pilot)
- **Prepaid discounts**: 3% (6mo), 5% (12mo), 8% (24mo)

### Key Operational Components

1. **Navigator Portal** — Client-facing platform replacing Jira Service Manager
2. **Navi AI Assistant** — Slack bot powered by Claude Sonnet 4.6, integrated with RuVector
3. **RuVector** — Self-learning vector database with SONA, GNN, MicroLoRA, EWC++, trajectory recording
4. **Knowledge Ingestion** — Adobe Experience League (16,710 articles), Confluence, internal docs, resolved tickets
5. **ROI Tracking** — SOW-based model, not hourly rate multiplication
6. **Referral Program** — Service credits for successful referrals ($1K-$5K tiers)

---

## 3. Navigator Portal — The Customer Interface

### Tech Stack

- **Frontend**: Next.js 16 + React + TypeScript + Tailwind CSS + shadcn/ui (dark mode default)
- **Backend**: FastAPI (Python) + SQLAlchemy async + Pydantic
- **Database**: PostgreSQL 15 + pgvector (Cloud SQL on GCP)
- **AI**: Claude API (Sonnet 4.6 for chat, Haiku for classification), OpenAI Whisper (voice transcription)
- **Vector Search**: RuVector (pgvector-backed)
- **Real-time**: WebSockets (Server-Sent Events for ingestion progress)
- **Auth**: JWT (dev login for testing, Google SSO planned)
- **Hosting**: Google Cloud Run (us-central1)

### Three User Roles

| **Role** | **Permissions** | **Key Features** |
|---|---|---|
| **Customer** | Own org tickets (R/W), public KB, client-visible wiki, Ask Navi, ROI dashboard, monthly reports, notification prefs | Submit tickets, track hours, authorize overage, request upgrades, see ROI |
| **Navigator** | Assigned tickets (R/W), internal notes, client notes, timer, own workload/timesheet, KB (assigned clients) | Execute work, log hours, view estimates, see client context |
| **Admin** | Full access to all clients, all tickets, all reports, manage subscriptions, onboard users, configure Navi | Monitor all clients, approve timesheets, manage revenue, configure system |

### Feature Inventory (MVP complete as of March 18, 2026)

1. **Customer Dashboard** — Utilization gauge (%), ticket stats, ROI summary, hours trend
2. **Ticket Management** — Full CRUD, 8 statuses (new/assigned/in-progress/on-hold/client-review/testing/complete/canceled), SEA categories, CapEx/OpEx, priorities
3. **Navi AI Chat** — Floating widget on every page, Claude Sonnet 4.6, RuVector semantic search, SQL fallback, context pipeline
4. **Voice-to-Ticket** — Browser MediaRecorder, OpenAI Whisper, Claude extraction (title, description, priority, SEA, platform tags)
5. **Knowledge Universe** — Interactive 3D graph visualization, 16,710 Adobe docs, platform-aware views, drill-down to documents
6. **ROI Dashboard** — SOW-based model, tiers (small=$175/hr differential, medium=$7.5K-$15K, large=$15K-$25K), monthly trends, detail table with confidence scores
7. **Navigator Wiki** — Built-in docs (markdown editor), visibility control (internal/client), org scoping, auto-indexed into Navi
8. **Referral Program** — Two-sided (referrer gets credits), tiered rewards, unique codes (NAV-AAA-XXXX), lifecycle tracking
9. **Hours Alert System** — Proactive Navi message within 2 hours of allocation, action buttons (continue/prioritize/discuss)
10. **Navigator Dashboard** — Assigned tickets, completed this month, hours logged, avg hours/ticket, client hours remaining
11. **Admin Dashboard** — All clients with utilization, navigator workloads, revenue, recent activity, alerts
12. **Timer** — Start/stop on ticket detail, live elapsed time, 0.1h rounding (6 minutes), minimum 1 minute
13. **Admin Timesheets** — All navigator time entries, date range picker, filters (navigator/client/SEA), summary cards (total/billable/CapEx/OpEx), CSV export
14. **Black Hole Data Ingestion** — File upload (CSV), API connector (Jira), platform selector (Jira/Zendesk/ServiceNow/Freshdesk/Salesforce), singularity tracker
15. **Theme Support** — Dark mode (default), light mode, localStorage persistence
16. **Settings** — Role-aware profile, notification preferences (Portal/Slack/Email per event type)

---

## 4. Navi — The AI Assistant

**Navi** is an internal Slack bot powered by Claude API that:
- Monitors shared Slack channels for ticket-worthy conversations
- Detects intent: bug_report, feature_request, escalation, question, status_check, general
- For tickets: Posts approval request to Kristen (navigator PM) with buttons
- Creates tickets in the Navigator Portal API (replacing old Jira integration)
- Tracks confidence across decision types (ticket creation, assignment, classification, priority)
- Confidence Graduation: Learning (<80%) → Assisted (80-95%) → Autonomous (>95%)

### 6 Microservices (Navigator Platform, Python 3.12, FastAPI)

1. `slack-bot` — Main Navi bot (Socket Mode WebSocket)
2. `jira-webhook` — [Being replaced by portal]
3. `classification-api` — REST API for ticket classification pipeline
4. `knowledge-crawler` — Crawls Adobe Experience League docs
5. `transcript-ingestion` — Parses call transcripts (Read AI integration planned)
6. `notification-api` — Sends notifications

### AI Model Routing

- **Claude Haiku** → Classification, intent detection, memory extraction (fastest, cheapest)
- **Claude Sonnet** → Scoring, digests, Q&A (balanced)
- **Claude Opus** → Strategic recommendations, complex reasoning (highest quality)

---

## 5. RuVector — The Self-Learning Vector Database

**RuVector** is a proprietary self-learning, self-optimizing vector database with multiple advanced components.

### Core Components

- **GNN Attention** — Reweights search results based on learned query→result relationships
- **SONA Auto-Tuning** — Optimizes index parameters, routing weights, ranking per namespace
- **MicroLoRA** — Per-query instant adaptation (<1ms) for personalized results
- **EWC++ (Elastic Weight Consolidation)** — Retains learned patterns for older clients while learning new ones (prevents catastrophic forgetting)
- **Trajectory Recording** — Every search, every decision, every correction feeds learning loop
- **Temporal Learning** — Recognizes time-based patterns (Monday AEM tickets, end-of-month rushes)
- **Embedding Drift Detection** — Alerts when client needs shift (Support-heavy → Enhance-heavy)

### RuVector Namespaces (In Navigator Portal)

| **Namespace** | **What's Indexed** | **Use Case** |
|---|---|---|
| `knowledge` | 60 KB articles (Adobe docs, Confluence, wiki), resolved ticket summaries | Ask Navi responses, KB auto-generation |
| `tickets` | 54 completed tickets (embeddings of title+description) | Similar ticket detection, routing suggestions |
| `time_patterns` | Hours per ticket type/complexity | More accurate time estimates |
| `roi_patterns` | Value per ticket category/platform | Better ROI projections |
| `assignment_patterns` | Navigator skills, ticket outcomes | Smarter auto-assignment |
| `transcripts` | Meeting transcripts per client | Better ticket suggestions from meetings |
| `memories` | Client environment facts, preferences, issues | Navi context at day one |

### Current Stats (As of March 18, 2026)

- 114 vectors indexed
- 60 KB articles
- 54 completed tickets
- HNSW index for fast similarity search
- pgvector extension in PostgreSQL

---

## 6. Data Model & Schema

### Core Entities

1. **Organization** — Client company (AAA Northeast, LendPilot) with Slack channel ID mapping
2. **User** — Portal user with role (customer/navigator/admin), SSO info
3. **Subscription** — Plan details (20hr/40hr/custom, rates, hours, billing cycle)
4. **Ticket** — Full lifecycle: new→assigned→in_progress→on_hold→client_review→testing→complete→canceled
5. **TicketNote** — Comments (internal/external, author, timestamp)
6. **TimeEntry** — Hours logged by navigators (ticket_id, navigator_id, hours, billable, source)
7. **MonthlyUsage** — Hours tracking per org (allocated, used, overage, authorized, CapEx/OpEx breakdown, SEA breakdown)
8. **KnowledgeArticle** — KB articles (source: manual, ticket_resolution, meeting_transcript, navigator_docs)
9. **ROIEntry** — Per-ticket ROI calculations (category, estimated_value, confidence_score, calculation_inputs)
10. **Referral** — Referral program entries (shared→registered→qualified→signed→credited)
11. **NaviDecision** — Navi decision audit log (decision_type, suggested_action, confirmed, confidence_at_suggestion)
12. **NaviMemory** — Learned memories per client (environment facts, preferences, issues)
13. **MeetingTranscript** — Read AI webhook results (session_id, org_id, participants, transcript, action_items, suggested_tickets)
14. **PlanRequest** — Overage/upgrade requests (request_type, details, status, approval)

### RuVector Tables

- `ruvector_state` — Component state persistence (GNN, SONA, MicroLoRA, EWC)
- `ruvector_embeddings` — Vector store (namespace, entity_type, entity_id, embedding vector(384), metadata)
- `ruvector_trajectories` — Every query, result, user feedback (click, dwell, relevance)
- `ruvector_patterns` — Learned clusters (pattern_type, centroid, member_count)
- **HNSW Indexes** — Vector similarity search (tickets, knowledge, transcripts namespaces)

---

## 7. Black Hole — Data Ingestion Engine (Existing)

Black Hole is a three-phase AI-powered ingestion system that absorbs data from any source system and distributes it to Navigator Portal, creating full historical context from day one.

### The Three Phases

1. **INGEST** — Get the data in
   - Supported platforms: Jira, Zendesk, ServiceNow, Freshdesk, Salesforce, CSV, JSON, API
   - Data normalization to universal SourceItem schema
   - Upload: drag-and-drop file picker or REST API
   - Preview: first 5-10 items before committing

2. **SORT** — Claude analyzes & classifies each item
   - SEA Category (Support/Enhance/Advise)
   - Priority mapping (source priority → Navigator priority)
   - CapEx vs OpEx classification
   - Platform tags (AEM, Analytics, Target, AEP, RTCDP, SFMC, Marketo, Workfront, Commerce, GenStudio)
   - Complexity estimate (hours)
   - Knowledge Base candidate?
   - ROI category
   - Batch processing: 10 items at a time, ~50 items/minute, ~$0.001 per item (Haiku)

3. **DISTRIBUTE** — Route to destinations
   - Tickets → Navigator tickets with proper SEA category, priority, CapEx/OpEx
   - Notes → ticket notes
   - Time Data → time entries
   - KB Articles → auto-generated from resolved tickets
   - RuVector → 5 namespaces (tickets, time_patterns, roi_patterns, assignment_patterns, knowledge)
   - Navi Memories → client environment facts, architecture, known issues

---

## 8. How Black Hole for Adobe Integrates with Navigator

### Integration Architecture

```
BLACK HOLE FOR ADOBE          NAVIGATOR PORTAL          NAVI
═══════════════════          ════════════════          ════

1. STANDALONE PHASE (Pre-Navigator)
   Customer buys Black Hole → Runs migration
   Black Hole has its OWN portal (/portal/[orgId])
   Customer tracks migration progress

2. MIGRATION COMPLETE → NAVIGATOR ONBOARDING
   Black Hole data feeds INTO Navigator via existing ingestion:
   ├── Tickets → Navigator tickets (historical)
   ├── KB Articles → Navigator knowledge base
   ├── Patterns → RuVector namespaces
   ├── Memories → Navi memories (environment context)
   └── Time Data → Time patterns for estimation

3. ONGOING NAVIGATOR SERVICE
   Customer is now a Navigator subscriber
   Navi already knows their environment
   KB already has their historical solutions
   Time estimates calibrated from real data
   ROI includes migration value
```

### New RuVector Namespaces (Added by Black Hole for Adobe)

| **Namespace** | **What's Indexed** | **Use Case** |
|---|---|---|
| `migration_patterns` | Every code fix, content transform, integration reconnection | Pattern matching for future migrations |
| `code_fingerprints` | OSGi bundle signatures + compatibility results | Instant compatibility checks |
| `content_signatures` | Content structure fingerprints | Duplicate/similarity detection |
| `risk_outcomes` | Predicted vs actual risk for every migration | Risk prediction improvement |
| `assessment_profiles` | Customer environment profiles | Pattern matching across customers |
| `fix_library` | Proven fixes indexed by problem pattern | Auto-fix recommendations |
| `integration_templates` | Integration configs indexed by source/target | One-click integration setup |

---

## 9. Current Implementation State (March 22, 2026)

### Navigator Portal

- **Deployed** on Cloud Run (GCP)
- **Database**: PostgreSQL 15 + pgvector on Cloud SQL
- **Real data**: 99 Jira tickets, 19 Confluence docs, 16,710 Adobe docs
- **RuVector**: 114 vectors indexed
- **Testing**: Mark Trenchard (external), Kristen Heptinstall (internal)

### Black Hole for Adobe

- **Built**: 128 files, 31,968 lines, 400 tests passing
- **Tech stack**: Next.js 16 + TypeScript + Tailwind (standalone from Navigator Portal)
- **Database**: SQLite (to be migrated to PostgreSQL + pgvector for RuVector integration)
- **AI**: Claude API with Haiku/Sonnet/Opus tiering, graceful fallback
- **Deployment**: Docker + docker-compose ready
- **Repository**: github.com/focusgts/blackhole

### Integration Gaps to Close

1. **RuVector integration** — Black Hole currently uses SQLite, needs PostgreSQL + pgvector + RuVector namespaces
2. **Navigator API bridge** — After migration completes, push data to Navigator Portal API
3. **Navi context sharing** — Migration memories should flow to Navi for immediate client context
4. **Shared PostgreSQL** — Both systems should use the same database or have a sync mechanism
5. **Auth alignment** — Black Hole uses session auth, Navigator uses JWT; need unified auth strategy

---

## Summary

**Focus GTS** operates on an integrated two-layer model:
1. **Talent layer** — Specialized staffing (contract, FTE, exec search)
2. **Navigator layer** — AI-augmented managed service that makes talent more effective

**Navigator** is not a staffing agency but a **continuous operational improvement service** backed by elite specialists, intelligent ticketing (Navigator Portal + RuVector), AI assistant (Navi), and data ingestion (Black Hole).

**Black Hole for Adobe** extends this infrastructure into the massive Adobe migration market ($12.5B-$25.5B TAM), using the same ingestion/classification/distribution architecture with Adobe-specific intelligence. After migration completes, all data flows into Navigator, creating the seamless transition from "migration customer" to "managed services customer."

The entire system is built on **self-learning principles** (RuVector), **continuous improvement** (feedback loops), and **outcome measurement** (ROI, confidence scoring, decision audit trails).
