# ADR-050: Content Transfer Implementation — Sling POST & Package Manager

## Status: Accepted

## Date: 2026-03-31

## Context

`executeMigration()` in `src/lib/migration/content-migrator.ts` (lines 138-149) is a status-flag loop — it marks items as completed without making any HTTP calls. `writeToTarget()` in `src/lib/sync/content-sync-engine.ts` (line 553) is an empty stub. No content actually moves between AEM instances.

The migration dashboard shows progress bars and completion percentages, but behind the scenes, zero bytes are transferred. The entire execution pipeline is a simulation. For Black Hole to be a real migration platform, content must physically move from source to target.

## Decision

Implement real content transfer using two AEM APIs:

### 1. Sling POST Servlet — individual page/component writes

- POST to `{targetUrl}{path}` with `sling:resourceType`, properties, and child nodes
- Use for incremental sync and small batches (< 50 items)
- Set `Content-Type: application/x-www-form-urlencoded` for property writes
- Use `@TypeHint` suffixes for JCR property type preservation (`Date`, `Long`, `Boolean[]`, etc.)
- Handle ordering via `sling:orderBefore` parameter

### 2. AEM Package Manager API — bulk content transfer

- Build content packages on source: `POST /crx/packmgr/service.jsp?cmd=create` with group, name, version
- Add filters to package: `POST /crx/packmgr/service.jsp?cmd=edit` with `filter` parameter
- Build package: `POST /crx/packmgr/service.jsp?cmd=build`
- Download built package: `GET /crx/packmgr/service.jsp?cmd=get`
- Upload to target: `POST /crx/packmgr/service.jsp` with multipart form data
- Install on target: `POST /crx/packmgr/service.jsp?cmd=install`
- Use for initial migration and large batches (> 50 items)

### 3. Wiring

- Wire `writeToTarget()` in `src/lib/sync/content-sync-engine.ts` to use Sling POST for individual changes during delta sync
- Wire `executeMigration()` in `src/lib/migration/content-migrator.ts` to use Package Manager for batch transfers during full migration
- Both use the existing `AEMConnector` auth infrastructure (bearer token / basic auth) from `src/lib/connectors/aem-connector.ts`
- Add progress streaming via `progressEventBus` during transfer — emit events per item/package
- Add retry logic for failed transfers with exponential backoff (retry individual items, not entire packages)
- Add validation after each batch: compare source item count vs target, checksum critical properties

### 4. New files

- `src/lib/transfer/sling-post-writer.ts` — Sling POST implementation
- `src/lib/transfer/package-manager-client.ts` — Package Manager API wrapper
- `src/lib/transfer/transfer-strategy.ts` — strategy pattern selecting Sling POST vs Package Manager based on batch size

## Consequences

**Positive:**
- Content actually moves between AEM instances
- Two transfer strategies cover both incremental and bulk scenarios
- Existing auth and connector infrastructure is reused
- Progress streaming gives users real-time visibility into transfer status

**Negative:**
- Package Manager has size limits (~200MB per package); large sites need chunked packages with multiple build/download/upload cycles
- Network bandwidth between source and target is the primary bottleneck for large migrations
- Sling POST is slow for large batches (one HTTP request per item)
- Package install on target can lock the repository briefly, causing author unavailability

**Estimated effort:** 40-60 hours
