# ADR-020: Navigator Bridge API

**Status**: Accepted
**Date**: 2026-03-22
**Authors**: Engineering Team

## Context

Black Hole for Adobe is a standalone migration platform. Navigator Portal is the ongoing managed-services platform operated by Focus GTS. When a migration completes in Black Hole, the customer transitions from "migration customer" to "managed-services customer." This transition requires all migration context, findings, fixes, and environment knowledge to flow into Navigator so that:

1. Navi (the AI assistant) has full context about the customer's environment from day one.
2. Historical tickets and KB articles are available for pattern matching.
3. ROI data accurately captures the migration value.
4. RuVector can leverage migration patterns for future customers.

## Decision

Implement a **bridge API** layer (`src/lib/bridge/`) that communicates with the Navigator Portal API over HTTPS rather than sharing a database directly.

### Why a bridge API instead of direct database sharing

1. **Deployment independence** — Black Hole runs on Docker/standalone infrastructure. Navigator runs on GCP Cloud Run with Cloud SQL PostgreSQL. Sharing a database would create tight coupling and require both systems to be in the same network.

2. **Schema evolution** — Each system has its own data model. Black Hole uses SQLite with migration-specific schemas. Navigator uses PostgreSQL with pgvector. A bridge layer maps between these schemas, allowing each to evolve independently.

3. **Security boundary** — The bridge communicates over HTTPS with API key authentication. No direct database credentials are shared between systems. This limits the blast radius if either system is compromised.

4. **Graceful degradation** — When Navigator is not configured (no `NAVIGATOR_API_URL` or `NAVIGATOR_API_KEY`), the bridge operates in "demo mode," returning simulated success responses. This allows Black Hole to function entirely standalone without Navigator.

5. **Auditability** — Every data transfer is an explicit API call that can be logged, retried, and audited. Direct database writes would bypass Navigator's application-level validation and audit trail.

### Data mapping approach

| Black Hole Type | Navigator Type | Mapping |
|---|---|---|
| `MigrationItem` | `Ticket` | SEA category derived from phase type; priority from compatibility level |
| `AssessmentFinding` (resolved) | `KnowledgeArticle` | Grouped by category; critical auto-fixes get individual articles |
| Code fixes | KB articles | Problem/solution format with BPA pattern codes |
| Assessment scores | `NaviMemory` | Environment facts with confidence scores |
| Timeline data | `time_patterns` (RuVector) | Phase durations indexed for future estimation |
| Cost data | `roi_patterns` (RuVector) | Traditional vs actual costs for ROI projection |
| Risk factors | `risk_outcomes` (RuVector) | Predicted vs actual risk for model improvement |
| Integration configs | `integration_templates` (RuVector) | Reusable integration setups |

### Components

1. **NavigatorClient** (`navigator-client.ts`) — HTTP client with retry logic and demo-mode fallback.
2. **MigrationExporter** (`migration-exporter.ts`) — Transforms Black Hole data into Navigator format and orchestrates the export pipeline.
3. **Handoff Report** (`handoff-report.ts`) — Generates a structured summary including plan recommendation and ticket volume estimate.
4. **API Route** (`/api/migrations/[id]/export`) — POST endpoint that triggers the export.
5. **Handoff UI** (`/migrations/[id]/handoff`) — Client-facing page with progress tracking and summary.

### Security considerations

- **API key authentication** — All requests to Navigator include an `X-API-Key` header. The key is stored in environment variables, never in source code.
- **No PII in transit without encryption** — All communication uses HTTPS. No customer PII (names, emails) is included in the export payload; only migration technical data.
- **Retry with backoff** — Failed requests are retried up to 3 times with exponential backoff (500ms, 1s, 2s) to handle transient network issues.
- **Input validation** — The export endpoint requires `COMPLETED` migration status. Partial or in-progress migrations cannot be exported.

### Limitations and future path

- **No real-time sync** — The bridge is a one-time export triggered manually. Future versions will support incremental sync during migration.
- **Shared PostgreSQL** — Long-term, both systems should share a PostgreSQL instance with pgvector, eliminating the need for HTTP-based data transfer. The bridge API will remain as an abstraction layer even after database unification.
- **Auth alignment** — Black Hole uses session auth; Navigator uses JWT. A unified auth strategy (likely JWT with shared issuer) is planned but not yet implemented.
- **Batch size** — Large migrations (10,000+ items) may hit rate limits. Future versions will implement batched exports with configurable concurrency.

## Consequences

- Black Hole can operate independently of Navigator.
- Navigator receives full migration context for day-one customer onboarding.
- The mapping layer must be maintained when either system's schema changes.
- Demo mode allows development and testing without Navigator infrastructure.
- The export is idempotent — running it multiple times creates duplicate records in Navigator. Future versions will implement upsert semantics.
