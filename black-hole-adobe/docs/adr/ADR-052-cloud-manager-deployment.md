# ADR-052: Cloud Manager Deployment Integration

## Status: Accepted

## Date: 2026-03-31

## Context

After code is modernized and content is transferred, the modified code needs to be deployed to AEMaaCS via Cloud Manager. Currently no Cloud Manager API integration exists. Customers must manually push code to the Cloud Manager Git repo and trigger pipelines themselves.

This manual handoff breaks the automated migration flow and introduces delay and human error risk at the most critical step — deploying to production.

## Decision

### 1. Cloud Manager API client

Create `src/lib/deployment/cloud-manager-client.ts` with a typed wrapper around the Cloud Manager API (https://developer.adobe.com/experience-cloud/cloud-manager/reference/api/):

- `listPrograms()` — `GET /api/programs`
- `listEnvironments(programId)` — `GET /api/program/{programId}/environments`
- `listPipelines(programId)` — `GET /api/program/{programId}/pipelines`
- `triggerPipeline(programId, pipelineId)` — `POST /api/program/{programId}/pipeline/{pipelineId}/execution`
- `getExecution(programId, pipelineId, executionId)` — `GET /api/program/{programId}/pipeline/{pipelineId}/execution/{executionId}`
- `getExecutionStepLogs(programId, pipelineId, executionId, stepId)` — for build/test log retrieval

### 2. Authentication

- Requires Adobe IMS Service Credentials (not Local Dev Token) for API access
- Auth flow: customer provides Client ID, Client Secret, Technical Account ID, IMS Org ID, and private key (PEM)
- Exchange for access token via `POST https://ims-na1.adobelogin.com/ims/exchange/jwt`
- Store credentials encrypted in the migration configuration (never in plain text)
- Add credential setup UI at `src/app/(dashboard)/settings/cloud-manager/page.tsx`

### 3. Deployment API endpoint

Create `POST /api/migrations/[id]/deploy` in `src/app/api/migrations/[id]/deploy/route.ts`:

- Pushes modernized code to Cloud Manager Git repo (using stored Git credentials)
- Triggers the configured deployment pipeline
- Streams pipeline execution progress via SSE (poll CM API every 10 seconds)
- Detects quality gate failures and maps them back to pre-flight findings (ADR-036)
- Returns: `{ executionId: string, status: string, pipelineUrl: string }`

### 4. Pipeline monitoring

- Create `src/lib/deployment/pipeline-monitor.ts` that polls execution status
- Map CM pipeline steps (build, codeQuality, testing, security, approval, deploy) to UI progress indicators
- On quality gate failure: extract specific check results and create new pre-flight findings
- On deployment success: trigger post-migration drift monitoring (ADR-035)

## Consequences

**Positive:**
- Fully automated code deployment from modernization through to AEMaaCS
- Pipeline monitoring gives real-time visibility into deployment progress
- Quality gate failures feed back into the assessment cycle for remediation
- Completes the end-to-end migration automation story

**Negative:**
- Requires Adobe Developer Console project setup by customer (additional onboarding step)
- Service Credentials are more complex to configure than Local Dev Tokens
- Cloud Manager API has rate limits that may affect monitoring frequency
- JWT-based auth is being deprecated by Adobe in favor of OAuth Server-to-Server — implementation must support both

**Estimated effort:** 24-32 hours
