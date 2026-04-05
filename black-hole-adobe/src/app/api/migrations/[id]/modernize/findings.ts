/**
 * Shared finding generators for modernize endpoints.
 *
 * Extracted from the main modernize route so that the /apply and
 * /download sub-routes can reuse the same sample data.
 */

import { MigrationType, Severity, CompatibilityLevel } from '@/types';
import type { ModernizationFinding } from '@/lib/migration/code-modernizer';

function isAemToCloudMigration(type: MigrationType): boolean {
  return [
    MigrationType.AEM_ONPREM_TO_CLOUD,
    MigrationType.AEM_AMS_TO_CLOUD,
    MigrationType.AEM_VERSION_UPGRADE,
  ].includes(type);
}

/**
 * Return sample findings appropriate for the given migration type.
 */
export function generateFindings(migrationType: MigrationType): ModernizationFinding[] {
  return isAemToCloudMigration(migrationType)
    ? generateAemOnPremFindings()
    : generateGenericFindings(migrationType);
}

function generateAemOnPremFindings(): ModernizationFinding[] {
  return [
    {
      filePath: '/apps/myproject/components/search/Search.java',
      category: 'deprecated_api',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.BLOCKER,
      title: 'loginAdministrative() usage detected',
      description: 'loginAdministrative is removed in Cloud Service. Use service users via loginService().',
      beforeCode: 'SlingRepository.loginAdministrative(null)',
      afterCode: 'SlingRepository.loginService(null, "myproject-service")',
      autoFixApplied: false,
      remediationGuide: 'Create a service user mapping and replace loginAdministrative with loginService.',
    },
    {
      filePath: '/apps/myproject/components/search/Search.java',
      category: 'deprecated_api',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.BLOCKER,
      title: 'getAdministrativeResourceResolver() usage',
      description: 'Administrative resource resolvers are forbidden. Use service resource resolvers.',
      beforeCode: 'ResourceResolverFactory.getAdministrativeResourceResolver(null)',
      afterCode: 'ResourceResolverFactory.getServiceResourceResolver(authInfo)',
      autoFixApplied: false,
      remediationGuide: 'Replace with getServiceResourceResolver using a service user mapping.',
    },
    {
      filePath: '/apps/myproject/listeners/ContentListener.java',
      category: 'deprecated_api',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'JCR EventListener usage',
      description: 'JCR EventListener deprecated. Use Sling ResourceChangeListener.',
      beforeCode: 'javax.jcr.observation.EventListener',
      afterCode: 'org.apache.sling.api.resource.observation.ResourceChangeListener',
      autoFixApplied: true,
      remediationGuide: 'Migrate from JCR observation API to Sling ResourceChangeListener.',
    },
    {
      filePath: '/apps/myproject/templates/page/.content.xml',
      category: 'deprecated_api',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Static template detected',
      description: 'Static templates should be converted to editable templates for Cloud Service.',
      beforeCode: 'cq:template="/apps/myproject/templates/page"',
      afterCode: 'cq:template="/conf/myproject/settings/wcm/templates/page"',
      autoFixApplied: false,
      remediationGuide: 'Convert static templates to editable templates under /conf.',
    },
    {
      filePath: '/apps/myproject/config/com.day.cq.replication.impl.AgentManagerImpl.xml',
      category: 'osgi_config',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'OSGi XML config needs conversion',
      description: 'Convert sling:OsgiConfig XML to .cfg.json format for Cloud Service.',
      beforeCode: '<jcr:root jcr:primaryType="sling:OsgiConfig" enabled="{Boolean}true"/>',
      afterCode: '{\n  "enabled": true\n}',
      autoFixApplied: true,
      remediationGuide: 'Place converted config in ui.config/osgiconfig/config/',
    },
    {
      filePath: 'pom.xml',
      category: 'maven_structure',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.BLOCKER,
      title: 'Missing ui.apps.structure module',
      description: 'Archetype 35+ requires a ui.apps.structure module.',
      beforeCode: '<!-- ui.apps.structure not found -->',
      afterCode: '<artifactId>myproject.ui.apps.structure</artifactId>',
      autoFixApplied: false,
      remediationGuide: 'Add ui.apps.structure module per Cloud Service Archetype 35+.',
    },
    {
      filePath: 'pom.xml',
      category: 'maven_structure',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Path migration: /etc/designs',
      description: 'Relocate /etc/designs to /apps/myproject/components.',
      beforeCode: '/etc/designs',
      afterCode: '/apps/myproject/components',
      autoFixApplied: true,
      remediationGuide: 'Move design artifacts from /etc/designs to /apps.',
    },
    {
      filePath: '/dispatcher/src/conf.d/dispatcher.any',
      category: 'dispatcher',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Dispatcher modernized: farm',
      description: 'Converted to Cloud Service format. Removed on-prem-only directives.',
      beforeCode: '/allowedClients {\n  /0001 { /glob "*" /type "allow" }\n}',
      afterCode: '# allowedClients removed - managed by Cloud CDN',
      autoFixApplied: true,
      remediationGuide: 'Cloud CDN manages allowedClients; remove from Dispatcher config.',
    },
    {
      filePath: '/etc/workflow/models/dam/update_asset.xml',
      category: 'workflow',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Custom DAM Update Asset workflow',
      description: 'Use Asset Compute or Processing Profiles in Cloud Service.',
      beforeCode: 'Custom DAM workflow',
      afterCode: '// Use Asset microservices instead',
      autoFixApplied: false,
      remediationGuide: 'Replace custom DAM workflow with Asset Compute workers or Processing Profiles.',
    },
    {
      filePath: '/oak:index/lucene/indexRules.xml',
      category: 'index_definition',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Missing async config on Lucene index',
      description: 'Cloud Service requires async mode for Lucene indexes.',
      beforeCode: '<!-- no async -->',
      afterCode: 'async="[async, nrt]"',
      autoFixApplied: true,
      remediationGuide: 'Add async="[async, nrt]" to Lucene index definitions.',
    },
    {
      filePath: '/apps/myproject/components/page/body.html',
      category: 'deprecated_api',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Day CQ QueryBuilder usage',
      description: 'Day CQ QueryBuilder deprecated. Use com.adobe.cq.search.',
      beforeCode: 'com.day.cq.search.QueryBuilder',
      afterCode: 'com.adobe.cq.search.QueryBuilder',
      autoFixApplied: true,
      remediationGuide: 'Update import to com.adobe.cq.search.QueryBuilder.',
    },
    {
      filePath: '/apps/myproject/components/dam/AssetHelper.java',
      category: 'deprecated_api',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Day CQ DAM AssetManager usage',
      description: 'Day CQ DAM AssetManager deprecated. Use Adobe CQ DAM API.',
      beforeCode: 'com.day.cq.dam.api.AssetManager',
      afterCode: 'com.adobe.cq.dam.api.AssetManager',
      autoFixApplied: true,
      remediationGuide: 'Update import to com.adobe.cq.dam.api.AssetManager.',
    },
    {
      filePath: '/apps/myproject/config/replication.xml',
      category: 'deprecated_api',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Legacy replication API usage',
      description: 'Legacy replication API deprecated. Use Granite Replication API.',
      beforeCode: 'com.day.cq.replication.ReplicationAction',
      afterCode: 'com.adobe.granite.replication.api',
      autoFixApplied: true,
      remediationGuide: 'Migrate to com.adobe.granite.replication.api.',
    },
    {
      filePath: '/content/oak:index/damAssetLucene/.content.xml',
      category: 'index_definition',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Index in non-standard location',
      description: 'Must be under /apps or /oak:index for Cloud Service.',
      beforeCode: '/content/oak:index/damAssetLucene',
      afterCode: '/apps/_oak_index/damAssetLucene',
      autoFixApplied: false,
      remediationGuide: 'Relocate index definition from /content to /apps/_oak_index/.',
    },
    {
      filePath: '/oak:index/damAssetLucene/.content.xml',
      category: 'index_definition',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Missing compatVersion on index',
      description: 'Should declare compatVersion=2 for Cloud Service.',
      beforeCode: '<!-- none -->',
      afterCode: 'compatVersion="{Long}2"',
      autoFixApplied: true,
      remediationGuide: 'Add compatVersion="{Long}2" to index definition.',
    },
  ];
}

