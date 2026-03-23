/**
 * Migration-as-Code Templates
 *
 * Pre-built YAML configuration templates for common migration types.
 * Each template includes extensive comments explaining every option.
 */

import type { TemplateName } from './schema';

// ============================================================
// Template Registry
// ============================================================

const templates: Record<TemplateName, string> = {
  'aem-onprem-to-cloud': AEM_ONPREM_TO_CLOUD_TEMPLATE(),
  'aem-ams-to-cloud': AEM_AMS_TO_CLOUD_TEMPLATE(),
  'wordpress-to-aem': WORDPRESS_TO_AEM_TEMPLATE(),
  'sitecore-to-aem': SITECORE_TO_AEM_TEMPLATE(),
  'ga-to-cja': GA_TO_CJA_TEMPLATE(),
  'campaign-std-to-v8': CAMPAIGN_STD_TO_V8_TEMPLATE(),
  'aam-to-rtcdp': AAM_TO_RTCDP_TEMPLATE(),
};

/**
 * Get a YAML template for the given migration type.
 */
export function getTemplate(type: TemplateName): string {
  return templates[type];
}

/**
 * Get all available template names with descriptions.
 */
export function getTemplateList(): Array<{
  name: TemplateName;
  label: string;
  description: string;
}> {
  return [
    {
      name: 'aem-onprem-to-cloud',
      label: 'AEM 6.5 On-Prem to Cloud Service',
      description: 'Migrate from AEM 6.5 on-premises to AEM as a Cloud Service',
    },
    {
      name: 'aem-ams-to-cloud',
      label: 'AEM Managed Services to Cloud Service',
      description: 'Migrate from Adobe Managed Services (AMS) to AEM Cloud Service',
    },
    {
      name: 'wordpress-to-aem',
      label: 'WordPress to AEM Sites',
      description: 'Re-platform from WordPress to AEM Sites with Edge Delivery',
    },
    {
      name: 'sitecore-to-aem',
      label: 'Sitecore to AEM Sites',
      description: 'Migrate from Sitecore XP/XM to AEM Sites',
    },
    {
      name: 'ga-to-cja',
      label: 'Google Analytics to CJA',
      description: 'Migrate from Google Analytics 4 to Customer Journey Analytics',
    },
    {
      name: 'campaign-std-to-v8',
      label: 'Campaign Standard to Campaign v8',
      description: 'Migrate from Adobe Campaign Standard to Campaign v8',
    },
    {
      name: 'aam-to-rtcdp',
      label: 'Audience Manager to RTCDP',
      description: 'Migrate segments and audiences from AAM to Real-Time CDP',
    },
  ];
}

// ============================================================
// Template Functions
// ============================================================

function AEM_ONPREM_TO_CLOUD_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# AEM 6.5 On-Premises to AEM as a Cloud Service
# ============================================================
# This config defines a complete migration from AEM 6.5 on-prem
# to AEM Cloud Service. Version-control this file in your repo
# and iterate on it via pull requests.

metadata:
  name: "AEM 6.5 to Cloud Service Migration"
  version: "1.0.0"
  description: "Full migration of corporate site from AEM 6.5.18 on-prem to AEMaaCS"
  author: "Platform Engineering Team"
  created: "2026-03-22T00:00:00Z"

# ── Source Environment ──────────────────────────────────────
# The AEM 6.5 instance to migrate from.
source:
  platform: aem_6x
  version: "6.5.18"
  url: https://author.example.com
  auth:
    type: basic
    # NEVER inline credentials. Use env var references.
    credentials: \${AEM_SOURCE_CREDENTIALS}

# ── Target Environment ──────────────────────────────────────
# AEM as a Cloud Service program and environment.
target:
  platform: aem_cloud
  url: https://author-p12345-e67890.adobeaemcloud.com
  programId: "12345"
  environmentId: "67890"
  auth:
    type: oauth_s2s
    credentials: \${AEM_CLOUD_OAUTH_CREDENTIALS}

