/**
 * Human-Readable Output Formatter
 *
 * Colorized, grouped-by-severity output for terminal display.
 */

import type {
  PreFlightReport,
  PreFlightFinding,
  PreFlightSeverity,
} from '@blackhole/preflight-engine';

let chalk: typeof import('chalk') | null = null;
try {
  chalk = require('chalk');
} catch {
  // chalk not available, output without colors
}

const SEVERITY_ORDER: PreFlightSeverity[] = [
  'blocker',
  'critical',
  'major',
  'minor',
];

export function formatHuman(report: PreFlightReport): string {
  const lines: string[] = [];

  if (report.findings.length === 0) {
    lines.push('');
    lines.push(
      colorize('green', `Pre-Flight Results: 0 findings -- all clear`)
    );
    lines.push('');
    return lines.join('\n');
  }

  lines.push('');
  lines.push(`Pre-Flight Results: ${report.findings.length} findings`);
  lines.push('');

  // Group by severity
  for (const severity of SEVERITY_ORDER) {
    const findings = report.findings.filter((f) => f.severity === severity);
    if (findings.length === 0) continue;

    const label = severityLabel(severity, findings.length);
    lines.push(label);

    for (const finding of findings) {
      const location = finding.line
        ? `${finding.filePath}:${finding.line}`
        : finding.filePath;
      lines.push(`  ${location}`);
      lines.push(`    [${shortRuleId(finding.ruleId)}] ${finding.message}`);
      lines.push(
        `    ${colorize('gray', '->')} ${finding.remediation}`
      );
    }

    lines.push('');
  }

  // Summary line
  const summaryParts: string[] = [];
  if (report.summary.blockers > 0) {
    summaryParts.push(
      colorize('red', `${report.summary.blockers} blocker${report.summary.blockers !== 1 ? 's' : ''}`)
    );
  }
  if (report.summary.criticals > 0) {
    summaryParts.push(
      colorize('yellow', `${report.summary.criticals} critical`)
    );
  }
  if (report.summary.majors > 0) {
    summaryParts.push(
      colorize('blue', `${report.summary.majors} major`)
    );
  }
  if (report.summary.minors > 0) {
    summaryParts.push(
      colorize('gray', `${report.summary.minors} minor`)
    );
  }

  const hasBlockersOrCriticals =
    report.summary.blockers > 0 || report.summary.criticals > 0;
  const marker = hasBlockersOrCriticals
    ? colorize('red', 'x')
    : colorize('yellow', '!');

  lines.push(
    `${marker} ${summaryParts.join(', ')} -- ${hasBlockersOrCriticals ? 'pipeline will fail' : 'review recommended'}`
  );
  lines.push('');

  return lines.join('\n');
}

function severityLabel(severity: PreFlightSeverity, count: number): string {
  const upper = severity.toUpperCase();
  const label = `${upper} (${count})`;

  switch (severity) {
    case 'blocker':
      return colorize('red', label);
    case 'critical':
      return colorize('yellow', label);
    case 'major':
      return colorize('blue', label);
    case 'minor':
      return colorize('gray', label);
    default:
      return label;
  }
}

function shortRuleId(ruleId: string): string {
  return ruleId.includes(':') ? ruleId.split(':')[1] : ruleId;
}

function colorize(
  color: 'red' | 'yellow' | 'blue' | 'gray' | 'green',
  text: string
): string {
  if (!chalk) return text;
  switch (color) {
    case 'red':
      return chalk.red(text);
    case 'yellow':
      return chalk.yellow(text);
    case 'blue':
      return chalk.blue(text);
    case 'gray':
      return chalk.gray(text);
    case 'green':
      return chalk.green(text);
    default:
      return text;
  }
}
