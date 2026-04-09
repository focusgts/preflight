/**
 * Diagnostic provider for Pre-Flight VS Code extension.
 *
 * Runs the preflight engine on supported documents and maps findings
 * to VS Code diagnostics with proper severity, source, and code links.
 */

import * as vscode from 'vscode';
import { PreFlightEngine } from '@blackhole/preflight-engine';
import type { PreFlightFinding } from '@blackhole/preflight-engine';
import { getConfig } from './config';
import { isSupported, severityToVscode, meetsThreshold } from './utils';

const engine = new PreFlightEngine();

/**
 * Apply rule overrides from config.
 * "off" suppresses the finding entirely.
 * "warn" downgrades severity to Information.
 */
function applyOverride(
  finding: PreFlightFinding,
  rules: Record<string, string>,
): { skip: boolean; severity: vscode.DiagnosticSeverity } {
  const override = rules[finding.ruleId];
  if (override === 'off') {
    return { skip: true, severity: vscode.DiagnosticSeverity.Error };
  }
  if (override === 'warn') {
    return { skip: false, severity: vscode.DiagnosticSeverity.Information };
  }
  return { skip: false, severity: severityToVscode(finding.severity) };
}

/**
 * Run the preflight engine against a TextDocument and return diagnostics.
 */
export function computeDiagnostics(
  document: vscode.TextDocument,
): vscode.Diagnostic[] {
  if (!isSupported(document)) {
    return [];
  }

  const config = getConfig();
  if (!config.enable) {
    return [];
  }

  const start = Date.now();
  const report = engine.runPreFlight([
    { path: document.fileName, content: document.getText() },
  ]);
  const elapsed = Date.now() - start;

  if (elapsed > 50) {
    console.warn(
      `[Pre-Flight] Scan of ${document.fileName} took ${elapsed}ms (>50ms threshold)`,
    );
  }

  const diagnostics: vscode.Diagnostic[] = [];

  for (const finding of report.findings) {
    const { skip, severity } = applyOverride(finding, config.rules);
    if (skip) continue;

    if (!meetsThreshold(finding.severity, config.severityThreshold)) {
      continue;
    }

    // Line is 1-based from engine, VS Code is 0-based
    const line = finding.line ? finding.line - 1 : 0;
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(
      new vscode.Position(line, 0),
      new vscode.Position(line, lineText.length),
    );

    const diag = new vscode.Diagnostic(range, finding.message, severity);
    diag.source = finding.ruleId;
    diag.code = {
      value: finding.ruleId,
      target: vscode.Uri.parse(
        `https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/code-quality-testing.html`,
      ),
    };

    diagnostics.push(diag);
  }

  return diagnostics;
}

/**
 * Update diagnostics for a single document in the collection.
 */
export function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
): void {
  const diagnostics = computeDiagnostics(document);
  collection.set(document.uri, diagnostics);
}
