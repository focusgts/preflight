# ADR-060: Real-World Sandbox Validation Suite

## Status: Proposed

## Date: 2026-04-08

## Context

Focus GTS has an active AEMaaCS sandbox (`p192456-e1992925`) containing 31 pages, 589 DAM assets, 240 components, and 86 workflow models, plus a working Local Development Token. The execution engines built under ADRs 050-054 (content transfer, code modernization output, Cloud Manager deploy, cutover, self-healing) have been unit tested but never validated against real AEM data. Every hour spent exercising these engines against the sandbox is an hour of bugs found before a customer finds them. Without this validation, there are unknown unknowns we cannot predict, and we cannot honestly tell a prospect that the tool has been "tested against real AEMaaCS."

## Decision

Create a structured, repeatable test plan that exercises every execution path in the platform against the Focus GTS sandbox. The suite is organized into six phases and produces a test report with pass/fail, bug list, and performance metrics.

**Phase 1 — Read-Only Extraction**
1. Full content extraction: pull all 31 pages via the AEM connector; verify property preservation, child ordering, and metadata.
2. DAM asset extraction: pull all 589 assets; verify rendition references, metadata, and binary size.
3. Component registry extraction: pull all 240 components; verify dialog paths, resource types, and super-types.
4. Workflow extraction: pull all 86 workflow models; verify step definitions and transitions.
5. Oak index extraction: pull `/oak:index` and verify definitions are complete.

**Phase 2 — Content Write (Sling POST against the sandbox itself)**
1. Create a test page via Sling POST, verify via Sling JSON read, then delete.
2. Upload a small DAM asset via Package Manager, verify renditions generated, then delete.
3. Create a 5-page nested tree under a folder, verify tree integrity, then delete.
4. Batch transfer 10 items; measure throughput and verify all succeed.
5. Intentionally fail one item mid-batch; verify retry logic and rollback semantics.

**Phase 3 — Content Sync**
1. Start sync with sandbox as both source and target; run 60 seconds; verify polling.
2. Make a manual change in author; verify sync detects it.
3. Trigger a conflict scenario; verify all resolution strategies fire correctly.
4. Test pause/resume and clean stop.

**Phase 4 — Code Modernization**
1. Extract WKND sample project code from the sandbox via the repository browser.
2. Run the modernizer against real AEM Java files.
3. Verify detection accuracy against known issues.
4. Apply fixes and verify the output is valid Java.

**Phase 5 — Pre-Flight**
1. Run pre-flight against the WKND codebase and verify rules fire.
2. Compare against manual BPA analysis where accessible.
3. Feed intentionally broken code and verify all 16 rules catch their targets.

**Phase 6 — End-to-End Migration Simulation**
1. Create a "test source" migration where source and target are both the sandbox author.
2. Run the full lifecycle: assess → modernize → transform → execute → validate.
3. Measure total time, success rate, error count, and resource consumption.
4. Identify and document every breakage point.

**Deliverables**: structured test report with pass/fail per test case, prioritized bug list, performance metrics table, and recommended fixes with estimates.

## Consequences

**Positive**
- Surfaces real bugs before paying customers encounter them.
- Provides concrete metrics for sales conversations ("validated against real AEMaaCS with 620 content items, 240 components, 86 workflows").
- Creates a regression harness we can re-run before each release.
- Forces the team to exercise the less-loved code paths (rollback, retry, conflict resolution).

**Negative**
- The sandbox must stay awake during test runs; Adobe's auto-sleep can interrupt long suites.
- Adobe API rate limits will slow some phases and may require throttling.
- Test data writes and deletes leave artifacts that must be cleaned up carefully.

Estimated effort: 20-30 hours of testing plus 10-20 hours of bug fixes discovered along the way.
