/**
 * Black Hole for Adobe Marketing Cloud - Core Types
 *
 * Comprehensive type definitions for the migration platform.
 */

// ============================================================
// Enums
// ============================================================

export enum MigrationStatus {
  DRAFT = 'draft',
  ASSESSING = 'assessing',
  ASSESSED = 'assessed',
  PLANNING = 'planning',
  PLANNED = 'planned',
  TRANSFORMING = 'transforming',
  EXECUTING = 'executing',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum MigrationType {
  AEM_ONPREM_TO_CLOUD = 'aem_onprem_to_cloud',
  AEM_AMS_TO_CLOUD = 'aem_ams_to_cloud',
  AEM_VERSION_UPGRADE = 'aem_version_upgrade',
  AEM_TO_EDS = 'aem_to_eds',
  WORDPRESS_TO_AEM = 'wordpress_to_aem',
  SITECORE_TO_AEM = 'sitecore_to_aem',
  DRUPAL_TO_AEM = 'drupal_to_aem',
  GA_TO_ADOBE_ANALYTICS = 'ga_to_adobe_analytics',
  GA_TO_CJA = 'ga_to_cja',
  ANALYTICS_TO_CJA = 'analytics_to_cja',
  CAMPAIGN_STD_TO_V8 = 'campaign_std_to_v8',
  CAMPAIGN_CLASSIC_TO_V8 = 'campaign_classic_to_v8',
  SFMC_TO_ADOBE = 'sfmc_to_adobe',
  AAM_TO_RTCDP = 'aam_to_rtcdp',
  COMPETITOR_CDP_TO_AEP = 'competitor_cdp_to_aep',
  SHOPIFY_TO_COMMERCE = 'shopify_to_commerce',
  SFCC_TO_COMMERCE = 'sfcc_to_commerce',
  DAM_TO_AEM_ASSETS = 'dam_to_aem_assets',
  JIRA_TO_WORKFRONT = 'jira_to_workfront',
  OPTIMIZELY_TO_TARGET = 'optimizely_to_target',
  HUBSPOT_TO_MARKETO = 'hubspot_to_marketo',
  CUSTOM = 'custom',
}

export enum AdobeProduct {
  AEM_SITES = 'aem-sites',
  AEM_ASSETS = 'aem-assets',
  AEM_FORMS = 'aem-forms',
  AEM_SCREENS = 'aem-screens',
  AEM_EDS = 'aem-eds',
  AEM_CLOUD_MANAGER = 'aem-cloud-mgr',
  ANALYTICS = 'analytics',
  CJA = 'cja',
  TARGET = 'target',
  CAMPAIGN = 'campaign',
  AJO = 'ajo',
  AEP = 'aep',
  RTCDP = 'rtcdp',
  AAM = 'aam',
  COMMERCE = 'commerce',
  MARKETO = 'marketo',
  WORKFRONT = 'workfront',
  GENSTUDIO = 'genstudio',
  MIX_MODELER = 'mix-modeler',
}

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum ComplianceFramework {
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  HIPAA = 'hipaa',
  FEDRAMP = 'fedramp',
  PCI_DSS = 'pci-dss',
  SOX = 'sox',
  SECTION_508 = 'section-508',
}

export enum SEACategory {
  SUPPORT = 'support',
  ENHANCE = 'enhance',
  ADVISE = 'advise',
}

export enum CompatibilityLevel {
  COMPATIBLE = 'compatible',
  AUTO_FIXABLE = 'auto_fixable',
  MANUAL_FIX = 'manual_fix',
  BLOCKER = 'blocker',
}

export enum PhaseType {
  ASSESSMENT = 'assessment',
  PLANNING = 'planning',
  CODE_MODERNIZATION = 'code_modernization',
  CONTENT_MIGRATION = 'content_migration',
  INTEGRATION_RECONNECTION = 'integration_reconnection',
  TESTING = 'testing',
  CUTOVER = 'cutover',
  MONITORING = 'monitoring',
}

// ============================================================
// Core Interfaces
// ============================================================

export interface MigrationProject {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  migrationType: MigrationType;
  status: MigrationStatus;
  productsInScope: AdobeProduct[];
  complianceRequirements: ComplianceFramework[];
  sourceEnvironment: SourceEnvironment;
  targetEnvironment: TargetEnvironment;
  assessment: AssessmentResult | null;
  phases: MigrationPhase[];
  riskScore: number; // 0.0-1.0
  estimatedDurationWeeks: number;
  estimatedCost: number;
  actualCost: number | null;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
  targetCompletionDate: string | null;
  completedAt: string | null;
}

export interface SourceEnvironment {
  platform: string; // aem_6x, wordpress, ga4, sfmc, etc.
  version: string;
  url: string | null;
  connectionType: 'api' | 'file_upload' | 'git' | 'package';
  credentials: EncryptedCredentials | null;
  metadata: Record<string, unknown>;
}

export interface TargetEnvironment {
  platform: string; // aem_cloud, aep, campaign_v8, etc.
  organizationId: string;
  programId: string | null;
  environmentId: string | null;
  url: string | null;
  credentials: EncryptedCredentials | null;
  metadata: Record<string, unknown>;
}

export interface EncryptedCredentials {
  type: 'oauth_s2s' | 'api_key' | 'basic' | 'jwt_legacy';
  encryptedPayload: string;
  expiresAt: string | null;
}

// ============================================================
// Assessment Types
// ============================================================

export interface AssessmentResult {
  id: string;
  migrationProjectId: string;
  overallScore: number; // 0-100
  codeCompatibilityScore: number;
  contentReadinessScore: number;
  integrationComplexityScore: number;
  configurationReadinessScore: number;
  complianceScore: number;
  findings: AssessmentFinding[];
  contentHealth: ContentHealth;
  integrationMap: IntegrationDependency[];
  riskFactors: RiskFactor[];
  estimatedTimeline: TimelineEstimate;
  estimatedCost: CostEstimate;
  traditionalEstimate: TraditionalEstimate;
  recommendations: string[];
  createdAt: string;
}

export interface AssessmentFinding {
  id: string;
  category: string;
  subCategory: string;
  severity: Severity;
  compatibilityLevel: CompatibilityLevel;
  title: string;
  description: string;
  affectedPath: string;
  remediationGuide: string;
  autoFixAvailable: boolean;
  estimatedHours: number;
  bpaPatternCode: string | null;
}

export interface ContentHealth {
  totalPages: number;
  totalAssets: number;
  totalContentFragments: number;
  totalExperienceFragments: number;
  duplicatesDetected: number;
  brokenReferences: number;
  metadataCompleteness: number; // 0-100
  structuralIssues: number;
  totalSizeGB: number;
  publishedPercentage: number;
}

export interface IntegrationDependency {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'event' | 'sync' | 'feed' | 'sdk';
  sourceConfig: Record<string, unknown>;
  targetConfig: Record<string, unknown> | null;
  adobeProduct: AdobeProduct | null;
  authType: string;
  dataFlow: 'inbound' | 'outbound' | 'bidirectional';
  criticality: Severity;
  autoMigratable: boolean;
  migrationNotes: string;
}

export interface RiskFactor {
  id: string;
  severity: Severity;
  category: string;
  description: string;
  probability: number; // 0-1
  impact: string;
  mitigation: string;
}

export interface TimelineEstimate {
  totalWeeks: number;
  phases: PhaseEstimate[];
  confidenceLevel: number; // 0-1
}

export interface PhaseEstimate {
  phase: PhaseType;
  durationWeeks: number;
  startWeek: number;
  endWeek: number;
  parallelizable: boolean;
}

export interface CostEstimate {
  platformFee: number;
  estimatedSIHours: number;
  estimatedSICost: number;
  totalEstimate: number;
  currency: string;
}

export interface TraditionalEstimate {
  durationWeeks: number;
  cost: number;
  timeSavingsPercent: number;
  costSavingsPercent: number;
}

// ============================================================
// Migration Phase Types
// ============================================================

export interface MigrationPhase {
  id: string;
  type: PhaseType;
  name: string;
  status: MigrationStatus;
  progress: number; // 0-100
  items: MigrationItem[];
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number; // hours
  actualDuration: number | null;
}

export interface MigrationItem {
  id: string;
  type: string;
  name: string;
  sourcePath: string;
  targetPath: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  compatibilityLevel: CompatibilityLevel;
  autoFixed: boolean;
  validationResult: ValidationResult | null;
  error: string | null;
  processedAt: string | null;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  score: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: Severity;
}

// ============================================================
// Connector Types
// ============================================================

export interface ConnectorConfig {
  id: string;
  type: string; // aem, analytics, campaign, wordpress, etc.
  name: string;
  connectionDetails: Record<string, unknown>;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastTestedAt: string | null;
  capabilities: string[];
}

// ============================================================
// Dashboard / UI Types
// ============================================================

export interface DashboardStats {
  totalMigrations: number;
  activeMigrations: number;
  completedMigrations: number;
  totalItemsMigrated: number;
  averageTimeSavings: number;
  averageCostSavings: number;
  topMigrationTypes: MigrationTypeCount[];
  recentActivity: ActivityEntry[];
}

export interface MigrationTypeCount {
  type: MigrationType;
  count: number;
  label: string;
}

export interface ActivityEntry {
  id: string;
  migrationId: string;
  migrationName: string;
  action: string;
  timestamp: string;
  details: string;
}

// ============================================================
// API Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
