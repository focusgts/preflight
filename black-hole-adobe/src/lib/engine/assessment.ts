/**
 * Black Hole - Assessment Engine
 *
 * The core migration assessment engine. Analyzes source environments across
 * code compatibility, content health, integration complexity, and compliance
 * to produce a comprehensive readiness report with timeline/cost estimates.
 */

import { v4 as uuid } from 'uuid';
import {
  AdobeProduct,
  CompatibilityLevel,
  Severity,
  PhaseType,
  SEACategory,
} from '@/types';
import type {
  AssessmentResult,
  AssessmentFinding,
  ContentHealth,
  IntegrationDependency,
  RiskFactor,
  TimelineEstimate,
  PhaseEstimate,
  CostEstimate,
  TraditionalEstimate,
  MigrationItem,
  MigrationProject,
} from '@/types';
import { SortEngine, type ClassificationResult } from './sort';

// ============================================================
// Types
// ============================================================

export interface AssessmentOptions {
  /** Average SI hourly rate for cost estimates. */
  siHourlyRate: number;
  /** Platform licensing fee. */
  platformFee: number;
  /** Traditional migration cost multiplier compared to Black Hole. */
  traditionalMultiplier: number;
  /** Currency code for cost estimates. */
  currency: string;
  /** Progress callback. */
  onProgress?: (phase: string, percent: number) => void;
}

export interface CodeAnalysisInput {
  items: MigrationItem[];
  classifications: ClassificationResult[];
}

export interface ContentAnalysisInput {
  totalPages: number;
  totalAssets: number;
  totalContentFragments: number;
  totalExperienceFragments: number;
  references: { from: string; to: string; valid: boolean }[];
  metadata: { path: string; completeness: number }[];
  totalSizeGB: number;
  publishedCount: number;
}

export interface IntegrationInput {
  id: string;
  name: string;
  type: IntegrationDependency['type'];
  authType: string;
  dataFlow: IntegrationDependency['dataFlow'];
  sourceConfig: Record<string, unknown>;
  targetProduct?: AdobeProduct;
}

// ============================================================
// BPA Pattern Definitions
// ============================================================

interface BpaPattern {
  code: string;
  title: string;
  category: string;
  subCategory: string;
  severity: Severity;
  description: string;
  remediationGuide: string;
  autoFixAvailable: boolean;
  estimatedHours: number;
  detector: (item: MigrationItem) => boolean;
}

