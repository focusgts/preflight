/**
 * AEM Migration Module - Barrel Exports
 *
 * Provides all migration engine components for AEM 6.x to Cloud Service
 * migrations, content migration orchestration, integration discovery,
 * schema mapping, compliance scanning, and test generation.
 */

export { CodeModernizer } from './code-modernizer';
export type {
  ModernizationReport,
  ModernizationFinding,
  ModernizationSummary,
  ModernizationCategory,
  OsgiConfigInput,
  MavenModule,
  DispatcherRule,
  BundleAnalysis,
} from './code-modernizer';

export { ContentMigrator } from './content-migrator';
export type {
  ContentNode,
  DuplicateGroup,
  ReferenceIssue,
  MigrationSet,
  MigrationPlan,
  RedirectMapping,
  ContentAnalysisResult,
  MetadataQualityReport,
  MigrationExecutionResult,
} from './content-migrator';

export { IntegrationMigrator } from './integration-migrator';
export type {
  IntegrationDetectionResult,
  DiscoveredIntegration,
  AuthMechanism,
  IntegrationSummary,
  IntegrationMappingResult,
  IntegrationValidationResult,
  IntegrationCheck,
} from './integration-migrator';

export { SchemaMapper } from './schema-mapper';
export type {
  SchemaDefinition,
  SchemaField,
  FieldType,
  FieldMapping,
  FieldTransformation,
  SchemaMappingResult,
  SchemaMappingWarning,
  XDMSchema,
  XDMProperty,
} from './schema-mapper';

export { ComplianceChecker } from './compliance-checker';
export type {
  ComplianceReport,
  PIIFinding,
  PIIType,
  PHIFinding,
  PHIType,
  ConsentIssue,
  ResidencyIssue,
  ComplianceSummary,
  ScanInput,
  ResidencyConfig,
  ConsentRecord,
} from './compliance-checker';

export { TestGenerator } from './test-generator';
export type {
  TestSuite,
  TestType,
  TestSpec,
  TestStep,
  TestAssertion,
  AssertionType,
  VisualTestConfig,
  PerformanceTestConfig,
  PerformanceMetric,
} from './test-generator';
