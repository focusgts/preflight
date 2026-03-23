/**
 * Migration-as-Code (MaC) Module
 *
 * Declarative YAML-driven migration configuration that can be
 * version-controlled, reviewed in PRs, and replayed.
 */

export {
  // Schema & types
  MigrationConfigSchema,
  MetadataSchema,
  SourceSchema,
  TargetSchema,
  ScopeSchema,
  PhaseConfigSchema,
  TransformationRuleSchema,
  ComplianceConfigSchema,
  NotificationConfigSchema,
  RollbackConfigSchema,
  TEMPLATE_NAMES,
  TEMPLATE_TO_MIGRATION_TYPE,
  type MigrationConfig,
  type MigrationMetadata,
  type MigrationSource,
  type MigrationTarget,
  type MigrationScope,
  type PhaseConfig,
  type TransformationRule,
  type ComplianceConfig,
  type NotificationConfig,
  type RollbackConfig,
  type ConfigValidationResult,
  type ConfigValidationError,
  type ConfigValidationWarning,
  type ConfigDiff,
  type ConfigDiffEntry,
  type TemplateName,
} from './schema';

export { MigrationConfigParser, EnvVarError } from './parser';

export {
  MigrationConfigExecutor,
  type ExecutionOptions,
  type DryRunResult,
  type ExecutionResult,
} from './executor';

export { getTemplate, getTemplateList } from './templates';
