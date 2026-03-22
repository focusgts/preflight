/**
 * Report Data Preparation
 *
 * Transforms raw AssessmentResult and MigrationProject data into
 * a structured format optimized for PDF report rendering.
 */

import type {
  AssessmentResult,
  AssessmentFinding,
  MigrationProject,
  PhaseEstimate,
  RiskFactor,
} from '@/types';
import { Severity, PhaseType } from '@/types';

// ============================================================
// Types
// ============================================================

export interface ReportData {
  meta: ReportMeta;
  executive: ExecutiveSummary;
  scores: CategoryScores;
  findings: FindingsSummary;
  risks: RiskSummary;
  timeline: TimelineComparison;
  cost: CostComparison;
  recommendations: string[];
}

export interface ReportMeta {
  reportId: string;
  organizationName: string;
  migrationName: string;
  migrationType: string;
  generatedAt: string;
  generatedDate: string;
  confidentialityNotice: string;
}

export interface ExecutiveSummary {
  overallScore: number;
  readinessLevel: string;
  readinessDescription: string;
  totalFindings: number;
  criticalFindings: number;
  autoFixableFindings: number;
  estimatedSavings: string;
  estimatedSavingsPercent: number;
  estimatedTimeSavings: string;
  estimatedTimeSavingsPercent: number;
}

export interface CategoryScores {
  codeCompatibility: number;
  contentReadiness: number;
  integrationComplexity: number;
  configurationReadiness: number;
  compliance: number;
}

export interface FindingsSummary {
  total: number;
  bySeverity: Record<string, FindingSeverityGroup>;
  byCategory: Record<string, number>;
  topFindings: AssessmentFinding[];
  autoFixableCount: number;
  totalEstimatedHours: number;
}

export interface FindingSeverityGroup {
  count: number;
  label: string;
  color: string;
  findings: AssessmentFinding[];
}

export interface RiskSummary {
  totalRisks: number;
  highestSeverity: string;
  risks: RiskFactor[];
}

export interface TimelineComparison {
  traditionalWeeks: number;
  blackHoleWeeks: number;
  savingsWeeks: number;
  savingsPercent: number;
  phases: PhaseComparison[];
}

export interface PhaseComparison {
  name: string;
  traditionalWeeks: number;
  blackHoleWeeks: number;
}

export interface CostComparison {
  traditionalCost: number;
  traditionalCostFormatted: string;
  blackHoleCost: number;
  blackHoleCostFormatted: string;
  savingsAmount: number;
  savingsFormatted: string;
  savingsPercent: number;
  platformFee: number;
  platformFeeFormatted: string;
  siCost: number;
  siCostFormatted: string;
  currency: string;
}

// ============================================================
// Formatting Helpers
// ============================================================

