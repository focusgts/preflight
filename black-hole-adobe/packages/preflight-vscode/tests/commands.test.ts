/**
 * Tests for command palette commands.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from './__mocks__/vscode';
import { explainRule, openDashboard, runFile } from '../src/commands';

// We need to reference the mock module for spies
const mockVscode = vscode;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('explainRule', () => {
  it('should present all 16 rules in quick pick', async () => {
    let pickItems: unknown[] = [];
    vi.spyOn(mockVscode.window, 'showQuickPick').mockImplementation(
      async (items: unknown) => {
        pickItems = items as unknown[];
        return undefined; // user cancels
      },
    );

    await explainRule();

    expect(pickItems.length).toBe(16);
    const labels = pickItems.map((item: { label: string }) => item.label);
    expect(labels).toContain('CQRules:ConnectionTimeoutMechanism');
    expect(labels).toContain('JavaCompat:JavaxToJakarta');
    expect(labels).toContain('OakPAL:AsyncFlag');
  });
});

describe('openDashboard', () => {
  it('should call openExternal with the correct URL', () => {
    const spy = vi.spyOn(mockVscode.env, 'openExternal');
    openDashboard();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.toString()).toContain('blackhole.focusgts.com/preflight');
  });
});

describe('runFile', () => {
  it('should show warning when no active editor', () => {
    const spy = vi.spyOn(mockVscode.window, 'showWarningMessage');
    mockVscode.window.activeTextEditor = undefined;

    const collection = mockVscode.languages.createDiagnosticCollection('preflight');
    runFile(collection as never);

    expect(spy).toHaveBeenCalledWith('Pre-Flight: No active editor.');
  });

  it('should produce diagnostics for active editor with violations', () => {
    const doc = vscode.createMockDocument(
      'import javax.servlet.http.HttpServletRequest;\npublic class X {}',
      '/test/X.java',
    );
    mockVscode.window.activeTextEditor = { document: doc };

    const collection = mockVscode.languages.createDiagnosticCollection('preflight');
    runFile(collection as never);

    const stored = (collection as { _store: Map<string, unknown[]> })._store;
    // Should have diagnostics stored for the file URI
    expect(stored.size).toBe(1);
    const diags = [...stored.values()][0] as unknown[];
    expect(diags.length).toBeGreaterThanOrEqual(1);
  });
});
