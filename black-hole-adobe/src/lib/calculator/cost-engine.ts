/**
 * Migration Cost Calculator — Cost Engine
 *
 * Pricing models based on industry data for SI engagements (Accenture, Deloitte,
 * Cognizant, Infosys) and Black Hole's platform-assisted approach.
 *
 * Traditional SI Model:
 *   - Blended rate: $250-350/hr depending on company size
 *   - Each phase has estimated duration and team size
 *   - 30-50% contingency for overruns (industry standard)
 *
 * Black Hole Model:
 *   - Platform fee based on migration tier
 *   - 50-70% reduction in SI hours through automation
 *   - No contingency buffer (simulation + self-healing)
 */

import type {
  CalculatorInputs,
  CalculationResult,
  CostBreakdown,
  TimelineComparison,
  PhaseBreakdown,
  SavingsBreakdown,
  ROIProjection,
  RiskComparison,
  CalcMigrationType,
  CompanySize,
} from '@/types/calculator';

// ============================================================
// Rate Tables
// ============================================================

/** Blended hourly rate by company size tier */
const HOURLY_RATES: Record<CompanySize, number> = {
  mid_market: 250,
  enterprise: 300,
  large_enterprise: 350,
};

/** Base complexity multiplier by migration type */
const MIGRATION_COMPLEXITY: Record<CalcMigrationType, number> = {
  aem_onprem_to_cloud: 1.0,
  aem_ams_to_cloud: 0.7,     // AMS is closer to cloud
  wordpress_to_aem: 1.3,     // Platform shift adds complexity
  sitecore_to_aem: 1.5,      // Competitor migration, higher risk
  ga_to_cja: 0.6,            // Analytics is lighter
  campaign_std_to_v8: 0.8,   // Campaign modernization
  custom: 1.2,               // Unknown = higher estimate
};

/** AEM version distance multiplier — older = more work */
const VERSION_MULTIPLIER: Record<string, number> = {
  '6.1': 1.6,  // Very old, many deprecated APIs
  '6.2': 1.4,
  '6.3': 1.2,
  '6.4': 1.1,
  '6.5': 1.0,  // Most current on-prem
  'ams': 0.85, // Already partially cloud-ready
};

/** Compliance adds overhead: additional hours per requirement */
const COMPLIANCE_HOURS: Record<string, number> = {
  gdpr: 120,
  hipaa: 240,
  pci_dss: 160,
  sox: 200,
  fedramp: 320,
};

/** Black Hole platform fee by company size */
const PLATFORM_FEE: Record<CompanySize, number> = {
  mid_market: 45_000,
  enterprise: 85_000,
  large_enterprise: 150_000,
};

/** Black Hole automation factor — how much SI time is eliminated */
const AUTOMATION_FACTOR = 0.4; // 60% reduction in SI hours

// ============================================================
// Cost Engine
// ============================================================

export class CostEngine {
  /**
   * Run a full cost calculation comparing traditional SI vs Black Hole.
   */
  calculate(inputs: CalculatorInputs): CalculationResult {
    const traditional = this.calculateTraditional(inputs);
    const blackHole = this.calculateBlackHole(inputs);
    const timeline = this.calculateTimeline(inputs);
    const savings = this.calculateSavings(traditional, blackHole, timeline);
    const roi = this.calculateROI(inputs, savings, timeline);
    const risk = this.calculateRisk(inputs);

    return {
      inputs,
      traditional,
      blackHole,
      timeline,
      savings,
      roi,
      risk,
    };
  }

