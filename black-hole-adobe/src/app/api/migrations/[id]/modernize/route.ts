/**
 * POST /api/migrations/[id]/modernize - Run code modernization analysis
 *
 * Instantiates the CodeModernizer engine and runs analysis across the
 * requested scopes. Returns findings with before/after diffs, severity,
 * and auto-fix availability.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { MigrationStatus, MigrationType, Severity, CompatibilityLevel } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import {
  CodeModernizer,
  type ModernizationFinding,
  type ModernizationReport,
} from '@/lib/migration/code-modernizer';

type RouteParams = { params: Promise<{ id: string }> };

type ModernizeScope = 'code' | 'osgi' | 'maven' | 'dispatcher' | 'workflows' | 'indexes';

interface ModernizeRequest {
  scope?: ModernizeScope[];
  items?: Array<{ path: string; content: string }>;
}

interface ApiFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  filePath: string;
  line: number | null;
  before: string;
  after: string | null;
  autoFixAvailable: boolean;
  estimatedHours: number;
}

interface ApiFindingSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  autoFixable: number;
  manualRequired: number;
  estimatedTotalHours: number;
}

const ALL_SCOPES: ModernizeScope[] = ['code', 'osgi', 'maven', 'dispatcher', 'workflows', 'indexes'];

/**
 * Generate sample findings for AEM on-prem to Cloud migration when no
 * real code items are available. These represent the most common issues
 * found in AEM 6.5 projects migrating to Cloud Service.
 */
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

/**
 * Generate sample findings for non-AEM migration types.
 */
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

/**
 * Map the modernizer's internal finding format to the API response format.
 */
function toApiFinding(f: ModernizationFinding, index: number): ApiFinding {
  return {
    id: `finding-${String(index + 1).padStart(3, '0')}`,
    category: f.category,
    severity: f.severity,
    title: f.title,
    description: f.description,
    filePath: f.filePath,
    line: null,
    before: f.beforeCode,
    after: f.afterCode,
    autoFixAvailable: f.autoFixApplied || f.compatibilityLevel === CompatibilityLevel.AUTO_FIXABLE,
    estimatedHours: estimateHours(f),
  };
}

function estimateHours(f: ModernizationFinding): number {
  switch (f.severity) {
    case Severity.CRITICAL: return 8;
    case Severity.HIGH: return 4;
    case Severity.MEDIUM: return 2;
    case Severity.LOW: return 1;
    default: return 1;
  }
}

function buildSummary(apiFindings: ApiFinding[]): ApiFindingSummary {
  const autoFixable = apiFindings.filter((f) => f.autoFixAvailable).length;
  return {
    total: apiFindings.length,
    critical: apiFindings.filter((f) => f.severity === Severity.CRITICAL).length,
    high: apiFindings.filter((f) => f.severity === Severity.HIGH).length,
    medium: apiFindings.filter((f) => f.severity === Severity.MEDIUM).length,
    low: apiFindings.filter((f) => f.severity === Severity.LOW).length,
    autoFixable,
    manualRequired: apiFindings.length - autoFixable,
    estimatedTotalHours: apiFindings.reduce((sum, f) => sum + f.estimatedHours, 0),
  };
}

