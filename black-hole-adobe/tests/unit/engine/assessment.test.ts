/**
 * Tests for AssessmentEngine
 *
 * Since there is no dedicated AssessmentEngine class in the codebase yet,
 * these tests define the expected behavior for assessment calculations
 * using the existing SortEngine as the foundation, testing the scoring
 * and estimation functions that would compose an assessment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SortEngine, type ClassificationResult } from '@/lib/engine/sort';
import {
  AdobeProduct,
  SEACategory,
  CompatibilityLevel,
  PhaseType,
  Severity,
} from '@/types';
import type {
  MigrationItem,
  AssessmentResult,
  ContentHealth,
  IntegrationDependency,
  RiskFactor,
  TimelineEstimate,
  CostEstimate,
  TraditionalEstimate,
  PhaseEstimate,
} from '@/types';

// ---- Helpers ----

function makeItem(overrides: Partial<MigrationItem> = {}): MigrationItem {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type ?? 'content',
    name: overrides.name ?? 'test-item',
    sourcePath: overrides.sourcePath ?? '/content/test',
    targetPath: overrides.targetPath ?? null,
    status: overrides.status ?? 'pending',
    compatibilityLevel: overrides.compatibilityLevel ?? CompatibilityLevel.COMPATIBLE,
    autoFixed: overrides.autoFixed ?? false,
    validationResult: overrides.validationResult ?? null,
    error: overrides.error ?? null,
    processedAt: overrides.processedAt ?? null,
  };
}

/**
 * Build a mock assessment result from classified items for testing
 * the score calculations and comparison logic.
 */
