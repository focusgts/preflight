# ADR-025: Content Freeze Elimination

**Status:** Accepted
**Date:** 2026-03-22
**Decision Makers:** Engineering, Product, Solution Architecture

## Context

Content freeze is the #1 business objection to CMS migration. During a traditional migration, organizations must stop all content authoring and publishing for days or weeks while content is extracted, transformed, and loaded into the target system. This causes:

- **Revenue loss** from inability to publish marketing campaigns, product updates, or promotions
- **Missed campaigns** tied to seasonal events or product launches that cannot be rescheduled
- **Launch delays** cascading across the organization
- **Author frustration** and resistance to migration adoption
- **Executive pushback** because the business cost of freeze often exceeds the migration cost itself

Every competitor in the migration space requires content freeze. This is a massive opportunity for differentiation.

## Decision

Black Hole implements **continuous content synchronization** that eliminates content freeze entirely. Authors keep working in the source system while migration happens. Changes are automatically detected, captured, and replayed in the target system. The actual freeze window is reduced from days/weeks to **minutes**.

### Architecture

The system consists of four core components:

1. **ContentSyncEngine** — Orchestrates continuous bidirectional sync between source and target
2. **ChangeDetector** — Detects content modifications using snapshot diffing and content hashing
3. **ConflictResolver** — Handles concurrent edits with configurable resolution strategies
4. **CutoverManager** — Manages the zero-downtime cutover sequence

### Change Detection Strategy

We use a **snapshot-diff** approach:

1. Take a baseline snapshot of source content (content hashes for each path)
2. On each sync cycle (default: 5 minutes), take a new snapshot
3. Diff the snapshots to find additions, modifications, deletions, and moves
4. Apply detected changes to the target system

Content hashing uses path + type + lastModified + metadata to produce a lightweight hash. This avoids downloading full content bodies for comparison on every cycle.

### Change Types Tracked

- Page: created, modified, deleted, moved
- Asset: uploaded, modified, deleted
- Tag: added, removed

### Conflict Resolution

When both source and target have changes to the same content path, a conflict occurs. We support four resolution strategies:

| Strategy | When Used | Behavior |
|----------|-----------|----------|
| **Source Wins** | During migration (default) | Source is the authority; source change is applied |
| **Target Wins** | Post-cutover | Target is the authority; target change is kept |
| **Merge** | Non-conflicting fields | Merge field-level changes from both sides |
| **Manual** | Critical content | Flag for human review with side-by-side diff |

During migration, **source wins** is the default because the source CMS is where authors are actively working. After cutover, the strategy flips to **target wins**.

### Cutover Sequence

The cutover is a 7-step process that reduces the freeze window to minutes:

1. **Final sync** — Capture any remaining source changes (2 min)
2. **Pause source authoring** — Briefly disable editing in source CMS (1 min)
3. **Verify sync completeness** — Confirm all changes replicated (2 min)
4. **Switch DNS/routing** — Update CDN/DNS to point to target (3 min)
5. **Verify target is live** — Run automated smoke tests (2 min)
6. **Resume authoring on target** — Enable editing in target CMS (1 min)
7. **Start reverse-sync** — Catch any straggler changes (3 min)

**Estimated total freeze: ~12 minutes** vs. 2-4 weeks with traditional migration.

If validation fails at any step, the cutover can be rolled back automatically:
1. Revert DNS/routing
2. Resume source authoring
3. Restart forward sync
4. Verify source is live

## Consequences

### Positive

- Eliminates the #1 business objection to migration
- No competitor offers this capability
- Revenue-producing content operations continue uninterrupted during migration
- Marketing campaigns are not delayed or cancelled
- Reduces organizational resistance to migration
- Cutover freeze time measured in minutes, not weeks
- Automatic rollback if cutover fails
- Full audit trail of every content change during migration

### Negative

- Adds complexity to the migration engine (sync state management, conflict resolution)
- Requires periodic polling of the source system (configurable interval)
- Conflict resolution for overlapping edits requires careful strategy selection
- Some edge cases (bulk imports, workflow-triggered changes) may need special handling

### Risks

- **Source system API rate limits** could throttle change detection. Mitigation: configurable polling interval, webhook support for systems that offer it.
- **Large binary asset changes** could slow sync cycles. Mitigation: batch size limits, asset-specific handling.
- **Network instability** between source/target. Mitigation: retry logic, error tracking, health monitoring with degraded/error states.

## Alternatives Considered

1. **Webhook-only detection** — More efficient but requires source system to support webhooks. Not all legacy CMSes do. Polling is the universal fallback.
2. **Database-level replication** — Lower latency but requires direct database access, which is rarely available and creates tight coupling.
3. **Content freeze with shorter window** — Still requires freeze, just shorter. Does not eliminate the business objection.

## References

- `src/lib/sync/content-sync-engine.ts` — Core sync engine
- `src/lib/sync/change-detector.ts` — Change detection
- `src/lib/sync/conflict-resolver.ts` — Conflict resolution
- `src/lib/sync/cutover-manager.ts` — Cutover management
- `src/types/sync.ts` — Type definitions
