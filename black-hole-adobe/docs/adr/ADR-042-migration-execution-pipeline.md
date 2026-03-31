# ADR-042: Migration Execution Pipeline

## Status: Proposed

## Date: 2026-03-30

## Context

The migration lifecycle has 4 API routes that currently return mock data:
- `POST /api/migrations/[id]/transform` — generates mock transformation phases
- `POST /api/migrations/[id]/execute` — creates mock cutover items
- `POST /api/migrations/[id]/validate` — returns hardcoded validation suite results
- `GET /api/migrations/[id]/metrics` — returns mock advancing metrics from `src/config/mock-live-data.ts`

Real engines exist for each phase: `CodeModernizer` for transform, `ContentMigrator` for execute (batching and dependency ordering), `SimulationEngine` for validation, and SSE `progressEventBus` for metrics. The engines need to be connected to the API routes.

Additionally, the Portal Live Migration page is the only broken page in the entire application because the `useLiveMetrics` and `useMigrationProgress` hooks it depends on are not implemented.

## Decision

### 1. Transform phase (`POST /api/migrations/[id]/transform`)

- Invoke `CodeModernizer` to produce real transformation items (ADR-041)
- Invoke `ContentMigrator.analyzeBatches()` to produce real content migration batches
- Store phase items with real file paths, line numbers, and remediation guidance
- Stream progress via `progressEventBus`

### 2. Execute phase (`POST /api/migrations/[id]/execute`)

- For content: invoke `ContentMigrator.executeMigration()` which currently simulates execution in-memory
- For code: apply auto-fix transformations from CodeModernizer where approved
- Wire to AEM connector for actual content transfer (source -> target) when both connectors are configured
- Fall back to simulation mode when only source connector exists
- Stream progress via SSE to `GET /api/migrations/[id]/progress`

### 3. Validate phase (`POST /api/migrations/[id]/validate`)

- Replace hardcoded validation results with real checks:
  - Content integrity: compare source page count vs target page count via connector
  - Component validation: verify all components deployed via QueryBuilder
  - Link validation: check for broken internal references
  - Asset validation: verify DAM assets transferred
- Run `SimulationEngine` for risk analysis
- Keep mock performance/SEO/accessibility scores with clear "estimated" labels until real Lighthouse integration

### 4. Metrics endpoint (`GET /api/migrations/[id]/metrics`)

- Replace `getMockLiveMetrics()` with real metrics from SQLite
- Track: items processed, items remaining, errors, duration, throughput
- Update metrics as transform/execute/validate phases progress

### 5. Implement missing hooks

- `src/hooks/useLiveMetrics.ts`: subscribe to SSE at `GET /api/migrations/[id]/progress`, return reactive metrics
- `src/hooks/useMigrationProgress.ts`: poll `GET /api/migrations/[id]` for phase status, return reactive progress
- This fixes the broken Portal Live Migration page (the only broken page in the app)

## Consequences

- Positive: The full migration lifecycle works end-to-end: connect -> assess -> transform -> execute -> validate
- Positive: Progress is streamed in real-time via SSE (infrastructure already exists)
- Positive: Fixes the one broken page in the entire app (Portal Live Migration)
- Negative: Actual content transfer between AEM instances is complex and risk-prone — simulation mode is the safe demo path
- Negative: Validation is limited to what can be checked via API — visual regression requires ADR-034

Estimated effort: 30-40 hours
