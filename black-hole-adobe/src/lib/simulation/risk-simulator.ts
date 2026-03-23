/**
 * Black Hole - Risk Simulator
 *
 * Analyzes simulation results to predict risks, calculate confidence,
 * identify edge cases, and generate mitigation plans. Uses probability
 * x impact scoring for a structured risk matrix.
 */

import { v4 as uuid } from 'uuid';
import { Severity } from '@/types';
import type {
  SimulationResult,
  SimulationIssue,
  RiskMatrixEntry,
  RiskLevel,
  SimulationPhase,
  SimulationRecommendation,
} from '@/types/simulation';

// ============================================================
// Historical Risk Patterns (RuVector-informed)
// ============================================================

interface RiskPattern {
  id: string;
  title: string;
  description: string;
  phase: SimulationPhase;
  triggerCondition: (results: SimulationResult[]) => boolean;
  baseProbability: number; // 1-5
  baseImpact: number; // 1-5
  mitigation: string;
}

const RISK_PATTERNS: RiskPattern[] = [
  {
    id: 'rp-001',
    title: 'Large content volume may cause timeout',
    description: 'Migrations with over 5000 items risk hitting timeout limits during content transfer.',
    phase: 'content_migration',
    triggerCondition: (results) => {
      const content = results.find((r) => r.phase === 'content_migration');
      return (content?.itemsAffected ?? 0) > 5000;
    },
    baseProbability: 3,
    baseImpact: 4,
    mitigation: 'Enable batch processing with checkpointing. Split migration into waves of 2000 items.',
  },
  {
    id: 'rp-002',
    title: 'Deprecated API usage blocks deployment',
    description: 'Code using deprecated APIs will fail Cloud Service deployment validation.',
    phase: 'code_modernization',
    triggerCondition: (results) => {
      const code = results.find((r) => r.phase === 'code_modernization');
      return (code?.itemsBlocker ?? 0) > 0;
    },
    baseProbability: 5,
    baseImpact: 5,
    mitigation: 'Resolve all blocker-level code issues before migration. Use auto-fix where available.',
  },
  {
    id: 'rp-003',
    title: 'Integration authentication mismatch',
    description: 'Source integrations using JWT/Basic auth may fail against IMS-based target.',
    phase: 'integration_reconnection',
    triggerCondition: (results) => {
      const integration = results.find((r) => r.phase === 'integration_reconnection');
      return (integration?.issuesFound ?? []).some((i) =>
        i.title.toLowerCase().includes('auth'),
      );
    },
    baseProbability: 4,
    baseImpact: 4,
    mitigation: 'Pre-configure OAuth Server-to-Server credentials. Test auth flows in staging.',
  },
  {
    id: 'rp-004',
    title: 'Broken content references post-migration',
    description: 'Internal links and asset references may break when paths change.',
    phase: 'content_migration',
    triggerCondition: (results) => {
      const content = results.find((r) => r.phase === 'content_migration');
      return (content?.issuesFound ?? []).some((i) =>
        i.title.toLowerCase().includes('reference'),
      );
    },
    baseProbability: 3,
    baseImpact: 3,
    mitigation: 'Run reference validation pre-migration. Configure URL rewriting rules.',
  },
  {
    id: 'rp-005',
    title: 'Custom OSGi configs incompatible',
    description: 'OSGi configurations may reference services unavailable in Cloud Service.',
    phase: 'code_modernization',
    triggerCondition: (results) => {
      const code = results.find((r) => r.phase === 'code_modernization');
      return (code?.issuesFound ?? []).some((i) =>
        i.title.toLowerCase().includes('osgi') || i.title.toLowerCase().includes('config'),
      );
    },
    baseProbability: 3,
    baseImpact: 3,
    mitigation: 'Review OSGi configs against Cloud Service allowlist. Use environment-specific config folders.',
  },
  {
    id: 'rp-006',
    title: 'High manual fix ratio increases timeline risk',
    description: 'When more than 30% of items need manual intervention, timelines tend to slip.',
    phase: 'assessment',
    triggerCondition: (results) => {
      const total = results.reduce((s, r) => s + r.itemsAffected, 0);
      const manual = results.reduce((s, r) => s + r.itemsManualFix, 0);
      return total > 0 && manual / total > 0.3;
    },
    baseProbability: 4,
    baseImpact: 3,
    mitigation: 'Allocate dedicated resources for manual fixes. Prioritize by business impact.',
  },
  {
    id: 'rp-007',
    title: 'Low assessment confidence suggests unknowns',
    description: 'Simulation confidence below 70% means significant uncertainty in predictions.',
    phase: 'assessment',
    triggerCondition: (results) => {
      const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / Math.max(results.length, 1);
      return avgConfidence < 0.7;
    },
    baseProbability: 3,
    baseImpact: 4,
    mitigation: 'Run thorough simulation depth. Conduct manual review of low-confidence items.',
  },
  {
    id: 'rp-008',
    title: 'Validation failures indicate quality gaps',
    description: 'Simulated validation failures suggest the migration output may not meet quality standards.',
    phase: 'validation',
    triggerCondition: (results) => {
      const validation = results.find((r) => r.phase === 'validation');
      return validation?.predictedOutcome === 'failure';
    },
    baseProbability: 4,
    baseImpact: 5,
    mitigation: 'Address all critical validation issues before proceeding. Add custom validation rules.',
  },
];

