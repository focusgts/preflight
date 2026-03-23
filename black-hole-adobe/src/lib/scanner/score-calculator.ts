/**
 * Score Calculator & Industry Benchmarking
 *
 * Calculates weighted overall scores, compares against industry
 * averages, and generates prioritized recommendations.
 */

import type {
  ScanResult,
  CategoryScore,
  Grade,
  IndustryBenchmark,
  MigrationUrgency,
  UrgencyLevel,
  ScanFinding,
} from '@/types/scanner';

// ============================================================
// Industry Benchmark Data (mock — replace with real data)
// ============================================================

const INDUSTRY_BENCHMARKS: Record<string, number> = {
  'financial-services': 52,
  healthcare: 48,
  retail: 61,
  technology: 67,
  media: 58,
  manufacturing: 45,
  government: 41,
  education: 50,
  travel: 55,
  telecom: 53,
  default: 54,
};

// ============================================================
// AEM Version Deadlines
// ============================================================

const AEM_DEADLINES: Record<string, string> = {
  '6.1': '2022-06-30',
  '6.2': '2023-04-26',
  '6.3': '2024-04-25',
  '6.4': '2025-04-03',
  '6.5': '2027-03-31',
};

// ============================================================
// Category Weights
// ============================================================

const CATEGORY_WEIGHTS = {
  performance: 0.25,
  security: 0.20,
  seo: 0.20,
  migration: 0.25,
  accessibility: 0.10,
} as const;

// ============================================================
// Score Calculator
// ============================================================

export class ScoreCalculator {
  /**
   * Calculate weighted overall score from category scores.
   */
  calculate(categories: ScanResult['categories']): number {
    const weighted =
      categories.performance.score * CATEGORY_WEIGHTS.performance +
      categories.security.score * CATEGORY_WEIGHTS.security +
      categories.seo.score * CATEGORY_WEIGHTS.seo +
      categories.migration.score * CATEGORY_WEIGHTS.migration +
      categories.accessibility.score * CATEGORY_WEIGHTS.accessibility;

    return Math.round(Math.max(0, Math.min(100, weighted)));
  }

  /**
   * Get industry benchmark average score.
   */
  getIndustryBenchmark(
    score: number,
    industry?: string,
  ): IndustryBenchmark {
    const key = industry?.toLowerCase().replace(/\s+/g, '-') ?? 'default';
    const averageScore = INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS.default;

    const diff = score - averageScore;
    const maxSpread = 50;
    const normalizedDiff = Math.max(-maxSpread, Math.min(maxSpread, diff));
    const percentile = Math.round(50 + (normalizedDiff / maxSpread) * 45);
    const clampedPercentile = Math.max(1, Math.min(99, percentile));

    return {
      industry: industry ?? 'All Industries',
      averageScore,
      percentile: clampedPercentile,
      comparison: diff > 2 ? 'above' : diff < -2 ? 'below' : 'at',
    };
  }

  /**
   * Get migration urgency based on AEM version and support deadlines.
   */
  getMigrationUrgency(
    aemVersion: string | null,
    score: number,
  ): MigrationUrgency {
    if (!aemVersion) {
      return {
        level: 'none',
        daysUntilDeadline: null,
        deadlineDate: null,
        message: 'No AEM version detected.',
      };
    }

    if (aemVersion.toLowerCase().includes('cloud')) {
      return {
        level: 'low',
        daysUntilDeadline: null,
        deadlineDate: null,
        message:
          'AEM as a Cloud Service detected. You are on the latest platform.',
      };
    }

    const majorMinor = aemVersion.match(/^(\d+\.\d+)/)?.[1];
    const deadline = majorMinor ? AEM_DEADLINES[majorMinor] : null;

    if (!deadline) {
      return {
        level: score < 40 ? 'high' : 'medium',
        daysUntilDeadline: null,
        deadlineDate: null,
        message: `AEM ${aemVersion} detected. Check Adobe support lifecycle for your version.`,
      };
    }

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let level: UrgencyLevel;
    let message: string;

    if (daysUntil < 0) {
      level = 'critical';
      message = `AEM ${aemVersion} support ended ${Math.abs(daysUntil)} days ago. Migrate immediately.`;
    } else if (daysUntil < 180) {
      level = 'critical';
      message = `AEM ${aemVersion} support ends in ${daysUntil} days. You need to start NOW.`;
    } else if (daysUntil < 365) {
      level = 'high';
      message = `AEM ${aemVersion} support ends in ${daysUntil} days. Begin planning your migration.`;
    } else {
      level = 'medium';
      message = `AEM ${aemVersion} support ends on ${deadline}. Plan your migration timeline.`;
    }

    return {
      level,
      daysUntilDeadline: daysUntil,
      deadlineDate: deadline,
      message,
    };
  }

  /**
   * Generate prioritized recommendations from scan findings.
   */
  getRecommendations(categories: ScanResult['categories']): ScanFinding[] {
    const allFindings: ScanFinding[] = [
      ...categories.performance.findings,
      ...categories.seo.findings,
      ...categories.security.findings,
      ...categories.accessibility.findings,
      ...categories.migration.findings,
    ];

    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };

    return allFindings
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 15);
  }

  /**
   * Convert a numeric score (0-100) to a letter grade.
   */
  static toGrade(score: number): Grade {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Build a CategoryScore object with computed grade.
   */
  static buildCategory(
    name: string,
    score: number,
    weight: number,
    findings: ScanFinding[],
  ): CategoryScore {
    return {
      name,
      score: Math.round(Math.max(0, Math.min(100, score))),
      weight,
      grade: ScoreCalculator.toGrade(score),
      findings,
    };
  }
}
