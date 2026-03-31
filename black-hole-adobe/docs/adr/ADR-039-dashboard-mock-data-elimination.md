# ADR-039: Dashboard Mock Data Elimination

## Status: Proposed

## Date: 2026-03-30

## Context

All 5 main dashboard pages (Overview, Migrations, Assessments, Connectors, Reports) render mock data imported from `src/config/mock-data.ts` instead of calling the API routes that already exist. The API routes backed by SQLite are functional. The UI components are polished. The gap is purely wiring — replacing static imports with `fetch()` calls.

Until this wiring is complete, the dashboard is a static mockup. Every demo requires explaining "this is fake data" which undermines credibility. The APIs exist and are tested; the UI exists and is styled; the only missing piece is connecting them.

## Decision

Systematically wire every dashboard page to its corresponding API.

### 1. Overview Page (`src/app/(dashboard)/overview/page.tsx`)

- Replace `mockDashboardStats` with fetch to new `GET /api/dashboard/stats` endpoint
- Create `GET /api/dashboard/stats` that aggregates: migration count/status from `listMigrations()`, assessment count from `listAssessments()`, connector count from `listConnectors()`, recent activity from audit log
- Wire `MigrationChart` to real migration status distribution
- Wire `ReadinessOverview` to real assessment score averages
- Wire `RecentActivity` to real audit log events

### 2. Migrations Page (`src/app/(dashboard)/migrations/page.tsx`)

- Replace `mockMigrations` (line 14) with fetch to `GET /api/migrations`
- Wire `MigrationWizard` submit to `POST /api/migrations`
- Wire detail panel to `GET /api/migrations/[id]`
- Wire status updates to `PATCH /api/migrations/[id]`
- Add refresh after creation

### 3. Assessments Page (`src/app/(dashboard)/assessments/page.tsx`)

- Replace hardcoded `assessmentSummaries` (lines 22-49) with fetch to `GET /api/assessments`
- Wire detail view to `GET /api/assessments/[id]` instead of `mockAssessmentResult`
- Wire "New Assessment" to `POST /api/assessments`

### 4. Connectors Page (`src/app/(dashboard)/connectors/page.tsx`)

- Replace hardcoded `existingConnectors` (lines 35-40) with fetch to `GET /api/connectors`
- Add connector creation modal with form that POSTs to `POST /api/connectors`
- For AEM type: specialized form that calls `POST /api/connectors/aem/connect` with URL + token
- Wire "Test" button to `POST /api/connectors/[id]/test`
- Wire "Refresh" button to re-fetch list

### 5. Reports Page (`src/app/(dashboard)/reports/page.tsx`)

- Replace hardcoded `reports` array (lines 18-55) with fetch that lists migrations/assessments with reports
- Wire "Export" button to `GET /api/reports/[id]/pdf` for PDF download
- Wire stat cards to real aggregations

### Implementation pattern for all pages

Each page follows the same refactoring pattern:
1. Remove mock data import
2. Add `useState` + `useEffect` with fetch to the corresponding API
3. Add loading skeleton while fetching
4. Add error boundary with retry button
5. Add empty state with onboarding CTA when no data exists

## Consequences

- Positive: Dashboard goes from static mockup to live, data-driven application
- Positive: Every page reflects actual system state — connectors connected, assessments run, migrations in progress
- Positive: No backend work needed — APIs already exist and are tested
- Negative: Empty states need to look good (first-time users see empty dashboards until they connect/create)
- Negative: Need loading states and error handling on every page
- Negative: Any API bugs that were hidden by mock data will surface and need fixing

Estimated effort: 40-50 hours
