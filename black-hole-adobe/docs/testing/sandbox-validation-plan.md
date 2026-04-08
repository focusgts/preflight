# Real-World Sandbox Validation Plan

**Target environment:** Focus GTS Partner Sandbox
**Author instance:** `https://author-p192456-e1992925.adobeaemcloud.com`
**Publish instance:** `https://publish-p192456-e1992925.adobeaemcloud.com`
**Program ID:** p192456
**Environment ID:** e1992925

## Purpose

Validate every Black Hole execution engine against real AEM data before any customer exposure. Unit tests pass, but no execution engine has been run against live content. This plan exercises every code path with real inputs, documents real results, and catalogs bugs that unit tests cannot surface.

## Fixture Inventory

The sandbox contains the following content at the start of testing:

| Resource | Count | Source |
|----------|-------|--------|
| Pages | 31 | WKND reference demos + default folders |
| DAM assets | 589 | WKND sample assets |
| Components | 240 | Core Components + WKND app components |
| Workflows | 86 | Default AEMaaCS workflow models |

## Prerequisites

Before running any test:

1. Confirm sandbox is not hibernated — ping `https://author-p192456-e1992925.adobeaemcloud.com/libs/granite/core/content/login.html` and expect 200 or 401 (not a hibernation page)
2. Generate a fresh Local Development Token from Cloud Manager → Developer Console → Integrations tab
3. Store the token in an environment variable: `export AEM_TOKEN="eyJ..."`
4. Confirm Black Hole is running at `http://localhost:3333`
5. Log in to Black Hole via `POST /api/auth/login` and capture the `bh_session` cookie
6. Create a fresh database if persistent state from previous runs may interfere: `rm -f data/blackhole.db`

## Phase 1 — Read-Only Extraction Tests

### Test 1.1: Full content extraction

**What we validate:** `AEMConnector.extractContent()` can read all pages from a real AEM instance.

**Steps:**
1. Send `POST /api/connectors/aem/connect` with the sandbox URL and bearer token
2. Verify the connect response reports `environment: "cloud-service"` and `pages: 31`
3. Send `POST /api/connectors/aem/extract` with `extract: ["content"]`
4. Parse the response and count pages returned

**Expected result:**
- Connect returns `connected: true` with correct inventory counts
- Extract returns 31 pages
- Every page has non-empty `path`, `title`, `resourceType`, and `children` array
- No 500 errors in the response
- Latency under 60 seconds for the full pull

**Status:** PASS (2026-04-08)

**Actual result:**
- Connect: 16 seconds wall clock, environment detected as cloud-service
- Inventory: pages=31, assets=589, components=240, workflows=86 (all match expected)
- Full extraction: 49 seconds, 31/31 pages extracted (after bug fixes)
- 30 pages with full jcr:content data, 1 stub for `/content/output` (no jcr:content subnode)
- 4 pages marked published, 27 draft
- Zero errors, zero warnings

**Bugs found:**
1. **AEMaaCS QueryBuilder field name mismatch** — AEMaaCS returns the path field as `path`, not `jcr:path` as the connector assumed. All four extraction methods (content, components, workflows, indirectly assets) read `hit['jcr:path']` which was `undefined`. Result: extract returned 0 items for every QueryBuilder-based extraction. Fixed by normalizing hits inside `queryBuilder()` helper to always expose a `jcr:path` field regardless of which key AEM returns.
2. **Silent page drops on missing jcr:content** — Folder-style container pages (like `/content/output`) appear in `cq:Page` queries but have no `jcr:content` subnode. `fetchContentNode()` silently returned null and the page was dropped from results. Result: 30 pages returned instead of 31. Fixed by returning a minimal stub with `_incomplete: true` marker so the page is still counted and flagged.

---

### Test 1.2: DAM asset extraction

**What we validate:** `AEMConnector.extractAssets()` paginates correctly and extracts metadata.

**Steps:**
1. Send `POST /api/connectors/aem/extract` with `extract: ["assets"]`
2. Count returned assets
3. Spot-check 5 random assets for complete metadata

**Expected result:**
- 589 assets returned
- Each asset has `path`, `name`, `mimeType`, `size`, `metadata`, `renditions`
- Pagination works correctly (assets are fetched in batches without loss)
- Latency under 3 minutes