# ── Scope ───────────────────────────────────────────────────
# What to include in this migration.
scope:
  products:
    - aem-sites
    - aem-assets
    - aem-forms
  sites:
    include:
      - /content/mysite
      - /content/dam/mysite
    exclude:
      - /content/mysite/archive
      - /content/dam/mysite/temp
  contentPaths:
    - /content/mysite
    - /content/dam/mysite
    - /content/experience-fragments/mysite
    - /conf/mysite
  dateRange:
    from: "2020-01-01T00:00:00Z"
  assetTypes:
    - image/jpeg
    - image/png
    - application/pdf
    - video/mp4
  maxSizeGB: 500

# ── Phases ──────────────────────────────────────────────────
# Ordered list of migration phases. Disable phases you want to skip.
phases:
  - type: assessment
    enabled: true
    config:
      runBPA: true          # Run AEM Best Practices Analyzer
      analyzeCustomCode: true
      analyzeWorkflows: true
    timeout: "4h"
    retries: 1
    continueOnError: false
    concurrency: 5

  - type: planning
    enabled: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: code_modernization
    enabled: true
    config:
      convertToOSGi: true
      removeDeprecatedAPIs: true
      updateSlingModels: true
      migrateWorkflows: true
      rewriteReplicationAgents: true
    timeout: "8h"
    retries: 2
    continueOnError: true
    concurrency: 10

  - type: content_migration
    enabled: true
    config:
      useCTT: true          # Content Transfer Tool
      batchSizeGB: 50
      validateChecksums: true
      preserveTimestamps: true
    timeout: "24h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    config:
      migrateOAuthClients: true
      updateEndpoints: true
      reconfigureDispatchers: true
    timeout: "4h"
    retries: 2
    continueOnError: false
    concurrency: 3

  - type: testing
    enabled: true
    config:
      runSmokeTests: true
      runRegressionSuite: true
      validateSEO: true
      checkBrokenLinks: true
    timeout: "6h"
    retries: 1
    continueOnError: false
    concurrency: 10

  - type: cutover
    enabled: true
    config:
      blueGreenDeployment: true
      dnsUpdateStrategy: gradual  # gradual | immediate
      trafficShiftPercent: 10     # Start with 10% traffic
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 72
      alertOnErrorRate: 1        # Alert if error rate > 1%
      trackCoreWebVitals: true
    timeout: "72h"
    retries: 0
    continueOnError: true
    concurrency: 1

# ── Transformation Rules ────────────────────────────────────
# Custom rules applied during code modernization and content migration.
rules:
  - name: "Replace deprecated Granite UI paths"
    type: regex_replace
    enabled: true
    pattern: "/libs/granite/ui/components/foundation"
    replacement: "/libs/granite/ui/components/coral"

  - name: "Update API endpoints"
    type: api_replacement
    enabled: true
    sourceApi: "https://api.example.com/v1"
    targetApi: "https://api.example.com/v2"

  - name: "Map legacy component paths"
    type: component_mapping
    enabled: true
    sourcePath: "/apps/mysite/components/legacy"
    targetPath: "/apps/mysite/components/core"

  - name: "Rewrite DAM asset references"
    type: path_mapping
    enabled: true
    sourcePath: "/content/dam/mysite/legacy"
    targetPath: "/content/dam/mysite/migrated"

# ── Compliance ──────────────────────────────────────────────
# Regulatory and data governance requirements.
compliance:
  frameworks:
    - gdpr
    - ccpa
  dataResidency:
    region: eu-west-1
    enforceGeoFencing: true
  piiHandling:
    strategy: encrypt
    fields:
      - email
      - phone
      - address
    auditLog: true
  retentionDays: 365

# ── Notifications ───────────────────────────────────────────
# Where to send migration status updates.
notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
    channel: "#migration-alerts"
  email:
    addresses:
      - platform-team@example.com
      - stakeholders@example.com
  events:
    - migration:start
    - migration:complete
    - migration:failed
    - phase:error
    - rollback:triggered

