"use strict";
/**
 * `preflight list-rules` command
 *
 * Lists all available pre-flight rules with their severity and category.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerListRulesCommand = registerListRulesCommand;
exports.listRulesCommand = listRulesCommand;
const preflight_engine_1 = require("@blackhole/preflight-engine");
function registerListRulesCommand(program) {
    program
        .command('list-rules')
        .description('List all available pre-flight rules')
        .option('--format <format>', 'output format: table, json', 'table')
        .action((options) => {
        const exitCode = listRulesCommand(options.format);
        process.exit(exitCode);
    });
}
function listRulesCommand(format) {
    const engine = new preflight_engine_1.PreFlightEngine();
    const rules = engine.getRules();
    if (format === 'json') {
        const output = rules.map((r) => ({
            id: r.id,
            name: r.name,
            severity: r.severity,
            category: r.category,
            description: r.description,
        }));
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        return 0;
    }
    // Table format
    let chalk = null;
    try {
        chalk = require('chalk');
    }
    catch {
        // chalk not available
    }
    const header = padRow('ID', 'NAME', 'SEVERITY', 'CATEGORY');
    const separator = '-'.repeat(header.length);
    const lines = [
        '',
        `Pre-Flight Rules (${rules.length} total)`,
        '',
        header,
        separator,
    ];
    for (const rule of rules) {
        const severityStr = colorSeverity(rule.severity, chalk);
        lines.push(padRow(rule.id, rule.name, severityStr, rule.category));
    }
    lines.push('');
    process.stdout.write(lines.join('\n'));
    return 0;
}
function padRow(id, name, severity, category) {
    return `  ${id.padEnd(38)} ${name.padEnd(40)} ${severity.padEnd(20)} ${category}`;
}
function colorSeverity(severity, chalk) {
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
//# sourceMappingURL=list-rules.js.map