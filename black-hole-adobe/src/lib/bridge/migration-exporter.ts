/**
 * Migration Exporter
 *
 * Transforms Black Hole migration data into Navigator Portal format.
 * Handles the full export pipeline: tickets, KB articles, ROI data,
 * Navi memories, and RuVector indexing.
 */

import {
  type MigrationProject,
  type MigrationItem,
  type AssessmentFinding,
  type AssessmentResult,
  MigrationType,
  SEACategory,
  Severity,
  CompatibilityLevel,
} from '@/types';
import {
  NavigatorClient,
  type NavigatorTicket,
  type NavigatorKnowledgeArticle,
  type NavigatorROIEntry,
  type NavigatorMemory,
} from './navigator-client';

// ============================================================
// Export result types
// ============================================================

export interface ExportResult {
  organizationId: string;
  tickets: { exported: number; failed: number };
  knowledgeArticles: { exported: number; failed: number };
  roiEntries: { exported: number; failed: number };
  memories: { exported: number; failed: number };
  ruVectorEntries: { exported: number; failed: number };
  timeEntries: { exported: number; failed: number };
  mode: 'live' | 'demo';
  durationMs: number;
}

export interface ExportProgress {
  step: string;
  current: number;
  total: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ============================================================
// Mapping helpers
// ============================================================

const migrationTypeToSEA: Record<string, SEACategory> = {
  code_modernization: SEACategory.ENHANCE,
  content_migration: SEACategory.SUPPORT,
  integration_reconnection: SEACategory.ENHANCE,
  assessment: SEACategory.ADVISE,
  planning: SEACategory.ADVISE,
  testing: SEACategory.SUPPORT,
  cutover: SEACategory.SUPPORT,
  monitoring: SEACategory.SUPPORT,
};

const severityToPriority: Record<string, NavigatorTicket['priority']> = {
  [Severity.CRITICAL]: 'critical',
  [Severity.HIGH]: 'high',
  [Severity.MEDIUM]: 'medium',
  [Severity.LOW]: 'low',
  [Severity.INFO]: 'low',
};

function migrationTypeToPlatformTags(type: MigrationType): string[] {
  const tagMap: Record<string, string[]> = {
    [MigrationType.AEM_ONPREM_TO_CLOUD]: ['AEM', 'AEM Cloud Service'],
    [MigrationType.AEM_AMS_TO_CLOUD]: ['AEM', 'AEM Cloud Service'],
    [MigrationType.AEM_VERSION_UPGRADE]: ['AEM'],
    [MigrationType.AEM_TO_EDS]: ['AEM', 'Edge Delivery Services'],
    [MigrationType.WORDPRESS_TO_AEM]: ['AEM', 'WordPress'],
    [MigrationType.SITECORE_TO_AEM]: ['AEM', 'Sitecore'],
    [MigrationType.DRUPAL_TO_AEM]: ['AEM', 'Drupal'],
    [MigrationType.GA_TO_ADOBE_ANALYTICS]: ['Analytics', 'Google Analytics'],
    [MigrationType.GA_TO_CJA]: ['CJA', 'Google Analytics'],
    [MigrationType.ANALYTICS_TO_CJA]: ['Analytics', 'CJA'],
    [MigrationType.CAMPAIGN_STD_TO_V8]: ['Campaign'],
    [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: ['Campaign'],
    [MigrationType.SFMC_TO_ADOBE]: ['Campaign', 'SFMC'],
    [MigrationType.AAM_TO_RTCDP]: ['AAM', 'RTCDP'],
    [MigrationType.COMPETITOR_CDP_TO_AEP]: ['AEP'],
    [MigrationType.SHOPIFY_TO_COMMERCE]: ['Commerce', 'Shopify'],
    [MigrationType.SFCC_TO_COMMERCE]: ['Commerce', 'SFCC'],
    [MigrationType.DAM_TO_AEM_ASSETS]: ['AEM Assets'],
    [MigrationType.JIRA_TO_WORKFRONT]: ['Workfront', 'Jira'],
    [MigrationType.OPTIMIZELY_TO_TARGET]: ['Target', 'Optimizely'],
    [MigrationType.HUBSPOT_TO_MARKETO]: ['Marketo', 'HubSpot'],
  };
  return tagMap[type] ?? ['Adobe'];
}

// ============================================================
// MigrationExporter
// ============================================================

export class MigrationExporter {
  private readonly client: NavigatorClient;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(client: NavigatorClient) {
    this.client = client;
  }

  /** Register a callback to receive progress updates. */
  setProgressCallback(cb: (progress: ExportProgress) => void): void {
    this.onProgress = cb;
  }

  private emit(step: string, current: number, total: number, status: ExportProgress['status']): void {
    this.onProgress?.({ step, current, total, status });
  }

  // ── Full export ─────────────────────────────────────────────

  async exportMigration(migration: MigrationProject): Promise<ExportResult> {
    const start = Date.now();
    const health = await this.client.healthCheck();

    // 1. Create organization
    this.emit('organization', 0, 1, 'in_progress');
    const orgRes = await this.client.createOrganization(
      migration.organizationName,
      null,
      {
        blackHoleMigrationId: migration.id,
        migrationType: migration.migrationType,
        source: migration.sourceEnvironment.platform,
        target: migration.targetEnvironment.platform,
      },
    );
    const orgId = orgRes.data?.id ?? 'unknown';
    this.emit('organization', 1, 1, 'completed');

    // 2. Export tickets
    const allItems = migration.phases.flatMap((p) => p.items);
    const ticketResult = await this.exportToTickets(orgId, allItems, migration.migrationType);

    // 3. Export KB articles
    const assessment = migration.assessment;
    const kbResult = assessment
      ? await this.exportToKnowledgeBase(orgId, assessment.findings, migration.migrationType)
      : { exported: 0, failed: 0 };

    // 4. Export ROI data
    const roiResult = assessment
      ? await this.exportToROI(orgId, assessment, migration.actualCost)
      : { exported: 0, failed: 0 };

    // 5. Export Navi memories
    const memoriesResult = assessment
      ? await this.exportToMemories(orgId, assessment, migration)
      : { exported: 0, failed: 0 };

    // 6. Export to RuVector
    const rvResult = assessment
      ? await this.exportToRuVector(orgId, assessment, migration)
      : { exported: 0, failed: 0 };

    // 7. Export time data
    const timeResult = await this.exportTimeData(orgId, migration);

    return {
      organizationId: orgId,
      tickets: ticketResult,
      knowledgeArticles: kbResult,
      roiEntries: roiResult,
      memories: memoriesResult,
      ruVectorEntries: rvResult,
      timeEntries: timeResult,
      mode: health.mode,
      durationMs: Date.now() - start,
    };
  }

  // ── Tickets ─────────────────────────────────────────────────

  async exportToTickets(
    orgId: string,
    items: MigrationItem[],
    migrationType: MigrationType,
  ): Promise<{ exported: number; failed: number }> {
    const total = items.length;
    this.emit('tickets', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    const platformTags = migrationTypeToPlatformTags(migrationType);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const seaCategory = migrationTypeToSEA[item.type] ?? SEACategory.SUPPORT;

      const ticket: NavigatorTicket = {
        title: `[Migration] ${item.name}`,
        description: buildTicketDescription(item),
        sea_category: seaCategory,
        priority: item.compatibilityLevel === CompatibilityLevel.BLOCKER ? 'critical'
          : item.compatibilityLevel === CompatibilityLevel.MANUAL_FIX ? 'high'
          : 'medium',
        status: item.status === 'completed' ? 'complete' : 'new',
        platform_tags: platformTags,
        capex_opex: 'capex',
        complexity_hours: item.validationResult ? 1 : 2,
        source: 'black_hole_migration',
        source_id: item.id,
      };

      try {
        await this.client.createTicket(orgId, ticket);
        exported++;
      } catch {
        failed++;
      }
      this.emit('tickets', i + 1, total, i + 1 === total ? 'completed' : 'in_progress');
    }

    return { exported, failed };
  }

  // ── Knowledge Base ──────────────────────────────────────────

  async exportToKnowledgeBase(
    orgId: string,
    findings: AssessmentFinding[],
    migrationType: MigrationType,
  ): Promise<{ exported: number; failed: number }> {
    const articles = buildKBArticles(findings, migrationType);
    const total = articles.length;
    this.emit('knowledge', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    for (let i = 0; i < articles.length; i++) {
      try {
        await this.client.createKnowledgeArticle(orgId, articles[i]);
        exported++;
      } catch {
        failed++;
      }
      this.emit('knowledge', i + 1, total, i + 1 === total ? 'completed' : 'in_progress');
    }

    return { exported, failed };
  }

  // ── ROI ─────────────────────────────────────────────────────

  async exportToROI(
    orgId: string,
    assessment: AssessmentResult,
    actualCost: number | null,
  ): Promise<{ exported: number; failed: number }> {
    const entries = buildROIEntries(assessment, actualCost);
    const total = entries.length;
    this.emit('roi', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.client.createROIEntry(orgId, entry);
        exported++;
      } catch {
        failed++;
      }
    }
    this.emit('roi', exported + failed, total, 'completed');

    return { exported, failed };
  }

  // ── Memories ────────────────────────────────────────────────

  async exportToMemories(
    orgId: string,
    assessment: AssessmentResult,
    migration: MigrationProject,
  ): Promise<{ exported: number; failed: number }> {
    const memories = buildMemories(assessment, migration);
    const total = memories.length;
    this.emit('memories', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    for (const memory of memories) {
      try {
        await this.client.storeMemory(orgId, memory);
        exported++;
      } catch {
        failed++;
      }
    }
    this.emit('memories', exported + failed, total, 'completed');

    return { exported, failed };
  }

  // ── RuVector ────────────────────────────────────────────────

  async exportToRuVector(
    orgId: string,
    assessment: AssessmentResult,
    migration: MigrationProject,
  ): Promise<{ exported: number; failed: number }> {
    const entries = buildRuVectorEntries(assessment, migration);
    const total = entries.length;
    this.emit('ruvector', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.client.indexInRuVector(
          entry.namespace,
          entry.key,
          entry.value,
          entry.tags,
          { orgId, ...entry.metadata },
        );
        exported++;
      } catch {
        failed++;
      }
    }
    this.emit('ruvector', exported + failed, total, 'completed');

    return { exported, failed };
  }

  // ── Time data ───────────────────────────────────────────────

  private async exportTimeData(
    orgId: string,
    migration: MigrationProject,
  ): Promise<{ exported: number; failed: number }> {
    const phases = migration.phases.filter((p) => p.actualDuration !== null);
    const total = phases.length;
    this.emit('time', 0, total, 'in_progress');
    let exported = 0;
    let failed = 0;

    for (const phase of phases) {
      const sea = migrationTypeToSEA[phase.type] ?? SEACategory.SUPPORT;
      try {
        await this.client.createTimeEntry(orgId, {
          description: `Migration phase: ${phase.name}`,
          hours: phase.actualDuration ?? phase.estimatedDuration,
          billable: true,
          sea_category: sea,
          source: 'black_hole_migration',
          logged_at: phase.completedAt ?? new Date().toISOString(),
        });
        exported++;
      } catch {
        failed++;
      }
    }
    this.emit('time', exported + failed, total, 'completed');

    return { exported, failed };
  }

  // ── Handoff summary ─────────────────────────────────────────

  generateHandoffSummary(migration: MigrationProject): string {
    const items = migration.phases.flatMap((p) => p.items);
    const completed = items.filter((i) => i.status === 'completed').length;
    const failed = items.filter((i) => i.status === 'failed').length;

    const lines = [
      `Migration: ${migration.name}`,
      `Organization: ${migration.organizationName}`,
      `Type: ${migration.migrationType}`,
      `Source: ${migration.sourceEnvironment.platform} ${migration.sourceEnvironment.version}`,
      `Target: ${migration.targetEnvironment.platform}`,
      `Duration: ${migration.estimatedDurationWeeks} weeks estimated`,
      `Items: ${completed} completed, ${failed} failed, ${items.length} total`,
      `Progress: ${migration.progress}%`,
      `Cost: $${(migration.actualCost ?? migration.estimatedCost).toLocaleString()}`,
    ];

    if (migration.assessment) {
      lines.push(`Assessment Score: ${migration.assessment.overallScore}/100`);
      lines.push(`Findings: ${migration.assessment.findings.length}`);
    }

    return lines.join('\n');
  }
}

// ============================================================
// Builder functions
// ============================================================

function buildTicketDescription(item: MigrationItem): string {
  const parts = [
    `**Source**: ${item.sourcePath}`,
    item.targetPath ? `**Target**: ${item.targetPath}` : null,
    `**Compatibility**: ${item.compatibilityLevel}`,
    `**Auto-fixed**: ${item.autoFixed ? 'Yes' : 'No'}`,
    `**Status**: ${item.status}`,
  ].filter(Boolean);

  if (item.error) {
    parts.push(`\n**Error**: ${item.error}`);
  }
  if (item.validationResult) {
    const checks = item.validationResult.checks
      .map((c) => `- [${c.passed ? 'x' : ' '}] ${c.name}: ${c.message}`)
      .join('\n');
    parts.push(`\n**Validation** (score ${item.validationResult.score}):\n${checks}`);
  }

  return parts.join('\n');
}

function buildKBArticles(
  findings: AssessmentFinding[],
  migrationType: MigrationType,
): NavigatorKnowledgeArticle[] {
  const platformTags = migrationTypeToPlatformTags(migrationType);
  const articles: NavigatorKnowledgeArticle[] = [];

  // Group findings by category for consolidated articles
  const byCategory = new Map<string, AssessmentFinding[]>();
  for (const f of findings) {
    const group = byCategory.get(f.category) ?? [];
    group.push(f);
    byCategory.set(f.category, group);
  }

  for (const [category, categoryFindings] of byCategory) {
    const content = categoryFindings
      .map((f) => [
        `## ${f.title}`,
        '',
        `**Severity**: ${f.severity} | **Compatibility**: ${f.compatibilityLevel}`,
        `**Affected**: ${f.affectedPath}`,
        '',
        f.description,
        '',
        '### Remediation',
        f.remediationGuide,
        f.autoFixAvailable ? '\n> Auto-fix was available and applied during migration.' : '',
        '',
        '---',
      ].join('\n'))
      .join('\n');

    articles.push({
      title: `[Migration KB] ${category} - ${categoryFindings.length} findings`,
      content,
      source: 'black_hole_migration',
      platform_tags: platformTags,
      visibility: 'internal',
      metadata: {
        findingCount: categoryFindings.length,
        severities: [...new Set(categoryFindings.map((f) => f.severity))],
        category,
      },
    });
  }

  // Individual articles for critical/high findings with auto-fix
  for (const f of findings) {
    if (
      f.autoFixAvailable &&
      (f.severity === Severity.CRITICAL || f.severity === Severity.HIGH)
    ) {
      articles.push({
        title: `[Auto-Fix] ${f.title}`,
        content: [
          `## Problem`,
          f.description,
          '',
          `## Solution`,
          f.remediationGuide,
          '',
          `**Category**: ${f.category} > ${f.subCategory}`,
          `**Affected path**: ${f.affectedPath}`,
          f.bpaPatternCode ? `**BPA Pattern**: ${f.bpaPatternCode}` : '',
        ].filter(Boolean).join('\n'),
        source: 'black_hole_migration',
        platform_tags: platformTags,
        visibility: 'client',
        metadata: {
          findingId: f.id,
          severity: f.severity,
          autoFix: true,
          bpaPattern: f.bpaPatternCode,
        },
      });
    }
  }

  return articles;
}

function buildROIEntries(
  assessment: AssessmentResult,
  actualCost: number | null,
): NavigatorROIEntry[] {
  const entries: NavigatorROIEntry[] = [];
  const traditional = assessment.traditionalEstimate;
  const estimated = assessment.estimatedCost;

  // Time savings ROI
  entries.push({
    category: 'migration_time_savings',
    estimated_value:
      traditional.cost - (actualCost ?? estimated.totalEstimate),
    confidence_score: 0.85,
    calculation_inputs: {
      traditional_weeks: traditional.durationWeeks,
      actual_weeks: assessment.estimatedTimeline.totalWeeks,
      traditional_cost: traditional.cost,
      actual_cost: actualCost ?? estimated.totalEstimate,
    },
    description: `Migration completed ${traditional.timeSavingsPercent}% faster than traditional approach, saving $${Math.round(traditional.cost - (actualCost ?? estimated.totalEstimate)).toLocaleString()}.`,
  });

  // Platform cost savings
  entries.push({
    category: 'migration_cost_savings',
    estimated_value:
      traditional.cost * (traditional.costSavingsPercent / 100),
    confidence_score: 0.9,
    calculation_inputs: {
      traditional_cost: traditional.cost,
      savings_percent: traditional.costSavingsPercent,
      platform_fee: estimated.platformFee,
      si_cost: estimated.estimatedSICost,
    },
    description: `Cost savings of ${traditional.costSavingsPercent}% compared to traditional migration approach.`,
  });

  // Risk mitigation value
  const criticalFindings = assessment.findings.filter(
    (f) => f.severity === Severity.CRITICAL,
  ).length;
  if (criticalFindings > 0) {
    entries.push({
      category: 'risk_mitigation',
      estimated_value: criticalFindings * 15000,
      confidence_score: 0.7,
      calculation_inputs: {
        critical_findings: criticalFindings,
        estimated_incident_cost: 15000,
      },
      description: `Identified and resolved ${criticalFindings} critical issues that could have caused production incidents.`,
    });
  }

  return entries;
}

function buildMemories(
  assessment: AssessmentResult,
  migration: MigrationProject,
): NavigatorMemory[] {
  const memories: NavigatorMemory[] = [];

  // Source environment
  memories.push({
    category: 'environment',
    key: 'source_platform',
    value: `${migration.sourceEnvironment.platform} ${migration.sourceEnvironment.version}`,
    confidence: 1.0,
    source: 'black_hole_migration',
  });

  // Target environment
  memories.push({
    category: 'environment',
    key: 'target_platform',
    value: migration.targetEnvironment.platform,
    confidence: 1.0,
    source: 'black_hole_migration',
  });

  // Assessment scores
  memories.push({
    category: 'assessment',
    key: 'code_compatibility_score',
    value: `${assessment.codeCompatibilityScore}/100`,
    confidence: 0.95,
    source: 'black_hole_migration',
  });

  memories.push({
    category: 'assessment',
    key: 'content_readiness_score',
    value: `${assessment.contentReadinessScore}/100`,
    confidence: 0.95,
    source: 'black_hole_migration',
  });

  // Content health
  const ch = assessment.contentHealth;
  memories.push({
    category: 'content',
    key: 'content_volume',
    value: `${ch.totalPages} pages, ${ch.totalAssets} assets, ${ch.totalContentFragments} content fragments, ${ch.totalSizeGB}GB`,
    confidence: 1.0,
    source: 'black_hole_migration',
  });

  // Integration dependencies
  for (const dep of assessment.integrationMap) {
    memories.push({
      category: 'integration',
      key: `integration_${dep.name.toLowerCase().replace(/\s+/g, '_')}`,
      value: `${dep.name}: ${dep.type} (${dep.dataFlow}), auth=${dep.authType}, criticality=${dep.criticality}`,
      confidence: 0.9,
      source: 'black_hole_migration',
    });
  }

  // Risk factors
  for (const risk of assessment.riskFactors.filter((r) => r.severity === Severity.CRITICAL || r.severity === Severity.HIGH)) {
    memories.push({
      category: 'risk',
      key: `risk_${risk.id}`,
      value: `${risk.description} (mitigation: ${risk.mitigation})`,
      confidence: risk.probability,
      source: 'black_hole_migration',
    });
  }

  // Compliance requirements
  if (migration.complianceRequirements.length > 0) {
    memories.push({
      category: 'compliance',
      key: 'compliance_requirements',
      value: migration.complianceRequirements.join(', '),
      confidence: 1.0,
      source: 'black_hole_migration',
    });
  }

  // Products in scope
  memories.push({
    category: 'products',
    key: 'adobe_products_in_scope',
    value: migration.productsInScope.join(', '),
    confidence: 1.0,
    source: 'black_hole_migration',
  });

  return memories;
}

function buildRuVectorEntries(
  assessment: AssessmentResult,
  migration: MigrationProject,
): { namespace: string; key: string; value: string; tags: string[]; metadata?: Record<string, unknown> }[] {
  const entries: { namespace: string; key: string; value: string; tags: string[]; metadata?: Record<string, unknown> }[] = [];
  const platformTags = migrationTypeToPlatformTags(migration.migrationType);

  // Migration patterns
  entries.push({
    namespace: 'migration_patterns',
    key: `migration_${migration.id}`,
    value: `${migration.migrationType}: ${migration.sourceEnvironment.platform} ${migration.sourceEnvironment.version} -> ${migration.targetEnvironment.platform}. Score: ${assessment.overallScore}/100. Duration: ${assessment.estimatedTimeline.totalWeeks} weeks.`,
    tags: [...platformTags, migration.migrationType],
    metadata: {
      overallScore: assessment.overallScore,
      durationWeeks: assessment.estimatedTimeline.totalWeeks,
    },
  });

  // Assessment profile
  entries.push({
    namespace: 'assessment_profiles',
    key: `profile_${migration.id}`,
    value: `Code: ${assessment.codeCompatibilityScore}, Content: ${assessment.contentReadinessScore}, Integration: ${assessment.integrationComplexityScore}, Config: ${assessment.configurationReadinessScore}, Compliance: ${assessment.complianceScore}`,
    tags: [...platformTags, 'assessment'],
    metadata: {
      scores: {
        code: assessment.codeCompatibilityScore,
        content: assessment.contentReadinessScore,
        integration: assessment.integrationComplexityScore,
        configuration: assessment.configurationReadinessScore,
        compliance: assessment.complianceScore,
      },
    },
  });

  // Fix library entries
  for (const finding of assessment.findings.filter((f) => f.autoFixAvailable)) {
    entries.push({
      namespace: 'fix_library',
      key: `fix_${finding.id}`,
      value: `${finding.title}: ${finding.description}. Fix: ${finding.remediationGuide}`,
      tags: [...platformTags, finding.category, finding.severity],
      metadata: {
        bpaPattern: finding.bpaPatternCode,
        severity: finding.severity,
        category: finding.category,
      },
    });
  }

  // Risk outcomes
  for (const risk of assessment.riskFactors) {
    entries.push({
      namespace: 'risk_outcomes',
      key: `risk_${migration.id}_${risk.id}`,
      value: `${risk.description}. Impact: ${risk.impact}. Mitigation: ${risk.mitigation}. Probability: ${risk.probability}`,
      tags: [...platformTags, risk.category, risk.severity],
    });
  }

  // Integration templates
  for (const dep of assessment.integrationMap) {
    entries.push({
      namespace: 'integration_templates',
      key: `integration_${migration.id}_${dep.id}`,
      value: `${dep.name}: ${dep.type} (${dep.dataFlow}), auth=${dep.authType}. Auto-migratable: ${dep.autoMigratable}. Notes: ${dep.migrationNotes}`,
      tags: [...platformTags, dep.type, dep.name],
      metadata: { sourceConfig: dep.sourceConfig, targetConfig: dep.targetConfig },
    });
  }

  return entries;
}
