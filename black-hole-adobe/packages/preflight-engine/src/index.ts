/**
 * @blackhole/preflight-engine
 *
 * Cloud Manager pre-flight rule engine for AEM as a Cloud Service.
 * Shared by both the CLI (@blackhole/preflight) and the web API.
 */

export type {
  PreFlightSeverity,
  PreFlightCategory,
  PreFlightFinding,
  PreFlightItem,
  PreFlightReport,
  PreFlightSummary,
  RuleDefinition,
} from './types';

export { PreFlightEngine } from './engine';

export {
  ALL_RULES,
  sonarQubeRules,
  oakpalRules,
  javaCompatRules,
  isJavaFile,
  isContentFile,
  isConfigFile,
  isPomFile,
  isIndexDefinition,
} from './rules';
