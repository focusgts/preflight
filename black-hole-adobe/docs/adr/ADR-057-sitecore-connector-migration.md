# ADR-057: Sitecore Connector & Migration Engine

## Status: Proposed

## Date: 2026-03-31

## Context

Sitecore to AEM is a high-value migration path. Sitecore licenses are expensive and customers are motivated to switch, especially as Sitecore pushes toward XM Cloud with different pricing and architecture. Black Hole has a MAC template and schema mapping for this path but no Sitecore connectivity or transformation code.

Sitecore-to-AEM migrations typically involve enterprise customers with large content repositories, complex personalization rules, and multi-language sites. These are high-value deals that justify the implementation effort.

## Decision

### 1. Sitecore connector

Create `src/lib/connectors/sitecore-connector.ts`:

- Connect via Sitecore Item Web API (`/sitecore/api/ssc/item/`) for Sitecore 8.x-10.x
- Connect via Sitecore GraphQL API (`/sitecore/api/graph/items/`) for Sitecore 10.x+
- Connect via Sitecore Experience Edge GraphQL for XM Cloud
- Extract content: items, templates, media library, layout definitions, placeholder settings
- Extract rendering configurations: controller renderings, view renderings, JSON renderings
- Extract personalization rules: conditions, content variants, A/B test configurations
- Support authentication: API key auth, SSC (Sitecore Services Client) cookie auth, OAuth for XM Cloud
- Handle Sitecore's tree structure: walk the content tree from `/sitecore/content/` downward
- Respect Sitecore security: only extract items the authenticated user can read
- Handle versioned items (Sitecore stores all language versions on the same item)

### 2. Sitecore-to-AEM transformer

Create `src/lib/migration/sitecore-transformer.ts`:

- Map Sitecore templates to AEM page templates:
  - Sitecore template fields -> AEM dialog fields
  - Sitecore standard values -> AEM template policies
  - Sitecore insert options -> AEM allowed components
- Map Sitecore renderings to AEM components:
  - Controller renderings -> AEM Sling Models + HTL components
  - View renderings -> AEM HTL templates
  - Rendering parameters -> AEM component dialog fields
- Convert Sitecore field types to AEM JCR property types:
  - Single-Line Text -> `String`
  - Rich Text -> `String` (with `sling:resourceType` for RTE)
  - Image -> DAM asset reference
  - Treelist / Multilist -> `String[]` (path references)
  - Droplink / Droptree -> `String` (path reference)
  - Date / Datetime -> `Date`
  - Checkbox -> `Boolean`
  - General Link -> `String` (JSON link object)
- Map Sitecore media library (`/sitecore/media library/`) to AEM DAM (`/content/dam/`)
- Convert Sitecore personalization rules to AEM ContextHub segments and Target offers:
  - Sitecore rules engine conditions -> ContextHub segment expressions
  - Sitecore content variants -> AEM Experience Fragment variations
- Handle multi-language: Sitecore versioned items -> AEM language copies (`/content/{site}/en/`, `/content/{site}/fr/`, etc.)

### 3. API endpoint

Create `POST /api/migrations/[id]/sitecore/extract` in `src/app/api/migrations/[id]/sitecore/extract/route.ts`:

- Accepts: `{ sitecoreUrl: string, auth: { type: 'apikey' | 'ssc' | 'oauth', credentials: object }, sitecoreVersion: '8.x' | '9.x' | '10.x' | 'xm-cloud', rootPath: string }`
- Returns: extraction progress via SSE, final summary with template counts, item counts, media counts, language counts

### 4. Version detection

- Auto-detect Sitecore version by probing known endpoints (`/sitecore/shell/sitecore.version.xml`)
- Select appropriate API connector based on detected version
- Warn user if detected version differs from specified version

## Consequences

**Positive:**
- High-value deals ($500K+ per migration) justify the implementation investment
- Sitecore's structured data model (templates, fields, renderings) maps more cleanly to AEM than unstructured CMS content
- Multi-language support is a natural fit since both Sitecore and AEM have first-class i18n
- Personalization rule migration differentiates Black Hole from manual migration approaches

**Negative:**
- Sitecore API access varies significantly by version (7.x vs 8.x vs 9.x vs 10.x vs XM Cloud) — five different connector paths
- XM Cloud has fundamentally different APIs than on-prem Sitecore — the Experience Edge GraphQL schema differs from the Item Web API
- Sitecore personalization rules use a custom rules engine that does not map 1:1 to AEM ContextHub — some rules will require manual recreation
- Custom Sitecore modules (EXM, SXA, JSS) add additional extraction complexity not covered in this initial implementation

**Estimated effort:** 100-140 hours
