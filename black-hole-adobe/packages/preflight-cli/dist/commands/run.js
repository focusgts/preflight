"use strict";
/**
 * `preflight run` command
 *
 * Scans AEM project files and reports Cloud Manager quality gate violations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRunCommand = registerRunCommand;
exports.runCommand = runCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const preflight_engine_1 = require("@blackhole/preflight-engine");
const file_discovery_1 = require("../discovery/file-discovery");
const config_loader_1 = require("../config/config-loader");
const human_1 = require("../formatters/human");
const json_1 = require("../formatters/json");
const sarif_1 = require("../formatters/sarif");
const junit_1 = require("../formatters/junit");
const git_1 = require("../utils/git");
const SEVERITY_ORDER = [
    'blocker',
    'critical',
    'major',
    'minor',
];
function severityAtOrAbove(severity, threshold) {
    return SEVERITY_ORDER.indexOf(severity) <= SEVERITY_ORDER.indexOf(threshold);
}
function registerRunCommand(program) {
    program
        .command('run')
        .description('Run pre-flight checks against AEM project files')
        .argument('[paths...]', 'paths to scan (default: current directory)')
        .option('--staged', 'scan only git staged files')
        .option('--since <ref>', 'scan only files changed since a git ref')
        .option('--format <format>', 'output format: human, json, sarif, junit', 'human')
        .option('--fail-on <severity>', 'minimum severity to exit 1: blocker, critical, major, minor, none', 'critical')
        .option('--cloud', 'use cloud mode (coming soon)')
        .option('--config <path>', 'path to .preflightrc.json')
        .action(async (paths, options) => {
        try {
            const exitCode = await runCommand(paths, options);
            process.exit(exitCode);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred';
            process.stderr.write(`Error: ${message}\n`);
            process.exit(2);
        }
    });
}
async function runCommand(paths, options) {
    // Cloud mode stub
    if (options.cloud) {
        process.stdout.write('Cloud mode coming soon. Visit https://blackhole.focusgts.com/preflight for now.\n');
        return 0;
    }
    // Load config
    const configPath = options.config;
    const config = (0, config_loader_1.loadConfig)(configPath);
    // Merge CLI options over config
    const failOn = options.failOn || config.failOn || 'critical';
    const format = options.format || 'human';
    // Validate format
    const validFormats = ['human', 'json', 'sarif', 'junit'];
    if (!validFormats.includes(format)) {
        process.stderr.write(`Invalid format "${format}". Valid formats: ${validFormats.join(', ')}\n`);
        return 2;
    }
    // Validate failOn
    const validFailOn = ['blocker', 'critical', 'major', 'minor', 'none'];
    if (!validFailOn.includes(failOn)) {
        process.stderr.write(`Invalid --fail-on "${failOn}". Valid values: ${validFailOn.join(', ')}\n`);
        return 2;
    }
    // Discover files
    let filePaths;
    const scanPaths = paths.length > 0 ? paths.map((p) => path.resolve(p)) : [process.cwd()];
    if (options.staged) {
        filePaths = await (0, git_1.getStagedFiles)(scanPaths[0]);
    }
    else if (options.since) {
        filePaths = await (0, git_1.getChangedFilesSince)(options.since, scanPaths[0]);
    }
    else {
        filePaths = await (0, file_discovery_1.discoverFiles)(scanPaths, config);
    }
    if (filePaths.length === 0) {
        if (format === 'human') {
            process.stdout.write('No matching files found to scan.\n');
        }
        return 0;
    }
    // Read file contents
    const items = [];
    for (const fp of filePaths) {
        try {
            const content = fs.readFileSync(fp, 'utf-8');
            items.push({ path: fp, content });
        }
        catch {
            // Skip unreadable files
        }
    }
    if (items.length === 0) {
        if (format === 'human') {
            process.stdout.write('No readable files found to scan.\n');
        }
        return 0;
    }
    // Run engine
    const engine = new preflight_engine_1.PreFlightEngine();
    let report = engine.runPreFlight(items);
    // Apply rule overrides from config
    report = applyRuleOverrides(report, config);
    // Format output
    const output = formatOutput(report, format);
    process.stdout.write(output);
    // Determine exit code
    if (failOn === 'none') {
        return 0;
    }
    const threshold = failOn;
    const hasViolations = report.findings.some((f) => severityAtOrAbove(f.severity, threshold));
    return hasViolations ? 1 : 0;
}
function applyRuleOverrides(report, config) {
    if (!config.rules || Object.keys(config.rules).length === 0) {
        return report;
    }
    const chalk = requireChalk();
    const overriddenFindings = [];
    let suppressedCount = 0;
    for (const finding of report.findings) {
        const ruleId = finding.ruleId;
        // Check both full ID and short form (after colon)
        const shortId = ruleId.includes(':') ? ruleId.split(':')[1] : ruleId;
        const override = config.rules[ruleId] || config.rules[shortId];
        if (override === 'off') {
            suppressedCount++;
            if (chalk) {
                process.stderr.write(chalk.yellow(`[config] Rule ${ruleId} suppressed by .preflightrc.json override\n`));
            }
            else {
                process.stderr.write(`[config] Rule ${ruleId} suppressed by .preflightrc.json override\n`);
            }
            continue;
        }
        if (override === 'warn') {
            if (chalk) {
                process.stderr.write(chalk.yellow(`[config] Rule ${ruleId} downgraded to minor by .preflightrc.json override\n`));
            }
            else {
                process.stderr.write(`[config] Rule ${ruleId} downgraded to minor by .preflightrc.json override\n`);
            }
            overriddenFindings.push({ ...finding, severity: 'minor' });
            continue;
        }
        if (override === 'error') {
            if (chalk) {
                process.stderr.write(chalk.yellow(`[config] Rule ${ruleId} upgraded to blocker by .preflightrc.json override\n`));
            }
            else {
                process.stderr.write(`[config] Rule ${ruleId} upgraded to blocker by .preflightrc.json override\n`);
            }
            overriddenFindings.push({ ...finding, severity: 'blocker' });
            continue;
        }
        overriddenFindings.push(finding);
    }
    // Rebuild summary counts
    const blockers = overriddenFindings.filter((f) => f.severity === 'blocker').length;
    const criticals = overriddenFindings.filter((f) => f.severity === 'critical').length;
    const majors = overriddenFindings.filter((f) => f.severity === 'major').length;
    const minors = overriddenFindings.filter((f) => f.severity === 'minor').length;
    return {
        ...report,
        findings: overriddenFindings,
        failCount: blockers + criticals,
        warningCount: majors,
        summary: {
            ...report.summary,
            blockers,
            criticals,
            majors,
            minors,
            topBlockers: overriddenFindings
                .filter((f) => f.severity === 'blocker')
                .map((f) => `${f.ruleId}: ${f.message}`)
                .slice(0, 5),
            topRemediations: overriddenFindings
                .filter((f) => f.severity === 'blocker' || f.severity === 'critical')
                .map((f) => f.remediation)
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 5),
        },
    };
}
function formatOutput(report, format) {
    switch (format) {
        case 'json':
            return (0, json_1.formatJson)(report);
        case 'sarif':
            return (0, sarif_1.formatSarif)(report);
        case 'junit':
            return (0, junit_1.formatJunit)(report);
        case 'human':
        default:
            return (0, human_1.formatHuman)(report);
    }
}
function requireChalk() {
    try {
        return require('chalk');
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=run.js.map