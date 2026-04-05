# ADR-056: Google Analytics to CJA Migration Engine

## Status: Proposed

## Date: 2026-03-31

## Context

Google Analytics (GA4) to Adobe Customer Journey Analytics (CJA) is a high-demand, lower-complexity migration path. Black Hole has a MAC template, schema mapping, and assessment profile for this path, but no Google Analytics API connector or data transformation logic exists.

Unlike content migrations, analytics migration is primarily a configuration translation problem — the goal is to replicate GA4 measurement configurations in CJA, not to transfer raw event data (which flows through BigQuery and Adobe Experience Platform).

## Decision

### 1. Google Analytics connector

Create `src/lib/connectors/ga-connector.ts`:

- Connect via Google Analytics Admin API and Data API (GA4) using service account credentials (JSON key file)
- Extract property configuration: property name, industry category, time zone, currency
- Extract custom dimensions and custom metrics definitions
- Extract audience definitions (conditions, exclusions, membership duration)
- Extract conversion events and their configuration
- Extract BigQuery link configuration (dataset, export frequency, export type)
- Extract Google Signals and data retention settings
- Use Google API client library (`googleapis` npm package)

### 2. GA4-to-CJA transformer

Create `src/lib/migration/ga-to-cja-transformer.ts`:

- Map GA4 dimensions to CJA data view dimensions using the existing schema mapping in `src/lib/migration/schema-mapping.ts`
- Map GA4 metrics to CJA calculated metrics (formulas, attribution models)
- Map GA4 audiences to CJA filters/segments
- Map GA4 conversion events to CJA success events
- Generate XDM schema definition from GA4 property structure:
  - GA4 event parameters -> XDM custom fields
  - GA4 user properties -> XDM profile fields
  - Standard GA4 events -> XDM standard field groups (web, commerce)
- Generate Adobe Web SDK (`alloy.js`) configuration to replace `gtag.js`:
  - Map GA4 event names to XDM event types
  - Map GA4 custom parameters to XDM data elements
  - Generate tag rules for Adobe Experience Platform Data Collection
- Generate CJA connection configuration (dataset references, backfill settings)
- Generate CJA data view definition (dimensions, metrics, attribution, filters)

### 3. API endpoint

Create `POST /api/migrations/[id]/analytics/extract` in `src/app/api/migrations/[id]/analytics/extract/route.ts`:

- Accepts: `{ serviceAccountKey: object, propertyId: string, options: { includeHistoricalConfig: boolean } }`
- Returns: extraction summary with counts of dimensions, metrics, audiences, conversions

### 4. Output format

- Downloadable configuration package (`GET /api/migrations/[id]/analytics/download`):
  - XDM schema JSON (importable into AEP Schema Registry)
  - Web SDK configuration (Data Collection tag property export)
  - CJA data view definition JSON
  - Migration runbook (step-by-step instructions for manual steps in AEP/CJA)
- Customer applies the configuration package in Adobe Experience Platform — Black Hole does not directly call AEP APIs for this path

## Consequences

**Positive:**
- Analytics migration is largely configuration translation, not data transfer — historical data stays in BigQuery and is ingested into AEP separately
- Output is a deterministic configuration package that can be reviewed before applying
- Lower risk than content migration — no production content is modified
- Reuses existing schema mapping infrastructure

**Negative:**
- Requires Google Cloud service account setup by customer (IAM permissions for Analytics Admin API)
- GA4 custom dimensions/metrics with complex conditions may not have direct CJA equivalents
- Web SDK migration requires tag manager changes that vary by customer setup (GTM, Adobe Launch, custom)
- Historical data backfill from BigQuery to AEP is a separate process not covered by this ADR

**Estimated effort:** 70-100 hours
