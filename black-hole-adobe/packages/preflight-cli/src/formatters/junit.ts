/**
 * JUnit XML Output Formatter
 *
 * Produces JUnit XML compatible with CI systems like Jenkins, GitHub Actions, etc.
 */

import type { PreFlightReport } from '@blackhole/preflight-engine';

/**
 * Escape special XML characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatJunit(report: PreFlightReport): string {
  const totalTests = report.totalRulesChecked;
  const failures = report.findings.length;

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites>`,
    `  <testsuite name="preflight" tests="${totalTests}" failures="${failures}">`,
  ];

  for (const finding of report.findings) {
    const shortId = finding.ruleId.includes(':')
      ? finding.ruleId.split(':')[1]
      : finding.ruleId;
    const lineInfo = finding.line ? `Line ${finding.line}: ` : '';

    lines.push(
      `    <testcase name="${escapeXml(shortId)}" classname="${escapeXml(finding.filePath)}">`
    );
    lines.push(
      `      <failure message="${escapeXml(finding.message)}" type="${escapeXml(finding.severity)}">`
    );
    lines.push(
      `        ${escapeXml(lineInfo + finding.remediation)}`
    );
    lines.push(`      </failure>`);
    lines.push(`    </testcase>`);
  }

  lines.push(`  </testsuite>`);
  lines.push(`</testsuites>`);
  lines.push('');

  return lines.join('\n');
}
