/**
 * Command palette commands for Pre-Flight VS Code extension.
 */

import * as vscode from 'vscode';
import { PreFlightEngine } from '@blackhole/preflight-engine';
import { updateDiagnostics } from './diagnostics';
import { isSupported } from './utils';

const engine = new PreFlightEngine();

const DASHBOARD_URL = 'https://blackhole.focusgts.com/preflight';

/**
 * Run pre-flight on every supported file in the workspace.
 */
export async function runWorkspace(
  collection: vscode.DiagnosticCollection,
): Promise<void> {
  const files = await vscode.workspace.findFiles(
    '**/*.{java,xml,cfg.json,jsp,jspx,content.xml}',
    '**/node_modules/**',
  );

  if (files.length === 0) {
    vscode.window.showInformationMessage('Pre-Flight: No supported files found in workspace.');
    return;
  }

  let scanned = 0;
  for (const fileUri of files) {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      if (isSupported(document)) {
        updateDiagnostics(document, collection);
        scanned++;
      }
    } catch {
      // Skip files that cannot be opened
    }
  }

  vscode.window.showInformationMessage(
    `Pre-Flight: Scanned ${scanned} file${scanned !== 1 ? 's' : ''}.`,
  );
}

/**
 * Run pre-flight on the currently active editor's file.
 */
export function runFile(collection: vscode.DiagnosticCollection): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Pre-Flight: No active editor.');
    return;
  }

  if (!isSupported(editor.document)) {
    vscode.window.showWarningMessage(
      'Pre-Flight: Current file is not a supported type (java, xml, cfg.json).',
    );
    return;
  }

  updateDiagnostics(editor.document, collection);
  vscode.window.showInformationMessage('Pre-Flight: Scan complete.');
}

/**
 * Show a QuickPick of all rules. On select, display rule details.
 */
export async function explainRule(): Promise<void> {
  const rules = engine.getRules();

  const items = rules.map((rule) => ({
    label: rule.id,
    description: `[${rule.severity}] ${rule.category}`,
    detail: rule.name,
    rule,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a rule to see its details',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!selected) return;

  const { rule } = selected;
  const message = [
    `Rule: ${rule.id} - ${rule.name}`,
    `Severity: ${rule.severity}`,
    `Category: ${rule.category}`,
    ``,
    rule.description,
    ``,
    `Remediation: ${rule.remediation}`,
  ].join('\n');

  vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Open the Pre-Flight dashboard in the default browser.
 */
export function openDashboard(): void {
  vscode.env.openExternal(vscode.Uri.parse(DASHBOARD_URL));
}
