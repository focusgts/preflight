/**
 * Handoff Report Generator
 *
 * Produces a structured report summarising a completed migration
 * and its readiness for the Navigator managed-service handoff.
 */

import {
  type MigrationProject,
  type AssessmentResult,
  type AssessmentFinding,
  Severity,
} from '@/types';

// ============================================================
// Report types
// ============================================================

export interface HandoffReport {
  /** Migration metadata */
  migration: MigrationSummary;
  /** Breakdown of what was migrated */
  itemsSummary: ItemsSummary;
  /** KB articles that will be generated */
  knowledgeBase: KnowledgeBaseSummary;
  /** Environment context captured for Navi */
  environmentContext: EnvironmentContext;
  /** Recommendations for ongoing support */
  recommendations: Recommendation[];
  /** Suggested Navigator plan */
  suggestedPlan: PlanRecommendation;
  /** Estimated monthly ticket volume */
  estimatedMonthlyTickets: TicketEstimate;
  /** Generated timestamp */
  generatedAt: string;
}

export interface MigrationSummary {
  id: string;
  name: string;
  organization: string;
  migrationType: string;
  sourcePlatform: string;
  sourceVersion: string;
  targetPlatform: string;
  durationWeeks: number;
  estimatedCost: number;
  actualCost: number | null;
  overallScore: number;
  completedAt: string | null;
}

export interface ItemsSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  byCategory: Record<string, number>;
}

export interface KnowledgeBaseSummary {
  articleCount: number;
  topics: string[];
  criticalFindings: number;
  autoFixCount: number;
}

export interface EnvironmentContext {
  sourcePlatform: string;
  sourceVersion: string;
  targetPlatform: string;
  productsInScope: string[];
  integrationCount: number;
  integrations: string[];
  complianceFrameworks: string[];
  contentVolume: {
    pages: number;
    assets: number;
    sizeGB: number;
  };
  knownIssues: string[];
}

export interface Recommendation {
  category: 'support' | 'enhance' | 'advise';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedHours: number;
}

export interface PlanRecommendation {
  plan: '20hr' | '40hr' | 'custom';
  monthlyRate: number;
  rationale: string;
  hourlyBreakdown: {
    support: number;
    enhance: number;
    advise: number;
  };
}

export interface TicketEstimate {
  monthlyVolume: number;
  breakdown: {
    support: number;
    enhance: number;
    advise: number;
  };
  confidence: number;
  rationale: string;
}

// ============================================================
// Generator
// ============================================================

export function generateHandoffReport(
  migration: MigrationProject,
  assessment: AssessmentResult | null,
): HandoffReport {
  const allItems = migration.phases.flatMap((p) => p.items);
  const findings = assessment?.findings ?? [];

  return {
    migration: buildMigrationSummary(migration, assessment),
    itemsSummary: buildItemsSummary(allItems),
    knowledgeBase: buildKBSummary(findings),
    environmentContext: buildEnvironmentContext(migration, assessment),
    recommendations: buildRecommendations(findings, assessment),
    suggestedPlan: suggestPlan(migration, assessment),
    estimatedMonthlyTickets: estimateMonthlyTickets(migration, assessment),
    generatedAt: new Date().toISOString(),
  };
}

// ── Builders ──────────────────────────────────────────────────

function buildMigrationSummary(
  migration: MigrationProject,
  assessment: AssessmentResult | null,
): MigrationSummary {
  return {
    id: migration.id,
    name: migration.name,
    organization: migration.organizationName,
    migrationType: migration.migrationType,
    sourcePlatform: migration.sourceEnvironment.platform,
    sourceVersion: migration.sourceEnvironment.version,
    targetPlatform: migration.targetEnvironment.platform,
    durationWeeks: migration.estimatedDurationWeeks,
    estimatedCost: migration.estimatedCost,
    actualCost: migration.actualCost,
    overallScore: assessment?.overallScore ?? 0,
    completedAt: migration.completedAt,
  };
}

function buildItemsSummary(
  items: { type: string; status: string }[],
): ItemsSummary {
  const byCategory: Record<string, number> = {};
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    byCategory[item.type] = (byCategory[item.type] ?? 0) + 1;
    if (item.status === 'completed') completed++;
    else if (item.status === 'failed') failed++;
    else if (item.status === 'skipped') skipped++;
  }

  return {
    total: items.length,
    completed,
    failed,
    skipped,
    byCategory,
  };
}

function buildKBSummary(findings: AssessmentFinding[]): KnowledgeBaseSummary {
  const categories = new Set<string>();
  let criticalFindings = 0;
  let autoFixCount = 0;

  for (const f of findings) {
    categories.add(f.category);
    if (f.severity === Severity.CRITICAL) criticalFindings++;
    if (f.autoFixAvailable) autoFixCount++;
  }

  // Each category becomes an article, plus individual articles for
  // critical/high auto-fix findings
  const criticalAutoFix = findings.filter(
    (f) =>
      f.autoFixAvailable &&
      (f.severity === Severity.CRITICAL || f.severity === Severity.HIGH),
  ).length;

  return {
    articleCount: categories.size + criticalAutoFix,
    topics: [...categories],
    criticalFindings,
    autoFixCount,
  };
}