// ============================================================
// Risk Simulator
// ============================================================

export class RiskSimulator {
  /**
   * Analyze simulation results and predict risks using
   * historical patterns and current findings.
   */
  predictRisks(simulationResults: SimulationResult[]): RiskMatrixEntry[] {
    const risks: RiskMatrixEntry[] = [];

    // Check each pattern against results
    for (const pattern of RISK_PATTERNS) {
      if (pattern.triggerCondition(simulationResults)) {
        risks.push({
          id: `risk-${uuid().slice(0, 8)}`,
          title: pattern.title,
          description: pattern.description,
          probability: pattern.baseProbability,
          impact: pattern.baseImpact,
          level: this.computeRiskLevel(
            pattern.baseProbability,
            pattern.baseImpact,
          ),
          phase: pattern.phase,
          mitigation: pattern.mitigation,
        });
      }
    }

    // Generate risks from individual simulation issues
    const issueRisks = this.risksFromIssues(simulationResults);
    risks.push(...issueRisks);

    // Deduplicate by title
    const seen = new Set<string>();
    return risks.filter((r) => {
      if (seen.has(r.title)) return false;
      seen.add(r.title);
      return true;
    });
  }

  /**
   * Calculate how confident we are in the simulation results.
   * Returns a score between 0 and 1.
   */
  calculateConfidence(simulationResults: SimulationResult[]): number {
    if (simulationResults.length === 0) return 0;

    let score = 0;
    let totalWeight = 0;

    // Weight by phase importance
    const phaseWeights: Record<SimulationPhase, number> = {
      assessment: 1.0,
      code_modernization: 1.5,
      content_migration: 1.2,
      integration_reconnection: 1.3,
      validation: 1.4,
    };

    for (const result of simulationResults) {
      const weight = phaseWeights[result.phase] ?? 1.0;
      score += result.confidence * weight;
      totalWeight += weight;
    }

    let baseConfidence = totalWeight > 0 ? score / totalWeight : 0;

    // Penalize for blockers
    const totalBlockers = simulationResults.reduce(
      (s, r) => s + r.itemsBlocker,
      0,
    );
    if (totalBlockers > 0) {
      baseConfidence *= Math.max(0.5, 1 - totalBlockers * 0.05);
    }

    // Penalize for failure outcomes
    const failures = simulationResults.filter(
      (r) => r.predictedOutcome === 'failure',
    );
    if (failures.length > 0) {
      baseConfidence *= Math.max(0.4, 1 - failures.length * 0.15);
    }

    // Boost for thorough coverage (more phases = more data = higher confidence)
    const coverageBoost = Math.min(simulationResults.length / 5, 1) * 0.1;
    baseConfidence = Math.min(1, baseConfidence + coverageBoost);

    return Math.round(baseConfidence * 100) / 100;
  }

