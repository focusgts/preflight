/**
 * `preflight run` command
 *
 * Scans AEM project files and reports Cloud Manager quality gate violations.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  PreFlightEngine,
  type PreFlightItem,
  type PreFlightReport,
  type PreFlightSeverity,
} from '@blackhole/preflight-engine';
import { discoverFiles } from '../discovery/file-discovery';
import { loadConfig, type PreFlightConfig } from '../config/config-loader';
import { formatHuman } from '../formatters/human';
import { formatJson } from '../formatters/json';
import { formatSarif } from '../formatters/sarif';
import { formatJunit } from '../formatters/junit';
import { getStagedFiles, getChangedFilesSince } from '../utils/git';

const SEVERITY_ORDER: PreFlightSeverity[] = [
  'blocker',
  'critical',
  'major',
  'minor',
];

function severityAtOrAbove(
  severity: PreFlightSeverity,
  threshold: PreFlightSeverity
): boolean {
  return SEVERITY_ORDER.indexOf(severity) <= SEVERITY_ORDER.indexOf(threshold);
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run pre-flight checks against AEM project files')
    .argument('[paths...]', 'paths to scan (default: current directory)')
    .option('--staged', 'scan only git staged files')
    .option('--since <ref>', 'scan only files changed since a git ref')
    .option(
      '--format <format>',
      'output format: human, json, sarif, junit',
      'human'
    )
    .option(
      '--fail-on <severity>',
      'minimum severity to exit 1: blocker, critical, major, minor, none',
      'critical'
    )
    .option('--cloud', 'use cloud mode (coming soon)')
    .option('--config <path>', 'path to .preflightrc.json')
    .action(async (paths: string[], options: RunOptions) => {
      try {
        const exitCode = await runCommand(paths, options);
        process.exit(exitCode);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred';
        process.stderr.write(`Error: ${message}\n`);
        process.exit(2);
      }
    });
}

interface RunOptions {
  staged?: boolean;
  since?: string;
  format: string;
  failOn: string;
  cloud?: boolean;
  config?: string;
}

export async function runCommand(
  paths: string[],
  options: RunOptions
): Promise<number> {
  // Cloud mode stub
  if (options.cloud) {
    process.stdout.write(
      'Cloud mode coming soon. Visit https://blackhole.focusgts.com/preflight for now.\n'
    );
    return 0;
  }

  // Load config
  const configPath = options.config;
  const config = loadConfig(configPath);

  // Merge CLI options over config
  const failOn = options.failOn || config.failOn || 'critical';
  const format = options.format || 'human';

  // Validate format
  const validFormats = ['human', 'json', 'sarif', 'junit'];
  if (!validFormats.includes(format)) {
    process.stderr.write(
      `Invalid format "${format}". Valid formats: ${validFormats.join(', ')}\n`
    );
    return 2;
  }

  // Validate failOn
  const validFailOn = ['blocker', 'critical', 'major', 'minor', 'none'];
  if (!validFailOn.includes(failOn)) {
    process.stderr.write(
      `Invalid --fail-on "${failOn}". Valid values: ${validFailOn.join(', ')}\n`
    );
    return 2;
  }

  // Discover files
  let filePaths: string[];
  const scanPaths =
    paths.length > 0 ? paths.map((p) => path.resolve(p)) : [process.cwd()];

  if (options.staged) {
    filePaths = await getStagedFiles(scanPaths[0]);
  } else if (options.since) {
    filePaths = await getChangedFilesSince(options.since, scanPaths[0]);
  } else {
    filePaths = await discoverFiles(scanPaths, config);
  }

  if (filePaths.length === 0) {
    if (format === 'human') {
      process.stdout.write('No matching files found to scan.\n');
    }
    return 0;
  }

  // Read file contents
  const items: PreFlightItem[] = [];
  for (const fp of filePaths) {
    try {
      const content = fs.readFileSync(fp, 'utf-8');
      items.push({ path: fp, content });
    } catch {
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
  const engine = new PreFlightEngine();
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

  const threshold = failOn as PreFlightSeverity;
  const hasViolations = report.findings.some((f) =>
    severityAtOrAbove(f.severity, threshold)
  );

  return hasViolations ? 1 : 0;
}

function applyRuleOverrides(
  report: PreFlightReport,
  config: PreFlightConfig
): PreFlightReport {
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
        process.stderr.write(
          chalk.yellow(
            `[config] Rule ${ruleId} suppressed by .preflightrc.json override\n`
          )
        );
      } else {
        process.stderr.write(
          `[config] Rule ${ruleId} suppressed by .preflightrc.json override\n`
        );
      }
      continue;
    }

    if (override === 'warn') {
      if (chalk) {
        process.stderr.write(
          chalk.yellow(
            `[config] Rule ${ruleId} downgraded to minor by .preflightrc.json override\n`
          )
        );
      } else {
        process.stderr.write(
          `[config] Rule ${ruleId} downgraded to minor by .preflightrc.json override\n`
        );
      }
      overriddenFindings.push({ ...finding, severity: 'minor' as const });
      continue;
    }

    if (override === 'error') {
      if (chalk) {
        process.stderr.write(
          chalk.yellow(
            `[config] Rule ${ruleId} upgraded to blocker by .preflightrc.json override\n`
          )
        );
      } else {
        process.stderr.write(
          `[config] Rule ${ruleId} upgraded to blocker by .preflightrc.json override\n`
        );
      }
      overriddenFindings.push({ ...finding, severity: 'blocker' as const });
      continue;
    }

    overriddenFindings.push(finding);
  }

  // Rebuild summary counts
  const blockers = overriddenFindings.filter(
    (f) => f.severity === 'blocker'
  ).length;
  const criticals = overriddenFindings.filter(
    (f) => f.severity === 'critical'
  ).length;
  const majors = overriddenFindings.filter(
    (f) => f.severity === 'major'
  ).length;
  const minors = overriddenFindings.filter(
    (f) => f.severity === 'minor'
  ).length;

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

function formatOutput(report: PreFlightReport, format: string): string {
  switch (format) {
    case 'json':
      return formatJson(report);
    case 'sarif':
      return formatSarif(report);
    case 'junit':
      return formatJunit(report);
    case 'human':
    default:
      return formatHuman(report);
  }
}

function requireChalk(): typeof import('chalk') | null {
  try {
    return require('chalk');
  } catch {
    return null;
  }
}
