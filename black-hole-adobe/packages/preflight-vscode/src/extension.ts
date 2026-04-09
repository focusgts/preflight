/**
 * Black Hole Pre-Flight for AEM -- VS Code Extension entry point.
 *
 * Surfaces Cloud Manager quality gate violations as inline diagnostics
 * with quick-fix code actions, powered by @blackhole/preflight-engine.
 */

import * as vscode from 'vscode';
import { updateDiagnostics } from './diagnostics';
import { PreFlightCodeActionProvider } from './code-actions';
import { runWorkspace, runFile, explainRule, openDashboard } from './commands';
import { loadRcConfig, watchRcConfig, getConfig, disposeOutputChannel } from './config';
import { debounce, isSupported } from './utils';

const subscriptions: vscode.Disposable[] = [];

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Create diagnostic collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('preflight');
  context.subscriptions.push(diagnosticCollection);

  // Load workspace config
  await loadRcConfig();

  // Watch .preflightrc.json for changes
  const rcWatcher = watchRcConfig(() => {
    // Re-run diagnostics on all open documents when config changes
    for (const editor of vscode.window.visibleTextEditors) {
      if (isSupported(editor.document)) {
        updateDiagnostics(editor.document, diagnosticCollection);
      }
    }
  });
  if (rcWatcher) {
    context.subscriptions.push(rcWatcher);
  }

  // Debounced handler for on-type diagnostics
  const debouncedUpdate = debounce(
    (document: vscode.TextDocument) => {
      const config = getConfig();
      if (config.enable && config.runOnType && isSupported(document)) {
        updateDiagnostics(document, diagnosticCollection);
      }
    },
    500,
  );

  // Register on-type diagnostics
  const onChangeDisposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      debouncedUpdate(event.document);
    },
  );
  subscriptions.push(onChangeDisposable);
  context.subscriptions.push(onChangeDisposable);

  // Register on-save diagnostics
  const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(
    (document) => {
      const config = getConfig();
      if (config.enable && config.runOnSave && isSupported(document)) {
        updateDiagnostics(document, diagnosticCollection);
      }
    },
  );
  subscriptions.push(onSaveDisposable);
  context.subscriptions.push(onSaveDisposable);

  // Run diagnostics on already-open documents
  for (const editor of vscode.window.visibleTextEditors) {
    if (isSupported(editor.document)) {
      updateDiagnostics(editor.document, diagnosticCollection);
    }
  }

  // Register code action provider
  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    [{ language: 'java' }, { language: 'xml' }, { language: 'json' }],
    new PreFlightCodeActionProvider(),
    { providedCodeActionKinds: PreFlightCodeActionProvider.providedCodeActionKinds },
  );
  subscriptions.push(codeActionDisposable);
  context.subscriptions.push(codeActionDisposable);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('preflight.runWorkspace', () =>
      runWorkspace(diagnosticCollection),
    ),
    vscode.commands.registerCommand('preflight.runFile', () =>
      runFile(diagnosticCollection),
    ),
    vscode.commands.registerCommand('preflight.explainRule', explainRule),
    vscode.commands.registerCommand('preflight.openDashboard', openDashboard),
  );
}

export function deactivate(): void {
  for (const sub of subscriptions) {
    sub.dispose();
  }
  subscriptions.length = 0;
  disposeOutputChannel();
}
