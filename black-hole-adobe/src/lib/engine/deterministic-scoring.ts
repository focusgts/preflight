/**
 * Deterministic Scoring Helpers
 *
 * Generates consistent, reproducible scores from string inputs.
 * Used when real connector/extraction data is not available, so that
 * repeated assessments of the same org/migration produce identical results
 * instead of random numbers.
 */

import {
  Severity,
  CompatibilityLevel,
  MigrationType,
} from '@/types';
import type { AssessmentFinding, RiskFactor } from '@/types';

// ============================================================
// Core Hash Function
// ============================================================

/**
 * Generate a deterministic integer hash from a string.
 * Same input always produces the same output.
 */
export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic score in [min, max] from a seed string.
 * The same seed always yields the same score.
 */
export function deterministicScore(seed: string, min: number, max: number): number {
  const hash = hashString(seed);
  return min + (hash % (max - min + 1));
}

/**
 * Generate a deterministic float in [min, max] with one decimal place.
 */
export function deterministicFloat(seed: string, min: number, max: number): number {
  const hash = hashString(seed);
  const range = (max - min) * 10;
  const value = min + (hash % (range + 1)) / 10;
  return Math.round(value * 10) / 10;
}

// ============================================================
// Migration Type Complexity Profiles
// ============================================================

interface ComplexityProfile {
  codeBase: number;       // Base code score offset (higher = easier)
  contentBase: number;    // Base content score offset
  integrationBase: number;
  configBase: number;
  complianceBase: number;
  weeksFactor: number;    // Multiplier for timeline
  findingPatterns: string[];
}

