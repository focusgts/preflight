/**
 * Migration Cost Calculator — Type Definitions
 *
 * All types for the public-facing cost calculator that demonstrates
 * savings from Black Hole vs traditional SI engagement.
 */

// ============================================================
// Input Types
// ============================================================

export type CalcMigrationType =
  | 'aem_onprem_to_cloud'
  | 'aem_ams_to_cloud'
  | 'wordpress_to_aem'
  | 'sitecore_to_aem'
  | 'ga_to_cja'
  | 'campaign_std_to_v8'
  | 'custom';

export type CompanySize = 'mid_market' | 'enterprise' | 'large_enterprise';

export type ComplianceRequirement =
  | 'gdpr'
  | 'hipaa'
  | 'pci_dss'
  | 'sox'
  | 'fedramp';

export type AEMVersion = '6.1' | '6.2' | '6.3' | '6.4' | '6.5' | 'ams';

export interface CalculatorInputs {
  migrationType: CalcMigrationType;
  numberOfSites: number;
  numberOfCustomComponents: number;
  numberOfAssets: number; // in thousands
  assetSizeGB: number;
  numberOfIntegrations: number;
  complianceRequirements: ComplianceRequirement[];
  currentAEMVersion: AEMVersion;
  companySize: CompanySize;
}

// ============================================================
// Output Types
// ============================================================

export interface PhaseBreakdown {
  name: string;
  traditionalWeeks: number;
  traditionalCost: number;
  blackHoleWeeks: number;
  blackHoleCost: number;
}

export interface CostBreakdown {
  assessment: number;
  codeModernization: number;
  contentMigration: number;
  integrationWork: number;
  testing: number;
  projectManagement: number;
  contingency: number;
  total: number;
}

export interface TimelineComparison {
  phases: PhaseBreakdown[];
  traditionalTotalWeeks: number;
  blackHoleTotalWeeks: number;
  weeksSaved: number;
}

export interface SavingsBreakdown {
  costSaved: number;
  costSavingsPercent: number;
  timeSavedWeeks: number;
  timeSavingsPercent: number;
  riskReductionPercent: number;
}

export interface ROIProjection {
  dailyDelayedRevenue: number;
  additionalRevenue: number;
  paybackPeriodDays: number;
}

export interface RiskComparison {
  traditionalOverrunPercent: number;
  blackHoleOverrunPercent: number;
  traditionalBudgetOverrunPercent: number;
  blackHoleBudgetOverrunPercent: number;
}

export interface CalculationResult {
  inputs: CalculatorInputs;
  traditional: CostBreakdown;
  blackHole: CostBreakdown;
  timeline: TimelineComparison;
  savings: SavingsBreakdown;
  roi: ROIProjection;
  risk: RiskComparison;
}