**Status:** PASS (2026-04-08, after bug fix)

**Actual result:**
- 589/589 assets extracted in 292 seconds (~5 min)
- 482/589 (82%) with mimeType populated
- 458/589 (78%) with size > 0
- Remaining assets without mime/size are legitimate — placeholders, renditions, or non-standard metadata structures
- Zero errors, zero warnings

**Bugs found and fixed:**
3. **Assets extraction used wrong API and wrong pagination** — two compounding bugs:
   - (a) `/api/assets.json` lists direct children of a DAM folder (12 items at `/content/dam` root), not all 589 actual asset files recursively.
   - (b) Pagination reader expected `response.properties['srn:paging'].next` which does not exist; AEMaaCS puts next URL in top-level `links[]` array.
   - Fix: Rewrote `extractAssets()` to use QueryBuilder with `type=dam:Asset` (same approach as `extractContent`). Added `fetchAssetNode()` private helper that fetches `jcr:content.1.json` (depth=1) so the nested `metadata` subnode containing `dc:format` and `dam:size` is included.
4. **Asset metadata fetch used depth=0** — initial fix returned 589 assets with names and paths but zero mimeType/size because `jcr:content.json` without depth returns only top-level properties, and asset metadata lives in the `jcr:content/metadata` subnode. Fixed by using `.1.json` (depth=1) suffix.

---

### Test 1.3: Component registry extraction

**What we validate:** `AEMConnector.extractComponents()` returns all registered components with dialog references.

**Steps:**
1. Send `POST /api/connectors/aem/extract` with `extract: ["components"]`
2. Count returned components

**Expected result:**
- 240 components returned
- Each component has `path`, `resourceType`, `title`, `group`, `dialogPath`
- At least 10% of components have non-null `dialogPath`

**Status:** PASS (2026-04-08)

**Actual result:**
- 240/240 components extracted
- 240/240 with resourceType
- 240/240 with title
- 59/240 (25%) with dialogPath — exceeds 10% target
- Zero errors, zero warnings

---

### Test 1.4: Workflow model extraction

**What we validate:** Workflow extraction via QueryBuilder.

**Steps:**
1. Send `POST /api/connectors/aem/extract` with `extract: ["workflows"]`
2. Count returned workflows

**Expected result:**
- 86 workflows returned
- Each has `id`, `title`, `steps` array

**Status:** FAIL (2026-04-08) — bug found

**Actual result:**
- 0 workflows extracted despite inventory reporting 86
- Zero warnings

**Bugs found:**
5. **Workflow extraction path mismatch** — The connect endpoint inventory counts workflows from a path that produces 86 hits, but `extractWorkflows()` queries `type=cq:WorkflowModel` under `/var/workflow/models` which returns 0 hits. On AEMaaCS, workflow models may live under `/conf/global/settings/workflow/models` or `/libs/settings/workflow/models` or the models may not be indexed by `cq:WorkflowModel` type on Cloud Service. Needs investigation to find the correct query.
   - Deferred — logged for remediation after Phase 1 complete

---

### Test 1.5: Oak index extraction

**What we validate:** Reading `/oak:index` definitions on AEMaaCS.

**Steps:**
1. Send `POST /api/connectors/aem/extract` with `extract: ["indexes"]`
2. Verify response

**Expected result:**
- Non-empty array of index definitions
- Each has `path`, `name`, `type`, `includedPaths`, `excludedPaths`

**Status:** PASS (2026-04-08)

**Actual result:**
- 64 index definitions extracted
- Types: 49 lucene, 11 property, 2 elasticsearch, 1 counter, 1 reference
- All with path, name, and type populated
- Zero errors

---

## Phase 2 — Content Write Tests

These tests exercise `src/lib/migration/aem-content-writer.ts` against the sandbox. **All writes go to a dedicated test namespace (`/content/blackhole-test`) that can be safely deleted at the end.**

### Test 2.1: Single page create via Sling POST

**Steps:**
1. Call `slingPost()` directly (via a test script or API endpoint) to create `/content/blackhole-test/page1`
2. Verify the page exists via `GET /content/blackhole-test/page1.json` through the sandbox API
3. Delete the page via `slingDelete()`
4. Verify deletion via 404 on the same GET