function buildEnvironmentContext(
  migration: MigrationProject,
  assessment: AssessmentResult | null,
): EnvironmentContext {
  const ch = assessment?.contentHealth;
  const knownIssues: string[] = [];

  if (assessment) {
    for (const risk of assessment.riskFactors) {
      if (
        risk.severity === Severity.CRITICAL ||
        risk.severity === Severity.HIGH
      ) {
        knownIssues.push(risk.description);
      }
    }
  }

  return {
    sourcePlatform: migration.sourceEnvironment.platform,
    sourceVersion: migration.sourceEnvironment.version,
    targetPlatform: migration.targetEnvironment.platform,
    productsInScope: migration.productsInScope,
    integrationCount: assessment?.integrationMap.length ?? 0,
    integrations: assessment?.integrationMap.map((d) => d.name) ?? [],
    complianceFrameworks: migration.complianceRequirements,
    contentVolume: {
      pages: ch?.totalPages ?? 0,
      assets: ch?.totalAssets ?? 0,
      sizeGB: ch?.totalSizeGB ?? 0,
    },
    knownIssues,
  };
}

function buildRecommendations(
  findings: AssessmentFinding[],
  assessment: AssessmentResult | null,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Failed/manual-fix findings become support recommendations
  const manualFixes = findings.filter(
    (f) => f.compatibilityLevel === 'manual_fix' && !f.autoFixAvailable,
  );
  if (manualFixes.length > 0) {
    recs.push({
      category: 'support',
      priority: 'high',
      title: 'Resolve remaining manual-fix items',
      description: `${manualFixes.length} items require manual attention that was not resolved during migration.`,
      estimatedHours: manualFixes.reduce((sum, f) => sum + f.estimatedHours, 0),
    });
  }

  // Integration monitoring
  const criticalIntegrations = assessment?.integrationMap.filter(
    (d) => d.criticality === Severity.CRITICAL,
  ) ?? [];
  if (criticalIntegrations.length > 0) {
    recs.push({
      category: 'support',
      priority: 'high',
      title: 'Monitor critical integrations post-migration',
      description: `${criticalIntegrations.length} critical integrations should be monitored closely in the first 30 days.`,
      estimatedHours: criticalIntegrations.length * 2,
    });
  }

  // Performance optimisation
  if (assessment && assessment.codeCompatibilityScore < 80) {
    recs.push({
      category: 'enhance',
      priority: 'medium',
      title: 'Code optimisation for cloud-native patterns',
      description: `Code compatibility score was ${assessment.codeCompatibilityScore}/100. Additional refactoring would improve cloud performance.`,
      estimatedHours: 20,
    });
  }

  // Content cleanup
  if (assessment && assessment.contentHealth.brokenReferences > 0) {
    recs.push({
      category: 'support',
      priority: 'medium',
      title: 'Fix broken content references',
      description: `${assessment.contentHealth.brokenReferences} broken references detected. These should be resolved for content integrity.`,
      estimatedHours: Math.ceil(assessment.contentHealth.brokenReferences / 10),
    });
  }

  // Architecture review
  recs.push({
    category: 'advise',
    priority: 'medium',
    title: 'Post-migration architecture review',
    description: 'Review the migrated architecture to identify optimisation opportunities and ensure alignment with Adobe best practices.',
    estimatedHours: 8,
  });

  // Training
  recs.push({
    category: 'advise',
    priority: 'low',
    title: 'Team enablement on new platform',
    description: 'Knowledge transfer sessions for the customer team on the migrated platform capabilities and workflows.',
    estimatedHours: 4,
  });

  return recs;
}

function suggestPlan(
  migration: MigrationProject,
  assessment: AssessmentResult | null,
): PlanRecommendation {
  const score = assessment?.overallScore ?? 50;
  const integrationCount = assessment?.integrationMap.length ?? 0;
  const findingCount = assessment?.findings.length ?? 0;

  // High complexity -> 40hr, low complexity -> 20hr
  const complexitySignals = [
    score < 70 ? 1 : 0,
    integrationCount > 5 ? 1 : 0,
    findingCount > 50 ? 1 : 0,
    migration.riskScore > 0.6 ? 1 : 0,
    migration.productsInScope.length > 3 ? 1 : 0,
  ];
  const complexityScore = complexitySignals.reduce((a, b) => a + b, 0);

  if (complexityScore >= 3) {
    return {
      plan: '40hr',
      monthlyRate: 10400,
      rationale: `High-complexity environment: ${integrationCount} integrations, ${findingCount} findings, assessment score ${score}/100. Recommend 40hr plan for adequate support bandwidth.`,
      hourlyBreakdown: { support: 20, enhance: 12, advise: 8 },
    };
  }

  return {
    plan: '20hr',
    monthlyRate: 5600,
    rationale: `Standard-complexity environment: ${integrationCount} integrations, ${findingCount} findings, assessment score ${score}/100. 20hr plan provides sufficient coverage.`,
    hourlyBreakdown: { support: 10, enhance: 6, advise: 4 },
  };
}

function estimateMonthlyTickets(
  migration: MigrationProject,
  assessment: AssessmentResult | null,
): TicketEstimate {
  const score = assessment?.overallScore ?? 50;
  const integrationCount = assessment?.integrationMap.length ?? 0;

  // Base estimate: 8-15 tickets/month, adjusted by complexity
  let baseVolume = 10;
  if (score < 70) baseVolume += 3;
  if (integrationCount > 5) baseVolume += 2;
  if (migration.productsInScope.length > 3) baseVolume += 2;

  // SEA split: typically 50% support, 30% enhance, 20% advise
  const support = Math.round(baseVolume * 0.5);
  const enhance = Math.round(baseVolume * 0.3);
  const advise = baseVolume - support - enhance;

  return {
    monthlyVolume: baseVolume,
    breakdown: { support, enhance, advise },
    confidence: 0.65,
    rationale: `Based on migration complexity (score ${score}/100), ${integrationCount} integrations, and ${migration.productsInScope.length} products in scope.`,
  };
}
