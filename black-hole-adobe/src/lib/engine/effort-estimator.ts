/**
 * Effort Estimation Engine (ADR-032)
 *
 * Translates assessment findings into developer-weeks and dollar estimates.
 * This is the #1 feature gap in migration tooling -- no existing tool
 * (BPA, CAM, or SI methodology) provides automated effort estimation.
 *
 * Inputs: AssessmentResult (findings, scores, content health, integrations)
 * Outputs: EffortEstimate (dev-weeks, cost range, timeline, top drivers)
 */

import type {
  AssessmentResult,
  AssessmentFinding,
  MigrationProject,
} from '@/types';

// ============================================================
// Types
// ============================================================

export interface EffortRange {
  min: number;
  max: number;
}

export interface CostRange {
  min: number;
  max: number;
  minPremium: number;
  maxPremium: number;
  blendedRate: number;
  premiumRate: number;
}

export interface TeamTimeline {
  twoPersonTeam: number;
  fourPersonTeam: number;
  sixPersonTeam: number;
}

export interface EffortDriver {
  category: string;
  label: string;
  instanceCount: number;
  effortDays: EffortRange;
  percentOfTotal: number;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  instanceCount: number;
  effortDaysPerInstance: EffortRange;
  totalEffortDays: EffortRange;
  findings: string[];
}

export interface IndustryComparison {
  industryAvgWeeks: number;
  industryAvgCost: number;
  blackHoleWeeks: EffortRange;
  blackHoleCost: CostRange;
  weeksSaved: number;
  costSaved: number;
  savingsPercent: number;
}

export interface EffortEstimate {
  migrationProjectId: string;
  assessmentId: string | null;
  totalDevWeeks: EffortRange;
  totalDevDays: EffortRange;
  costRange: CostRange;
  timeline: TeamTimeline;
  topEffortDrivers: EffortDriver[];
  confidence: number;
  confidenceLevel: 'preliminary' | 'detailed' | 'high-confidence';
  breakdown: CategoryBreakdown[];
  industryComparison: IndustryComparison;
  testingOverhead: EffortRange;
  complexityMultiplier: number;
  dataSource: 'external-scan' | 'assessment' | 'full-codebase' | 'metadata-only';
  generatedAt: string;
}

export interface EstimateOptions {
  /** Blended hourly rate for cost calculation (default: $200) */
  blendedRate?: number;
  /** Premium hourly rate for cost calculation (default: $350) */
  premiumRate?: number;
  /** Override team size for timeline calculation */
  teamSize?: number;
  /** Additional compliance overhead factor (0-1) */
  complianceOverhead?: number;
  /** Content volume in pages (overrides assessment data) */
  contentPages?: number;
  /** Number of custom OSGi bundles (overrides assessment data) */
  osgiBundleCount?: number;
  /** Number of integrations (overrides assessment data) */
  integrationCount?: number;
  /** Number of sites/tenants */
  siteCount?: number;
  /** Data confidence source */
  dataSource?: 'external-scan' | 'assessment' | 'full-codebase' | 'metadata-only';
}

// ============================================================
// Finding-to-Effort Mapping (ADR-032 Section 1)
// ============================================================

/**
 * Each finding category maps to an effort range in developer-days per instance.
 * These are calibrated from industry data across SI engagements.
 */