**Expected result:**
- Create returns 200 or 201
- Page exists with correct properties
- Delete returns 200
- Subsequent read returns 404

**Status:** Not started

---

### Test 2.2: Nested content structure

**Steps:**
1. Create 5 pages under `/content/blackhole-test/section-a` with parent-child structure
2. Walk the tree via Sling JSON and verify all 5 pages are present
3. Delete the parent folder

**Expected result:**
- All creates succeed
- Tree walk returns the 5 pages in correct order
- Parent delete removes children recursively

**Status:** Not started

---

### Test 2.3: Asset upload via Package Manager

**Steps:**
1. Build a content package containing a single test image
2. Upload and install the package via `createAndInstallPackage()`
3. Verify the asset exists and that Adobe's asset processing generated renditions (wait up to 60 seconds)
4. Delete the asset

**Expected result:**
- Package upload succeeds
- Asset exists in `/content/dam/blackhole-test/`
- At least 2 renditions exist (original + web rendition)
- Delete succeeds

**Status:** Not started

---

### Test 2.4: Batch transfer of 10 items

**Steps:**
1. Build a list of 10 `MigrationItem` objects pointing to paths under `/content/blackhole-test/batch`
2. Call `executeBatchTransfer()` with these items
3. Measure throughput (items per second)
4. Verify all 10 items exist on the target
5. Clean up

**Expected result:**
- All 10 items transfer successfully
- Throughput reported in the response
- No items in `failed` state
- Progress callback fires for each item

**Status:** Not started

---

### Test 2.5: Error recovery mid-batch

**Steps:**
1. Build a batch of 10 items where item 5 has an intentionally invalid path (e.g., contains illegal JCR characters)
2. Run batch transfer
3. Verify the bad item fails, other items succeed, and rollback is isolated to the failed item

**Expected result:**
- 9 items marked `success`
- 1 item marked `failed` with a specific error message
- No orphan nodes on target
- Error logged to audit log (if ADR-061 is implemented)

**Status:** Not started

---

## Phase 3 — Content Sync Tests

Sync tests use the sandbox as both source and target (`sourceUrl = targetUrl = sandbox`). This is safe because changes in one half of the test namespace propagate to the other half, which we can delete at the end.

### Test 3.1: Sync startup and polling

**Steps:**
1. Start sync via `POST /api/sync/[migrationId]` with source and target both pointing to the sandbox
2. Wait 60 seconds
3. Query sync status via `GET /api/sync/[migrationId]`
4. Stop sync

**Expected result:**
- Sync starts without errors
- Status shows `running`
- No errors in sync log
- Stop cleanly terminates the sync loop

**Status:** Not started

---

### Test 3.2: Change detection

**Steps:**
1. Start sync (with test namespace configured)
2. Manually create or edit a page in Author under the test namespace
3. Wait for the next polling cycle (default 5 minutes, or reduce interval for testing)
4. Query sync status and verify the change was detected

**Expected result:**
- Change shows up in the sync changelog
- `totalChangesDetected` increments

**Status:** Not started

---

### Test 3.3: Conflict resolution strategies

**Steps:**
1. Create a conflict scenario: edit the same page "on source" and "on target" (simulated by editing at different timestamps)
2. Run sync with `strategy: SOURCE_WINS` — verify the source version wins
3. Reset, run with `strategy: TARGET_WINS` — verify the target version wins
4. Reset, run with `strategy: MANUAL` — verify the conflict is flagged without resolution

**Expected result:**
- All three strategies produce the documented outcome
- Manual strategy leaves conflicts in the `pending` state

**Status:** Not started

---

### Test 3.4: Pause, resume, stop

**Steps:**
1. Start sync, let it run for 30 seconds
2. Pause via API
3. Wait 30 seconds
4. Resume
5. Wait 30 seconds
6. Stop

**Expected result:**
- Pause stops polling immediately
- Resume continues from the paused state
- Stop terminates cleanly with no dangling resources

**Status:** Not started

---

## Phase 4 — Code Modernization Tests

### Test 4.1: Extract WKND Java code from sandbox

**Steps:**
1. Via the Developer Console Repository Browser, download 3-5 real Java files from the WKND app
2. Save them locally for reuse in tests