  /**
   * Traditional SI cost breakdown.
   * Based on phase durations, team sizes, and blended hourly rates.
   */
  calculateTraditional(inputs: CalculatorInputs): CostBreakdown {
    const rate = HOURLY_RATES[inputs.companySize];
    const complexity = MIGRATION_COMPLEXITY[inputs.migrationType];
    const versionMult = VERSION_MULTIPLIER[inputs.currentAEMVersion] ?? 1.0;

    // Assessment phase: 4-8 weeks, 3-5 person team, 40hrs/week
    const assessmentWeeks = Math.ceil(4 + (inputs.numberOfSites / 50) * 4);
    const assessmentTeam = inputs.companySize === 'large_enterprise' ? 5 : 3;
    const assessment = assessmentWeeks * assessmentTeam * 40 * rate;

    // Code modernization: per-component effort
    // Average 8-24 hours per component depending on complexity
    const hoursPerComponent = 12 * complexity * versionMult;
    const codeModernization = inputs.numberOfCustomComponents * hoursPerComponent * rate;

    // Content migration: DAM assets + pages
    // ~0.5 hours per 1000 assets for setup/validation + storage transfer time
    const assetHours = (inputs.numberOfAssets * 0.5) + (inputs.assetSizeGB * 0.2);
    const contentMigration = assetHours * rate * complexity;

    // Integration reconnection: 40-120 hours per integration
    const hoursPerIntegration = 60 * complexity;
    const integrationWork = inputs.numberOfIntegrations * hoursPerIntegration * rate;

    // Testing: 4-8 weeks, 2-4 person team
    const testWeeks = Math.ceil(4 + (inputs.numberOfSites / 100) * 4);
    const testTeam = inputs.companySize === 'large_enterprise' ? 4 : 2;
    const testing = testWeeks * testTeam * 40 * rate;

    // PM overhead: 15% of all other costs
    const subtotal = assessment + codeModernization + contentMigration + integrationWork + testing;
    const projectManagement = subtotal * 0.15;

    // Compliance hours
    const complianceHours = inputs.complianceRequirements.reduce(
      (sum, req) => sum + (COMPLIANCE_HOURS[req] ?? 100),
      0,
    );
    const complianceCost = complianceHours * rate;

    // Contingency: 35% of total (industry standard for SI projects)
    const preContingency = subtotal + projectManagement + complianceCost;
    const contingency = preContingency * 0.35;

    return {
      assessment: Math.round(assessment),
      codeModernization: Math.round(codeModernization),
      contentMigration: Math.round(contentMigration),
      integrationWork: Math.round(integrationWork),
      testing: Math.round(testing + complianceCost),
      projectManagement: Math.round(projectManagement),
      contingency: Math.round(contingency),
      total: Math.round(preContingency + contingency),
    };
  }

  /**
   * Black Hole cost breakdown.
   * Platform fee + reduced SI hours through automation.
   */
  calculateBlackHole(inputs: CalculatorInputs): CostBreakdown {
    const traditional = this.calculateTraditional(inputs);
    const platformFee = PLATFORM_FEE[inputs.companySize];

    // Black Hole automates assessment — 80% reduction
    const assessment = Math.round(traditional.assessment * 0.2) + platformFee;

    // Code modernization — 55% reduction (auto-transform + BPA)
    const codeModernization = Math.round(traditional.codeModernization * AUTOMATION_FACTOR);

    // Content migration — 70% reduction (bulk automated transfer)
    const contentMigration = Math.round(traditional.contentMigration * 0.3);

    // Integration — 50% reduction (template-based reconnection)
    const integrationWork = Math.round(traditional.integrationWork * 0.5);

    // Testing — 60% reduction (simulation-driven validation)
    const testing = Math.round(traditional.testing * 0.4);

    // PM — 40% reduction (orchestrated workflow)
    const projectManagement = Math.round(traditional.projectManagement * 0.6);

    // No contingency needed — simulation + self-healing prevents overruns
    const contingency = 0;

    const total = assessment + codeModernization + contentMigration
      + integrationWork + testing + projectManagement + contingency;

    return {
      assessment,
      codeModernization,
      contentMigration,
      integrationWork,
      testing,
      projectManagement,
      contingency,
      total,
    };
  }

  /**
   * Timeline comparison: phase-by-phase duration for both approaches.
   */
  calculateTimeline(inputs: CalculatorInputs): TimelineComparison {
    const complexity = MIGRATION_COMPLEXITY[inputs.migrationType];
    const versionMult = VERSION_MULTIPLIER[inputs.currentAEMVersion] ?? 1.0;
    const scale = 1 + (inputs.numberOfSites / 200);

    const phases: PhaseBreakdown[] = [
      {
        name: 'Assessment & Discovery',
        traditionalWeeks: Math.ceil((6 * complexity * scale)),
        traditionalCost: 0, // filled below
        blackHoleWeeks: Math.ceil(2 * complexity),
        blackHoleCost: 0,
      },
      {
        name: 'Planning & Architecture',
        traditionalWeeks: Math.ceil(4 * complexity * scale),
        traditionalCost: 0,
        blackHoleWeeks: Math.ceil(2 * complexity),
        blackHoleCost: 0,
      },
      {
        name: 'Code Modernization',
        traditionalWeeks: Math.ceil(8 * complexity * versionMult * scale),
        traditionalCost: 0,
        blackHoleWeeks: Math.ceil(3 * complexity * versionMult),
        blackHoleCost: 0,
      },
      {
        name: 'Content Migration',
        traditionalWeeks: Math.ceil(6 * complexity * scale),
        traditionalCost: 0,
        blackHoleWeeks: Math.ceil(2 * complexity),
        blackHoleCost: 0,
      },
      {
        name: 'Integration & Reconnection',
        traditionalWeeks: Math.ceil(4 * complexity * (1 + inputs.numberOfIntegrations / 20)),
        traditionalCost: 0,
        blackHoleWeeks: Math.ceil(2 * complexity * (1 + inputs.numberOfIntegrations / 40)),
        blackHoleCost: 0,
      },
      {
        name: 'Testing & Validation',
        traditionalWeeks: Math.ceil(6 * complexity * scale),
        traditionalCost: 0,
        blackHoleWeeks: Math.ceil(2 * complexity),
        blackHoleCost: 0,
      },
      {
        name: 'Cutover & Go-Live',
        traditionalWeeks: 2,
        traditionalCost: 0,
        blackHoleWeeks: 1,
        blackHoleCost: 0,
      },
    ];

    // Distribute costs across phases proportionally
    const traditional = this.calculateTraditional(inputs);
    const blackHole = this.calculateBlackHole(inputs);
    const traditionalTotalWeeks = phases.reduce((s, p) => s + p.traditionalWeeks, 0);
    const blackHoleTotalWeeks = phases.reduce((s, p) => s + p.blackHoleWeeks, 0);

    // Assign costs proportional to duration
    for (const phase of phases) {
      phase.traditionalCost = Math.round(
        traditional.total * (phase.traditionalWeeks / traditionalTotalWeeks),
      );
      phase.blackHoleCost = Math.round(
        blackHole.total * (phase.blackHoleWeeks / blackHoleTotalWeeks),
      );
    }

    return {
      phases,
      traditionalTotalWeeks,
      blackHoleTotalWeeks,
      weeksSaved: traditionalTotalWeeks - blackHoleTotalWeeks,
    };
  }

