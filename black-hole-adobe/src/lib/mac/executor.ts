/**
 * Migration-as-Code Executor
 *
 * Translates a declarative MigrationConfig into imperative orchestrator
 * calls. Supports dry-run, diff, and export operations.
 */

import { v4 as uuid } from 'uuid';
import {
  MigrationType,
  MigrationStatus,
  PhaseType,
  type MigrationProject,
  type MigrationPhase,
  type MigrationItem,
} from '@/types';
import {
  type MigrationConfig,
  type ConfigDiff,
  type ConfigDiffEntry,
  TEMPLATE_TO_MIGRATION_TYPE,
  type TemplateName,
} from './schema';
import { MigrationConfigParser } from './parser';

// ============================================================
// Types
// ============================================================

export interface ExecutionOptions {
  dryRun?: boolean;
  resolveEnvVars?: boolean;
  validateOnly?: boolean;
}

export interface DryRunResult {
  valid: boolean;
  migrationName: string;
  migrationType: string;
  productsInScope: string[];
  phasesPlanned: Array<{
    type: PhaseType;
    enabled: boolean;
    concurrency: number;
    retries: number;
  }>;
  rulesCount: number;
  complianceFrameworks: string[];
  rollbackEnabled: boolean;
  warnings: string[];
}

export interface ExecutionResult {
  migrationId: string;
  project: MigrationProject;
  status: 'created' | 'failed';
  message: string;
}

// ============================================================
// Executor
// ============================================================

export class MigrationConfigExecutor {
  private readonly parser = new MigrationConfigParser();

  /**
   * Create a MigrationProject from a validated config.
   */
  fromConfig(config: MigrationConfig): MigrationProject {
    const now = new Date().toISOString();
    const migrationId = uuid();

    const migrationType = this.resolveMigrationType(config);

    const phases: MigrationPhase[] = config.phases
      .filter((p) => p.enabled !== false)
      .map((phaseConfig, index) => ({
        id: `phase-${migrationId}-${index}`,
        type: phaseConfig.type,
        name: this.phaseLabel(phaseConfig.type),
        status: MigrationStatus.DRAFT,
        progress: 0,
        items: [] as MigrationItem[],
        startedAt: null,
        completedAt: null,
        estimatedDuration: 0,
        actualDuration: null,
      }));

    return {
      id: migrationId,
      name: config.metadata.name,
      organizationId: 'org-mac-' + migrationId.slice(0, 8),
      organizationName: config.metadata.author,
      migrationType,
      status: MigrationStatus.DRAFT,
      productsInScope: config.scope.products,
      complianceRequirements: config.compliance?.frameworks ?? [],
      sourceEnvironment: {
        platform: config.source.platform,
        version: config.source.version,
        url: config.source.url ?? null,
        connectionType: 'api',
        credentials: null,
        metadata: {},
      },
      targetEnvironment: {
        platform: config.target.platform,
        organizationId: 'org-mac-' + migrationId.slice(0, 8),
        programId: config.target.programId ?? null,
        environmentId: config.target.environmentId ?? null,
        url: config.target.url ?? null,
        credentials: null,
        metadata: {},
      },
      assessment: null,
      phases,
      riskScore: 0,
      estimatedDurationWeeks: 0,
      estimatedCost: 0,
      actualCost: null,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      targetCompletionDate: null,
      completedAt: null,
    };
  }