# ── Rollback ────────────────────────────────────────────────
# Automatic rollback conditions for safety.
rollback:
  enabled: true
  errorThresholdPercent: 5     # Rollback if >5% of items fail
  validationFailureThreshold: 3 # Rollback after 3 validation failures
  autoRollback: true
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function AEM_AMS_TO_CLOUD_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# AEM Managed Services (AMS) to AEM as a Cloud Service
# ============================================================

metadata:
  name: "AEM AMS to Cloud Service Migration"
  version: "1.0.0"
  description: "Migrate from Adobe Managed Services to AEM Cloud Service"
  author: "DevOps Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: aem_ams
  version: "6.5.17"
  url: https://author-ams.example.com
  auth:
    type: oauth_s2s
    credentials: \${AMS_OAUTH_CREDENTIALS}

target:
  platform: aem_cloud
  url: https://author-p11111-e22222.adobeaemcloud.com
  programId: "11111"
  environmentId: "22222"
  auth:
    type: oauth_s2s
    credentials: \${AEM_CLOUD_OAUTH_CREDENTIALS}

scope:
  products:
    - aem-sites
    - aem-assets
  sites:
    include:
      - /content/brand
      - /content/dam/brand
    exclude:
      - /content/brand/sandbox
  contentPaths:
    - /content/brand
    - /content/dam/brand
    - /conf/brand
  maxSizeGB: 200

phases:
  - type: assessment
    enabled: true
    config:
      runBPA: true
      checkCloudManagerPipelines: true
    timeout: "3h"
    retries: 1
    continueOnError: false
    concurrency: 5

  - type: planning
    enabled: true
    timeout: "1h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: code_modernization
    enabled: true
    config:
      migrateDispatcherConfig: true
      updateRunModes: true
      removeAMSSpecificConfigs: true
    timeout: "6h"
    retries: 2
    continueOnError: true
    concurrency: 8

  - type: content_migration
    enabled: true
    config:
      useCTT: true
      batchSizeGB: 100
      validateChecksums: true
    timeout: "12h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    timeout: "3h"
    retries: 2
    continueOnError: false
    concurrency: 3

  - type: testing
    enabled: true
    config:
      runSmokeTests: true
      compareRenderedOutput: true
    timeout: "4h"
    retries: 1
    continueOnError: false
    concurrency: 10

  - type: cutover
    enabled: true
    config:
      dnsUpdateStrategy: gradual
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 48
    timeout: "48h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Remove AMS replication agents"
    type: regex_replace
    enabled: true
    pattern: "com\\\\.day\\\\.cq\\\\.replication\\\\.impl\\\\.TransportHandler"
    replacement: ""

  - name: "Update Dispatcher configs"
    type: path_mapping
    enabled: true
    sourcePath: "/etc/httpd/conf.d"
    targetPath: "/dispatcher/src/conf.d"

compliance:
  frameworks:
    - gdpr
  piiHandling:
    strategy: encrypt
    fields:
      - email
    auditLog: true

notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
  events:
    - migration:complete
    - migration:failed
    - phase:error

rollback:
  enabled: true
  errorThresholdPercent: 10
  autoRollback: false
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function WORDPRESS_TO_AEM_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# WordPress to AEM Sites
# ============================================================
# Re-platforms a WordPress site to AEM Sites with Edge Delivery.
# Uses the REST API to extract content from WordPress.

metadata:
  name: "WordPress to AEM Sites Migration"
  version: "1.0.0"
  description: "Re-platform corporate blog and marketing site from WordPress to AEM"
  author: "Web Platform Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: wordpress
  version: "6.4"
  url: https://www.example.com
  auth:
    type: api_key
    credentials: \${WP_API_KEY}

target:
  platform: aem_cloud
  url: https://author-p33333-e44444.adobeaemcloud.com
  programId: "33333"
  environmentId: "44444"
  auth:
    type: oauth_s2s
    credentials: \${AEM_CLOUD_OAUTH_CREDENTIALS}

