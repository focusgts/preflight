/**
 * Pre-Flight Engine Types
 *
 * Shared type definitions for the Cloud Manager pre-flight rule engine.
 * Used by both the CLI and the web application.
 */

export type PreFlightSeverity = 'blocker' | 'critical' | 'major' | 'minor';
export type PreFlightCategory = 'sonarqube' | 'oakpal' | 'java-compat';

export interface PreFlightFinding {
  ruleId: string;
  ruleName: string;
  severity: PreFlightSeverity;
  category: PreFlightCategory;
  filePath: string;
  line?: number;
  message: string;
  remediation: string;
}

export interface PreFlightItem {
  path: string;
  content: string;
}

export interface PreFlightReport {
  id: string;
  timestamp: string;
  totalRulesChecked: number;
  passCount: number;
  failCount: number;
  warningCount: number;
  findings: PreFlightFinding[];
  successProbability: number;
  bpaComparisonNote: string;
  summary: PreFlightSummary;
}

export interface PreFlightSummary {
  blockers: number;
  criticals: number;
  majors: number;
  minors: number;
  topBlockers: string[];
  topRemediations: string[];
}

export interface RuleDefinition {
  id: string;
  name: string;
  severity: PreFlightSeverity;
  category: PreFlightCategory;
  description: string;
  remediation: string;
  /** Return findings for the given file content, or empty array if clean. */
  check: (content: string, filePath: string) => PreFlightFinding[];
}
