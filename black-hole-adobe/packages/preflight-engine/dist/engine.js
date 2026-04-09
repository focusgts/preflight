"use strict";
/**
 * Pre-Flight Engine
 *
 * Core analysis engine that runs Cloud Manager quality gate rules
 * against AEM project files. Used by both the CLI and the web API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreFlightEngine = void 0;
const rules_1 = require("./rules");
class PreFlightEngine {
    rules;
    constructor(rules) {
        this.rules = rules ?? rules_1.ALL_RULES;
    }
    /**
     * Run all pre-flight checks against a set of files.
     */
    runPreFlight(items) {
        const allFindings = [];
        for (const item of items) {
            allFindings.push(...this.runSonarQubeRules(item.content, item.path), ...this.runOakPALRules(item.content, item.path), ...this.runJavaCompatRules(item.content, item.path));
        }
        return this.buildReport(allFindings, items.length);
    }
    /**
     * Run only SonarQube quality gate rules against a single file.
     */
    runSonarQubeRules(code, filePath) {
        const findings = [];
        for (const rule of rules_1.sonarQubeRules) {
            findings.push(...rule.check(code, filePath));
        }
        return findings;
    }
    /**
     * Run only OakPAL index validation rules against an index definition.
     */
    runOakPALRules(indexDef, indexPath) {
        const findings = [];
        for (const rule of rules_1.oakpalRules) {
            findings.push(...rule.check(indexDef, indexPath));
        }
        return findings;
    }
    /**
     * Run only Java compatibility rules against a source file.
     */
    runJavaCompatRules(code, filePath) {
        const findings = [];
        for (const rule of rules_1.javaCompatRules) {
            findings.push(...rule.check(code, filePath));
        }
        return findings;
    }
    /**
     * Get all registered rules (for list-rules command).
     */
    getRules() {
        return this.rules;
    }
    /**
     * Get a single rule by ID (for explain command).
     */
    getRule(ruleId) {
        return this.rules.find((r) => r.id === ruleId);
    }
    /**
     * Search for rules with similar IDs (fuzzy).
     */
    findSimilarRules(query) {
        const lower = query.toLowerCase();
        return this.rules.filter((r) => r.id.toLowerCase().includes(lower) ||
            r.name.toLowerCase().includes(lower));
    }
    /**
     * Compute estimated Cloud Manager success probability based on findings.
     */
    computeSuccessProbability(findings) {
        let probability = 1.0;
        const blockers = findings.filter((f) => f.severity === 'blocker').length;
        const criticals = findings.filter((f) => f.severity === 'critical').length;
        const majors = findings.filter((f) => f.severity === 'major').length;
        for (let i = 0; i < blockers; i++) {
            probability *= 0.75;
        }
        for (let i = 0; i < criticals; i++) {
            probability *= 0.9;
        }
        for (let i = 0; i < majors; i++) {
            probability *= 0.97;
        }
        return Math.max(0.01, Math.round(probability * 100) / 100);
    }
    /**
     * Build the final pre-flight report from collected findings.
     */
    buildReport(findings, filesScanned) {
        const blockers = findings.filter((f) => f.severity === 'blocker').length;
        const criticals = findings.filter((f) => f.severity === 'critical').length;
        const majors = findings.filter((f) => f.severity === 'major').length;
        const minors = findings.filter((f) => f.severity === 'minor').length;
        const failCount = blockers + criticals;
        const warningCount = majors;
        const totalRulesChecked = this.rules.length * filesScanned;
        const passCount = Math.max(0, totalRulesChecked - failCount - warningCount - minors);
        const successProbability = this.computeSuccessProbability(findings);
        const topBlockers = findings
            .filter((f) => f.severity === 'blocker')
            .map((f) => `${f.ruleId}: ${f.message}`)
            .slice(0, 5);
        const topRemediations = findings
            .filter((f) => f.severity === 'blocker' || f.severity === 'critical')
            .map((f) => f.remediation)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5);
        const bpaComparisonNote = findings.length > 0
            ? `Pre-flight found ${findings.length} issue${findings.length > 1 ? 's' : ''} (${blockers} blocker${blockers !== 1 ? 's' : ''}, ${criticals} critical) that BPA does not check. These would cause Cloud Manager pipeline failure.`
            : 'No additional issues found beyond BPA coverage. Cloud Manager pipeline is likely to pass.';
        return {
            id: `preflight-${Date.now()}`,
            timestamp: new Date().toISOString(),
            totalRulesChecked,
            passCount,
            failCount,
            warningCount,
            findings,
            successProbability,
            bpaComparisonNote,
            summary: {
                blockers,
                criticals,
                majors,
                minors,
                topBlockers,
                topRemediations,
            },
        };
    }
}
exports.PreFlightEngine = PreFlightEngine;
//# sourceMappingURL=engine.js.map