scope:
  products:
    - aem-sites
    - aem-assets
    - aem-eds
  sites:
    include:
      - /blog
      - /resources
      - /about
    exclude:
      - /blog/drafts
      - /wp-admin
  contentPaths:
    - /wp-json/wp/v2/posts
    - /wp-json/wp/v2/pages
    - /wp-json/wp/v2/media
  dateRange:
    from: "2022-01-01T00:00:00Z"
  assetTypes:
    - image/jpeg
    - image/png
    - image/webp
    - application/pdf
  maxSizeGB: 50

phases:
  - type: assessment
    enabled: true
    config:
      crawlSitemap: true
      analyzePlugins: true
      mapTaxonomies: true
      detectCustomPostTypes: true
    timeout: "2h"
    retries: 1
    continueOnError: false
    concurrency: 5

  - type: planning
    enabled: true
    config:
      generateComponentMapping: true
      createInformationArchitecture: true
    timeout: "1h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: content_migration
    enabled: true
    config:
      extractViaAPI: true
      transformHTML: true
      mapCategoriesToTags: true
      migrateMediaLibrary: true
      preserveURLStructure: true
    timeout: "8h"
    retries: 3
    continueOnError: true
    concurrency: 10

  - type: integration_reconnection
    enabled: true
    config:
      mapContactForms: true
      reconfigureAnalytics: true
      migrateSearchIndex: true
    timeout: "3h"
    retries: 2
    continueOnError: true
    concurrency: 3

  - type: testing
    enabled: true
    config:
      runVisualRegression: true
      validateSEO: true
      checkRedirects: true
      check404s: true
    timeout: "4h"
    retries: 1
    continueOnError: false
    concurrency: 10

  - type: cutover
    enabled: true
    config:
      createRedirectMap: true
      updateDNS: true
    timeout: "1h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 48
      trackSEORankings: true
      monitorTraffic: true
    timeout: "48h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Convert WordPress shortcodes"
    type: regex_replace
    enabled: true
    pattern: "\\\\[gallery ids=\\"(.*?)\\"\\\\]"
    replacement: "<aem-gallery data-ids=\\"$1\\"/>"

  - name: "Map WordPress categories to AEM tags"
    type: component_mapping
    enabled: true
    sourcePath: "/wp-json/wp/v2/categories"
    targetPath: "/content/cq:tags/mysite"

  - name: "Rewrite internal links"
    type: path_mapping
    enabled: true
    sourcePath: "/blog/"
    targetPath: "/content/mysite/blog/"

compliance:
  frameworks:
    - gdpr
    - ccpa
  piiHandling:
    strategy: redact
    fields:
      - comment_author_email
    auditLog: true

notifications:
  email:
    addresses:
      - webteam@example.com
  events:
    - migration:complete
    - migration:failed

rollback:
  enabled: true
  errorThresholdPercent: 15
  autoRollback: false
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function SITECORE_TO_AEM_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# Sitecore XP to AEM Sites
# ============================================================

metadata:
  name: "Sitecore to AEM Sites Migration"
  version: "1.0.0"
  description: "Migrate from Sitecore XP 10.3 to AEM Sites Cloud Service"
  author: "Digital Platform Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: sitecore
  version: "10.3"
  url: https://cms.example.com
  auth:
    type: api_key
    credentials: \${SITECORE_API_KEY}

target:
  platform: aem_cloud
  url: https://author-p55555-e66666.adobeaemcloud.com
  programId: "55555"
  environmentId: "66666"
  auth:
    type: oauth_s2s
    credentials: \${AEM_CLOUD_OAUTH_CREDENTIALS}

scope:
  products:
    - aem-sites
    - aem-assets
  sites:
    include:
      - /sitecore/content/Home
      - /sitecore/media library
    exclude:
      - /sitecore/content/Home/archive
  contentPaths:
    - /sitecore/content/Home
    - /sitecore/media library/Images
    - /sitecore/templates
  maxSizeGB: 300