const FINDING_EFFORT_MAP: Record<string, { min: number; max: number; label: string }> = {
  // Code-level findings
  'deprecated-api':           { min: 0.5, max: 2,   label: 'Deprecated API Remediation' },
  'osgi-config':              { min: 1,   max: 3,   label: 'OSGi Configuration Migration' },
  'static-template':          { min: 1,   max: 3,   label: 'Template Migration (Static to Editable)' },
  'template-type':            { min: 1,   max: 3,   label: 'Template Type Conversion' },

  // Structural findings
  'component-rewrite':        { min: 2,   max: 5,   label: 'Component Migration/Rewrite' },
  'content-restructure':      { min: 1,   max: 5,   label: 'Content Restructuring' },
  'content-mapping':          { min: 1,   max: 4,   label: 'Content Mapping & Transformation' },

  // Integration findings
  'integration-rewrite':      { min: 2,   max: 8,   label: 'Integration Reconnection/Rewrite' },
  'replication':              { min: 1,   max: 3,   label: 'Replication to Distribution Migration' },

  // Configuration findings
  'dispatcher':               { min: 1,   max: 3,   label: 'Dispatcher Rules Migration' },
  'cloud-manager':            { min: 0.5, max: 2,   label: 'Cloud Manager Pipeline Setup' },

  // Workflow findings
  'workflow-migration':       { min: 2,   max: 4,   label: 'Workflow Migration' },
  'delivery-template-update': { min: 1,   max: 3,   label: 'Delivery Template Update' },
  'schema-update':            { min: 1,   max: 3,   label: 'Schema Update' },

  // Index findings
  'index-conversion':         { min: 0.5, max: 1,   label: 'Oak Index Conversion' },

  // Platform migration findings (non-AEM)
  'plugin-replacement':       { min: 1,   max: 4,   label: 'Plugin/Module Replacement' },
  'module-replacement':       { min: 1,   max: 4,   label: 'Module Replacement' },
  'theme-conversion':         { min: 2,   max: 5,   label: 'Theme/Storefront Conversion' },
  'rendering-engine':         { min: 2,   max: 6,   label: 'Rendering Engine Migration' },
  'personalization-migration': { min: 1,  max: 4,   label: 'Personalization Migration' },
  'taxonomy-migration':       { min: 1,   max: 3,   label: 'Taxonomy Migration' },

  // Analytics findings
  'tag-migration':            { min: 0.5, max: 2,   label: 'Tag Migration' },
  'report-suite-setup':       { min: 1,   max: 3,   label: 'Report Suite Setup' },
  'evar-prop-mapping':        { min: 0.5, max: 2,   label: 'eVar/Prop Mapping' },
  'data-view-setup':          { min: 1,   max: 3,   label: 'Data View Setup' },
  'data-view-migration':      { min: 1,   max: 2,   label: 'Data View Migration' },
  'schema-mapping':           { min: 1,   max: 4,   label: 'Schema Mapping' },
  'connection-config':        { min: 0.5, max: 2,   label: 'Connection Configuration' },
  'calculated-metric-conversion': { min: 0.5, max: 1.5, label: 'Calculated Metric Conversion' },

  // Campaign findings
  'js-api-update':            { min: 1,   max: 3,   label: 'JavaScript API Update' },
  'fda-migration':            { min: 2,   max: 5,   label: 'FDA Migration' },
  'journey-mapping':          { min: 2,   max: 6,   label: 'Journey Mapping' },
  'data-extension-migration': { min: 1,   max: 4,   label: 'Data Extension Migration' },
  'ampscript-conversion':     { min: 1,   max: 3,   label: 'AMPscript Conversion' },

  // CDP/DMP findings
  'trait-to-segment':         { min: 0.5, max: 2,   label: 'Trait to Segment Migration' },
  'destination-migration':    { min: 1,   max: 3,   label: 'Destination Migration' },
  'identity-resolution':      { min: 2,   max: 5,   label: 'Identity Resolution Setup' },
  'identity-setup':           { min: 2,   max: 5,   label: 'Identity Namespace Setup' },
  'source-connector-config':  { min: 1,   max: 3,   label: 'Source Connector Configuration' },

  // Commerce findings
  'catalog-migration':        { min: 2,   max: 5,   label: 'Product Catalog Migration' },
  'checkout-customization':   { min: 2,   max: 6,   label: 'Checkout Customization' },
  'cartridge-migration':      { min: 2,   max: 5,   label: 'Cartridge Migration' },
  'pipeline-conversion':      { min: 1,   max: 4,   label: 'Pipeline Conversion' },
  'storefront-rewrite':       { min: 3,   max: 8,   label: 'Storefront Rewrite' },

  // DAM findings
  'metadata-mapping':         { min: 0.5, max: 2,   label: 'Metadata Mapping' },
  'rendition-profiles':       { min: 0.5, max: 1.5, label: 'Rendition Profile Configuration' },
  'folder-structure':         { min: 0.5, max: 2,   label: 'Folder Structure Migration' },

  // Project management findings
  'project-structure-mapping': { min: 1,  max: 3,   label: 'Project Structure Mapping' },
  'custom-field-migration':   { min: 0.5, max: 2,   label: 'Custom Field Migration' },
  'workflow-mapping':         { min: 1,   max: 3,   label: 'Workflow Mapping' },

  // Testing/optimization
  'experiment-migration':     { min: 1,   max: 3,   label: 'Experiment Migration' },
  'audience-mapping':         { min: 0.5, max: 2,   label: 'Audience Mapping' },
  'implementation-update':    { min: 1,   max: 3,   label: 'Implementation Update' },

  // Marketing automation
  'form-migration':           { min: 0.5, max: 2,   label: 'Form Migration' },
  'lead-scoring-setup':       { min: 1,   max: 3,   label: 'Lead Scoring Setup' },

  // Generic fallback
  'general-compatibility':    { min: 1,   max: 3,   label: 'General Compatibility Fix' },
  'configuration-review':     { min: 0.5, max: 2,   label: 'Configuration Review & Update' },
};

