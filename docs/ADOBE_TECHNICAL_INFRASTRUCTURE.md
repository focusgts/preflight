# Adobe Technical Infrastructure, APIs, Data Formats, and Licensing

## Comprehensive Research for Black Hole Migration PRD

**Research Date**: March 2026
**Scope**: All Adobe product APIs, data formats, authentication, licensing, partner ecosystem, release cadence, and cloud infrastructure relevant to migration tooling.

---

## Table of Contents

1. [Adobe APIs](#1-adobe-apis)
2. [Data Formats and Schemas](#2-data-formats-and-schemas)
3. [Authentication and Authorization](#3-authentication-and-authorization)
4. [Adobe Licensing and SKUs](#4-adobe-licensing-and-skus)
5. [Adobe Partner Ecosystem](#5-adobe-partner-ecosystem)
6. [Adobe Release Cadence and Roadmap](#6-adobe-release-cadence-and-roadmap)
7. [Adobe Cloud Infrastructure](#7-adobe-cloud-infrastructure)

---

## 1. Adobe APIs

### 1.1 AEM (Adobe Experience Manager) APIs

#### 1.1.1 Assets HTTP API

**Base Endpoint**: `/api/assets`
**Service Document**: `https://[hostname]:[port]/api.json`

| Operation | Method | Endpoint | Notes |
|-----------|--------|----------|-------|
| List folder contents | GET | `/api/assets/{folderName}.json` | Returns Siren representation |
| Create folder | POST | `/api/assets/{folderName}` | Content-Type: application/json |
| Create asset | POST | `/api/assets/` | **Deprecated** in Cloud Service; use direct binary upload |
| Update asset metadata | PUT | `/api/assets/{folder}/{asset}` | JSON body with properties |
| Create rendition | POST | `/api/assets/{folder}/{asset}/renditions/{name}` | Binary payload |
| Update rendition | PUT | `/api/assets/{folder}/{asset}/renditions/{name}` | Binary payload |
| Add comment | POST | `/api/assets/{folder}/{asset}/comments/*` | message + annotationData params |
| Copy asset/folder | COPY | `/api/assets/{path}` | Headers: X-Destination, X-Depth, X-Overwrite |
| Move asset/folder | MOVE | `/api/assets/{path}` | Headers: X-Destination, X-Depth, X-Overwrite |
| Delete asset/folder | DELETE | `/api/assets/{path}` | No additional headers required |

**Key Details**:
- Metadata namespace mapping: `jcr:title` becomes `dc:title`, `jcr:description` becomes `dc:description`
- Response format: JSON (Siren hypermedia)
- Asset upload via POST is deprecated in AEM as a Cloud Service; direct binary upload APIs are required instead
- Response codes: 200 (OK), 201 (Created), 204 (No Content for copy/move), 404 (Not Found), 409 (Conflict), 412 (Precondition Failed)

**Create Folder Example**:
```bash
curl -X POST https://[host]/api/assets/myFolder \
  -H "Content-Type: application/json" \
  -d '{"class":"assetFolder","properties":{"title":"My Folder"}}'
```

**Update Metadata Example**:
```bash
curl -X PUT https://[host]/api/assets/myfolder/myAsset.png \
  -H "Content-Type: application/json" \
  -d '{"class":"asset","properties":{"dc:title":"My Asset"}}'
```

#### 1.1.2 Content Fragment API

Content Fragments are supported via the Assets HTTP API with Content Fragment-specific extensions:

- **Base path**: `/api/assets` (same as Assets HTTP API)
- **Content Fragment delivery**: Via AEM GraphQL API (preferred) or Assets HTTP API
- Content Fragments expose structured content through custom data models
- Content Fragment Models define the schema for Content Fragment instances
- CRUD operations available through standard Assets HTTP API endpoints with Content Fragment-aware responses

#### 1.1.3 Experience Fragment API

- Experience Fragments are managed through the standard AEM page/content APIs
- Accessible via Sling API endpoints under `/content/experience-fragments/`
- Can be exported as JSON via the Content Services framework
- Export format supports plain HTML, JSON, and custom exporters

#### 1.1.4 AEM GraphQL API

**Persisted Query Endpoints**:

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create persisted query | PUT | `/graphql/persist.json/<config>/<persisted-label>` |
| Update persisted query | POST | `/graphql/persist.json/<config>/<persisted-label>` |
| Execute persisted query | GET | `/graphql/execute.json/<PERSISTENT_PATH>` |

**Query Variables**: Appended with semicolon syntax:
```
/graphql/execute.json/<path>;variable1=value1;variable2=value2
```

**Persist Request Body** (with cache control):
```json
{
  "query": "{ articleList { items { _path title } } }",
  "cache-control": { "max-age": 300 },
  "surrogate-control": { "max-age": 600, "stale-while-revalidate": 1000 }
}
```

**Default Cache TTLs**:

| Setting | Author | Publish |
|---------|--------|---------|
| max-age | 60s | 60s |
| s-maxage | 60s | 7200s |
| stale-while-revalidate | 86400s | 86400s |
| stale-if-error | 86400s | 86400s |

**Cache Control Methods**:
1. Per-query via request body
2. GraphiQL IDE Headers dialog
3. Cloud Manager variables: `graphqlCacheControl`, `graphqlSurrogateControl`, `graphqlStaleWhileRevalidate`, `graphqlStaleIfError`
4. OSGi configuration: "Persisted Query Service Configuration" (publish only)

**Special Character Encoding**: `;` = `%3B`, `=` = `%3D`, `/` = `%2F`

#### 1.1.5 Sling API Endpoints

AEM is built on Apache Sling, which implements REST-oriented content access:

- **Content resolution**: URLs map directly to JCR content nodes
- **Sling selectors/extensions**: Control output format (e.g., `.json`, `.html`, `.xml`)
- **Resource resolution**: `GET /content/mysite/en/page.model.json` returns page content as JSON
- **Sling POST Servlet**: Handles content modification via POST to any resource path
- **Sling Default GET Servlet**: Returns content in requested format
- **Query endpoints**: `/bin/querybuilder.json` for QueryBuilder queries

**Common Sling endpoints**:
```
GET  /content/{path}.json          # JSON representation of node
GET  /content/{path}.infinity.json # Deep JSON tree
POST /content/{path}               # Create/modify content
DELETE /content/{path}             # Delete content
GET  /bin/querybuilder.json        # QueryBuilder search
```

#### 1.1.6 CRXDE / Package Manager API

**Package Manager Endpoints**:

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List packages | GET | `/crx/packmgr/list.jsp` |
| Upload package | POST | `/crx/packmgr/service.jsp` (cmd=upload) |
| Install package | POST | `/crx/packmgr/service.jsp` (cmd=install) |
| Build package | POST | `/crx/packmgr/service.jsp` (cmd=build) |
| Uninstall package | POST | `/crx/packmgr/service.jsp` (cmd=uninstall) |
| Delete package | POST | `/crx/packmgr/service.jsp` (cmd=delete) |
| Download package | GET | `/etc/packages/{group}/{package}.zip` |

**CRXDE Lite**:
- Available at `/crx/de/index.jsp`
- Provides direct view into the JCR repository
- Not available in AEM as a Cloud Service production environments (read-only in development)

#### 1.1.7 Groovy Console

- **URL**: `http://[host]:[port]/etc/groovyconsole.html`
- Scripts can manipulate JCR content, call OSGi services, execute arbitrary code using CQ/Sling/JCR APIs
- Supports scheduled execution (immediate async or Cron-based) via Sling Jobs
- Extension hooks for custom bindings, compilation customizers, metaclasses, star imports
- All script executions are audited
- Installed via CRX Package Manager
- Not officially supported in AEM as a Cloud Service (use alternative tooling)

#### 1.1.8 ACS AEM Commons Tools

**MCP (Managed Controlled Processes)**:
- Bulk Workflow Manager: Execute queries and process results through workflows
- Asset Ingestion Tools: Multiple methods for large-scale asset import
- Data Importer: Import structured data from spreadsheets into JCR
- Page Relocator: Move/rename pages with reference updates
- Tag Creator: Bulk tag creation from spreadsheet data

**Key Migration Tools**:
- Content Package Rewriter: Restructure content packages for Cloud Service compatibility
- Bulk Workflow Manager: Process large sets of content through workflows
- Error Handler: Custom error pages per site/content hierarchy
- Ensure Service User: Declarative service user configuration
- Redirect Manager: URL redirect management

#### 1.1.9 Cloud Manager API

**Base URL**: `https://cloudmanager.adobe.io`

**Required Headers**:
- `Authorization: Bearer {access_token}`
- `x-gw-ims-org-id: {IMS_ORG_ID}`
- `x-api-key: {CLIENT_ID}`

**Programs**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List programs (deprecated) |
| GET | `/api/program/{programId}` | Get program details |
| DELETE | `/api/program/{programId}` | Delete program |

**Environments**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/program/{programId}/environments` | List environments |
| POST | `/api/program/{programId}/environments` | Create/clone environment |
| GET | `/api/program/{programId}/environment/{environmentId}` | Get environment details |
| DELETE | `/api/program/{programId}/environment/{environmentId}` | Delete environment |
| GET | `/api/program/{programId}/environment/{environmentId}/logs` | Get logs |
| GET | `/api/program/{programId}/environment/{environmentId}/logs/download` | Download logs |

**Pipelines**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/program/{programId}/pipelines` | List pipelines |
| GET | `/api/program/{programId}/pipeline/{pipelineId}` | Get pipeline |
| DELETE | `/api/program/{programId}/pipeline/{pipelineId}` | Delete pipeline |
| PATCH | `/api/program/{programId}/pipeline/{pipelineId}` | Update pipeline |
| DELETE | `/api/program/{programId}/pipeline/{pipelineId}/cache` | Invalidate cache |

**Pipeline Executions**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/program/{programId}/pipeline/{pipelineId}/execution` | Current execution |
| PUT | `/api/program/{programId}/pipeline/{pipelineId}/execution` | Start pipeline |
| GET | `/api/program/{programId}/pipeline/{pipelineId}/executions` | Execution history |
| GET | `...execution/{executionId}` | Execution details |
| GET | `...step/{stepId}` | Step state |
| PUT | `...step/{stepId}/advance` | Advance paused step |
| PUT | `...step/{stepId}/cancel` | Cancel step |
| GET | `...step/{stepId}/logs` | Step logs |
| GET | `...step/{stepId}/metrics` | Step metrics |

**Variables**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `...environment/{environmentId}/variables` | List env variables |
| PATCH | `...environment/{environmentId}/variables` | Modify env variables |
| GET | `...pipeline/{pipelineId}/variables` | List pipeline variables |
| PATCH | `...pipeline/{pipelineId}/variables` | Modify pipeline variables |

**Additional Resources**: Repositories, Branches, IP Allowlists, Domains, Domain Mappings, Region Deployments, Restore Points/Executions, RDE Reset.

#### 1.1.10 Content Transfer Tool (CTT)

- **Purpose**: Migrate content from on-premise/AMS AEM to AEM as a Cloud Service
- **Phases**: Extraction (source to cloud storage) and Ingestion (cloud storage to target)
- **Integration**: Works with Cloud Acceleration Manager (CAM)
- **Features**: Differential content top-up (transfer only delta changes), self-service operation, parallel environment ingestion
- **No public REST API**: Operated through AEM author UI and Cloud Manager integration

#### 1.1.11 Asset Compute API

- **Purpose**: Custom asset processing workers for AEM as a Cloud Service
- **Architecture**: Adobe Firefly apps (serverless functions)
- **SDK**: Asset Compute SDK provides data access, eventing, error handling, monitoring
- **Custom Workers**: Call external services, third-party APIs, custom rendition generation
- **Replaces**: Custom DAM Update Asset workflow steps from on-premise AEM

#### 1.1.12 AEM as Cloud Service vs On-Prem API Differences

| Feature | Cloud Service | On-Premise (6.5) |
|---------|--------------|-------------------|
| Asset Upload | Direct binary upload only | Assets HTTP API POST or WebDAV |
| CRXDE Lite | Dev environments only (read-only) | Full access |
| Package Manager | Limited (no mutable content in /apps) | Full access |
| Groovy Console | Not officially supported | Fully available |
| Custom workflows | Asset Compute workers | DAM Update Asset workflow |
| Repository structure | Immutable (/apps) + mutable (content) separated | No separation enforced |
| Deployment | Cloud Manager CI/CD only | Package Manager, CLI, manual |
| GraphQL | Fully supported | Available via add-on |
| OpenAPI-based APIs | New APIs with OAuth | Not available |

---

### 1.2 Adobe Experience Platform (AEP) APIs

**Base URL**: `https://platform.adobe.io`

**Required Headers** (all AEP APIs):
```
Authorization: Bearer {ACCESS_TOKEN}
x-api-key: {API_KEY}
x-gw-ims-org-id: {ORG_ID}
x-sandbox-name: {SANDBOX_NAME}
```

#### 1.2.1 Schema Registry API

**Base Path**: `/data/foundation/schemaregistry`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/schemas` | List custom schemas |
| POST | `/tenant/schemas` | Create schema |
| GET | `/tenant/schemas/{SCHEMA_ID}` | Get schema by ID |
| PUT | `/tenant/schemas/{SCHEMA_ID}` | Replace schema |
| PATCH | `/tenant/schemas/{SCHEMA_ID}` | Update schema |
| DELETE | `/tenant/schemas/{SCHEMA_ID}` | Delete schema |
| GET | `/global/schemas` | List Adobe-defined schemas |
| GET | `/tenant/fieldgroups` | List field groups |
| POST | `/tenant/fieldgroups` | Create field group |
| GET | `/tenant/datatypes` | List data types |
| GET | `/tenant/classes` | List classes |

**Standard Classes**:
- `XDM Individual Profile` (union-based, attribute store)
- `XDM ExperienceEvent` (time-series, immutable event records)

#### 1.2.2 Dataset API (Catalog Service)

**Base Path**: `/data/foundation/catalog`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dataSets` | List datasets |
| POST | `/dataSets` | Create dataset |
| GET | `/dataSets/{DATASET_ID}` | Get dataset |
| PATCH | `/dataSets/{DATASET_ID}` | Update dataset |
| DELETE | `/dataSets/{DATASET_ID}` | Delete dataset |
| GET | `/batches` | List batches |
| GET | `/batches/{BATCH_ID}` | Get batch status |

#### 1.2.3 Batch Ingestion API

**Base Path**: `/data/foundation/import`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/batches` | Create batch |
| PUT | `/batches/{BATCH_ID}/datasets/{DATASET_ID}/files/{FILE_NAME}` | Upload file to batch |
| POST | `/batches/{BATCH_ID}?action=COMPLETE` | Signal batch completion |
| GET | `/batches/{BATCH_ID}` | Check batch status |

**Supported Formats**: Parquet, JSON, CSV
**File Size**: Large files should be uploaded in chunks via multi-part upload

#### 1.2.4 Streaming Ingestion API

**Endpoint**: `https://dcs.adobedc.net/collection/{CONNECTION_ID}`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/collection/{CONNECTION_ID}` | Stream single record |
| POST | `/collection/{CONNECTION_ID}?syncValidation=true` | Stream with synchronous validation |
| POST | `/collection/batch/{CONNECTION_ID}` | Stream batch of records |

**Validation**: Can be synchronous (immediate response) or asynchronous (default)

#### 1.2.5 Flow Service API (Sources)

**Base Path**: `/data/foundation/flowservice`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/connectionSpecs` | List available source connectors |
| POST | `/connections` | Create base connection |
| POST | `/sourceConnections` | Create source connection |
| POST | `/targetConnections` | Create target connection |
| POST | `/flows` | Create dataflow |
| GET | `/flows/{FLOW_ID}` | Get flow details |
| GET | `/runs?property=flowId=={FLOW_ID}` | List flow runs |

#### 1.2.6 Flow Service API (Destinations)

Same base path as Sources with destination-specific connection specs:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/connectionSpecs` | List destination connectors |
| POST | `/connections` | Create destination connection |
| POST | `/flows` | Create activation dataflow |
| POST | `/flows/{FLOW_ID}/action/activate` | Activate audiences |

#### 1.2.7 Identity Service API

**Base Path**: `/data/core/identity`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/idnamespace/identities` | List identity namespaces |
| POST | `/idnamespace/identities` | Create namespace |
| GET | `/idnamespace/identities/{ID}` | Get namespace |
| POST | `/identity/mapping` | Get identity mapping |
| POST | `/identity/cluster/members` | Get cluster members |

#### 1.2.8 Profile Access API

**Base Path**: `/data/core/ups`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/access/entities?schema.name=_xdm.context.profile&entityId={ID}` | Get profile by identity |
| GET | `/access/entities?schema.name=_xdm.context.experienceevent&entityId={ID}` | Get profile events |
| POST | `/access/entities` | Multi-entity access |
| GET | `/config/mergePolicies` | List merge policies |
| POST | `/config/mergePolicies` | Create merge policy |

#### 1.2.9 Segmentation API

**Base Path**: `/data/core/ups`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/segment/definitions` | List segment definitions |
| POST | `/segment/definitions` | Create segment |
| GET | `/segment/definitions/{SEGMENT_ID}` | Get segment |
| PATCH | `/segment/definitions/{SEGMENT_ID}` | Update segment |
| DELETE | `/segment/definitions/{SEGMENT_ID}` | Delete segment |
| POST | `/segment/jobs` | Create segment job (evaluate) |
| GET | `/segment/jobs/{JOB_ID}` | Get job status |
| POST | `/segment/schedules` | Schedule evaluation |

#### 1.2.10 Query Service API

**Base Path**: `/data/foundation/query`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/queries` | Create/execute query |
| GET | `/queries/{QUERY_ID}` | Get query status |
| GET | `/queries` | List queries |
| POST | `/query-templates` | Create template |
| GET | `/schedules` | List scheduled queries |
| POST | `/schedules` | Create schedule |
| PATCH | `/schedules/{SCHEDULE_ID}` | Update schedule |

**Timeout**: Ad hoc queries timeout after 10 minutes.

#### 1.2.11 Privacy Service API

**Base Path**: `https://platform.adobe.io/data/core/privacy`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jobs` | Create privacy job |
| GET | `/jobs` | List privacy jobs |
| GET | `/jobs/{JOB_ID}` | Get job status |
| GET | `/consent/preferences` | Get consent preferences |

**Supported Regulations**: GDPR, CCPA, PDPA, LGPD, NZPA, TIPA (Tennessee), MCDPA (Minnesota), and others.

#### 1.2.12 Sandbox API

**Base Path**: `/data/foundation/sandbox-management`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sandboxes` | List sandboxes |
| POST | `/sandboxes` | Create sandbox |
| GET | `/sandboxes/{SANDBOX_NAME}` | Get sandbox |
| PUT | `/sandboxes/{SANDBOX_NAME}` | Reset sandbox |
| DELETE | `/sandboxes/{SANDBOX_NAME}` | Delete sandbox |
| GET | `/sandboxTypes` | List sandbox types |

#### 1.2.13 Access Control API

**Base Path**: `/data/foundation/access-control`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/acl/effective-policies` | Get effective policies |
| POST | `/acl/effective-policies` | Check permissions |
| GET | `/administration/roles` | List roles (ABAC) |
| POST | `/administration/roles` | Create role |
| GET | `/administration/policies` | List ABAC policies |

#### 1.2.14 Data Hygiene API

**Base Path**: `/data/core/hygiene`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workorder` | Create delete work order |
| GET | `/workorder/{WORK_ORDER_ID}` | Get work order status |
| POST | `/ttl` | Schedule dataset expiration |
| GET | `/ttl` | List dataset expirations |

**Use Cases**: Data cleansing, removing anonymous data, data minimization (NOT for GDPR/privacy compliance -- use Privacy Service for that).

#### 1.2.15 Observability Insights API

**Base Path**: `/data/infrastructure/observability/insights`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics` | View platform metrics |
| GET | `/metrics?metric=timeseries:ingestion.dataset.size` | Specific metric |

#### 1.2.16 Additional AEP APIs

- **Data Prep API**: Map, transform, validate data to/from XDM (`/data/foundation/conversion`)
- **Data Access API**: Access and download ingested dataset files (`/data/foundation/export`)
- **Reactor API**: Manage tags extensions, rules, data elements (`/reactor`)
- **Sensei ML API**: Machine learning engines, models, experiments
- **MTLS Service API**: Retrieve and verify public certificates
- **Policy Service API**: Data governance labels and policies
- **Unified Tags API**: Organize business objects with folders and categories

---

### 1.3 Adobe Analytics APIs

#### 1.3.1 Analytics 2.0 API

**Base URL**: `https://analytics.adobe.io/api/{GLOBAL_COMPANY_ID}`

**Authentication**: OAuth Server-to-Server (JWT deprecated as of June 30, 2025)

**Rate Limits**: 12 requests per 6 seconds; 5 concurrent report requests (baseline); 500,000 monthly report requests per IMS Organization.

**Reporting Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reports` | Run report |
| POST | `/reports/ranked` | Ranked report |
| POST | `/reports/realtime` | Real-time report |

**Segments Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/segments` | List segments |
| POST | `/segments` | Create segment |
| GET | `/segments/{ID}` | Get segment |
| PUT | `/segments/{ID}` | Update segment |
| DELETE | `/segments/{ID}` | Delete segment |
| POST | `/segments/validate` | Validate segment definition |

**Calculated Metrics Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calculatedmetrics` | List calculated metrics |
| POST | `/calculatedmetrics` | Create calculated metric |
| GET | `/calculatedmetrics/{ID}` | Get calculated metric |
| PUT | `/calculatedmetrics/{ID}` | Update calculated metric |
| DELETE | `/calculatedmetrics/{ID}` | Delete calculated metric |
| POST | `/calculatedmetrics/validate` | Validate against report suite |
| GET | `/calculatedmetrics/functions` | List available functions |

**Dimensions & Metrics Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dimensions?rsid={RSID}` | List dimensions for report suite |
| GET | `/dimensions/{DIMENSION_ID}?rsid={RSID}` | Get dimension details |
| GET | `/metrics?rsid={RSID}` | List metrics for report suite |
| GET | `/metrics/{METRIC_ID}?rsid={RSID}` | Get metric details |

**Date Ranges, Report Suites, Users, Tags**: All have corresponding CRUD endpoints.

#### 1.3.2 Classifications API

**API Version**: 2.0 (newer) and 1.4 (legacy, still in use)

**2.0 Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/job/import/json/{dataset_id}` | Import classifications (<50 MB) |
| GET | `/job/export/{dataset_id}` | Export classifications |
| GET | `/job/export/{dataset_id}/file` | Get export file |
| GET | `/datasets` | List classification datasets |
| GET | `/template/{dataset_id}` | Get classification template |

**Important**: Classification importer will be **deprecated on August 31, 2026**. Users should switch to Classification Sets.

#### 1.3.3 Data Feeds API

- **Format**: Tab-delimited (TSV) files with ISO-8859-1 encoding
- **Contents**: `hit_data.tsv` (hit-level data), plus lookup files (browser.tsv, color_depth.tsv, etc.)
- **Column types**: Pre-processing columns and post-processing columns (prefixed with `post_`)
- **Delivery**: FTP, SFTP, Amazon S3, Azure Blob
- **Key columns**: `post_visid_high`/`post_visid_low` (visitor ID), `date_time`, `post_pagename`, `post_evar1-250`, `post_event_list`
- **Management**: Create, update, retrieve, delete feeds via Analytics 2.0 API

#### 1.3.4 Data Warehouse API

- Part of the Analytics 2.0 API suite
- Create, update, retrieve scheduled data warehouse requests
- Supports large-scale data exports with complex segmentation
- Output formats: CSV, Tableau (TDE)

#### 1.3.5 Data Repair API

- Available with **Analytics Ultimate** license only
- Allows programmatic correction of stored data
- **Limit**: 1.2 billion data rows scanned annually
- Used for data cleansing, not routine operations

#### 1.3.6 Livestream API

- Provides partially-processed hit-level data within ~30 seconds of collection
- Real-time streaming data access
- Maximum 3 data stream endpoints per license
- Licensed based on Primary Server Calls

#### 1.3.7 Bulk Data Insertion API (BDIA)

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/aa/collect/v1/events` | Upload batch file |
| GET | `/aa/collect/v1/events/{FILE_ID}` | Check file status |

**File Format**:
- CSV format with specific column requirements
- Each row = one server call
- Required: visitor identifier + timestamp
- Rows ordered chronologically (earliest to latest)
- **Daily limit**: 500 MB (resets at 12:00 AM CST)
- Authentication: OAuth Server-to-Server (JWT support ended January 1, 2025)

---

### 1.4 Adobe Target APIs

#### 1.4.1 Admin API

**Base URL**: `https://mc.adobe.io/{TENANT}/target`

**Authentication**: OAuth Server-to-Server (required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/activities` | List activities |
| POST | `/activities/{type}` | Create activity (AB, XT, AP, MVT) |
| GET | `/activities/{id}` | Get activity |
| PUT | `/activities/{id}` | Update activity |
| DELETE | `/activities/{id}` | Delete activity |
| GET | `/audiences` | List audiences |
| POST | `/audiences` | Create audience |
| GET | `/audiences/{id}` | Get audience |
| PUT | `/audiences/{id}` | Update audience |
| DELETE | `/audiences/{id}` | Delete audience |
| GET | `/offers` | List offers |
| POST | `/offers` | Create offer |
| GET | `/offers/{id}` | Get offer |
| PUT | `/offers/{id}` | Update offer |
| DELETE | `/offers/{id}` | Delete offer |
| GET | `/properties` | List properties |
| GET | `/environments` | List environments |
| GET | `/reports/activities/{id}` | Get activity report |

#### 1.4.2 Delivery API

**Endpoint**: `POST https://{CLIENT_CODE}.tt.omtrdc.net/rest/v1/delivery`

**No authentication required** (designed for edge/client calls).

**Request Body**:
```json
{
  "context": {
    "channel": "web",
    "browser": { "host": "example.com" }
  },
  "execute": {
    "mboxes": [{
      "name": "homepage-hero",
      "index": 0
    }]
  }
}
```

Supports: prefetch, execute, notifications, pageLoad, mboxes, views

#### 1.4.3 Profile API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/profiles/{thirdPartyId}` | Get profile by third-party ID |
| POST | `/v1/profiles/{thirdPartyId}` | Update single profile |
| POST | `/v2/profiles/batchUpdate` | Batch update profiles |

#### 1.4.4 Recommendations API

Part of the Admin API, with additional endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recs/entities` | Get catalog entities |
| POST | `/recs/entities` | Create/update entities |
| DELETE | `/recs/entities` | Delete entities |
| GET | `/recs/criteria` | List criteria |
| POST | `/recs/criteria` | Create criteria |
| GET | `/recs/designs` | List designs |
| GET | `/recs/collections` | List collections |

Also accessible via the Delivery API for server-side recommendation retrieval.

#### 1.4.5 Models API

**Purpose**: Manage blocklists for ML models used in Auto-Target and Automated Personalization.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models/features` | List features used by models |
| GET | `/models/blocklist` | Get blocklist |
| PUT | `/models/blocklist` | Update blocklist |

---

### 1.5 Adobe Campaign APIs

#### 1.5.1 Campaign Standard REST APIs

**Base URL**: `https://mc.adobe.io/{ORGANIZATION}/{CAMPAIGN_INSTANCE}`

**Authentication**: OAuth via Adobe I/O

**Key Resource Endpoints**:

| Resource | Endpoints Available |
|----------|-------------------|
| Profiles | GET/POST/PATCH/DELETE `/profileAndServices/profile` |
| Services (subscriptions) | GET/POST/PATCH `/profileAndServices/service` |
| Organizational units | GET `/profileAndServices/orgUnitBase` |
| Metadata | GET `/profileAndServicesExt/resourceType` |
| Workflows | GET/POST `/workflow/execution` |
| Transactional messages | POST `/transactionalMessages/{EVENT_ID}` |
| Custom resources | GET/POST/PATCH/DELETE `/profileAndServicesExt/{RESOURCE}` |

**Note**: Campaign Standard is being **decommissioned in 2026**. Users should migrate to Campaign v8.

#### 1.5.2 Campaign Classic SOAP APIs

- **Protocol**: SOAP over HTTP
- **WSDL**: Auto-generated based on schema definitions
- **Authentication**: Session token obtained via `xtk:session#Logon`
- **Key Services**:
  - `xtk:session` -- Authentication, session management
  - `xtk:queryDef` -- Data queries
  - `xtk:writer` -- Data writing/updating
  - `nms:delivery` -- Delivery management
  - `nms:recipient` -- Recipient management
  - `xtk:workflow` -- Workflow execution
  - `nms:operation` -- Campaign/operation management

#### 1.5.3 Campaign v8 APIs

Campaign v8 provides **both** REST and SOAP interfaces:

**REST API** (new web UI based):
- Same conceptual model as Campaign Standard REST APIs
- JSON payloads
- OAuth authentication via Adobe IMS
- Designed for Campaign Standard migration compatibility

**SOAP API** (console/server):
- Inherited from Campaign Classic architecture
- Enhanced performance with Snowflake/FFDA architecture
- Full server-side scripting via JavaScript Server Pages (JSP)

#### 1.5.4 Message Center APIs (Transactional Messaging)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/transactionalMessages/{EVENT_ID}` | Trigger transactional event |
| GET | `/transactionalMessages/{EVENT_ID}/{MESSAGE_ID}` | Get message status |

**Payload**: JSON with recipient data, personalization variables, message content overrides.

---

### 1.6 Adobe Journey Optimizer APIs

**Base URL**: `https://platform.adobe.io` (built on AEP)

#### 1.6.1 Journey API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/journey/journeys` | List journeys |
| POST | `/journey/journeys` | Create journey |
| GET | `/journey/journeys/{JOURNEY_ID}` | Get journey |
| POST | `/journey/journeys/{JOURNEY_ID}/action/deploy` | Deploy journey |
| POST | `/journey/journeys/{JOURNEY_ID}/action/stop` | Stop journey |

#### 1.6.2 Offer Decisioning API

**Decisioning API**:
```
POST https://platform.adobe.io/data/core/ode/v1/decisions
```

**Edge Decisioning API**:
```
POST https://edge.adobedc.net/ee/v2/interact
```

**Batch Decisioning API**: Delivers offers to all profiles in an audience in one call.

**Management API Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/offers` | Manage offers |
| GET/POST | `/placements` | Manage placements |
| GET/POST | `/decisions` | Manage decisions |
| GET/POST | `/collections` | Manage collections |
| GET/POST | `/offer-activities` | Manage offer activities |

#### 1.6.3 Message Execution API

- Interactive message execution with campaign schedule management
- Campaign schedule deletion endpoint (available since June 6, 2025)
- Supports event-triggered and scheduled communications

#### 1.6.4 Suppression API

- Quiet hours: Suppress non-critical messages during specific time windows
- Profile-designated time zones
- Global and local configuration options
- Supports both event-triggered and scheduled communications

---

### 1.7 Adobe Commerce APIs

#### 1.7.1 REST API

**Base URL**: `https://{DOMAIN}/rest/V1` or `https://{DOMAIN}/rest/{STORE_CODE}/V1`

**Authentication**: Bearer token (Integration, Admin, Customer tokens)

**Catalog Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List products |
| POST | `/products` | Create product |
| GET | `/products/{sku}` | Get product |
| PUT | `/products/{sku}` | Update product |
| DELETE | `/products/{sku}` | Delete product |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| GET | `/products/{sku}/media` | Get product media |

**Customer Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers/search` | Search customers |
| POST | `/customers` | Create customer |
| GET | `/customers/{id}` | Get customer |
| PUT | `/customers/{id}` | Update customer |
| DELETE | `/customers/{id}` | Delete customer |

**Order Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | List orders |
| GET | `/orders/{id}` | Get order |
| POST | `/orders/{id}/comments` | Add comment |
| POST | `/orders/{id}/cancel` | Cancel order |
| POST | `/order/{id}/invoice` | Create invoice |
| POST | `/order/{id}/ship` | Create shipment |

**Inventory Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/sources` | List sources |
| GET | `/inventory/stocks` | List stocks |
| GET | `/inventory/source-items` | Get source items |
| POST | `/inventory/source-items` | Set source items |

**Async Bulk API**: `POST /async/bulk/V1/{endpoints}` -- Queue operations for background processing.

#### 1.7.2 GraphQL API

**Endpoint**: `POST https://{DOMAIN}/graphql`

**Key Query Types**:
- `products` -- Product catalog search and filtering
- `categories` -- Category tree navigation
- `cart` -- Shopping cart operations
- `customer` -- Customer account operations
- `orders` -- Order history
- `storeConfig` -- Store configuration
- `cmsBlocks` / `cmsPage` -- CMS content

**Separate Schemas**: Core Commerce, B2B Commerce, Catalog Service, Live Search, Recommendations

**Note**: In Adobe Commerce as a Cloud Service, customer/guest REST APIs are being replaced by GraphQL equivalents.

---

### 1.8 Adobe Marketo APIs

#### 1.8.1 REST API

**Base URL**: `https://{MUNCHKIN_ID}.mktorest.com/rest`

**Authentication**: OAuth 2.0 access tokens via `GET /identity/oauth/token?grant_type=client_credentials&client_id={ID}&client_secret={SECRET}`

**Lead/Person Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/leads.json` | Get leads by filter |
| POST | `/v1/leads.json` | Create/update leads |
| POST | `/v1/leads/push.json` | Push lead |
| POST | `/v1/leads/delete.json` | Delete leads |
| GET | `/v1/leads/describe.json` | Describe lead fields |
| POST | `/v1/leads/{id}/merge.json` | Merge leads |

**Activity Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/activities/types.json` | Get activity types |
| GET | `/v1/activities.json` | Get activities |
| GET | `/v1/activities/pagingtoken.json` | Get paging token |

**Program Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/asset/v1/programs.json` | List programs |
| POST | `/asset/v1/programs.json` | Create program |
| GET | `/asset/v1/program/{id}.json` | Get program |
| POST | `/asset/v1/program/{id}.json` | Update program |
| DELETE | `/asset/v1/program/{id}/delete.json` | Delete program |

**Campaign Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rest/v1/campaigns.json` | List campaigns |
| POST | `/rest/v1/campaigns/{id}/trigger.json` | Trigger campaign |
| POST | `/rest/v1/campaigns/{id}/schedule.json` | Schedule campaign |

#### 1.8.2 Bulk Extract API

**Process**: Create Job -> Enqueue -> Poll Status -> Get File

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bulk/v1/leads/export/create.json` | Create lead export job |
| POST | `/bulk/v1/leads/export/{id}/enqueue.json` | Enqueue job |
| GET | `/bulk/v1/leads/export/{id}/status.json` | Get job status |
| GET | `/bulk/v1/leads/export/{id}/file.json` | Get result file |
| POST | `/bulk/v1/activities/export/create.json` | Create activity export job |
| POST | `/bulk/v1/activities/export/{id}/enqueue.json` | Enqueue activity export |
| POST | `/bulk/v1/program/members/export/create.json` | Create program member export |

**Limits**: 500 MB daily export allocation (resets at 12:00 AM CST), 31-day max date range for activities.

#### 1.8.3 Bulk Import API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bulk/v1/leads/import.json` | Import leads (CSV) |
| POST | `/bulk/v1/customobjects/{name}/import.json` | Import custom objects |
| GET | `/bulk/v1/leads/import/{id}/status.json` | Get import status |
| GET | `/bulk/v1/leads/import/{id}/failures.json` | Get failure records |
| GET | `/bulk/v1/leads/import/{id}/warnings.json` | Get warning records |

#### 1.8.4 Asset API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/asset/v1/emails.json` | Manage emails |
| GET/POST | `/asset/v1/landingPages.json` | Manage landing pages |
| GET/POST | `/asset/v1/forms.json` | Manage forms |
| GET/POST | `/asset/v1/snippets.json` | Manage snippets |
| GET/POST | `/asset/v1/tokens.json` | Manage tokens |
| GET/POST | `/asset/v1/files.json` | Manage files |
| GET/POST | `/asset/v1/smartLists.json` | Manage smart lists |

---

### 1.9 Adobe Workfront APIs

#### 1.9.1 REST API

**Base URL**: `https://{DOMAIN}.my.workfront.com/attask/api/v17.0`

**Authentication**: API key or session ID

**Rate Limit**: 3,000 actions per license every 24 hours (Standard features)

**Project Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/proj/search` | Search projects |
| POST | `/proj` | Create project |
| GET | `/proj/{id}` | Get project |
| PUT | `/proj/{id}` | Update project |
| DELETE | `/proj/{id}` | Delete project |

**Task Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/task/search` | Search tasks |
| POST | `/task` | Create task |
| GET | `/task/{id}` | Get task |
| PUT | `/task/{id}` | Update task |
| DELETE | `/task/{id}` | Delete task |

**Issue Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/optask/search` | Search issues |
| POST | `/optask` | Create issue |
| GET | `/optask/{id}` | Get issue |
| PUT | `/optask/{id}` | Update issue |

**Document Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docu/search` | Search documents |
| POST | `/docu` | Upload document |
| GET | `/docu/{id}` | Get document |
| GET | `/docu/{id}/download` | Download document |

**General Pattern**: All Workfront objects follow the same CRUD pattern: `/{objCode}`, `/{objCode}/{id}`, `/{objCode}/search`

#### 1.9.2 Event Subscriptions

**Endpoint**: `POST /attask/eventsubscription/api/v1/subscriptions`

**Payload**:
```json
{
  "objCode": "PROJ",
  "eventType": "UPDATE",
  "url": "https://your-webhook-endpoint.com/callback",
  "authToken": "your-auth-token"
}
```

**Delivery**: Webhook notifications typically delivered within 1 second of data change, always under 5 seconds.

**Supported Event Types**: CREATE, UPDATE, DELETE for all object types.

**Version 2** (after April 10, 2025): New subscriptions automatically use Version 2 format.

**Limits**: 3,000 event subscriptions per license every 24 hours.

#### 1.9.3 Fusion Webhooks

- **Watch Events**: Real-time scenario triggering when objects are added/updated/deleted
- **Custom Webhooks**: Accept incoming HTTP requests from external systems
- **Fusion Operations**: Licensed per 1,000 operations/month (minimum 500, max 500,000/month)
- **Integration**: Connects Workfront with 350+ applications and services

---

## 2. Data Formats and Schemas

### 2.1 XDM (Experience Data Model)

#### 2.1.1 Standard Classes

| Class | Type | Purpose |
|-------|------|---------|
| XDM Individual Profile | Record | Unified representation of a person; attributes and interests |
| XDM ExperienceEvent | Time-series | Immutable factual records of interactions at a point in time |
| XDM Business Account | Record | B2B account data |
| XDM Business Opportunity | Record | B2B opportunity data |
| XDM Business Campaign | Record | B2B campaign data |

#### 2.1.2 Standard Field Groups (Profile)

| Field Group | Description |
|-------------|-------------|
| Demographic Details | Name, birth date, gender, nationality |
| Personal Contact Details | Email, phone, address |
| Work Contact Details | Work email, phone, organization |
| Profile Preferences Details | Communication preferences, time zone |
| Profile Loyalty Details | Loyalty program membership |
| Profile Consents | Marketing consent/preferences |
| Identifiers | External IDs and identity mapping |
| Segment Membership | Audience segment memberships |

#### 2.1.3 Standard Field Groups (ExperienceEvent)

| Field Group | Description |
|-------------|-------------|
| Commerce Details | Cart, order, product list actions |
| Web Details | Page views, web interactions |
| Channel Details | Channel context (web, email, etc.) |
| Environment Details | Browser, OS, screen, ISP |
| Device | Device type, manufacturer, model |
| Application Details | App ID, version, launches |
| Search Details | Search queries and results |
| Advertising Details | Impressions, clicks, ad context |
| Media Details | Media consumption events |
| Adobe Analytics ExperienceEvent Full Extension | Complete Analytics mapping |

#### 2.1.4 Custom Field Groups

- Created via Schema Registry API or UI
- Must belong to `tenant` container (namespace isolation)
- Fields use tenant namespace prefix: `_{TENANT_ID}.fieldName`
- Support all XDM data types: string, integer, number, boolean, date, datetime, array, object, map

#### 2.1.5 Data Types

| Category | Types |
|----------|-------|
| Primitive | String, Long, Integer, Short, Byte, Double, Boolean |
| Date/Time | Date, DateTime, Time |
| Complex | Object, Array, Map |
| Standard | Phone Number, Email Address, Postal Address, Person Name, Currency, Geo, Consent String |

#### 2.1.6 Identity Namespaces

| Namespace | Code | Type |
|-----------|------|------|
| Email | Email | Standard |
| Phone | Phone | Standard |
| ECID | ECID | Adobe Cookie |
| AAID | AAID | Adobe Analytics |
| GAID | GAID | Google Advertising |
| IDFA | IDFA | Apple Advertising |
| Custom | User-defined | Custom |

#### 2.1.7 Schema Evolution and Versioning

- Schemas are immutable once published; only additive changes allowed
- New fields can be added; existing fields cannot be removed or renamed
- Field groups can be added to or removed from schemas
- Union schemas automatically maintained for Profile-enabled schemas
- Relationship descriptors define 1:1 and 1:many relationships between schemas
- `$id` and `meta:altId` used for unique identification

---

### 2.2 Content Package Format (.zip)

#### 2.2.1 Package Structure

```
my-package.zip
  /META-INF/
    /vault/
      config.xml          # Package configuration
      filter.xml          # Workspace filter (what to include/exclude)
      properties.xml      # Package metadata
      nodetypes.cnd       # Custom node type definitions
      privileges.xml      # Custom JCR privileges
      /definition/
        .content.xml      # Definition content
  /jcr_root/
    /content/             # Content nodes (pages, assets, etc.)
    /apps/                # Application code (components, templates)
    /conf/                # Configuration (editable templates, cloud configs)
    /etc/                 # Legacy configuration
    /home/                # User/group definitions
    /oak:index/           # Index definitions
```

#### 2.2.2 filter.xml Syntax

```xml
<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <filter root="/content/mysite">
    <include pattern="/content/mysite/en(/.*)?"/>
    <exclude pattern="/content/mysite/en/secret(/.*)?"/>
  </filter>
  <filter root="/content/dam/mysite" mode="merge"/>
  <filter root="/apps/mysite" mode="replace"/>
</workspaceFilter>
```

**Filter Modes**:
- `replace` (default): Existing content replaced completely
- `merge`: Existing content preserved, only new content added
- `update`: Existing content updated, new content added, nothing deleted

**Property-level Filtering** (FileVault 3.1.28+):
Set `matchProperties="true"` on include/exclude elements to filter properties instead of nodes.

#### 2.2.3 Package Types (Cloud Service)

| Package | Content | Path |
|---------|---------|------|
| `ui.apps` | Immutable code | `/apps`, `/oak:index` |
| `ui.content` | Mutable content | `/content`, `/conf` |
| `all` | Container (embeds both) | N/A |

**Cloud Service Rule**: Packages must contain EITHER all immutable content (/apps) OR all mutable content (not /apps). The CompositeNodeStore mounts /apps and /libs as read-only.

#### 2.2.4 ACL Handling

- ACLs defined in `_rep_policy.xml` files within the content structure
- CUG (Closed User Groups) defined via `rep:cugPolicy` nodes
- Service users defined in OSGi configurations (not in packages for Cloud Service)
- Package install can merge, overwrite, or clear ACLs based on `acHandling` property:
  - `ignore`, `overwrite`, `merge`, `merge_preserve`, `clear`

#### 2.2.5 Package Dependencies

Declared in `properties.xml`:
```xml
<entry key="dependencies">my-group:base-package:1.0</entry>
```
Format: `{group}:{name}:{version}` (optional range: `[1.0,2.0)`)

---

### 2.3 Analytics Data Formats

#### 2.3.1 Data Feed Format

**File**: `hit_data.tsv` (tab-separated values, ISO-8859-1 encoding)

**Structure**: Each row = one server call (hit). Columns selected during feed configuration.

**Key Columns** (with `post_` prefix recommended):

| Column | Description |
|--------|-------------|
| `post_visid_high` / `post_visid_low` | Visitor ID (combined) |
| `date_time` | Timestamp |
| `post_pagename` | Page name |
| `post_evar1` through `post_evar250` | Conversion variables |
| `post_prop1` through `post_prop75` | Traffic variables |
| `post_event_list` | Events triggered |
| `post_product_list` | Products |
| `visit_num` | Visit number |
| `hit_source` | Hit source (1=standard, 5=data insertion, etc.) |
| `geo_city` / `geo_region` / `geo_country` | Geolocation |
| `user_agent` | Browser user agent |
| `ip` | IP address |

**Lookup Files**: `browser.tsv`, `color_depth.tsv`, `column_headers.tsv`, `connection_type.tsv`, `country.tsv`, `event.tsv`, `javascript_version.tsv`, `languages.tsv`, `operating_systems.tsv`, `referrer_type.tsv`, `resolution.tsv`, `search_engines.tsv`

**Delivery**: Compressed (gzip) bundles delivered to FTP/SFTP/S3/Azure

#### 2.3.2 Classification File Format

**Format**: Tab-delimited text file

**Structure**:
```
## SC <report_suite_id>
## type: <classification_type>
Key<tab>Column1<tab>Column2<tab>Column3
value1<tab>class1<tab>class2<tab>class3
value2<tab>class1<tab>class2<tab>class3
```

**Requirements**:
- Header rows start with `##`
- Key column must match the classified variable
- Tab-delimited (not comma)
- UTF-8 encoding supported
- Upload via FTP, browser, or API

#### 2.3.3 Data Warehouse Output Formats

- CSV (default)
- Tableau Data Extract (TDE)
- Supports complex segmentation and breakdown combinations
- Large data volumes (no row limits like workspace)

---

### 2.4 Campaign Data Formats

#### 2.4.1 Recipient Table Schema

**Standard Fields** (`nms:recipient`):

| Field | Type | Description |
|-------|------|-------------|
| iRecipientId | Integer | Primary key |
| sEmail | String | Email address |
| sFirstName | String | First name |
| sLastName | String | Last name |
| tsCreated | DateTime | Creation date |
| tsLastModified | DateTime | Last modified |
| iGender | Integer | Gender (0=unknown, 1=male, 2=female) |
| tsBirthDate | Date | Birth date |
| sAddress1-4 | String | Address lines |
| sCity | String | City |
| sState | String | State/Province |
| sZipCode | String | ZIP/Postal code |
| sCountryCode | String | Country code |
| sPhone | String | Phone number |
| sMobilePhone | String | Mobile phone |

Custom fields added with `us` prefix (e.g., `usMyCustomField`).

#### 2.4.2 Delivery Log Format

| Field | Description |
|-------|-------------|
| iBroadLogId | Primary key |
| iDeliveryId | Delivery reference |
| iRecipientId | Recipient reference |
| tsEvent | Event timestamp |
| iStatus | Status (0=sent, 1=pending, 2=failed, etc.) |
| sAddress | Recipient address |
| iFailureType | Failure category |
| iFailureReason | Failure reason code |

#### 2.4.3 Tracking Log Format

| Field | Description |
|-------|-------------|
| iTrackingLogId | Primary key |
| iDeliveryId | Delivery reference |
| iRecipientId | Recipient reference |
| tsLog | Click/open timestamp |
| iUrlId | URL reference |
| sSourceType | Source type (email, sms, etc.) |
| sUserAgent | Browser user agent |
| sIp | IP address |

#### 2.4.4 Workflow Data Format

- Workflows defined in XML format
- Activities represented as XML nodes with type attributes
- Transitions define data flow between activities
- Can export data as: flat files (CSV/TSV), XML, database tables

---

### 2.5 Commerce Data Formats

#### 2.5.1 Product Import CSV Format

**Required Columns**: `sku`, `product_type`, `attribute_set`

**Common Columns**:

| Column | Type | Description |
|--------|------|-------------|
| sku | String | Unique identifier |
| store_view_code | String | Store view scope |
| attribute_set_code | String | Attribute set name |
| product_type | String | simple, configurable, grouped, bundle, virtual, downloadable |
| name | String | Product name |
| description | Text | Product description |
| short_description | Text | Short description |
| weight | Decimal | Product weight |
| product_online | Integer | 1=enabled, 2=disabled |
| price | Decimal | Product price |
| special_price | Decimal | Sale price |
| qty | Decimal | Stock quantity |
| is_in_stock | Integer | 0=out of stock, 1=in stock |
| categories | String | Pipe-delimited category paths |
| images | String | Image file paths |

**Configurable Product Columns**: `configurable_variations` (sku=X,color=Red|sku=Y,color=Blue)

#### 2.5.2 Customer Import Format

**Required Columns**: `email`, `_website`, `group_id`

| Column | Type | Description |
|--------|------|-------------|
| email | String | Customer email |
| _website | String | Website code |
| _store | String | Store view code |
| group_id | Integer | Customer group ID |
| prefix | String | Name prefix |
| firstname | String | First name |
| lastname | String | Last name |
| dob | Date | Date of birth |
| gender | String | Male/Female/Not Specified |
| taxvat | String | Tax/VAT number |

#### 2.5.3 Order Export Format

- Available via REST API (`GET /V1/orders`) or Admin export
- JSON response format from API
- CSV format from Admin export
- Includes: order items, billing/shipping addresses, payment details, status history

#### 2.5.4 EAV Attribute Structure

Adobe Commerce uses Entity-Attribute-Value (EAV) database design:

| Table | Purpose |
|-------|---------|
| `eav_attribute` | Attribute definitions |
| `eav_entity_type` | Entity types (product, customer, etc.) |
| `catalog_product_entity` | Product entities |
| `catalog_product_entity_varchar` | Varchar attribute values |
| `catalog_product_entity_int` | Integer attribute values |
| `catalog_product_entity_decimal` | Decimal attribute values |
| `catalog_product_entity_text` | Text attribute values |
| `catalog_product_entity_datetime` | DateTime attribute values |

**Flat Tables**: Optional denormalized tables (`catalog_product_flat_*`) for performance.

---

## 3. Authentication and Authorization

### 3.1 Adobe IMS (Identity Management System)

#### 3.1.1 OAuth 2.0 Server-to-Server Credentials (Current Standard)

**Token Endpoint**: `POST https://ims-na1.adobelogin.com/ims/token/v3`

**Request**:
```
grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&scope={SCOPES}
```

**Response**:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86399
}
```

**Key Characteristics**:
- No certificate management required (unlike JWT)
- Client credentials flow
- Token validity: 24 hours
- Scopes determine product access
- Created via Adobe Developer Console

#### 3.1.2 JWT (Service Account) Credentials -- DEPRECATED

**Status**: End of life reached June 30, 2025. No longer functional.

**Timeline**:
- June 3, 2024: No new JWT credentials can be created
- June 30, 2025: JWT credentials stop working
- March 1, 2026: Adobe auto-converts remaining JWT to OAuth (breaking change)
- Certificate refresh impossible after June 30, 2025

**Migration**: Two-step zero-downtime process:
1. Add OAuth Server-to-Server credential to existing project
2. Update application code to use new credential
3. Delete old JWT credential

#### 3.1.3 API Key Management

- API keys (client IDs) created in Adobe Developer Console
- Each project can have multiple credentials
- Product profile assignment controls access scope
- Organization-level admin required for credential creation
- Keys are not secret (used for identification, not authentication)

#### 3.1.4 Product Profile Permissions

- Managed via Adobe Admin Console
- Product profiles link users/services to specific product capabilities
- Granular permissions per product (e.g., Analytics report suite access, AEM environment access)
- Multiple profiles can be assigned to a single credential

### 3.2 AEM Authentication

#### 3.2.1 SAML 2.0 Configuration

**Scope**: AEM Publish and Preview tiers only (NOT Author)

**Configuration**: OSGi configuration in AEM project

**Key Settings**:
- IDP entity ID
- IDP SSO URL
- IDP certificate
- SP entity ID (AEM Publisher URL)
- SP Consumer Service URL
- Attribute mappings (name, email, groups)
- Default redirect URL

**Limitations**:
- Same OSGi runmode for Preview and Publish (cannot have separate SAML configs)
- Use environment-specific config values for differentiation

#### 3.2.2 LDAP/AD Integration (On-Premise Only)

- Apache Jackrabbit Oak LDAP Identity Provider
- External Login Module configuration
- User/group synchronization from LDAP/AD to AEM
- NOT available in AEM as a Cloud Service

#### 3.2.3 IMS Integration (Cloud Service)

- **AEM Author**: Always authenticated via Adobe IMS (SSO through Admin Console)
- User and group management centralized in Adobe Admin Console
- Product profiles control author-tier access
- No local AEM users for author access in Cloud Service

#### 3.2.4 Service Users and System Users

**On-Premise (6.5)**:
- Service users created in `/home/users/system`
- Mapped via Sling Service User Mapper configuration
- Used for OSGi service authentication to JCR

**Cloud Service**:
- Service users defined via `org.apache.sling.serviceusermapping.impl.ServiceUserMapperImpl.amended` OSGi configs
- Ensure Service User (ACS Commons) for declarative setup
- Repository initialization scripts for ACL setup

#### 3.2.5 Token-Based Authentication

**Cloud Service APIs**:
- Local Development Access Token (for development)
- Service Credentials (for production server-to-server)
- OAuth 2.0 PKCE flow (for user-based SPA authentication)

**On-Premise**:
- Token-based login via `/system/sling/login` with encapsulated tokens
- CSRF token required for POST/PUT/DELETE operations

#### 3.2.6 Closed User Groups (CUG)

- Restrict content access to specific user groups
- Configured via `rep:cugPolicy` on content nodes
- Requires CUG authentication handler
- Supported on both on-premise and Cloud Service Publish tier

### 3.3 Adobe Developer Console Setup

**Process**:
1. Access `https://developer.adobe.com/console`
2. Create new project (or use existing)
3. Add desired API (AEM, Analytics, Target, AEP, etc.)
4. Select authentication type (OAuth Server-to-Server recommended)
5. Assign product profiles
6. Generate credentials
7. Note: Client ID, Client Secret, Organization ID, Technical Account ID

**Common Scopes**:
- AEM: `aem.author`, `aem.publish`
- Analytics: `read_organizations`, `additional_info.projectedProductContext`
- Target: `target_sdk`
- AEP: `openid`, `aep_layer`, `session`

---

## 4. Adobe Licensing and SKUs

### 4.1 Experience Cloud Licensing Model

Adobe Experience Cloud uses a product-specific licensing model rather than a unified platform license. Each product has its own metric and pricing:

| Product | Primary License Metric | Pricing Model |
|---------|----------------------|---------------|
| AEM Sites (Cloud) | Content Requests/month | Subscription |
| AEM Assets | User tiers (Power/Collaborator/Limited) | Per base package |
| Analytics | Primary + Secondary Server Calls | Per tier (Select/Prime/Ultimate) |
| Target | Server Calls (impressions) | Per tier |
| Campaign | Active Profiles | Per channel + tier |
| AEP/RTCDP | Person Profiles (thousands) | Per tier (Prime/Ultimate) |
| Marketo | Contact volume | Per tier (7 tiers) |
| Commerce | GMV-based or fixed license | Varies |
| Workfront | Per user/year | Per tier (Select/Prime/Ultimate) |
| Journey Optimizer | Business profiles + channels | Per tier |

### 4.2 AEM Licensing Details

#### 4.2.1 AEM Sites: Cloud Service

- **Metric**: Content Requests per month
- Content Request = 1 HTML Page View OR 5 JSON API calls
- Measured at CDN ingress
- Default CDN (Fastly) included; custom CDN requires auditable reports every 6 months

**Environment Entitlements**:
- 1 Production, 1 Stage, 1 Development, 1 Rapid Development (base)
- Additional environments available as add-ons (200 GB storage each)
- Sandbox environments: 200 GB, 8-hour hibernation, 6-month auto-deletion

**Author Tier Concurrent Users**:
- Up to 20 users (<=5M requests)
- Up to 40 users (>=5M requests)

**Storage**: 1 TB Production/Stage, 200 GB Development/Rapid Development

**SLA**: 99.99% requires BOTH Additional Publish Region and SLA add-ons

#### 4.2.2 AEM Assets Tiers

| Feature | Essentials (Renewal) | Prime | Ultimate | Enterprise (Renewal) |
|---------|---------------------|-------|----------|---------------------|
| Metric | Per user/year | Per base package | Per base package | Per Standard User/year |
| Storage | 1 TB | 2 TB (max 30 TB) | 5 TB | 1-5 TB (user count based) |
| Power Users | N/A | 5 | 15 | N/A |
| Collaborator Users | N/A | 5 | 15 | N/A |
| Limited Users | N/A | 50 | 250 | N/A |
| Light Users | N/A | N/A | N/A | Up to 500 |
| Consumer Users | Up to 100 | N/A | N/A | N/A |
| Content Hub | No | Yes | Yes | Yes (up to 250 users) |
| Adobe Express | No | Yes | Yes | No |
| Brand Portal | No | No | No | Yes (10 TB) |

#### 4.2.3 AEM Forms: Cloud Service

**Two licensing models**:
- **Submissions**: Form Submissions/year (20-40 concurrent users based on volume)
- **Renditions**: Document Renditions/year (20-40 concurrent users based on volume)

Both include: 1 Prod + 1 Stage + 1 Dev + 1 Rapid Dev, 1 TB storage

#### 4.2.4 AEM Add-Ons

| Add-On | Description |
|--------|-------------|
| Additional Publish Region | Up to 3 per program |
| Development Environment | 200 GB storage |
| Sandbox Environment | 200 GB, hibernation after 8 hours |
| Dynamic Media (Enterprise/Prime/Ultimate) | Image/video management and delivery |
| Content Automation | 1M Asset Operations/pack/year |
| Commerce Integration Framework | Headless commerce integration |
| Extended Security | Enhanced security features |
| AEM Screens | Per Player license |
| AEM Guides | Per user license |
| Adobe Learning Manager | Per user or Monthly Active Users |

### 4.3 Analytics Licensing

**Tiers**: Foundation Pack (EOL, no new sales after 1/1/2024), Select, Prime, Ultimate

| Feature | Select | Prime | Ultimate |
|---------|--------|-------|----------|
| Props per Report Suite | 75 | 75 | 75 |
| eVars per Report Suite | 200 | 200 | 250 |
| Events per Report Suite | 1,000 | 1,000 | 1,000 |
| Processing Rules | 150 | 150 | 150 |
| API Rate Limit | 12 req/6 sec | 12 req/6 sec | 12 req/6 sec |
| Concurrent Reports | 5 | 5 | 5 |
| Monthly Report Requests | 500K/org | 500K/org | 500K/org |
| Customer Attributes | 3 | 15 | 200/RS |
| Contribution Analysis | No | 10 tokens/month | 20 tokens/month |
| Cross-Device Analytics | No | No | 3 RS IDs |
| Data Repair API | No | No | 1.2B rows/year |
| Streaming Media | No | No | 1M starts/month |

**Foundation Pack**: 120M Server Calls/year (capped, no new sales)

**Add-Ons**: Live Stream, Predictive Workbench, Streaming Media (Basic/Advanced), Additional Concurrent Requests, Data Repair API

### 4.4 Target Licensing

- Licensed by Server Calls (impression-based)
- Tiers: Standard, Premium
- Premium includes: Automated Personalization, Auto-Target, Recommendations, Enterprise Permissions, Properties

### 4.5 Campaign Licensing

**Metric**: Active Profiles (attempted communication in past 12 months), charged in increments of 1,000

**Tiers**:
- **Advanced**: Pre-configured, self-service, 24/7 support, quarterly reviews
- **Enterprise**: All Advanced + monthly reviews, health checks, advisory (4 requests/month)

**Channels**: Separately licensed (Email, Push, SMS, Direct Mail, Call Center, Social) or All Channels SKU

**Infrastructure (v8, <2M profiles)**:
- Database: 500 GB (Production + Staging)
- SFTP: 100 GB
- Peak email: 1.5M/hour
- Domain delegations: 8
- IPv4 addresses: 4

### 4.6 AEP / RTCDP Licensing

**Metric**: Per 1,000 Person Profiles

**Profile Richness**: Average <=75 KB per Person Profile
**Total Data Volume**: 75 KB x licensed Consumer Audiences + add-on capacity
**Annual Ingestion**: Limited to 3x licensed Total Data Volume

| Feature | Prime | Ultimate |
|---------|-------|----------|
| Batch Segmentation | 50 annual evaluations | 50 annual evaluations |
| Computed Attributes | 25/sandbox | 50/sandbox |
| Look-Alike Audiences | 5/sandbox | 20/production sandbox |
| Data Export | 500 KB/profile/year | 700 KB/profile/year |
| Advanced Destinations | No | Yes |
| Custom Destinations (SDK) | No | Yes |
| Edge Segmentation | 1,500 events/sec | 1,500 events/sec |
| Streaming Segmentation | 1,500 events/sec | 1,500 events/sec (expandable to 15K) |
| Sandboxes | 5 included | 5 included |
| Collaboration Credits | 2,500 (one-time) | 5,000 (one-time) |
| RTCDP Connections | 500 outgoing calls/profile/year | 500 outgoing calls/profile/year |

**Static Limits**: Ad hoc query 10-min timeout, 1 batch segmentation job/day/sandbox, 3 concurrent merge policies, 52 Customer AI insights/profile/year.

### 4.7 Marketo Licensing

- **Metric**: Contact/database size (volume-based)
- **Tiers**: 7 tiers from Select to Ultimate Performance Plus
- **Email Capacity**: Up to 5M sends/hour at highest tier (as of 2025)
- **Pricing**: Scales with contact volume
- **Features increase by tier**: API limits, smart campaign triggers, custom objects, advanced reporting

### 4.8 Commerce Licensing

- **On-Premise**: Traditional license + support fees
- **Cloud (Managed Services)**: Subscription based on infrastructure and usage
- **Commerce as a Cloud Service**: Newer cloud-native offering
- Pricing factors: GMV (Gross Merchandise Value), order volume, number of stores/websites

### 4.9 Workfront Licensing

**User Types and Pricing**:

| Type | License Metric | API Limit | Storage |
|------|---------------|-----------|---------|
| Standard | Per user/year | 3,000 actions/24hr/license | 30 GB/license |
| Light | Per user/year | Reduced | Included |
| Contributor | Per user/year | Minimal | Included |
| External | Free (view-only) | None | None |

**Package Tiers**:
- **Select**: Standard features only
- **Prime**: + Advanced enterprise controls, portfolio planning, environment promotion, unlimited APIs
- **Ultimate**: + Data Connect (150 compute hours/month), business rules

**Fusion**: Per 1,000 operations/month (minimum 500, up to 500,000/month)

**Auto-Upgrade**: Contributors exceeding decision cap automatically upgraded to Light for contract term.

---

## 5. Adobe Partner Ecosystem

### 5.1 Partner Program Evolution

**Current State (until March 1, 2026)**:
- Solution Partner Program (services/consulting)
- Technology Partner Program (integrations/products)

**New Program (launching March 1, 2026)**:
- **Adobe Digital Experience Partner Program** -- unified single program
- Single entry point, unified onboarding, common agreement structure
- Partners recognized across building integrations, delivering services, and co-selling
- **Partner Experience Hub**: New digital front door with personalized navigation

### 5.2 Solution Partner Tiers

| Tier | Requirements | Benefits |
|------|-------------|----------|
| Registered | Basic enrollment | Foundational resources, training |
| Bronze | Certifications + revenue threshold | Co-marketing, partner directory listing |
| Silver | Higher certifications + revenue | Enhanced support, lead sharing |
| Gold | Significant certifications + revenue | Priority support, joint go-to-market |
| Platinum | Highest certifications + revenue | Executive sponsorship, strategic alignment |

### 5.3 Technology Partner Program

- Build and market integrations extending Adobe product capabilities
- Exchange Marketplace listing with differentiated badges
- Partner Integration Team access for building integrations
- Technology partner integrations visible in redesigned Partner Directory

### 5.4 Adobe Exchange Marketplace

- Public marketplace for partner-built integrations
- Categories: AEM, Analytics, Campaign, Commerce, AEP, Workfront
- Listing types: Apps, Connectors, Templates, Plugins
- Review and certification process required for listing

### 5.5 Common Partner Tools for Migration

| Tool/Service | Partner | Use Case |
|-------------|---------|----------|
| Content Migration Accelerator | Various SIs | AEM content migration |
| Cloud Readiness Assessment | Adobe/Partners | AEM on-prem to Cloud evaluation |
| Tag Migration Assistant | Tealium, Ensighten | Analytics tag migration |
| Data Migration Framework | Various | AEP data onboarding |
| Campaign Migration Toolkit | Various | Campaign Standard to v8 |

### 5.6 System Integrator Landscape

**Major Adobe System Integrators**:

| SI | Specialization | Scale |
|----|---------------|-------|
| Accenture | Full Experience Cloud | Global, largest Adobe practice |
| Deloitte Digital | AEM, AEP, Analytics | Global |
| Publicis Sapient | AEM, Commerce, AEP | Global |
| Cognizant | AEM, Analytics, Campaign | Global |
| Infosys | AEM, Commerce | Global |
| Wipro | Full stack | Global |
| TCS (Tata) | AEM, Analytics | Global |
| IBM/Apptio | AEM, Analytics | Global |
| Avanade | AEM (Microsoft partnership synergy) | Global |
| Bounteous | AEM, AEP, Analytics | US-focused |
| Perficient | AEM, Analytics, Commerce | US-focused |
| ICF Next | AEM, Analytics | US-focused |

### 5.7 Adobe Professional Services

- **Adobe Consulting**: Direct professional services for implementation and migration
- **Customer Success Management**: Ongoing advisory and health checks
- **Adobe Learning/Training**: Certification and enablement programs
- **Cloud Acceleration Manager (CAM)**: Self-service migration planning for AEM Cloud Service
- **Best Practice Analyzer (BPA)**: Automated assessment for AEM migration readiness

---

## 6. Adobe Release Cadence and Roadmap

### 6.1 AEM Cloud Service: Continuous Delivery

- **Cadence**: Monthly feature releases
- **Format**: `{YEAR}.{MONTH}.0` (e.g., 2026.2.0)
- **Delivery**: Automatic, no customer action required
- **Maintenance releases**: More frequent (weekly/bi-weekly)
- **Prerelease channel**: Available for early access to upcoming features
- **Recent releases**: 2025.12.0 (December 2025), 2026.1.0 (January 2026), 2026.2.0 (February 2026)

### 6.2 AEM 6.5: Service Pack Schedule

- **Cadence**: Quarterly service packs
- **Format**: AEM 6.5 Service Pack {N} (e.g., SP24)
- **Latest**: SP24 released January 2026
- **LTS Version**: AEM 6.5 LTS released March 2025 with extended support

### 6.3 AEM 6.5 End-of-Life Timeline

| Customer Type | Support End Date |
|--------------|-----------------|
| Adobe Managed Service | August 31, 2026 |
| On-Premise | February 2027 (planned) |

### 6.4 Analytics Release Cadence

- Continuous feature releases (no fixed schedule)
- Monthly release notes published on Experience League
- API changes communicated via developer documentation updates
- Major version changes (e.g., 1.4 to 2.0) communicated well in advance

### 6.5 AEP Feature Release Cadence

- **Cadence**: Monthly release notes (documenting continuous delivery)
- **Format**: Monthly roundup of all changes
- **Communication**: Experience League release notes page
- Recent notable: June 2025 release included Privacy Service regulation updates

### 6.6 Product Deprecation Timeline

| Product | Status | Key Dates |
|---------|--------|-----------|
| **AEM 6.5 (AMS)** | Active, approaching EOL | Support ends August 31, 2026 |
| **AEM 6.5 (On-Prem)** | Active, approaching EOL | Core support ends ~February 2027 |
| **Campaign Standard** | Being decommissioned | Sunset in 2026 |
| **Campaign Classic v7** | Being decommissioned | Support ends March 31, 2027 |
| **Audience Manager** | No official sunset date announced | Migration to RTCDP encouraged |
| **Analytics Foundation Pack** | EOL for new sales | No new sales after January 1, 2024 |
| **JWT Credentials** | Fully deprecated | Stopped working June 30, 2025; auto-convert by March 1, 2026 |
| **Classification Importer** | Approaching EOL | Deprecated August 31, 2026 |
| **Device Co-op** | Discontinued | Already sunset |
| **DTM (Dynamic Tag Manager)** | Discontinued | Replaced by Launch/Tags |

### 6.7 Announced Upcoming Features Relevant to Migration

- **AEM OpenAPI-based APIs**: New OAuth-authenticated APIs for Cloud Service
- **AEM Edge Delivery Services**: Expanding content delivery capabilities
- **AEP Federated Audience Composition**: Query external databases without data movement
- **Journey Optimizer Quiet Hours**: Intelligent message suppression (roadmap)
- **Campaign v8 Web UI**: Enhanced web-based interface for Campaign Standard migrants
- **Commerce as a Cloud Service**: New cloud-native commerce offering
- **AEM Content Hub**: Centralized content management across Assets tiers

---

## 7. Adobe Cloud Infrastructure

### 7.1 Adobe Managed Services (AMS)

- **Provider**: Adobe-operated infrastructure
- **AEM deployment**: Dedicated environments with managed hosting
- **Support**: 24/7 operations, patching, monitoring
- **Scaling**: Vertical scaling (instance size), manual horizontal scaling
- **Environments**: Production, Stage, Development
- **Access**: SSH access to instances, Dispatcher configuration management
- **Expiring**: AMS for AEM 6.5 ends August 31, 2026

### 7.2 AEM Cloud Service Infrastructure

- **Cloud Provider**: Microsoft Azure
- **Architecture**: Cloud-native, container-based, auto-scaling
- **CDN**: Fastly (mandatory, always included)
- **Tiers**: Author tier + Publish tier + Preview tier + Dispatcher
- **Deployment**: CI/CD via Cloud Manager only (no direct deployment)

**Architecture Components**:

```
[User Request]
    |
[Fastly CDN] -- Edge caching, WAF, traffic management
    |
[Apache Dispatcher] -- Content caching, request filtering
    |
[AEM Publish Tier] -- Content serving (auto-scaled)
    |
[AEM Author Tier] -- Content authoring (up to 20-40 concurrent users)
    |
[AEM Preview Tier] -- QA before publishing (single node)
```

### 7.3 CDN Configuration (Fastly)

- **Included by default**: Cannot be removed or bypassed
- **Custom CDN**: Allowed as layer on top of Adobe CDN (customer must provide audit reports every 6 months)
- **Caching**: Configurable cache rules via Dispatcher configuration
- **WAF**: Web Application Firewall included
- **Edge Delivery**: 1 TB storage limit for Edge Delivery Services
- **Configuration**: CDN rules, traffic filter rules, request/response transformations managed via Cloud Manager

### 7.4 Dispatcher in Cloud vs On-Prem

| Feature | Cloud Service | On-Premise |
|---------|--------------|------------|
| Configuration | Git-based, deployed via Cloud Manager | File-based, managed directly |
| Validation | Automated validation in CI/CD pipeline | Manual |
| Immutable files | Many files are immutable (cannot modify) | All files modifiable |
| Cache invalidation | Automatic via Sling Content Distribution | Manual or automated via replication agents |
| Farm configuration | Simplified, standardized | Fully customizable |
| Fastly integration | Mandatory layer in front | Optional/separate |
| Rewrites | Supported via Cloud Manager config | Standard Apache rewrites |

### 7.5 Auto-Scaling in Cloud Service

- **Publish Tier**: Automatically scales based on traffic
- **Author Tier**: Does NOT auto-scale (fixed capacity based on license tier)
- **Scaling triggers**: Traffic patterns, content delivery load
- **Author concurrent limits**: 20 users (<=5M requests) or 40 users (>=5M requests)
- **Publish nodes**: Multiple nodes in auto-scaled cluster
- **Content Distribution**: Sling Content Distribution (not traditional replication)

### 7.6 Environment Types and Limits

| Environment | Storage (Prod/Stage) | Storage (Dev) | Purpose |
|-------------|---------------------|---------------|---------|
| Production | 1 TB | N/A | Live content serving |
| Stage | 1 TB (shared with Prod) | N/A | Pre-production testing |
| Development | N/A | 200 GB | Active development |
| Rapid Development (RDE) | N/A | 200 GB | Fast iteration (no pipeline) |
| Sandbox | N/A | 200 GB | Testing (8hr hibernation, 6mo auto-delete) |
| Specialized Testing | N/A | 200 GB | 1 per program max |

**Base Entitlement**: 1 Prod + 1 Stage + 1 Dev + 1 RDE
**Additional**: Purchasable as add-ons

### 7.7 Logging and Monitoring

**Cloud Manager**:
- Pipeline execution logs
- Environment logs (author, publish, dispatcher)
- Log download via API: `GET /api/program/{programId}/environment/{environmentId}/logs/download`
- Log types: `aemerror`, `aemaccess`, `aemrequest`, `aemdispatcher`, `httpdaccess`, `httpderror`

**Splunk Integration**:
- Cloud Manager supports log forwarding to customer Splunk instances
- Configuration via Cloud Manager UI or API
- Supports all AEM log types
- HEC (HTTP Event Collector) integration

**Adobe-Managed Monitoring**:
- New Relic APM (included for Cloud Service)
- Cloud Manager alerts and notifications
- Custom health checks via Sling Health Check framework
- Content Distribution monitoring

---

## Appendix: Key Documentation URLs

### Official API Reference Portals
- AEM APIs: https://developer.adobe.com/experience-cloud/experience-manager-apis/
- AEP APIs: https://developer.adobe.com/experience-platform-apis/
- Analytics APIs: https://developer.adobe.com/analytics-apis/docs/2.0/
- Target APIs: https://developer.adobe.com/target/administer/admin-api/
- Commerce APIs: https://developer.adobe.com/commerce/webapi/
- Marketo APIs: https://developer.adobe.com/marketo-apis/
- Workfront APIs: https://developer.adobe.com/workfront-apis/
- Cloud Manager API: https://developer.adobe.com/experience-cloud/cloud-manager/reference/api/
- Journey Optimizer APIs: https://developer.adobe.com/journey-optimizer-apis/

### Adobe Legal Product Descriptions
- AEM Cloud Service: https://helpx.adobe.com/legal/product-descriptions/aem-cloud-service.html
- Analytics: https://helpx.adobe.com/legal/product-descriptions/adobe-analytics.html
- Campaign MCS: https://helpx.adobe.com/legal/product-descriptions/adobe-campaign-managed-cloud-services.html
- RTCDP: https://helpx.adobe.com/legal/product-descriptions/real-time-customer-data-platform-b2c-edition-prime-and-ultimate-packages.html
- Workfront: https://helpx.adobe.com/legal/product-descriptions/adobe-workfront.html
- All Product Terms: https://www.adobe.com/legal/terms/enterprise-licensing/all-product-terms.html

### Authentication & Developer Console
- Developer Console: https://developer.adobe.com/console
- OAuth Migration Guide: https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/migration
- JWT Deprecation: https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/jwt-credentials-deprecation-in-adobe-developer-console

### Migration Resources
- AEM Cloud Migration: https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/migration/content-transfer-tool
- Campaign Standard to v8: https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/new/acs-to-v8
- Audience Manager to RTCDP: https://experienceleague.adobe.com/en/docs/experience-platform/rtcdp/evolution/aam-to-rtcdp
- ACS AEM Commons: https://adobe-consulting-services.github.io/acs-aem-commons/

### Product Roadmaps and Release Notes
- AEM Release Roadmap: https://experienceleague.adobe.com/en/docs/experience-manager-release-information/aem-release-updates/update-releases-roadmap
- AEM Cloud Service Release Notes: https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/home
- AEP Release Notes: https://experienceleague.adobe.com/en/docs/experience-platform/release-notes/latest
- EOL Matrix: https://helpx.adobe.com/support/programs/eol-matrix.html

---

## Sources

- [Assets HTTP API - Adobe Experience Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/admin/mac-api-assets)
- [AEM GraphQL API for Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/content-fragments)
- [Persisted GraphQL Queries](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries)
- [Cloud Manager API Spec](https://developer.adobe.com/experience-cloud/cloud-manager/reference/api/)
- [Adobe Experience Platform APIs](https://developer.adobe.com/experience-platform-apis/)
- [Batch Ingestion API Overview](https://experienceleague.adobe.com/en/docs/experience-platform/ingestion/batch/overview)
- [Streaming Ingestion API](https://experienceleague.adobe.com/en/docs/experience-platform/ingestion/tutorials/streaming-record-data)
- [XDM System Overview](https://experienceleague.adobe.com/en/docs/experience-platform/xdm/home)
- [Schema Composition Basics](https://experienceleague.adobe.com/docs/experience-platform/xdm/schema/composition.html)
- [Adobe Analytics 2.0 APIs](https://developer.adobe.com/analytics-apis/docs/2.0/)
- [Analytics Data Feed Contents](https://experienceleague.adobe.com/en/docs/analytics/export/analytics-data-feed/data-feed-contents/datafeeds-contents)
- [Data Column Reference](https://experienceleague.adobe.com/en/docs/analytics/export/analytics-data-feed/data-feed-contents/datafeeds-reference)
- [Analytics Classifications API](https://developer.adobe.com/analytics-apis/docs/2.0/guides/endpoints/classifications/)
- [Bulk Data Insertion API](https://developer.adobe.com/analytics-apis/docs/2.0/guides/endpoints/bulk-data-insertion/)
- [Adobe Target API Overview](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/target-api-overview)
- [Target Admin API](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/admin-api/admin-api-overview)
- [Target Delivery API](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/delivery-api/overview)
- [Target Recommendations API](https://developer.adobe.com/target/administer/recommendations-api/)
- [Target Models API](https://experienceleague.adobe.com/en/docs/target-dev/developer/api/models-api/models-api)
- [Campaign Standard APIs](https://experienceleague.adobe.com/en/docs/campaign-standard/using/working-with-apis/get-started-apis)
- [Campaign v8 APIs](https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/developer/apis/get-started-apis)
- [Campaign API Documentation](https://experienceleague.adobe.com/developer/campaign-api/api/index.html)
- [Journey Optimizer APIs](https://developer.adobe.com/journey-optimizer-apis/)
- [Offer Decisioning API](https://experienceleague.adobe.com/en/docs/journey-optimizer/using/decisioning/offer-decisioning/api-reference/offer-delivery-api/decisioning-api)
- [Adobe Commerce REST API](https://developer.adobe.com/commerce/webapi/rest/)
- [Adobe Commerce GraphQL API](https://developer.adobe.com/commerce/webapi/graphql/)
- [Marketo REST API](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/rest-api)
- [Marketo Bulk Extract](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/bulk-extract/bulk-extract)
- [Marketo Bulk Import](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/bulk-import/bulk-import)
- [Marketo Endpoint Reference](https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/endpoint-reference)
- [Workfront API Overview](https://developer.adobe.com/workfront-apis/)
- [Workfront Event Subscriptions](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-api/event-subscriptions/event-subs-api)
- [Workfront Document Webhooks](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-api/document-webhooks-api/docu-webhook-api)
- [OAuth Server-to-Server Migration](https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/migration)
- [JWT Credentials Deprecation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/jwt-credentials-deprecation-in-adobe-developer-console)
- [SAML 2.0 on AEM Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/authentication/saml-2-0)
- [AEM Authentication Overview](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/authentication/authentication)
- [AEM Cloud Service Product Description](https://helpx.adobe.com/legal/product-descriptions/aem-cloud-service.html)
- [Adobe Analytics Product Description](https://helpx.adobe.com/legal/product-descriptions/adobe-analytics.html)
- [Adobe Campaign MCS Product Description](https://helpx.adobe.com/legal/product-descriptions/adobe-campaign-managed-cloud-services.html)
- [RTCDP Product Description](https://helpx.adobe.com/legal/product-descriptions/real-time-customer-data-platform-b2c-edition-prime-and-ultimate-packages.html)
- [Adobe Workfront Product Description](https://helpx.adobe.com/legal/product-descriptions/adobe-workfront.html)
- [Privacy Service Overview](https://experienceleague.adobe.com/en/docs/experience-platform/privacy/home)
- [Data Hygiene API](https://experienceleague.adobe.com/en/docs/experience-platform/data-lifecycle/api/overview)
- [Identity Service API](https://experienceleague.adobe.com/en/docs/experience-platform/identity/api/getting-started)
- [Sandbox API](https://experienceleague.adobe.com/en/docs/experience-platform/sandbox/api/getting-started)
- [Access Control API](https://experienceleague.adobe.com/en/docs/experience-platform/access-control/api/getting-started)
- [Query Service API](https://experienceleague.adobe.com/en/docs/experience-platform/query/api/getting-started)
- [Flow Service API - Sources](https://developer.adobe.com/experience-platform-apis/references/flow-service/)
- [Flow Service API - Destinations](https://developer.adobe.com/experience-platform-apis/references/destinations/)
- [CDN in AEM Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn)
- [AEM Cloud Service Architecture](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/overview/architecture.html)
- [AEM Release Roadmap](https://experienceleague.adobe.com/en/docs/experience-manager-release-information/aem-release-updates/update-releases-roadmap)
- [Campaign Standard Release Planning](https://experienceleague.adobe.com/en/docs/campaign-standard/using/release-notes/release-planning)
- [Campaign Standard to v8 Transition](https://experienceleague.adobe.com/en/docs/campaign/campaign-v8/new/acs-to-v8)
- [Audience Manager to RTCDP Evolution](https://experienceleague.adobe.com/en/docs/experience-platform/rtcdp/evolution/aam-to-rtcdp)
- [Adobe Partner Programs](https://www.adobe.com/partners.html)
- [New Era for Adobe Partners (March 2026)](https://solutionpartners.adobe.com/content/solution/us/en/solution-partners/news/2025/11/new-era-for-partners.html)
- [ACS AEM Commons](https://adobe-consulting-services.github.io/acs-aem-commons/)
- [AEM Groovy Console](https://github.com/orbinson/aem-groovy-console)
- [Content Transfer Tool](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/migration/content-transfer-tool)
- [Workfront License Overview](https://experienceleague.adobe.com/en/docs/workfront/using/administration-and-setup/add-users/access-levels/licenses-overview)
- [Adobe EOL Matrix](https://helpx.adobe.com/support/programs/eol-matrix.html)