phases:
  - type: assessment
    enabled: true
    config:
      analyzeSitecoreTemplates: true
      mapRenderingComponents: true
      inventoryPersonalization: true
      checkLayoutDetails: true
    timeout: "4h"
    retries: 1
    continueOnError: false
    concurrency: 5

  - type: planning
    enabled: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: code_modernization
    enabled: true
    config:
      convertRazorViews: true
      mapSitecoreHelpers: true
      rewriteGlassMapper: true
    timeout: "12h"
    retries: 2
    continueOnError: true
    concurrency: 8

  - type: content_migration
    enabled: true
    config:
      exportViaItemAPI: true
      convertTemplateHierarchy: true
      migrateMediaItems: true
      preserveWorkflowState: true
    timeout: "16h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    config:
      migrateXConnect: false
      reconfigureSearch: true
      mapFormsToCoreComponents: true
    timeout: "6h"
    retries: 2
    continueOnError: true
    concurrency: 3

  - type: testing
    enabled: true
    config:
      runVisualComparison: true
      validatePersonalization: true
      checkMultiSiteConfig: true
    timeout: "6h"
    retries: 1
    continueOnError: false
    concurrency: 10

  - type: cutover
    enabled: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 72
    timeout: "72h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Map Sitecore field types"
    type: component_mapping
    enabled: true
    sourcePath: "Sitecore.Field.RichText"
    targetPath: "core/wcm/components/text"

  - name: "Convert rendering parameters"
    type: regex_replace
    enabled: true
    pattern: "@Html\\\\.Sitecore\\\\(\\\\)\\\\.Field\\\\(\\"(\\\\w+)\\"\\\\)"
    replacement: "data-cmp-$1"

  - name: "Rewrite media library paths"
    type: path_mapping
    enabled: true
    sourcePath: "/sitecore/media library"
    targetPath: "/content/dam/mysite"

compliance:
  frameworks:
    - gdpr
  dataResidency:
    region: us-east-1
    enforceGeoFencing: false
  piiHandling:
    strategy: pseudonymize
    fields:
      - email
      - fullName
    auditLog: true

notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
  email:
    addresses:
      - digital-team@example.com
  events:
    - migration:complete
    - migration:failed
    - phase:error

rollback:
  enabled: true
  errorThresholdPercent: 8
  validationFailureThreshold: 5
  autoRollback: true
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function GA_TO_CJA_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# Google Analytics 4 to Customer Journey Analytics
# ============================================================

metadata:
  name: "GA4 to CJA Migration"
  version: "1.0.0"
  description: "Migrate analytics from Google Analytics 4 to Adobe CJA"
  author: "Analytics Engineering Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: google_analytics
  version: "GA4"
  url: https://analytics.google.com
  auth:
    type: oauth_s2s
    credentials: \${GA4_SERVICE_ACCOUNT_KEY}

target:
  platform: cja
  url: https://cja.adobe.com
  programId: "org-analytics-001"
  auth:
    type: oauth_s2s
    credentials: \${ADOBE_ANALYTICS_CREDENTIALS}

scope:
  products:
    - cja
    - aep
  dateRange:
    from: "2023-01-01T00:00:00Z"
    to: "2026-03-22T00:00:00Z"
  maxSizeGB: 100

phases:
  - type: assessment
    enabled: true
    config:
      inventoryProperties: true
      mapDimensions: true
      mapMetrics: true
      identifyCustomEvents: true
    timeout: "2h"
    retries: 1
    continueOnError: false
    concurrency: 3

  - type: planning
    enabled: true
    config:
      createDataViewMapping: true
      planConnectionSetup: true
    timeout: "1h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: content_migration
    enabled: true
    config:
      exportViaBigQueryExport: true
      transformToXDMSchema: true
      batchSizeDays: 30
      backfillHistoricalData: true
    timeout: "12h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    config:
      setupWebSDK: true
      configureDataStreams: true
      migrateGoals: true
      recreateAudiences: true
    timeout: "4h"
    retries: 2
    continueOnError: true
    concurrency: 3

  - type: testing
    enabled: true
    config:
      compareMetrics: true
      validateDataAccuracy: true
      parallelTrackingDays: 14
    timeout: "336h"
    retries: 0
    continueOnError: true
    concurrency: 1

  - type: cutover
    enabled: true
    config:
      decommissionGATag: false
      switchDashboards: true
    timeout: "4h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 168
      compareWithGA: true
    timeout: "168h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Map GA4 events to XDM"
    type: api_replacement
    enabled: true
    sourceApi: "gtag('event', ...)"
    targetApi: "alloy('sendEvent', ...)"

  - name: "Convert custom dimensions"
    type: component_mapping
    enabled: true
    sourcePath: "ga4.custom_dimensions"
    targetPath: "xdm.customFields"

