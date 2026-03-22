/**
 * Black Hole - AI Service Layer
 *
 * Barrel export for all AI modules.
 */

// Client
export { ClaudeClient, ClaudeClientError } from './claude-client';
export type {
  ClaudeClientOptions,
  ClaudeResponse,
  StreamCallbacks,
} from './claude-client';

// Classifier
export { AIClassifier } from './classifier';
export type { ClassifierOptions } from './classifier';

// Code Analyzer
export { AICodeAnalyzer } from './code-analyzer';
export type {
  CodeAnalysisOptions,
  CodeCompatibilityResult,
  RefactorResult,
  OSGiConversionResult,
  TestCase,
  TestGenerationResult,
} from './code-analyzer';

// Prompts
export {
  CLASSIFY_MIGRATION_ITEM,
  ANALYZE_CODE_COMPATIBILITY,
  REFACTOR_OSGI_CONFIG,
  REFACTOR_DEPRECATED_API,
  MAP_SCHEMA_FIELDS,
  ANALYZE_CONTENT_QUALITY,
  GENERATE_MIGRATION_PLAN,
  ASSESS_RISK,
  GENERATE_TEST_CASES,
} from './prompts';
export type { PromptPair } from './prompts';
