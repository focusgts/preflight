/**
 * `preflight list-rules` command
 *
 * Lists all available pre-flight rules with their severity and category.
 */

import { Command } from 'commander';
import { PreFlightEngine } from '@blackhole/preflight-engine';

export function registerListRulesCommand(program: Command): void {
  program
    .command('list-rules')
    .description('List all available pre-flight rules')
    .option('--format <format>', 'output format: table, json', 'table')
    .action((options: { format: string }) => {
      const exitCode = listRulesCommand(options.format);
      process.exit(exitCode);
    });
}

export function listRulesCommand(format: string): number {
  const engine = new PreFlightEngine();
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
  let chalk: typeof import('chalk') | null = null;
  try {
    chalk = require('chalk');
  } catch {
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

function padRow(
  id: string,
  name: string,
  severity: string,
  category: string
): string {
  return `  ${id.padEnd(38)} ${name.padEnd(40)} ${severity.padEnd(20)} ${category}`;
}

function colorSeverity(
  severity: string,
  chalk: typeof import('chalk') | null
): string {
  if (!chalk) return severity;
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
