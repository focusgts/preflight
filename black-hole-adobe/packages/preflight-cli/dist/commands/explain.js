"use strict";
/**
 * `preflight explain <rule-id>` command
 *
 * Prints detailed information about a specific rule.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExplainCommand = registerExplainCommand;
exports.explainCommand = explainCommand;
const preflight_engine_1 = require("@blackhole/preflight-engine");
function registerExplainCommand(program) {
    program
        .command('explain')
        .description('Show detailed information about a specific rule')
        .argument('<rule-id>', 'the rule ID to explain')
        .action((ruleId) => {
        const exitCode = explainCommand(ruleId);
        process.exit(exitCode);
    });
}
function explainCommand(ruleId) {
    const engine = new preflight_engine_1.PreFlightEngine();
    const rule = engine.getRule(ruleId);
    if (rule) {
        let chalk = null;
        try {
            chalk = require('chalk');
        }
        catch {
            // chalk not available
        }
        const severityColor = getSeverityColor(rule.severity, chalk);
        const lines = [
            '',
            `Rule: ${rule.id}`,
            `Name: ${rule.name}`,
            `Severity: ${severityColor}`,
            `Category: ${rule.category}`,
            '',
            `Description:`,
            `  ${rule.description}`,
            '',
            `Remediation:`,
            `  ${rule.remediation}`,
            '',
        ];
        process.stdout.write(lines.join('\n'));
        return 0;
    }
    // Rule not found -- suggest similar
    const similar = engine.findSimilarRules(ruleId);
    if (similar.length > 0) {
        process.stderr.write(`Rule "${ruleId}" not found. Did you mean:\n`);
        for (const r of similar) {
            process.stderr.write(`  ${r.id} (${r.name})\n`);
        }
    }
    else {
        process.stderr.write(`Rule "${ruleId}" not found. Use "preflight list-rules" to see all available rules.\n`);
    }
    return 1;
}
function getSeverityColor(severity, chalk) {
    if (!chalk)
        return severity;
    switch (severity) {
        case 'blocker':
            return chalk.red.bold(severity);
        case 'critical':
            return chalk.yellow.bold(severity);
        case 'major':
            return chalk.blue(severity);
        case 'minor':
            return chalk.gray(severity);
        default:
            return severity;
    }
}
//# sourceMappingURL=explain.js.map