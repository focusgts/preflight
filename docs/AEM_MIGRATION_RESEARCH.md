# AEM Migration Paths - Comprehensive PRD Research

## Table of Contents

1. [AEM On-Prem to AEM as a Cloud Service Migration](#1-aem-on-prem-to-aem-as-a-cloud-service-migration)
2. [AEM 6.x Version Upgrades](#2-aem-6x-version-upgrades)
3. [AEM Managed Services to Cloud Service](#3-aem-managed-services-to-cloud-service)
4. [Non-AEM CMS to AEM Migration](#4-non-aem-cms-to-aem-migration)
5. [AEM Edge Delivery Services Migration](#5-aem-edge-delivery-services-migration)
6. [Migration Testing](#6-migration-testing)
7. [Common Migration Failures](#7-common-migration-failures)

---

## 1. AEM On-Prem to AEM as a Cloud Service Migration

### 1.1 Official Adobe Tools

#### 1.1.1 Best Practices Analyzer (BPA)

**Purpose**: Assesses source AEM environments (6.3, 6.4, 6.5, AMS, on-premise) to identify compatibility issues before migrating to AEM as a Cloud Service. Non-destructive scan; does not modify content or configuration.

**What It Scans**:
- Repository content and node structures
- Code packages and OSGi bundles
- OSGi configurations (deprecated formats, restricted APIs)
- Custom Oak indexes (incompatible definitions)
- Content structures (mutable vs. immutable violations)
- Deprecated APIs and unsupported features
- Classic UI dialog usage
- Replication agent configurations
- Custom authentication handlers
- Workflow definitions and process steps
- Third-party library compatibility
- Run mode configurations

**Report Format**:
- CSV format output sorted by category type, sub-type, and importance level
- Compatible with Microsoft Excel and similar tools for analysis
- Built on AEM Pattern Detector output
- Structured by Finding Categories with: category name, sub-types, finding count, importance, summary, links to documentation, and individual finding details

**Importance Levels**:
| Level | Description |
|-------|-------------|
| **Critical** | Very likely to be an upgrade issue; must be addressed to prevent loss of function or performance |
| **Major** | Likely an upgrade issue that should be addressed |
| **Advisory** | Potentially an upgrade issue; further investigation recommended |
| **Info** | Informational; no action required |

**Pattern Detectors** (key categories):
| Detector Code | Description |
|---------------|-------------|
| ACV | Assets Content Validator - missing obligatory node/property |
| ASO | AEM System Overview - general system information |
| CAV | Content Area Violation - content in wrong area (mutable/immutable) |
| CCL | Custom Client Libraries - clientlibs on /libs |
| CCOM | Custom Component - components overlaying /libs |
| CTEM | Custom/Static Template - static templates still in use |
| DM | Dynamic Media usage detection |
| DOPI | Deprecated Ordered Property Index |
| ECU | Usage of Externalizer Configuration |
| FORM | Forms compatibility |
| INST | Custom install artifact detection |
| IOI | Import Order Issues |
| LOCP | Local Package Detection |
| LUI | Lucene Index usage issues |
| MI | Misconfiguration Issues |
| MSM | Multi Site Manager configurations |
| NBCC | Non-Backwards Compatible Changes |
| NCC | Non-Compatible Configuration |
| OAK | Oak configuration and index issues |
| OAUI | Old Authoring UI usage (Classic UI) |
| PCX | Page Complexity |
| REP | Replication Agent configuration |
| UMI | Upgrade Misconfiguration Issues |
| URC | Unicode Resource Concerns (v2.1.50+) |
| URS | Unsupported Repository Structure |
| WRK | Workflow usage issues |

**Best Practices**:
- Run BPA regularly during refactoring, not just once at the start
- As issues are fixed, new ones may surface; iterative scanning is critical
- Upload BPA report to Cloud Acceleration Manager for guided remediation
- Version 2.1.50+ adds detection of Unicode character issues in large nodes

---

#### 1.1.2 Content Transfer Tool (CTT)

**How It Works**:
The CTT automates transfer of content and user groups from source AEM instance to AEM Cloud Service. It operates in two distinct phases.

**Phase 1 - Extraction**:
- Extracts content from the source AEM instance
- Stores extracted content in a cloud-based migration set (temporary blob storage)
- Runs on the source AEM instance
- Can extract from Author or Publish tier independently
- Supports incremental/differential extraction (top-up)
- For migration sets >200GB, automatic pre-copy via AzCopy is triggered
- Pre-copy supports File Data Store, Amazon S3, and Azure Data Store types

**Phase 2 - Ingestion**:
- Ingests content from the migration set into the target AEM Cloud Service environment
- Two modes:
  - **Wipe mode** (recommended): Deletes existing repository on target, then ingests migration set data. Faster and cleaner.
  - **Non-wipe mode**: Applies migration set on top of current content. Slower, used for incremental updates.
- Runs in AEM Cloud Service infrastructure

**Content Size Limits**:
| Constraint | Limit |
|------------|-------|
| Max JCR nodes (Author) | 750 million |
| Max repository size (Author, online compacted) | 500 GB |
| Max repository size (Publish) | 50 GB |
| Max File Data Store content | 20 TB |
| Max node property value (MongoDB) | 16 MB |

For content exceeding these limits, create a support ticket with Adobe Customer Care.

**Limitations**:
- Does NOT migrate users (only groups); users must be provisioned via IMS/Admin Console
- Version history is NOT migrated by default (can be configured but significantly increases migration time)
- Workflow instances and history are not transferred
- Audit logs are not migrated
- Closed User Group (CUG) policies need special handling
- Dynamic Media assets require separate Scene7 migration
- ACLs and permissions may need post-migration adjustment
- Large binary assets can cause timeout issues without pre-copy
- Content referencing deprecated node types may fail validation
- Properties exceeding 16MB must be converted to Binary values before extraction

**Supported Source Versions**: AEM 6.3+, AEM 6.4+, AEM 6.5+, AMS environments

**Performance Guidelines**:
- Run Revision Cleanup on source before extraction
- Run data store consistency checks to reduce repository size
- Use the CTT Calculator in Cloud Acceleration Manager for time estimates
- For large repositories, schedule extraction during off-peak hours
- Network bandwidth between source and Azure blob storage is the primary bottleneck

---

#### 1.1.3 Repository Modernizer

**Purpose**: Restructures existing project packages by separating content and code into discrete packages compatible with AEM Cloud Service.

**What It Does**:
- Splits monolithic content packages into the required AEM Cloud Service structure:
  - `ui.apps` - Code Package: all code deploying to `/apps` (immutable)
  - `ui.config` - OSGi Configuration Package: all OSGi configurations
  - `ui.content` - Content Package: all content and mutable configuration
  - `all` - Container package embedding core bundles and above packages
- Converts `/etc` content to `/conf` and `/apps` paths
- Restructures filter definitions
- Creates proper embedding relationships

**Why It Is Required**:
AEM Cloud Service requires separation of content and code. A single content package cannot deploy to both `/apps` and runtime-writable areas (`/content`, `/conf`, `/home`). This separation enables zero-downtime deployments and rolling updates.

**Access Methods**:
- Via Adobe I/O CLI: `aio-cli-plugin-aem-cloud-service-migration`
- As standalone Node.js utility: `@adobe/aem-cs-source-migration-repository-modernizer` (npm)

**Key Restructuring Rules**:
| Old Path | New Path | Notes |
|----------|----------|-------|
| `/etc/designs` | `/apps/<project>/components/page/design` | Design nodes to component policies |
| `/etc/clientlibs` | `/apps/<project>/clientlibs` | Client libraries |
| `/etc/tags` | `/content/cq:tags` | Taxonomy content |
| `/etc/cloudservices` | `/conf/<project>/settings/cloudconfigs` | Cloud service configs |
| `/etc/blueprints` | `/apps/msm/<project>` | MSM blueprints |
| `/etc/workflow/models` | `/var/workflow/models` or `/conf` | Workflow models |
| `/etc/dam/video` | `/libs/settings/dam/video` | Video profiles |

---

#### 1.1.4 AEM Modernization Tools

**Purpose**: Suite of tools for converting legacy AEM constructs to modern equivalents. Hosted at `github.com/adobe/aem-modernize-tools`.

**Four Core Conversions**:

1. **Dialog Conversion Tool**:
   - Converts Classic UI dialogs (ExtJS-based) to Touch UI (Coral 3 / Granite UI)
   - Converts Coral 2 dialogs to Coral 3
   - Rule-based conversion with extensible custom rules
   - Does NOT modify original dialogs; creates new parallel dialogs
   - Manual review required for complex widget mappings

2. **Policy Conversion Tool**:
   - Converts design nodes (`/etc/designs`) into editable template policies
   - Maps design cell configurations to policy definitions
   - Creates policy mappings in `/conf` structure

3. **Page Template Conversion Tool**:
   - Converts static templates to editable templates
   - Converts old container types to responsive layout containers
   - Maps `cq:Template` to editable template definitions
   - Preserves initial content and structure definitions

4. **Component Conversion Tool** (Foundation to Core Components):
   - Maps AEM Foundation Components to Core Components equivalents
   - Handles property mapping between different component models
   - Extensible with custom mapping rules

**Important**: The tools convert content/configuration, not code. The code behind new features must be created first; then the tools migrate content to reference the new code.

---

#### 1.1.5 Cloud Acceleration Manager (CAM)

**Purpose**: Cloud-based application guiding the entire migration journey with Adobe-recommended best practices, documentation, and tools.

**Phase 1 - Readiness**:
- Upload and analyze BPA reports
- Assess migration complexity and effort
- Provision AEM as a Cloud Service through Cloud Manager
- Define governance model for cloud application
- Plan project resources based on assessment findings
- Review pattern detector findings with guided remediation

**Phase 2 - Implementation**:
- Code refactoring guidance and tracking
- Content migration with CTT integration
- Deploy application to AEM Cloud Service
- Content Transfer Tool Calculator for time estimation
- Dispatcher conversion guidance
- Index conversion tracking

**Phase 3 - Go-Live**:
- Content and code freeze planning
- Go-live checklist (nothing overlooked)
- Security testing guidance
- Performance testing guidance
- Final content migration (delta/top-up)
- DNS cutover planning
- CDN configuration

**Phase 4 - Optimization** (post-go-live):
- Modernization best practices catchup
- Performance tuning recommendations
- Monitoring and alerting setup
- Continuous improvement tracking

**Project Management Features**:
- Multiple migration projects supported
- Dashboard view across all phases
- Team collaboration capabilities
- Progress tracking and reporting

---

#### 1.1.6 AEM Dispatcher Converter

**Purpose**: Converts on-premise or AMS Dispatcher configurations to AEM Cloud Service-compatible configurations.

**Key Differences (On-Prem vs. Cloud)**:
| On-Prem/AMS | Cloud Service |
|-------------|---------------|
| Apache HTTP Server with mod_dispatcher | Apache HTTP Server in Docker container |
| Custom VirtualHost configurations | Standardized VirtualHost structure |
| Flexible directory structure | Fixed directory structure (`conf.d/`, `conf.dispatcher.d/`) |
| Custom rewrite rules anywhere | Rewrite rules in specific files only |
| Any Apache module | Limited set of allowed modules |
| Manual cache invalidation | CDN-based caching with Fastly integration |
| Direct server access for debugging | Cloud Manager logs and debugging |

**Execution Modes**:
- AMS mode: `node main.js` - for Adobe Managed Services configurations
- On-Premise mode: `node singleFileMain.js` - for on-premise configurations
- Output: `target/dispatcher/src/` with restructured project

**Post-Conversion**:
- Run Dispatcher Validator on converted configurations
- Validate locally before pushing to Cloud Manager
- Test cache behavior with new CDN-based architecture
- Verify rewrite rules work with Fastly CDN layer

**Technology**: Developed in Node.js, available as npm package `@adobe/aem-cs-source-migration-dispatcher-converter`

---

#### 1.1.7 Index Converter

**Purpose**: Migrates custom Oak Index Definitions from AEM 6.3+ to Cloud Service-compatible definitions.

**What It Converts**:
- Only `lucene` type Custom Oak Index Definitions
- Indexes present under `/apps` or `/oak:index`
- Does NOT convert `nt:base` indexes

**Conversion Process**:
1. Parses Custom OOTB Oak Index Definition
2. Fetches associated OOTB Index Definition for the specified AEM version
3. Compares to find user customizations (delta)
4. Validates customizations against Cloud Service guidelines
5. Merges validated customizations into Cloud Service-compatible index definition

**Lucene to Elasticsearch Considerations**:
- AEM Cloud Service uses Elasticsearch internally for some indexes (e.g., `damAssetLucene`)
- Customers do not configure Elasticsearch directly
- For cloud-deployed indexes of type `elasticsearch`:
  - Change `type` property to `lucene`
  - Change `async` property to `[async, nrt]`
  - Set `similarityTags` to `true`
- Queries written against Lucene indexes may execute against Elasticsearch transparently

**Deployment**:
- Copy converted index definitions to `/oak:index` in `ui.apps` package
- Update `filter.xml` with index definition filter paths
- Deploy through Cloud Manager pipeline

---

#### 1.1.8 Asset Workflow Migration Tool

**Purpose**: Migrates traditional DAM Update Asset workflows to use Asset Compute microservices in AEM Cloud Service.

**What Changes**:
| On-Prem/AMS | Cloud Service |
|-------------|---------------|
| DAM Update Asset workflow with custom steps | Asset Compute microservices (external) |
| Workflow launchers for processing | Auto-triggered post-processing workflows |
| Local rendition generation | Cloud-based rendition generation |
| ImageMagick, FFmpeg on server | Asset Compute workers (serverless) |
| Custom Java process steps | Asset Compute custom workers (JavaScript) |

**Migration Output**:
- Custom processing profiles for Asset Microservices
- Modified workflow containing only Cloud Service-compatible steps
- OSGi configuration to execute compatible workflow steps
- Removal of all unsupported steps
- Addition of `DAM Update Asset Workflow Completed` process step

**Custom Workflow Handling**:
- Custom process steps that cannot be externalized run via Custom Workflow Runner service
- Post-processing workflows auto-execute after microservices processing completes
- No manual workflow launcher configuration needed
- Complex workflows may require manual adjustment after tool execution

**Tool**: Available via `adobe/aem-cloud-migration` on GitHub

---

#### 1.1.9 AIO-CLI Content Transfer Plugin

**Purpose**: Unified Adobe I/O CLI plugin aggregating all migration tools into a single command-line interface.

**Available Commands**:
```
aio aem-migration:dispatcher-converter    # Convert Dispatcher configs
aio aem-migration:repository-modernizer   # Restructure project packages
aio aem-migration:index-converter         # Convert Oak indexes
aio aem-migration:all                     # Run all converters
```

**GitHub**: `adobe/aio-cli-plugin-aem-cloud-service-migration`

**Prerequisites**:
- Node.js 10+ installed
- Adobe I/O CLI installed (`npm install -g @adobe/aio-cli`)
- Plugin installed (`aio plugins:install @adobe/aio-cli-plugin-aem-cloud-service-migration`)

---

### 1.2 Key Migration Challenges

#### 1.2.1 OSGi Configuration Migration

**From**: `sling:OsgiConfig` nodes, `.cfg`, `.config`, XML formats under `/apps/*/config`
**To**: `.cfg.json` format in `ui.config` package

**Key Changes**:
- All OSGi configs must use `.cfg.json` JSON-based format
- Configs stored in runmode-specific folders: `config.author`, `config.publish`, `config.author.dev`, `config.publish.prod`, etc.
- No Felix Web Console access for runtime config changes
- Secret values use Cloud Manager environment variables with `$[secret:VARIABLE_NAME]` syntax
- Standard variables use `$[env:VARIABLE_NAME]` syntax
- Cannot create custom run modes; must use environment-specific folders + environment variables

**Supported Run Mode Configurations**:
```
config
config.author / config.publish
config.author.dev / config.author.rde / config.author.stage / config.author.prod
config.publish.dev / config.publish.rde / config.publish.stage / config.publish.prod
config.dev / config.rde / config.stage / config.prod
```

#### 1.2.2 Custom OSGi Bundles and Restricted APIs

- Bundles using `com.day.cq` internal APIs may break
- `org.apache.sling.jcr.api.SlingRepository.loginAdministrative()` is deprecated; use `loginService()` with service user mappings
- `SlingSettingsService.getRunModes()` returns only `author` or `publish` (no environment indicator)
- ARM-based VMs in Cloud Service can break native libraries compiled for x86-64 (e.g., WebP image processing)
- Third-party JARs must be embedded in the project; no manual installation to `crx-quickstart/install`

#### 1.2.3 Mutable vs. Immutable Content Separation

**Immutable (deployed via pipeline only)**:
- `/apps` - Application code, component definitions, clientlibs
- `/libs` - AEM product code (cannot be overlaid in Cloud Service)
- `/oak:index` - Index definitions

**Mutable (runtime-writable)**:
- `/content` - Site content, DAM assets
- `/conf` - Editable templates, cloud configurations, Context-Aware configs
- `/home` - Users and groups
- `/var` - Workflow instances, audit logs
- `/etc` - Legacy configs (most should be migrated to `/conf` or `/apps`)
- `/tmp` - Working area

**Critical Rule**: A single content package CANNOT deploy to both `/apps` and any mutable area.

#### 1.2.4 Custom Workflow Migration

- Traditional DAM Update Asset workflow process steps are replaced by Asset Compute microservices
- Custom Java-based workflow process steps must be evaluated:
  - Can it be externalized? Convert to Asset Compute worker
  - Must it run on AEM? Use Custom Workflow Runner
  - Is it a rendition generation step? Use Processing Profiles
- Workflow launchers are replaced by auto-triggered post-processing
- Transient workflows behave differently in Cloud Service

#### 1.2.5 Dispatcher Configuration Differences

| Aspect | On-Prem/AMS | Cloud Service |
|--------|-------------|---------------|
| Web Server | Apache HTTP Server (bare metal/VM) | Apache in Docker container |
| Cache Management | Manual invalidation, stat files | CDN-based (Fastly), automated |
| SSL/TLS | Managed on Apache/load balancer | Managed by Adobe CDN |
| Rewrite Rules | Flexible placement | Must be in designated files |
| Apache Modules | Any module | Restricted set only |
| Configuration Structure | Flexible | Fixed structure required |
| Debugging | Direct server access, logs | Cloud Manager Log Forwarding |
| Traffic Management | Apache-level | CDN-level traffic filtering |

#### 1.2.6 Custom Search Indexes

- On-prem Lucene indexes are converted to Cloud Service format
- Some indexes run against Elasticsearch transparently
- `damAssetLucene` may execute on Elasticsearch in Cloud Service
- Fulltext search index definitions must follow Cloud Service constraints
- Index definitions deploy through `ui.apps` package
- Blue-green deployment model means index changes are non-blocking
- Property indexes and Lucene indexes have different migration paths

#### 1.2.7 Replication to Sling Content Distribution

**On-Prem**: Replication agents push content from Author to Publish
**Cloud Service**: Sling Content Distribution with journal-based pipeline

- Pipeline service runs on Adobe I/O Runtime
- Shared blob store with journaled publication events
- Publish instances subscribe to journal for receiving events
- New publish instances restore state from journal history
- No replication agent configuration; content distribution is automatic
- Forward replication, reverse replication, and custom replication agents are not supported
- Content invalidation uses Sling Content Distribution (not Dispatcher flush agents)

#### 1.2.8 Custom Authentication Handlers

- AEM Cloud Service mandates Adobe IMS for Author tier authentication
- Custom SAML/SSO handlers for Author are NOT supported; IMS is the only option
- Publish tier can use custom authentication via Sling Authentication APIs
- Custom login pages on Publish can use IMS Login components
- `AuthenticationHandler` interface implementation is still valid for Publish
- `Adobe Granite Login Selector Authentication Handler` can customize login page
- Closed User Groups (CUGs) work differently; must be reconfigured

#### 1.2.9 Third-Party Library Compatibility

- ARM-based VMs may break native libraries (confirmed issues with WebP rendering libraries)
- All third-party JARs must be embedded in Maven project (no runtime installation)
- Some libraries referencing `sun.*` packages will fail
- JDBC drivers and native connectors need Cloud Service-compatible versions
- HIPAA-restricted environments cannot use Dynamic Media Scene7

#### 1.2.10 Run Modes

**On-Prem**: Custom run modes supported (e.g., `config.mycompany`, `config.production.us-east`)
**Cloud Service**: Fixed set only

```
author, publish                          # Service type
dev, rde, stage, prod                    # Environment type
author.dev, author.stage, author.prod    # Combined
publish.dev, publish.stage, publish.prod # Combined
```

- `SlingSettingsService.getRunModes()` returns only service type (author/publish)
- Use Cloud Manager environment variables for environment-specific config
- No custom run modes; all variation must use environment variables

#### 1.2.11 Granite UI to React Spectrum

- AEM Cloud Service admin UIs are progressively migrating to React Spectrum
- Extensions use App Builder with React and React Spectrum UI library
- JAM stack (JavaScript, APIs, Markup) for local development
- Granite UI still works but new extension points use React Spectrum
- Custom admin panels may need rewriting for new extension framework

---

### 1.3 Content Migration Details

#### 1.3.1 JCR Node Types and Restrictions

- `nt:unstructured` remains the most flexible and commonly used
- `sling:Folder` and `sling:OrderedFolder` for structure
- `dam:Asset` and `dam:AssetContent` for assets
- Some custom node types may not be registered in Cloud Service
- `rep:ACL` and `rep:GrantACE` for access control
- Node names with special characters may cause issues
- Path length limits are more strictly enforced

#### 1.3.2 Binary Storage

**On-Prem**: File Data Store or S3 Data Store (configurable)
**Cloud Service**: Azure Blob Store (managed by Adobe)

- Binaries are stored separately from the JCR node tree
- CTT pre-copy feature uses AzCopy for efficient binary transfer
- Deduplication handled differently between environments
- No direct access to blob store in Cloud Service

#### 1.3.3 Version History Migration

- Version history is NOT migrated by default
- Can be enabled but significantly increases:
  - Extraction time (can multiply by 3-10x depending on version depth)
  - Migration set size
  - Ingestion time
- Recommendation: Migrate only current versions; archive version history separately
- Version purge on source before migration reduces complexity

#### 1.3.4 Large Repository Migration Strategies (>100GB)

1. **Pre-copy with AzCopy**: Automatically triggered for migration sets >200GB
2. **Phased migration**: Migrate content trees independently
3. **Content cleanup first**: Run Revision Cleanup, purge versions, remove unused assets
4. **Differential top-ups**: Use incremental extraction after initial full migration
5. **Parallel extraction**: Extract Author and Publish independently
6. **Off-peak scheduling**: Run extraction during low-traffic periods
7. **Network optimization**: Ensure high-bandwidth connection between source and Azure

#### 1.3.5 User/Group Migration and IMS Integration

**Users**:
- NOT migrated by CTT
- Must be provisioned in Adobe Admin Console
- Authenticated via Adobe IMS (Identity Management System)
- Auto-created in AEM on first IMS login
- Local AEM users are NOT supported on Author

**Groups**:
- Migrated by CTT (groups associated with migrated content)
- Must also be added to IMS for proper functioning
- IMS User Groups manage permissions via Admin Console
- IMS Groups must be made members of AEM ACL groups on Security Console
- Group nesting and inheritance may need adjustment

**Migration Process**:
1. Identify all groups and permissions in source AEM
2. Migrate groups via CTT
3. Create corresponding IMS groups in Admin Console
4. Map IMS groups to AEM groups
5. Add users to IMS groups
6. Verify ACL inheritance and permissions post-migration

#### 1.3.6 Dynamic Media / Scene7 Migration

- AEM Cloud Service supports ONLY Dynamic Media Scene7 mode
- If source is Dynamic Media Hybrid mode, migration to Scene7 is required first
- Feature Pack 18912 enables bulk ingestion/migration from Hybrid to Scene7
- Assets sync from AEM to Dynamic Media for processing and publishing
- Dynamic Media is NOT HIPAA-ready and cannot run with Enhanced Security (April 2025+)
- Smart Crop, Image Presets, Video Profiles must be validated post-migration

#### 1.3.7 Content Fragment Migration

- Content Fragment Templates are deprecated; must convert to Content Fragment Models
- Content Fragment Models define structured content schemas
- Models are stored under `/conf/<project>/settings/dam/cfm/models`
- Existing Content Fragments referencing templates need model migration
- GraphQL schemas are auto-generated from Content Fragment Models
- Variations and metadata migrate with the fragment content

#### 1.3.8 Experience Fragment Migration

- Experience Fragments migrate as content under `/content/experience-fragments`
- Target integration references may need reconfiguration
- Building blocks and variations transfer with parent fragment
- Social media variations need validation post-migration
- Template associations must reference editable templates (not static)

---

### 1.4 Code Migration Details

#### 1.4.1 Maven Project Structure (Archetype 35+)

**Required Module Structure**:
```
project/
  all/                    # Container package
  core/                   # Java bundle (Sling Models, OSGi services, servlets)
  ui.apps/                # Immutable code (/apps overlays, component definitions)
  ui.apps.structure/      # Package structure definition for /apps
  ui.config/              # OSGi configurations (.cfg.json files)
  ui.content/             # Mutable content (/content, /conf initial content)
  ui.frontend/            # Front-end module (webpack, SASS, TypeScript)
  ui.tests/               # Integration tests
  it.tests/               # Integration test module
  dispatcher/             # Dispatcher configuration
```

**Key POM Changes**:
- Parent POM must reference `aem-sdk-api` instead of `uber-jar`
- Cloud Service SDK dependency: `com.adobe.aem:aem-sdk-api:<version>`
- Remove all `com.day.cq` and `com.adobe.granite` compile-scope dependencies
- Use `filevault-package-maven-plugin` (not `content-package-maven-plugin`)
- All packages must declare `packageType` (application, content, container)

#### 1.4.2 Sling Models Compatibility

- Sling Models API is compatible across AEM 6.5 and Cloud Service
- `@Model` annotation, adaptable types, and injection annotations work the same
- `SlingHttpServletRequest` and `Resource` adaptables are unchanged
- `@Self`, `@ValueMapValue`, `@ChildResource`, `@OSGiService` work the same
- `@Inject` with `@Source` annotations are compatible
- Test with AEM Cloud Service SDK locally before deployment
- `SlingSettingsService` usage in Sling Models must account for limited run modes

#### 1.4.3 HTL/Sightly Version Differences

- AEM Cloud Service uses latest HTL specification
- `data-sly-use`, `data-sly-list`, `data-sly-repeat`, `data-sly-test` all compatible
- `data-sly-resource` with `resourceType` option unchanged
- HTL block statements are forward-compatible
- Some deprecated expressions or Java Use-API patterns may need updating
- Always prefer HTL Use-API (`data-sly-use`) over JSP or server-side includes
- `data-sly-include` for script includes remains supported

#### 1.4.4 Client Library (clientlib) Changes

- Clientlibs must be under `/apps` (not `/etc/clientlibs`)
- Proxy pattern required: set `allowProxy=true` and serve from `/etc.clientlibs/`
- Long-term caching with content hashes enabled by default
- CSS/JS minification handled by Cloud Service pipeline
- Theming support via `ui.frontend` module with webpack
- Client-side libraries must not reference `/libs` directly

#### 1.4.5 Content Services / Headless API Changes

**JSON Exporter**: Compatible across versions; Sling Model Exporter annotation works the same

**GraphQL API**:
- Available in AEM Cloud Service for Content Fragment delivery
- Read-only API (use REST for CRUD operations)
- Persisted queries recommended for CDN/Dispatcher caching
- GraphQL endpoints are automatically available per Content Fragment Model
- GraphiQL IDE available for development and testing
- Queries can be cached at Dispatcher and CDN layers

**Content Services**:
- AEM Content Services remain available but GraphQL is preferred for headless
- JSON export via `.model.json` selector still works

#### 1.4.6 SPA Editor Compatibility

- SPA Editor (React and Angular) is supported in Cloud Service
- `@adobe/aem-react-editable-components` and `@adobe/aem-angular-editable-components` compatible
- `ModelManager` initialization unchanged
- Remote SPA pattern supported
- SPA component mapping to AEM components works the same
- Server-side rendering (SSR) considerations for Cloud Service
- Recommended for new projects using SPA frameworks with AEM authoring

#### 1.4.7 Core Components Version Alignment

**Critical**: AEM Cloud Service auto-updates Core Components to latest versions.

- Custom components extending Core Components must be forward-compatible
- Do NOT rely on specific Core Component version behavior
- Use delegation pattern (`sling:resourceSuperType`) for extensions
- Test custom components against multiple Core Component versions
- Highly customized Core Components risk breaking on auto-update
- Monitor Core Components release notes for breaking changes
- Pin proxy components to specific Core Component resource types

#### 1.4.8 Custom Components Migration Patterns

1. **Overlay Pattern**: Custom `/apps` overlays of `/libs` components must be reviewed; many `/libs` overlays are prohibited in Cloud Service
2. **Extension Pattern**: Use `sling:resourceSuperType` to extend rather than overlay
3. **Delegation Pattern**: Delegate to Core Components for standard behavior
4. **Custom Component**: Fully custom components with HTL + Sling Models migrate cleanly if following best practices

---

## 2. AEM 6.x Version Upgrades

### 2.1 Supported Upgrade Paths

| Source Version | Direct Upgrade to 6.5? | Notes |
|----------------|------------------------|-------|
| AEM 6.0 | No | Must upgrade to 6.1 first, then to 6.5 |
| AEM 6.1 | No | Upgrade to 6.3 first, then 6.5 |
| AEM 6.2 | Yes (with conditions) | Must be on SP1-CFP1 through SP1-CFP12.1, OR SP1-CFP15+ |
| AEM 6.3 | Yes | Direct in-place upgrade supported |
| AEM 6.4 | Yes | Direct in-place upgrade supported |
| AEM 6.5 SP(x) | Yes | Service pack upgrades are straightforward |

### 2.2 In-Place Upgrade Process

1. **Pre-upgrade assessment**: Run Pattern Detector to identify issues
2. **Backup**: Full backup of repository, datastore, and file system
3. **Stop AEM instance**
4. **Replace quickstart JAR** with new version
5. **Run with `-x crx2oak`** option for repository migration (if needed)
6. **Start AEM**: Automated upgrade executes
7. **Verify**: Check logs, run smoke tests, validate content
8. **Install latest Service Pack** for the target version

### 2.3 Oak Segment Tar Migration

- AEM 6.3 introduced new `SegmentNodeStore` format (Oak Segment Tar)
- Upgrading from pre-6.3 REQUIRES repository format migration
- Migration performed by `crx2oak` tool (included in quickstart JAR)
- Executed via: `java -jar aem-quickstart.jar -x crx2oak`
- MongoMK environments do NOT require this migration
- Migration involves system downtime; plan accordingly
- Side-by-side migration is an alternative to in-place

### 2.4 Service Pack and CFP Considerations

- Service Packs (SPs) are cumulative (SP17 includes all fixes from SP1-SP16)
- Cumulative Fix Packs (CFPs) are applied on top of Service Packs
- Always upgrade to latest SP before migrating to Cloud Service
- AEM 6.5 SP17+ is recommended starting point for Cloud Service migration
- Check SP release notes for known issues and compatibility
- Test Service Pack in lower environment before production

### 2.5 TarMK vs. MongoMK Considerations

| Aspect | TarMK | MongoMK |
|--------|-------|---------|
| Repository Storage | Segment Tar files (local filesystem) | MongoDB (external database) |
| Author Clustering | Not supported (cold standby only) | Supported (active-active) |
| Upgrade Complexity | Oak Segment Tar migration needed (pre-6.3) | No segment migration needed |
| Performance | Better for single-node | Better for clustered deployments |
| Cloud Service Path | Standard migration | Must migrate to TarMK-equivalent or directly to Cloud |

### 2.6 Lazy Content Migration

- Introduced in AEM 6.4+ for smoother upgrades
- Content is migrated on-demand rather than all at once during upgrade
- Reduces upgrade downtime
- Background migration tasks process content asynchronously
- Monitor `/system/console/status-migrations` for progress
- Some content types may not render correctly until lazy migration completes

### 2.7 AEM 6.5 LTS (Long-Term Support)

- AEM 6.5 LTS introduced as extended support option
- Content migration from AEM 6.5 to AEM 6.5 LTS uses `oak-upgrade` tool
- Different from standard service pack upgrades
- Required for organizations not yet ready for Cloud Service

---

## 3. AEM Managed Services to Cloud Service

### 3.1 Key Differences from On-Prem Migration

| Aspect | AEM Managed Services (AMS) | AEM Cloud Service (AEMaaCS) |
|--------|---------------------------|----------------------------|
| Architecture | Monolithic (Author, Publisher, Dispatcher) | Cloud-native, microservices-based |
| Infrastructure | Adobe-managed VMs/servers | Auto-scaling containers (Kubernetes) |
| Scaling | Manual (request Adobe to add instances) | Auto-scaling based on demand |
| Updates | Manual SP/CFP application by Adobe ops | Continuous, automatic updates by Adobe |
| Deployment | Package Manager, CRX/DE, CRXDE Lite | Cloud Manager CI/CD pipeline only |
| Dispatcher | Apache on dedicated servers | Apache in Docker containers + Fastly CDN |
| Content Distribution | Replication agents | Sling Content Distribution (journal-based) |
| Admin Access | CRX/DE, Felix Console, CRXDE Lite | Limited; no direct repository access |
| OSGi Configuration | Web Console, repository nodes | Code deployment only (.cfg.json) |
| Run Modes | Custom run modes supported | Fixed set (author/publish + environment) |
| Pricing | License + infrastructure fees | Subscription based on server requests |

### 3.2 What Is Easier (Compared to On-Prem)

- AMS Dispatcher configs are closer to Cloud Service format (standardized structure)
- AMS already enforces some Cloud Service-compatible patterns
- Adobe operations team can assist with migration planning
- BPA reports from AMS typically show fewer issues than on-prem

### 3.3 What Is Harder (Compared to On-Prem)

- AMS customers may have grown accustomed to Adobe ops applying custom patches
- Direct server access habits must be abandoned
- Custom monitoring/alerting tools need replacement with Cloud Manager monitoring
- SLA expectations may differ (AMS: up to 99.99% publish, 99.9% author)

### 3.4 Infrastructure Transition

- AMS infrastructure is decommissioned after successful Cloud Service migration
- Parallel running period for validation is standard
- DNS cutover is the final step
- CDN configuration moves from AMS Dispatcher to Fastly
- SSL certificates managed by Adobe in Cloud Service
- Load balancer configuration is automated

### 3.5 Support Model Changes

| Aspect | AMS | AEMaaCS |
|--------|-----|---------|
| Updates | Scheduled by Adobe ops team | Automatic, continuous |
| Incident Response | Adobe ops team + customer | Self-service + Adobe support |
| Monitoring | Adobe + customer tools | Cloud Manager + customer tools |
| Access | SSH access available | No direct infrastructure access |
| Customization | Adobe ops can apply custom patches | No custom patches; code through pipeline |

---

## 4. Non-AEM CMS to AEM Migration

### 4.1 WordPress to AEM Migration

**Content Migration Approaches**:
1. **REST API Export**: Use WordPress REST API to extract posts, pages, media
2. **WXR (WordPress eXtended RSS) Export**: Native WordPress export format
3. **Database Direct Access**: Query MySQL database for complex data relationships
4. **Web Scraping/Crawling**: For rendered HTML when API is insufficient

**Component Mapping**:
| WordPress Concept | AEM Equivalent |
|-------------------|----------------|
| Posts | Content pages or Content Fragments |
| Pages | AEM Pages with editable templates |
| Categories/Tags | AEM Tags (`/content/cq:tags`) |
| Custom Post Types | Content Fragment Models or custom page templates |
| Widgets/Shortcodes | AEM Components |
| Plugins | OSGi bundles, custom components, integrations |
| Theme | Editable templates + clientlibs + CSS |
| Gutenberg Blocks | AEM Components (Core Components equivalents) |
| ACF (Advanced Custom Fields) | Content Fragment Models or dialog fields |
| WooCommerce | Adobe Commerce integration |
| Media Library | AEM DAM |
| Menus | Navigation Component + `/content` structure |
| Users/Roles | AEM Users/Groups + IMS |

**Key Challenges**:
- WordPress shortcodes embedded in content require parsing and conversion
- Plugin functionality requires custom AEM development
- WordPress REST API may not expose all custom fields
- Multilingual content (WPML, Polylang) to AEM i18n/MSM mapping
- SEO metadata migration (Yoast SEO fields to AEM page properties)

### 4.2 Sitecore to AEM Migration

**Content Migration Approaches**:
1. **Sitecore Item Export**: Export items via Sitecore CLI or custom scripts
2. **Sitecore Content Serialization**: Unicorn or TDS serialized items
3. **Database Export**: Direct SQL Server query for content trees
4. **API Export**: Sitecore GraphQL or OData APIs

**Component Mapping**:
| Sitecore Concept | AEM Equivalent |
|------------------|----------------|
| Templates | Editable Templates |
| Renderings (MVC/SXA) | AEM Components |
| Placeholder Settings | Allowed Components on Template |
| Data Templates | Content Fragment Models or dialog definitions |
| Layout | Page structure + responsive grid |
| Media Library | AEM DAM |
| Content Tree | JCR content hierarchy |
| Personalization Rules | Adobe Target integration |
| Experience Editor | AEM Page Editor |
| SXA Components | Core Components |
| Workflows | AEM Workflows |
| xDB / Analytics | Adobe Analytics integration |
| Content Hub | AEM Assets Hub |

**Key Challenges**:
- Sitecore uses ASP.NET/C# while AEM uses Java/Sling; complete replatform of server code
- Sitecore's rendering variants have no direct AEM equivalent
- Personalization rules in Sitecore translate to Adobe Target experiences
- Experience database (xDB) data does not migrate to AEM
- Glass Mapper models need reimplementation as Sling Models
- Sitecore SXA modules may not have exact AEM equivalents

### 4.3 Drupal to AEM Migration

**Content Migration Approaches**:
1. **Drupal JSON:API**: Export nodes, taxonomies, media via REST
2. **Drupal Views Export**: Create export views for structured data
3. **Database Export**: Direct MySQL/PostgreSQL queries
4. **Migrate Module**: Drupal's built-in migration framework for export

**Component Mapping**:
| Drupal Concept | AEM Equivalent |
|----------------|----------------|
| Content Types | Editable Templates + Component dialogs |
| Blocks | AEM Components |
| Views | Custom Sling servlets or Content Fragment lists |
| Modules | OSGi bundles |
| Taxonomy | AEM Tags |
| Paragraphs | AEM Components in parsys/container |
| Theme | Clientlibs + editable template policies |
| Media | AEM DAM |
| Webforms | AEM Forms |
| Menus | Navigation Component |
| Roles/Permissions | AEM Users/Groups/ACLs |
| Multilingual (i18n) | AEM Language Copies / MSM |

**Key Challenges**:
- Drupal's modular architecture (Blocks, Views) requires custom AEM solutions
- Paragraphs (modular content) map well to AEM component-based authoring but require transformation
- Drupal's flexible content types need careful mapping to AEM's template/component model
- Contributed module functionality may not exist in AEM ecosystem

### 4.4 Episerver/Optimizely to AEM

**Content Migration Approaches**:
1. **Content Delivery API**: Headless API export
2. **Database Export**: SQL Server queries for content
3. **Content Provider API**: Custom export implementations

**Key Challenges**:
- .NET-based platform; complete technology stack change
- Optimizely's built-in A/B testing maps to Adobe Target
- Personalization engine differences
- Commerce integration migration (Optimizely Commerce to Adobe Commerce)

### 4.5 Universal Migration Strategies

#### Content Migration Methods (Ranked by Reliability)

1. **API-Based Export/Import** (Preferred)
   - Most structured and reliable
   - Handles relationships and references
   - Can be automated and repeated
   - Supports incremental migration

2. **Database-Level Export**
   - Direct access to all content
   - Requires understanding of source schema
   - Can handle large volumes efficiently
   - Complex relationship mapping needed

3. **Web Crawling/Scraping**
   - Last resort for rendered content
   - Loses structured data and metadata
   - Useful for HTML-heavy content migration
   - Tools: Screaming Frog, custom scrapers, Adobe Edge Delivery Importer

4. **Manual Content Entry**
   - Viable for small content volumes (<100 pages)
   - Opportunity for content cleanup and optimization
   - Most expensive per-page approach

#### URL Mapping and Redirect Strategy

**Process**:
1. **Catalog ALL existing URLs** from source CMS
2. **Map old URLs to new AEM URL structure**
3. **Implement redirects**:
   - Apache/Dispatcher rewrite rules for simple patterns
   - AEM Redirect Manager for content-managed redirects
   - CDN-level redirects for high-volume patterns
4. **Test all redirects** before go-live
5. **Monitor 404 errors** post-migration for missed URLs
6. **Submit updated sitemap** to search engines

**Redirect Types**:
- 301 (Permanent): For permanent URL structure changes
- 302 (Temporary): For transitional period redirects
- Chain avoidance: Never redirect to a redirect

#### SEO Preservation

**Pre-Migration**:
- Document all page titles, meta descriptions, canonical URLs
- Export robots.txt and sitemap.xml
- Benchmark current search rankings for key terms
- Document structured data (Schema.org markup)
- Record page speed metrics
- Archive Google Search Console data

**During Migration**:
- Implement 301 redirects for ALL changed URLs
- Preserve URL structure where possible
- Maintain canonical tags
- Keep hreflang tags for multilingual sites
- Preserve Open Graph and social media tags

**Post-Migration**:
- Submit new sitemap to Google Search Console
- Request re-indexing of key pages
- Monitor search rankings daily for 30 days
- Track organic traffic changes in analytics
- Fix any 404 errors appearing in crawl reports
- Verify structured data with Google Rich Results Test

---

## 5. AEM Edge Delivery Services Migration

### 5.1 Overview

Edge Delivery Services (EDS) is Adobe's composable cloud platform for rapid website development with near-perfect Lighthouse scores. It supports multiple authoring paradigms and represents a fundamental shift from traditional AEM Sites.

### 5.2 Traditional AEM Sites to Edge Delivery

**Migration Approaches**:

1. **Full Rebuild** (Recommended by Adobe):
   - Recreate project using EDS Crosswalk project template
   - Adobe no longer recommends the automated converter approach
   - Build EDS blocks to match existing component functionality
   - Re-author or migrate content

2. **Importer Tool** (for large content volumes):
   - Takes page DOM and transforms to Markdown, then to `.docx`
   - Best for large sites with structurally similar pages (e.g., blog with thousands of articles)
   - Not recommended for sites with <50 pages (manual copy-paste is faster)
   - Cannot perfectly preserve all interactive functionality

3. **Hybrid/Co-existence** (Incremental migration):
   - EDS and AEM Sites co-exist on same domain
   - AEM Sites pages consume EDS content and vice versa
   - Route specific paths to EDS, others to traditional AEM
   - Migrate section by section over time

### 5.3 Document-Based Authoring

**How It Works**:
- Authors create/edit in Google Docs or Microsoft Word/SharePoint
- Special tables define "blocks" (components) with structure and content
- Content is published from documents to EDS CDN
- No AEM Author environment needed for document-authored content

**Block Architecture**:
- Blocks are the fundamental component unit in EDS
- Default blocks provided by Adobe (Hero, Cards, Columns, etc.)
- Custom blocks defined with JavaScript and CSS
- Block table structure in document: Block name as table header, content in cells
- Developers define block behavior; authors fill in content via document tables

### 5.4 AEM Authoring with Universal Editor (X-Walk/Crosswalk)

- WYSIWYG editing experience using Universal Editor
- Uses EDS blocks as component model
- Content stored in AEM, rendered by EDS
- Brings back intuitive authoring while using modern front-end stack
- JavaScript and CSS for front-end development (no HTL, no Sling)
- Can work alongside traditional AEMaaCS for complex business logic

### 5.5 Content Migration to Google Docs/SharePoint

**For Document-Based Authoring**:
1. Export content from AEM as HTML or structured data
2. Use EDS Importer to convert HTML to Word documents
3. Organize documents in Google Drive or SharePoint
4. Set up folder structure matching desired URL paths
5. Configure project to read from document source
6. Author reviews and adjusts content in documents

**Key Differences**:
| Traditional AEM | Edge Delivery Services |
|-----------------|----------------------|
| JCR repository | Google Docs / SharePoint / AEM |
| HTL + Sling Models | JavaScript + CSS blocks |
| Component dialogs | Document tables or Universal Editor |
| Dispatcher caching | Global CDN (edge-cached) |
| Complex build pipeline | Simple GitHub-based deployment |
| Lighthouse 60-80 typical | Lighthouse 95-100 typical |

### 5.6 Hybrid Approaches

**Pattern 1: Path-Based Routing**
- `/blog/*` served by EDS (high-performance, simple content)
- `/account/*` served by AEM Sites (complex personalization)
- Same domain, different back-ends

**Pattern 2: Content Sharing**
- EDS pages pull Content Fragments from AEM via GraphQL
- Shared DAM assets between AEM and EDS
- Unified content model, different delivery channels

**Pattern 3: Progressive Migration**
- Start with new sections on EDS
- Migrate existing sections incrementally
- Maintain AEM Sites for complex functionality
- Eventual full migration or permanent hybrid

---

## 6. Migration Testing

### 6.1 Content Validation Strategies

**Automated Validation**:
- Node count comparison: source vs. target repository
- Asset binary checksum verification
- Property value comparison for critical content types
- Path existence verification for all migrated content
- Reference integrity checks (internal links, asset references)
- Metadata completeness validation
- Content Fragment field validation
- DAM metadata preservation (EXIF, IPTC, XMP)

**Manual Validation**:
- Sample page rendering comparison (source vs. target)
- Component rendering spot checks across templates
- Navigation and menu structure verification
- Form submission and processing validation
- Search functionality testing
- Personalization and targeting verification

### 6.2 Visual Regression Testing

**Tools**:
- BackstopJS: Headless Chrome-based visual comparison
- Percy (BrowserStack): Cloud-based visual testing
- Chromatic: Component-level visual testing
- AEM Cloud Manager includes basic visual testing capabilities

**Approach**:
1. Capture baseline screenshots from source environment
2. Capture corresponding pages on target environment
3. Pixel-diff comparison with configurable thresholds
4. Report on visual differences with side-by-side views
5. Test across breakpoints (desktop, tablet, mobile)
6. Test component variations and states
7. Validate responsive behavior

### 6.3 Performance Benchmarking

**Pre-Migration Baseline**:
- Page load times (TTFB, FCP, LCP, CLS)
- Server response times under load
- Asset delivery performance
- Search query response times
- Author environment performance (page save, publish, workflow)
- Dispatcher cache hit ratios

**Tools**:
- Adobe Cloud Manager Performance Testing (built-in)
- Apache JMeter for load testing
- Lighthouse CI for web performance
- WebPageTest for detailed waterfall analysis
- New Relic / Dynatrace for APM
- Cloud Manager Dashboard for real-time KPIs

**Post-Migration Targets**:
- Response times should be similar to or better than production baseline
- Cloud Service auto-scaling should handle traffic spikes
- CDN caching should improve asset delivery
- Monitor for performance regressions over first 30 days

### 6.4 Link Validation

- Crawl entire site with tools like Screaming Frog or Sitebulb
- Validate all internal links resolve (no 404s)
- Check external link references
- Verify anchor links within pages
- Test download links for assets
- Validate image src attributes
- Check redirect chains for loops or excessive hops

### 6.5 SEO Audit (Pre/Post Migration)

**Pre-Migration Audit**:
- Index all URLs in Google Search Console
- Record keyword rankings for top 50-100 terms
- Document page authority and backlink profiles
- Archive structured data implementations
- Benchmark Core Web Vitals

**Post-Migration Audit**:
- Verify 1:1 URL mapping or proper 301 redirects
- Confirm meta tags, titles, descriptions preserved
- Validate canonical tags
- Check hreflang implementation
- Verify sitemap.xml accuracy
- Confirm robots.txt correctness
- Monitor Google Search Console for coverage issues
- Track keyword ranking changes daily for 4 weeks

### 6.6 User Acceptance Testing (UAT) Framework

**Author UAT**:
- Page creation and editing workflows
- Component drag-and-drop functionality
- Asset upload and management in DAM
- Workflow initiation and approval processes
- Content publishing and unpublishing
- Version creation and comparison
- Experience Fragment and Content Fragment management
- Search and tagging functionality
- Multi-site management operations

**End-User UAT**:
- Page rendering across browsers and devices
- Navigation and wayfinding
- Form submissions
- Search functionality
- Personalized content delivery
- Download and media playback
- Accessibility compliance (WCAG 2.1 AA)
- Performance under expected load

### 6.7 Rollback Strategies

**Code Rollback**:
- Cloud Manager maintains deployment history
- Previous deployment can be promoted via Cloud Manager
- Git-based rollback: revert commits and redeploy

**Content Rollback**:
- No built-in "undo migration" in Cloud Service
- Options:
  1. Re-run CTT ingestion with wipe mode from a known-good backup
  2. Maintain source AEM instance running until validation complete
  3. Use content packages for small-scale rollbacks
  4. Point DNS back to source environment (if still running)

**Best Practices**:
- Never decommission source environment until post-migration validation is complete
- Maintain parallel running for minimum 2-4 weeks
- Define rollback criteria and triggers before go-live
- Document rollback procedures and test them

---

## 7. Common Migration Failures

### 7.1 Real-World Migration Failures and Root Causes

#### Failure 1: Silent Content Loss on Publish

**Symptom**: Content appears correctly on Author but is missing or incomplete on Publish environments post-migration.

**Root Causes**:
- CTT reports show successful migration, but Sling Content Distribution has not fully synced
- CUG policies prevent content visibility
- ACL restrictions differ between Author and Publish
- Content references broken due to path changes

**Prevention**: Always validate on Publish tier specifically, not just Author.

---

#### Failure 2: Multi-Site Manager (MSM) Relationship Breakage

**Symptom**: Rollouts fail silently, overrides behave differently, inheritance breaks. Discovered months later when regional sites publish incorrect content.

**Root Causes**:
- MSM blueprints stored in `/etc/blueprints` not migrated to `/apps/msm`
- Live Copy relationships referencing old paths
- Rollout configurations incompatible with Cloud Service
- MSM cancellation flags lost during migration

**Prevention**: Map all MSM relationships before migration; validate every Live Copy post-migration.

---

#### Failure 3: ARM Architecture Library Failures

**Symptom**: Image processing, PDF generation, or video transcoding stops working in Cloud Service.

**Root Causes**:
- Native libraries compiled for x86-64 architecture
- Cloud Service VMs run on ARM-based processors
- Common failures: WebP rendering, ImageMagick bindings, custom PDF generators

**Prevention**: Test all native library dependencies on ARM architecture before migration. Replace with Asset Compute microservice workers where possible.

---

#### Failure 4: Core Component Auto-Update Breakage

**Symptom**: Components display incorrectly or fail entirely after a Cloud Service update (not an immediate migration issue but a post-migration ongoing risk).

**Root Causes**:
- Custom components tightly coupled to specific Core Component versions
- Overlay patterns that break when underlying Core Component changes
- CSS specificity conflicts with updated Core Component styles
- JavaScript dependencies on Core Component internals

**Prevention**: Use delegation pattern (`sling:resourceSuperType`); never rely on Core Component internal structure; use only public APIs and extension points.

---

#### Failure 5: Content Migration Data Corruption

**Symptom**: Corrupted files, encoding issues, missing binaries after CTT migration.

**Root Causes**:
- Large binary files timing out during extraction
- Network interruptions during transfer to Azure blob storage
- MongoDB 16MB property value limit exceeded
- Character encoding mismatches in content properties
- Format incompatibilities between source and Cloud Service JCR

**Prevention**: Run data store consistency checks before extraction. Validate binary checksums. Use pre-copy for large repositories. Test with representative content subset first.

---

#### Failure 6: Integration Failures

**Symptom**: CRM, PIM, DAM, analytics, or marketing automation integrations stop working post-migration.

**Root Causes**:
- Integration endpoints hardcoded in OSGi configs
- Custom replication agents used for integration (not available in Cloud Service)
- OAuth/API key configurations in `/etc/cloudservices` not migrated
- Network/firewall rules blocking Cloud Service IP ranges
- Integration libraries using restricted APIs

**Prevention**: Inventory all integrations before migration. Test each integration in Cloud Service dev environment. Use Cloud Manager environment variables for endpoint configuration. Validate network connectivity from Cloud Service.

---

#### Failure 7: Workflow Process Step Failures

**Symptom**: Content approval workflows, DAM processing workflows, or custom business process workflows fail or produce unexpected results.

**Root Causes**:
- Custom Java process steps using deprecated APIs
- Workflow launchers not converted to post-processing configuration
- Transient workflow behavior differences
- Workflow models referencing components under `/libs` that have changed
- Enterprise workflows recreated exactly as-is without optimization

**Prevention**: Audit all workflow models and process steps. Use Asset Workflow Migration Tool. Simplify workflows during migration; do not blindly replicate complexity.

---

#### Failure 8: Dispatcher and Caching Failures

**Symptom**: Pages not caching, stale content served, personalization leaking through cache, 404 errors for previously working URLs.

**Root Causes**:
- Rewrite rules not properly converted from Apache to Fastly CDN
- Cache invalidation patterns incompatible with Sling Content Distribution
- Custom Dispatcher filters blocking Cloud Service internal requests
- CDN caching interfering with dynamic content

**Prevention**: Use Dispatcher Converter tool, then manually validate. Test caching behavior extensively in stage environment. Use Dispatcher SDK for local testing.

---

### 7.2 Performance Degradation Patterns

1. **Gradual Repository Growth**: Uncontrolled content growth without maintenance tasks
2. **Index Bloat**: Indexes not optimized for Cloud Service query patterns
3. **Uncached API Calls**: GraphQL queries not using persisted queries
4. **Large Page Payloads**: Components fetching excessive data
5. **Clientlib Proliferation**: Too many client libraries causing excessive HTTP requests
6. **Asset Rendition Overhead**: Custom rendition profiles generating too many variants
7. **Search Performance**: Unoptimized queries hitting non-indexed properties

### 7.3 Timeline Overrun Causes

| Factor | Impact on Timeline |
|--------|-------------------|
| Heavy customization (>50 custom components) | +2-4 months |
| Many integrations (>10 external systems) | +1-3 months |
| Large content volume (>500K pages, >1M assets) | +1-2 months |
| Regulatory/compliance requirements (HIPAA, GDPR) | +1-2 months |
| Multiple brands/sites (>5 sites) | +2-4 months |
| Legacy Classic UI components still in use | +1-3 months |
| Custom authentication/SSO implementation | +1-2 months |
| Insufficient testing resources | +1-2 months |
| Organizational resistance/training gaps | +1-2 months |

**Realistic Timeline Ranges**:
| Migration Complexity | Duration |
|---------------------|----------|
| Small (single site, <100 pages, minimal customization) | 2-4 months |
| Medium (2-3 sites, <10K pages, moderate customization) | 4-6 months |
| Large (5+ sites, 50K+ pages, heavy customization) | 6-9 months |
| Enterprise (10+ sites, 500K+ pages, complex integrations) | 9-18 months |

---

## Appendix A: Tool Reference

| Tool | NPM Package | GitHub Repository |
|------|-------------|-------------------|
| Repository Modernizer | `@adobe/aem-cs-source-migration-repository-modernizer` | `adobe/aem-cloud-service-source-migration` |
| Dispatcher Converter | `@adobe/aem-cs-source-migration-dispatcher-converter` | `adobe/aem-cloud-service-source-migration` |
| Index Converter | `@adobe/aem-cs-source-migration-index-converter` | `adobe/aem-cloud-service-source-migration` |
| AIO CLI Plugin | `@adobe/aio-cli-plugin-aem-cloud-service-migration` | `adobe/aio-cli-plugin-aem-cloud-service-migration` |
| Asset Workflow Migration | N/A | `adobe/aem-cloud-migration` |
| AEM Modernization Tools | N/A (AEM package) | `adobe/aem-modernize-tools` |
| Best Practices Analyzer | N/A (AEM package, installed via Package Manager) | N/A |
| Content Transfer Tool | N/A (AEM package, installed via Software Distribution) | N/A |

## Appendix B: AEM Cloud Service Architecture Reference

```
+------------------+     +-----------------+     +------------------+
|   Cloud Manager  |     |   CDN (Fastly)  |     |  Adobe I/O       |
|   (CI/CD)        |     |   + WAF         |     |  Runtime         |
+--------+---------+     +--------+--------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+---------+     +--------+--------+     +--------+---------+
|   Git Repository |     |   Dispatcher    |     |  Asset Compute   |
|   (Cloud Manager)|     |   (Docker)      |     |  Microservices   |
+--------+---------+     +--------+--------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+--------+--------------------------------------------+----+---------+
|                    AEM Cloud Service                              |
|  +-------------+  +-------------+  +---------------------------+ |
|  |   Author    |  |   Publish   |  |   Preview (optional)     | |
|  |   Tier      |  |   Tier      |  |   Tier                   | |
|  |  (1 pod)    |  |  (N pods,   |  |  (1 pod)                 | |
|  |             |  |  auto-scale)|  |                          | |
|  +------+------+  +------+------+  +-----------+--------------+ |
|         |                |                      |                |
|         v                v                      v                |
|  +------+------+  +------+------+  +-----------+--------------+ |
|  | Sling Content Distribution (Journal + Blob Store)           | |
|  +-------------------------------------------------------------+ |
|  +-------------------------------------------------------------+ |
|  |   Azure Blob Store (Binary Storage)                         | |
|  +-------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

## Appendix C: Migration Decision Matrix

```
Is your current AEM version < 6.5?
  YES --> Upgrade to AEM 6.5 latest SP first
  NO  --> Continue

Is your deployment AEM On-Prem?
  YES --> Full migration path required (all tools needed)
  NO  --> Is it AEM Managed Services?
           YES --> Simpler migration (AMS Dispatcher closer to Cloud)
           NO  --> Non-AEM CMS migration (see Section 4)

Is your content volume > 500GB?
  YES --> Contact Adobe for extended migration support
  NO  --> Standard CTT migration

Do you use Dynamic Media Hybrid mode?
  YES --> Migrate to Scene7 mode BEFORE Cloud Service migration
  NO  --> Continue with standard migration

Do you have > 50 custom components?
  YES --> Budget 4-6 months for code refactoring alone
  NO  --> Standard refactoring timeline

Do you need Edge Delivery Services?
  YES --> Consider hybrid approach or full EDS rebuild
  NO  --> Standard AEMaaCS migration
```

---

## Sources

### Adobe Official Documentation
- [Getting Started with Migration Journey](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/getting-started)
- [Migration Guide for Partners](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/getting-started-partners)
- [Best Practices Analyzer Overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/best-practices-analyzer/overview-best-practices-analyzer)
- [Using Best Practices Analyzer](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/best-practices-analyzer/using-best-practices-analyzer)
- [Content Transfer Tool Guidelines](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/guidelines-best-practices-content-transfer-tool)
- [Handling Large Content Repositories](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/handling-large-content-repositories)
- [Content Transfer Tool Prerequisites](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/prerequisites-content-transfer-tool)
- [Ingesting Content into Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/ingesting-content)
- [Group Migration](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/group-migration)
- [Repository Modernizer](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/refactoring-tools/repo-modernizer)
- [Dispatcher Converter](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/refactoring-tools/dispatcher-transformation-utility-tools)
- [Cloud Acceleration Manager - Getting Started](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/using-cam/getting-started-cam)
- [CAM Readiness Phase](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/using-cam/cam-readiness-phase)
- [CAM Implementation Phase](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/using-cam/cam-implementation-phase)
- [CAM Go-Live Phase](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/using-cam/cam-golive-phase)
- [Configuring OSGi for Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/deploying/configuring-osgi)
- [AEM Project Content Package Structure](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/aem-project-content-package-structure)
- [Content Search and Indexing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing)
- [Performing an In-Place Upgrade (6.5)](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/upgrading/in-place-upgrade)
- [Upgrading to AEM 6.5](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/upgrading/upgrade)
- [AEM 6.5 to AEM 6.5 LTS Content Migration](https://experienceleague.adobe.com/en/docs/experience-manager-65-lts/content/implementing/deploying/upgrading/aem-65-to-aem-65lts-content-migration-using-oak-upgrade)
- [Edge Delivery Services Overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/overview)
- [Site Migration to Edge Delivery Using Importer](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/document-authoring/how-to/migration-using-importer)
- [GraphQL API for Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/content-fragments)
- [Configure Dynamic Media Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/config-dm)
- [Content Migration FAQ](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/migration/moving-to-aem-as-a-cloud-service/content-migration/faq)
- [Environment Variables in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/environment-variables)

### Adobe GitHub Repositories
- [AEM Cloud Service Source Migration](https://github.com/adobe/aem-cloud-service-source-migration)
- [AEM Cloud Migration (Workflow Tool)](https://github.com/adobe/aem-cloud-migration)
- [AIO CLI Plugin for AEM Migration](https://github.com/adobe/aio-cli-plugin-aem-cloud-service-migration)
- [AEM Modernize Tools](https://github.com/adobe/aem-modernize-tools)
- [AEM Project Archetype](https://github.com/adobe/aem-project-archetype)

### Partner and Community Resources
- [GSPANN - AEM Migration Guide](https://www.gspann.com/resources/blogs/aem-as-a-cloud-service-step-by-step-migration-guide/)
- [Credera - AEM On-Prem to Cloud Migration](https://www.credera.com/en-us/partnerships/adobe-experience-manager/aem-on-prem-to-cloud-migration)
- [Credera - How to Migrate Infrastructure](https://www.credera.com/insights/how-to-migrate-your-infrastructure-to-aem-as-a-cloud-service)
- [VASS Company - 12 Steps to Migrate](https://vasscompany.com/en/insights/blogs-articles/migrate-aem-onprem-to-cloud/)
- [Exadel - 10 AEMaaCS Migration Mistakes](https://exadel.com/news/10-mistakes-to-avoid-when-migrating-to-aemaacs/)
- [Eggs Unimedia - 8 Biggest Mistakes in AEM Cloud Migration](https://www.eggsunimedia.com/de/en/insights/blog/aem-cloud-migration-8-common-mistakes)
- [Net Effect - AEM Migration Risks](https://net-effect.com/aem-migration-risks-entreprises-miss/)
- [Autowoven - Troubleshooting AEMaaCS Migration](https://www.autowoven.com/adobe-blog/troubleshooting-common-issues-during-aemaacs-migration/)
- [Albin's Blog - Key Learnings from Migration](https://www.albinsblog.com/2024/05/Key-Learnings-from-Migration-to-AEMasaCloud.html)
- [Perficient - Repository Modernizer Tool](https://blogs.perficient.com/2023/10/09/aem-as-a-cloud-service-and-repository-modernizer-tool/)
- [Grazitti - Content Transfer Tool Guide](https://www.grazitti.com/resource/articles/seamlessly-migrate-to-aem-cloud-unlock-efficiency-with-the-content-transfer-tool-ctt/)
- [WegWorks - AEM Cloud Migration Checklist](https://www.wegworks.com/blog/aem/aem-cloud-migration/)
- [One North - Step-by-Step Approach](https://www.onenorth.com/insights/a-step-by-step-approach-for-migrating-to-aemaacs/)
- [Oshyn - Migrating AEM Managed Service to Cloud](https://www.oshyn.com/blog/aem-cloud-migration)
- [Axamit - Migration to AEM](https://axamit.com/blog/adobe-experience-manager/migration-to-aem/)
- [TTMS - CMS to AEM Migration Services](https://ttms.com/aem/migration-services/)
- [AEM4Beginner - Drupal to AEM Approach](https://aem4beginner.blogspot.com/2020/04/drupal-to-aem-cms-migration-approach.html)
- [DevHandler - Edge Delivery Services vs AEM Sites](https://www.devhandler.com/blog/document-based-content-authoring-in-adobe-edge-delivery-services-vs-classic-aem-sites-devhandler-s-experience)
- [LeapPoint - To Edge or Not to Edge](https://leappoint.com/blog/to-edge-or-not-to-edge-with-adobe-aem/)
- [Bounteous - Adobe's Next Chapter: Edge Delivery Services](https://www.bounteous.com/insights/2026/01/29/adobes-next-chapter-edge-delivery-services-ai-and-evolution-adobe-experience/)
- [CTT Extraction Deep Dive](https://implementationdetails.dev/blog/2021/08/05/ctt-extraction-deep-dive/)
- [Custom Runmodes on AEM Cloud Service (Adobe Tech Blog)](https://medium.com/adobetech/custom-runmodes-on-aem-as-a-cloud-service-79b757f51a6b)
- [Medium - How We Migrated a Million Assets into AEM Cloud](https://medium.com/@bsaravanaprakash/how-we-migrated-a-million-assets-into-aem-cloud-service-dam-ef7eb74d30fa)
- [Marker.io - Ultimate Guide to AEM Migration](https://marker.io/blog/aem-migration-guide)
- [Valtech - AEM Cloud Migration](https://www.valtech.com/blog/migrating-to-adobe-experience-manager-cloud/)