compliance:
  frameworks:
    - gdpr
    - ccpa
  piiHandling:
    strategy: pseudonymize
    fields:
      - user_id
      - client_id
    auditLog: true

notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
  events:
    - migration:complete
    - migration:failed

rollback:
  enabled: true
  errorThresholdPercent: 5
  autoRollback: false
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function CAMPAIGN_STD_TO_V8_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# Adobe Campaign Standard to Campaign v8
# ============================================================

metadata:
  name: "Campaign Standard to v8 Migration"
  version: "1.0.0"
  description: "Migrate email campaigns, workflows, and audiences from ACS to Campaign v8"
  author: "Marketing Operations Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: campaign_standard
  version: "24.1"
  url: https://campaign-std.example.com
  auth:
    type: oauth_s2s
    credentials: \${ACS_OAUTH_CREDENTIALS}

target:
  platform: campaign_v8
  url: https://campaign-v8.example.com
  auth:
    type: oauth_s2s
    credentials: \${CAMPAIGN_V8_CREDENTIALS}

scope:
  products:
    - campaign
    - ajo
  dateRange:
    from: "2024-01-01T00:00:00Z"
  maxSizeGB: 50

phases:
  - type: assessment
    enabled: true
    config:
      inventoryDeliveries: true
      analyzeWorkflows: true
      mapCustomResources: true
      auditRecipientSchemas: true
    timeout: "3h"
    retries: 1
    continueOnError: false
    concurrency: 3

  - type: planning
    enabled: true
    config:
      mapSchemaFields: true
      planWorkflowConversion: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: code_modernization
    enabled: true
    config:
      convertJSTOJavaScript: true
      migrateCustomActivities: true
      updateAPIEndpoints: true
    timeout: "8h"
    retries: 2
    continueOnError: true
    concurrency: 5

  - type: content_migration
    enabled: true
    config:
      migrateEmailTemplates: true
      migrateLandingPages: true
      migrateProfiles: true
      migrateSubscriptions: true
      migrateTransactionalTemplates: true
    timeout: "6h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    config:
      reconfigureExternalAccounts: true
      updateWebhooks: true
      migrateFileTransfers: true
    timeout: "4h"
    retries: 2
    continueOnError: true
    concurrency: 3

  - type: testing
    enabled: true
    config:
      sendTestDeliveries: true
      validatePersonalization: true
      checkDeliverability: true
    timeout: "4h"
    retries: 1
    continueOnError: false
    concurrency: 5

  - type: cutover
    enabled: true
    config:
      pauseActiveDeliveries: true
      switchSendingDomain: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 72
      trackDeliverabilityMetrics: true
      compareSendVolumes: true
    timeout: "72h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Update delivery template syntax"
    type: regex_replace
    enabled: true
    pattern: "<%@ include file=\\"(.*?)\\" %>"
    replacement: "<%@ include file=\\"v8/$1\\" %>"

  - name: "Map custom resource schemas"
    type: component_mapping
    enabled: true
    sourcePath: "acs:customResources"
    targetPath: "v8:customSchemas"

compliance:
  frameworks:
    - gdpr
  piiHandling:
    strategy: encrypt
    fields:
      - email
      - phone
      - firstName
      - lastName
    auditLog: true
  retentionDays: 730

notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
  email:
    addresses:
      - marketing-ops@example.com
  events:
    - migration:complete
    - migration:failed
    - phase:error
    - rollback:triggered

