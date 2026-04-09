/**
 * Code action provider for Pre-Flight quick fixes.
 *
 * Provides deterministic, regex-based fixes for common AEM findings.
 */

import * as vscode from 'vscode';

const JAVAX_TO_JAKARTA: Record<string, string> = {
  'javax.servlet': 'jakarta.servlet',
  'javax.annotation': 'jakarta.annotation',
  'javax.inject': 'jakarta.inject',
  'javax.json': 'jakarta.json',
  'javax.ws.rs': 'jakarta.ws.rs',
};

const SUN_REPLACEMENTS: Record<string, string> = {
  'sun.misc.BASE64Encoder': 'java.util.Base64.getEncoder()',
  'sun.misc.BASE64Decoder': 'java.util.Base64.getDecoder()',
};

export class PreFlightCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (!diagnostic.source || typeof diagnostic.source !== 'string') {
        continue;
      }

      const ruleId = diagnostic.source;
      const line = diagnostic.range.start.line;
      const lineText = document.lineAt(line).text;

      if (ruleId === 'JavaCompat:JavaxToJakarta') {
        actions.push(...this.javaxToJakartaActions(document, diagnostic, lineText, line));
      } else if (ruleId === 'JavaCompat:SunPackages') {
        actions.push(...this.sunPackageActions(document, diagnostic, lineText, line));
      } else if (ruleId === 'CQRules:ResourceResolverAutoClose') {
        actions.push(...this.resourceResolverActions(document, diagnostic, line));
      } else if (ruleId === 'OakPAL:AsyncFlag') {
        actions.push(...this.asyncFlagActions(document, diagnostic));
      }
    }

    return actions;
  }

  private javaxToJakartaActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    lineText: string,
    line: number,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const [javax, jakarta] of Object.entries(JAVAX_TO_JAKARTA)) {
      if (lineText.includes(javax)) {
        const newText = lineText.replace(javax, jakarta);
        const action = new vscode.CodeAction(
          `Replace ${javax} with ${jakarta}`,
          vscode.CodeActionKind.QuickFix,
        );
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode.Range(line, 0, line, lineText.length),
          newText,
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }
    }

    return actions;
  }

  private sunPackageActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    lineText: string,
    line: number,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const [sunPkg, replacement] of Object.entries(SUN_REPLACEMENTS)) {
      if (lineText.includes(sunPkg)) {
        const action = new vscode.CodeAction(
          `Replace ${sunPkg} with ${replacement}`,
          vscode.CodeActionKind.QuickFix,
        );
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode.Range(line, 0, line, lineText.length),
          lineText.replace(sunPkg, replacement),
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }
    }

    return actions;
  }

  private resourceResolverActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    line: number,
  ): vscode.CodeAction[] {
    const action = new vscode.CodeAction(
      'Add TODO: wrap in try-with-resources',
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      new vscode.Position(line, 0),
      '    // TODO: wrap in try-with-resources\n',
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return [action];
  }

  private asyncFlagActions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    // Find the jcr:primaryType or first <property> line to insert after
    const text = document.getText();
    const lines = text.split('\n');
    let insertLine = diagnostic.range.start.line;

    for (let i = 0; i < lines.length; i++) {
      if (/jcr:primaryType/.test(lines[i]) || /<property\b/.test(lines[i])) {
        insertLine = i + 1;
        break;
      }
    }

    const action = new vscode.CodeAction(
      'Add async="[async, nrt]" property',
      vscode.CodeActionKind.QuickFix,
    );
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      new vscode.Position(insertLine, 0),
      '    async="[async, nrt]"\n',
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return [action];
  }
}