// ============================================================
// Complexity Multipliers (ADR-032 Section 2)
// ============================================================

function getOsgiBundleMultiplier(count: number): number {
  if (count <= 10) return 1.0;
  if (count <= 50) return 1.5;
  return 2.0;
}

function getContentVolumeMultiplier(pageCount: number): number {
  if (pageCount < 100_000) return 1.0;
  if (pageCount <= 500_000) return 1.3;
  return 1.8;
}

function getIntegrationMultiplier(count: number): number {
  if (count <= 5) return 1.0;
  if (count <= 15) return 1.5;
  return 2.5;
}

function getMultiSiteMultiplier(siteCount: number): number {
  if (siteCount <= 1) return 1.0;
  if (siteCount <= 5) return 1.3;
  return 1.8;
}

// ============================================================
// Confidence Scoring (ADR-032 Section 3)
// ============================================================

function computeConfidence(
  dataSource: 'external-scan' | 'assessment' | 'full-codebase' | 'metadata-only',
  findingCount: number,
): { confidence: number; level: 'preliminary' | 'detailed' | 'high-confidence' } {
  switch (dataSource) {
    case 'metadata-only':
      return {
        confidence: Math.min(50, 35 + Math.min(findingCount, 15)),
        level: 'preliminary',
      };
    case 'external-scan':
      // 40-60% confidence depending on finding count
      return {
        confidence: Math.min(60, 40 + Math.min(findingCount, 20)),
        level: 'preliminary',
      };
    case 'assessment':
      // 70-85% confidence depending on finding richness
      return {
        confidence: Math.min(85, 70 + Math.min(findingCount / 2, 15)),
        level: 'detailed',
      };
    case 'full-codebase':
      // 85-95% confidence
      return {
        confidence: Math.min(95, 85 + Math.min(findingCount / 5, 10)),
        level: 'high-confidence',
      };
  }
}

// ============================================================
// Effort Estimation Engine
// ============================================================

export class EffortEstimator {
  private readonly defaultBlendedRate = 200;
  private readonly defaultPremiumRate = 350;
  private readonly testingOverheadPercent = { min: 0.20, max: 0.30 };

