# Cross-Platform Migrations to the Adobe Marketing Cloud Ecosystem

## Exhaustive Technical Reference

---

## Table of Contents

1. [Analytics Platform Migrations](#1-analytics-platform-migrations)
2. [Email / Marketing Automation Migrations](#2-email--marketing-automation-migrations)
3. [CMS Migrations to AEM](#3-cms-migrations-to-aem)
4. [CDP / DMP Migrations](#4-cdp--dmp-migrations)
5. [E-Commerce Platform Migrations](#5-e-commerce-platform-migrations)
6. [Project Management Migrations](#6-project-management-migrations)
7. [DAM Migrations](#7-dam-migrations)
8. [Testing / Personalization Migrations](#8-testing--personalization-migrations)
9. [Data Format Mappings](#9-data-format-mappings)
10. [Integration Reconnection](#10-integration-reconnection)

---

## 1. Analytics Platform Migrations

### 1.1 Google Analytics (GA4 / Universal Analytics) to Adobe Analytics

#### Data Model Differences

| Concept | Google Analytics | Adobe Analytics |
|---------|-----------------|-----------------|
| Page-level tracking | Pageview hit | Page View (s.t() call) |
| Interaction tracking | Event | Custom Event (event1-event1000) |
| Session definition | Session (30-min inactivity) | Visit (30-min inactivity, configurable) |
| User identifier | Client ID / User ID | ECID (Experience Cloud ID) |
| Custom dimensions | Custom Dimensions (20 standard / 200 GA360) | eVars (up to 250), Props (up to 75) |
| Custom metrics | Custom Metrics (20 standard / 200 GA360) | Custom Events (up to 1000) |
| Content grouping | Content Groups | Classifications / eVars |
| Attribution | Data-driven / last-click | Attribution IQ (multiple models) |
| Data retention | 14 months (standard) / 50 months (GA360) | Configurable, typically 25 months default |

#### Dimension and Metric Mapping

| Google Analytics Metric/Dimension | Adobe Analytics Equivalent | Notes |
|----------------------------------|---------------------------|-------|
| Sessions | Visits | Conceptually equivalent; timeout rules may differ |
| Users | Unique Visitors | Adobe uses ECID for cross-device |
| Pageviews | Page Views | Direct equivalent |
| Bounce Rate | Bounce Rate (calculated) | Available in Analysis Workspace |
| Pages/Session | Pages/Visit | Calculated metric |
| Avg Session Duration | Time Spent/Visit | Different calculation methodology |
| Events | Success Events (event1-1000) | Must be pre-configured in Admin |
| Custom Dimensions | eVars (conversion) / Props (traffic) | eVars persist; Props are hit-scoped only |
| Custom Metrics | Custom Numeric Events | Requires Admin configuration |
| Source / Medium | Tracking Code (campaign) + eVars | Often mapped to campaign variable + custom eVars |
| Campaign | s.campaign (v0) | Tracking code variable |
| Content Group | Classifications or eVars | Classifications provide hierarchical grouping |
| User ID | Custom Visitor ID (s.visitorID) | Or use ECID via Identity Service |
| Enhanced Ecommerce | Products string (s.products) | Completely different format |

#### Variable Persistence Differences

- **eVars** can expire: per hit, per visit, never, after N days, or after a success event. **GA Custom Dimensions** can only expire after hits, sessions, or never.
- **eVars** support first-touch and last-touch allocation. **GA Custom Dimensions** are always last-touch.
- **Props** are hit-scoped only (no persistence). They support list-delimiting and pathing.
- Adobe supports 250 eVars, 75 Props, and 1000 Events (Premium). GA360 supports 200 custom dimensions.

#### Implementation Swap: gtag.js to Adobe Web SDK (alloy.js)

**Phase 1: Direct Swap Using data Object (No XDM Required)**

The recommended initial migration path suppresses the need for XDM schema creation. Replace `gtag.js` with `alloy.js`:

```javascript
// BEFORE: Google Analytics gtag.js
gtag('event', 'purchase', {
  transaction_id: 'T12345',
  value: 49.99,
  currency: 'USD'
});

// AFTER: Adobe Web SDK alloy.js (data object approach)
alloy("sendEvent", {
  data: {
    __adobe: {
      analytics: {
        events: "purchase",
        products: ";Product Name;1;49.99",
        transactionID: "T12345",
        eVar1: "purchase confirmation"
      }
    }
  }
});
```

Variables within the `data.__adobe.analytics` object use identical names and formats as AppMeasurement counterparts. String values like `products` should not be split into individual objects.

**Phase 2: Full XDM Migration**

After stabilization, create XDM schemas and use datastream mapping to populate applicable XDM fields for full AEP integration.

**Key Method Replacements:**

| gtag.js / AppMeasurement | Web SDK (alloy.js) |
|--------------------------|-------------------|
| `s.t()` (page view) | `alloy("sendEvent", { xdm: {...} })` |
| `s.tl()` (link tracking) | `alloy("sendEvent", { data: { linkName, linkType, linkURL } })` |
| `s.clearVars()` | Not needed (variables don't persist between calls) |
| Automatic link tracking | `clickCollectionEnabled: true` (default) |

**Datastream Configuration:**
1. Create a datastream in AEP Data Collection
2. Add Adobe Analytics as a service
3. Map Report Suite ID
4. Optionally add CJA, Target, and AEP services

#### Google Tag Manager to Adobe Experience Platform Tags (Launch)

**Migration Considerations:**
- GTM containers do not have a 1:1 export to Adobe Tags; each tag, trigger, and variable must be manually recreated.
- GTM Data Layer (`dataLayer.push()`) can be read by Adobe Tags via the "Google Data Layer" extension, enabling a phased migration.
- Adobe Tags provides XDM schema visualization in the UI that GTM lacks when implementing Web SDK.
- GTM custom HTML tags must be recreated as Adobe Tags "Custom Code" actions.
- GTM triggers map to Adobe Tags "Events" (rules).
- GTM variables map to Adobe Tags "Data Elements."

**Recommended Approach:**
1. Document all existing GTM tags, triggers, variables, and their purposes.
2. Install the Adobe Tags embed code alongside GTM initially (parallel run).
3. Recreate tags in Adobe Tags using native extensions (Adobe Analytics, Web SDK, Target).
4. Validate data parity between GTM and Adobe Tags implementations.
5. Remove GTM after validation.

**Technical Note:** Platform XDM data created using GTM and alloy.js is technically equivalent to XDM delivered by Adobe Tags. It is possible to retain GTM while migrating analytics solutions to Adobe, though this is not recommended for long-term maintenance.

#### Historical Data Migration

There is no direct import of GA historical data into Adobe Analytics report suites. Options include:

1. **Data Warehouse Export**: Export GA data via the reporting API and store in a data warehouse for reference alongside Adobe data.
2. **BigQuery to CJA**: Export GA data to BigQuery, transform to XDM, and ingest into AEP for use in Customer Journey Analytics (see Section 1.7).
3. **Parallel Running**: Run both GA and Adobe Analytics simultaneously for a transition period (typically 3-6 months) to build comparison data.

#### Segment Migration

GA segments must be manually recreated in Adobe Analytics:
- GA "User" segments map to Adobe "Visitor" segments
- GA "Session" segments map to Adobe "Visit" segments
- GA "Hit" segments map to Adobe "Hit" segments
- GA sequential segments can be recreated using Adobe's sequential segmentation
- GA audience definitions used for remarketing must be rebuilt in Adobe Audience Manager or AEP

#### Report Migration

| GA Report | Adobe Analytics Equivalent |
|-----------|--------------------------|
| Realtime | Real-Time Reports |
| Audience Overview | Visitors workspace panel |
| Acquisition Overview | Marketing Channels / Tracking Code reports |
| Behavior Flow | Flow Visualization (Analysis Workspace) |
| Conversions / Goals | Conversion Funnels / Fallout Visualization |
| E-commerce | Products / Revenue reports |
| Custom Reports | Freeform Tables (Analysis Workspace) |
| Explorations (GA4) | Analysis Workspace projects |

---

### 1.2 Mixpanel to Adobe Analytics

#### Event Model Differences

| Concept | Mixpanel | Adobe Analytics |
|---------|----------|-----------------|
| Core unit | Event (JSON with properties) | Server call (hit with variables) |
| User properties | People properties | Visitor attributes / eVars with visitor expiry |
| Event properties | Event properties (key-value) | eVars and Props set on the hit |
| Funnels | Funnel reports | Fallout visualization |
| Cohorts | Cohort analysis | Cohort Tables (Analysis Workspace) |
| Retention | Retention reports | Return Visits metric / custom retention |
| User profiles | User profiles with merge | Real-Time Customer Profile (AEP) |

#### Migration Approach

Mixpanel's event-based model maps more naturally to Adobe's hit-based model than GA's session-based model. Key steps:

1. **Event Inventory**: Catalog all Mixpanel events and properties.
2. **eVar/Prop Assignment**: Map event properties to eVars (persistent) or Props (hit-scoped).
3. **Success Event Definition**: Map Mixpanel events to Adobe Custom Events (event1-1000).
4. **Super Properties**: Map to eVars with "Never" or "Visit" expiry.
5. **People Properties**: Map to Customer Attributes or AEP Profile attributes.
6. **Implementation**: Replace Mixpanel SDK with Adobe Web SDK or AppMeasurement.

#### Historical Data

Mixpanel provides a raw data export API (`/api/2.0/export`) that returns events as JSON. This can be:
- Stored in a data warehouse for reference
- Transformed to XDM and ingested into AEP for CJA analysis

---

### 1.3 Amplitude to Adobe Analytics

#### Behavioral Analytics Mapping

| Amplitude Feature | Adobe Equivalent |
|-------------------|-----------------|
| Event Segmentation | Analysis Workspace Freeform Tables |
| User Segmentation | Segments (Visitor scope) |
| Funnel Analysis | Fallout Visualization |
| Retention Analysis | Cohort Tables / Return Visits |
| Revenue Analysis | Products reports / Revenue metric |
| Pathfinder | Flow Visualization |
| Microscope (user drill-down) | Segment + Customer Attributes |
| Behavioral Cohorts | Sequential Segments |
| Event taxonomy | Solution Design Reference (SDR) |
| Amplitude SDK | Adobe Web SDK / Mobile SDK |
| Govern (data governance) | Data Governance in AEP |

#### Key Differences

- Amplitude uses event taxonomies directly in analysis. Adobe requires pre-configuration of eVars, Props, and Events.
- Amplitude attribution is built into the analysis UI. Adobe uses Attribution IQ as a separate feature.
- Amplitude's behavioral cohorts become sequential segments in Adobe with specific event sequencing logic.

---

### 1.4 Heap to Adobe Analytics

#### Auto-Capture vs. Manual Implementation

| Aspect | Heap | Adobe Analytics |
|--------|------|-----------------|
| Tracking approach | Auto-capture all interactions | Manual implementation (tag + configure) |
| Retroactive analysis | Yes (events defined after capture) | No (must configure before collection) |
| Event definition | Define events post-hoc via UI | Define events in SDR, implement in code |
| Page interactions | Automatic click/form/pageview capture | Must explicitly track via s.tl() or Web SDK |
| Data volume | High (captures everything) | Lower (captures only configured events) |
| Data structure | Flat event model | Hierarchical (eVar/Prop/Event model) |

#### Migration Considerations

- Heap's retroactive analysis capability has no equivalent in Adobe Analytics. Organizations must invest more upfront in a Solution Design Reference (SDR) defining all tracking requirements.
- Heap's visual event labeling must be replaced with explicit implementation code.
- Auto-captured form interactions in Heap require manual Activity Map or custom link tracking in Adobe.
- Heap's "Snap" visual labeling tool functionality can be partially replicated by Adobe's Activity Map overlay.

---

### 1.5 Snowplow to Adobe Analytics

#### Open-Source to Enterprise Migration

| Aspect | Snowplow | Adobe Analytics |
|--------|----------|-----------------|
| Hosting model | Self-hosted or managed cloud | SaaS (Adobe-hosted) |
| Data ownership | Full ownership (own warehouse) | Adobe-managed with Data Feeds export |
| Schema | Custom self-describing JSON schemas | Pre-configured eVars/Props/Events |
| Data pipeline | Enrichments pipeline (custom) | Processing Rules + VISTA rules |
| Query access | Direct SQL on warehouse | Data Warehouse + Data Feeds |
| Real-time | Streaming to Kinesis/PubSub | Real-Time reports (limited) |
| Tracker | JavaScript/mobile/server trackers | Web SDK / AppMeasurement / Mobile SDK |

#### Migration Strategy

1. **Tracking Plan Translation**: Map Snowplow self-describing events to Adobe eVars/Props/Events.
2. **Enrichment Mapping**: Map Snowplow enrichments (IP lookup, UA parsing, campaign attribution) to Adobe Processing Rules and VISTA rules.
3. **Context Mapping**: Map Snowplow contexts (entities) to Adobe classification hierarchies.
4. **Implementation**: Replace Snowplow JavaScript tracker with Adobe Web SDK.
5. **Downstream Impact**: Document all BI dashboards, dbt models, and ML pipelines consuming Snowplow data that need updating.
6. **Parallel Run**: Run both implementations simultaneously for data validation (recommended: 2-4 weeks).

---

### 1.6 Matomo / Piwik to Adobe Analytics

#### On-Premises to SaaS Migration

| Aspect | Matomo | Adobe Analytics |
|--------|--------|-----------------|
| Deployment | Self-hosted (PHP/MySQL) | Cloud SaaS |
| Data privacy | Full data ownership (GDPR-native) | Adobe Data Processing Agreement |
| Custom dimensions | Custom Dimensions (configurable) | eVars/Props |
| Goals | Goals and Conversions | Success Events |
| Segments | Segment builder | Segment Builder (Analysis Workspace) |
| Reports | Standard + Custom Reports | Analysis Workspace + Reports & Analytics |
| Tag manager | Matomo Tag Manager | Adobe Experience Platform Tags |
| Tracking | matomo.js tracker | Web SDK (alloy.js) |

#### Key Considerations

- Matomo's first-party hosting model provides GDPR advantages that must be replicated via Adobe's privacy configuration and consent management.
- Matomo's heatmap and session recording features require separate tools (Adobe Target for heatmaps is limited; consider Decibel/Quantum Metric integration).
- Custom dimension data in Matomo maps to eVars in Adobe Analytics.
- Matomo Goals map to Adobe Success Events with Calculated Metrics for conversion rates.

---

### 1.7 Google Analytics to Customer Journey Analytics (CJA) via BigQuery

#### Architecture

```
GA4 Property --> BigQuery Export --> GCS --> AEP Source Connector --> AEP Dataset --> CJA Connection --> CJA Data View
```

#### Step-by-Step Technical Process

**1. BigQuery Export from GA4:**
- GA4 supports native export to BigQuery (linked in GA4 Admin > BigQuery Linking).
- GA4 exports event-level data with nested arrays (items, user_properties, event_params).

**2. Universal Analytics (UA) BigQuery Transformation:**
UA stores session-level records. Must use SQL `UNNEST` to flatten to event-level:

```sql
SELECT *, timestamp_seconds(`visitStartTime` + hit.time) AS `timestamp`
FROM (
  SELECT fullVisitorId, visitNumber, visitId, visitStartTime,
         trafficSource, socialEngagementType, channelGrouping,
         device, geoNetwork, hit
  FROM `example_bq_table_*`,
  UNNEST(hits) AS hit
)
```

**3. Export to Google Cloud Storage:**
- Use BigQuery's "Export > Export to GCS" function.
- Export as JSON or Parquet format.

**4. AEP Ingestion:**
- In AEP, select Sources > Google Cloud Storage > Add Data.
- Map to an XDM schema.

**5. XDM Field Requirements:**
- **`timestamp`**: Create a calculated field using `date(timestamp, "yyyy-MM-dd HH:mm:ssZ")` format.
- **`_id`**: Must contain a value (a simple "1" is acceptable for backfill).

**6. CJA Connection:**
- Create a Connection in CJA pointing to the AEP dataset.
- Use the same schema for both historical (backfill) and live streaming datasets for seamless merging.

**7. CJA Data View:**
- Map XDM fields to CJA dimensions and metrics.
- Configure attribution models, persistence, and format settings.

**Typical Timeline:** Organizations can go live in 6-8 weeks with historical data onboarded and real-time streaming configured.

---

## 2. Email / Marketing Automation Migrations

### 2.1 Salesforce Marketing Cloud (SFMC) to Adobe Campaign / AJO

#### Architecture Comparison

| Aspect | SFMC | Adobe Campaign / AJO |
|--------|------|---------------------|
| Data model | Data Extensions (relational tables) + Contact Builder | AEP XDM Schemas + Datasets (AJO) / Star schema (Campaign) |
| Journey builder | Journey Builder | AJO Journey Canvas / Campaign Workflows |
| Scripting | AMPscript + SSJS (Server-Side JavaScript) | Handlebars JS (AJO) / JavaScript + JSSP (Campaign) |
| Content management | Content Builder + Content Blocks | AEM Assets + Email Designer fragments (AJO) |
| Real-time profile | Data Cloud for Marketing (add-on) | AEP Real-Time Customer Profile (native to AJO) |
| SMS | MobileConnect | SMS channel (AJO) |
| Push | MobilePush | Push channel (AJO) |
| Automation | Automation Studio (scheduled flows) | Campaign Workflows / AJO journeys |

#### Data Extensions to AEP Schemas/Datasets

SFMC Data Extensions are essentially SQL tables. Migration requires:

1. **Schema Mapping**: Map each DE column to XDM field groups.
   - Standard contact fields --> XDM Individual Profile
   - Custom fields --> Custom field groups in XDM
   - Relational DEs --> Separate XDM schemas with relationship descriptors

2. **Data Export**: Export DE data via SFMC REST API (`/data/v1/async/dataextensions/{id}/rows`) or SFMC SQL Query Activity to extract and store in an SFTP location.

3. **Data Ingestion**: Use AEP batch ingestion (CSV/Parquet upload) or streaming API.

4. **Identity Stitching**: Map SFMC subscriber keys to AEP identity namespaces (Email, CRM ID, etc.).

#### Journey/Automation Migration: Journey Builder to AJO Journeys

| SFMC Component | AJO Equivalent |
|---------------|----------------|
| Journey Builder journey | AJO Journey |
| Entry event (Data Extension event) | AJO Read Audience / Business Event |
| Decision split | Condition activity |
| Wait activity | Wait activity |
| Email activity | Email action |
| SMS activity | SMS action |
| Push activity | Push action |
| Einstein STO | Send-Time Optimization (AJO) |
| Exit criteria | Exit criteria |
| Goal | Journey metrics |

| SFMC Component | Campaign Equivalent |
|---------------|---------------------|
| Automation Studio | Campaign Workflows |
| Triggered Send | Transactional messaging |
| Data Extract Activity | Data export workflow activity |
| File Transfer Activity | File transfer workflow activity |
| SQL Query Activity | Query workflow activity |
| Import Activity | Data loading activity |

#### AMPscript/SSJS to AJO Handlebars / Campaign Scripting

**Personalization Example:**

```
// SFMC AMPscript
%%[
SET @firstName = AttributeValue("FirstName")
IF EMPTY(@firstName) THEN
  SET @greeting = "Hello there"
ELSE
  SET @greeting = CONCAT("Hello, ", @firstName)
ENDIF
]%%
%%=v(@greeting)=%%

// AJO Handlebars
{{#if profile.person.name.firstName}}
  Hello, {{profile.person.name.firstName}}
{{else}}
  Hello there
{{/if}}
```

**Data Lookup Example:**

```
// SFMC AMPscript
%%[
SET @rows = LookupRows("Orders", "ContactID", _subscriberkey)
FOR @i = 1 TO RowCount(@rows) DO
  SET @row = Row(@rows, @i)
  SET @orderID = Field(@row, "OrderID")
]%%

// AJO - Use AEP Lookup or Helper Functions
// Data lookups in AJO use AEP lookup datasets and
// the fetchData helper function in expressions
```

**Key Language Differences:**
- AMPscript's `Lookup()`, `LookupRows()`, `LookupOrderedRows()` have no direct AJO equivalent; use AEP lookup datasets.
- SSJS `Platform.Function.Lookup()` must be replaced with AJO expression editor functions.
- SFMC Content Blocks become AJO Fragments (with some guardrails and limitations).

#### Content Builder Assets to AEM Assets

1. Export all images, documents, and media from Content Builder via SFMC REST API.
2. Upload to AEM Assets DAM with metadata preservation.
3. Update all email template references to new AEM Assets URLs.
4. Migrate Content Blocks to AJO Fragments or AEM Content Fragments.

#### Subscriber Data and Consent Migration

1. **Subscriber Lists**: Export all subscribers with status (Active, Bounced, Unsubscribed, Held).
2. **Consent Records**: Map SFMC subscription statuses to AEP Consent schema:
   - SFMC "Active" --> AEP consent "yes"
   - SFMC "Unsubscribed" --> AEP consent "no"
   - SFMC "Held" --> AEP consent "pending" (review case by case)
3. **Preference Centers**: Rebuild SFMC profile center / subscription center in AJO preference management.

#### Sending Domain / IP Warmup Considerations

- **Sending domains cannot be transferred between ESPs.** You must re-authenticate domains (SPF, DKIM, DMARC) for Adobe's sending infrastructure.
- **IP addresses are ESP-specific.** When switching from SFMC to Adobe Campaign/AJO, new IPs must be warmed.
- **IP Warmup Strategy** (per Adobe documentation):
  - Begin with highly engaged users only.
  - Gradually increase volume over 4-6 weeks.
  - Monitor complaint rates, bounce rates, and inbox placement.
  - Adobe AJO provides a native IP warmup plan feature with automated volume ramp-up.
- **Reputation does not transfer.** Domain reputation partially carries over (if keeping the same sending domain), but IP reputation starts fresh.
- **Isolate transactional and marketing email** on separate IP pools.
- **DMARC**: Set up DMARC records for all delegated subdomains directly in the AJO interface.

**Warmup Volume Progression (Typical):**

| Day | Daily Volume |
|-----|-------------|
| 1-3 | 500-1,000 |
| 4-7 | 2,000-5,000 |
| 8-14 | 10,000-25,000 |
| 15-21 | 50,000-100,000 |
| 22-28 | 100,000-250,000 |
| 29-42 | Ramp to full volume |

---

### 2.2 HubSpot to Adobe Marketo Engage

#### Contact Migration

1. **Export from HubSpot**: Export contacts as CSV including all properties and opt-in status.
2. **Field Mapping**: Map HubSpot contact properties to Marketo Lead fields.
   - HubSpot "First Name" --> Marketo "First Name"
   - HubSpot "Lifecycle Stage" --> Marketo custom field or use Revenue Cycle Model
   - HubSpot "Lead Status" --> Marketo "Lead Status"
   - HubSpot custom properties --> Marketo custom fields (must create first)
3. **Import**: Use Marketo's list import feature with CSV field mapping.
4. **Data Cleanup**: Remove duplicates, standardize formatting, validate email addresses before import.

#### Workflow to Smart Campaign Conversion

| HubSpot Workflow Element | Marketo Equivalent |
|-------------------------|-------------------|
| Enrollment trigger | Smart List trigger |
| If/then branch | Choice steps in Flow |
| Delay | Wait step |
| Send email action | Send Email flow step |
| Update property | Change Data Value |
| Create task | Create Task (Salesforce) |
| Webhook | Call Webhook |
| Goal criteria | Smart Campaign constraints |
| Workflow goal | Program success |
| Contact list | Static List |

#### Form Migration

- HubSpot forms must be recreated in Marketo's Form Editor.
- Progressive profiling fields map to Marketo's Progressive Profiling feature.
- HubSpot dependent fields become Marketo Visibility Rules.
- Form embed codes must be updated on all pages.
- HubSpot tracked pages require Marketo's Munchkin JavaScript.

#### Landing Page Migration

- Export HubSpot landing page HTML/CSS.
- Recreate in Marketo's Design Studio using Guided Landing Page templates or Free-Form pages.
- URL redirects from HubSpot domains to Marketo CNAME domains.
- Update all inbound links and campaign references.

#### Lead Scoring Model Migration

- Document HubSpot lead scoring criteria (demographic + behavioral).
- Marketo separates scoring into demographic (fit) and behavioral (engagement) scores.
- Recreate scoring rules as Marketo Smart Campaigns with "Change Score" flow steps.
- Marketo supports multiple scoring fields (e.g., Demographic Score, Behavior Score, Product Interest Score).
- HubSpot's combined score should be split into separate Marketo fields for more granular control.

---

### 2.3 Mailchimp to Adobe Campaign

#### List Migration

1. Export Mailchimp audiences as CSV (Audience > All Contacts > Export Audience).
2. Include: email, first name, last name, tags, subscription date, engagement data.
3. Map to Adobe Campaign recipient schema (nms:recipient).
4. Import via Campaign's Import workflow activity or API.
5. Recreate Mailchimp "Groups" as Campaign target mappings or segmentation criteria.
6. Migrate suppression lists (unsubscribes, bounces, complaints) to Campaign quarantine table.

#### Template Conversion

- Export Mailchimp templates as HTML (Templates > Edit > Export as HTML).
- Adapt HTML for Adobe Campaign's email rendering engine.
- Replace Mailchimp merge tags (`*|FNAME|*`, `*|EMAIL|*`) with Campaign personalization fields (`<%= recipient.firstName %>`, `<%= recipient.email %>`).
- Rebuild drag-and-drop templates in Campaign's Email Designer.

#### Automation Migration

| Mailchimp Automation | Adobe Campaign Equivalent |
|---------------------|--------------------------|
| Welcome Series | Recurring delivery workflow |
| Abandoned Cart | Event-triggered workflow |
| Birthday emails | Scheduler + Query workflow |
| Re-engagement | Workflow with date-based query |
| Post-purchase | Transactional message triggered by event |
| RSS-to-email | Content block with feed integration |

---

### 2.4 Braze to Adobe Journey Optimizer

#### Push Notification Migration

- Re-register push tokens: Braze push tokens cannot be transferred. Users must re-opt-in via Adobe SDK.
- Configure platform credentials in AJO: APNs certificates (iOS), FCM server keys (Android).
- Recreate push templates in AJO's push notification designer.
- Migrate rich push content (images, action buttons, deep links).

#### In-App Message Migration

- Recreate in-app message templates in AJO's in-app messaging channel.
- Map Braze in-app triggers (custom events, session start) to AJO triggers.
- Rebuild targeting rules using AEP segments instead of Braze segments.

#### Canvas to Journey Conversion

| Braze Canvas Element | AJO Journey Equivalent |
|---------------------|----------------------|
| Canvas entry (audience/action-based) | Journey entry (Read Audience / Event) |
| Message step | Channel action (Email/Push/SMS/In-App) |
| Decision split | Condition node |
| Delay | Wait activity |
| Audience path | Condition with segment evaluation |
| Experiment path | Experimentation feature (A/B in journey) |
| User update | Update Profile action |
| Webhook | Custom action (REST API call) |
| Exit criteria | Exit criteria / event-based exit |

---

### 2.5 Iterable to Adobe Journey Optimizer

#### Workflow to Journey Migration

- Iterable workflows map to AJO journeys with event triggers.
- Iterable's "Catalog" (product data) maps to AEP datasets for personalization.
- Iterable's A/B testing in workflows maps to AJO's native experimentation feature.
- Iterable's "Experiments" map to AJO's Content Experiments.

#### Template Migration

- Export Iterable email templates as HTML.
- Replace Iterable Handlebars syntax (`{{firstName}}`) with AJO Handlebars (`{{profile.person.name.firstName}}`).
- Rebuild dynamic content blocks using AJO's Email Designer or AEM content.

---

### 2.6 Klaviyo to Adobe Campaign / AJO

#### E-Commerce Email Migration

- **Product Feeds**: Klaviyo's catalog sync must be replaced with Adobe Commerce integration or AEP product dataset.
- **Flow Triggers**: Map Klaviyo flow triggers (Placed Order, Checkout Started, etc.) to AJO events or Campaign workflow queries.
- **Dynamic Product Blocks**: Replace Klaviyo's `{% for item in event.items %}` with AJO personalization using AEP lookup datasets.
- **Predictive Analytics**: Klaviyo's predicted CLV and churn risk features map to Adobe's Customer AI models in AEP.
- **SMS**: Klaviyo SMS flows must be recreated in AJO's SMS channel.
- **Signup Forms/Popups**: Must be rebuilt using third-party tools or AEM forms.

---

### 2.7 Pardot (Salesforce MCAE) to Marketo

#### B2B Marketing Automation Migration

**Key Structural Differences:**
- Pardot uses separate "Score" (engagement) and "Grade" (fit) fields. Marketo combines these but supports multiple custom score fields.
- Pardot's "Engagement Studio" maps to Marketo's "Engagement Programs" (nurture).
- Pardot's "Automation Rules" map to Marketo's "Smart Campaigns" with batch processing.
- Pardot's "Completion Actions" map to Marketo's "Smart Campaign Triggers."
- Pardot's "Dynamic Content" maps to Marketo's "Segmentation + Dynamic Content" feature.

**Data Migration Steps:**
1. Export all prospects from Pardot as CSV.
2. Export engagement history, scoring history, and activity data.
3. Create custom fields in Marketo matching Pardot schema.
4. Import contacts with field mapping.
5. Recreate lead scoring model in Marketo Smart Campaigns.
6. Rebuild Engagement Studio programs in Marketo Engagement Programs.
7. Recreate forms and landing pages in Marketo Design Studio.
8. Update Salesforce CRM integration from Pardot sync to Marketo sync.
9. Migrate all file assets (PDFs, images) to Marketo Design Studio.
10. Set up URL redirects from Pardot-hosted pages.

---

## 3. CMS Migrations to AEM

### 3.1 WordPress to AEM Sites

#### Content Export Methods

1. **WordPress REST API**: Programmatic export of all posts, pages, and custom post types as JSON.
   - Endpoint: `GET /wp-json/wp/v2/posts?per_page=100&page=1`
   - Supports: posts, pages, media, categories, tags, custom post types.
2. **WXR Export**: WordPress eXtended RSS export (Tools > Export > All Content).
   - XML format containing all posts, pages, comments, custom fields, categories, tags.
   - Limited: does not include theme settings, plugin data, or widget configurations.
3. **Database Export**: Direct MySQL/MariaDB dump for custom migration scripts.
4. **Custom Scripts**: PHP/Python scripts using WP-CLI or direct database queries for selective export.

#### Theme to AEM Template/Component Mapping

| WordPress Concept | AEM Equivalent |
|-------------------|---------------|
| Theme | AEM Project/Client Library (CSS/JS) |
| Page Template (PHP) | AEM Page Template (Editable Template) |
| Template Parts (header.php, footer.php) | AEM Experience Fragments or Structural Components |
| Widgets | AEM Components (drag-and-drop in parsys) |
| Shortcodes | AEM Components or Content Fragments |
| Custom Post Types | Content Fragment Models |
| Taxonomies (Categories, Tags) | AEM Tagging Framework |
| Menus | AEM Navigation Component |
| Custom Fields (ACF) | Content Fragment fields or Component dialog fields |
| Gutenberg Blocks | AEM Core Components |

#### Plugin Functionality to AEM Features

| WordPress Plugin | AEM Equivalent |
|-----------------|---------------|
| Yoast SEO | AEM SEO components + metadata in page properties |
| Contact Form 7 / Gravity Forms | AEM Forms |
| WooCommerce | Adobe Commerce integration |
| WPML / Polylang (multilingual) | AEM Language Copy / MSM |
| W3 Total Cache | AEM Dispatcher + CDN |
| Wordfence (security) | AEM Cloud Manager security + Dispatcher rules |
| Advanced Custom Fields | AEM Component dialogs / Content Fragment Models |
| WP All Import | AEM Content Importer / custom Sling servlets |
| Elementor / Divi (page builders) | AEM Template Editor + Core Components |
| Redirection (URL redirects) | AEM Redirect Manager / Apache rewrite rules |

#### Media Library to AEM Assets / DAM

1. Export all media via WP REST API: `GET /wp-json/wp/v2/media?per_page=100`
2. Download files from `wp-content/uploads/` directory.
3. Preserve directory structure or reorganize per AEM DAM taxonomy.
4. Upload to AEM Assets via Asset Manager API, AEM bulk upload tool, or Content Transfer Tool.
5. Map WordPress image metadata (alt text, caption, description) to AEM metadata schema.
6. Update all content references from WordPress URLs to AEM DAM paths.

#### URL Structure Preservation

- Document all existing WordPress permalink structures.
- Create Sling Mappings or Apache Redirect rules in AEM Dispatcher.
- Generate a comprehensive 301 redirect map (old URL --> new AEM URL).
- Handle WordPress-style pagination URLs (`/page/2/`) to AEM pagination.
- Preserve query parameter patterns for search and filtering.
- Submit updated sitemap to search engines post-migration.

#### Multi-Site Handling

- WordPress Multisite networks map to AEM's Multi Site Manager (MSM).
- Each WordPress subsite becomes an AEM site with its own content tree.
- Shared content (header, footer, global navigation) uses AEM Live Copy or Experience Fragments.
- Language variants use AEM Language Copy feature.

---

### 3.2 Sitecore to AEM

#### Template to Component Mapping

| Sitecore Concept | AEM Equivalent |
|-----------------|---------------|
| Data Template | Content Fragment Model |
| Rendering (View/Controller) | AEM Component (Sling Model + HTL) |
| Layout | Editable Template |
| Placeholder | Parsys (Paragraph System) / Layout Container |
| Sublayout | Component |
| Branches | Template with pre-populated content |
| Standard Values | Template policies / default content |
| Base Templates | Component super types |
| xDB (Experience Database) | AEP Real-Time Customer Profile |
| Personalization Rules | Adobe Target offers/activities |
| SXA (Sitecore Experience Accelerator) | AEM Core Components |
| Sitecore Forms | AEM Forms |
| Content Editor | AEM Sites page editor |
| Content Tree | AEM Repository (JCR/Oak) |
| Media Library | AEM Assets DAM |

#### Technical Architecture Differences

- Sitecore: ASP.NET framework, C#, SQL Server/MongoDB backend.
- AEM: Apache Sling framework, Java/HTL, JCR/Oak repository.
- Component model: Sitecore renderings (CSHTML/Razor) become AEM components (HTL/Sling Models).

#### xDB to AEP Migration

Sitecore's Experience Database (xDB) stores visitor interactions, goals, and engagement values. Migration path:

1. Export xDB contact data using Sitecore's xDB Data Migration Tool or custom extraction.
2. Transform contact records to XDM Individual Profile schema.
3. Map xDB interaction data to XDM Experience Events.
4. Ingest into AEP via batch upload or streaming API.
5. Map Sitecore Goals to AEP events / Adobe Analytics Success Events.
6. Rebuild Engagement Value scoring in AEP using Customer AI or custom calculated metrics.

#### Personalization Rules to Target / AEP

- Sitecore personalization rules (conditions + content variants) map to Adobe Target activities.
- Sitecore's Profile Cards map to AEP segments.
- Sitecore's Pattern Cards (behavioral profiling) map to Target audiences with behavioral criteria.
- Content personalization: Use Target offers to swap content components on AEM pages.

#### Migration Tools

- Sitecore PowerShell Extensions for bulk content export.
- Custom Java servlets for AEM bulk content import.
- XML/CSV intermediate format for data transformation.
- Typically requires a partner with both Sitecore and AEM expertise.
- Enterprise migration timeline: 12-20 weeks minimum.

---

### 3.3 Drupal to AEM

#### Node Types to Content Fragments

| Drupal Concept | AEM Equivalent |
|---------------|---------------|
| Content Type (Node Type) | Content Fragment Model or Page Component |
| Node | Content Fragment or AEM Page |
| Fields | Content Fragment fields / Component dialog fields |
| Taxonomy (Vocabulary + Terms) | AEM Tag Namespace + Tags |
| Views | AEM Query Builder / GraphQL queries |
| Blocks | AEM Components |
| Modules | AEM bundles (OSGi) / Core Components |
| Paragraphs module | AEM Layout Container + Components |
| Media module | AEM Assets DAM |
| Path aliases | Sling Mappings / Vanity URLs |
| Menus | Navigation Component |
| User roles | AEM User Groups + CUG (Closed User Groups) |

#### Technical Considerations

- Drupal uses PHP; AEM uses Java. No code can be directly ported.
- Drupal's hook system and event-driven module architecture must be reimplemented as AEM OSGi services and Sling servlets.
- Export Drupal content using `drush` CLI or Drupal's REST API (`/jsonapi/node/article`).
- Drupal's Views (dynamic queries) must be reimplemented using AEM Query Builder API or GraphQL (for headless).
- Drupal's taxonomy terms migrate to AEM's tagging framework with namespace organization.

---

### 3.4 Contentful to AEM (Headless)

#### Content Model Migration

| Contentful Concept | AEM Headless Equivalent |
|-------------------|------------------------|
| Content Type | Content Fragment Model |
| Entry | Content Fragment |
| Asset | AEM Asset (DAM) |
| Space | AEM site/project |
| Environment | AEM environment (Dev/Stage/Prod) |
| Locale | Language Copy |
| Rich Text field | Multi-line text (Rich Text) |
| Reference field | Fragment Reference |
| JSON field | JSON Object field |
| Content Delivery API | AEM GraphQL API |
| Content Management API | AEM Assets HTTP API |
| Webhooks | AEM Eventing (Cloud Service) |

#### API Endpoint Mapping

- Contentful GraphQL: `https://graphql.contentful.com/content/v1/spaces/{spaceId}` --> AEM GraphQL: `https://{host}/graphql/execute.json/{project}/{query}`
- Contentful REST: `https://cdn.contentful.com/spaces/{spaceId}/entries` --> AEM Assets HTTP API: `/api/assets/{path}.json`
- AEM requires Content Fragment Models to be defined via drag-and-drop UI before fragments can be created.

---

### 3.5 Sanity to AEM

#### GROQ Queries to GraphQL

- Sanity's GROQ query language must be rewritten as AEM GraphQL queries.
- Sanity stores content as structured JSON documents in its Content Lake; AEM stores Content Fragments in the JCR repository.
- Sanity's schema-as-code (JavaScript) definitions must be manually recreated as AEM Content Fragment Models in the AEM UI.
- Sanity's real-time collaboration features (GROQ-powered listeners) have no direct AEM equivalent; consider AEM Eventing for webhook-based notifications.

---

### 3.6 Contentstack to AEM

#### Headless CMS Migration Patterns

- Map Contentstack Content Types to AEM Content Fragment Models.
- Map Contentstack Entries to AEM Content Fragments.
- Replace Contentstack Delivery API calls with AEM GraphQL persisted queries.
- Migrate Contentstack Assets to AEM Assets DAM.
- Map Contentstack Workflows to AEM workflow models.
- Replace Contentstack webhooks with AEM Cloud Service Eventing.

---

## 4. CDP / DMP Migrations

### 4.1 Salesforce CDP (Data Cloud) to Adobe RTCDP

#### Data Model Mapping

| Salesforce CDP | Adobe RTCDP (AEP) |
|---------------|-------------------|
| Data Model Objects (DMOs) | XDM Schemas |
| Data Streams | Datastreams |
| Calculated Insights | Computed Attributes |
| Identity Resolution | AEP Identity Service / Identity Graph |
| Segments | AEP Segments (Segment Builder) |
| Activations | Destinations |
| Data Bundles | Data Sources / Source Connectors |
| Data Lake Objects | AEP Datasets |

#### Migration Steps

1. **Schema Planning**: Create a data architect plan mapping all Salesforce CDP data sources to XDM schemas, including data points, data types, sample values, and identity fields.
2. **Identity Strategy**: Map Salesforce CDP identity resolution rules to AEP Identity Service:
   - List all identifiers (email, phone, CRM ID, device ID).
   - Define primary vs. secondary identities.
   - Configure identity namespaces in AEP.
   - Validate identity graph to prevent over-collapsing.
3. **Data Ingestion**: Choose between batch and streaming ingestion per source. AEP has native connectors for Salesforce CRM.
4. **Segment Recreation**: Recreate all Salesforce CDP segments in AEP Segment Builder.
5. **Destination Migration**: Reconnect all activation destinations using AEP's 60+ native destination connectors.

#### Identity Resolution Differences

- Salesforce CDP uses probabilistic and deterministic matching.
- AEP uses a private identity graph with deterministic matching by default.
- **Critical Warning**: Identity resolution errors happen frequently if you don't formalize and validate your identity strategy. Unwinding records after over-collapsing is extremely difficult.

---

### 4.2 Treasure Data to AEP

#### Migration Approach

1. Export Treasure Data customer segments and profiles via Treasure Data REST API or direct database access.
2. Transform data to XDM schemas.
3. Ingest into AEP via batch upload (CSV/Parquet) or cloud storage source connector (S3, GCS).
4. Recreate Treasure Data audiences as AEP segments.
5. Reconnect downstream activations using AEP destinations.
6. Map Treasure Data's predictive scoring models to AEP Customer AI.

---

### 4.3 Tealium AudienceStream to AEP RTCDP

#### Migration Architecture

| Tealium | AEP |
|---------|-----|
| AudienceStream profiles | Real-Time Customer Profile |
| Enrichments | Computed Attributes |
| Audiences/badges | Segments |
| EventStream events | Experience Events |
| Connectors (server-side) | Destinations |
| Data Layer | XDM via Web SDK |
| iQ Tag Manager | AEP Tags (Launch) |

#### Technical Integration Note

Tealium provides an Adobe Experience Platform Connector that can send AudienceStream data directly to AEP. This can serve as a bridge during migration:

1. Configure Tealium's AEP connector to forward visitor data.
2. Map Tealium attributes to XDM fields.
3. Gradually migrate tracking from Tealium iQ to AEP Tags.
4. Pass ECID via Tealium's Adobe Visitor Service module during transition.
5. Once AEP Tags is fully deployed, decommission Tealium connectors.

---

### 4.4 Segment (Twilio) to AEP

#### Source/Destination Migration

| Segment Concept | AEP Equivalent |
|----------------|---------------|
| Sources | Source Connectors |
| Destinations | Destination Connectors |
| Protocols (tracking plan) | XDM Schemas |
| Personas (profiles) | Real-Time Customer Profile |
| Audiences | Segments |
| Functions | AEP Server-Side Event Forwarding |
| Connections | Datastreams |
| Engage | Destinations + AJO |

#### Migration Steps

1. Export Segment tracking plan as documentation.
2. Map Segment event schemas to XDM schemas.
3. Replace analytics.js with Adobe Web SDK (alloy.js).
4. Recreate Segment Personas as AEP profile schemas.
5. Map Segment Audiences to AEP Segments.
6. Reconnect all downstream destinations using AEP destination catalog.

---

### 4.5 mParticle to AEP

#### Event and Audience Migration

| mParticle Concept | AEP Equivalent |
|-------------------|---------------|
| Events (custom, commerce, screen views) | XDM Experience Events |
| User Attributes | Profile Attributes (XDM) |
| User Identities | Identity Namespaces |
| Audiences | Segments |
| Connections (integrations) | Source/Destination Connectors |
| Data Plans | XDM Schemas |
| IDSync (identity resolution) | Identity Service |
| Calculated Attributes | Computed Attributes |

---

### 4.6 Adobe Audience Manager (AAM) to AEP RTCDP

#### Official Adobe Migration Path

This is Adobe's own recommended migration, given AAM's declining strategic importance.

**Current Status**: Adobe is no longer actively marketing Audience Manager. No official end-of-life date has been publicly announced as of early 2026, but Adobe strongly encourages migration to RTCDP. The Salesforce Marketing Cloud source connector for AEP was deprecated in January 2026 as part of broader platform consolidation.

#### Three Migration Options

**Option 1: Lift-and-Shift via AAM Source Connector**

Technical steps:
1. Access the AAM Source Connector in AEP (Sources > Adobe Applications).
2. Execute a three-step wizard to select segments for migration.
3. Data flows into AEP, then consumed by RTCDP.

What migrates:
- Real-time data (Analytics Server-Side Forwarding, pixel calls, email calls)
- Integrated profile data from onboarded sources and authenticated profiles
- Approximately 8 datasets created automatically in DXM format
- Segments and traits with qualification data

What does NOT migrate:
- Destinations (require separate setup via Adobe Client Care)
- Third-party and second-party data feed traits
- Role-based access controls
- Audience Labs and lookalike models
- Destination Data Export Labels
- Tableau reports / Audience Optimization Reports / Data Explorer

Latency: <35 minutes for real-time data, <2 days for onboarded profile data.

**Option 2a: Re-Wire Source Connections**

Data source-by-source migration strategies:
- **Adobe Analytics**: Use Analytics source connector OR reimplement with AEP Web SDK (alloy.js) for direct AEP transmission.
- **CRM Data**: Use out-of-the-box connectors for Salesforce, Microsoft Dynamics. Replace legacy key-value pair file-based ingestion.
- **Ad/Email Pixels**: Use source connectors where available, or implement streaming endpoints with XDM format transformation.
- **Third-Party Data**: Not supported in RTCDP marketplace. Import second-party data via file/cloud storage.

**Option 2b: Re-Wire Destinations and Segments**

- Two-step activation: (1) Create destination connection with credentials, (2) Map and activate segments.
- Only durable identifier destinations supported (no cookie-based demdex UUID sharing).
- People-based destinations (Facebook, Google Customer Match, LinkedIn) available in RTCDP.
- RTCDP offers 60+ native destinations, including 20+ advertising/social options.

#### Trait to Segment Migration

| AAM Concept | RTCDP Equivalent |
|-------------|-----------------|
| Trait (rule-based) | Segment definition rule |
| Trait (onboarded) | Profile attribute |
| Trait (algorithmic/lookalike) | No direct equivalent (not on RTCDP roadmap) |
| Segment | Segment |
| Segment folders | No folder structure; use naming conventions |
| Data source | Source connector |
| Destination | Destination |
| ID syncs | Identity Service (Identity Graph) |
| demdex UUID | ECID (first-party) |
| Profile Merge Rules | Identity Stitching policies |

#### Critical Migration Impact Notes

- **Match Rate Changes**: Match rate computations are no longer valid as RTCDP operates on a first-party basis (no third-party demdex UUID).
- **Audience Size Fluctuations**: Expected decline as AAM reporting relied on third-party cookie data no longer present in RTCDP.
- **Prospecting Impact**: Visitor volumes expected to decline with first-party-only strategy.
- **Segment Evaluation**: RTCDP supports batch, streaming, and edge segment evaluation with a limit of 500 streaming segments.
- **Reporting**: Additional licenses required for Query Services and CJA for detailed reporting.
- **Data Labels**: Must be manually migrated from AAM when setting up schemas and datasets.
- **Role-Based Access**: Manual migration required; bulk API updates recommended.

This migration represents "a marketing activities reset, especially for those powered by third-party cookies/IDs."

---

## 5. E-Commerce Platform Migrations

### 5.1 Shopify / Shopify Plus to Adobe Commerce

#### Product Catalog Migration

**Data Export from Shopify:**
- Use Shopify Admin API (`GET /admin/api/2024-01/products.json`) for programmatic export.
- Or export via Shopify Admin: Products > Export (CSV format).

**Data Mapping:**

| Shopify Field | Adobe Commerce Field |
|--------------|---------------------|
| Title | Name |
| Body HTML | Description |
| Vendor | Manufacturer |
| Product Type | Category assignment |
| Tags | Tags |
| SKU | SKU |
| Price | Price |
| Compare At Price | Special Price |
| Weight | Weight |
| Inventory Quantity | Stock Qty |
| Variant options | Configurable Product attributes |
| Images | Media Gallery |
| Handle (URL slug) | URL Key |
| SEO Title | Meta Title |
| SEO Description | Meta Description |
| Barcode | Custom attribute |
| Collections | Categories |

**Import into Adobe Commerce:**
- Use System > Import in Adobe Commerce admin.
- Upload CSV file with mapped field headers.
- Or use Adobe Commerce REST API (`POST /rest/V1/products`).

#### Customer Data Migration

- Export customers from Shopify API or CSV export.
- Map fields: email, name, addresses, phone, tags, order count.
- **Passwords cannot be transferred.** Send password reset emails to all customers post-migration.
- Migrate customer groups/tags to Adobe Commerce Customer Groups.
- Preserve customer order history for reference.

#### Order History

- Export orders via Shopify API (`GET /admin/api/2024-01/orders.json?status=any`).
- Import as historical orders in Adobe Commerce using custom migration scripts.
- Map order statuses, line items, discounts, taxes, and shipping details.

#### Theme to Storefront

- Shopify Liquid templates have no direct equivalent in Adobe Commerce.
- Adobe Commerce uses PHTML templates (Luma) or React-based PWA Studio (Venia).
- Custom theme development required; themes cannot be automatically converted.
- Headless option: Use Adobe Commerce GraphQL API with a custom storefront.

#### Third-Party Tools

Cart2Cart and LitExtension provide automated migration tools supporting:
- Products, categories, customers, orders, reviews, coupons, CMS pages.
- Pricing varies based on entity count.

---

### 5.2 Salesforce Commerce Cloud (SFCC/Demandware) to Adobe Commerce

#### Cartridge to Extension Mapping

| SFCC Concept | Adobe Commerce Equivalent |
|-------------|--------------------------|
| Cartridge | Extension (module) |
| LINK Cartridge (pre-built connector) | Marketplace extension |
| Controller (SFRA) | Controller / Plugin |
| ISML Templates | PHTML Templates / UI Components |
| Content Slots | Widgets / CMS Blocks |
| Content Assets | CMS Pages / Blocks |
| Pipeline (legacy) | Layout XML + Controller |
| Business Manager | Admin Panel |
| OCAPI | REST/GraphQL API |
| Page Designer | Page Builder |
| Site Preferences | System Configuration |

#### SFRA to Adobe Commerce Themes

- SFRA (Storefront Reference Architecture) templates written in ISML must be rewritten.
- Adobe Commerce uses PHTML (server-side) or React (PWA Studio).
- No automated conversion tool exists; manual template recreation required.
- Consider headless approach with Adobe Commerce GraphQL API for modern architecture.

#### OCAPI to Commerce APIs

- SFCC's OCAPI (Open Commerce API) endpoints map to Adobe Commerce REST/GraphQL APIs.
- Product API: `OCAPI /products/{id}` --> `GET /rest/V1/products/{sku}`
- Cart API: `OCAPI /baskets` --> `POST /rest/V1/carts/mine`
- Order API: `OCAPI /orders` --> `GET /rest/V1/orders/{id}`
- Customer API: `OCAPI /customers` --> `GET /rest/V1/customers/{id}`

---

### 5.3 SAP Commerce (Hybris) to Adobe Commerce

#### Data Model Differences

| SAP Commerce | Adobe Commerce |
|-------------|---------------|
| Product (base type) | Simple Product |
| VariantProduct | Configurable Product |
| ClassificationSystem | Attribute Sets |
| Category | Category |
| ContentSlot | CMS Block |
| ContentPage | CMS Page |
| Cockpit (admin UI) | Admin Panel |
| Impex (data import/export) | Import/Export (CSV) |
| FlexibleSearch (query) | EAV + MySQL queries |
| Cronjob | Cron jobs |
| WCMS (web CMS) | Page Builder |

#### Checkout Flow Migration

SAP Commerce's multi-step checkout typically includes: Cart > Address > Delivery > Payment > Review > Confirmation. Adobe Commerce follows a similar flow but with different underlying implementation. Customizations in SAP Commerce's checkout accelerators must be rebuilt as Adobe Commerce checkout plugins.

---

### 5.4 BigCommerce to Adobe Commerce

- Export products, customers, and orders via BigCommerce API or CSV export.
- Map BigCommerce "Custom Fields" to Adobe Commerce custom attributes.
- BigCommerce "Stencil" themes must be rewritten for Adobe Commerce.
- Cart2Cart and LitExtension support automated migration.
- Map BigCommerce app integrations to equivalent Adobe Commerce extensions.

---

### 5.5 WooCommerce to Adobe Commerce

- Export via WooCommerce REST API or WordPress Export (WXR + WooCommerce data).
- Map WooCommerce product types (Simple, Variable, Grouped) to Adobe Commerce equivalents.
- WooCommerce WordPress themes must be rebuilt; no automated conversion.
- Migration tools (Cart2Cart, LitExtension) support WooCommerce to Adobe Commerce.
- Map WooCommerce plugins (subscriptions, bookings, memberships) to Adobe Commerce extensions.

---

### 5.6 Custom / Legacy E-Commerce to Adobe Commerce

- Requires custom ETL pipeline development.
- Export data from legacy database (direct SQL access or API if available).
- Transform to Adobe Commerce import CSV format or use REST API.
- Product data: Map to EAV attribute model.
- Customer data: Map to customer entity tables.
- Order data: Import as historical records via custom scripts.
- Payment integrations: Reconfigure with Adobe Commerce payment gateway extensions.

---

## 6. Project Management Migrations

### 6.1 Jira to Adobe Workfront

#### Project/Issue Mapping

| Jira Concept | Workfront Equivalent |
|-------------|---------------------|
| Project | Project |
| Epic | Program or Portfolio |
| Story / Task | Task |
| Sub-task | Subtask |
| Bug | Issue |
| Sprint | Iteration |
| Board (Kanban/Scrum) | Agile Board |
| Backlog | Unplanned Tasks |
| Components | Sections |
| Labels | Tags |
| Versions / Releases | Milestones |
| Custom Fields | Custom Forms |
| Workflow | Status Flow / Approval Process |
| JQL (Jira Query Language) | Workfront Filters |

#### Integration Approach

Adobe provides a Workfront for Jira integration add-on (note: will be deprecated after February 28, 2026, replaced by Workfront Fusion):

- **Unidirectional**: Workfront items can auto-create Jira issues (not the reverse).
- **Field Mapping Considerations**:
  - Date values in Jira are stored as strings; conversion required.
  - Drop-down field names/values may have trailing spaces causing mapping failures.
  - Build a thorough data dictionary from Jira first.

#### Workfront Fusion (Modern Approach)

Eight ready-to-use Jira templates available for Fusion:
- Replicate common workflows.
- Fully customizable and extendable.
- Supports bi-directional sync.

---

### 6.2 Asana to Workfront

- No native migration tool exists.
- Use Workfront Fusion HTTP modules to connect to Asana's API.
- Or use third-party migration services (Omtera).
- Map Asana Projects --> Workfront Projects.
- Map Asana Tasks --> Workfront Tasks.
- Map Asana Sections --> Workfront Sections/Groups.
- Map Asana Custom Fields --> Workfront Custom Forms.
- Map Asana Portfolios --> Workfront Portfolios.
- Export Asana data via API and import via Workfront Kick-Starts (Excel templates).

---

### 6.3 Monday.com to Workfront

- Export Monday.com boards as CSV or use Monday.com API.
- Map Monday.com Boards --> Workfront Projects.
- Map Monday.com Items --> Workfront Tasks.
- Map Monday.com Groups --> Workfront Sections.
- Map Monday.com Columns --> Workfront Custom Form fields.
- Map Monday.com Automations --> Workfront Fusion scenarios.
- Import via Workfront Kick-Starts or API.

---

### 6.4 Smartsheet to Workfront

- Export Smartsheet sheets as Excel/CSV.
- Map Smartsheet Sheets --> Workfront Projects.
- Map Smartsheet Rows --> Workfront Tasks.
- Map Smartsheet Columns --> Workfront Custom Form fields.
- Map Smartsheet Reports --> Workfront Reports.
- Map Smartsheet Dashboards --> Workfront Dashboards.

---

### 6.5 Microsoft Project to Workfront

#### Native Import Support

Workfront provides built-in Microsoft Project import:

1. Save MS Project file as XML format (.xml).
2. In Workfront: New Project > Import MS Project.
3. Upload the XML file.

#### Field Mapping Table

| Microsoft Project Field | Workfront Field |
|------------------------|----------------|
| Project Title | Project Name |
| Start and Finish Dates | Planned Start and Completion Dates |
| Task Name | Task Name |
| Task Duration | Task Planned Duration |
| Task Work | Task Planned Hours |
| Task % Complete | Task % Complete (Duration-based) |
| Task Work % Complete | Task % Complete (Planned Hours-based) |
| Scheduled Start/Finish | Planned Start/Completion Dates |
| Actual Start/Finish | Actual Start/Completion Dates |
| Resource Name | Task Assignment |
| Assignment Units | Assignment Allocation Percentage |
| Task Note | Task Description |
| Predecessor | Predecessor |

#### Limitations

Fields that do NOT transfer:
- Document attachments
- Custom fields
- Issues
- Task constraints
- Negative task lag values
- Comments / notes
- Milestones (as a concept; they import as tasks)

**Important**: Set imported project status to "Planning" for review before going live. Planned dates may not correspond exactly due to scheduling algorithm differences.

---

## 7. DAM Migrations

### 7.1 General DAM to AEM Assets Migration Blueprint

#### ETL Architecture

The recommended architecture follows an Extract-Transform-Load pattern:

1. **Extract**: Pull assets and metadata from the legacy DAM system via API.
2. **Transform**: Map metadata schema from legacy format to AEM metadata schema. This includes:
   - Field name mapping
   - Value transformation (e.g., date formats, controlled vocabularies)
   - Taxonomy mapping (legacy categories to AEM tag namespaces)
   - File format validation
3. **Load**: Import into AEM Assets via:
   - AEM Assets HTTP API
   - Asset Manager API with custom Sling servlets
   - AEM bulk upload tool (for AEM Cloud Service)
   - Content Transfer Tool

#### AEM Assets Bulk Migration API

```
POST /api/assets/{folderPath}/{assetName}
Content-Type: multipart/form-data

Parameters:
- file: Binary asset file
- metadata: JSON metadata object
```

For AEM Cloud Service, use the Bulk Import tool:
- Supports Azure Blob Storage, AWS S3, and Google Cloud Storage as sources.
- Configure via AEM Cloud Manager.
- Handles large-volume ingestion with parallel processing.

---

### 7.2 Bynder to AEM Assets

#### Metadata Mapping Considerations

- Bynder uses a flat metadata schema with configurable metaproperties.
- AEM uses hierarchical metadata schemas with custom schemas per asset type.
- Map Bynder metaproperties to AEM metadata schema fields.
- Bynder's brand guidelines and usage rights metadata must map to AEM's DRM metadata.
- Bynder Collections map to AEM Collections.
- Bynder's Brand Portal functionality maps to AEM Brand Portal.

#### Export Process

1. Use Bynder API to export assets with metadata: `GET /api/v4/media/?type=image&limit=100`
2. Download asset binaries via download URLs.
3. Transform metadata to AEM schema format.
4. Upload to AEM via Assets API or bulk upload tool.

---

### 7.3 Widen to AEM Assets

- Export assets via Widen Collective API.
- Map Widen categories to AEM folder structure or tags.
- Map Widen metadata fields to AEM metadata schema.
- Handle Widen's version history (AEM supports asset versioning).
- Migrate Widen embed codes to AEM Dynamic Media URLs.

---

### 7.4 Canto to AEM Assets

- Export via Canto REST API or bulk download.
- Map Canto albums to AEM folders or collections.
- Map Canto custom fields to AEM metadata schema fields.
- Handle Canto's approval workflows in AEM's DAM workflow system.

---

### 7.5 MediaValet to AEM Assets

- MediaValet provides a cloud-native DAM with AI tagging.
- Export via MediaValet API.
- Map AI-generated tags to AEM Smart Tags (AEM also provides AI tagging).
- Map MediaValet categories to AEM folder taxonomy.

---

### 7.6 Aprimo to AEM Assets

Aprimo provides a native Adobe Experience Manager integration connector:
- Syncs approved assets from Aprimo to AEM automatically or on-demand.
- Can be used as a migration bridge: approve assets in Aprimo, push to AEM.
- For full migration: export via Aprimo API, transform metadata, import to AEM.

---

### 7.7 Google Drive / SharePoint to AEM Assets

#### Bulk Asset Ingestion

**Google Drive:**
1. Use Google Drive API to list and download assets.
2. Export metadata (file name, description, labels) as CSV.
3. Stage files in cloud storage (GCS, S3).
4. Use AEM Bulk Import tool or Content Transfer Tool.

**SharePoint:**
1. Use SharePoint REST API or Microsoft Graph API to access documents.
2. Export document metadata and managed properties.
3. Map SharePoint columns to AEM metadata schema fields.
4. AEM Cloud Service offers a SharePoint connector for ongoing integration.
5. For bulk migration: download files, stage in cloud storage, use Bulk Import.

**Typical Volumes and Processing:**
- Small (< 10,000 assets): Manual upload or API-based, 1-3 days.
- Medium (10,000 - 100,000 assets): Bulk Import tool, 1-2 weeks.
- Large (100,000+ assets): Cloud storage staging + Bulk Import with parallel processing, 2-6 weeks.

---

## 8. Testing / Personalization Migrations

### 8.1 Optimizely to Adobe Target

#### Experiment Migration

| Optimizely Concept | Adobe Target Equivalent |
|-------------------|----------------------|
| Experiment (A/B test) | A/B Test activity |
| Feature test | A/B Test with code-based offers |
| Multivariate test | Multivariate Test (MVT) activity |
| Personalization campaign | Experience Targeting (XT) activity |
| Multi-armed bandit | Auto-Allocate activity |
| Full Stack (server-side) | Server-side delivery API |
| Web Experimentation (client-side) | Visual Experience Composer (VEC) |
| Stats Accelerator | Auto-Allocate statistical model |
| Feature flags | Feature Flag activities (via Target APIs) |
| Environments | Environments (Dev/Stage/Prod) |
| Events (metrics) | Success Metrics (conversion, revenue) |

#### Audience Mapping

- Optimizely audiences (URL targeting, cookies, custom attributes) map to Target audiences.
- Optimizely integrations with third-party data map to Target integrations with AEP segments.
- Optimizely CMAB (contextual multi-armed bandit) partially maps to Target Auto-Target with AI.

#### Feature Flag Migration

- Optimizely Feature Experimentation uses feature flags with remote configuration.
- Adobe Target supports feature flags via JSON offers and delivery API.
- Optimizely's SDK-based flag evaluation maps to Target's server-side decisioning or on-device decisioning.
- Target's on-device decisioning provides <10ms response times for feature flags.

---

### 8.2 VWO to Adobe Target

- VWO's visual editor tests map to Target's Visual Experience Composer (VEC) activities.
- VWO's code editor tests map to Target's Form-Based Experience Composer.
- VWO's heatmaps and session recordings have no direct Target equivalent; consider supplementary tools.
- VWO's surveys/feedback tools have no Target equivalent.
- VWO SmartStats (Bayesian) compares to Target's confidence-based reporting.

---

### 8.3 Dynamic Yield to Adobe Target

- Dynamic Yield's recommendation engine maps to Adobe Target Recommendations.
- Dynamic Yield's audience segmentation maps to Target audiences + AEP segments.
- Dynamic Yield's personalization campaigns map to Target XT (Experience Targeting) activities.
- Dynamic Yield's AI-driven optimization maps to Target Auto-Target.
- Dynamic Yield's API-based personalization maps to Target Delivery API.

---

### 8.4 Google Optimize (Sunset) to Adobe Target

#### Massive Migration Opportunity

Google Optimize and Optimize 360 were sunset on September 30, 2023. Adobe offered promotional pricing for migrating customers.

#### Migration Steps

1. **Data Preservation**: Export all Optimize experiment reports as CSV before sunset (data no longer available).
2. **Experiment Recreation**: Manually recreate experiments in Adobe Target:
   - Simple A/B tests: Use VEC (Visual Experience Composer).
   - Redirect tests: Use Target redirect offers.
   - Personalization: Use Experience Targeting (XT).
3. **Audience Migration**: Recreate Google Optimize audiences in Target:
   - GA audiences linked to Optimize become Target audiences or AEP segments.
   - URL targeting rules map directly.
   - Custom JavaScript conditions map to Target's custom code audiences.
4. **Implementation**: Replace Optimize snippet with Target at.js or Web SDK.
5. **Analytics Integration**: Replace Optimize-GA4 link with A4T (Analytics for Target) integration.

#### Key Advantages of Target over Google Optimize

- Target supports multiple experiences per activity; Optimize 360 allowed only one.
- Target's AI-powered features (Auto-Allocate, Auto-Target, Automated Personalization) exceed Optimize's capabilities.
- Target supports server-side, client-side, and hybrid implementations.
- Typical implementation timeline: 60 days.

---

## 9. Data Format Mappings

### 9.1 Source Data Export Formats by Platform

| Platform | Export Format | API | Notes |
|----------|-------------|-----|-------|
| Google Analytics | CSV, BigQuery (JSON/Avro) | GA4 Data API, BigQuery API | BigQuery export for full event-level data |
| Mixpanel | JSON (NDJSON) | Raw Export API (`/api/2.0/export`) | Event-level export with properties |
| Amplitude | JSON, CSV | Export API | Exports as compressed JSON files |
| Heap | JSON, SQL (warehouse) | Connect API | Data lives in customer's warehouse |
| Snowplow | JSON/Avro/TSV (warehouse) | Direct warehouse access | Self-hosted data, full SQL access |
| Matomo | CSV, JSON | Reporting API | Standard reports or raw log data |
| SFMC | CSV, JSON | REST API, SFTP | Data Extensions export via query or API |
| HubSpot | CSV, JSON | HubSpot API v3 | Contacts, workflows, forms exportable |
| Mailchimp | CSV, JSON | Mailchimp API v3 | Audience export with merge fields |
| Braze | JSON, CSV | REST API, Currents (streaming) | Currents for real-time event streaming |
| Klaviyo | CSV, JSON | Klaviyo API | Profiles and events exportable |
| Shopify | CSV, JSON | Shopify Admin API | Products, customers, orders |
| SFCC | CSV, XML | OCAPI, WebDAV | Product/catalog XML, OCAPI JSON |
| Sitecore | XML (Sitecore packages) | Sitecore API, PowerShell | PowerShell Extensions for bulk export |
| WordPress | XML (WXR), JSON | WP REST API | WXR for full content, API for selective |
| Drupal | JSON, CSV | JSON:API, Views export | Drupal 8+ uses JSON:API natively |
| Contentful | JSON | Content Delivery/Management API | GraphQL also available |
| Jira | CSV, JSON | Jira REST API | Projects, issues, custom fields |
| Bynder | JSON | Bynder API v4 | Assets with metadata |

### 9.2 Adobe Import Methods

| Import Target | Method | Format | Notes |
|--------------|--------|--------|-------|
| Adobe Analytics | Web SDK / AppMeasurement | JavaScript calls | Real-time data collection |
| Adobe Analytics | Data Insertion API | JSON/XML | Server-side or historical data |
| Adobe Analytics | Bulk Data Insertion API | CSV | Large-volume historical imports |
| Adobe Analytics | Data Sources | CSV (FTP upload) | Offline data import |
| Adobe Analytics | Classifications | CSV (FTP or API) | Metadata enrichment |
| AEP | Source Connectors | Varies by connector | 100+ native connectors |
| AEP | Batch Ingestion | CSV, Parquet, JSON | File-based bulk upload |
| AEP | Streaming Ingestion | JSON (XDM) | Real-time via HTTP API |
| AEP | Edge Network | JSON (XDM) | Via Web SDK or Mobile SDK |
| AEM Assets | Assets HTTP API | Multipart form data | Individual asset upload |
| AEM Assets | Bulk Import Tool | Cloud storage staging | S3, GCS, Azure Blob |
| AEM Assets | Content Transfer Tool | CRX packages | AEM-to-AEM migration |
| Adobe Commerce | Import (Admin) | CSV | Products, customers, stock |
| Adobe Commerce | REST/GraphQL API | JSON | Programmatic import |
| Workfront | Kick-Starts | Excel (XLSX) | Bulk data import templates |
| Workfront | API | JSON | REST API for all objects |
| Workfront | MS Project Import | XML | Native import feature |
| Marketo | List Import | CSV | Contact/lead import |
| Marketo | REST API | JSON | Programmatic import |
| Adobe Campaign | Import Workflow | CSV, XML, JSON | Workflow-based import |
| Adobe Campaign | API | JSON (SOAP/REST) | Programmatic import |

### 9.3 Required Transformations

| Source --> Target | Key Transformations |
|-----------------|-------------------|
| GA --> Adobe Analytics | Session-level to hit-level restructuring; custom dimension to eVar mapping; event category/action/label to s.events + eVars |
| GA --> CJA (via BigQuery) | UNNEST hits array (UA); timestamp calculation; XDM schema mapping; _id field creation |
| SFMC --> AJO | Data Extensions to XDM schemas; AMPscript to Handlebars JS; subscriber key to AEP identity namespace |
| Shopify --> Adobe Commerce | Variant products to configurable products; Liquid templates to PHTML; collections to categories |
| Sitecore --> AEM | C#/Razor templates to Java/HTL; SQL Server data to JCR; xDB contacts to AEP profiles |
| WordPress --> AEM | PHP templates to HTL; MySQL content to JCR nodes; shortcodes to components |
| AAM --> RTCDP | Traits to segment rules; ID syncs to Identity Service; demdex UUID to ECID |

### 9.4 Data Validation Requirements

For all migrations:
1. **Record count validation**: Compare source and target record counts.
2. **Field completeness**: Verify all required fields are populated.
3. **Data type validation**: Ensure dates, numbers, and strings match expected formats.
4. **Referential integrity**: Verify relationships between entities are preserved.
5. **Identity validation**: Confirm identity stitching produces expected profile counts (watch for over/under-collapsing).
6. **Business logic validation**: Verify calculated fields, segmentation, and personalization rules produce expected results.
7. **A/B validation**: Run parallel systems and compare outputs for a validation period.

### 9.5 Typical Data Volumes and Processing Times

| Migration Type | Typical Volume | Processing Time |
|---------------|---------------|-----------------|
| Analytics historical data (GA to CJA) | 10M - 10B events | 1-4 weeks |
| Email subscriber data (SFMC to AJO) | 100K - 50M profiles | 1-3 days |
| CMS content (WordPress to AEM) | 1K - 100K pages | 2-8 weeks |
| DAM assets (any to AEM) | 10K - 1M+ assets | 1-6 weeks |
| E-commerce catalog (Shopify to AC) | 1K - 500K products | 1-5 days |
| CDP profiles (any to AEP) | 1M - 100M profiles | 1-4 weeks |
| Project data (Jira to Workfront) | 100 - 10K projects | 1-4 weeks |

### 9.6 Common Data Quality Issues

1. **Duplicate records** across source systems.
2. **Inconsistent date/time formats** between platforms.
3. **Character encoding** issues (UTF-8 vs. Latin-1).
4. **Trailing whitespace** in field values (especially problematic for Jira-Workfront mapping).
5. **Missing required fields** in source data.
6. **Orphaned references** (e.g., products referencing deleted categories).
7. **Consent data gaps** (missing opt-in/opt-out records).
8. **Identity fragmentation** (same user with multiple IDs across systems).
9. **Historical data staleness** (outdated records that should be archived, not migrated).
10. **File format incompatibilities** (e.g., CMYK images in print-oriented DAMs vs. RGB required for web).

---

## 10. Integration Reconnection

### 10.1 CRM Integrations

#### Salesforce CRM to AEP

- AEP provides a native Salesforce source connector.
- **Authentication**: Basic auth will be deprecated January 2026; must migrate to OAuth 2 Client Credential.
- **Prerequisites**: Salesforce account with API access, a Connected App for JWT_BEARER OAuth flow.
- **Setup**: Sources > CRM > Salesforce > provide credentials > map to XDM schema.
- **Sync Mode**: Batch (scheduled ingestion).
- **Objects**: Standard and custom Salesforce objects supported.

#### Microsoft Dynamics to AEP

- AEP provides a native Microsoft Dynamics source connector.
- **Authentication Options**:
  - Basic Authentication (may be blocked by 2FA; not recommended).
  - Service Principal + Key Authentication (recommended).
- **Prerequisites**: Add region-specific IP addresses to Dynamics allowlist.
- **Setup**: Sources > CRM > Microsoft Dynamics > provide credentials > configure dataflow.

#### HubSpot CRM to AEP

- AEP provides a native HubSpot source connector.
- Batch ingestion of contacts, companies, deals, and tickets.

### 10.2 ERP Integrations

#### SAP to AEP

- AEP provides an SAP Commerce destination connector for profile/segment activation.
- For inbound SAP data: Use the Generic REST API source connector or cloud storage source (S3/SFTP) with SAP data extracts.
- SAP CPI (Cloud Platform Integration) can be configured to push data to AEP streaming endpoints.

#### Oracle (NetSuite) to AEP

- AEP provides a native Oracle NetSuite source connector (batch).
- Also provides Oracle Eloqua V2 connector for marketing automation data.

#### NetSuite to AEP

- Native source connector available (batch ingestion).
- Map NetSuite entities to XDM schemas.

### 10.3 Data Warehouse Connections

#### Complete AEP Source Connector List for Data Warehouses

| Data Warehouse | Connector Type | Ingestion Mode |
|---------------|---------------|----------------|
| Snowflake | Native | Batch + Streaming |
| Google BigQuery | Native | Batch |
| Amazon Redshift | Native | Batch |
| Azure Databricks | Native | Batch |
| Azure Synapse Analytics | Native | Batch |
| Azure Data Explorer | Native | Batch |
| Microsoft SQL Server | Native | Batch |
| MySQL | Native | Batch |
| PostgreSQL | Native | Batch |
| Oracle | Native | Batch |
| Teradata Vantage | Native | Batch |
| IBM DB2 | Native | Batch |
| MariaDB | Native | Batch |
| Apache Hive (Azure HDInsight) | Native | Batch |
| Apache Spark (Azure HDInsight) | Native | Batch |
| HP Vertica | Native | Batch |
| GreenPlum | Native | Batch |

#### Federated Audience Composition

Adobe RTCDP and AJO support Federated Audience Composition, allowing practitioners to build audiences using data federated directly from warehouses (Snowflake, BigQuery, Redshift, Databricks, Azure Synapse) without moving all data into AEP.

#### Data Mirror (Change Data Capture)

AEP supports Data Mirror for Azure Databricks, Google BigQuery, and Snowflake, enabling bi-directional data synchronization with change data capture.

### 10.4 Tag Management Migration

#### GTM to AEP Tags Migration Checklist

1. **Inventory**: Document all GTM tags, triggers, variables, and their business purpose.
2. **Data Layer Assessment**: Determine if existing `dataLayer` can be retained or needs XDM transformation.
3. **Extension Installation**: Install AEP Tags extensions (Web SDK, Analytics, Target, Audience Manager).
4. **Data Element Recreation**: Map GTM variables to AEP Tags data elements.
5. **Rule Creation**: Map GTM triggers to AEP Tags rules (events + conditions + actions).
6. **Tag Recreation**: Map GTM tags to AEP Tags actions within rules.
7. **Testing**: Use AEP Debugger and Adobe Experience Platform Assurance for validation.
8. **Parallel Run**: Deploy both GTM and AEP Tags for validation period.
9. **Cutover**: Remove GTM container code after validation.

**Note**: Adobe provides a "Google Data Layer" extension for AEP Tags that can read existing `dataLayer.push()` calls, enabling a phased migration without rebuilding the data layer immediately.

### 10.5 SSO / Identity Provider Migration

#### Adobe Identity Management System (IMS)

Adobe Experience Cloud uses IMS for authentication, supporting:
- **Enterprise ID**: Adobe-managed credentials.
- **Federated ID**: SSO via customer's identity provider.
- **Adobe ID**: Personal Adobe accounts.

#### Supported Identity Providers

- SAML 2.0 compliant IdPs (Azure AD, Okta, OneLogin, PingFederate, ADFS).
- Microsoft Azure AD (direct integration via SAML 2.0).
- Google Workspace (SAML-based SSO).

#### Migration Process

1. **Configure new SAML app** in your IdP for Adobe IMS (do NOT edit existing app as it will overwrite active configuration and cause downtime).
2. **Adobe Admin Console**: Navigate to Settings > Identity > Configure directory.
3. **Choose authentication type**: Federated ID with SAML 2.0.
4. **Configure SAML settings**: Provide IdP metadata URL, certificate, and attribute mapping.
5. **User Migration**: Download user CSV from Admin Console, update identity types, re-upload.
6. **Bulk Migration**: For large organizations, use CSV-based bulk migration of user identity types.

#### AEM-Specific SSO

- AEM as a Cloud Service uses IMS-based SSO for authors.
- AEM publish-side authentication can use SAML 2.0 with external IdPs.
- Configuration: AEM > Tools > Security > SAML 2.0 Configuration.

#### Marketo Identity Migration

When migrating Marketo to Adobe Identity:
- Existing Marketo users transition to Adobe IMS authentication.
- User permissions remain intact.
- SSO configuration moves to Adobe Admin Console.

### 10.6 Third-Party Tool Reconnection

When migrating to Adobe's ecosystem, common third-party integrations that need reconnection:

| Integration Category | Common Tools | Adobe Connection Method |
|---------------------|-------------|----------------------|
| BI / Reporting | Tableau, Power BI, Looker | AEP Query Service, Data Warehouse exports, CJA API |
| Data Enrichment | Clearbit, ZoomInfo, Demandbase | AEP Data Partner connectors (Acxiom, Demandbase, Bombora) |
| Chat / Conversational | Drift, Intercom, LiveChat | Adobe Target for chat personalization, AEP event forwarding |
| Social Media | Hootsuite, Sprout Social | AEP social destinations, Campaign social integrations |
| Customer Support | Zendesk, ServiceNow, Freshdesk | AEP source connectors (Zendesk, ServiceNow native) |
| Payment Processing | Stripe, Square | AEP source connectors (Stripe, Square native) |
| Consent Management | OneTrust, TrustArc | AEP source connector (OneTrust native), consent schema |
| Advertising | Google Ads, Facebook, LinkedIn | AEP advertising destinations (20+ native) |
| Product Analytics | Pendo, Amplitude | AEP source connector (Pendo native, streaming) |
| Loyalty | Custom platforms | Capillary streaming connector or custom API |

### 10.7 Complete AEP Source Connector Catalog (as of 2026)

**Adobe Applications:** Adobe Audience Manager, Adobe Analytics (Classifications + Report Suite), Adobe Campaign, Adobe Commerce, Adobe Data Collection, Marketo Engage

**Advertising:** Google Ads

**Analytics:** Mixpanel, Pendo, RainFocus

**Cloud Storage (Batch):** Amazon S3, Azure Blob, Azure Data Lake Gen2, Azure File Storage, Data Landing Zone, FTP, Google Cloud Storage, Apache HDFS, Oracle Object Storage, SFTP

**Consent & Preferences:** Didomi, OneTrust

**CRM:** Microsoft Dynamics, Salesforce, SugarCRM, Veeva CRM

**Customer Success:** Salesforce Service Cloud, ServiceNow, Zendesk

**Databases:** See data warehouse section above (17 connectors)

**Data & Identity Partners:** Acxiom (ingestion + prospecting), Algolia, Bombora Intent, Demandbase Intent, Merkury Identity Resolution

**E-Commerce:** SAP Commerce, Shopify (batch + streaming)

**Marketing Automation:** Braze, Chatlio, Customer.io, HubSpot, Mailchimp, Oracle Eloqua V2, Oracle NetSuite, PathFactory, Relay, Salesforce Marketing Cloud V2

**Payments:** Square, Stripe

**Streaming:** Amazon Kinesis, Azure Event Hubs, Google PubSub, HTTP API, Snowflake Streaming

**Protocols:** Generic OData, Generic REST API

---

## Appendix A: Migration Timeline Guidelines

| Migration Complexity | Typical Duration | Key Variables |
|---------------------|-----------------|---------------|
| Analytics swap (GA to Adobe Analytics) | 8-16 weeks | Site complexity, number of report suites, custom implementations |
| Full analytics + CJA (GA to CJA) | 6-8 weeks (accelerated) to 16 weeks | Historical data volume, real-time requirements |
| Email platform (SFMC to AJO) | 12-20 weeks | Journey count, template count, data extension complexity |
| CMS (WordPress/Drupal to AEM) | 12-24 weeks | Content volume, custom functionality, multi-site |
| CMS (Sitecore to AEM) | 16-30 weeks | xDB migration, personalization rules, SXA complexity |
| CDP (any to AEP RTCDP) | 8-16 weeks | Data source count, identity complexity, segment count |
| E-Commerce (Shopify to Adobe Commerce) | 12-20 weeks | Catalog size, custom integrations, checkout customizations |
| DAM (any to AEM Assets) | 4-12 weeks | Asset volume, metadata complexity |
| Testing (Optimizely/VWO to Target) | 4-8 weeks | Active experiment count, audience complexity |
| Project Management (Jira to Workfront) | 4-12 weeks | Project count, custom field complexity |

## Appendix B: Risk Factors and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Pre-migration backup, validation scripts, parallel run |
| SEO ranking drop (CMS migration) | High | Comprehensive 301 redirect map, sitemap update, Search Console monitoring |
| Email deliverability drop | High | IP warmup plan, domain authentication, engaged-first strategy |
| Identity resolution errors (CDP) | High | Pre-validated identity strategy, graph analysis, over-collapse monitoring |
| Analytics data gaps | Medium | Parallel tracking period, data validation dashboards |
| User adoption resistance | Medium | Training programs, phased rollout, super-user champions |
| Integration failures | Medium | Integration testing environment, API compatibility checks |
| Consent/compliance gaps | High | Consent data audit, legal review, preference center rebuild |
| Performance degradation | Medium | Load testing, CDN configuration, caching strategy |
| Budget overrun | High | Fixed-scope phases, contingency buffer (20-30%), regular progress reviews |

---

## Sources

### Analytics Migrations
- [Adobe: Migrate data from Google Analytics to CJA](https://experienceleague.adobe.com/en/docs/analytics-platform/using/cja-usecases/third-party/ga/overview)
- [Adobe: Ingest Google Analytics historical data](https://experienceleague.adobe.com/en/docs/analytics-platform/using/cja-usecases/ga/backfill)
- [Adobe: Transitioning to Adobe Analytics from Google Analytics](https://experienceleague.adobe.com/en/perspectives/transitioning-to-adobe-analytics)
- [Adobe: Migrate from AppMeasurement to Web SDK](https://experienceleague.adobe.com/en/docs/analytics/implementation/aep-edge/web-sdk/appmeasurement-to-web-sdk)
- [Softcrylic: Transitioning from GA4 to Adobe CJA](https://softcrylic.com/blogs/transitioning-from-ga4-to-adobe-customer-journey-analytics-a-practical-guide/)
- [Comwrap: CJA Migration Accelerator](https://comwrap.com/en/solutions/adobe-customer-journey-analytics-migration-accelerator)
- [Cardinal Path: Adobe Analytics to GA360 dimension mapping](https://www.cardinalpath.com/blog/migration-from-adobe-analytics-to-google-analytics-360)
- [Mixpanel: Migrating from Adobe Analytics](https://docs.mixpanel.com/docs/migration/adobe-analytics)
- [Amplitude: Migrate from Adobe](https://amplitude.com/docs/migration/migrate-from-adobe)
- [Snowplow: Migrate from Adobe Analytics](https://docs.snowplow.io/docs/migration-guides/adobe-analytics/)

### Email / Marketing Automation
- [Softcrylic: Migrating to Adobe Journey Optimizer](https://www.softcrylic.com/migrating-to-adobe-journey-optimizer/)
- [Credera: AJO vs SFMC Feature Comparison](https://www.credera.com/en-gb/insights/ajo-vs-sfmc-feature-comparison)
- [Adobe: IP warmup deliverability guide](https://experienceleague.adobe.com/en/docs/journey-optimizer/using/configuration/implement-ip-warmup-plan/ip-warmup-deliverability-guide)
- [Adobe: Increase email reputation with IP warming](https://experienceleague.adobe.com/en/docs/deliverability-learn/deliverability-best-practice-guide/additional-resources/generic-resources/increase-reputation-with-ip-warming)
- [Stack Moxie: HubSpot to Marketo Migration](https://www.stackmoxie.com/resources/migration-guides/hubspot-to-marketo-migration/)
- [Stack Moxie: Pardot to Marketo Migration](https://www.stackmoxie.com/resources/migration-guides/pardot-to-marketo-migration/)
- [Adobe Experience League: SFMC to AJO template migration](https://experienceleaguecommunities.adobe.com/t5/journey-optimizer-questions/steps-for-migrating-email-templates-from-sfmc-to-ajo/m-p/770586)

### CMS Migrations
- [Axamit: WordPress, Drupal, Sitecore to AEM Migration](https://axamit.com/blog/adobe-experience-manager/migration-to-aem/)
- [Rebellion Design: WordPress to AEM Cloud Service](https://www.thisisarebellion.com/blog-articles/upgrading-from-wordpress-to-aemr-as-a-cloud/)
- [Adobe: Sitecore to AEM community reference](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-manager/sitecore-to-aem-cloud-migration-reference-implementation/td-p/721359)
- [AEM Experts: Drupal to AEM Migration Approach](https://aemexperts.blogspot.com/2018/04/drupal-cms-to-aem-cms-migration-approach.html)
- [Adobe: AEM Headless with GraphQL](https://experienceleague.adobe.com/en/docs/experience-manager-learn/getting-started-with-aem-headless/graphql/overview)

### CDP / DMP Migrations
- [Nextrow: AAM to Adobe RTCDP Migration Guide](https://www.nextrow.com/blog/rt-cdp/a-comprehensive-migration-guide-adobe-audience-manager-to-adobe-real-time-cdp)
- [Adobe: Evolution from Audience Manager to RTCDP](https://experienceleague.adobe.com/en/docs/experience-platform/rtcdp/evolution/aam-to-rtcdp)
- [Adobe: RTCDP Migration Readiness](https://experienceleague.adobe.com/en/docs/events/adobe-customer-success-webinar-recordings/2024/rtcdp-migration-readiness)
- [Hightouch: Adobe Audience Manager Retirement](https://hightouch.com/blog/adobe-audience-manager)
- [Tealium: Adobe Experience Platform Connector](https://docs.tealium.com/server-side-connectors/adobe-aep-connector/)

### E-Commerce
- [Elogic: Shopify to Magento Migration](https://elogic.co/blog/migrate-shopify-to-magento/)
- [MGT Commerce: Shopify to Magento 2 Migration](https://www.mgt-commerce.com/blog/shopify-to-magento-2-migration/)
- [Adobe Marketplace: Cart2Cart Migration from Shopify](https://commercemarketplace.adobe.com/magneticone-cart2cart-migration-from-shopify.html)
- [IWD: Magento Migration Services](https://www.iwdagency.com/pages/magento-migration-services)

### Project Management
- [Adobe: Import project from Microsoft Project](https://experienceleague.adobe.com/en/docs/workfront/using/manage-work/projects/create-projects/import-project-from-ms-project)
- [Adobe: Map MS Project fields to Workfront](https://experienceleague.adobe.com/en/docs/workfront/using/manage-work/projects/manage-projects/map-ms-project-fields-to-workfront)
- [Adobe: Configure Workfront for Jira](https://experienceleague.adobe.com/en/docs/workfront/using/adobe-workfront-integrations/workfront-for-jira/configure-workfront-for-jira)
- [LeapPoint: Data Migration Best Practices for Workfront](https://leappoint.com/blog/data-migration-best-practices-for-adobe-workfront/)

### DAM
- [Adobe: Migrate assets in bulk](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/assets/administer/assets-migration-guide)
- [Achim Koch: AEM Assets Migration Blueprint](https://medium.com/@achimkoch/a-blueprint-to-migrate-any-dam-to-aem-assets-f07ac7f0ad72)
- [Adobe Community: Bynder to AEM DAM](https://experienceleaguecommunities.adobe.com/adobe-experience-manager-assets-9/bynder-to-aem-dam-feasibility-best-practices-challenges-249217)
- [Aprimo: AEM Integration for DAM](https://www.aprimo.com/marketplace/adobe-experience-manager-integration-for-dam)

### Testing / Personalization
- [Adobe: Target for Google Optimize customers](https://business.adobe.com/blog/the-latest/adobe-target-offers-a-path-to-personalization-at-scale-for-google-optimize-customers)
- [Axamit: Google Optimize Sunset and Adobe Target](https://axamit.com/blog/adobe-target/google-optimize-sunset/)

### Integration / Identity
- [Adobe: Source Connectors Overview](https://experienceleague.adobe.com/en/docs/experience-platform/sources/home)
- [Adobe: Salesforce Source Connector](https://experienceleague.adobe.com/en/docs/experience-platform/sources/connectors/crm/salesforce)
- [Adobe: Microsoft Dynamics Source Connector](https://experienceleague.adobe.com/en/docs/experience-platform/sources/connectors/crm/ms-dynamics)
- [Adobe: Snowflake Source Connector](https://experienceleague.adobe.com/en/docs/experience-platform/sources/connectors/databases/snowflake)
- [Adobe: Set up user identity and SSO](https://helpx.adobe.com/enterprise/using/set-up-identity.html)
- [Adobe: Migrate to a new authentication provider](https://helpx.adobe.com/enterprise/using/migrate-authentication-provider.html)
- [Adobe: GTM to AEP Tags migration discussion](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-platform-data/migrate-from-gtm-google-tag-manager-to-launch/m-p/389714)