  /**
   * Savings breakdown comparing the two approaches.
   */
  private calculateSavings(
    traditional: CostBreakdown,
    blackHole: CostBreakdown,
    timeline: TimelineComparison,
  ): SavingsBreakdown {
    const costSaved = traditional.total - blackHole.total;
    const costSavingsPercent = Math.round((costSaved / traditional.total) * 100);
    const timeSavedWeeks = timeline.weeksSaved;
    const timeSavingsPercent = Math.round(
      (timeSavedWeeks / timeline.traditionalTotalWeeks) * 100,
    );

    return {
      costSaved,
      costSavingsPercent,
      timeSavedWeeks,
      timeSavingsPercent,
      riskReductionPercent: 50, // Consistent risk reduction through simulation
    };
  }

  /**
   * ROI projection based on faster time-to-value.
   */
  calculateROI(
    inputs: CalculatorInputs,
    savings: SavingsBreakdown,
    timeline: TimelineComparison,
  ): ROIProjection {
    // Estimated daily revenue impact of delayed migration
    const dailyRevenueLookup: Record<CompanySize, number> = {
      mid_market: 5_000,
      enterprise: 15_000,
      large_enterprise: 50_000,
    };

    const dailyDelayedRevenue = dailyRevenueLookup[inputs.companySize];
    const daysSaved = savings.timeSavedWeeks * 7;
    const additionalRevenue = dailyDelayedRevenue * daysSaved;

    // Payback: how many days until the Black Hole cost is recouped
    const blackHoleCost = this.calculateBlackHole(inputs).total;
    const paybackPeriodDays = Math.ceil(blackHoleCost / dailyDelayedRevenue);

    return {
      dailyDelayedRevenue,
      additionalRevenue,
      paybackPeriodDays,
    };
  }

  /**
   * Risk comparison: probability of overruns.
   */
  calculateRisk(inputs: CalculatorInputs): RiskComparison {
    // Traditional overrun risk increases with complexity
    const complexity = MIGRATION_COMPLEXITY[inputs.migrationType];
    const versionMult = VERSION_MULTIPLIER[inputs.currentAEMVersion] ?? 1.0;
    const complianceCount = inputs.complianceRequirements.length;
    const scaleRisk = Math.min(inputs.numberOfSites / 200, 1);

    // Base 45% overrun probability, scales with complexity factors
    const baseTraditionalRisk = 0.45;
    const traditionalOverrunPercent = Math.min(
      Math.round(
        (baseTraditionalRisk + scaleRisk * 0.15 + complianceCount * 0.05)
        * complexity * versionMult * 100,
      ),
      85,
    );

    // Black Hole: simulation catches issues before they cause overruns
    const blackHoleOverrunPercent = Math.min(
      Math.round(10 + complianceCount * 2 + scaleRisk * 3),
      20,
    );

    // Budget overrun percentages (how much over budget)
    const traditionalBudgetOverrunPercent = Math.round(traditionalOverrunPercent * 0.6);
    const blackHoleBudgetOverrunPercent = Math.round(blackHoleOverrunPercent * 0.3);

    return {
      traditionalOverrunPercent,
      blackHoleOverrunPercent,
      traditionalBudgetOverrunPercent,
      blackHoleBudgetOverrunPercent,
    };
  }
}

/** Singleton for convenience */
export const costEngine = new CostEngine();