  /**
   * Generate an effort estimate from an assessment result.
   */
  estimate(
    assessment: AssessmentResult,
    migrationProjectId: string,
    options: EstimateOptions = {},
    migration?: MigrationProject,
  ): EffortEstimate {
    const blendedRate = options.blendedRate ?? this.defaultBlendedRate;
    const premiumRate = options.premiumRate ?? this.defaultPremiumRate;

    // Determine data source and confidence
    const dataSource = options.dataSource ?? this.inferDataSource(assessment);
    const { confidence, level } = computeConfidence(dataSource, assessment.findings.length);

    // Step 1: Aggregate findings by category
    const categoryMap = this.aggregateFindings(assessment.findings);

    // Step 2: Calculate per-category effort
    const breakdown = this.calculateBreakdown(categoryMap);

    // Step 3: Sum base effort
    const baseMinDays = breakdown.reduce((s, b) => s + b.totalEffortDays.min, 0);
    const baseMaxDays = breakdown.reduce((s, b) => s + b.totalEffortDays.max, 0);

    // Step 4: Apply complexity multipliers
    const complexityMultiplier = this.calculateComplexityMultiplier(assessment, options);

    const adjustedMinDays = baseMinDays * complexityMultiplier;
    const adjustedMaxDays = baseMaxDays * complexityMultiplier;

    // Step 5: Add testing overhead (20-30% of total dev effort)
    const testingMin = adjustedMinDays * this.testingOverheadPercent.min;
    const testingMax = adjustedMaxDays * this.testingOverheadPercent.max;

    let totalMinDays = adjustedMinDays + testingMin;
    let totalMaxDays = adjustedMaxDays + testingMax;

    // Baseline floor: when findings are sparse (e.g., deterministic metadata-only
    // generation produced only a handful), anchor to canonical industry baselines
    // for the migration type so buyers see realistic numbers. We merge with the
    // findings-based estimate by taking the max of each bound.
    const migrationType = migration?.migrationType ?? '';
    const productCount = Math.max(1, migration?.productsInScope?.length ?? 1);
    const baseline = this.getBaselineWeeks(migrationType);
    const baselineApplies = migrationType.toLowerCase().includes('aem');
    const productScale = 1 + (productCount - 1) * 0.15;
    const baselineMinDays = baseline.minWeeks * 5 * productScale;
    const baselineMaxDays = baseline.maxWeeks * 5 * productScale;
    const usedBaseline = baselineApplies && totalMinDays < baselineMinDays;
    if (usedBaseline) {
      totalMinDays = Math.max(totalMinDays, baselineMinDays);
      totalMaxDays = Math.max(totalMaxDays, baselineMaxDays);
    }

    // Convert to weeks (5 working days per week)
    const totalDevWeeks: EffortRange = {
      min: Math.max(1, Math.round(totalMinDays / 5)),
      max: Math.max(2, Math.round(totalMaxDays / 5)),
    };

    const totalDevDays: EffortRange = {
      min: Math.round(totalMinDays),
      max: Math.round(totalMaxDays),
    };

    // Step 6: Calculate cost range
    const hoursPerDay = 8;
    const minDevHours = totalMinDays * hoursPerDay;
    const maxDevHours = totalMaxDays * hoursPerDay;
    const costRange: CostRange = {
      min: Math.round(minDevHours * blendedRate),
      max: Math.round(maxDevHours * blendedRate),
      minPremium: Math.round(minDevHours * premiumRate),
      maxPremium: Math.round(maxDevHours * premiumRate),
      blendedRate,
      premiumRate,
    };

    // Step 7: Calculate team timelines (in weeks)
    const avgDays = (totalMinDays + totalMaxDays) / 2;
    const timeline: TeamTimeline = {
      twoPersonTeam: Math.ceil(avgDays / (2 * 5)),
      fourPersonTeam: Math.ceil(avgDays / (4 * 5)),
      sixPersonTeam: Math.ceil(avgDays / (6 * 5)),
    };

    // Step 8: Top effort drivers
    let topEffortDrivers = this.computeTopDrivers(breakdown, totalMinDays + totalMaxDays);

    // If baseline was applied (sparse findings), distribute the baseline-backed
    // total across canonical categories so drivers are non-zero and meaningful.
    if (usedBaseline) {
      const distribution = this.getCanonicalDistribution(migrationType);
      topEffortDrivers = distribution.map(d => ({
        category: d.category,
        label: d.label,
        instanceCount: 1,
        effortDays: {
          min: Math.round(totalMinDays * d.percent),
          max: Math.round(totalMaxDays * d.percent),
        },
        percentOfTotal: Math.round(d.percent * 100),
      }));
    }

    // Step 9: Industry comparison
    const industryComparison = this.computeIndustryComparison(totalDevWeeks, costRange);

    // Step 10: Apply complexity multiplier to breakdown
    for (const item of breakdown) {
      item.totalEffortDays.min = Math.round(item.totalEffortDays.min * complexityMultiplier);
      item.totalEffortDays.max = Math.round(item.totalEffortDays.max * complexityMultiplier);
    }

    return {
      migrationProjectId,
      assessmentId: assessment.id,
      totalDevWeeks,
      totalDevDays,
      costRange,
      timeline,
      topEffortDrivers,
      confidence,
      confidenceLevel: level,
      breakdown,
      industryComparison,
      testingOverhead: {
        min: Math.round(testingMin),
        max: Math.round(testingMax),
      },
      complexityMultiplier: Math.round(complexityMultiplier * 100) / 100,
      dataSource,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a preliminary estimate without a full assessment.
   * Uses migration metadata to produce a rough effort estimate.
   */
  estimateFromMetadata(
    migration: MigrationProject,
    options: EstimateOptions = {},
  ): EffortEstimate {
    const blendedRate = options.blendedRate ?? this.defaultBlendedRate;
    const premiumRate = options.premiumRate ?? this.defaultPremiumRate;

    // Derive rough parameters from migration metadata
    const componentCount = (migration.sourceEnvironment.metadata?.componentCount as number) ?? 50;
    const pageCount = options.contentPages ?? (migration.sourceEnvironment.metadata?.pageCount as number) ?? 500;
    const integrationCount = options.integrationCount ?? (migration.sourceEnvironment.metadata?.integrationCount as number) ?? 5;
    const siteCount = options.siteCount ?? (migration.sourceEnvironment.metadata?.siteCount as number) ?? 1;

    // Baseline floors per migration type — calibrated against real-world enterprise engagements.
    // Without real findings, a tiny synthetic estimate would mislead buyers, so we anchor to
    // known industry ranges and scale by productsInScope as a proxy for engagement breadth.
    const migrationType = migration.migrationType ?? '';
    const productCount = Math.max(1, migration.productsInScope?.length ?? 1);
    const baseline = this.getBaselineWeeks(migrationType);
    const productScale = 1 + (productCount - 1) * 0.15; // each extra product adds ~15%

    const baselineMinDays = baseline.minWeeks * 5 * productScale;
    const baselineMaxDays = baseline.maxWeeks * 5 * productScale;

    // Build synthetic findings based on component count
    // Average 1.5 findings per component for AEM migrations
    const syntheticFindingCount = Math.max(5, Math.round(componentCount * 1.5));

    // Base effort: 2-4 dev-days per synthetic finding (mid-range), floored to baseline
    const baseMinDays = Math.max(baselineMinDays, syntheticFindingCount * 1.5);
    const baseMaxDays = Math.max(baselineMaxDays, syntheticFindingCount * 3.5);

    // Apply complexity multipliers
    const osgiBundleCount = options.osgiBundleCount ?? Math.round(componentCount * 0.3);
    const osgiMult = getOsgiBundleMultiplier(osgiBundleCount);
    const contentMult = getContentVolumeMultiplier(pageCount);
    const integrationMult = getIntegrationMultiplier(integrationCount);
    const siteMult = getMultiSiteMultiplier(siteCount);

    const complexityMultiplier = Math.max(
      1.0,
      (osgiMult + contentMult + integrationMult + siteMult) / 4,
    );

    const adjustedMin = baseMinDays * complexityMultiplier;
    const adjustedMax = baseMaxDays * complexityMultiplier;

    // Testing overhead
    const testMin = adjustedMin * this.testingOverheadPercent.min;
    const testMax = adjustedMax * this.testingOverheadPercent.max;

    const totalMin = adjustedMin + testMin;
    const totalMax = adjustedMax + testMax;

    const totalDevWeeks: EffortRange = {
      min: Math.max(1, Math.round(totalMin / 5)),
      max: Math.max(2, Math.round(totalMax / 5)),
    };

    const totalDevDays: EffortRange = {
      min: Math.round(totalMin),
      max: Math.round(totalMax),
    };

    const hoursPerDay = 8;
    const minDevHours = totalMin * hoursPerDay;
    const maxDevHours = totalMax * hoursPerDay;
    const costRange: CostRange = {
      min: Math.round(minDevHours * blendedRate),
      max: Math.round(maxDevHours * blendedRate),
      minPremium: Math.round(minDevHours * premiumRate),
      maxPremium: Math.round(maxDevHours * premiumRate),
      blendedRate,
      premiumRate,
    };

    const avgDays = (totalMin + totalMax) / 2;
    const timeline: TeamTimeline = {
      twoPersonTeam: Math.ceil(avgDays / (2 * 5)),
      fourPersonTeam: Math.ceil(avgDays / (4 * 5)),
      sixPersonTeam: Math.ceil(avgDays / (6 * 5)),
    };

    // Preliminary breakdown — distribute total across canonical categories for the migration type.
    // This guarantees non-zero drivers even when no real findings are available.
    const distribution = this.getCanonicalDistribution(migrationType);
    const breakdown: CategoryBreakdown[] = distribution.map(d => ({
      category: d.category,
      label: d.label,
      instanceCount: 1,
      effortDaysPerInstance: { min: 0, max: 0 },
      totalEffortDays: {
        min: Math.round(totalMin * d.percent),
        max: Math.round(totalMax * d.percent),
      },
      findings: [],
    }));

    const topEffortDrivers: EffortDriver[] = breakdown
      .map(b => ({
        category: b.category,
        label: b.label,
        instanceCount: b.instanceCount,
        effortDays: b.totalEffortDays,
        percentOfTotal: 0,
      }))
      .sort((a, b) => (b.effortDays.max - a.effortDays.max));

    // Calculate percentages
    const totalEffortSum = topEffortDrivers.reduce((s, d) => s + d.effortDays.min + d.effortDays.max, 0);
    for (const driver of topEffortDrivers) {
      driver.percentOfTotal = totalEffortSum > 0
        ? Math.round(((driver.effortDays.min + driver.effortDays.max) / totalEffortSum) * 100)
        : 0;
    }

    const industryComparison = this.computeIndustryComparison(totalDevWeeks, costRange);

    return {
      migrationProjectId: migration.id,
      assessmentId: null,
      totalDevWeeks,
      totalDevDays,
      costRange,
      timeline,
      topEffortDrivers: topEffortDrivers.slice(0, 5),
      confidence: 45,
      confidenceLevel: 'preliminary',
      breakdown,
      industryComparison,
      testingOverhead: { min: Math.round(testMin), max: Math.round(testMax) },
      complexityMultiplier: Math.round(complexityMultiplier * 100) / 100,
      dataSource: options.dataSource ?? 'metadata-only',
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Baseline dev-week ranges for migration types when no real findings exist.
   * Calibrated against industry SI engagement data.
   */
  private getBaselineWeeks(migrationType: string): { minWeeks: number; maxWeeks: number } {
    const t = migrationType.toLowerCase();
    if (t.includes('aem') && (t.includes('cloud') || t.includes('onprem'))) {
      return { minWeeks: 20, maxWeeks: 52 };
    }
    if (t.includes('wordpress') && t.includes('aem')) {
      return { minWeeks: 8, maxWeeks: 20 };
    }
    if (t.includes('ga') && t.includes('cja')) {
      return { minWeeks: 4, maxWeeks: 10 };
    }
    // Default conservative baseline for any other migration type
    return { minWeeks: 6, maxWeeks: 16 };
  }

  /**
   * Canonical effort distribution by migration type. Percentages sum to 1.
   */
  private getCanonicalDistribution(migrationType: string): Array<{ category: string; label: string; percent: number }> {
    const t = migrationType.toLowerCase();
    if (t.includes('aem')) {
      return [
        { category: 'code-modernization',      label: 'Code Modernization',       percent: 0.30 },
        { category: 'content-migration',       label: 'Content Migration',        percent: 0.25 },
        { category: 'testing',                 label: 'Testing & QA',             percent: 0.20 },
        { category: 'integration-reconnection',label: 'Integration Reconnection', percent: 0.15 },
        { category: 'deployment',              label: 'Deployment & Cutover',     percent: 0.10 },
      ];
    }
    if (t.includes('ga') && t.includes('cja')) {
      return [
        { category: 'schema-mapping',     label: 'Schema Mapping',         percent: 0.35 },
        { category: 'data-view-setup',    label: 'Data View Setup',        percent: 0.25 },
        { category: 'report-rebuild',     label: 'Report Rebuild',         percent: 0.20 },
        { category: 'testing',            label: 'Testing & QA',           percent: 0.15 },
        { category: 'deployment',         label: 'Deployment & Cutover',   percent: 0.05 },
      ];
    }
    return [
      { category: 'code-modernization',      label: 'Code Modernization',       percent: 0.35 },
      { category: 'content-migration',       label: 'Content Migration',        percent: 0.25 },
      { category: 'integration-reconnection',label: 'Integration Reconnection', percent: 0.20 },
      { category: 'testing',                 label: 'Testing & QA',             percent: 0.15 },
      { category: 'deployment',              label: 'Deployment & Cutover',     percent: 0.05 },
    ];
  }

  private inferDataSource(
    assessment: AssessmentResult,
  ): 'external-scan' | 'assessment' | 'full-codebase' {
    const findingCount = assessment.findings.length;
    // Heuristic: more findings = deeper analysis
    if (findingCount > 50) return 'full-codebase';
    if (findingCount > 10) return 'assessment';
    return 'external-scan';
  }

  private aggregateFindings(
    findings: AssessmentFinding[],
  ): Map<string, { count: number; findingIds: string[] }> {
    const map = new Map<string, { count: number; findingIds: string[] }>();

    for (const finding of findings) {
      // Use subCategory for granular mapping, fall back to category
      const key = finding.subCategory || finding.category;
      const normalizedKey = key.toLowerCase().replace(/[\s_]+/g, '-');

      const existing = map.get(normalizedKey);
      if (existing) {
        existing.count++;
        existing.findingIds.push(finding.id);
      } else {
        map.set(normalizedKey, { count: 1, findingIds: [finding.id] });
      }
    }

    return map;
  }

  private calculateBreakdown(
    categoryMap: Map<string, { count: number; findingIds: string[] }>,
  ): CategoryBreakdown[] {
    const breakdown: CategoryBreakdown[] = [];

    for (const [category, { count, findingIds }] of categoryMap) {
      const effortDef = FINDING_EFFORT_MAP[category] ?? FINDING_EFFORT_MAP['general-compatibility']!;

      breakdown.push({
        category,
        label: effortDef.label,
        instanceCount: count,
        effortDaysPerInstance: { min: effortDef.min, max: effortDef.max },
        totalEffortDays: {
          min: Math.round(count * effortDef.min * 10) / 10,
          max: Math.round(count * effortDef.max * 10) / 10,
        },
        findings: findingIds,
      });
    }

    // Sort by max effort descending
    breakdown.sort((a, b) => b.totalEffortDays.max - a.totalEffortDays.max);

    return breakdown;
  }

  private calculateComplexityMultiplier(
    assessment: AssessmentResult,
    options: EstimateOptions,
  ): number {
    // Extract counts from assessment or options
    const osgiBundleCount = options.osgiBundleCount
      ?? assessment.findings.filter(f =>
        f.subCategory?.includes('osgi') || f.category?.includes('osgi'),
      ).length * 3; // Rough: each OSGi finding implies ~3 bundles

    const pageCount = options.contentPages
      ?? assessment.contentHealth.totalPages;

    const integrationCount = options.integrationCount
      ?? (assessment.integrationMap.length
        || assessment.findings.filter(f =>
          f.category?.includes('integration') || f.subCategory?.includes('integration'),
        ).length);

    const siteCount = options.siteCount ?? 1;

    const osgiMult = getOsgiBundleMultiplier(osgiBundleCount);
    const contentMult = getContentVolumeMultiplier(pageCount);
    const integrationMult = getIntegrationMultiplier(integrationCount);
    const siteMult = getMultiSiteMultiplier(siteCount);

    // Weighted average -- integration and OSGi weigh more
    const multiplier = (
      osgiMult * 0.3 +
      contentMult * 0.2 +
      integrationMult * 0.3 +
      siteMult * 0.2
    );

    // Apply compliance overhead if specified
    const complianceOverhead = options.complianceOverhead ?? 0;

    return Math.max(1.0, multiplier * (1 + complianceOverhead));
  }

  private computeTopDrivers(
    breakdown: CategoryBreakdown[],
    totalEffortSum: number,
  ): EffortDriver[] {
    return breakdown
      .slice(0, 5)
      .map(b => ({
        category: b.category,
        label: b.label,
        instanceCount: b.instanceCount,
        effortDays: b.totalEffortDays,
        percentOfTotal: totalEffortSum > 0
          ? Math.round(((b.totalEffortDays.min + b.totalEffortDays.max) / totalEffortSum) * 100)
          : 0,
      }));
  }

  private computeIndustryComparison(
    totalDevWeeks: EffortRange,
    costRange: CostRange,
  ): IndustryComparison {
    // Industry averages for enterprise AEM migration (ADR-032):
    // 26-52 dev-weeks, $500K-$2M with traditional SI. Use midpoints for scalars.
    const industryAvgWeeks = 39; // midpoint of 26-52
    const industryAvgCost = 1_250_000; // midpoint of $500K-$2M

    const blackHoleAvgWeeks = (totalDevWeeks.min + totalDevWeeks.max) / 2;
    const avgBlackHoleCost = (costRange.min + costRange.max) / 2;

    const weeksSaved = Math.max(0, Math.round(industryAvgWeeks - blackHoleAvgWeeks));
    const costSaved = Math.max(0, Math.round(industryAvgCost - avgBlackHoleCost));

    const savingsPercent = industryAvgCost > 0
      ? Math.round(((industryAvgCost - avgBlackHoleCost) / industryAvgCost) * 100)
      : 0;

    return {
      industryAvgWeeks,
      industryAvgCost,
      blackHoleWeeks: totalDevWeeks,
      blackHoleCost: costRange,
      weeksSaved,
      costSaved,
      savingsPercent: Math.max(0, Math.min(100, savingsPercent)),
    };
  }
}

/** Singleton for convenience */
export const effortEstimator = new EffortEstimator();
