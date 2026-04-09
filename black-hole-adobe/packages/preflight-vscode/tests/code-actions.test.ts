/**
 * Tests for the code action provider.
 */

import { describe, it, expect } from 'vitest';
import {
  createMockDocument,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  WorkspaceEdit,
} from './__mocks__/vscode';
import { PreFlightCodeActionProvider } from '../src/code-actions';

function makeDiag(
  source: string,
  line: number,
  message: string,
): Diagnostic {
  const diag = new Diagnostic(
    new Range(line, 0, line, 80),
    message,
    DiagnosticSeverity.Error,
  );
  diag.source = source;
  return diag;
}

describe('PreFlightCodeActionProvider', () => {
  const provider = new PreFlightCodeActionProvider();

  it('should offer javax->jakarta replacement for JavaxToJakarta diagnostic', () => {
    const doc = createMockDocument(
      'import javax.servlet.http.HttpServletRequest;',
      '/test/Foo.java',
    );
    const diag = makeDiag(
      'JavaCompat:JavaxToJakarta',
      0,
      'Uses javax.servlet namespace',
    );
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].title).toContain('javax.servlet');
    expect(actions[0].title).toContain('jakarta.servlet');
    expect(actions[0].isPreferred).toBe(true);
  });

  it('should offer sun.misc replacement for SunPackages diagnostic', () => {
    const doc = createMockDocument(
      'import sun.misc.BASE64Encoder;',
      '/test/Foo.java',
    );
    const diag = makeDiag(
      'JavaCompat:SunPackages',
      0,
      'Uses sun.misc',
    );
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].title).toContain('sun.misc.BASE64Encoder');
    expect(actions[0].title).toContain('Base64.getEncoder()');
  });

  it('should offer insert-async action for AsyncFlag diagnostic', () => {
    const content = [
      '<?xml version="1.0"?>',
      '<oak:index jcr:primaryType="oak:QueryIndexDefinition"',
      '  type="lucene">',
      '</oak:index>',
    ].join('\n');
    const doc = createMockDocument(content, '/test/_oak_index/idx.xml');
    const diag = makeDiag('OakPAL:AsyncFlag', 0, 'Missing async flag');
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions.length).toBe(1);
    expect(actions[0].title).toContain('async');
  });

  it('should offer TODO comment for ResourceResolverAutoClose diagnostic', () => {
    const content = [
      'ResourceResolver rr = factory.getServiceResourceResolver(params);',
      'rr.getResource("/content");',
    ].join('\n');
    const doc = createMockDocument(content, '/test/Svc.java');
    const diag = makeDiag(
      'CQRules:ResourceResolverAutoClose',
      0,
      'ResourceResolver not closed',
    );
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions.length).toBe(1);
    expect(actions[0].title).toContain('TODO');
    expect(actions[0].title).toContain('try-with-resources');
  });

  it('should return no actions for non-preflight diagnostics', () => {
    const doc = createMockDocument(
      'public class Foo {}',
      '/test/Foo.java',
    );
    const diag = new Diagnostic(
      new Range(0, 0, 0, 20),
      'Some other linter warning',
      DiagnosticSeverity.Warning,
    );
    // source is undefined -- not from preflight
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions).toHaveLength(0);
  });

  it('should produce correct text edits for javax->jakarta replacement', () => {
    const doc = createMockDocument(
      'import javax.inject.Inject;',
      '/test/Foo.java',
    );
    const diag = makeDiag(
      'JavaCompat:JavaxToJakarta',
      0,
      'Uses javax.inject namespace',
    );
    const actions = provider.provideCodeActions(
      doc as never,
      new Range(0, 0, 0, 80),
      { diagnostics: [diag], only: undefined, triggerKind: 1 } as never,
    );
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const edit = actions[0].edit as WorkspaceEdit;
    expect(edit).toBeDefined();
    const edits = edit.edits;
    expect(edits.length).toBe(1);
    expect(edits[0].newText).toBe('import jakarta.inject.Inject;');
  });
});
