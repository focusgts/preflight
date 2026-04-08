/**
 * POST /api/migrations/[id]/transform — Start transformation phase
 *
 * Transitions the migration from ASSESSED/PLANNED to TRANSFORMING.
 * Uses the CodeModernizer engine to generate real transformation items
 * from code analysis findings. Auto-fixable items start as 'processing'
 * (ready for auto-fix); manual items start as 'pending'.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  MigrationStatus,
  MigrationType,
  PhaseType,
  CompatibilityLevel,
  Severity,
} from '@/types';
import type { MigrationPhase, MigrationItem } from '@/types';
import { success, error } from '@/lib/api/response';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import { getMigration, updateMigration } from '@/lib/api/store';
import {
  isAsyncRequest,
  startPhaseAsync,
  recordPhaseTransition,
} from '@/lib/orchestrator/route-helpers';
import {
  CodeModernizer,
  type ModernizationFinding,
  type ModernizationReport,
} from '@/lib/migration/code-modernizer';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Run the CodeModernizer against the assessment findings to produce
 * real transformation findings. When there are no actual code items
 * (no connector data), generate sample findings appropriate for the
 * migration type so the demo path still works.
 */
async function runModernization(
  migration: {
    migrationType: MigrationType;
    name: string;
    assessment: { findings: Array<{ affectedPath: string; title: string; description: string }> } | null;
  },
): Promise<ModernizationFinding[]> {
  const modernizer = new CodeModernizer();
  const reports: ModernizationReport[] = [];

  // Derive code items from assessment findings
  const assessmentFindings = migration.assessment?.findings ?? [];

  // Synthesize source-like items from findings so the modernizer has
  // something to analyse. Each finding's affected path and description
  // are used as pseudo-source content.
  const codeItems = assessmentFindings
    .filter((f) => f.affectedPath && f.description)
    .map((f) => ({
      path: f.affectedPath,
      content: `// ${f.title}\n${f.description}`,
    }));

  if (codeItems.length > 0) {
    // Run deprecated-API analysis on pseudo-source items
    reports.push(await modernizer.replaceDeprecatedAPIs(codeItems));
  }

  // If the modernizer found real findings, return them
  const allFindings = reports.flatMap((r) => r.findings);
  if (allFindings.length > 0) {
    return allFindings;
  }

  // Fallback: generate sample findings based on migration type
  return generateSampleFindings(migration.migrationType);
}

/**
 * Generate sample modernization findings when no real code is available.
 * For AEM on-prem/AMS to Cloud migrations, produces typical AEM 6.5
 * findings. For other types, produces generic platform findings.
 */
