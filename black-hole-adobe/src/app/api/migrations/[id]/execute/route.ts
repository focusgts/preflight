/**
 * POST /api/migrations/[id]/execute — Execute migration
 *
 * Transitions the migration to EXECUTING status.
 * Creates cutover phase with real execution items derived from
 * migration phase data and deterministic generation.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { MigrationStatus, PhaseType, CompatibilityLevel, MigrationType } from '@/types';
import type { MigrationPhase, MigrationItem, MigrationProject } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration, updateMigration } from '@/lib/api/store';
import { progressEventBus } from '@/lib/progress/event-bus';
import { hashString } from '@/lib/engine/deterministic-scoring';

type RouteParams = { params: Promise<{ id: string }> };

// ── AEM execution item templates ──────────────────────────────

interface ExecutionTemplate {
  type: string;
  name: string;
  sourcePrefix: string;
  targetPrefix: string;
}

const AEM_TEMPLATES: ExecutionTemplate[] = [
  { type: 'content-package', name: 'Content Package Export', sourcePrefix: '/content/packages', targetPrefix: '/content/packages' },
  { type: 'content-package', name: 'Content Package Import', sourcePrefix: '/content/dam', targetPrefix: '/content/dam' },
  { type: 'dam-asset-batch', name: 'DAM Asset Batch Transfer', sourcePrefix: '/content/dam/site', targetPrefix: '/content/dam/site' },
  { type: 'user-group-sync', name: 'User Groups & Principals Sync', sourcePrefix: '/home/groups', targetPrefix: '/home/groups' },
  { type: 'acl-migration', name: 'ACL & Permission Migration', sourcePrefix: '/rep:policy', targetPrefix: '/rep:policy' },
  { type: 'workflow-migration', name: 'Workflow Models Migration', sourcePrefix: '/var/workflow/models', targetPrefix: '/conf/global/settings/workflow/models' },
  { type: 'osgi-config', name: 'OSGi Configuration Deployment', sourcePrefix: '/apps/system/config', targetPrefix: '/apps/system/config' },
  { type: 'dispatcher-config', name: 'Dispatcher Configuration', sourcePrefix: '/etc/httpd', targetPrefix: '/etc/httpd' },
  { type: 'index-definition', name: 'Oak Index Definitions', sourcePrefix: '/oak:index', targetPrefix: '/oak:index' },
  { type: 'replication-agent', name: 'Replication Agent Setup', sourcePrefix: '/etc/replication', targetPrefix: '/etc/replication' },
  { type: 'cloud-manager', name: 'Cloud Manager Pipeline Deploy', sourcePrefix: 'pipeline://build', targetPrefix: 'pipeline://deploy' },
  { type: 'dns-cutover', name: 'DNS Cutover', sourcePrefix: 'dns://source', targetPrefix: 'dns://target' },
  { type: 'ssl-provisioning', name: 'SSL Certificate Provisioning', sourcePrefix: 'ssl://source', targetPrefix: 'ssl://target' },
  { type: 'cdn-configuration', name: 'CDN Configuration', sourcePrefix: 'cdn://source', targetPrefix: 'cdn://target' },
];

const ANALYTICS_TEMPLATES: ExecutionTemplate[] = [
  { type: 'report-suite', name: 'Report Suite Migration', sourcePrefix: 'rs://source', targetPrefix: 'rs://target' },
  { type: 'calculated-metric', name: 'Calculated Metrics Transfer', sourcePrefix: 'metric://source', targetPrefix: 'metric://target' },
  { type: 'segment-migration', name: 'Segment Definitions Migration', sourcePrefix: 'segment://source', targetPrefix: 'segment://target' },
  { type: 'classification', name: 'Classification Data Import', sourcePrefix: 'class://source', targetPrefix: 'class://target' },
  { type: 'data-feed', name: 'Data Feed Configuration', sourcePrefix: 'feed://source', targetPrefix: 'feed://target' },
  { type: 'workspace-project', name: 'Workspace Project Migration', sourcePrefix: 'workspace://source', targetPrefix: 'workspace://target' },
  { type: 'dns-cutover', name: 'DNS Cutover', sourcePrefix: 'dns://source', targetPrefix: 'dns://target' },
];

const CAMPAIGN_TEMPLATES: ExecutionTemplate[] = [
  { type: 'template-migration', name: 'Email Template Migration', sourcePrefix: 'template://source', targetPrefix: 'template://target' },
  { type: 'delivery-migration', name: 'Delivery Configuration', sourcePrefix: 'delivery://source', targetPrefix: 'delivery://target' },
  { type: 'workflow-migration', name: 'Campaign Workflow Migration', sourcePrefix: 'workflow://source', targetPrefix: 'workflow://target' },
  { type: 'schema-migration', name: 'Data Schema Migration', sourcePrefix: 'schema://source', targetPrefix: 'schema://target' },
  { type: 'audience-migration', name: 'Audience Segment Migration', sourcePrefix: 'audience://source', targetPrefix: 'audience://target' },
  { type: 'dns-cutover', name: 'DNS Cutover', sourcePrefix: 'dns://source', targetPrefix: 'dns://target' },
];

/**
 * Choose execution templates based on migration type.
 */