  /**
   * Execute a migration defined by config. Creates the project
   * and applies rules. Returns the created migration.
   */
  execute(
    config: MigrationConfig,
    options: ExecutionOptions = {},
  ): ExecutionResult {
    try {
      // Optionally resolve env vars
      let resolvedConfig = config;
      if (options.resolveEnvVars) {
        resolvedConfig = this.parser.resolveEnvVars(config);
      }

      const project = this.fromConfig(resolvedConfig);

      // Apply custom rules to project metadata
      if (resolvedConfig.rules.length > 0) {
        this.applyRules(project, resolvedConfig);
      }

      // Apply rollback settings to project metadata
      if (resolvedConfig.rollback) {
        (project as MigrationProject & { rollbackConfig?: unknown }).rollbackConfig =
          resolvedConfig.rollback;
      }

      return {
        migrationId: project.id,
        project,
        status: 'created',
        message: `Migration "${project.name}" created with ${project.phases.length} phases`,
      };
    } catch (err) {
      return {
        migrationId: '',
        project: null as unknown as MigrationProject,
        status: 'failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Validate config and show what would happen without executing.
   */
  dryRun(config: MigrationConfig): DryRunResult {
    const warnings: string[] = [];

    // Check for disabled phases
    const disabledPhases = config.phases.filter((p) => !p.enabled);
    if (disabledPhases.length > 0) {
      warnings.push(
        `${disabledPhases.length} phase(s) are disabled and will be skipped`,
      );
    }

    // Check for high concurrency
    const highConcurrency = config.phases.filter((p) => p.concurrency > 20);
    if (highConcurrency.length > 0) {
      warnings.push(
        'High concurrency (>20) on some phases may cause rate limiting',
      );
    }

    // Check rollback
    if (!config.rollback?.enabled) {
      warnings.push('Rollback is disabled. Recovery from failures will be manual.');
    }

    return {
      valid: true,
      migrationName: config.metadata.name,
      migrationType: this.resolveMigrationType(config),
      productsInScope: config.scope.products,
      phasesPlanned: config.phases.map((p) => ({
        type: p.type,
        enabled: p.enabled,
        concurrency: p.concurrency,
        retries: p.retries,
      })),
      rulesCount: config.rules.length,
      complianceFrameworks: config.compliance?.frameworks ?? [],
      rollbackEnabled: config.rollback?.enabled ?? false,
      warnings,
    };
  }

  /**
   * Show differences between two configs.
   */
  diff(configA: MigrationConfig, configB: MigrationConfig): ConfigDiff {
    const entries: ConfigDiffEntry[] = [];

    // Compare top-level sections
    this.diffObject(configA.metadata, configB.metadata, 'metadata', entries);
    this.diffObject(configA.source, configB.source, 'source', entries);
    this.diffObject(configA.target, configB.target, 'target', entries);
    this.diffObject(configA.scope, configB.scope, 'scope', entries);

    // Compare phases by index
    const maxPhases = Math.max(configA.phases.length, configB.phases.length);
    for (let i = 0; i < maxPhases; i++) {
      const phaseA = configA.phases[i];
      const phaseB = configB.phases[i];
      if (!phaseA && phaseB) {
        entries.push({ path: `phases[${i}]`, type: 'added', newValue: phaseB.type });
      } else if (phaseA && !phaseB) {
        entries.push({ path: `phases[${i}]`, type: 'removed', oldValue: phaseA.type });
      } else if (phaseA && phaseB) {
        this.diffObject(phaseA, phaseB, `phases[${i}]`, entries);
      }
    }

    // Compare rules count
    if (configA.rules.length !== configB.rules.length) {
      entries.push({
        path: 'rules',
        type: 'changed',
        oldValue: `${configA.rules.length} rules`,
        newValue: `${configB.rules.length} rules`,
      });
    }

    const summary = entries.length === 0
      ? 'No differences found'
      : `${entries.length} difference(s): ${entries.filter((e) => e.type === 'added').length} added, ${entries.filter((e) => e.type === 'removed').length} removed, ${entries.filter((e) => e.type === 'changed').length} changed`;

    return { entries, summary };
  }

  /**
   * Export an existing migration project as a MigrationConfig YAML string.
   */
  exportConfig(project: MigrationProject): string {
    const config: MigrationConfig = {
      metadata: {
        name: project.name,
        version: '1.0.0',
        description: `Exported from migration ${project.id}`,
        author: project.organizationName,
        created: project.createdAt,
      },
      source: {
        platform: project.sourceEnvironment.platform,
        version: project.sourceEnvironment.version,
        url: project.sourceEnvironment.url ?? undefined,
      },
      target: {
        platform: project.targetEnvironment.platform,
        url: project.targetEnvironment.url ?? undefined,
        programId: project.targetEnvironment.programId ?? undefined,
        environmentId: project.targetEnvironment.environmentId ?? undefined,
      },
      scope: {
        products: project.productsInScope,
      },
      phases: project.phases.map((phase) => ({
        type: phase.type,
        enabled: true,
        retries: 2,
        continueOnError: false,
        concurrency: 10,
      })),
      rules: [],
      compliance: project.complianceRequirements.length > 0
        ? { frameworks: project.complianceRequirements }
        : undefined,
    };

    return this.parser.toYAML(config);
  }

  // ── Private Helpers ────────────────────────────────────────

  private resolveMigrationType(config: MigrationConfig): MigrationType {
    const src = config.source.platform.toLowerCase();
    const tgt = config.target.platform.toLowerCase();

    if (src.includes('aem') && src.includes('6') && tgt.includes('cloud')) {
      return MigrationType.AEM_ONPREM_TO_CLOUD;
    }
    if (src.includes('ams') && tgt.includes('cloud')) {
      return MigrationType.AEM_AMS_TO_CLOUD;
    }
    if (src.includes('wordpress') && tgt.includes('aem')) {
      return MigrationType.WORDPRESS_TO_AEM;
    }
    if (src.includes('sitecore') && tgt.includes('aem')) {
      return MigrationType.SITECORE_TO_AEM;
    }
    if (src.includes('ga') && tgt.includes('cja')) {
      return MigrationType.GA_TO_CJA;
    }
    if (src.includes('campaign') && tgt.includes('v8')) {
      return MigrationType.CAMPAIGN_STD_TO_V8;
    }
    if (src.includes('aam') && tgt.includes('rtcdp')) {
      return MigrationType.AAM_TO_RTCDP;
    }

    return MigrationType.CUSTOM;
  }

  private applyRules(
    project: MigrationProject,
    config: MigrationConfig,
  ): void {
    for (const rule of config.rules) {
      if (!rule.enabled) continue;

      // Store rules as project metadata for later execution
      const meta = project.sourceEnvironment.metadata as Record<string, unknown>;
      if (!meta.transformationRules) {
        meta.transformationRules = [];
      }
      (meta.transformationRules as unknown[]).push({
        name: rule.name,
        type: rule.type,
        pattern: rule.pattern,
        replacement: rule.replacement,
      });
    }
  }

  private phaseLabel(type: PhaseType): string {
    const labels: Record<PhaseType, string> = {
      [PhaseType.ASSESSMENT]: 'Assessment & Discovery',
      [PhaseType.PLANNING]: 'Migration Planning',
      [PhaseType.CODE_MODERNIZATION]: 'Code Modernization',
      [PhaseType.CONTENT_MIGRATION]: 'Content Migration',
      [PhaseType.INTEGRATION_RECONNECTION]: 'Integration Reconnection',
      [PhaseType.TESTING]: 'Testing & Validation',
      [PhaseType.CUTOVER]: 'Cutover & Go-Live',
      [PhaseType.MONITORING]: 'Post-Migration Monitoring',
    };
    return labels[type] ?? type;
  }

  private diffObject(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    prefix: string,
    entries: ConfigDiffEntry[],
  ): void {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const path = `${prefix}.${key}`;
      const valA = a[key];
      const valB = b[key];

      if (valA === undefined && valB !== undefined) {
        entries.push({ path, type: 'added', newValue: valB });
      } else if (valA !== undefined && valB === undefined) {
        entries.push({ path, type: 'removed', oldValue: valA });
      } else if (
        typeof valA !== 'object' &&
        typeof valB !== 'object' &&
        valA !== valB
      ) {
        entries.push({ path, type: 'changed', oldValue: valA, newValue: valB });
      }
    }
  }
}