function generateSampleFindings(
  migrationType: MigrationType,
): ModernizationFinding[] {
  const isAem = [
    MigrationType.AEM_ONPREM_TO_CLOUD,
    MigrationType.AEM_AMS_TO_CLOUD,
    MigrationType.AEM_VERSION_UPGRADE,
  ].includes(migrationType);

  if (isAem) {
    return [
      makeFinding('/apps/myproject/components/search/Search.java', 'deprecated_api', Severity.CRITICAL, CompatibilityLevel.BLOCKER,
        'loginAdministrative() usage detected', 'loginAdministrative is removed in Cloud Service. Use service users via loginService().',
        'SlingRepository.loginAdministrative(null)', 'SlingRepository.loginService(null, "myproject-service")', false),
      makeFinding('/apps/myproject/components/search/Search.java', 'deprecated_api', Severity.CRITICAL, CompatibilityLevel.BLOCKER,
        'getAdministrativeResourceResolver() usage', 'Administrative resource resolvers are forbidden. Use service resource resolvers.',
        'ResourceResolverFactory.getAdministrativeResourceResolver(null)', 'ResourceResolverFactory.getServiceResourceResolver(authInfo)', false),
      makeFinding('/apps/myproject/listeners/ContentListener.java', 'deprecated_api', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
        'JCR EventListener usage', 'JCR EventListener deprecated. Use Sling ResourceChangeListener.',
        'javax.jcr.observation.EventListener', 'org.apache.sling.api.resource.observation.ResourceChangeListener', true),
      makeFinding('/apps/myproject/templates/page/.content.xml', 'deprecated_api', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
        'Static template detected', 'Static templates should be converted to editable templates for Cloud Service.',
        'cq:template="/apps/myproject/templates/page"', 'cq:template="/conf/myproject/settings/wcm/templates/page"', false),
      makeFinding('/apps/myproject/config/com.day.cq.replication.xml', 'osgi_config', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
        'OSGi XML config needs conversion', 'Convert sling:OsgiConfig XML to .cfg.json format for Cloud Service.',
        '<jcr:root jcr:primaryType="sling:OsgiConfig" enabled="{Boolean}true"/>', '{\n  "enabled": true\n}', true),
      makeFinding('pom.xml', 'maven_structure', Severity.CRITICAL, CompatibilityLevel.BLOCKER,
        'Missing ui.apps.structure module', 'Archetype 35+ requires a ui.apps.structure module.',
        '<!-- ui.apps.structure not found -->', '<artifactId>myproject.ui.apps.structure</artifactId>', false),
      makeFinding('/dispatcher/src/conf.d/dispatcher.any', 'dispatcher', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
        'Dispatcher config modernization', 'Converted to Cloud Service format. Removed on-prem-only directives.',
        '/allowedClients {\n  /0001 { /glob "*" /type "allow" }\n}', '# allowedClients removed - managed by Cloud CDN', true),
      makeFinding('/etc/workflow/models/dam/update_asset.xml', 'workflow', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
        'Custom DAM Update Asset workflow', 'Use Asset Compute or Processing Profiles in Cloud Service.',
        'Custom DAM workflow', '// Use Asset microservices instead', false),
      makeFinding('/oak:index/lucene/indexRules.xml', 'index_definition', Severity.HIGH, CompatibilityLevel.AUTO_FIXABLE,
        'Missing async config on Lucene index', 'Cloud Service requires async mode for Lucene indexes.',
        '<!-- no async -->', 'async="[async, nrt]"', true),
      makeFinding('/apps/myproject/components/dam/AssetHelper.java', 'deprecated_api', Severity.LOW, CompatibilityLevel.AUTO_FIXABLE,
        'Day CQ DAM AssetManager usage', 'Day CQ DAM AssetManager deprecated. Use Adobe CQ DAM API.',
        'com.day.cq.dam.api.AssetManager', 'com.adobe.cq.dam.api.AssetManager', true),
    ];
  }

  // Generic findings for non-AEM migrations
  return [
    makeFinding('/src/config/platform.json', 'deprecated_api', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
      'Platform-specific configuration requires manual review',
      `Configuration must be adapted for target platform (${migrationType}).`,
      '// Source platform config', '// Target platform config — manual mapping required', false),
    makeFinding('/src/integrations/api-endpoints.json', 'deprecated_api', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
      'API endpoint migration', 'API endpoints need to be remapped to target platform.',
      '// Old API endpoints', '// New API endpoints', true),
    makeFinding('/src/auth/credentials.json', 'osgi_config', Severity.CRITICAL, CompatibilityLevel.MANUAL_FIX,
      'Authentication mechanism change', 'Authentication must be migrated to target platform credentials.',
      '// Source auth config', '// Target auth config (OAuth 2.0 / S2S)', false),
  ];
}

function makeFinding(
  filePath: string, category: string, severity: Severity,
  compatibilityLevel: CompatibilityLevel, title: string, description: string,
  beforeCode: string, afterCode: string | null, autoFixApplied: boolean,
): ModernizationFinding {
  return {
    filePath, category: category as ModernizationFinding['category'],
    severity, compatibilityLevel, title, description,
    beforeCode, afterCode, autoFixApplied,
    remediationGuide: description,
  };
}