function getTemplatesForType(migrationType: MigrationType): ExecutionTemplate[] {
  const typeStr = migrationType as string;
  if (typeStr.startsWith('ga_') || typeStr.startsWith('analytics_') || typeStr.startsWith('aam_')) {
    return ANALYTICS_TEMPLATES;
  }
  if (typeStr.startsWith('campaign_') || typeStr.startsWith('sfmc_') || typeStr.startsWith('hubspot_')) {
    return CAMPAIGN_TEMPLATES;
  }
  return AEM_TEMPLATES;
}

/**
 * Build execution items from existing phase data if available,
 * otherwise generate deterministic items from templates.
 */
function buildExecutionItems(migration: MigrationProject): MigrationItem[] {
  const items: MigrationItem[] = [];
  const seed = migration.id;

  // Collect real items from transform phases
  const transformPhases = migration.phases.filter(
    (p) =>
      p.type === PhaseType.CODE_MODERNIZATION ||
      p.type === PhaseType.CONTENT_MIGRATION,
  );

  const realItemCount = transformPhases.reduce((sum, p) => sum + p.items.length, 0);

  if (realItemCount > 0) {
    // Derive execution batches from transform results
    let batchIndex = 0;
    for (const phase of transformPhases) {
      const batchSize = Math.max(1, Math.ceil(phase.items.length / 5));
      for (let i = 0; i < phase.items.length; i += batchSize) {
        const batchItems = phase.items.slice(i, i + batchSize);
        const batchName =
          phase.type === PhaseType.CODE_MODERNIZATION
            ? `Code Deploy Batch ${batchIndex + 1}`
            : `Content Package Batch ${batchIndex + 1}`;
        items.push({
          id: `ei-${hashString(`${seed}-batch-${batchIndex}`).toString(36).slice(0, 8)}`,
          type: phase.type === PhaseType.CODE_MODERNIZATION ? 'code-deploy' : 'content-package',
          name: batchName,
          sourcePath: batchItems[0]?.sourcePath ?? `/batch/${batchIndex}`,
          targetPath: batchItems[0]?.targetPath ?? `/batch/${batchIndex}`,
          status: 'pending',
          compatibilityLevel: CompatibilityLevel.COMPATIBLE,
          autoFixed: false,
          validationResult: null,
          error: null,
          processedAt: null,
        });
        batchIndex++;
      }
    }

    // Always add infrastructure cutover items
    const infraItems: ExecutionTemplate[] = [
      { type: 'dns-cutover', name: 'DNS Cutover', sourcePrefix: 'dns://source', targetPrefix: 'dns://target' },
      { type: 'ssl-provisioning', name: 'SSL Certificate Provisioning', sourcePrefix: 'ssl://source', targetPrefix: 'ssl://target' },
      { type: 'cdn-configuration', name: 'CDN Configuration', sourcePrefix: 'cdn://source', targetPrefix: 'cdn://target' },
    ];
    for (const tmpl of infraItems) {
      items.push({
        id: `ei-${hashString(`${seed}-${tmpl.type}`).toString(36).slice(0, 8)}`,
        type: tmpl.type,
        name: tmpl.name,
        sourcePath: tmpl.sourcePrefix,
        targetPath: tmpl.targetPrefix,
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      });
    }

    return items;
  }

  // No real data — generate deterministic items from templates
  const templates = getTemplatesForType(migration.migrationType);
  const hash = hashString(seed);

  // Deterministically select a subset of templates (at least 5)
  const count = Math.max(5, 5 + (hash % (templates.length - 4)));
  const selected = templates.slice(0, Math.min(count, templates.length));

  for (let i = 0; i < selected.length; i++) {
    const tmpl = selected[i];
    // First item starts processing immediately
    const status: MigrationItem['status'] = i === 0 ? 'processing' : 'pending';
    items.push({
      id: `ei-${hashString(`${seed}-${tmpl.type}-${i}`).toString(36).slice(0, 8)}`,
      type: tmpl.type,
      name: tmpl.name,
      sourcePath: tmpl.sourcePrefix,
      targetPath: tmpl.targetPrefix,
      status,
      compatibilityLevel: CompatibilityLevel.COMPATIBLE,
      autoFixed: false,
      validationResult: null,
      error: null,
      processedAt: null,
    });
  }

  return items;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // Transformation must be complete before execution
    if (migration.status !== MigrationStatus.TRANSFORMING) {
      return error(
        'INVALID_STATE',
        `Cannot execute migration in ${migration.status} state. Transformation must be in progress or complete.`,
        409,
      );
    }

    // Check that code modernisation phase is substantially complete
    const codePhase = migration.phases.find(
      (p) => p.type === PhaseType.CODE_MODERNIZATION,
    );
    if (codePhase && codePhase.progress < 80) {
      return error(
        'PREREQUISITE_INCOMPLETE',
        `Code modernisation is only ${codePhase.progress}% complete. Must be at least 80% before execution.`,
        400,
      );
    }

    const now = new Date().toISOString();

    // Mark transformation phases as completed
    const updatedPhases = migration.phases.map((phase) => {
      if (
        phase.type === PhaseType.CODE_MODERNIZATION ||
        phase.type === PhaseType.CONTENT_MIGRATION
      ) {
        return {
          ...phase,
          status: MigrationStatus.COMPLETED,
          progress: 100,
          completedAt: now,
          items: phase.items.map((item) => ({
            ...item,
            status: 'completed' as const,
            processedAt: item.processedAt ?? now,
          })),
        };
      }
      return phase;
    });

    // Build execution items from real phase data or deterministic generation
    const cutoverItems = buildExecutionItems(migration);

    const cutoverPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CUTOVER,
      name: 'Cutover',
      status: MigrationStatus.EXECUTING,
      progress: 10,
      items: cutoverItems,
      startedAt: now,
      completedAt: null,
      estimatedDuration: Math.max(4, Math.ceil(cutoverItems.length * 0.5)),
      actualDuration: null,
    };

    updateMigration(id, {
      status: MigrationStatus.EXECUTING,
      phases: [...updatedPhases, cutoverPhase],
      progress: 75,
    });

    // Emit progress events
    progressEventBus.emitProgress(id, {
      type: 'phase_start',
      phase: 'Cutover',
      progress: 75,
      message: `Cutover phase started with ${cutoverItems.length} execution items.`,
      details: {
        itemsTotal: cutoverItems.length,
        itemsProcessed: 0,
      },
    });

    console.log(
      `[API] POST /api/migrations/${id}/execute — execution started (${cutoverItems.length} items)`,
    );
    return success(
      {
        migrationId: id,
        status: MigrationStatus.EXECUTING,
        cutoverPhase,
        message: 'Migration execution started. Cutover phase is in progress.',
      },
      202,
    );
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/execute error:', err);
    return error('INTERNAL_ERROR', 'Failed to execute migration', 500);
  }
}
