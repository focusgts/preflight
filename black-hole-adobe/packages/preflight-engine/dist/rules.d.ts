/**
 * Cloud Manager Pre-Flight Rule Definitions
 *
 * Validates code against Cloud Manager quality gate rules that BPA misses.
 * Covers SonarQube custom rules, OakPAL index validation, and Java runtime
 * compatibility checks for AEM as a Cloud Service deployments.
 */
import type { RuleDefinition } from './types';
export declare function isJavaFile(path: string): boolean;
export declare function isContentFile(path: string): boolean;
export declare function isConfigFile(path: string): boolean;
export declare function isPomFile(path: string): boolean;
export declare function isIndexDefinition(path: string, content: string): boolean;
declare const sonarQubeRules: RuleDefinition[];
declare const oakpalRules: RuleDefinition[];
declare const javaCompatRules: RuleDefinition[];
export declare const ALL_RULES: RuleDefinition[];
export { sonarQubeRules, oakpalRules, javaCompatRules };
//# sourceMappingURL=rules.d.ts.map