const COMPLEXITY_PROFILES: Record<string, ComplexityProfile> = {
  [MigrationType.AEM_ONPREM_TO_CLOUD]: {
    codeBase: 60, contentBase: 70, integrationBase: 55, configBase: 60, complianceBase: 80,
    weeksFactor: 1.2,
    findingPatterns: ['deprecated-api', 'osgi-config', 'replication', 'static-template'],
  },
  [MigrationType.AEM_AMS_TO_CLOUD]: {
    codeBase: 70, contentBase: 75, integrationBase: 60, configBase: 70, complianceBase: 85,
    weeksFactor: 0.9,
    findingPatterns: ['osgi-config', 'dispatcher', 'cloud-manager'],
  },
  [MigrationType.AEM_VERSION_UPGRADE]: {
    codeBase: 75, contentBase: 80, integrationBase: 70, configBase: 75, complianceBase: 90,
    weeksFactor: 0.7,
    findingPatterns: ['deprecated-api', 'template-type'],
  },
  [MigrationType.AEM_TO_EDS]: {
    codeBase: 50, contentBase: 65, integrationBase: 45, configBase: 55, complianceBase: 75,
    weeksFactor: 1.5,
    findingPatterns: ['content-restructure', 'component-rewrite', 'integration-rewrite'],
  },
  [MigrationType.WORDPRESS_TO_AEM]: {
    codeBase: 55, contentBase: 60, integrationBase: 50, configBase: 65, complianceBase: 80,
    weeksFactor: 1.3,
    findingPatterns: ['content-mapping', 'plugin-replacement', 'theme-conversion'],
  },
  [MigrationType.SITECORE_TO_AEM]: {
    codeBase: 50, contentBase: 55, integrationBase: 45, configBase: 55, complianceBase: 75,
    weeksFactor: 1.6,
    findingPatterns: ['content-mapping', 'component-rewrite', 'rendering-engine', 'personalization-migration'],
  },
  [MigrationType.DRUPAL_TO_AEM]: {
    codeBase: 55, contentBase: 60, integrationBase: 50, configBase: 60, complianceBase: 80,
    weeksFactor: 1.3,
    findingPatterns: ['content-mapping', 'module-replacement', 'taxonomy-migration'],
  },
  [MigrationType.GA_TO_ADOBE_ANALYTICS]: {
    codeBase: 80, contentBase: 90, integrationBase: 60, configBase: 70, complianceBase: 85,
    weeksFactor: 0.6,
    findingPatterns: ['tag-migration', 'report-suite-setup', 'evar-prop-mapping'],
  },
  [MigrationType.GA_TO_CJA]: {
    codeBase: 80, contentBase: 90, integrationBase: 55, configBase: 65, complianceBase: 80,
    weeksFactor: 0.8,
    findingPatterns: ['data-view-setup', 'schema-mapping', 'connection-config'],
  },
  [MigrationType.ANALYTICS_TO_CJA]: {
    codeBase: 85, contentBase: 90, integrationBase: 65, configBase: 75, complianceBase: 85,
    weeksFactor: 0.5,
    findingPatterns: ['data-view-migration', 'calculated-metric-conversion'],
  },
  [MigrationType.CAMPAIGN_STD_TO_V8]: {
    codeBase: 70, contentBase: 80, integrationBase: 55, configBase: 65, complianceBase: 80,
    weeksFactor: 1.0,
    findingPatterns: ['workflow-migration', 'delivery-template-update', 'schema-update'],
  },
  [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: {
    codeBase: 60, contentBase: 75, integrationBase: 50, configBase: 60, complianceBase: 75,
    weeksFactor: 1.2,
    findingPatterns: ['workflow-migration', 'js-api-update', 'fda-migration'],
  },
  [MigrationType.SFMC_TO_ADOBE]: {
    codeBase: 50, contentBase: 60, integrationBase: 45, configBase: 55, complianceBase: 70,
    weeksFactor: 1.5,
    findingPatterns: ['journey-mapping', 'data-extension-migration', 'ampscript-conversion'],
  },
  [MigrationType.AAM_TO_RTCDP]: {
    codeBase: 75, contentBase: 85, integrationBase: 60, configBase: 70, complianceBase: 80,
    weeksFactor: 0.7,
    findingPatterns: ['trait-to-segment', 'destination-migration', 'identity-resolution'],
  },
  [MigrationType.COMPETITOR_CDP_TO_AEP]: {
    codeBase: 55, contentBase: 65, integrationBase: 45, configBase: 55, complianceBase: 75,
    weeksFactor: 1.4,
    findingPatterns: ['schema-mapping', 'identity-setup', 'source-connector-config'],
  },
  [MigrationType.SHOPIFY_TO_COMMERCE]: {
    codeBase: 60, contentBase: 70, integrationBase: 50, configBase: 60, complianceBase: 80,
    weeksFactor: 1.2,
    findingPatterns: ['catalog-migration', 'theme-conversion', 'checkout-customization'],
  },
  [MigrationType.SFCC_TO_COMMERCE]: {
    codeBase: 55, contentBase: 65, integrationBase: 45, configBase: 55, complianceBase: 75,
    weeksFactor: 1.5,
    findingPatterns: ['cartridge-migration', 'pipeline-conversion', 'storefront-rewrite'],
  },
  [MigrationType.DAM_TO_AEM_ASSETS]: {
    codeBase: 80, contentBase: 60, integrationBase: 65, configBase: 75, complianceBase: 85,
    weeksFactor: 0.8,
    findingPatterns: ['metadata-mapping', 'rendition-profiles', 'folder-structure'],
  },
  [MigrationType.JIRA_TO_WORKFRONT]: {
    codeBase: 85, contentBase: 85, integrationBase: 60, configBase: 70, complianceBase: 90,
    weeksFactor: 0.6,
    findingPatterns: ['project-structure-mapping', 'custom-field-migration', 'workflow-mapping'],
  },
  [MigrationType.OPTIMIZELY_TO_TARGET]: {
    codeBase: 75, contentBase: 85, integrationBase: 55, configBase: 65, complianceBase: 85,
    weeksFactor: 0.7,
    findingPatterns: ['experiment-migration', 'audience-mapping', 'implementation-update'],
  },
  [MigrationType.HUBSPOT_TO_MARKETO]: {
    codeBase: 70, contentBase: 75, integrationBase: 55, configBase: 65, complianceBase: 80,
    weeksFactor: 0.9,
    findingPatterns: ['workflow-migration', 'form-migration', 'lead-scoring-setup'],
  },
};

const DEFAULT_PROFILE: ComplexityProfile = {
  codeBase: 65, contentBase: 70, integrationBase: 55, configBase: 65, complianceBase: 80,
  weeksFactor: 1.0,
  findingPatterns: ['general-compatibility', 'configuration-review'],
};

// ============================================================
// AEM Version Penalty Map
// ============================================================

/**
 * Older AEM versions incur higher penalties because they have more
 * deprecated APIs and incompatible patterns.
 */
function aemVersionPenalty(version: string): number {
  const v = version.toLowerCase().trim();
  if (v.startsWith('6.0') || v.startsWith('5.')) return 20;
  if (v.startsWith('6.1')) return 16;
  if (v.startsWith('6.2')) return 12;
  if (v.startsWith('6.3')) return 10;
  if (v.startsWith('6.4')) return 6;
  if (v.startsWith('6.5')) return 3;
  if (v.includes('cloud')) return 0;
  return 5; // Unknown version, moderate penalty
}

// ============================================================
// Public Scoring Functions
// ============================================================

export interface DeterministicScoreInputs {
  orgName: string;
  sourcePlatform: string;
  sourceVersion: string;
  targetPlatform: string;
  migrationType?: string;
  siteCount?: number;
  componentCount?: number;
  pageCount?: number;
  assetCount?: number;
  integrationCount?: number;
  complianceFrameworks?: string[];
}

export interface DeterministicScores {
  codeScore: number;
  contentScore: number;
  integrationScore: number;
  configScore: number;
  complianceScore: number;
  overallScore: number;
  totalWeeks: number;
  confidenceLevel: number;
}

/**
 * Compute deterministic assessment scores from metadata inputs.
 * No randomness -- same inputs always produce same outputs.
 */
export function computeDeterministicScores(inputs: DeterministicScoreInputs): DeterministicScores {
  const profile = (inputs.migrationType && COMPLEXITY_PROFILES[inputs.migrationType])
    ? COMPLEXITY_PROFILES[inputs.migrationType]
    : DEFAULT_PROFILE;

  const seed = `${inputs.orgName}:${inputs.sourcePlatform}:${inputs.sourceVersion}:${inputs.targetPlatform}`;

  // Deterministic variation per dimension (small +/- from the base)
  const codeVariation = deterministicScore(seed + ':code', 0, 15);
  const contentVariation = deterministicScore(seed + ':content', 0, 12);
  const integrationVariation = deterministicScore(seed + ':integration', 0, 18);
  const configVariation = deterministicScore(seed + ':config', 0, 14);
  const complianceVariation = deterministicScore(seed + ':compliance', 0, 10);

  // Apply AEM version penalty for AEM-related migrations
  const versionPenalty = inputs.sourcePlatform.toLowerCase().includes('aem')
    ? aemVersionPenalty(inputs.sourceVersion)
    : 0;

  // Scale adjustments based on size
  const sizePenalty = computeSizePenalty(inputs);

  let codeScore = clamp(profile.codeBase + codeVariation - versionPenalty - sizePenalty.code, 20, 98);
  let contentScore = clamp(profile.contentBase + contentVariation - sizePenalty.content, 25, 98);
  let integrationScore = clamp(profile.integrationBase + integrationVariation - sizePenalty.integration, 15, 98);
  let configScore = clamp(profile.configBase + configVariation - versionPenalty * 0.5 - sizePenalty.config, 25, 98);

  // Compliance: based on how many frameworks the target supports natively
  const supportedFrameworks = new Set(['gdpr', 'ccpa', 'sox', 'section-508']);
  let complianceMet = 0;
  const frameworks = inputs.complianceFrameworks ?? [];
  let complianceScore: number;
  if (frameworks.length > 0) {
    for (const fw of frameworks) {
      if (supportedFrameworks.has(fw)) complianceMet++;
    }
    // Blend: base from profile, adjusted by actual compliance coverage
    const complianceCoverage = Math.round((complianceMet / frameworks.length) * 100);
    // Weight: 60% coverage-based, 40% profile-based variation
    const rawCompliance = Math.round(complianceCoverage * 0.6 + (profile.complianceBase + complianceVariation) * 0.4);
    complianceScore = clamp(rawCompliance, 30, 100);
  } else {
    complianceScore = clamp(profile.complianceBase + complianceVariation, 70, 100);
  }

  // Round everything
  codeScore = Math.round(codeScore);
  contentScore = Math.round(contentScore);
  integrationScore = Math.round(integrationScore);
  configScore = Math.round(configScore);
  complianceScore = Math.round(complianceScore);

  // Overall: weighted average matching engine weights
  const overallScore = Math.round(
    codeScore * 0.30 +
    contentScore * 0.25 +
    integrationScore * 0.20 +
    configScore * 0.15 +
    complianceScore * 0.10,
  );

  // Timeline: base from effort, adjusted by profile weeksFactor
  const baseWeeks = computeBaseWeeks(inputs);
  const totalWeeks = Math.max(2, Math.round(baseWeeks * profile.weeksFactor));

  // Confidence: higher for simpler migrations, lower for complex ones
  const confidenceLevel = computeConfidence(inputs, overallScore);

  return {
    codeScore,
    contentScore,
    integrationScore,
    configScore,
    complianceScore,
    overallScore,
    totalWeeks,
    confidenceLevel,
  };
}

// ============================================================
// Finding Generation
// ============================================================

interface FindingTemplate {
  category: string;
  subCategory: string;
  severity: Severity;
  compatibilityLevel: CompatibilityLevel;
  title: string;
  description: string;
  affectedPath: string;
  remediationGuide: string;
  autoFixAvailable: boolean;
  estimatedHoursBase: number;
  bpaPatternCode: string | null;
}

const FINDING_TEMPLATES: Record<string, FindingTemplate[]> = {
  'deprecated-api': [
    {
      category: 'Code Compatibility',
      subCategory: 'Deprecated APIs',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Deprecated API usage detected',
      description: 'Source codebase uses deprecated APIs that are not available on the target platform. Manual migration to modern equivalents is required.',
      affectedPath: '/src/main',
      remediationGuide: 'Replace deprecated API calls with their recommended alternatives. Refer to the migration guide for specific replacements.',
      autoFixAvailable: false,
      estimatedHoursBase: 16,
      bpaPatternCode: 'DEP-API-001',
    },
  ],
  'osgi-config': [
    {
      category: 'Configuration',
      subCategory: 'OSGi Configuration',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'OSGi configuration format requires update',
      description: 'OSGi configurations must use run-mode-specific folder structure for Cloud Service compatibility.',
      affectedPath: '/config',
      remediationGuide: 'Restructure OSGi configs into config.author, config.publish, config.dev folders. Use .cfg.json format.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: 'CFG-OSGI-001',
    },
  ],
  'replication': [
    {
      category: 'Code Compatibility',
      subCategory: 'Replication',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.BLOCKER,
      title: 'Custom replication agents not supported',
      description: 'Custom replication agents are not supported in AEM Cloud Service. Must migrate to Sling Content Distribution.',
      affectedPath: '/etc/replication',
      remediationGuide: 'Remove custom replication agents. Migrate to Sling Content Distribution framework.',
      autoFixAvailable: false,
      estimatedHoursBase: 20,
      bpaPatternCode: 'REP-001',
    },
  ],
  'static-template': [
    {
      category: 'Code Compatibility',
      subCategory: 'Template Type',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Static templates must be converted to editable templates',
      description: 'Static templates are deprecated. Editable templates provide better authoring experience and are required for Cloud Service.',
      affectedPath: '/apps/templates',
      remediationGuide: 'Convert static templates to editable templates. Move template structure to /conf.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: 'TPL-STATIC-001',
    },
  ],
  'dispatcher': [
    {
      category: 'Configuration',
      subCategory: 'Dispatcher',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Dispatcher configuration requires Cloud Service format',
      description: 'Dispatcher configuration must follow the immutable/mutable pattern required by Cloud Service.',
      affectedPath: '/dispatcher',
      remediationGuide: 'Use the Dispatcher Converter tool to migrate configuration files to Cloud Service format.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: 'DISP-001',
    },
  ],
  'cloud-manager': [
    {
      category: 'Configuration',
      subCategory: 'CI/CD Pipeline',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Cloud Manager pipeline configuration needed',
      description: 'CI/CD pipelines must be configured in Cloud Manager for automated deployments.',
      affectedPath: '/ci-cd',
      remediationGuide: 'Set up Cloud Manager pipelines for code quality, full-stack, and front-end deployments.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'content-restructure': [
    {
      category: 'Content',
      subCategory: 'Content Structure',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Content structure requires significant reorganization',
      description: 'The target platform uses a fundamentally different content model. Content must be restructured to fit the new architecture.',
      affectedPath: '/content',
      remediationGuide: 'Map existing content to the target content model. Use content transformation scripts for bulk migration.',
      autoFixAvailable: false,
      estimatedHoursBase: 24,
      bpaPatternCode: null,
    },
  ],
  'component-rewrite': [
    {
      category: 'Code Compatibility',
      subCategory: 'Component Architecture',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Components require rewrite for target platform',
      description: 'Source components are built on an incompatible framework. They must be rewritten using the target platform component model.',
      affectedPath: '/components',
      remediationGuide: 'Inventory all components. Identify target platform equivalents. Rewrite custom components using the target framework.',
      autoFixAvailable: false,
      estimatedHoursBase: 20,
      bpaPatternCode: null,
    },
  ],
  'integration-rewrite': [
    {
      category: 'Integration',
      subCategory: 'API Integration',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Integrations require reconfiguration for target platform',
      description: 'Existing integrations must be reconfigured or rewritten to work with the target platform APIs.',
      affectedPath: '/integrations',
      remediationGuide: 'Map integration endpoints to target platform equivalents. Update authentication mechanisms.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: null,
    },
  ],
  'content-mapping': [
    {
      category: 'Content',
      subCategory: 'Content Mapping',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Content type mapping required',
      description: 'Content types from the source platform must be mapped to equivalent types in the target platform.',
      affectedPath: '/content',
      remediationGuide: 'Create a content type mapping document. Use automated migration tools where available.',
      autoFixAvailable: true,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'plugin-replacement': [
    {
      category: 'Code Compatibility',
      subCategory: 'Plugin/Extension',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Source platform plugins require replacement',
      description: 'Plugins from the source platform have no direct equivalent and must be replaced with target platform alternatives.',
      affectedPath: '/plugins',
      remediationGuide: 'Audit all active plugins. Find AEM equivalents or plan custom development for critical functionality.',
      autoFixAvailable: false,
      estimatedHoursBase: 16,
      bpaPatternCode: null,
    },
  ],
  'theme-conversion': [
    {
      category: 'Code Compatibility',
      subCategory: 'Theme/Styling',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Theme/styling conversion needed',
      description: 'Source platform themes must be converted to the target platform styling framework.',
      affectedPath: '/themes',
      remediationGuide: 'Extract CSS and design tokens. Rebuild using the target platform theming system.',
      autoFixAvailable: true,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'rendering-engine': [
    {
      category: 'Code Compatibility',
      subCategory: 'Rendering Engine',
      severity: Severity.CRITICAL,
      compatibilityLevel: CompatibilityLevel.BLOCKER,
      title: 'Incompatible rendering engine',
      description: 'The source platform uses a fundamentally different rendering engine that is incompatible with the target.',
      affectedPath: '/rendering',
      remediationGuide: 'All rendering logic must be rewritten using HTL (Sightly) for AEM. Plan for complete front-end rebuild.',
      autoFixAvailable: false,
      estimatedHoursBase: 40,
      bpaPatternCode: null,
    },
  ],
  'personalization-migration': [
    {
      category: 'Integration',
      subCategory: 'Personalization',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Personalization rules require migration',
      description: 'Personalization rules and segments from the source platform must be recreated in Adobe Target or AEM Personalization.',
      affectedPath: '/personalization',
      remediationGuide: 'Export personalization rules. Recreate segments in Adobe Target. Map experience variations.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: null,
    },
  ],
  'taxonomy-migration': [
    {
      category: 'Content',
      subCategory: 'Taxonomy',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Taxonomy/tag structure migration',
      description: 'Content taxonomy and tag hierarchies must be migrated to AEM tag structure.',
      affectedPath: '/content/cq:tags',
      remediationGuide: 'Export source taxonomy. Map to AEM tag namespaces. Use bulk tag import.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'module-replacement': [
    {
      category: 'Code Compatibility',
      subCategory: 'Module/Extension',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Source platform modules require AEM equivalents',
      description: 'Custom modules and extensions from the source CMS must be replaced with AEM components or OSGi bundles.',
      affectedPath: '/modules',
      remediationGuide: 'Audit active modules. Identify AEM Core Component equivalents. Plan custom OSGi bundle development where needed.',
      autoFixAvailable: false,
      estimatedHoursBase: 16,
      bpaPatternCode: null,
    },
  ],
  'tag-migration': [
    {
      category: 'Configuration',
      subCategory: 'Tag Management',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Analytics tag implementation migration',
      description: 'Existing analytics tags (gtag.js/GTM) must be replaced with Adobe Launch/Tags implementation.',
      affectedPath: '/tags',
      remediationGuide: 'Map all existing events and variables. Implement via Adobe Tags. Validate data layer compatibility.',
      autoFixAvailable: true,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'report-suite-setup': [
    {
      category: 'Configuration',
      subCategory: 'Report Suite',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Report suite configuration required',
      description: 'Adobe Analytics report suites must be configured to match existing tracking requirements.',
      affectedPath: '/analytics',
      remediationGuide: 'Create report suite(s). Map existing dimensions to eVars/props. Configure processing rules.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: null,
    },
  ],
  'evar-prop-mapping': [
    {
      category: 'Configuration',
      subCategory: 'Variable Mapping',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Analytics variable mapping required',
      description: 'GA custom dimensions/metrics must be mapped to Adobe Analytics eVars, props, and events.',
      affectedPath: '/analytics/variables',
      remediationGuide: 'Create a variable mapping document. Map GA dimensions to eVars/props. Configure classifications as needed.',
      autoFixAvailable: false,
      estimatedHoursBase: 10,
      bpaPatternCode: null,
    },
  ],
  'general-compatibility': [
    {
      category: 'General',
      subCategory: 'Platform Compatibility',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'General platform compatibility assessment',
      description: 'Source platform components and configuration require review for target platform compatibility.',
      affectedPath: '/',
      remediationGuide: 'Follow the recommended migration playbook for this platform combination.',
      autoFixAvailable: true,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'configuration-review': [
    {
      category: 'Configuration',
      subCategory: 'Environment Config',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Environment configuration review',
      description: 'Environment configuration files should be reviewed and updated for the target platform.',
      affectedPath: '/config',
      remediationGuide: 'Review all configuration files. Update environment-specific values for the target platform.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'data-view-setup': [
    {
      category: 'Configuration',
      subCategory: 'Data View',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'CJA data view configuration required',
      description: 'Customer Journey Analytics data views must be configured to match existing analytics reporting.',
      affectedPath: '/analytics/data-views',
      remediationGuide: 'Create CJA connection and data views. Map existing dimensions and metrics. Configure calculated metrics.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: null,
    },
  ],
  'schema-mapping': [
    {
      category: 'Configuration',
      subCategory: 'Schema',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Data schema mapping required',
      description: 'Source data schemas must be mapped to XDM or target platform schema format.',
      affectedPath: '/schemas',
      remediationGuide: 'Create XDM schema mapping. Define field groups. Configure identity namespaces.',
      autoFixAvailable: false,
      estimatedHoursBase: 14,
      bpaPatternCode: null,
    },
  ],
  'connection-config': [
    {
      category: 'Configuration',
      subCategory: 'Connection',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Platform connection configuration',
      description: 'Data connections must be established between source data and the target platform.',
      affectedPath: '/connections',
      remediationGuide: 'Configure source connectors. Set up data ingestion pipelines. Validate data flow.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'data-view-migration': [
    {
      category: 'Configuration',
      subCategory: 'Data View',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Analytics to CJA data view migration',
      description: 'Existing Analytics report suite configuration should be migrated to CJA data views.',
      affectedPath: '/analytics/data-views',
      remediationGuide: 'Use the Analytics to CJA migration tool. Review and adjust data views post-migration.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: null,
    },
  ],
  'calculated-metric-conversion': [
    {
      category: 'Configuration',
      subCategory: 'Calculated Metrics',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Calculated metric conversion',
      description: 'Existing calculated metrics must be recreated in CJA format.',
      affectedPath: '/analytics/metrics',
      remediationGuide: 'Export calculated metrics. Recreate in CJA using the new metric builder.',
      autoFixAvailable: true,
      estimatedHoursBase: 3,
      bpaPatternCode: null,
    },
  ],
  'workflow-migration': [
    {
      category: 'Code Compatibility',
      subCategory: 'Workflow',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Workflow migration required',
      description: 'Existing workflows must be reviewed and migrated to the target platform workflow engine.',
      affectedPath: '/workflows',
      remediationGuide: 'Audit all active workflows. Map to target platform workflow capabilities. Rebuild custom workflow steps.',
      autoFixAvailable: false,
      estimatedHoursBase: 14,
      bpaPatternCode: null,
    },
  ],
  'delivery-template-update': [
    {
      category: 'Content',
      subCategory: 'Delivery Templates',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Delivery templates require format update',
      description: 'Email and delivery templates must be updated to the target platform format.',
      affectedPath: '/templates/delivery',
      remediationGuide: 'Export templates. Convert to target format using the template migration tool.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: null,
    },
  ],
  'schema-update': [
    {
      category: 'Configuration',
      subCategory: 'Database Schema',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Database schema update required',
      description: 'Campaign database schema must be updated to V8 format.',
      affectedPath: '/schemas',
      remediationGuide: 'Review schema changes in V8. Update custom schemas. Test data integrity after migration.',
      autoFixAvailable: false,
      estimatedHoursBase: 10,
      bpaPatternCode: null,
    },
  ],
  'js-api-update': [
    {
      category: 'Code Compatibility',
      subCategory: 'JavaScript API',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'JavaScript API updates required',
      description: 'Campaign Classic JavaScript APIs have breaking changes in V8. Custom scripts must be updated.',
      affectedPath: '/scripts',
      remediationGuide: 'Audit all JavaScript customizations. Update API calls to V8 equivalents. Test thoroughly.',
      autoFixAvailable: false,
      estimatedHoursBase: 18,
      bpaPatternCode: null,
    },
  ],
  'fda-migration': [
    {
      category: 'Configuration',
      subCategory: 'FDA/FFDA',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Full FDA architecture migration',
      description: 'Campaign V8 uses FFDA (Full Federated Data Access). Data storage architecture must be migrated.',
      affectedPath: '/data',
      remediationGuide: 'Plan FFDA migration. Review data volumes. Configure Snowflake integration.',
      autoFixAvailable: false,
      estimatedHoursBase: 24,
      bpaPatternCode: null,
    },
  ],
  'journey-mapping': [
    {
      category: 'Code Compatibility',
      subCategory: 'Journey/Automation',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Customer journey mapping required',
      description: 'SFMC journeys must be recreated in Adobe Journey Optimizer or Campaign.',
      affectedPath: '/journeys',
      remediationGuide: 'Map all active journeys. Recreate in AJO with equivalent triggers and actions.',
      autoFixAvailable: false,
      estimatedHoursBase: 20,
      bpaPatternCode: null,
    },
  ],
  'data-extension-migration': [
    {
      category: 'Content',
      subCategory: 'Data Extensions',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Data extensions require migration',
      description: 'SFMC data extensions must be mapped to Adobe Campaign schemas or AEP datasets.',
      affectedPath: '/data',
      remediationGuide: 'Export data extension schemas. Map to target schemas. Migrate data using ETL tools.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: null,
    },
  ],
  'ampscript-conversion': [
    {
      category: 'Code Compatibility',
      subCategory: 'Scripting',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'AMPscript/SSJS conversion required',
      description: 'SFMC AMPscript and Server-Side JavaScript must be converted to Adobe Campaign scripting.',
      affectedPath: '/scripts',
      remediationGuide: 'Audit all AMPscript usage. Rewrite in Adobe Campaign JavaScript. Test email rendering.',
      autoFixAvailable: false,
      estimatedHoursBase: 24,
      bpaPatternCode: null,
    },
  ],
  'trait-to-segment': [
    {
      category: 'Configuration',
      subCategory: 'Audience Migration',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'AAM traits to RTCDP segments migration',
      description: 'Audience Manager traits and segments must be migrated to Real-Time CDP.',
      affectedPath: '/audiences',
      remediationGuide: 'Use the AAM to RTCDP migration tool. Review segment definitions. Validate audience sizes.',
      autoFixAvailable: true,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'destination-migration': [
    {
      category: 'Integration',
      subCategory: 'Destinations',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Audience destinations require reconfiguration',
      description: 'AAM destinations must be reconfigured as RTCDP destinations.',
      affectedPath: '/destinations',
      remediationGuide: 'Map AAM destinations to RTCDP equivalents. Configure activation flows.',
      autoFixAvailable: false,
      estimatedHoursBase: 10,
      bpaPatternCode: null,
    },
  ],
  'identity-resolution': [
    {
      category: 'Configuration',
      subCategory: 'Identity',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Identity resolution setup',
      description: 'Identity resolution rules must be configured in AEP Identity Service.',
      affectedPath: '/identity',
      remediationGuide: 'Configure identity namespaces. Set up identity graph rules. Validate merge policies.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'identity-setup': [
    {
      category: 'Configuration',
      subCategory: 'Identity',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Identity namespace configuration',
      description: 'Customer identity namespaces must be defined in AEP for proper profile stitching.',
      affectedPath: '/identity',
      remediationGuide: 'Define identity namespaces. Configure identity graph. Set up merge policies.',
      autoFixAvailable: false,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'source-connector-config': [
    {
      category: 'Integration',
      subCategory: 'Source Connector',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'AEP source connector configuration',
      description: 'Source connectors must be configured to ingest data into AEP.',
      affectedPath: '/connectors',
      remediationGuide: 'Configure source connectors. Set up data flows. Validate data ingestion.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'catalog-migration': [
    {
      category: 'Content',
      subCategory: 'Product Catalog',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Product catalog migration',
      description: 'Product catalog data must be migrated to Adobe Commerce format.',
      affectedPath: '/catalog',
      remediationGuide: 'Export catalog data. Map attributes to Commerce schema. Use import profiles for bulk migration.',
      autoFixAvailable: false,
      estimatedHoursBase: 16,
      bpaPatternCode: null,
    },
  ],
  'checkout-customization': [
    {
      category: 'Code Compatibility',
      subCategory: 'Checkout',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Checkout customization rewrite',
      description: 'Custom checkout flows must be rebuilt using Adobe Commerce checkout framework.',
      affectedPath: '/checkout',
      remediationGuide: 'Audit checkout customizations. Rebuild using Commerce extensibility framework.',
      autoFixAvailable: false,
      estimatedHoursBase: 24,
      bpaPatternCode: null,
    },
  ],
  'cartridge-migration': [
    {
      category: 'Code Compatibility',
      subCategory: 'Cartridge',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'SFCC cartridge migration',
      description: 'Salesforce Commerce Cloud cartridges must be converted to Adobe Commerce extensions.',
      affectedPath: '/cartridges',
      remediationGuide: 'Audit all cartridges. Find Commerce equivalents. Plan custom extension development.',
      autoFixAvailable: false,
      estimatedHoursBase: 30,
      bpaPatternCode: null,
    },
  ],
  'pipeline-conversion': [
    {
      category: 'Code Compatibility',
      subCategory: 'Pipeline',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'SFCC pipeline to Commerce controller migration',
      description: 'SFCC pipelines must be rewritten as Adobe Commerce controllers.',
      affectedPath: '/pipelines',
      remediationGuide: 'Map pipelines to Commerce controller/observer patterns. Rewrite business logic.',
      autoFixAvailable: false,
      estimatedHoursBase: 20,
      bpaPatternCode: null,
    },
  ],
  'storefront-rewrite': [
    {
      category: 'Code Compatibility',
      subCategory: 'Storefront',
      severity: Severity.HIGH,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Storefront requires complete rewrite',
      description: 'The storefront front-end must be rebuilt using Adobe Commerce Venia/PWA Studio.',
      affectedPath: '/storefront',
      remediationGuide: 'Plan storefront rebuild. Use PWA Studio or Venia as starting point. Migrate design assets.',
      autoFixAvailable: false,
      estimatedHoursBase: 40,
      bpaPatternCode: null,
    },
  ],
  'metadata-mapping': [
    {
      category: 'Content',
      subCategory: 'Metadata',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Asset metadata mapping',
      description: 'Asset metadata schemas must be mapped to AEM Assets metadata profiles.',
      affectedPath: '/content/dam',
      remediationGuide: 'Map source metadata fields to AEM metadata schemas. Use bulk metadata import.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: null,
    },
  ],
  'rendition-profiles': [
    {
      category: 'Configuration',
      subCategory: 'Renditions',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Asset rendition profile configuration',
      description: 'Asset rendition profiles must be configured in AEM Assets for proper image processing.',
      affectedPath: '/conf/dam',
      remediationGuide: 'Configure image profiles and processing profiles. Set up Dynamic Media if needed.',
      autoFixAvailable: true,
      estimatedHoursBase: 3,
      bpaPatternCode: null,
    },
  ],
  'folder-structure': [
    {
      category: 'Content',
      subCategory: 'DAM Structure',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'DAM folder structure planning',
      description: 'DAM folder structure should be planned following AEM Assets best practices.',
      affectedPath: '/content/dam',
      remediationGuide: 'Design folder taxonomy. Set up metadata schemas per folder. Configure permissions.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'project-structure-mapping': [
    {
      category: 'Content',
      subCategory: 'Project Structure',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Project structure mapping',
      description: 'Jira project structures must be mapped to Workfront project templates.',
      affectedPath: '/projects',
      remediationGuide: 'Map Jira projects to Workfront portfolios/programs. Configure project templates.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'custom-field-migration': [
    {
      category: 'Configuration',
      subCategory: 'Custom Fields',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Custom field migration',
      description: 'Custom fields must be recreated in Workfront with appropriate field types.',
      affectedPath: '/fields',
      remediationGuide: 'Export custom fields. Recreate in Workfront. Map data types carefully.',
      autoFixAvailable: false,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
  'experiment-migration': [
    {
      category: 'Content',
      subCategory: 'Experiments',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'A/B test and experiment migration',
      description: 'Existing experiments and tests must be recreated in Adobe Target.',
      affectedPath: '/experiments',
      remediationGuide: 'Export experiment configurations. Recreate in Target. Migrate audiences and offers.',
      autoFixAvailable: false,
      estimatedHoursBase: 10,
      bpaPatternCode: null,
    },
  ],
  'audience-mapping': [
    {
      category: 'Configuration',
      subCategory: 'Audiences',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Audience definition migration',
      description: 'Audience definitions must be recreated in Adobe Target or AEP.',
      affectedPath: '/audiences',
      remediationGuide: 'Export audience definitions. Recreate in Target/AEP. Validate audience sizes.',
      autoFixAvailable: true,
      estimatedHoursBase: 4,
      bpaPatternCode: null,
    },
  ],
  'implementation-update': [
    {
      category: 'Code Compatibility',
      subCategory: 'Implementation',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Client-side implementation update',
      description: 'Client-side optimization/testing code must be updated to use Adobe Target SDK.',
      affectedPath: '/scripts',
      remediationGuide: 'Replace Optimizely snippet with at.js or Adobe Alloy. Update implementation code.',
      autoFixAvailable: false,
      estimatedHoursBase: 12,
      bpaPatternCode: null,
    },
  ],
  'form-migration': [
    {
      category: 'Content',
      subCategory: 'Forms',
      severity: Severity.LOW,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
      title: 'Form migration',
      description: 'Forms must be recreated in Marketo using Marketo form builder.',
      affectedPath: '/forms',
      remediationGuide: 'Export form definitions. Recreate in Marketo. Embed on landing pages.',
      autoFixAvailable: true,
      estimatedHoursBase: 6,
      bpaPatternCode: null,
    },
  ],
  'lead-scoring-setup': [
    {
      category: 'Configuration',
      subCategory: 'Lead Scoring',
      severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
      title: 'Lead scoring model configuration',
      description: 'Lead scoring models must be recreated in Marketo.',
      affectedPath: '/scoring',
      remediationGuide: 'Export scoring rules. Recreate scoring model in Marketo. Validate against historical data.',
      autoFixAvailable: false,
      estimatedHoursBase: 8,
      bpaPatternCode: null,
    },
  ],
};

/**
 * Generate findings based on migration type and metadata.
 * Findings are deterministic -- same inputs produce same outputs.
 */
export function generateDeterministicFindings(
  inputs: DeterministicScoreInputs,
): AssessmentFinding[] {
  const profile = (inputs.migrationType && COMPLEXITY_PROFILES[inputs.migrationType])
    ? COMPLEXITY_PROFILES[inputs.migrationType]
    : DEFAULT_PROFILE;

  const seed = `${inputs.orgName}:${inputs.sourcePlatform}:${inputs.sourceVersion}`;
  const findings: AssessmentFinding[] = [];

  let findingIndex = 0;
  for (const patternKey of profile.findingPatterns) {
    const templates = FINDING_TEMPLATES[patternKey];
    if (!templates) continue;

    for (let tplIdx = 0; tplIdx < templates.length; tplIdx++) {
      const tpl = templates[tplIdx]!;
      // Scale estimated hours based on component/page count
      const componentMultiplier = inputs.componentCount
        ? Math.max(1, Math.ceil(inputs.componentCount / 50))
        : 1;
      const estimatedHours = tpl.estimatedHoursBase * componentMultiplier;

      // Deterministic ID includes pattern, template index, and global index
      // to avoid collisions when different templates hash to the same 24-bit prefix.
      const findingHash = hashString(
        `${seed}:${patternKey}:${tplIdx}:${tpl.title}:${findingIndex}`,
      );

      findings.push({
        id: `f-${findingIndex.toString(16)}-${findingHash.toString(16).slice(0, 8)}`,
        category: tpl.category,
        subCategory: tpl.subCategory,
        severity: tpl.severity,
        compatibilityLevel: tpl.compatibilityLevel,
        title: tpl.title,
        description: tpl.description,
        affectedPath: tpl.affectedPath,
        remediationGuide: tpl.remediationGuide,
        autoFixAvailable: tpl.autoFixAvailable,
        estimatedHours,
        bpaPatternCode: tpl.bpaPatternCode,
      });
      findingIndex++;
    }
  }

  return findings;
}

/**
 * Generate risk factors based on scores and migration metadata.
 */
export function generateDeterministicRisks(
  inputs: DeterministicScoreInputs,
  scores: DeterministicScores,
  findings: AssessmentFinding[],
): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const seed = `${inputs.orgName}:${inputs.sourcePlatform}`;

  // Critical findings risk
  const criticalFindings = findings.filter((f) => f.severity === Severity.CRITICAL);
  if (criticalFindings.length > 0) {
    risks.push({
      id: `risk-${hashString(seed + ':critical').toString(16).slice(0, 6)}`,
      severity: Severity.CRITICAL,
      category: 'Code Compatibility',
      description: `${criticalFindings.length} critical compatibility issues detected that must be resolved before migration`,
      probability: 0.9,
      impact: 'Migration cannot proceed without resolving critical blockers',
      mitigation: 'Address all critical findings before starting migration. Use automated fix tools where available.',
    });
  }

  // Low code score risk
  if (scores.codeScore < 60) {
    risks.push({
      id: `risk-${hashString(seed + ':code-low').toString(16).slice(0, 6)}`,
      severity: Severity.HIGH,
      category: 'Technical',
      description: `Low code compatibility score (${scores.codeScore}%) indicates significant refactoring needed`,
      probability: 0.8,
      impact: 'Potential timeline extension of 3-5 weeks for code remediation',
      mitigation: 'Begin code review early. Allocate dedicated engineering resources for refactoring.',
    });
  }

  // Integration complexity risk
  if (scores.integrationScore < 55) {
    risks.push({
      id: `risk-${hashString(seed + ':integration').toString(16).slice(0, 6)}`,
      severity: Severity.HIGH,
      category: 'Integration',
      description: `Complex integration landscape (score: ${scores.integrationScore}%) may cause extended reconnection phase`,
      probability: 0.7,
      impact: 'Integration downtime and potential data loss during cutover',
      mitigation: 'Develop integration migration runbook. Test all integrations in staging before cutover.',
    });
  }

  // Content volume risk
  const estimatedPages = inputs.pageCount ?? deterministicScore(seed + ':pages', 200, 2000);
  if (estimatedPages > 1000) {
    risks.push({
      id: `risk-${hashString(seed + ':content-vol').toString(16).slice(0, 6)}`,
      severity: Severity.MEDIUM,
      category: 'Content',
      description: `Large content volume (~${estimatedPages} pages) may extend migration window`,
      probability: 0.6,
      impact: 'Extended downtime during content transfer',
      mitigation: 'Use incremental content transfer. Plan for multiple transfer rounds.',
    });
  }

  // Compliance risk
  if (scores.complianceScore < 70) {
    risks.push({
      id: `risk-${hashString(seed + ':compliance').toString(16).slice(0, 6)}`,
      severity: Severity.HIGH,
      category: 'Compliance',
      description: `Some compliance requirements (score: ${scores.complianceScore}%) may not be natively supported on target platform`,
      probability: 0.5,
      impact: 'Additional custom compliance controls needed post-migration',
      mitigation: 'Engage compliance team early. Plan custom control implementation.',
    });
  }

  // Timeline confidence risk
  if (scores.confidenceLevel < 0.6) {
    risks.push({
      id: `risk-${hashString(seed + ':confidence').toString(16).slice(0, 6)}`,
      severity: Severity.MEDIUM,
      category: 'Planning',
      description: 'Limited data available for accurate estimation — timeline confidence is low',
      probability: 0.5,
      impact: 'Actual timeline may differ significantly from estimate',
      mitigation: 'Connect source environment for detailed analysis. Run connector extraction before finalizing timeline.',
    });
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  risks.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return risks;
}

/**
 * Generate recommendations based on findings, scores, and inputs.
 */
export function generateDeterministicRecommendations(
  inputs: DeterministicScoreInputs,
  scores: DeterministicScores,
  findings: AssessmentFinding[],
): string[] {
  const recs: string[] = [];

  const criticalCount = findings.filter((f) => f.severity === Severity.CRITICAL).length;
  if (criticalCount > 0) {
    recs.push(`Resolve ${criticalCount} critical compatibility issues before proceeding with migration.`);
  }

  const autoFixCount = findings.filter((f) => f.autoFixAvailable).length;
  if (autoFixCount > 0) {
    recs.push(`Run automated remediation tools on ${autoFixCount} auto-fixable findings to reduce manual effort.`);
  }

  if (scores.codeScore < 70) {
    recs.push('Prioritize code compatibility remediation — consider a dedicated sprint before migration begins.');
  }

  if (scores.contentScore < 75) {
    recs.push('Perform a content audit to identify and remove duplicate, outdated, or unused content before migration.');
  }

  if (scores.integrationScore < 60) {
    recs.push('Map all integrations and develop a detailed integration migration runbook with rollback procedures.');
  }

  if (scores.configScore < 70) {
    recs.push('Review and update all configuration files for target platform compatibility before migration.');
  }

  if (inputs.sourceVersion && aemVersionPenalty(inputs.sourceVersion) > 10) {
    recs.push(`Source version (${inputs.sourceVersion}) is significantly outdated. Consider an intermediate upgrade to reduce migration complexity.`);
  }

  // Always include a general best practice
  recs.push('Create a rollback plan and validate all functionality in a staging environment before cutover.');

  return recs;
}

// ============================================================
// Content Health Generation
// ============================================================

export interface DeterministicContentHealthInputs {
  seed: string;
  pageCount?: number;
  assetCount?: number;
}

export function generateDeterministicContentHealth(inputs: DeterministicContentHealthInputs) {
  const seed = inputs.seed;
  const totalPages = inputs.pageCount ?? deterministicScore(seed + ':pages', 200, 3000);
  const totalAssets = inputs.assetCount ?? deterministicScore(seed + ':assets', 500, 10000);
  const totalContentFragments = deterministicScore(seed + ':cf', 10, 200);
  const totalExperienceFragments = deterministicScore(seed + ':xf', 5, 50);
  const totalContent = totalPages + totalAssets;
  const duplicatesDetected = deterministicScore(seed + ':dupes', 0, Math.round(totalContent * 0.03));
  const brokenReferences = deterministicScore(seed + ':broken', 0, Math.round(totalContent * 0.01));
  const metadataCompleteness = deterministicScore(seed + ':meta', 55, 95);
  const structuralIssues = deterministicScore(seed + ':struct', 0, 10);
  const totalSizeGB = deterministicFloat(seed + ':size', 5, 80);
  const publishedPercentage = deterministicScore(seed + ':pub', 60, 95);

  return {
    totalPages,
    totalAssets,
    totalContentFragments,
    totalExperienceFragments,
    duplicatesDetected,
    brokenReferences,
    metadataCompleteness,
    structuralIssues,
    totalSizeGB,
    publishedPercentage,
  };
}

// ============================================================
// Internal Helpers
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSizePenalty(inputs: DeterministicScoreInputs): {
  code: number;
  content: number;
  integration: number;
  config: number;
} {
  const components = inputs.componentCount ?? 0;
  const pages = inputs.pageCount ?? 0;
  const integrations = inputs.integrationCount ?? 0;

  return {
    code: components > 200 ? 8 : components > 100 ? 4 : components > 50 ? 2 : 0,
    content: pages > 5000 ? 10 : pages > 2000 ? 6 : pages > 500 ? 3 : 0,
    integration: integrations > 20 ? 12 : integrations > 10 ? 7 : integrations > 5 ? 3 : 0,
    config: components > 100 ? 5 : components > 50 ? 2 : 0,
  };
}

function computeBaseWeeks(inputs: DeterministicScoreInputs): number {
  // Base: 6 weeks minimum
  let weeks = 6;

  // Component complexity
  const components = inputs.componentCount ?? deterministicScore(
    inputs.orgName + ':comp', 20, 100,
  );
  weeks += Math.ceil(components / 25);

  // Content volume
  const pages = inputs.pageCount ?? deterministicScore(
    inputs.orgName + ':pages', 200, 2000,
  );
  weeks += Math.ceil(pages / 500);

  // Integration overhead
  const integrations = inputs.integrationCount ?? deterministicScore(
    inputs.orgName + ':integ', 1, 8,
  );
  weeks += Math.ceil(integrations / 3);

  return Math.min(30, weeks);
}

function computeConfidence(inputs: DeterministicScoreInputs, overallScore: number): number {
  let confidence = 0.55; // Base confidence without real data

  // Higher overall scores mean more predictable migration
  if (overallScore > 80) confidence += 0.15;
  else if (overallScore > 60) confidence += 0.08;

  // Having more specific inputs increases confidence
  if (inputs.componentCount !== undefined) confidence += 0.05;
  if (inputs.pageCount !== undefined) confidence += 0.05;
  if (inputs.assetCount !== undefined) confidence += 0.03;
  if (inputs.integrationCount !== undefined) confidence += 0.05;

  return Math.min(0.90, Math.round(confidence * 100) / 100);
}