rollback:
  enabled: true
  errorThresholdPercent: 3
  validationFailureThreshold: 2
  autoRollback: true
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}

function AAM_TO_RTCDP_TEMPLATE(): string {
  return `# ============================================================
# Black Hole - Migration-as-Code
# Audience Manager to Real-Time CDP
# ============================================================

metadata:
  name: "AAM to RTCDP Migration"
  version: "1.0.0"
  description: "Migrate segments, traits, and audiences from Audience Manager to RTCDP"
  author: "Data Platform Team"
  created: "2026-03-22T00:00:00Z"

source:
  platform: aam
  version: "current"
  url: https://aam.adobe.com
  auth:
    type: oauth_s2s
    credentials: \${AAM_OAUTH_CREDENTIALS}

target:
  platform: rtcdp
  url: https://platform.adobe.com
  programId: "aep-org-001"
  auth:
    type: oauth_s2s
    credentials: \${AEP_OAUTH_CREDENTIALS}

scope:
  products:
    - rtcdp
    - aep
  dateRange:
    from: "2024-01-01T00:00:00Z"
  maxSizeGB: 200

phases:
  - type: assessment
    enabled: true
    config:
      inventoryTraits: true
      inventorySegments: true
      mapDestinations: true
      analyzeDataSources: true
      identifyOverlap: true
    timeout: "3h"
    retries: 1
    continueOnError: false
    concurrency: 3

  - type: planning
    enabled: true
    config:
      createXDMSchemaMapping: true
      planIdentityNamespaces: true
      designMergePolicy: true
    timeout: "2h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: content_migration
    enabled: true
    config:
      migrateTraitsToAttributes: true
      migrateSegmentsToAudiences: true
      migrateAlgorithmicModels: true
      backfillProfiles: true
      batchSizeProfiles: 1000000
    timeout: "12h"
    retries: 3
    continueOnError: true
    concurrency: 5

  - type: integration_reconnection
    enabled: true
    config:
      reconfigureDestinations: true
      updatePixelTags: true
      switchDataCollectionToWebSDK: true
      configureEdgeSegmentation: true
    timeout: "6h"
    retries: 2
    continueOnError: true
    concurrency: 3

  - type: testing
    enabled: true
    config:
      validateSegmentCounts: true
      testActivationFlow: true
      compareAudienceSizes: true
      parallelActivationDays: 7
    timeout: "168h"
    retries: 0
    continueOnError: true
    concurrency: 1

  - type: cutover
    enabled: true
    config:
      deactivateAAMDestinations: true
      activateRTCDPDestinations: true
      updatePartnerIntegrations: true
    timeout: "4h"
    retries: 0
    continueOnError: false
    concurrency: 1

  - type: monitoring
    enabled: true
    config:
      monitorDurationHours: 168
      compareSegmentPopulations: true
      trackActivationLatency: true
    timeout: "168h"
    retries: 0
    continueOnError: true
    concurrency: 1

rules:
  - name: "Convert trait rules to segment definitions"
    type: component_mapping
    enabled: true
    sourcePath: "aam.trait.rules"
    targetPath: "rtcdp.segment.definitions"

  - name: "Map data source IDs"
    type: api_replacement
    enabled: true
    sourceApi: "aam.datasource.id"
    targetApi: "aep.dataset.id"

compliance:
  frameworks:
    - gdpr
    - ccpa
  dataResidency:
    region: us-west-2
    enforceGeoFencing: true
  piiHandling:
    strategy: pseudonymize
    fields:
      - email
      - device_id
      - ip_address
    auditLog: true
  retentionDays: 365

notifications:
  slack:
    webhookUrl: \${SLACK_WEBHOOK_URL}
  email:
    addresses:
      - data-platform@example.com
  events:
    - migration:complete
    - migration:failed
    - phase:error
    - rollback:triggered

rollback:
  enabled: true
  errorThresholdPercent: 5
  validationFailureThreshold: 3
  autoRollback: true
  snapshotBeforeCutover: true
  notifyOnRollback: true
`;
}