const BPA_PATTERNS: BpaPattern[] = [
  {
    code: 'BPA-001',
    title: 'Deprecated API usage: Classic UI (ExtJS)',
    category: 'code',
    subCategory: 'deprecated-api',
    severity: Severity.CRITICAL,
    description: 'Classic UI components using ExtJS/CQ widgets are not supported in AEM as a Cloud Service.',
    remediationGuide: 'Replace Classic UI dialogs with Coral UI 3 / Granite UI. Use the Dialog Conversion Tool to automate where possible.',
    autoFixAvailable: true,
    estimatedHours: 4,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('classic-ui') || text.includes('cq:widgets') || text.includes('extjs');
    },
  },
  {
    code: 'BPA-002',
    title: 'Static Templates detected',
    category: 'code',
    subCategory: 'template-type',
    severity: Severity.HIGH,
    description: 'Static templates are deprecated. Editable templates should be used instead.',
    remediationGuide: 'Convert static templates to editable templates. Move template structure to /conf.',
    autoFixAvailable: false,
    estimatedHours: 8,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('static-template') || (text.includes('/apps/') && text.includes('/templates/'));
    },
  },
  {
    code: 'BPA-003',
    title: 'Custom replication agent',
    category: 'code',
    subCategory: 'replication',
    severity: Severity.CRITICAL,
    description: 'Custom replication agents are not supported in AEM Cloud. Use Sling Content Distribution instead.',
    remediationGuide: 'Remove custom replication agents. Migrate to Sling Content Distribution framework.',
    autoFixAvailable: false,
    estimatedHours: 16,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('replication-agent') || text.includes('replication.agent');
    },
  },
  {
    code: 'BPA-004',
    title: 'JCR API direct usage',
    category: 'code',
    subCategory: 'api-usage',
    severity: Severity.HIGH,
    description: 'Direct javax.jcr or Jackrabbit API usage should be replaced with Sling Resource API.',
    remediationGuide: 'Replace javax.jcr.* imports with Sling Resource API equivalents. Use ResourceResolver instead of Session.',
    autoFixAvailable: true,
    estimatedHours: 6,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('javax.jcr') || text.includes('jackrabbit');
    },
  },
  {
    code: 'BPA-005',
    title: 'Custom Oak index definition',
    category: 'code',
    subCategory: 'index',
    severity: Severity.MEDIUM,
    description: 'Custom Oak index definitions must follow AEM Cloud naming conventions and structure.',
    remediationGuide: 'Review index definitions for Cloud Service compatibility. Use the Index Converter tool.',
    autoFixAvailable: true,
    estimatedHours: 3,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('oak-index') || text.includes('oak:index');
    },
  },
  {
    code: 'BPA-006',
    title: 'Custom login module',
    category: 'code',
    subCategory: 'authentication',
    severity: Severity.CRITICAL,
    description: 'Custom login modules are not supported. Use IMS-based authentication.',
    remediationGuide: 'Remove custom login modules. Configure IMS integration for authentication.',
    autoFixAvailable: false,
    estimatedHours: 24,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('custom-login') || text.includes('loginmodule');
    },
  },
  {
    code: 'BPA-007',
    title: 'Mutable content in /apps',
    category: 'content',
    subCategory: 'content-structure',
    severity: Severity.HIGH,
    description: 'Content in /apps is immutable in AEM Cloud Service. Mutable content must be in /content or /conf.',
    remediationGuide: 'Move mutable content from /apps to appropriate mutable paths (/content, /conf, /var).',
    autoFixAvailable: true,
    estimatedHours: 4,
    detector: (item) => {
      const text = item.sourcePath.toLowerCase();
      return text.startsWith('/apps/') && item.type === 'content';
    },
  },
  {
    code: 'BPA-008',
    title: 'Legacy workflow usage',
    category: 'code',
    subCategory: 'workflow',
    severity: Severity.MEDIUM,
    description: 'Legacy workflow models should be migrated to use the modern workflow engine.',
    remediationGuide: 'Update workflow models to use granite:InboxItem. Review custom workflow steps.',
    autoFixAvailable: false,
    estimatedHours: 8,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('custom-workflow') || (text.includes('/workflow/') && text.includes('model'));
    },
  },
  {
    code: 'BPA-009',
    title: 'Custom servlet detected',
    category: 'code',
    subCategory: 'servlet',
    severity: Severity.MEDIUM,
    description: 'Custom servlets must follow Cloud Service restrictions. Path-bound servlets are restricted.',
    remediationGuide: 'Convert path-bound servlets to resource-type-bound servlets. Review allowed servlet filters.',
    autoFixAvailable: false,
    estimatedHours: 6,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('custom-servlet') || text.includes('slingservlet');
    },
  },
  {
    code: 'BPA-010',
    title: 'OSGi configuration requires review',
    category: 'config',
    subCategory: 'osgi',
    severity: Severity.MEDIUM,
    description: 'OSGi configurations must use run-mode-specific folders for Cloud Service.',
    remediationGuide: 'Restructure OSGi configs into config.author, config.publish, config.dev, etc. folders.',
    autoFixAvailable: true,
    estimatedHours: 2,
    detector: (item) => {
      const text = `${item.name} ${item.sourcePath}`.toLowerCase();
      return text.includes('osgi-config') || text.includes('osgi.config') || text.includes('.cfg.json');
    },
  },
];

// ============================================================
// Engine
// ============================================================

const DEFAULT_OPTIONS: AssessmentOptions = {
  siHourlyRate: 200,
  platformFee: 25000,
  traditionalMultiplier: 3.5,
  currency: 'USD',
};

export class AssessmentEngine {
  private readonly options: AssessmentOptions;
  private readonly sortEngine: SortEngine;

