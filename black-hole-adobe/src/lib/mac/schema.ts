/**
 * Migration-as-Code Schema Definition
 *
 * TypeScript types and Zod validators for the declarative YAML
 * migration configuration format. Configs can be version-controlled,
 * reviewed in pull requests, and replayed deterministically.
 */

import { z } from 'zod';
import {
  MigrationType,
  AdobeProduct,
  PhaseType,
  ComplianceFramework,
} from '@/types';

// ============================================================
// Zod Schemas
// ============================================================

/** Environment variable reference pattern: ${VAR_NAME} */
const envVarPattern = /^\$\{[A-Z_][A-Z0-9_]*\}$/;

const envVarString = z.string().regex(
  envVarPattern,
  'Auth references must use ${ENV_VAR} syntax (e.g. ${AEM_API_KEY}). Never inline secrets.',
);

// ── Metadata ─────────────────────────────────────────────────

export const MetadataSchema = z.object({
  name: z.string().min(1, 'Migration name is required').max(120),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Version must follow semver (e.g. 1.0.0)'),
  description: z.string().max(500).optional(),
  author: z.string().min(1, 'Author is required'),
  created: z.string().datetime({ message: 'created must be ISO 8601 datetime' }).optional(),
});

export type MigrationMetadata = z.infer<typeof MetadataSchema>;

// ── Source ───────────────────────────────────────────────────

export const SourceSchema = z.object({
  platform: z.string().min(1, 'Source platform is required (e.g. aem_6x, wordpress)'),
  version: z.string().min(1, 'Source version is required'),
  url: z.string().url('Source URL must be a valid URL').optional(),
  auth: z.object({
    type: z.enum(['oauth_s2s', 'api_key', 'basic', 'jwt_legacy']),
    credentials: envVarString.describe('Reference to env var holding credentials'),
  }).optional(),
});

export type MigrationSource = z.infer<typeof SourceSchema>;

// ── Target ───────────────────────────────────────────────────

export const TargetSchema = z.object({
  platform: z.string().min(1, 'Target platform is required (e.g. aem_cloud, aep)'),
  url: z.string().url('Target URL must be a valid URL').optional(),
  programId: z.string().optional(),
  environmentId: z.string().optional(),
  auth: z.object({
    type: z.enum(['oauth_s2s', 'api_key', 'basic', 'jwt_legacy']),
    credentials: envVarString.describe('Reference to env var holding credentials'),
  }).optional(),
});

export type MigrationTarget = z.infer<typeof TargetSchema>;

// ── Scope ────────────────────────────────────────────────────

export const ScopeSchema = z.object({
  products: z.array(z.nativeEnum(AdobeProduct)).min(1, 'At least one product must be in scope'),
  sites: z.object({
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
  }).optional(),
  contentPaths: z.array(z.string()).optional(),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  assetTypes: z.array(z.string()).optional(),
  maxSizeGB: z.number().positive().optional(),
});

export type MigrationScope = z.infer<typeof ScopeSchema>;

// ── Phases ───────────────────────────────────────────────────

export const PhaseConfigSchema = z.object({
  type: z.nativeEnum(PhaseType),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.any()).optional(),
  timeout: z.string().optional().describe('Duration string, e.g. "4h", "2d"'),
  retries: z.number().int().min(0).max(10).default(2),
  continueOnError: z.boolean().default(false),
  concurrency: z.number().int().min(1).max(50).default(10),
  dependencies: z.array(z.nativeEnum(PhaseType)).optional(),
});

export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;

// ── Rules ────────────────────────────────────────────────────

export const TransformationRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['regex_replace', 'path_mapping', 'api_replacement', 'component_mapping', 'custom']),
  enabled: z.boolean().default(true),
  pattern: z.string().optional(),
  replacement: z.string().optional(),
  sourcePath: z.string().optional(),
  targetPath: z.string().optional(),
  sourceApi: z.string().optional(),
  targetApi: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type TransformationRule = z.infer<typeof TransformationRuleSchema>;

// ── Compliance ───────────────────────────────────────────────