export function formatCurrency(
  amount: number,
  currency = 'USD',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const PHASE_LABELS: Record<string, string> = {
  [PhaseType.ASSESSMENT]: 'Assessment',
  [PhaseType.PLANNING]: 'Planning',
  [PhaseType.CODE_MODERNIZATION]: 'Code Modernization',
  [PhaseType.CONTENT_MIGRATION]: 'Content Migration',
  [PhaseType.INTEGRATION_RECONNECTION]: 'Integration Reconnection',
  [PhaseType.TESTING]: 'Testing & Validation',
  [PhaseType.CUTOVER]: 'Cutover',
  [PhaseType.MONITORING]: 'Post-Go-Live Monitoring',
};

const MIGRATION_TYPE_LABELS: Record<string, string> = {
  aem_onprem_to_cloud: 'AEM On-Premise to Cloud Service',
  aem_ams_to_cloud: 'AEM Managed Services to Cloud Service',
  aem_version_upgrade: 'AEM Version Upgrade',
  aem_to_eds: 'AEM to Edge Delivery Services',
  wordpress_to_aem: 'WordPress to AEM',
  sitecore_to_aem: 'Sitecore to AEM',
  drupal_to_aem: 'Drupal to AEM',
  ga_to_adobe_analytics: 'Google Analytics to Adobe Analytics',
  ga_to_cja: 'Google Analytics to Customer Journey Analytics',
  analytics_to_cja: 'Adobe Analytics to CJA',
  campaign_std_to_v8: 'Campaign Standard to V8',
  campaign_classic_to_v8: 'Campaign Classic to V8',
  sfmc_to_adobe: 'SFMC to Adobe Campaign',
  aam_to_rtcdp: 'AAM to Real-Time CDP',
  competitor_cdp_to_aep: 'CDP Migration to AEP',
  custom: 'Custom Migration',
};

const SEVERITY_COLORS: Record<string, string> = {
  [Severity.CRITICAL]: '#DC2626',
  [Severity.HIGH]: '#F59E0B',
  [Severity.MEDIUM]: '#3B82F6',
  [Severity.LOW]: '#10B981',
  [Severity.INFO]: '#6B7280',
};

const SEVERITY_LABELS: Record<string, string> = {
  [Severity.CRITICAL]: 'Critical',
  [Severity.HIGH]: 'High',
  [Severity.MEDIUM]: 'Medium',
  [Severity.LOW]: 'Low',
  [Severity.INFO]: 'Info',
};

// ============================================================
// Traditional estimate multiplier per phase
// ============================================================

const TRADITIONAL_PHASE_MULTIPLIERS: Record<string, number> = {
  [PhaseType.ASSESSMENT]: 2.0,
  [PhaseType.PLANNING]: 1.5,
  [PhaseType.CODE_MODERNIZATION]: 4.0,
  [PhaseType.CONTENT_MIGRATION]: 3.0,
  [PhaseType.INTEGRATION_RECONNECTION]: 3.5,
  [PhaseType.TESTING]: 2.5,
  [PhaseType.CUTOVER]: 2.0,
  [PhaseType.MONITORING]: 1.5,
};

// ============================================================
// Main Preparation Function
// ============================================================

function getReadinessLevel(score: number): {
  level: string;
  description: string;
} {
  if (score >= 80) {
    return {
      level: 'Ready for Migration',
      description:
        'Your environment is well-prepared for migration. Minor remediation may be needed, but no blockers have been identified.',
    };
  }
  if (score >= 60) {
    return {
      level: 'Ready with Remediation',
      description:
        'Your environment can proceed with migration after addressing the identified findings. Black Hole can auto-fix many of these issues.',
    };
  }
  if (score >= 40) {
    return {
      level: 'Significant Work Needed',
      description:
        'Several areas require attention before migration can proceed safely. We recommend a phased approach to address critical and high findings first.',
    };
  }
  return {
    level: 'Not Recommended Yet',
    description:
      'Your environment has fundamental issues that should be resolved before attempting migration. Our team can help create a remediation roadmap.',
  };
}

function groupFindingsBySeverity(
  findings: AssessmentFinding[],
): Record<string, FindingSeverityGroup> {
  const groups: Record<string, FindingSeverityGroup> = {};

  const severities = [
    Severity.CRITICAL,
    Severity.HIGH,
    Severity.MEDIUM,
    Severity.LOW,
    Severity.INFO,
  ];

  for (const sev of severities) {
    const matched = findings.filter((f) => f.severity === sev);
    if (matched.length > 0) {
      groups[sev] = {
        count: matched.length,
        label: SEVERITY_LABELS[sev] ?? sev,
        color: SEVERITY_COLORS[sev] ?? '#6B7280',
        findings: matched,
      };
    }
  }

  return groups;
}

function groupFindingsByCategory(
  findings: AssessmentFinding[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.category] = (counts[f.category] ?? 0) + 1;
  }
  return counts;
}

function buildPhaseComparisons(
  phases: PhaseEstimate[],
): PhaseComparison[] {
  return phases.map((p) => ({
    name: PHASE_LABELS[p.phase] ?? p.phase,
    blackHoleWeeks: p.durationWeeks,
    traditionalWeeks:
      p.durationWeeks * (TRADITIONAL_PHASE_MULTIPLIERS[p.phase] ?? 2.5),
  }));
}

