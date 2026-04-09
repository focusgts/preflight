/**
 * SARIF file generation for GitHub Code Scanning integration.
 *
 * Generates the SARIF 2.1.0 file and writes it to disk.
 * Actual upload to GitHub Code Scanning requires a subsequent
 * github/codeql-action/upload-sarif@v3 step in the workflow.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import type {
  PreFlightReport,
  PreFlightFinding,
  PreFlightSeverity,
} from '@blackhole/preflight-engine';

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  defaultConfiguration: { level: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number };
    };
  }>;
  fixes?: Array<{ description: { text: string } }>;
}

function severityToSarifLevel(severity: PreFlightSeverity): string {
  switch (severity) {
    case 'blocker':
    case 'critical':
      return 'error';
    case 'major':
      return 'warning';
    case 'minor':
      return 'note';
    default:
      return 'warning';
  }
}

/**
 * Generate a SARIF 2.1.0 log from a pre-flight report.
 */
export function generateSarif(report: PreFlightReport): string {
  const ruleMap = new Map<string, PreFlightFinding>();
  for (const finding of report.findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, finding);
    }
  }

  const rules: SarifRule[] = Array.from(ruleMap.values()).map((f) => ({
    id: f.ruleId,
    name: f.ruleName,
    shortDescription: { text: f.message },
    defaultConfiguration: { level: severityToSarifLevel(f.severity) },
  }));

  const results: SarifResult[] = report.findings.map((f) => {
    const result: SarifResult = {
      ruleId: f.ruleId,
      level: severityToSarifLevel(f.severity),
      message: { text: f.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.filePath },
            ...(f.line ? { region: { startLine: f.line } } : {}),
          },
        },
      ],
    };
    if (f.remediation) {
      result.fixes = [{ description: { text: f.remediation } }];
    }
    return result;
  });

  const sarif: SarifLog = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: '@blackhole/preflight',
            version: '0.1.0',
            informationUri: 'https://blackhole.focusgts.com/preflight',
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2) + '\n';
}

/**
 * Write SARIF file to RUNNER_TEMP and set the sarif-path output.
 */
export function writeSarifFile(report: PreFlightReport): string {
  const sarifContent = generateSarif(report);
  const tempDir = process.env.RUNNER_TEMP || '/tmp';
  const sarifPath = path.join(tempDir, 'preflight-results.sarif');

  fs.writeFileSync(sarifPath, sarifContent, 'utf-8');
  core.setOutput('sarif-path', sarifPath);
  core.info(`SARIF file written to ${sarifPath}`);

  return sarifPath;
}
