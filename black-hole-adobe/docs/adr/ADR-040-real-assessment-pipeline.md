# ADR-040: Real Assessment Pipeline

## Status: Proposed

## Date: 2026-03-30

## Context

The assessment API routes (`POST /api/assessments` and `POST /api/migrations/[id]/assess`) generate scores using `Math.random()` instead of invoking the real `AssessmentEngine` at `src/lib/engine/assessment.ts`. The engine has real methods for code analysis, content analysis, integration mapping, risk scoring, timeline estimation, and cost estimation. A real `AEMConnector` can now extract data from live AEM instances (ADR-038). The missing piece is connecting the connector output to the engine input.

Random scores are worse than no scores. A prospect who sees a "78% readiness" number will ask "how did you get that?" and the honest answer today is "we rolled dice." This must be replaced with defensible analysis before any demo.

## Decision

### 1. Kill Math.random() in assessment routes

- In `src/app/api/assessments/route.ts`: replace random score generation (lines 74-78) with call to `AssessmentEngine.runAssessment()`
- In `src/app/api/migrations/[id]/assess/route.ts`: same — invoke real engine instead of `randomScore(55, 95)` pattern

### 2. Assessment data flow

- Step 1: User connects AEM instance via connector (ADR-038)
- Step 2: Connector extracts content, components, configs, workflows, indexes
- Step 3: Extraction data is stored in migration items
- Step 4: Assessment engine analyzes migration items and produces real scores
- Step 5: Scores are persisted to assessment record in SQLite

### 3. Assessment engine enhancements

- Wire `codeAnalysis()` to analyze extracted component code against `CodeModernizer` rules
- Wire `contentAnalysis()` to analyze extracted content structure (page count, asset count, template types)
- Wire `integrationMapping()` to catalog detected OSGi configs and external service references
- Wire `riskScoring()` to compute risk from real findings, not random numbers
- Wire `costEstimation()` to use real `CostEngine` with extracted metrics as inputs

### 4. Fallback for demo without live AEM

- If no connector data exists, allow manual upload of BPA CSV report as assessment input
- Parse BPA CSV format (code, type, subtype, importance, identifier, message) into assessment items
- This enables demos without requiring a live AEM connection
- Add `POST /api/assessments/upload-bpa` endpoint that accepts multipart CSV upload

## Consequences

- Positive: Assessment scores become credible and defensible — based on real analysis, not random numbers
- Positive: Connects the entire pipeline: AEM -> Connector -> Extraction -> Assessment -> Score
- Positive: BPA CSV upload enables demos with any AEM customer's existing report
- Negative: Assessments will take longer (seconds instead of instant random generation)
- Negative: Empty AEM instances will produce boring assessments (need meaningful content for impressive scores)
- Negative: BPA CSV format may vary between AEM versions — parser must handle variations gracefully

Estimated effort: 16-20 hours