export function prepareReportData(
  assessment: AssessmentResult,
  migration?: MigrationProject | null,
): ReportData {
  const now = new Date().toISOString();
  const orgName = migration?.organizationName ?? 'Client Organization';
  const migrationName = migration?.name ?? 'Migration Assessment';
  const migrationType = migration?.migrationType ?? 'custom';
  const currency = assessment.estimatedCost.currency ?? 'USD';

  const readiness = getReadinessLevel(assessment.overallScore);

  const costSavings =
    assessment.traditionalEstimate.cost -
    assessment.estimatedCost.totalEstimate;
  const timeSavings =
    assessment.traditionalEstimate.durationWeeks -
    assessment.estimatedTimeline.totalWeeks;

  const bySeverity = groupFindingsBySeverity(assessment.findings);
  const byCategory = groupFindingsByCategory(assessment.findings);

  // Top findings: up to 10, sorted by severity priority
  const severityOrder = [
    Severity.CRITICAL,
    Severity.HIGH,
    Severity.MEDIUM,
    Severity.LOW,
    Severity.INFO,
  ];
  const sortedFindings = [...assessment.findings].sort(
    (a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  const highestRiskSeverity =
    assessment.riskFactors.length > 0
      ? assessment.riskFactors.reduce((worst, r) => {
          const wi = severityOrder.indexOf(worst.severity);
          const ri = severityOrder.indexOf(r.severity);
          return ri < wi ? r : worst;
        }).severity
      : 'none';

  return {
    meta: {
      reportId: `report-${assessment.id}`,
      organizationName: orgName,
      migrationName,
      migrationType:
        MIGRATION_TYPE_LABELS[migrationType] ?? migrationType,
      generatedAt: now,
      generatedDate: formatDate(now),
      confidentialityNotice:
        `This document is confidential and intended solely for ${orgName}. ` +
        'It contains proprietary analysis by Focus GTS. Do not distribute without written permission.',
    },
    executive: {
      overallScore: assessment.overallScore,
      readinessLevel: readiness.level,
      readinessDescription: readiness.description,
      totalFindings: assessment.findings.length,
      criticalFindings: assessment.findings.filter(
        (f) => f.severity === Severity.CRITICAL,
      ).length,
      autoFixableFindings: assessment.findings.filter(
        (f) => f.autoFixAvailable,
      ).length,
      estimatedSavings: formatCurrency(costSavings, currency),
      estimatedSavingsPercent:
        assessment.traditionalEstimate.costSavingsPercent,
      estimatedTimeSavings: `${Math.round(timeSavings)} weeks`,
      estimatedTimeSavingsPercent:
        assessment.traditionalEstimate.timeSavingsPercent,
    },
    scores: {
      codeCompatibility: assessment.codeCompatibilityScore,
      contentReadiness: assessment.contentReadinessScore,
      integrationComplexity: assessment.integrationComplexityScore,
      configurationReadiness: assessment.configurationReadinessScore,
      compliance: assessment.complianceScore,
    },
    findings: {
      total: assessment.findings.length,
      bySeverity,
      byCategory,
      topFindings: sortedFindings.slice(0, 10),
      autoFixableCount: assessment.findings.filter(
        (f) => f.autoFixAvailable,
      ).length,
      totalEstimatedHours: assessment.findings.reduce(
        (sum, f) => sum + f.estimatedHours,
        0,
      ),
    },
    risks: {
      totalRisks: assessment.riskFactors.length,
      highestSeverity: highestRiskSeverity,
      risks: assessment.riskFactors,
    },
    timeline: {
      traditionalWeeks: assessment.traditionalEstimate.durationWeeks,
      blackHoleWeeks: assessment.estimatedTimeline.totalWeeks,
      savingsWeeks: Math.round(timeSavings),
      savingsPercent: assessment.traditionalEstimate.timeSavingsPercent,
      phases: buildPhaseComparisons(
        assessment.estimatedTimeline.phases,
      ),
    },
    cost: {
      traditionalCost: assessment.traditionalEstimate.cost,
      traditionalCostFormatted: formatCurrency(
        assessment.traditionalEstimate.cost,
        currency,
      ),
      blackHoleCost: assessment.estimatedCost.totalEstimate,
      blackHoleCostFormatted: formatCurrency(
        assessment.estimatedCost.totalEstimate,
        currency,
      ),
      savingsAmount: costSavings,
      savingsFormatted: formatCurrency(costSavings, currency),
      savingsPercent:
        assessment.traditionalEstimate.costSavingsPercent,
      platformFee: assessment.estimatedCost.platformFee,
      platformFeeFormatted: formatCurrency(
        assessment.estimatedCost.platformFee,
        currency,
      ),
      siCost: assessment.estimatedCost.estimatedSICost,
      siCostFormatted: formatCurrency(
        assessment.estimatedCost.estimatedSICost,
        currency,
      ),
      currency,
    },
    recommendations: assessment.recommendations,
  };
}
