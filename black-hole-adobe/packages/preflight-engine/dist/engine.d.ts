/**
 * Pre-Flight Engine
 *
 * Core analysis engine that runs Cloud Manager quality gate rules
 * against AEM project files. Used by both the CLI and the web API.
 */
import type { PreFlightFinding, PreFlightItem, PreFlightReport, RuleDefinition } from './types';
export declare class PreFlightEngine {
    private rules;
    constructor(rules?: RuleDefinition[]);
    /**
     * Run all pre-flight checks against a set of files.
     */
    runPreFlight(items: PreFlightItem[]): PreFlightReport;
    /**
     * Run only SonarQube quality gate rules against a single file.
     */
    runSonarQubeRules(code: string, filePath: string): PreFlightFinding[];
    /**
     * Run only OakPAL index validation rules against an index definition.
     */
    runOakPALRules(indexDef: string, indexPath: string): PreFlightFinding[];
    /**
     * Run only Java compatibility rules against a source file.
     */
    runJavaCompatRules(code: string, filePath: string): PreFlightFinding[];
    /**
     * Get all registered rules (for list-rules command).
     */
    getRules(): RuleDefinition[];
    /**
     * Get a single rule by ID (for explain command).
     */
    getRule(ruleId: string): RuleDefinition | undefined;
    /**
     * Search for rules with similar IDs (fuzzy).
     */
    findSimilarRules(query: string): RuleDefinition[];
    /**
     * Compute estimated Cloud Manager success probability based on findings.
     */
    private computeSuccessProbability;
    /**
     * Build the final pre-flight report from collected findings.
     */
    private buildReport;
}
//# sourceMappingURL=engine.d.ts.map