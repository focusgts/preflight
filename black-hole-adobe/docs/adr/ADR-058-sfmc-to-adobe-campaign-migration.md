# ADR-058: SFMC to Adobe Campaign Migration Engine

## Status: Proposed

## Date: 2026-03-31

## Context

Salesforce Marketing Cloud (SFMC) to Adobe Campaign is driven by customers consolidating on the Adobe stack after adopting AEM, AEP, or other Adobe products. Black Hole has a schema mapping and assessment findings for this path but no SFMC connector or transformation logic.

SFMC-to-Adobe-Campaign migrations involve email templates, data schemas, automation workflows, and subscriber data — a fundamentally different artifact set from content migrations.

## Decision

### 1. SFMC connector

Create `src/lib/connectors/sfmc-connector.ts`:

- Authenticate via SFMC REST API using OAuth 2.0 client credentials (`POST /v2/token` on `{subdomain}.auth.marketingcloudapis.com`)
- Extract data extensions: schema definitions (field names, types, keys) and row data via `/data/v1/customobjectdata/key/{key}/rowset`
- Extract email templates: HTML content, subject lines, preheader text via `/asset/v1/content/assets`
- Extract content blocks: reusable content fragments via `/asset/v1/content/assets?$filter=assetType.name=block`
- Extract automations: automation definitions, steps, schedules via `/automation/v1/automations`
- Extract journeys: journey definitions, entry sources, activities, wait steps via `/interaction/v1/interactions`
- Extract sender profiles: from name, from email, reply-to via `/messaging/v1/senderProfiles`
- Extract subscriber lists and data filter definitions
- Support package-based export for large data extensions (> 1M rows): trigger data extract activity, download from SFTP
- Handle SFMC business unit hierarchy: enumerate BUs and extract per-BU

### 2. SFMC-to-Adobe-Campaign transformer

Create `src/lib/migration/sfmc-to-campaign-transformer.ts`:

- Convert AMPscript in email templates to Adobe Campaign personalization syntax:
  - `%%=v(@variable)=%%` -> `<%= vars.variable %>`
  - `%%=Lookup("DE","Field","Key","Value")=%%` -> `<%= targetData.field %>`
  - `%%=IIF(condition, true, false)=%%` -> `<% if (condition) { %>`
  - `%%=Format(Now(),"MMMM dd, yyyy")=%%` -> `<%= formatDate(new Date(), "MMMM dd, yyyy") %>`
  - Handle nested AMPscript functions via recursive parsing
- Convert SSJS (Server-Side JavaScript) blocks: flag for manual review (SSJS has no direct Campaign equivalent)
- Map data extensions to Campaign schemas/tables:
  - DE fields -> schema `<attribute>` definitions
  - DE primary keys -> schema `<key>` definitions
  - DE relationships -> schema `<join>` definitions
  - Data types: Text -> `string`, Number -> `long`/`double`, Date -> `datetime`, Boolean -> `boolean`, EmailAddress -> `string` with `@type="email"`
- Map SFMC journeys to Campaign workflows:
  - Journey entry source -> workflow `<query>` activity targeting the equivalent schema
  - Wait activities -> workflow `<wait>` activities
  - Email activities -> workflow `<delivery>` activities referencing migrated templates
  - Decision splits -> workflow `<test>` activities with conditions
- Map SFMC automations to Campaign technical workflows:
  - SQL query activities -> Campaign `<queryDef>` activities
  - File transfer activities -> Campaign `<fileTransfer>` activities
  - Data extract activities -> Campaign `<extraction>` activities
- Convert SFMC content blocks to Campaign content fragments

### 3. API endpoint

Create `POST /api/migrations/[id]/sfmc/extract` in `src/app/api/migrations/[id]/sfmc/extract/route.ts`:

- Accepts: `{ sfmcSubdomain: string, clientId: string, clientSecret: string, businessUnitId?: string, options: { includeData: boolean, includeJourneys: boolean, includeAutomations: boolean } }`
- Returns: extraction progress via SSE, final summary with template count, DE count, journey count, automation count

### 4. Output format

- Migrated email templates as HTML files with Campaign personalization syntax
- Campaign schema XML definitions (importable via Campaign package manager)
- Campaign workflow XML definitions
- AMPscript conversion report: list of all AMPscript blocks with conversion status (converted, needs-review, unsupported)
- Data migration SQL scripts for subscriber data import

## Consequences

**Positive:**
- SFMC-to-Adobe is a growing market as customers consolidate on the Adobe stack
- Data extension schema mapping is deterministic and fully automatable
- Journey-to-workflow mapping covers the most common automation patterns
- AMPscript conversion handles the majority of personalization use cases (variable substitution, lookups, conditionals)

**Negative:**
- AMPscript-to-Campaign-personalization is complex and not fully automatable — advanced AMPscript functions (HTTPGet, CreateObject, InvokeExecute) have no Campaign equivalent
- SSJS blocks require manual rewrite in Campaign JavaScript or JSSP
- Template conversion will handle approximately 70% of cases; the remaining 30% (complex dynamic content, interactive email features) require manual review
- SFMC API rate limits (2500 calls/minute for REST) may slow extraction for large accounts
- Subscriber data migration for large lists (10M+) requires SFTP-based bulk export, not API extraction

**Estimated effort:** 80-120 hours
