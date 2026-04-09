/**
 * Formatter Tests
 */

import { describe, it, expect } from 'vitest';
import type { PreFlightReport } from '@blackhole/preflight-engine';
import { formatHuman } from '../src/formatters/human';
import { formatJson } from '../src/formatters/json';
import { formatSarif } from '../src/formatters/sarif';
import { formatJunit } from '../src/formatters/junit';

function makeReport(findingsCount: number): PreFlightReport {
  const findings = [];
  if (findingsCount >= 1) {
    findings.push({
      ruleId: 'JavaCompat:SunPackages',
      ruleName: 'sun.* Package Usage',
      severity: 'blocker' as const,
      category: 'java-compat' as const,
      filePath: 'src/main/java/Foo.java',
      line: 3,
      message: 'Uses internal sun.* packages',
      remediation: 'Replace with java.util.Base64',
    });
  }
  if (findingsCount >= 2) {
    findings.push({
      ruleId: 'JavaCompat:JavaxToJakarta',
      ruleName: 'javax.* to jakarta.* Migration',
      severity: 'critical' as const,
      category: 'java-compat' as const,
      filePath: 'src/main/java/Bar.java',
      line: 5,
      message: 'Uses javax.servlet namespace',
      remediation: 'Replace with jakarta.servlet',
    });
  }
  if (findingsCount >= 3) {
    findings.push({
      ruleId: 'OakPAL:CompatVersion',
      ruleName: 'Index compatVersion >= 2',
      severity: 'major' as const,
      category: 'oakpal' as const,
      filePath: 'index/.content.xml',
      message: 'compatVersion is 1',
      remediation: 'Set compatVersion to 2',
    });
  }

  return {
    id: 'test-report',
    timestamp: '2026-04-08T00:00:00Z',
    totalRulesChecked: 16,
    passCount: 16 - findings.length,
    failCount: findings.filter(
      (f) => f.severity === 'blocker' || f.severity === 'critical'
    ).length,
    warningCount: findings.filter((f) => f.severity === 'major').length,
    findings,
    successProbability: 0.5,
    bpaComparisonNote: 'Test note',
    summary: {
      blockers: findings.filter((f) => f.severity === 'blocker').length,
      criticals: findings.filter((f) => f.severity === 'critical').length,
      majors: findings.filter((f) => f.severity === 'major').length,
      minors: 0,
      topBlockers: findings
        .filter((f) => f.severity === 'blocker')
        .map((f) => f.message),
      topRemediations: findings.map((f) => f.remediation),
    },
  };
}

describe('Human Formatter', () => {
  it('shows all-clear for empty findings', () => {
    const output = formatHuman(makeReport(0));
    expect(output).toContain('0 findings');
    expect(output).toContain('all clear');
  });

  it('groups findings by severity', () => {
    const output = formatHuman(makeReport(3));
    expect(output).toContain('BLOCKER');
    expect(output).toContain('CRITICAL');
    expect(output).toContain('MAJOR');
    expect(output).toContain('SunPackages');
    expect(output).toContain('JavaxToJakarta');
  });

  it('shows pipeline will fail when blockers present', () => {
    const output = formatHuman(makeReport(1));
    expect(output).toContain('pipeline will fail');
  });

  it('shows file:line locations', () => {
    const output = formatHuman(makeReport(1));
    expect(output).toContain('src/main/java/Foo.java:3');
  });
});

describe('JSON Formatter', () => {
  it('produces valid JSON', () => {
    const output = formatJson(makeReport(2));
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
    expect(parsed.findings).toHaveLength(2);
  });

  it('includes all report fields', () => {
    const output = formatJson(makeReport(1));
    const parsed = JSON.parse(output);
    expect(parsed.id).toBeDefined();
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.findings).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.successProbability).toBeDefined();
  });
});

describe('SARIF Formatter', () => {
  it('produces valid SARIF 2.1.0 structure', () => {
    const output = formatSarif(makeReport(2));
    const parsed = JSON.parse(output);

    expect(parsed.$schema).toContain('sarif-schema-2.1.0');
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe('@blackhole/preflight');
  });

  it('maps findings to SARIF results', () => {
    const output = formatSarif(makeReport(2));
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].results[0].ruleId).toBe('JavaCompat:SunPackages');
    expect(parsed.runs[0].results[0].level).toBe('error');
  });

  it('includes rules array', () => {
    const output = formatSarif(makeReport(2));
    const parsed = JSON.parse(output);

    expect(parsed.runs[0].tool.driver.rules).toHaveLength(2);
  });

  it('maps severity to SARIF levels correctly', () => {
    const output = formatSarif(makeReport(3));
    const parsed = JSON.parse(output);
    const results = parsed.runs[0].results;

    // blocker -> error
    expect(results[0].level).toBe('error');
    // critical -> error
    expect(results[1].level).toBe('error');
    // major -> warning
    expect(results[2].level).toBe('warning');
  });
});

describe('JUnit Formatter', () => {
  it('produces valid XML structure', () => {
    const output = formatJunit(makeReport(2));
    expect(output).toContain('<?xml version="1.0"');
    expect(output).toContain('<testsuites>');
    expect(output).toContain('</testsuites>');
    expect(output).toContain('<testsuite');
    expect(output).toContain('</testsuite>');
  });

  it('includes failure elements for each finding', () => {
    const output = formatJunit(makeReport(2));
    expect(output).toContain('<failure');
    // Count failure elements
    const failureCount = (output.match(/<failure/g) || []).length;
    expect(failureCount).toBe(2);
  });

  it('escapes XML special characters', () => {
    const report = makeReport(0);
    report.findings.push({
      ruleId: 'Test:Rule',
      ruleName: 'Test <Rule> & "More"',
      severity: 'major',
      category: 'sonarqube',
      filePath: 'path/to/file.java',
      message: 'Contains <special> & "chars"',
      remediation: 'Fix the <issue>',
    });
    report.summary.majors = 1;

    const output = formatJunit(report);
    expect(output).toContain('&lt;special&gt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&quot;chars&quot;');
  });

  it('shows correct test count and failure count', () => {
    const output = formatJunit(makeReport(3));
    expect(output).toContain('tests="16"');
    expect(output).toContain('failures="3"');
  });
});
