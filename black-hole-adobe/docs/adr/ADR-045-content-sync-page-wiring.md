# ADR-045: Content Sync Page — Real API Wiring

## Status: Accepted

## Date: 2026-03-31

## Context

The Content Sync page (`src/app/(dashboard)/migrations/[id]/sync/page.tsx`) is the **last remaining dashboard page using hardcoded mock data**. It currently uses three inline mock functions — `createMockSync()`, `createMockChanges()`, and `createMockConflicts()` (lines 30-77) — that produce static demo data for the sync status, change log, and conflict list.

The backend is fully built and functional:
- `ContentSyncEngine` at `src/lib/sync/content-sync-engine.ts` (556 lines) with real polling, change detection, conflict resolution, and event emission
- `ChangeDetector`, `ConflictResolver`, `CutoverManager` supporting modules
- API routes already exist and work:
  - `POST /api/sync/[migrationId]` — start sync
  - `GET /api/sync/[migrationId]` — get sync status and stats
  - `DELETE /api/sync/[migrationId]` — stop sync
  - `GET /api/sync/[migrationId]/conflicts` — list unresolved conflicts
  - `PATCH /api/sync/[migrationId]/conflicts` — resolve a conflict

The page also has a 7-step zero-downtime cutover plan with rollback capability — currently driven by local state manipulation, not API calls.

Closing this gap brings every dashboard page to real API integration and eliminates the last mock data import in the application.

## Decision

Wire the Content Sync page to its existing API endpoints, replacing all three `createMock*` functions with real API calls.

### 1. Sync Status & Control

Replace `createMockSync()` with:
- On mount: `GET /api/sync/[migrationId]` to check if sync is active
- If no sync running: show "Start Sync" form with source/target config
  - Source config: populated from migration's source connector (AEM instance URL + auth)
  - Target config: populated from migration's target connector (AEMaaCS URL + auth)
  - Options: sync interval (default 5 min), conflict strategy (source wins / target wins / manual), batch size
- Start sync: `POST /api/sync/[migrationId]` with config
- Pause/Resume: `PATCH /api/sync/[migrationId]` (or stop + restart)
- Stop sync: `DELETE /api/sync/[migrationId]`
- Poll status: `GET /api/sync/[migrationId]` every 5 seconds while sync is active

### 2. Change Log

Replace `createMockChanges()` with:
- Derive from sync status response — the API returns `changeLog` in the sync status
- If the API doesn't include full change history, add a `GET /api/sync/[migrationId]/changes` endpoint
- Display real changes with timestamps, paths, types, and sync status

### 3. Conflict Resolution

Replace `createMockConflicts()` with:
- Fetch: `GET /api/sync/[migrationId]/conflicts`
- Resolve: `PATCH /api/sync/[migrationId]/conflicts` with `{ conflictId, strategy, notes }`
- Refresh conflict list after resolution

### 4. Cutover Plan

Wire the 7-step cutover to API calls:
- Step 1 (Content Freeze): `POST /api/sync/[migrationId]` with freeze=true option
- Step 2 (Final Delta Sync): Trigger final sync cycle
- Step 3 (Validation): Call `POST /api/migrations/[id]/validate`
- Step 4 (DNS Switch): Manual step — show instructions, mark complete
- Step 5 (CDN Configuration): Manual step with verification checklist
- Step 6 (Smoke Test): Link to regression test (`POST /api/migrations/[id]/regression`)
- Step 7 (Go Live): Update migration status to COMPLETED
- Rollback: Each step stores its pre-state for rollback capability

### 5. Loading, Error, Empty States

- Loading: skeleton matching the sync dashboard layout (status cards + change log + conflict list)
- Error: error banner with retry
- Empty: "No sync configured. Configure source and target to begin continuous content synchronization."
- Disconnected: "Sync is not running. Last sync completed at {timestamp}."

### 6. Content Sync Engine Enhancement

The `ContentSyncEngine.fetchSourceItems()` and `fetchTargetItems()` methods (lines 519-533) currently return empty arrays with a "Override in subclass" comment. These need to be connected to the AEM connector:
- Source items: Use AEMConnector to fetch content from source AEM instance
- Target items: Use AEMConnector to fetch content from target AEMaaCS instance
- Change detection: Compare source vs target content hashes

## Consequences

### Positive
- Eliminates the last mock data page in the entire application — 100% of dashboard pages now use real APIs
- Content sync is a headline differentiator ("12 minutes, not 12 weeks") — it must work in demos
- Conflict resolution UI becomes functional, not just visual
- Cutover plan becomes actionable with real migration state tracking

### Negative
- Real content sync requires two connected AEM instances (source + target) — demo requires both configured
- The `fetchSourceItems`/`fetchTargetItems` stubs need AEM connector integration to produce real changes
- Poll-based status updates (5-second interval) add load; SSE would be better long-term
- Cutover steps 4-5 (DNS/CDN) are inherently manual — can track status but not automate

### Estimated Effort
- Page wiring (replace mock with fetch): 8-10 hours
- Engine stub implementation (fetchSourceItems/fetchTargetItems): 4-6 hours
- Cutover API integration: 4-6 hours
- **Total: 16-22 hours**