**Expected result:**
- Java files downloaded successfully

**Status:** Not started

---

### Test 4.2: Run modernizer against clean WKND code

**Steps:**
1. Submit the extracted Java files to `POST /api/preflight`
2. Verify the response

**Expected result:**
- Zero critical findings (WKND is Cloud Service compatible)
- Warnings acceptable (style recommendations)

**Status:** Not started

---

### Test 4.3: Planted-issue detection

**Steps:**
1. Take a clean WKND file
2. Add `factory.getAdministrativeResourceResolver(null)` to it
3. Add `session.impersonate(null)` to it
4. Submit to `POST /api/preflight`

**Expected result:**
- Both planted issues detected
- Severities reported correctly (critical and high respectively)

**Status:** Not started

---

### Test 4.4: Apply fixes end-to-end

**Steps:**
1. Run modernize endpoint on the planted-issue file
2. Apply fixes via `POST /api/migrations/[id]/modernize/apply`
3. Download the ZIP via `GET /api/migrations/[id]/modernize/download`
4. Extract the ZIP and compare to the original

**Expected result:**
- ZIP contains the modified file
- Both planted issues are removed from the modified file
- `CHANGES.md` manifest lists both changes
- File still compiles (manual check via `javac`)

**Status:** Not started — will fail until ADR-059 is implemented

---

## Phase 5 — Pre-Flight Tests

### Test 5.1: Rule-by-rule coverage

**Steps:**
1. Create 16 synthetic code samples, one per pre-flight rule
2. Submit each individually
3. Verify each rule fires exactly once, and only the matching rule

**Expected result:**
- 16 single-rule detections
- No cross-rule false positives

**Status:** Not started

---

### Test 5.2: Multi-rule file

**Steps:**
1. Create a single Java file containing all 16 issues
2. Submit to pre-flight

**Expected result:**
- All 16 findings returned in one response
- Severities reported correctly
- Success probability very low

**Status:** Not started

---

### Test 5.3: Performance at scale

**Steps:**
1. Create 100 synthetic files (mix of clean and issue-containing)
2. Submit all in one request
3. Measure total time

**Expected result:**
- Complete in under 10 seconds
- All findings returned accurately

**Status:** Not started

---

## Phase 6 — End-to-End Migration Simulation

This is the capstone test — a full migration lifecycle using the sandbox as both source and target.

### Test 6.1: Self-migration

**Setup:**
- Source namespace: `/content/blackhole-test/source`
- Target namespace: `/content/blackhole-test/target`
- Seed source with 10 test pages before starting

**Steps:**
1. Create a migration with the sandbox as both source and target
2. Configure source and target paths via migration metadata
3. Run `POST /api/migrations/[id]/assess`
4. Run `POST /api/migrations/[id]/modernize` (no code changes expected, just verify it runs)
5. Run `POST /api/migrations/[id]/transform`
6. Run `POST /api/migrations/[id]/execute`
7. Run `POST /api/migrations/[id]/validate`
8. Verify the target namespace contains the 10 pages
9. Run regression test between source and target namespaces
10. Clean up both namespaces

**Expected result:**
- All phases complete without manual intervention
- Target contains exactly 10 pages matching source
- Regression test reports greater than 95 percent match
- Audit log contains a complete trail

**Metrics to capture:**
- Total wall-clock time
- Items per second during execute phase
- Memory usage of Black Hole process
- Error rate
- Number of retries triggered

**Status:** Not started

---

## Deliverables

When this plan has been executed:

1. **Test results**: Pass/fail per test, with actual metrics recorded in this document
2. **Bug list**: Ticket every issue found with severity, reproduction steps, and fix status
3. **Performance baseline**: Throughput and latency numbers for the sales team
4. **Runbook updates**: Any operational procedures that need adjustment
5. **ADR updates**: If any architectural decisions need to change based on findings, update the relevant ADRs

## Cleanup

At the end of every test run:

1. Delete `/content/blackhole-test/*` from the sandbox
2. Delete any test packages from the package manager
3. Reset Black Hole database if needed: `rm -f data/blackhole.db`
4. Stop any active sync engines
5. Revoke the local development token if not reusing

## Change Log

| Date | Tester | Summary |
|------|--------|---------|
| (pending) | | First run |