export const ComplianceConfigSchema = z.object({
  frameworks: z.array(z.nativeEnum(ComplianceFramework)).default([]),
  dataResidency: z.object({
    region: z.string().min(1, 'Data residency region is required'),
    enforceGeoFencing: z.boolean().default(false),
  }).optional(),
  piiHandling: z.object({
    strategy: z.enum(['redact', 'encrypt', 'pseudonymize', 'skip']),
    fields: z.array(z.string()).default([]),
    auditLog: z.boolean().default(true),
  }).optional(),
  retentionDays: z.number().int().positive().optional(),
});

export type ComplianceConfig = z.infer<typeof ComplianceConfigSchema>;

// ── Notifications ────────────────────────────────────────────

export const NotificationConfigSchema = z.object({
  slack: z.object({
    webhookUrl: envVarString,
    channel: z.string().optional(),
  }).optional(),
  email: z.object({
    addresses: z.array(z.string().email('Invalid email address')),
  }).optional(),
  events: z.array(z.enum([
    'migration:start',
    'migration:complete',
    'migration:failed',
    'phase:start',
    'phase:complete',
    'phase:error',
    'validation:failed',
    'rollback:triggered',
  ])).default(['migration:complete', 'migration:failed']),
});

export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;

// ── Rollback ─────────────────────────────────────────────────

export const RollbackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  errorThresholdPercent: z.number().min(0).max(100).default(10),
  validationFailureThreshold: z.number().int().min(0).default(5),
  autoRollback: z.boolean().default(false),
  snapshotBeforeCutover: z.boolean().default(true),
  notifyOnRollback: z.boolean().default(true),
});

export type RollbackConfig = z.infer<typeof RollbackConfigSchema>;

// ============================================================
// Top-Level Migration Config
// ============================================================

export const MigrationConfigSchema = z.object({
  metadata: MetadataSchema,
  source: SourceSchema,
  target: TargetSchema,
  scope: ScopeSchema,
  phases: z.array(PhaseConfigSchema).min(1, 'At least one phase is required'),
  rules: z.array(TransformationRuleSchema).default([]),
  compliance: ComplianceConfigSchema.optional(),
  notifications: NotificationConfigSchema.optional(),
  rollback: RollbackConfigSchema.optional(),
});

export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

// ============================================================
// Validation Result Types
// ============================================================

export interface ConfigValidationError {
  path: string;
  message: string;
  line?: number;
}

export interface ConfigValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
  config: MigrationConfig | null;
}

// ============================================================
// Config Diff Types
// ============================================================

export interface ConfigDiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ConfigDiff {
  entries: ConfigDiffEntry[];
  summary: string;
}

// ============================================================
// Template Types
// ============================================================

export type TemplateName =
  | 'aem-onprem-to-cloud'
  | 'aem-ams-to-cloud'
  | 'wordpress-to-aem'
  | 'sitecore-to-aem'
  | 'ga-to-cja'
  | 'campaign-std-to-v8'
  | 'aam-to-rtcdp';

export const TEMPLATE_NAMES: TemplateName[] = [
  'aem-onprem-to-cloud',
  'aem-ams-to-cloud',
  'wordpress-to-aem',
  'sitecore-to-aem',
  'ga-to-cja',
  'campaign-std-to-v8',
  'aam-to-rtcdp',
];

/** Maps template names to MigrationType enum values. */
export const TEMPLATE_TO_MIGRATION_TYPE: Record<TemplateName, MigrationType> = {
  'aem-onprem-to-cloud': MigrationType.AEM_ONPREM_TO_CLOUD,
  'aem-ams-to-cloud': MigrationType.AEM_AMS_TO_CLOUD,
  'wordpress-to-aem': MigrationType.WORDPRESS_TO_AEM,
  'sitecore-to-aem': MigrationType.SITECORE_TO_AEM,
  'ga-to-cja': MigrationType.GA_TO_CJA,
  'campaign-std-to-v8': MigrationType.CAMPAIGN_STD_TO_V8,
  'aam-to-rtcdp': MigrationType.AAM_TO_RTCDP,
};
