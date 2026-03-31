# ADR-041: Code Modernization API & UI Exposure

## Status: Proposed

## Date: 2026-03-30

## Context

The `CodeModernizer` at `src/lib/migration/code-modernizer.ts` is one of Black Hole's strongest features — 277 lines of real transformation logic with 8 deprecated API detection rules, OSGi XML-to-JSON conversion, Maven restructuring, Dispatcher conversion, workflow modernization, and Oak index conversion. However, it has zero exposure: no API endpoint and no UI. A prospect cannot see it work.

This is the feature most likely to make a technical evaluator say "this actually does something real." Hiding it behind unreachable code is a waste of the strongest asset in the codebase.

## Decision

### 1. Create API endpoint `POST /api/migrations/[id]/modernize`

- Accepts: `{ scope: string[] }` where scope can include "code", "osgi", "maven", "dispatcher", "workflows", "indexes"
- Retrieves migration items (extracted code/configs from connector)
- Runs `CodeModernizer` against them
- Returns: findings with before/after diffs, severity, auto-fix availability
- Stores results as transformation items on the migration

### 2. Wire into migration transform step

- Replace mock phase generation in `POST /api/migrations/[id]/transform` with real `CodeModernizer` invocation
- Each finding becomes a transform item with status (pending -> processing -> completed/failed)
- Auto-fixable items can be applied; manual items show remediation guidance

### 3. Create modernization results UI

- Add a "Code Analysis" tab to the migration detail page
- Show findings grouped by category (Deprecated APIs, OSGi, Maven, Dispatcher, Workflows, Indexes)
- For each finding: severity badge, description, before/after diff, and "Apply Fix" / "Manual Required" button
- DiffViewer component (already exists in the review page) can be reused

### 4. Enable direct code upload for demos

- Accept .java, .xml, .cfg, .json file uploads via the existing upload endpoint
- Run CodeModernizer against uploaded files without requiring a full AEM connection
- This enables quick demos: "drop your OSGi config here, see what needs to change"
- Add `POST /api/modernize/upload` endpoint that accepts file upload and returns findings immediately

## Consequences

- Positive: Exposes Black Hole's strongest technical differentiator to prospects
- Positive: "Drop a file, see the fix" is an instant demo moment
- Positive: Before/after diffs are visually compelling and build trust
- Positive: Reuses existing DiffViewer component — minimal new UI work
- Negative: Regex-based detection has false positive risk — must clearly label confidence
- Negative: Auto-fix only covers common patterns; complex cases require manual review

Estimated effort: 12-16 hours