  constructor(
    options: Partial<AssessmentOptions> = {},
    sortEngine?: SortEngine,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sortEngine = sortEngine ?? new SortEngine();
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Run a full assessment against a migration project.
   * Orchestrates code, content, and integration analysis, then produces
   * a unified AssessmentResult.
   */
  async runAssessment(
    project: MigrationProject,
    items: MigrationItem[],
    contentInput: ContentAnalysisInput,
    integrationInputs: IntegrationInput[],
  ): Promise<AssessmentResult> {
    this.options.onProgress?.('classification', 10);

    // Step 1: Classify all items
    const classifications = await this.sortEngine.classifyBatch(items);
    const classMap = new Map(classifications.map((c) => [c.itemId, c]));

    this.options.onProgress?.('code-analysis', 30);

    // Step 2: Code analysis
    const codeFindings = this.analyzeCode({ items, classifications });
    const codeScore = this.computeCodeScore(codeFindings, items.length);

    this.options.onProgress?.('content-analysis', 50);

    // Step 3: Content health
    const contentHealth = this.analyzeContent(contentInput);
    const contentScore = this.computeContentScore(contentHealth);

    this.options.onProgress?.('integration-analysis', 70);

    // Step 4: Integration analysis
    const integrations = this.analyzeIntegrations(integrationInputs);
    const integrationScore = this.computeIntegrationScore(integrations);

    this.options.onProgress?.('risk-analysis', 80);

    // Step 5: Configuration readiness
    const configItems = items.filter((i) => i.type === 'config');
    const configScore = this.computeConfigScore(configItems, classMap);

    // Step 6: Compliance score (based on project requirements)
    const complianceScore = this.computeComplianceScore(project);

    // Step 7: Risk factors
    const riskFactors = this.identifyRiskFactors(
      codeFindings, contentHealth, integrations, items, classifications,
    );

    this.options.onProgress?.('estimation', 90);

    // Step 8: Timeline & cost
    const allFindings = codeFindings;
    const totalEffortHours = this.sumEffort(allFindings, classifications);
    const timeline = this.estimateTimeline(totalEffortHours, items.length);
    const costEstimate = this.estimateCost(totalEffortHours);
    const traditionalEstimate = this.estimateTraditional(timeline, costEstimate);

    // Step 9: Recommendations
    const recommendations = this.generateRecommendations(
      codeFindings, contentHealth, integrations, riskFactors,
    );

    // Step 10: Overall score
    const overallScore = this.computeOverallScore(
      codeScore, contentScore, integrationScore, configScore, complianceScore,
    );

    this.options.onProgress?.('complete', 100);

    return {
      id: uuid(),
      migrationProjectId: project.id,
      overallScore,
      codeCompatibilityScore: codeScore,
      contentReadinessScore: contentScore,
      integrationComplexityScore: integrationScore,
      configurationReadinessScore: configScore,
      complianceScore,
      findings: allFindings,
      contentHealth,
      integrationMap: integrations,
      riskFactors,
      estimatedTimeline: timeline,
      estimatedCost: costEstimate,
      traditionalEstimate,
      recommendations,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze code items against BPA patterns.
   */
  analyzeCode(input: CodeAnalysisInput): AssessmentFinding[] {
    const findings: AssessmentFinding[] = [];

    for (const item of input.items) {
      for (const pattern of BPA_PATTERNS) {
        if (pattern.detector(item)) {
          findings.push({
            id: uuid(),
            category: pattern.category,
            subCategory: pattern.subCategory,
            severity: pattern.severity,
            compatibilityLevel: this.severityToCompatibility(pattern.severity),
            title: pattern.title,
            description: pattern.description,
            affectedPath: item.sourcePath,
            remediationGuide: pattern.remediationGuide,
            autoFixAvailable: pattern.autoFixAvailable,
            estimatedHours: pattern.estimatedHours,
            bpaPatternCode: pattern.code,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Analyze content health metrics.
   */
  analyzeContent(input: ContentAnalysisInput): ContentHealth {
    const totalContent = input.totalPages + input.totalAssets +
      input.totalContentFragments + input.totalExperienceFragments;

    const brokenRefs = input.references.filter((r) => !r.valid).length;
    const avgCompleteness = input.metadata.length > 0
      ? input.metadata.reduce((sum, m) => sum + m.completeness, 0) / input.metadata.length
      : 0;

    // Detect structural issues: deeply nested content, orphaned pages
    let structuralIssues = 0;
    for (const ref of input.references) {
      const depth = ref.from.split('/').filter(Boolean).length;
      if (depth > 8) structuralIssues++;
    }

    const publishedPercentage = totalContent > 0
      ? Math.round((input.publishedCount / totalContent) * 100)
      : 0;

    // Duplicate detection: same filename in different paths
    const fileNames = new Map<string, number>();
    for (const meta of input.metadata) {
      const name = meta.path.split('/').pop() ?? '';
      fileNames.set(name, (fileNames.get(name) ?? 0) + 1);
    }
    const duplicates = Array.from(fileNames.values())
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count - 1, 0);

    return {
      totalPages: input.totalPages,
      totalAssets: input.totalAssets,
      totalContentFragments: input.totalContentFragments,
      totalExperienceFragments: input.totalExperienceFragments,
      duplicatesDetected: duplicates,
      brokenReferences: brokenRefs,
      metadataCompleteness: Math.round(avgCompleteness),
      structuralIssues,
      totalSizeGB: input.totalSizeGB,
      publishedPercentage,
    };
  }

  /**
   * Analyze integration dependencies.
   */
  analyzeIntegrations(inputs: IntegrationInput[]): IntegrationDependency[] {
    return inputs.map((input) => {
      const autoMigratable = this.isAutoMigratable(input);
      const criticality = this.assessIntegrationCriticality(input);

      return {
        id: input.id || uuid(),
        name: input.name,
        type: input.type,
        sourceConfig: input.sourceConfig,
        targetConfig: null,
        adobeProduct: input.targetProduct ?? null,
        authType: input.authType,
        dataFlow: input.dataFlow,
        criticality,
        autoMigratable,
        migrationNotes: this.buildIntegrationNotes(input, autoMigratable),
      };
    });
  }

  /**
   * Generate the full assessment report as a structured object.
   * This wraps runAssessment for convenience when the caller
   * already has an AssessmentResult.
   */
  generateReport(result: AssessmentResult): AssessmentReport {
    const criticalFindings = result.findings.filter(
      (f) => f.severity === Severity.CRITICAL,
    );
    const highFindings = result.findings.filter(
      (f) => f.severity === Severity.HIGH,
    );
    const autoFixable = result.findings.filter((f) => f.autoFixAvailable);

    return {
      id: result.id,
      overallScore: result.overallScore,
      readinessLevel: this.scoreToReadinessLevel(result.overallScore),
      summary: this.buildSummary(result),
      criticalCount: criticalFindings.length,
      highCount: highFindings.length,
      autoFixableCount: autoFixable.length,
      totalFindings: result.findings.length,
      estimatedWeeks: result.estimatedTimeline.totalWeeks,
      estimatedCost: result.estimatedCost.totalEstimate,
      traditionalWeeks: result.traditionalEstimate.durationWeeks,
      traditionalCost: result.traditionalEstimate.cost,
      timeSavingsPercent: result.traditionalEstimate.timeSavingsPercent,
      costSavingsPercent: result.traditionalEstimate.costSavingsPercent,
      topRisks: result.riskFactors.slice(0, 5),
      recommendations: result.recommendations,
    };
  }

  // ----------------------------------------------------------
  // Scoring
  // ----------------------------------------------------------

  private computeCodeScore(findings: AssessmentFinding[], totalItems: number): number {
    if (totalItems === 0) return 100;

    let penalty = 0;
    for (const finding of findings) {
      switch (finding.severity) {
        case Severity.CRITICAL: penalty += 15; break;
        case Severity.HIGH: penalty += 8; break;
        case Severity.MEDIUM: penalty += 4; break;
        case Severity.LOW: penalty += 1; break;
        default: break;
      }
    }

    // Scale penalty relative to total items
    const scaledPenalty = (penalty / Math.max(totalItems, 1)) * 10;
    return Math.max(0, Math.round(100 - scaledPenalty));
  }

  private computeContentScore(health: ContentHealth): number {
    let score = 100;

    // Broken references penalty
    const totalContent = health.totalPages + health.totalAssets;
    if (totalContent > 0) {
      const brokenPct = (health.brokenReferences / totalContent) * 100;
      score -= Math.min(30, brokenPct * 3);
    }

    // Metadata completeness
    score -= Math.max(0, (100 - health.metadataCompleteness) * 0.2);

    // Duplicates penalty
    if (totalContent > 0) {
      const dupPct = (health.duplicatesDetected / totalContent) * 100;
      score -= Math.min(15, dupPct * 2);
    }

    // Structural issues
    score -= Math.min(15, health.structuralIssues * 2);

    return Math.max(0, Math.round(score));
  }

  private computeIntegrationScore(integrations: IntegrationDependency[]): number {
    if (integrations.length === 0) return 100;

    let totalComplexity = 0;
    for (const integ of integrations) {
      let complexity = 0;

      // Non-auto-migratable adds complexity
      if (!integ.autoMigratable) complexity += 25;

      // Criticality weight
      switch (integ.criticality) {
        case Severity.CRITICAL: complexity += 20; break;
        case Severity.HIGH: complexity += 12; break;
        case Severity.MEDIUM: complexity += 6; break;
        default: complexity += 2; break;
      }

      // Bidirectional integrations are more complex
      if (integ.dataFlow === 'bidirectional') complexity += 8;

      // Legacy auth types are harder
      if (integ.authType === 'basic' || integ.authType === 'jwt_legacy') {
        complexity += 10;
      }

      totalComplexity += complexity;
    }

    const avgComplexity = totalComplexity / integrations.length;
    return Math.max(0, Math.round(100 - avgComplexity));
  }

  private computeConfigScore(
    configItems: MigrationItem[],
    classMap: Map<string, ClassificationResult>,
  ): number {
    if (configItems.length === 0) return 100;

    let compatible = 0;
    for (const item of configItems) {
      const cl = classMap.get(item.id);
      if (
        cl &&
        (cl.compatibilityLevel === CompatibilityLevel.COMPATIBLE ||
         cl.compatibilityLevel === CompatibilityLevel.AUTO_FIXABLE)
      ) {
        compatible++;
      }
    }

    // Floor at 25 — a 0 score is misleading; even fully-incompatible configs
    // have baseline recoverable value via migration tooling.
    const raw = Math.round((compatible / configItems.length) * 100);
    return Math.max(25, Math.min(100, Number.isFinite(raw) ? raw : 40));
  }

  private computeComplianceScore(project: MigrationProject): number {
    // If no compliance requirements, full score
    if (project.complianceRequirements.length === 0) return 100;

    // Each framework deducts points unless the target platform supports it
    // AEM Cloud supports GDPR, CCPA, SOX, Section 508 natively
    const supported = new Set(['gdpr', 'ccpa', 'sox', 'section-508']);
    let met = 0;

    for (const req of project.complianceRequirements) {
      if (supported.has(req)) met++;
    }

    return Math.round((met / project.complianceRequirements.length) * 100);
  }

  private computeOverallScore(
    code: number,
    content: number,
    integration: number,
    config: number,
    compliance: number,
  ): number {
    // Weighted average
    const weights = {
      code: 0.30,
      content: 0.25,
      integration: 0.20,
      config: 0.15,
      compliance: 0.10,
    };

    return Math.round(
      code * weights.code +
      content * weights.content +
      integration * weights.integration +
      config * weights.config +
      compliance * weights.compliance,
    );
  }

  // ----------------------------------------------------------
  // Risk Identification
  // ----------------------------------------------------------

  private identifyRiskFactors(
    findings: AssessmentFinding[],
    contentHealth: ContentHealth,
    integrations: IntegrationDependency[],
    items: MigrationItem[],
    classifications: ClassificationResult[],
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Critical findings risk
    const criticalCount = findings.filter(
      (f) => f.severity === Severity.CRITICAL,
    ).length;
    if (criticalCount > 0) {
      risks.push({
        id: uuid(),
        severity: Severity.CRITICAL,
        category: 'code',
        description: `${criticalCount} critical code compatibility issues detected that block migration`,
        probability: 0.9,
        impact: 'Migration cannot proceed without resolving critical blockers',
        mitigation: 'Address all critical BPA findings before starting migration. Use auto-fix tools where available.',
      });
    }

    // Large content volume risk
    if (contentHealth.totalSizeGB > 100) {
      risks.push({
        id: uuid(),
        severity: Severity.HIGH,
        category: 'content',
        description: `Large content volume (${contentHealth.totalSizeGB}GB) may cause extended migration windows`,
        probability: 0.7,
        impact: 'Extended downtime and potential timeout issues during content transfer',
        mitigation: 'Use incremental content transfer with Content Transfer Tool. Plan for multiple transfer rounds.',
      });
    }

    // Broken references risk
    if (contentHealth.brokenReferences > 0) {
      const severity = contentHealth.brokenReferences > 50 ? Severity.HIGH : Severity.MEDIUM;
      risks.push({
        id: uuid(),
        severity,
        category: 'content',
        description: `${contentHealth.brokenReferences} broken content references detected`,
        probability: 0.8,
        impact: 'Broken links and missing assets on the migrated site',
        mitigation: 'Run reference validation and fix broken references before migration.',
      });
    }

    // Complex integrations risk
    const criticalIntegrations = integrations.filter(
      (i) => i.criticality === Severity.CRITICAL && !i.autoMigratable,
    );
    if (criticalIntegrations.length > 0) {
      risks.push({
        id: uuid(),
        severity: Severity.HIGH,
        category: 'integration',
        description: `${criticalIntegrations.length} critical integrations require manual migration`,
        probability: 0.6,
        impact: 'Integration downtime and potential data loss during cutover',
        mitigation: 'Develop integration migration runbook. Test integrations in staging before cutover.',
      });
    }

    // High blocker ratio
    const blockerCount = classifications.filter(
      (c) => c.compatibilityLevel === CompatibilityLevel.BLOCKER,
    ).length;
    if (items.length > 0 && blockerCount / items.length > 0.1) {
      risks.push({
        id: uuid(),
        severity: Severity.HIGH,
        category: 'code',
        description: `${Math.round((blockerCount / items.length) * 100)}% of items are blockers - high refactoring effort required`,
        probability: 0.8,
        impact: 'Significant timeline extension and cost overrun',
        mitigation: 'Prioritize blocker resolution. Consider phased migration approach.',
      });
    }

    // Low metadata completeness
    if (contentHealth.metadataCompleteness < 50) {
      risks.push({
        id: uuid(),
        severity: Severity.MEDIUM,
        category: 'content',
        description: `Low metadata completeness (${contentHealth.metadataCompleteness}%) may affect search and personalization`,
        probability: 0.5,
        impact: 'Poor search results and limited personalization capabilities post-migration',
        mitigation: 'Run metadata enrichment before migration. Set up bulk metadata update scripts.',
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    risks.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4),
    );

    return risks;
  }

  // ----------------------------------------------------------
  // Timeline & Cost Estimation
  // ----------------------------------------------------------

  private sumEffort(
    findings: AssessmentFinding[],
    classifications: ClassificationResult[],
  ): number {
    const findingHours = findings.reduce((sum, f) => sum + f.estimatedHours, 0);
    const classHours = classifications.reduce((sum, c) => sum + c.effortHours, 0);
    return findingHours + classHours;
  }

  private estimateTimeline(totalHours: number, itemCount: number): TimelineEstimate {
    // Assume a team of 2-4 people working 30 productive hours/week
    const teamCapacityPerWeek = 90; // 3 people * 30 hours
    const totalWeeks = Math.max(2, Math.ceil(totalHours / teamCapacityPerWeek));

    const phases = this.buildPhaseEstimates(totalWeeks, itemCount);
    const confidence = this.estimateConfidence(totalHours, itemCount);

    return { totalWeeks, phases, confidenceLevel: confidence };
  }

  private buildPhaseEstimates(totalWeeks: number, itemCount: number): PhaseEstimate[] {
    // Phase distribution ratios
    const ratios: { phase: PhaseType; ratio: number; parallelizable: boolean }[] = [
      { phase: PhaseType.ASSESSMENT, ratio: 0.10, parallelizable: false },
      { phase: PhaseType.PLANNING, ratio: 0.10, parallelizable: false },
      { phase: PhaseType.CODE_MODERNIZATION, ratio: 0.25, parallelizable: true },
      { phase: PhaseType.CONTENT_MIGRATION, ratio: 0.20, parallelizable: true },
      { phase: PhaseType.INTEGRATION_RECONNECTION, ratio: 0.15, parallelizable: true },
      { phase: PhaseType.TESTING, ratio: 0.10, parallelizable: false },
      { phase: PhaseType.CUTOVER, ratio: 0.05, parallelizable: false },
      { phase: PhaseType.MONITORING, ratio: 0.05, parallelizable: false },
    ];

    let currentWeek = 0;
    return ratios.map(({ phase, ratio, parallelizable }) => {
      const duration = Math.max(1, Math.round(totalWeeks * ratio));
      const start = currentWeek;
      const end = currentWeek + duration;

      // Only advance currentWeek for non-parallelizable phases or
      // after the parallel block
      if (!parallelizable) {
        currentWeek = end;
      } else {
        // Parallel phases share time with previous parallel phase
        currentWeek = Math.max(currentWeek, end);
      }

      return {
        phase,
        durationWeeks: duration,
        startWeek: start,
        endWeek: end,
        parallelizable,
      };
    });
  }

  private estimateConfidence(totalHours: number, itemCount: number): number {
    // Higher item counts and simpler projects give more confidence
    let confidence = 0.7;
    if (itemCount > 100) confidence += 0.1;
    if (itemCount > 500) confidence += 0.05;
    if (totalHours < 200) confidence += 0.1;
    if (totalHours > 2000) confidence -= 0.15;
    return Math.min(0.95, Math.max(0.3, Math.round(confidence * 100) / 100));
  }

  private estimateCost(totalHours: number): CostEstimate {
    const siCost = totalHours * this.options.siHourlyRate;
    return {
      platformFee: this.options.platformFee,
      estimatedSIHours: Math.round(totalHours),
      estimatedSICost: Math.round(siCost),
      totalEstimate: Math.round(this.options.platformFee + siCost),
      currency: this.options.currency,
    };
  }

  private estimateTraditional(
    timeline: TimelineEstimate,
    cost: CostEstimate,
  ): TraditionalEstimate {
    const tradWeeks = Math.round(timeline.totalWeeks * this.options.traditionalMultiplier);
    const tradCost = Math.round(cost.estimatedSICost * this.options.traditionalMultiplier);

    const timeSavings = Math.round(
      ((tradWeeks - timeline.totalWeeks) / tradWeeks) * 100,
    );
    const costSavings = Math.round(
      ((tradCost - cost.totalEstimate) / tradCost) * 100,
    );

    return {
      durationWeeks: tradWeeks,
      cost: tradCost,
      timeSavingsPercent: Math.max(0, timeSavings),
      costSavingsPercent: Math.max(0, costSavings),
    };
  }

  // ----------------------------------------------------------
  // Recommendations
  // ----------------------------------------------------------

  private generateRecommendations(
    findings: AssessmentFinding[],
    contentHealth: ContentHealth,
    integrations: IntegrationDependency[],
    risks: RiskFactor[],
  ): string[] {
    const recs: string[] = [];

    // Critical findings
    const criticalFindings = findings.filter((f) => f.severity === Severity.CRITICAL);
    if (criticalFindings.length > 0) {
      recs.push(
        `Resolve ${criticalFindings.length} critical code compatibility issues before proceeding with migration.`,
      );
    }

    // Auto-fixable items
    const autoFixCount = findings.filter((f) => f.autoFixAvailable).length;
    if (autoFixCount > 0) {
      recs.push(
        `Run automated remediation tools on ${autoFixCount} auto-fixable findings to reduce manual effort.`,
      );
    }

    // Content health
    if (contentHealth.brokenReferences > 10) {
      recs.push(
        `Fix ${contentHealth.brokenReferences} broken content references to ensure content integrity post-migration.`,
      );
    }
    if (contentHealth.metadataCompleteness < 70) {
      recs.push(
        `Improve metadata completeness (currently ${contentHealth.metadataCompleteness}%) to preserve SEO and search functionality.`,
      );
    }
    if (contentHealth.duplicatesDetected > 0) {
      recs.push(
        `Review and consolidate ${contentHealth.duplicatesDetected} duplicate content items before migration.`,
      );
    }

    // Integrations
    const manualIntegrations = integrations.filter((i) => !i.autoMigratable);
    if (manualIntegrations.length > 0) {
      recs.push(
        `Plan manual migration for ${manualIntegrations.length} integrations that cannot be auto-migrated.`,
      );
    }

    // Large content
    if (contentHealth.totalSizeGB > 50) {
      recs.push(
        `Consider using incremental content transfer for the ${contentHealth.totalSizeGB}GB content volume.`,
      );
    }

    // High risk count
    const highRisks = risks.filter(
      (r) => r.severity === Severity.CRITICAL || r.severity === Severity.HIGH,
    );
    if (highRisks.length > 3) {
      recs.push(
        `Conduct a risk mitigation workshop - ${highRisks.length} high/critical risks identified.`,
      );
    }

    return recs;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private severityToCompatibility(severity: Severity): CompatibilityLevel {
    switch (severity) {
      case Severity.CRITICAL: return CompatibilityLevel.BLOCKER;
      case Severity.HIGH: return CompatibilityLevel.MANUAL_FIX;
      case Severity.MEDIUM: return CompatibilityLevel.AUTO_FIXABLE;
      default: return CompatibilityLevel.COMPATIBLE;
    }
  }

  private isAutoMigratable(input: IntegrationInput): boolean {
    // OAuth/API-key based REST APIs can usually be auto-migrated
    const autoTypes = new Set(['api', 'webhook', 'feed']);
    const autoAuth = new Set(['oauth', 'oauth_s2s', 'api_key']);
    return autoTypes.has(input.type) && autoAuth.has(input.authType);
  }

  private assessIntegrationCriticality(input: IntegrationInput): Severity {
    // Bidirectional sync integrations are critical
    if (input.dataFlow === 'bidirectional') return Severity.CRITICAL;
    if (input.type === 'sync') return Severity.HIGH;
    if (input.type === 'sdk') return Severity.HIGH;
    if (input.type === 'event') return Severity.MEDIUM;
    return Severity.LOW;
  }

  private buildIntegrationNotes(
    input: IntegrationInput,
    autoMigratable: boolean,
  ): string {
    if (autoMigratable) {
      return `Integration "${input.name}" can be auto-migrated. Update endpoint URLs and credentials post-migration.`;
    }
    return `Integration "${input.name}" requires manual migration. Review ${input.type} configuration and ${input.authType} authentication setup.`;
  }

  private scoreToReadinessLevel(score: number): string {
    if (score >= 80) return 'Ready';
    if (score >= 60) return 'Ready with minor remediation';
    if (score >= 40) return 'Significant work required';
    return 'Major refactoring needed';
  }

  private buildSummary(result: AssessmentResult): string {
    const level = this.scoreToReadinessLevel(result.overallScore);
    return (
      `Migration readiness score: ${result.overallScore}/100 (${level}). ` +
      `Code compatibility: ${result.codeCompatibilityScore}, ` +
      `Content readiness: ${result.contentReadinessScore}, ` +
      `Integration complexity: ${result.integrationComplexityScore}. ` +
      `Estimated ${result.estimatedTimeline.totalWeeks} weeks with Black Hole ` +
      `vs ${result.traditionalEstimate.durationWeeks} weeks traditional ` +
      `(${result.traditionalEstimate.timeSavingsPercent}% faster).`
    );
  }
}

// ============================================================
// Report Type
// ============================================================

export interface AssessmentReport {
  id: string;
  overallScore: number;
  readinessLevel: string;
  summary: string;
  criticalCount: number;
  highCount: number;
  autoFixableCount: number;
  totalFindings: number;
  estimatedWeeks: number;
  estimatedCost: number;
  traditionalWeeks: number;
  traditionalCost: number;
  timeSavingsPercent: number;
  costSavingsPercent: number;
  topRisks: RiskFactor[];
  recommendations: string[];
}

// ============================================================
// Error Class
// ============================================================

export class AssessmentEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessmentEngineError';
  }
}
