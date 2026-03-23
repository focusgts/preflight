/**
 * Migration Cost Calculator — Unit Tests
 *
 * Tests the CostEngine for correctness across different scenarios.
 */

import { describe, it, expect } from 'vitest';
import { CostEngine } from '@/lib/calculator/cost-engine';
import type { CalculatorInputs } from '@/types/calculator';

function makeInputs(overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    migrationType: 'aem_onprem_to_cloud',
    numberOfSites: 25,
    numberOfCustomComponents: 100,
    numberOfAssets: 50,
    assetSizeGB: 100,
    numberOfIntegrations: 10,
    complianceRequirements: [],
    currentAEMVersion: '6.5',
    companySize: 'enterprise',
    ...overrides,
  };
}

describe('CostEngine', () => {
  const engine = new CostEngine();

  // ========================================================
  // Basic calculation tests
  // ========================================================

  it('should return a complete CalculationResult', () => {
    const result = engine.calculate(makeInputs());
    expect(result).toHaveProperty('traditional');
    expect(result).toHaveProperty('blackHole');
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('savings');
    expect(result).toHaveProperty('roi');
    expect(result).toHaveProperty('risk');
  });

  it('should calculate traditional costs as positive numbers', () => {
    const result = engine.calculateTraditional(makeInputs());
    expect(result.total).toBeGreaterThan(0);
    expect(result.assessment).toBeGreaterThan(0);
    expect(result.codeModernization).toBeGreaterThan(0);
    expect(result.contentMigration).toBeGreaterThan(0);
    expect(result.testing).toBeGreaterThan(0);
    expect(result.contingency).toBeGreaterThan(0);
  });

  it('should calculate Black Hole costs lower than traditional', () => {
    const inputs = makeInputs();
    const traditional = engine.calculateTraditional(inputs);
    const blackHole = engine.calculateBlackHole(inputs);
    expect(blackHole.total).toBeLessThan(traditional.total);
  });

  it('should have zero contingency for Black Hole', () => {
    const result = engine.calculateBlackHole(makeInputs());
    expect(result.contingency).toBe(0);
  });

  // ========================================================
  // Migration type tests
  // ========================================================

  it('should cost more for sitecore_to_aem than aem_ams_to_cloud', () => {
    const sitecore = engine.calculateTraditional(
      makeInputs({ migrationType: 'sitecore_to_aem' }),
    );
    const ams = engine.calculateTraditional(
      makeInputs({ migrationType: 'aem_ams_to_cloud' }),
    );
    expect(sitecore.total).toBeGreaterThan(ams.total);
  });

  it('should cost less for ga_to_cja (analytics) than full AEM migration', () => {
    const analytics = engine.calculateTraditional(
      makeInputs({ migrationType: 'ga_to_cja' }),
    );
    const aem = engine.calculateTraditional(
      makeInputs({ migrationType: 'aem_onprem_to_cloud' }),
    );
    expect(analytics.total).toBeLessThan(aem.total);
  });

  // ========================================================
  // Scale tests
  // ========================================================

  it('should increase cost with more sites', () => {
    const small = engine.calculateTraditional(makeInputs({ numberOfSites: 5 }));
    const large = engine.calculateTraditional(makeInputs({ numberOfSites: 200 }));
    expect(large.total).toBeGreaterThan(small.total);
  });

  it('should increase cost with more custom components', () => {
    const few = engine.calculateTraditional(makeInputs({ numberOfCustomComponents: 10 }));
    const many = engine.calculateTraditional(makeInputs({ numberOfCustomComponents: 400 }));
    expect(many.total).toBeGreaterThan(few.total);
  });

  it('should handle 1 site edge case', () => {
    const result = engine.calculate(makeInputs({ numberOfSites: 1 }));
    expect(result.traditional.total).toBeGreaterThan(0);
    expect(result.blackHole.total).toBeGreaterThan(0);
    expect(result.savings.costSaved).toBeGreaterThan(0);
  });

  it('should handle 500 sites edge case', () => {
    const result = engine.calculate(makeInputs({ numberOfSites: 500 }));
    expect(result.traditional.total).toBeGreaterThan(0);
    expect(result.timeline.traditionalTotalWeeks).toBeGreaterThan(
      result.timeline.blackHoleTotalWeeks,
    );
  });

  it('should handle 0 custom components', () => {
    const result = engine.calculate(makeInputs({ numberOfCustomComponents: 0 }));
    expect(result.traditional.codeModernization).toBe(0);
    expect(result.blackHole.codeModernization).toBe(0);
    expect(result.traditional.total).toBeGreaterThan(0); // Other phases still have cost
  });

  // ========================================================
  // Compliance tests
  // ========================================================

  it('should increase cost with compliance requirements', () => {
    const noneResult = engine.calculateTraditional(makeInputs());
    const hipaaResult = engine.calculateTraditional(
      makeInputs({ complianceRequirements: ['hipaa'] }),
    );
    expect(hipaaResult.total).toBeGreaterThan(noneResult.total);
  });

  it('should stack compliance costs', () => {
    const one = engine.calculateTraditional(
      makeInputs({ complianceRequirements: ['gdpr'] }),
    );
    const three = engine.calculateTraditional(
      makeInputs({ complianceRequirements: ['gdpr', 'hipaa', 'fedramp'] }),
    );
    expect(three.total).toBeGreaterThan(one.total);
  });

  // ========================================================
  // Timeline tests
  // ========================================================

  it('should calculate shorter Black Hole timeline', () => {
    const timeline = engine.calculateTimeline(makeInputs());
    expect(timeline.blackHoleTotalWeeks).toBeLessThan(timeline.traditionalTotalWeeks);
    expect(timeline.weeksSaved).toBeGreaterThan(0);
  });

  it('should have 7 phases in the timeline', () => {
    const timeline = engine.calculateTimeline(makeInputs());
    expect(timeline.phases).toHaveLength(7);
  });

  // ========================================================
  // ROI tests
  // ========================================================

  it('should calculate positive ROI', () => {
    const result = engine.calculate(makeInputs());
    expect(result.roi.additionalRevenue).toBeGreaterThan(0);
    expect(result.roi.paybackPeriodDays).toBeGreaterThan(0);
  });

  // ========================================================
  // Risk tests
  // ========================================================

  it('should calculate lower risk for Black Hole', () => {
    const risk = engine.calculateRisk(makeInputs());
    expect(risk.blackHoleOverrunPercent).toBeLessThan(risk.traditionalOverrunPercent);
  });

  it('should increase traditional risk for older AEM versions', () => {
    const newer = engine.calculateRisk(makeInputs({ currentAEMVersion: '6.5' }));
    const older = engine.calculateRisk(makeInputs({ currentAEMVersion: '6.1' }));
    expect(older.traditionalOverrunPercent).toBeGreaterThan(newer.traditionalOverrunPercent);
  });

  // ========================================================
  // Version multiplier tests
  // ========================================================

  it('should cost more for older AEM versions', () => {
    const v65 = engine.calculateTraditional(makeInputs({ currentAEMVersion: '6.5' }));
    const v61 = engine.calculateTraditional(makeInputs({ currentAEMVersion: '6.1' }));
    expect(v61.total).toBeGreaterThan(v65.total);
  });

  // ========================================================
  // Company size tests
  // ========================================================

  it('should use higher rates for large_enterprise', () => {
    const mid = engine.calculateTraditional(makeInputs({ companySize: 'mid_market' }));
    const large = engine.calculateTraditional(makeInputs({ companySize: 'large_enterprise' }));
    expect(large.total).toBeGreaterThan(mid.total);
  });

  // ========================================================
  // Savings percentage tests
  // ========================================================

  it('should show at least 30% cost savings', () => {
    const result = engine.calculate(makeInputs());
    expect(result.savings.costSavingsPercent).toBeGreaterThanOrEqual(30);
  });

  it('should show at least 30% time savings', () => {
    const result = engine.calculate(makeInputs());
    expect(result.savings.timeSavingsPercent).toBeGreaterThanOrEqual(30);
  });
});
