# ADR-060: Real-World Sandbox Validation Suite

## Status: Proposed

## Date: 2026-04-08

## Context

Black Hole has 54 implemented ADRs covering assessment, planning, code modernization, content transfer, cloud manager deployment, cutover automation, and self-healing. The engines are built and the unit test suite passes. However, **none of the execution engines have been validated against real AEM data**. Testing to date has been:
- Scanner against public AEM sites (validated)
- Connector against Focus GTS sandbox (validated)
- Pre-flight against synthetic code (validated)
- Everything else: unit tests only

We have a live AEMaaCS sandbox (`author-p192456-e1992925.adobeaemcloud.com`) with:
- 31 pages
- 589 DAM assets
- 240 components (including WKND reference demos)
- 86 workflows
- Working bearer token authentication
- Both author and publish tiers accessible

This is an ideal controlled environment to test every execution path without customer risk. Without real-world validation, hidden bugs will surface on the first paying customer, which is unacceptable.

## Decision

Execute a six-phase validation suite against the Focus GTS sandbox. Document every bug found, every metric measured, and every fix applied.

### Phase 1 — Read-Only Extraction Tests

Verify the AEM connector can extract every data type correctly:

1. **Full content extraction**: Pull all 31 pages via `extractContent()`. Verify JCR property preservation, child ordering, `jcr:lastModified`, `cq:template`, `sling:resourceType`.
2. **DAM asset extraction**: Pull all 589 assets via `extractAssets()`. Verify binary size reporting, rendition list, metadata (`dc:format`, `dam:assetPath`, `jcr:lastModified`).
3. **Component registry extraction**: Pull all 240 components via `extractComponents()`. Verify dialog paths, `sling:resourceSuperType`, `componentGroup`.
4. **Workflow model extraction**: Pull all 86 workflow models. Verify step definitions, transitions, and launcher configs.
5. **Oak index extraction**: Pull `/oak:index` definitions. Verify index types, `async` flags, `compatVersion`.

**Success criteria**: Every item extracted with correct metadata. Zero 500 errors. Latency < 2s per item average.

### Phase 2 — Content Write Tests

Using Sling POST against the sandbox's own author instance (safe to create and delete test content):

1. **Single page create**: Create `/content/blackhole-test/page1` via Sling POST. Verify it exists via Sling JSON read. Delete it. Verify deletion.
2. **Nested structure create**: Create 5 pages under a folder. Verify tree integrity (parent-child relationships, property inheritance). Delete the whole tree.
3. **Asset upload via Package Manager**: Create a small package containing 1 image, upload and install. Verify renditions generated automatically. Delete the asset.
4. **Batch transfer**: Transfer 10 items in a single batch. Measure throughput (items/second). Verify all succeed.
5. **Error recovery**: Intentionally trigger a failure (invalid path, permission denied). Verify retry logic kicks in, verify the rest of the batch continues, verify rollback of failed items.

**Success criteria**: All creates verified in target. All deletes confirmed. No orphan nodes. Error recovery works without corrupting other items.

### Phase 3 — Content Sync Tests

Using the sandbox as both source AND target (self-sync as a safe test):

1. **Sync startup**: Start a sync with `sourceUrl = targetUrl = sandbox`. Run for 60 seconds. Verify polling works, no errors logged.
2. **Change detection**: Manually edit a page property in author. Verify sync detects the change within one polling cycle.
3. **Conflict detection**: Modify the same page in two "branches" (simulated). Verify conflict is flagged, not auto-resolved.
4. **Conflict resolution**: Test all three strategies (SOURCE_WINS, TARGET_WINS, MANUAL). Verify the correct outcome for each.
5. **Pause/resume**: Start sync, pause after 30 seconds, wait 30 seconds, resume. Verify no data loss, no duplicate processing.
6. **Clean stop**: Stop the sync. Verify no dangling state, no leaked resources.

**Success criteria**: Sync engine runs stably for 10+ minutes. Zero false positives on change detection. All conflict strategies work as documented.

### Phase 4 — Code Modernization Tests

Using WKND sample project code from the sandbox:

1. **Extract real code**: Pull a few Java classes from the sandbox's `/apps/wknd` bundle via the Repository Browser in Developer Console.
2. **Run modernizer against real code**: Feed the extracted code to `POST /api/preflight` and `POST /api/migrations/[id]/modernize`.
3. **Verify detection accuracy**: For each known-good WKND file, verify the modernizer reports zero findings (WKND is already Cloud Service compatible).
4. **Plant known issues**: Add `loginAdministrative()` call to a WKND file, re-run, verify detection.
5. **Apply fixes**: Run apply endpoint on code with planted issues, verify the file content is actually modified in the response and in the ZIP.

**Success criteria**: Zero false positives on clean WKND code. All planted issues detected. Apply endpoint produces valid modified Java.

### Phase 5 — Pre-Flight Tests

1. **Run against WKND codebase**: Feed WKND source to pre-flight, verify clean run (or known warnings only).
2. **Rule-by-rule verification**: Submit 16 synthetic code samples, each triggering exactly one rule. Verify each rule catches its target and only its target.
3. **Multi-rule code**: Submit a file with 5+ issues, verify all are reported in one response.
4. **Performance**: Measure time to analyze 100 files. Target: < 10 seconds.

**Success criteria**: All 16 rules verified. Zero cross-rule false positives. Performance meets target.

### Phase 6 — End-to-End Migration Simulation

This is the grand finale — a full lifecycle test using the sandbox as both source and target:

1. **Create migration**: Source = sandbox (acting as "on-prem"), Target = sandbox (acting as "Cloud Service").
2. **Run assessment**: Verify real extraction data flows into assessment engine, produces real findings (not synthetic).
3. **Run pre-flight**: Against any sample code we extract.
4. **Run transform phase**: Generate real modernization tasks.
5. **Run execute phase**: Actually transfer 10 test pages between two subpaths on the same sandbox (e.g., `/content/test-source` → `/content/test-target`).
6. **Run validate phase**: Run regression test comparing source and target subpaths.
7. **Measure**: Total wall-clock time, items/second throughput, memory usage, error rate.

**Success criteria**: End-to-end runs without human intervention. All phases complete. Target content matches source content after transfer.

### Deliverables

1. **Test report**: Pass/fail per test, metrics, screenshots of Developer Console state
2. **Bug list**: Every issue found, severity, status (fixed/open/won't-fix)
3. **Performance baseline**: Throughput, latency, resource usage — for sales use
4. **Updated docs**: Any ADRs or README updates based on findings

## Consequences

### Positive
- Surfaces hidden bugs before a paying customer does
- Provides quantified metrics for sales ("tested against 620 real AEM items")
- Builds operational confidence for pilot migrations
- Validates the entire architecture end-to-end

### Negative
- Requires sandbox to stay awake during test runs (auto-hibernates after 8h)
- Adobe Cloud Manager API rate limits may slow batch testing
- Test content in sandbox needs cleanup after each run
- Some tests can't run against sandbox alone (need second AEM instance for true source → target transfer)

### Estimated Effort
- 20-30 hours of active testing
- 10-20 hours of bug fixing (estimated)
- 4-8 hours of documentation and reporting
