/**
 * Tests for the diagnostics provider.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockDocument,
  DiagnosticSeverity,
  __setConfigValue,
  __clearConfigValues,
} from './__mocks__/vscode';
import { computeDiagnostics } from '../src/diagnostics';

beforeEach(() => {
  __clearConfigValues();
});

describe('computeDiagnostics', () => {
  it('should produce JavaxToJakarta diagnostic for javax.servlet import', () => {
    const doc = createMockDocument(
      'import javax.servlet.http.HttpServletRequest;\n\npublic class Foo {}',
      '/test/Foo.java',
    );
    const diags = computeDiagnostics(doc as never);
    const javaxDiag = diags.find((d) => d.source === 'JavaCompat:JavaxToJakarta');
    expect(javaxDiag).toBeDefined();
    expect(javaxDiag!.range.start.line).toBe(0);
    expect(javaxDiag!.severity).toBe(DiagnosticSeverity.Error);
  });

  it('should produce SunPackages diagnostic for sun.misc import', () => {
    const doc = createMockDocument(
      'import sun.misc.BASE64Encoder;\n\npublic class Foo {}',
      '/test/Foo.java',
    );
    const diags = computeDiagnostics(doc as never);
    const sunDiag = diags.find((d) => d.source === 'JavaCompat:SunPackages');
    expect(sunDiag).toBeDefined();
    expect(sunDiag!.severity).toBe(DiagnosticSeverity.Error);
  });

  it('should produce AsyncFlag diagnostic for XML index without async', () => {
    const content = [
      '<?xml version="1.0"?>',
      '<oak:index jcr:primaryType="oak:QueryIndexDefinition"',
      '  type="lucene"',
      '  compatVersion="{Long}2">',
      '</oak:index>',
    ].join('\n');
    const doc = createMockDocument(content, '/test/_oak_index/myindex.xml');
    const diags = computeDiagnostics(doc as never);
    const asyncDiag = diags.find((d) => d.source === 'OakPAL:AsyncFlag');
    expect(asyncDiag).toBeDefined();
    expect(asyncDiag!.severity).toBe(DiagnosticSeverity.Error);
  });

  it('should produce no diagnostics for a clean Java file', () => {
    const doc = createMockDocument(
      'import java.util.List;\n\npublic class Clean {\n  void foo() {}\n}',
      '/test/Clean.java',
    );
    const diags = computeDiagnostics(doc as never);
    expect(diags).toHaveLength(0);
  });

  it('should suppress finding when rule override is "off"', () => {
    __setConfigValue('preflight.rules', { 'JavaCompat:JavaxToJakarta': 'off' });
    const doc = createMockDocument(
      'import javax.servlet.http.HttpServletRequest;\n\npublic class Foo {}',
      '/test/Foo.java',
    );
    const diags = computeDiagnostics(doc as never);
    const javaxDiag = diags.find((d) => d.source === 'JavaCompat:JavaxToJakarta');
    expect(javaxDiag).toBeUndefined();
  });

  it('should downgrade severity to Information when rule override is "warn"', () => {
    __setConfigValue('preflight.rules', { 'JavaCompat:JavaxToJakarta': 'warn' });
    const doc = createMockDocument(
      'import javax.servlet.http.HttpServletRequest;\n\npublic class Foo {}',
      '/test/Foo.java',
    );
    const diags = computeDiagnostics(doc as never);
    const javaxDiag = diags.find((d) => d.source === 'JavaCompat:JavaxToJakarta');
    expect(javaxDiag).toBeDefined();
    expect(javaxDiag!.severity).toBe(DiagnosticSeverity.Information);
  });

  it('should filter by severity threshold', () => {
    __setConfigValue('preflight.severityThreshold', 'critical');
    // This file triggers a "major" severity rule (ContentClassification)
    const doc = createMockDocument(
      'String path = "/libs/cq/core/content";\npublic class Foo {}',
      '/test/Foo.java',
    );
    const diags = computeDiagnostics(doc as never);
    const majorDiags = diags.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    );
    expect(majorDiags).toHaveLength(0);
  });

  it('should report multiple findings in one file', () => {
    const content = [
      'import javax.servlet.http.HttpServletRequest;',
      'import sun.misc.BASE64Encoder;',
      '',
      'public class Bad {',
      '  void foo() {}',
      '}',
    ].join('\n');
    const doc = createMockDocument(content, '/test/Bad.java');
    const diags = computeDiagnostics(doc as never);
    expect(diags.length).toBeGreaterThanOrEqual(2);
    const sources = diags.map((d) => d.source);
    expect(sources).toContain('JavaCompat:JavaxToJakarta');
    expect(sources).toContain('JavaCompat:SunPackages');
  });

  it('should return empty array for unsupported file types', () => {
    const doc = createMockDocument(
      'const x = 1;',
      '/test/file.ts',
      'typescript',
    );
    const diags = computeDiagnostics(doc as never);
    expect(diags).toHaveLength(0);
  });

  it('should produce ResourceResolverAutoClose diagnostic', () => {
    const content = [
      'import org.apache.sling.api.resource.ResourceResolver;',
      '',
      'public class Svc {',
      '  void doStuff() {',
      '    ResourceResolver rr = factory.getServiceResourceResolver(params);',
      '    rr.getResource("/content");',
      '  }',
      '}',
    ].join('\n');
    const doc = createMockDocument(content, '/test/Svc.java');
    const diags = computeDiagnostics(doc as never);
    const rrDiag = diags.find(
      (d) => d.source === 'CQRules:ResourceResolverAutoClose',
    );
    expect(rrDiag).toBeDefined();
  });
});