function buildAssessment(
  classifications: ClassificationResult[],
  engine: SortEngine,
): AssessmentResult {
  const readinessScore = engine.scoreReadiness(classifications);
  const totalEffort = classifications.reduce((s, c) => s + c.effortHours, 0);
  const avgRisk = classifications.length > 0
    ? classifications.reduce((s, c) => s + c.riskScore, 0) / classifications.length
    : 0;

  const blockers = classifications.filter(
    (c) => c.compatibilityLevel === CompatibilityLevel.BLOCKER,
  ).length;
  const manualFixes = classifications.filter(
    (c) => c.compatibilityLevel === CompatibilityLevel.MANUAL_FIX,
  ).length;
  const autoFixes = classifications.filter(
    (c) => c.compatibilityLevel === CompatibilityLevel.AUTO_FIXABLE,
  ).length;

  const codeScore = blockers === 0 ? 85 : Math.max(0, 85 - blockers * 20);
  const contentScore = readinessScore;
  const integrationScore = Math.round(100 - avgRisk * 100);
  const configScore = autoFixes > 0 ? 70 : 90;
  const complianceScore = 80;

  const overallScore = Math.round(
    (codeScore + contentScore + integrationScore + configScore + complianceScore) / 5,
  );

  const weeksFromEffort = Math.max(2, Math.ceil(totalEffort / 40));
  const traditionalWeeks = Math.ceil(weeksFromEffort * 2.5);
  const platformFee = 15000;
  const siHourlyRate = 200;
  const estimatedSICost = totalEffort * siHourlyRate;
  const traditionalCost = estimatedSICost * 2.5;

  return {
    id: 'assess-1',
    migrationProjectId: 'proj-1',
    overallScore,
    codeCompatibilityScore: codeScore,
    contentReadinessScore: contentScore,
    integrationComplexityScore: integrationScore,
    configurationReadinessScore: configScore,
    complianceScore,
    findings: [],
    contentHealth: {
      totalPages: classifications.filter((c) => c.tags.includes('type:page')).length,
      totalAssets: classifications.filter((c) => c.tags.includes('type:asset')).length,
      totalContentFragments: 0,
      totalExperienceFragments: 0,
      duplicatesDetected: 0,
      brokenReferences: 0,
      metadataCompleteness: 75,
      structuralIssues: blockers,
      totalSizeGB: 1.5,
      publishedPercentage: 60,
    },
    integrationMap: [],
    riskFactors: classifications
      .filter((c) => c.riskScore > 0.4)
      .map((c) => ({
        id: `risk-${c.itemId}`,
        severity: c.riskScore > 0.7 ? Severity.HIGH : Severity.MEDIUM,
        category: 'compatibility',
        description: c.reasoning,
        probability: c.riskScore,
        impact: 'Migration may fail without remediation',
        mitigation: 'Review and update affected code',
      })),
    estimatedTimeline: {
      totalWeeks: weeksFromEffort,
      phases: [
        { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 0, endWeek: 1, parallelizable: false },
        { phase: PhaseType.CODE_MODERNIZATION, durationWeeks: Math.ceil(weeksFromEffort * 0.4), startWeek: 1, endWeek: 1 + Math.ceil(weeksFromEffort * 0.4), parallelizable: true },
        { phase: PhaseType.CONTENT_MIGRATION, durationWeeks: Math.ceil(weeksFromEffort * 0.3), startWeek: 1, endWeek: 1 + Math.ceil(weeksFromEffort * 0.3), parallelizable: true },
        { phase: PhaseType.TESTING, durationWeeks: Math.ceil(weeksFromEffort * 0.2), startWeek: weeksFromEffort - 2, endWeek: weeksFromEffort, parallelizable: false },
      ],
      confidenceLevel: avgRisk < 0.3 ? 0.85 : 0.6,
    },
    estimatedCost: {
      platformFee,
      estimatedSIHours: totalEffort,
      estimatedSICost,
      totalEstimate: platformFee + estimatedSICost,
      currency: 'USD',
    },
    traditionalEstimate: {
      durationWeeks: traditionalWeeks,
      cost: traditionalCost,
      timeSavingsPercent: Math.round((1 - weeksFromEffort / traditionalWeeks) * 100),
      costSavingsPercent: Math.round((1 - (platformFee + estimatedSICost) / traditionalCost) * 100),
    },
    recommendations: [],
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// Tests
// ============================================================

describe('AssessmentEngine (composed from SortEngine)', () => {
  let engine: SortEngine;

  beforeEach(() => {
    engine = new SortEngine();
  });

  // ----------------------------------------------------------
  // Overall Readiness Scoring
  // ----------------------------------------------------------

  describe('overall readiness scoring', () => {
    it('should produce a high overall score for clean items', () => {
      const items = [
        makeItem({ type: 'asset', sourcePath: '/content/dam/img1.jpg' }),
        makeItem({ type: 'asset', sourcePath: '/content/dam/img2.jpg' }),
        makeItem({ type: 'page', name: 'homepage', sourcePath: '/content/site/en' }),
      ];

      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('should produce a lower overall score when blockers are present', () => {
      const cleanItems = [
        makeItem({ type: 'asset', sourcePath: '/content/dam/img.jpg' }),
      ];
      const blockerItems = [
        makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' }),
        makeItem({ name: 'classic-ui', sourcePath: '/apps/old' }),
      ];

      const cleanClassifications = cleanItems.map((i) => engine.classifyItem(i));
      const blockerClassifications = [...cleanItems, ...blockerItems].map((i) => engine.classifyItem(i));

      const cleanAssessment = buildAssessment(cleanClassifications, engine);
      const blockerAssessment = buildAssessment(blockerClassifications, engine);

      expect(blockerAssessment.overallScore).toBeLessThan(cleanAssessment.overallScore);
    });

    it('should have scores between 0 and 100', () => {
      const items = [makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // ----------------------------------------------------------
  // Code Compatibility Analysis
  // ----------------------------------------------------------

  describe('code compatibility analysis', () => {
    it('should set code compatibility to 85 when no blockers exist', () => {
      const items = [makeItem({ type: 'page', sourcePath: '/content/site/en' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.codeCompatibilityScore).toBe(85);
    });

    it('should reduce code compatibility for each blocker', () => {
      const items = [
        makeItem({ name: 'javax.jcr-1', sourcePath: '/apps/legacy1' }),
        makeItem({ name: 'javax.jcr-2', sourcePath: '/apps/legacy2' }),
      ];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.codeCompatibilityScore).toBe(45); // 85 - 2*20
    });

    it('should not let code compatibility go below 0', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        makeItem({ name: `javax.jcr-${i}`, sourcePath: `/apps/legacy${i}` }),
      );
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.codeCompatibilityScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ----------------------------------------------------------
  // Content Health Analysis
  // ----------------------------------------------------------

  describe('content health analysis', () => {
    it('should count pages and assets separately', () => {
      const items = [
        makeItem({ type: 'page', sourcePath: '/content/site/en/p1' }),
        makeItem({ type: 'page', sourcePath: '/content/site/en/p2' }),
        makeItem({ type: 'asset', sourcePath: '/content/dam/img.jpg' }),
      ];

      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.contentHealth.totalPages).toBe(2);
      expect(assessment.contentHealth.totalAssets).toBe(1);
    });

    it('should track structural issues from blockers', () => {
      const items = [
        makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' }),
        makeItem({ type: 'page', sourcePath: '/content/en' }),
      ];

      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.contentHealth.structuralIssues).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Integration Mapping
  // ----------------------------------------------------------

  describe('integration mapping', () => {
    it('should have an integration map array', () => {
      const items = [makeItem({ sourcePath: '/content/page' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(Array.isArray(assessment.integrationMap)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Risk Factor Identification
  // ----------------------------------------------------------

  describe('risk factor identification', () => {
    it('should identify risk factors from high-risk items', () => {
      const items = [
        makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' }),
      ];

      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.riskFactors.length).toBeGreaterThan(0);
      expect(assessment.riskFactors[0].severity).toBe(Severity.HIGH);
    });

    it('should not create risk factors for low-risk items', () => {
      const items = [
        makeItem({ type: 'asset', sourcePath: '/content/dam/photo.jpg' }),
      ];

      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.riskFactors).toHaveLength(0);
    });

    it('should include probability and mitigation in risk factors', () => {
      const items = [makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      const risk = assessment.riskFactors[0];
      expect(risk.probability).toBeGreaterThan(0);
      expect(risk.mitigation).toBeDefined();
      expect(risk.mitigation.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // Timeline Estimation
  // ----------------------------------------------------------

  describe('timeline estimation', () => {
    it('should estimate at least 2 weeks for any project', () => {
      const items = [makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedTimeline.totalWeeks).toBeGreaterThanOrEqual(2);
    });

    it('should include assessment, code modernization, content migration, and testing phases', () => {
      const items = [
        makeItem({ type: 'page', sourcePath: '/content/en/p1' }),
        makeItem({ type: 'code', sourcePath: '/apps/bundle.java' }),
      ];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      const phaseTypes = assessment.estimatedTimeline.phases.map((p) => p.phase);
      expect(phaseTypes).toContain(PhaseType.ASSESSMENT);
      expect(phaseTypes).toContain(PhaseType.CODE_MODERNIZATION);
      expect(phaseTypes).toContain(PhaseType.CONTENT_MIGRATION);
      expect(phaseTypes).toContain(PhaseType.TESTING);
    });

    it('should set higher confidence for low-risk projects', () => {
      const cleanItems = [
        makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }),
        makeItem({ type: 'asset', sourcePath: '/content/dam/b.jpg' }),
      ];
      const classifications = cleanItems.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedTimeline.confidenceLevel).toBeGreaterThan(0.7);
    });

    it('should set lower confidence for high-risk projects', () => {
      const riskyItems = [
        makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy1' }),
        makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy2' }),
      ];
      const classifications = riskyItems.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedTimeline.confidenceLevel).toBeLessThanOrEqual(0.7);
    });

    it('should have phases with valid start/end weeks', () => {
      const items = [makeItem({ type: 'code', sourcePath: '/apps/bundle.java' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      for (const phase of assessment.estimatedTimeline.phases) {
        expect(phase.startWeek).toBeLessThan(phase.endWeek);
        expect(phase.durationWeeks).toBeGreaterThan(0);
      }
    });
  });

  // ----------------------------------------------------------
  // Cost Estimation
  // ----------------------------------------------------------

  describe('cost estimation', () => {
    it('should include platform fee in total', () => {
      const items = [makeItem({ sourcePath: '/content/page' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedCost.platformFee).toBe(15000);
      expect(assessment.estimatedCost.totalEstimate).toBeGreaterThan(
        assessment.estimatedCost.platformFee,
      );
    });

    it('should calculate SI cost from effort hours', () => {
      const items = [
        makeItem({ type: 'code', sourcePath: '/apps/bundle.java' }),
      ];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedCost.estimatedSIHours).toBeGreaterThan(0);
      expect(assessment.estimatedCost.estimatedSICost).toBe(
        assessment.estimatedCost.estimatedSIHours * 200,
      );
    });

    it('should use USD as currency', () => {
      const items = [makeItem({ sourcePath: '/content/page' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedCost.currency).toBe('USD');
    });

    it('should have total = platformFee + SI cost', () => {
      const items = [makeItem({ type: 'code', sourcePath: '/apps/svc.java' })];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.estimatedCost.totalEstimate).toBe(
        assessment.estimatedCost.platformFee + assessment.estimatedCost.estimatedSICost,
      );
    });
  });

  // ----------------------------------------------------------
  // Traditional vs Black Hole Comparison
  // ----------------------------------------------------------

  describe('traditional vs Black Hole comparison', () => {
    it('should show time savings in traditional estimate', () => {
      const items = [
        makeItem({ type: 'code', sourcePath: '/apps/bundle.java' }),
        makeItem({ type: 'page', sourcePath: '/content/site/en' }),
      ];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.traditionalEstimate.timeSavingsPercent).toBeGreaterThan(0);
    });

    it('should show cost savings in traditional estimate', () => {
      // Need enough items so that effort-based cost exceeds platform fee overhead
      // Traditional = SI * 2.5; BH = platformFee + SI. Savings when SI * 2.5 > platformFee + SI => SI * 1.5 > platformFee
      // With code items: base 4h * 0.25 compat = 1h each, $200/h, so need > 50 items (50*200*1.5 = 15000)
      const items = Array.from({ length: 100 }, (_, i) =>
        makeItem({ type: 'code', sourcePath: `/apps/bundle${i}.java` }),
      );
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.traditionalEstimate.costSavingsPercent).toBeGreaterThan(0);
    });

    it('should have traditional duration longer than Black Hole', () => {
      const items = [
        makeItem({ type: 'code', sourcePath: '/apps/bundle.java' }),
        makeItem({ type: 'page', sourcePath: '/content/site/en' }),
      ];
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.traditionalEstimate.durationWeeks).toBeGreaterThan(
        assessment.estimatedTimeline.totalWeeks,
      );
    });

    it('should have traditional cost higher than Black Hole total', () => {
      // Traditional = SI * 2.5; BH = platformFee + SI. Need SI * 1.5 > platformFee (15000)
      // 100 code items * 1h * $200 = $20000 SI cost. Traditional = $50000, BH = $35000
      const items = Array.from({ length: 100 }, (_, i) =>
        makeItem({ type: 'code', sourcePath: `/apps/svc${i}.java` }),
      );
      const classifications = items.map((i) => engine.classifyItem(i));
      const assessment = buildAssessment(classifications, engine);

      expect(assessment.traditionalEstimate.cost).toBeGreaterThan(
        assessment.estimatedCost.totalEstimate,
      );
    });
  });

  // ----------------------------------------------------------
  // Configuration Readiness
  // ----------------------------------------------------------

  describe('configuration readiness', () => {
    it('should reduce config score when auto-fix items exist', () => {
      const withAutoFix = [
        makeItem({ name: 'sling:resourceType', sourcePath: '/apps/config' }),
      ];
      const clean = [
        makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }),
      ];

      const autoFixAssessment = buildAssessment(
        withAutoFix.map((i) => engine.classifyItem(i)),
        engine,
      );
      const cleanAssessment = buildAssessment(
        clean.map((i) => engine.classifyItem(i)),
        engine,
      );

      expect(autoFixAssessment.configurationReadinessScore).toBeLessThan(
        cleanAssessment.configurationReadinessScore,
      );
    });
  });
});