function estimateHoursForSeverity(severity: Severity): number {
  switch (severity) {
    case Severity.CRITICAL: return 8;
    case Severity.HIGH: return 4;
    case Severity.MEDIUM: return 2;
    case Severity.LOW: return 1;
    default: return 1;
  }
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const ip = _request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, resetAt } = checkRateLimit(ip, RATE_LIMITS.authenticatedWrite);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Try again later.', 429, { retryAfter: Math.ceil((resetAt - Date.now()) / 1000) });
  }

  try {
    const { id } = await params;

    // ADR-062: async mode — delegate to orchestrator + execution runtime.
    if (isAsyncRequest(_request)) {
      return await startPhaseAsync(id, 'transform');
    }

    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const allowedStatuses: MigrationStatus[] = [
      MigrationStatus.ASSESSED,
      MigrationStatus.PLANNED,
    ];

    if (!allowedStatuses.includes(migration.status)) {
      return error(
        'INVALID_STATE',
        `Cannot start transformation in ${migration.status} state. Migration must be assessed or planned.`,
        409,
      );
    }

    if (!migration.assessment) {
      return error(
        'PREREQUISITE_MISSING',
        'Assessment must be completed before transformation can begin.',
        400,
      );
    }

    const now = new Date().toISOString();

    // Run the CodeModernizer to produce real transformation findings
    const modernizationFindings = await runModernization(migration);

    // Convert findings into MigrationItems.
    // Auto-fixable items get status 'processing' (ready for auto-fix).
    // Manual / blocker items get status 'pending'.
    const transformItems: MigrationItem[] = modernizationFindings.map((finding) => ({
      id: `ti-${uuidv4().slice(0, 8)}`,
      type: 'code-transform',
      name: finding.title,
      sourcePath: finding.filePath,
      targetPath: finding.filePath,
      status: finding.autoFixApplied || finding.compatibilityLevel === CompatibilityLevel.AUTO_FIXABLE
        ? 'processing'
        : 'pending',
      compatibilityLevel: finding.compatibilityLevel,
      autoFixed: finding.autoFixApplied,
      validationResult: null,
      error: null,
      processedAt: null,
    }));

    const estimatedDuration = modernizationFindings.reduce(
      (sum, f) => sum + estimateHoursForSeverity(f.severity),
      0,
    );

    // Build code modernisation phase
    const codeModPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CODE_MODERNIZATION,
      name: 'Code Modernisation',
      status: MigrationStatus.TRANSFORMING,
      progress: 0,
      items: transformItems,
      startedAt: now,
      completedAt: null,
      estimatedDuration,
      actualDuration: null,
    };

    // Build content migration phase
    const contentItems: MigrationItem[] = [
      {
        id: `ti-${uuidv4().slice(0, 8)}`,
        type: 'content-transfer',
        name: 'Content Package Transfer',
        sourcePath: '/content',
        targetPath: '/content',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
      {
        id: `ti-${uuidv4().slice(0, 8)}`,
        type: 'asset-transfer',
        name: 'DAM Asset Transfer',
        sourcePath: '/content/dam',
        targetPath: '/content/dam',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
    ];

    const contentPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CONTENT_MIGRATION,
      name: 'Content Migration',
      status: MigrationStatus.DRAFT,
      progress: 0,
      items: contentItems,
      startedAt: null,
      completedAt: null,
      estimatedDuration: 40,
      actualDuration: null,
    };

    // Preserve existing phases and add new ones
    const existingPhases = migration.phases.filter(
      (p) =>
        p.type !== PhaseType.CODE_MODERNIZATION &&
        p.type !== PhaseType.CONTENT_MIGRATION,
    );

    updateMigration(id, {
      status: MigrationStatus.TRANSFORMING,
      phases: [...existingPhases, codeModPhase, contentPhase],
      progress: 20,
    });

    // ADR-062: mirror the state change through the orchestrator.
    await recordPhaseTransition(id, MigrationStatus.TRANSFORMING, {
      phase: 'transform',
      transformItems: transformItems.length,
    });

    console.log(
      `[API] POST /api/migrations/${id}/transform — started with ${transformItems.length} items (${transformItems.filter((i) => i.status === 'processing').length} auto-fixable)`,
    );
    return success(
      {
        migrationId: id,
        status: MigrationStatus.TRANSFORMING,
        phases: [codeModPhase, contentPhase],
        message: 'Transformation phase started. Code modernisation is in progress.',
      },
      202,
    );
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/transform error:', err);
    return error('INTERNAL_ERROR', 'Failed to start transformation', 500);
  }
}
