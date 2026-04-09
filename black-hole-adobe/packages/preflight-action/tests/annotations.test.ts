/**
 * Tests for GitHub Checks annotation emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetMocks,
  getMockErrors,
  getMockWarnings,
  getMockNotices,
} from './__mocks__/actions-core';

vi.mock('@actions/core', () => import('./__mocks__/actions-core'));
vi.mock('@actions/github', () => import('./__mocks__/actions-github'));

import { emitAnnotations } from '../src/annotations';
import type { PreFlightFinding } from '@blackhole/preflight-engine';

function makeFinding(
  overrides: Partial<PreFlightFinding> = {}
): PreFlightFinding {
  return {
    ruleId: 'TestRule',
    ruleName: 'Test Rule',
    severity: 'major',
    category: 'sonarqube',
    filePath: 'src/Foo.java',
    line: 10,
    message: 'Test message',
    remediation: 'Fix it',
    ...overrides,
  };
}

describe('emitAnnotations', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should emit core.error for blocker findings', () => {
    emitAnnotations([makeFinding({ severity: 'blocker' })]);
    const errors = getMockErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].properties).toMatchObject({
      file: 'src/Foo.java',
      startLine: 10,
    });
  });

  it('should emit core.error for critical findings', () => {
    emitAnnotations([makeFinding({ severity: 'critical' })]);
    const errors = getMockErrors();
    expect(errors).toHaveLength(1);
  });

  it('should emit core.warning for major findings', () => {
    emitAnnotations([makeFinding({ severity: 'major' })]);
    const warnings = getMockWarnings();
    // Filter out truncation warnings
    const annotationWarnings = warnings.filter(
      (w) => w.properties !== undefined
    );
    expect(annotationWarnings).toHaveLength(1);
  });

  it('should emit core.notice for minor findings', () => {
    emitAnnotations([makeFinding({ severity: 'minor' })]);
    const notices = getMockNotices();
    expect(notices).toHaveLength(1);
  });

  it('should not emit anything for zero findings', () => {
    emitAnnotations([]);
    expect(getMockErrors()).toHaveLength(0);
    expect(getMockWarnings()).toHaveLength(0);
    expect(getMockNotices()).toHaveLength(0);
  });

  it('should truncate beyond 10 annotations per severity', () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      makeFinding({ severity: 'blocker', ruleId: `Rule${i}` })
    );
    emitAnnotations(findings);
    const errors = getMockErrors();
    expect(errors).toHaveLength(10);
    // Should have a truncation warning
    const warnings = getMockWarnings();
    expect(warnings.some((w) => w.message.includes('5 additional'))).toBe(true);
  });
});
