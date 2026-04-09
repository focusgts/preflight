"use strict";
/**
 * JUnit XML Output Formatter
 *
 * Produces JUnit XML compatible with CI systems like Jenkins, GitHub Actions, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatJunit = formatJunit;
/**
 * Escape special XML characters.
 */
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function formatJunit(report) {
    const totalTests = report.totalRulesChecked;
    const failures = report.findings.length;
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<testsuites>`,
        `  <testsuite name="preflight" tests="${totalTests}" failures="${failures}">`,
    ];
    for (const finding of report.findings) {
        const shortId = finding.ruleId.includes(':')
            ? finding.ruleId.split(':')[1]
            : finding.ruleId;
        const lineInfo = finding.line ? `Line ${finding.line}: ` : '';
        lines.push(`    <testcase name="${escapeXml(shortId)}" classname="${escapeXml(finding.filePath)}">`);
        lines.push(`      <failure message="${escapeXml(finding.message)}" type="${escapeXml(finding.severity)}">`);
        lines.push(`        ${escapeXml(lineInfo + finding.remediation)}`);
        lines.push(`      </failure>`);
        lines.push(`    </testcase>`);
    }
    lines.push(`  </testsuite>`);
    lines.push(`</testsuites>`);
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=junit.js.map