function isAemToCloudMigration(type: MigrationType): boolean {
  return [
    MigrationType.AEM_ONPREM_TO_CLOUD,
    MigrationType.AEM_AMS_TO_CLOUD,
    MigrationType.AEM_VERSION_UPGRADE,
  ].includes(type);
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    let body: ModernizeRequest = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const scopes: ModernizeScope[] =
      body.scope && body.scope.length > 0 ? body.scope : ALL_SCOPES;

    const codeItems: Array<{ path: string; content: string }> =
      body.items && body.items.length > 0 ? body.items : [];

    const modernizer = new CodeModernizer();
    const reports: ModernizationReport[] = [];
    let isEstimated = false;

    // If no code items are provided, generate sample findings
    if (codeItems.length === 0) {
      isEstimated = true;

      const sampleFindings = isAemToCloudMigration(migration.migrationType)
        ? generateAemOnPremFindings()
        : generateGenericFindings(migration.migrationType);

      // Filter to requested scopes
      const scopeToCategoryMap: Record<ModernizeScope, string[]> = {
        code: ['deprecated_api'],
        osgi: ['osgi_config'],
        maven: ['maven_structure'],
        dispatcher: ['dispatcher'],
        workflows: ['workflow'],
        indexes: ['index_definition'],
      };

      const allowedCategories = new Set(
        scopes.flatMap((s) => scopeToCategoryMap[s]),
      );

      const filtered = sampleFindings.filter((f) =>
        allowedCategories.has(f.category),
      );

      const apiFindings = filtered.map(toApiFinding);

      console.log(
        `[API] POST /api/migrations/${id}/modernize — ${apiFindings.length} estimated findings`,
      );

      return success({
        findings: apiFindings,
        summary: buildSummary(apiFindings),
        estimated: true,
        note: 'These are estimated findings based on the migration type. Connect a source environment for full analysis.',
      });
    }

    // Run real analysis for each requested scope
    if (scopes.includes('code')) {
      reports.push(await modernizer.replaceDeprecatedAPIs(codeItems));
    }

    if (scopes.includes('osgi')) {
      const osgiItems = codeItems
        .filter((item) => item.path.endsWith('.xml') && item.path.includes('config'))
        .map((item) => ({ path: item.path, xml: item.content }));
      if (osgiItems.length > 0) {
        reports.push(await modernizer.modernizeOSGiConfigs(osgiItems));
      }
    }

    if (scopes.includes('maven')) {
      const pomItems = codeItems.filter((item) => item.path.endsWith('pom.xml'));
      if (pomItems.length > 0) {
        // Extract module info from pom files (simplified)
        const modules = pomItems.map((p) => ({
          artifactId: p.path.split('/').slice(-2, -1)[0] || 'unknown',
          packaging: 'content-package',
          path: p.path.replace('/pom.xml', ''),
          dependencies: [],
        }));
        const projectName = migration.name.toLowerCase().replace(/\s+/g, '-');
        reports.push(await modernizer.modernizeMavenProject(modules, projectName));
      }
    }

    if (scopes.includes('dispatcher')) {
      const dispatcherItems = codeItems
        .filter(
          (item) =>
            item.path.includes('dispatcher') ||
            item.path.endsWith('.any') ||
            item.path.endsWith('.vhost') ||
            item.path.endsWith('.farm'),
        )
        .map((item) => ({
          type: 'farm' as const,
          path: item.path,
          content: item.content,
        }));
      if (dispatcherItems.length > 0) {
        reports.push(await modernizer.modernizeDispatcherConfig(dispatcherItems));
      }
    }

    if (scopes.includes('workflows')) {
      const workflowItems = codeItems
        .filter((item) => item.path.includes('workflow'))
        .map((item) => ({ path: item.path, xml: item.content }));
      if (workflowItems.length > 0) {
        reports.push(await modernizer.modernizeWorkflows(workflowItems));
      }
    }

    if (scopes.includes('indexes')) {
      const indexItems = codeItems
        .filter(
          (item) =>
            item.path.includes('oak:index') ||
            item.path.includes('_oak_index'),
        )
        .map((item) => ({ path: item.path, xml: item.content }));
      if (indexItems.length > 0) {
        reports.push(await modernizer.convertIndexes(indexItems));
      }
    }

    // Merge all findings from all reports
    const allFindings = reports.flatMap((r) => r.findings);
    const apiFindings = allFindings.map(toApiFinding);

    console.log(
      `[API] POST /api/migrations/${id}/modernize — ${apiFindings.length} real findings across ${scopes.join(', ')}`,
    );

    return success({
      findings: apiFindings,
      summary: buildSummary(apiFindings),
      estimated: isEstimated,
    });
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/modernize error:', err);
    return error('INTERNAL_ERROR', 'Failed to run code modernization analysis', 500);
  }
}