function generateGenericFindings(migrationType: MigrationType): ModernizationFinding[] {
  return [
    {
      filePath: '/src/config/platform.json',
      category: 'deprecated_api',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Platform-specific configuration requires manual review',
      description: `Configuration must be adapted for target platform (${migrationType}).`,
      beforeCode: '// Source platform config',
      afterCode: '// Target platform config — manual mapping required',
      autoFixApplied: false,
      remediationGuide: 'Review and update platform-specific configuration values.',
    },
    {
      filePath: '/src/integrations/api-endpoints.json',
      category: 'deprecated_api',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'API endpoint migration',
      description: 'API endpoints need to be remapped to target platform.',
      beforeCode: '// Old API endpoints',
      afterCode: '// New API endpoints',
      autoFixApplied: true,
      remediationGuide: 'Update API endpoints to target platform equivalents.',
    },
    {
      filePath: '/src/auth/credentials.json',
      category: 'osgi_config',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Authentication mechanism change',
      description: 'Authentication must be migrated to target platform credentials.',
      beforeCode: '// Source auth config',
      afterCode: '// Target auth config (OAuth 2.0 / S2S)',
      autoFixApplied: false,
      remediationGuide: 'Migrate authentication to target platform OAuth 2.0 Server-to-Server credentials.',
    },
  ];
}
