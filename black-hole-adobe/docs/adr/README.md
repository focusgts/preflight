# Architecture Decision Records

## Numbering Scheme

| Range | Category | Description |
|-------|----------|-------------|
| 001-015 | Foundation | Framework, language, data, auth, deployment |
| 016-026 | Core Features | Migration phases, simulation, healing, sync, MAC |
| 027-029 | Public Features | Health score, calculator, landing page |
| 030-038 | Detection & Competitive | AEM scanner, competitive positioning, gap features |
| 039-044 | Integration & Hardening | Wiring, pipeline execution, portal, production readiness |
| 045-049 | Content Sync & Security | Content sync wiring, auth hardening, SSRF protection, credentials, rate limits |
| 050-054 | Execution Infrastructure | Content transfer, code output, Cloud Manager, CDN/DNS cutover, self-healing |
| 055-058 | Cross-Platform Connectors | WordPress, Sitecore, GA-to-CJA, SFMC-to-Campaign migration engines |
| 059-063 | Production Readiness | Code apply bug fixes, real-world validation, error handling, orchestrator, pilot protocol |

## Index

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [001](ADR-001-nextjs-app-router.md) | Next.js App Router as Application Framework | Accepted | Adopt Next.js App Router for server components, API routes, and file-based routing |
| [002](ADR-002-typescript-strict.md) | Strict TypeScript with Full Type Safety | Accepted | Enable strict mode TypeScript across the entire codebase for compile-time safety |
| [003](ADR-003-ai-model-tiering.md) | Three-Tier AI Model Strategy | Accepted | Route AI tasks across Haiku/Sonnet/Opus tiers based on complexity and cost |
| [004](ADR-004-connector-architecture.md) | Plugin-Based Connector Architecture | Accepted | Extensible connector system for AEM, Adobe Experience Platform, and third-party integrations |
| [005](ADR-005-assessment-scoring.md) | Weighted Scoring Algorithm for Migration Readiness Assessment | Accepted | Multi-dimensional weighted scoring across code, content, integrations, and risk |
| [006](ADR-006-code-modernization-rules.md) | Rule-Based Code Modernisation Engine | Accepted | Regex and AST-based rules for detecting deprecated APIs and generating modernization fixes |
| [007](ADR-007-compliance-by-design.md) | Compliance by Design with Privacy-First Architecture | Accepted | GDPR/SOC2 compliance patterns embedded in architecture rather than bolted on |
| [008](ADR-008-dark-theme-ui.md) | Dark-Mode-First UI Design | Accepted | Dark theme as primary design language for professional enterprise aesthetic |
| [009](ADR-009-migration-phases.md) | Six-Phase Migration Lifecycle | Accepted | Structured migration through discover, assess, transform, execute, validate, optimize phases |
| [010](ADR-010-risk-scoring.md) | Risk Prediction Model Architecture | Accepted | ML-informed risk scoring that predicts migration failures before they occur |
| [011](ADR-011-claude-ai-integration.md) | Claude AI Integration Architecture | Accepted | Claude API integration for code analysis, remediation guidance, and natural language interaction |
| [012](ADR-012-sqlite-persistence.md) | SQLite for Data Persistence | Accepted | Embedded SQLite database for zero-dependency single-file persistence |
| [013](ADR-013-session-auth.md) | Session-Based Authentication | Accepted | Server-side session auth with secure cookies instead of JWT tokens |
| [014](ADR-014-sse-over-websocket.md) | SSE over WebSocket for Real-Time Progress | Accepted | Server-Sent Events for unidirectional real-time progress streaming |
| [015](ADR-015-docker-deployment.md) | Containerised Deployment with Docker | Accepted | Docker-based deployment for consistent environments across dev, staging, and production |
| 016 | *(reserved)* | -- | Number reserved; no ADR exists at this index |
| [017](ADR-017-ruvector-integration.md) | RuVector Integration Layer | Accepted | Vector search integration for semantic similarity across migration artifacts |
| [018](ADR-018-pdf-report-generation.md) | PDF Report Generation with @react-pdf/renderer | Accepted | Client-side PDF generation for migration assessment and audit reports |
| [019](ADR-019-bulk-code-review.md) | Bulk Code Review Queue | Accepted | Batch processing queue for reviewing large codebases file-by-file |
| [020](ADR-020-navigator-bridge.md) | Navigator Bridge API | Accepted | Bridge API to Adobe Experience Manager Navigator for cloud readiness data |
| [021](ADR-021-live-migration-dashboard.md) | Live Migration Dashboard | Accepted | Real-time dashboard with SSE-powered progress tracking during active migrations |
| [022](ADR-022-migration-simulation.md) | Migration Simulation (Dry-Run Mode) | Accepted | Simulate migrations without touching production to validate plans and estimate risk |
| [023](ADR-023-enterprise-security.md) | Enterprise Security (RBAC, MFA, Audit Logging, Session Hardening) | Accepted | Full enterprise security stack with role-based access, MFA, and audit trails |
| [024](ADR-024-migration-as-code.md) | Migration-as-Code | Accepted | Declarative YAML-based migration definitions for version control and reproducibility |
| [025](ADR-025-content-freeze-elimination.md) | Content Freeze Elimination | Accepted | Delta sync architecture that eliminates content freeze windows during migration |
| [026](ADR-026-self-healing-migrations.md) | Self-Healing Migrations | Accepted | Automatic error detection and remediation during migration execution |
| [027](ADR-027-public-health-score.md) | Public AEM Health Score | Accepted | Free public tool that scans any URL for AEM version, deployment type, and migration readiness |
| [028](ADR-028-migration-cost-calculator.md) | Migration Cost Calculator | Accepted | Interactive calculator estimating migration cost, timeline, and ROI |
| [029](ADR-029-public-landing-page.md) | Public Landing Page & Assessment Signup | Accepted | Marketing landing page with lead capture and free assessment signup flow |
| [030](ADR-030-aem-detection-methodology.md) | AEM Detection Methodology — 5-Tier Multi-Signal Approach | Accepted | 5-tier detection system (DNS, headers, HTML, probes, fingerprinting) for accurate AEM identification |
| [031](ADR-031-competitive-positioning-vs-adobe-tools.md) | Competitive Positioning vs. Adobe BPA/CAM | Accepted | Feature-by-feature positioning against Adobe Best Practices Analyzer and Cloud Acceleration Manager |
| [032](ADR-032-effort-estimation-engine.md) | Effort Estimation Engine | Proposed | Data-driven effort estimation using component counts, complexity metrics, and historical calibration |
| [033](ADR-033-integration-discovery-mapping.md) | Integration Discovery & Mapping | Proposed | Automated discovery and cataloging of all external integrations in an AEM instance |
| [034](ADR-034-visual-regression-validation.md) | Visual Regression Testing & Migration Validation | Proposed | Screenshot comparison between source and target to validate visual fidelity post-migration |
| [035](ADR-035-post-migration-drift-monitoring.md) | Post-Migration Drift Monitoring | Proposed | Continuous monitoring for configuration and content drift after migration completes |
| [036](ADR-036-cloud-manager-preflight.md) | Cloud Manager Pre-Flight Simulation | Proposed | Simulate Cloud Manager pipeline checks locally before deploying to AEMaaCS |
| [037](ADR-037-dispatcher-security-assessment.md) | Dispatcher Security & Configuration Assessment | Proposed | Automated analysis of Dispatcher configs for security gaps and AEMaaCS compatibility |
| [038](ADR-038-aemcs-connector-authentication.md) | AEM as a Cloud Service Connector Authentication & Extraction | Accepted | OAuth/service-account authentication and content extraction from live AEM Cloud Service instances |
| [039](ADR-039-dashboard-mock-data-elimination.md) | Dashboard Mock Data Elimination | Proposed | Wire all 5 dashboard pages to real API endpoints, replacing static mock data imports |
| [040](ADR-040-real-assessment-pipeline.md) | Real Assessment Pipeline | Proposed | Replace Math.random() scoring with real AssessmentEngine analysis backed by connector data |
| [041](ADR-041-code-modernization-api-ui.md) | Code Modernization API & UI Exposure | Proposed | Expose CodeModernizer via API endpoint and UI with before/after diffs and file upload |
| [042](ADR-042-migration-execution-pipeline.md) | Migration Execution Pipeline | Proposed | Connect transform/execute/validate/metrics routes to real engines and fix Portal Live Migration page |
| [043](ADR-043-client-portal-real-data.md) | Client Portal & Real Data Integration | Proposed | Wire client portal to real migration data with shareable token-based authentication |
| [044](ADR-044-production-hardening-demo-polish.md) | Production Hardening & Demo Polish | Proposed | Cross-cutting production readiness: auth config, lead notifications, error handling, empty states |
| [045](ADR-045-content-sync-page-wiring.md) | Content Sync Page Wiring | Proposed | Wire Content Sync page to real APIs, replacing mock data |
| [046](ADR-046-public-path-lockdown.md) | Public Path Lockdown & Auth Boundary Hardening | Accepted | Remove sensitive routes from PUBLIC_PATHS, add portal-specific token auth |
| [047](ADR-047-ssrf-protection.md) | SSRF Protection | Accepted | Validate and restrict outbound requests from connector endpoints |
| [048](ADR-048-production-credential-security.md) | Production Credential Security | Accepted | Encrypt stored credentials, rotate tokens, secure credential lifecycle |
| [049](ADR-049-dependency-and-rate-limit-hardening.md) | Dependency & Rate Limit Hardening | Accepted | Rate limiting, dependency audit, input validation hardening |
| [050](ADR-050-content-transfer-sling-post-package-manager.md) | Content Transfer — Sling POST & Package Manager | Proposed | Real content transfer via Sling POST (incremental) and AEM Package Manager (bulk) |
| [051](ADR-051-code-modernization-file-output.md) | Code Modernization File Output — Git Branch Integration | Proposed | Write auto-fix results to filesystem via Git branches or ZIP download |
| [052](ADR-052-cloud-manager-deployment.md) | Cloud Manager Deployment Integration | Proposed | Automated deployment to AEMaaCS via Cloud Manager API |
| [053](ADR-053-cdn-dns-cutover-automation.md) | CDN & DNS Cutover Automation | Proposed | Automated DNS switching, CDN cache purge, and go-live with rollback support |
| [054](ADR-054-self-healing-real-remediation.md) | Self-Healing Execution — Real Remediation | Proposed | Real remedy executors that make AEM API calls instead of flipping status flags |
| [055](ADR-055-wordpress-connector-migration.md) | WordPress Connector & Migration Engine | Proposed | WordPress REST API connector with Gutenberg-to-Core-Components transformer |
| [056](ADR-056-ga-to-cja-migration.md) | Google Analytics to CJA Migration Engine | Proposed | GA4 configuration extraction and CJA data view/XDM schema generation |
| [057](ADR-057-sitecore-connector-migration.md) | Sitecore Connector & Migration Engine | Proposed | Sitecore Item API/GraphQL connector with template and rendering transformation |
| [058](ADR-058-sfmc-to-adobe-campaign-migration.md) | SFMC to Adobe Campaign Migration Engine | Proposed | SFMC REST API connector with AMPscript-to-Campaign personalization conversion |
| [059](ADR-059-code-modernization-apply-fixes.md) | Code Modernization Apply — Fix File Output Bugs | Proposed | Fix the modernize/apply endpoint to actually write modified files and detect missing API patterns |
| [060](ADR-060-real-world-sandbox-validation.md) | Real-World Sandbox Validation Suite | Proposed | 6-phase test suite validating every execution engine against the live Focus GTS sandbox |
| [061](ADR-061-production-error-handling.md) | Production-Grade Error Handling & Observability | Proposed | Typed error taxonomy, batch transactions, audit logging, health checks, auto-pause and resume |
| [062](ADR-062-migration-orchestrator-state-machine.md) | Migration Orchestrator State Machine | Proposed | Central orchestrator with state machine, background execution, parallel phases, and resume capability |
| [063](ADR-063-production-pilot-protocol.md) | Production Pilot Protocol | Proposed | 3-pilot program (internal, friendly customer, paid pilot) before selling migration execution |
