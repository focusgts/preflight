# ADR-019: Bulk Code Review Queue

**Status:** Accepted
**Date:** 2026-03-22
**Authors:** Migration Platform Team

## Context

The AEM code modernisation engine (ADR-006) produces 50-200 code changes per migration: OSGi config conversions, deprecated API replacements, Maven restructuring, Dispatcher config updates, workflow modernisations, and index definition conversions.

Without a review step, developers must either:
1. **Auto-apply everything** -- risky, especially for low-confidence transformations involving business logic.
2. **Manually review each file in their IDE** -- typically 5-10 minutes per change, totalling 8-30 hours for a medium migration.

Neither option is acceptable for a platform that promises speed *and* safety.

## Decision

Implement a **bulk code review queue** with confidence-tiered approval.

### Confidence Tiers

| Tier | Confidence | Policy | Rationale |
|------|-----------|--------|-----------|
| High | >= 95% | Safe to auto-approve | Mechanical, deterministic transforms (XML to JSON, adding async flag). Zero semantic change. |
| Medium | 80-94% | Review recommended | Correct pattern but context-dependent (API replacement where signature matches but usage may differ). |
| Low | < 80% | Manual review required | Complex refactors involving business logic, multi-file dependencies, or ambiguous intent. |

### Speed Multiplier Math

| Approach | Per Change | 100 Changes | Speedup |
|----------|-----------|-------------|---------|
| Manual IDE review | 6 min | 10 hours | 1x |
| Bulk queue (sequential) | 30 sec | 50 min | 12x |
| Bulk queue (auto-approve high) | 2 sec* | ~12 min | 50x |

*High-confidence items are approved with one click; the developer only manually reviews medium and low confidence items.

For a typical migration with 60% high-confidence, 30% medium, and 10% low-confidence changes:
- 60 items auto-approved in 1 click (5 seconds)
- 30 items reviewed at 30 seconds each (15 minutes)
- 10 items reviewed at 2 minutes each (20 minutes)
- **Total: ~35 minutes vs ~10 hours manually**

### Safety Guarantees

1. **No changes are applied without human approval.** The review queue is a gate, not a suggestion.
2. **Every change shows before/after diffs.** Developers see exactly what will change.
3. **Bulk approve only affects items above the configured threshold.** The threshold is adjustable (default 95%).
4. **Rejected items are logged.** Patterns of rejection feed back into confidence model calibration.
5. **Export produces patches, not direct mutations.** Approved changes are exported as applicable diffs, giving developers a final safety net before application.

## Alternatives Considered

### 1. PR-based review (generate a pull request per change)
Rejected: Creates 50-200 PRs per migration, overwhelming reviewers and polluting git history. Bulk operations become impossible.

### 2. Fully automatic application with rollback
Rejected: Rollback is insufficient for production code. A broken deployment caused by an incorrect API replacement is more expensive than 35 minutes of review.

### 3. Single large PR with all changes
Rejected: A 200-file PR is unreviable. The queue provides the same content but with structure, filtering, and bulk actions.

## Consequences

- Developers can review 100 auto-refactored changes in under 35 minutes.
- High-confidence mechanical transforms are effectively zero-cost to approve.
- Low-confidence changes get appropriate human attention.
- The confidence model can be calibrated over time based on approval/rejection patterns.
- Adds one new API route (`/api/reviews/[migrationId]`) and one new page to the dashboard.