  /**
   * Identify items or scenarios the simulation cannot fully predict.
   * These are areas where manual review is recommended.
   */
  identifyEdgeCases(
    simulationResults: SimulationResult[],
  ): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];

    // Large item counts reduce per-item analysis depth
    for (const result of simulationResults) {
      if (result.itemsAffected > 10000) {
        edgeCases.push({
          id: `edge-${uuid().slice(0, 8)}`,
          phase: result.phase,
          title: 'Very large item set may mask issues',
          description: `${result.itemsAffected} items in ${result.phase} - statistical analysis may miss edge cases in individual items.`,
          recommendation: 'Run thorough simulation depth or sample-based manual review.',
          severity: Severity.MEDIUM,
        });
      }

      // Low confidence phases
      if (result.confidence < 0.6) {
        edgeCases.push({
          id: `edge-${uuid().slice(0, 8)}`,
          phase: result.phase,
          title: `Low confidence in ${result.phase} prediction`,
          description: `Confidence is ${Math.round(result.confidence * 100)}% - simulation lacks sufficient data for reliable prediction.`,
          recommendation: 'Provide more source environment data or run manual assessment.',
          severity: Severity.HIGH,
        });
      }

      // Mixed auto-fix and manual items
      if (result.itemsAutoFixable > 0 && result.itemsManualFix > 0) {
        const ratio = result.itemsManualFix / (result.itemsAutoFixable + result.itemsManualFix);
        if (ratio > 0.4 && ratio < 0.6) {
          edgeCases.push({
            id: `edge-${uuid().slice(0, 8)}`,
            phase: result.phase,
            title: 'Mixed auto-fix and manual-fix ratio',
            description: 'Nearly equal split between auto-fixable and manual items may indicate classification uncertainty.',
            recommendation: 'Review borderline items manually to confirm classification.',
            severity: Severity.LOW,
          });
        }
      }
    }

    // Cross-phase dependencies
    const hasCode = simulationResults.some((r) => r.phase === 'code_modernization');
    const hasIntegration = simulationResults.some((r) => r.phase === 'integration_reconnection');
    if (hasCode && hasIntegration) {
      const codeBlockers = simulationResults
        .find((r) => r.phase === 'code_modernization')
        ?.itemsBlocker ?? 0;
      if (codeBlockers > 0) {
        edgeCases.push({
          id: `edge-${uuid().slice(0, 8)}`,
          phase: 'integration_reconnection',
          title: 'Code blockers may affect integration reconnection',
          description: 'Unresolved code blockers could prevent integration endpoints from deploying correctly.',
          recommendation: 'Resolve code blockers before testing integrations.',
          severity: Severity.HIGH,
        });
      }
    }

    return edgeCases;
  }

  /**
   * Generate a prioritized mitigation plan for identified risks.
   */
  generateMitigationPlan(
    risks: RiskMatrixEntry[],
  ): SimulationRecommendation[] {
    const recommendations: SimulationRecommendation[] = [];

    // Sort risks by score (probability x impact) descending
    const sorted = [...risks].sort(
      (a, b) => b.probability * b.impact - a.probability * a.impact,
    );

    for (let i = 0; i < sorted.length; i++) {
      const risk = sorted[i];
      const score = risk.probability * risk.impact;

      let action: SimulationRecommendation['action'];
      if (score >= 20) {
        action = 'address_first';
      } else if (score >= 9) {
        action = 'investigate';
      } else {
        action = 'proceed';
      }

      recommendations.push({
        priority: i + 1,
        category: risk.phase,
        title: `Mitigate: ${risk.title}`,
        description: risk.mitigation,
        action,
      });
    }

    // Add overall recommendation
    const criticalCount = risks.filter((r) => r.level === 'critical').length;
    const highCount = risks.filter((r) => r.level === 'high').length;

    if (criticalCount > 0) {
      recommendations.unshift({
        priority: 0,
        category: 'overall',
        title: 'Address critical risks before proceeding',
        description: `${criticalCount} critical risk(s) identified. Migration should not proceed until these are resolved.`,
        action: 'address_first',
      });
    } else if (highCount > 2) {
      recommendations.unshift({
        priority: 0,
        category: 'overall',
        title: 'Review high-risk items before migration',
        description: `${highCount} high-risk items found. Recommend addressing the top 3 before proceeding.`,
        action: 'investigate',
      });
    } else {
      recommendations.unshift({
        priority: 0,
        category: 'overall',
        title: 'Migration can proceed with monitoring',
        description: 'No critical risks detected. Proceed with standard monitoring.',
        action: 'proceed',
      });
    }

    return recommendations;
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private computeRiskLevel(probability: number, impact: number): RiskLevel {
    const score = probability * impact;
    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }

  private risksFromIssues(results: SimulationResult[]): RiskMatrixEntry[] {
    const risks: RiskMatrixEntry[] = [];

    for (const result of results) {
      // Group critical/high issues into risks
      const criticalIssues = result.issuesFound.filter(
        (i) => i.severity === Severity.CRITICAL,
      );
      const highIssues = result.issuesFound.filter(
        (i) => i.severity === Severity.HIGH,
      );

      if (criticalIssues.length > 0) {
        risks.push({
          id: `risk-${uuid().slice(0, 8)}`,
          title: `${criticalIssues.length} critical issue(s) in ${result.phase}`,
          description: criticalIssues.map((i) => i.title).join('; '),
          probability: 5,
          impact: 5,
          level: 'critical',
          phase: result.phase,
          mitigation: criticalIssues
            .map((i) => i.suggestedFix)
            .filter(Boolean)
            .join(' '),
        });
      }

      if (highIssues.length > 3) {
        risks.push({
          id: `risk-${uuid().slice(0, 8)}`,
          title: `${highIssues.length} high-severity issues in ${result.phase}`,
          description: 'Multiple high-severity issues increase cumulative risk.',
          probability: 4,
          impact: 3,
          level: 'high',
          phase: result.phase,
          mitigation: 'Prioritize and resolve high-severity issues. Consider phased migration.',
        });
      }
    }

    return risks;
  }
}

// ============================================================
// Supporting Types
// ============================================================

export interface EdgeCase {
  id: string;
  phase: SimulationPhase;
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
}
