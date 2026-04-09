/**
 * Integration tests for the full action flow.
 *
 * These tests exercise the engine + annotations + outputs together,
 * without actually running main.ts (which calls process-level APIs).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetMocks,
  getMockErrors,
  getMockFailed,
  getMockOutputs,
} from './__mocks__/actions-core';
import { resetGithubMocks } from './__mocks__/actions-github';

vi.mock('@actions/core', () => import('./__mocks__/actions-core'));
vi.mock('@actions/github', () => import('./__mocks__/actions-github'));

import { PreFlightEngine } from '@blackhole/preflight-engine';
import type { PreFlightItem } from '@blackhole/preflight-engine';
import { emitAnnotations } from '../src/annotations';
import { countBySeverity, severityAtOrAbove } from '../src/utils';
import * as core from '@actions/core';

function runActionFlow(
  items: PreFlightItem[],
  failOn: 'blocker' | 'critical' | 'major' | 'minor' | 'none'
) {
  const engine = new PreFlightEngine();
  const report = engine.runPreFlight(items);
  const counts = countBySeverity(report.findings);

  core.setOutput('total', report.findings.length.toString());
  core.setOutput('blocker', counts.blocker.toString());
  core.setOutput('critical', counts.critical.toString());
  core.setOutput('major', counts.major.toString());

  emitAnnotations(report.findings);

  const failingFindings = report.findings.filter((f) =>
    severityAtOrAbove(f, failOn)
  );
  if (failingFindings.length > 0) {
    core.setFailed(`Found ${failingFindings.length} failing finding(s).`);
  }

  return report;
}

describe('integration', () => {
  beforeEach(() => {
    resetMocks();
    resetGithubMocks();
  });

  it('should fail and emit annotations for bad Java files', () => {
    const items: PreFlightItem[] = [
      {
        path: 'src/main/java/BadService.java',
        content: [
          'package com.example;',
          'import sun.misc.BASE64Encoder;',
          'public class BadService {',
          '  public void connect() {',
          '    HttpClients.createDefault();',
          '  }',
          '}',
        ].join('\n'),
      },
    ];

    runActionFlow(items, 'critical');

    expect(getMockFailed()).not.toBeNull();

    const outputs = getMockOutputs();
    expect(parseInt(outputs.total)).toBeGreaterThan(0);
    expect(parseInt(outputs.blocker)).toBeGreaterThan(0);

    const errors = getMockErrors();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should not fail for clean files', () => {
    const items: PreFlightItem[] = [
      {
        path: 'src/main/java/CleanService.java',
        content: [
          'package com.example;',
          'import java.util.List;',
          'public class CleanService {',
          '  public List<String> getItems() {',
          '    return List.of("a", "b");',
          '  }',
          '}',
        ].join('\n'),
      },
    ];

    runActionFlow(items, 'critical');

    expect(getMockFailed()).toBeNull();

    const outputs = getMockOutputs();
    expect(outputs.total).toBe('0');
    expect(outputs.blocker).toBe('0');
    expect(outputs.critical).toBe('0');
    expect(outputs.major).toBe('0');
  });

  it('should not fail when fail-on=none even with blockers', () => {
    const items: PreFlightItem[] = [
      {
        path: 'src/main/java/Bad.java',
        content: [
          'package com.example;',
          'import sun.misc.Unsafe;',
          'public class Bad {}',
        ].join('\n'),
      },
    ];

    runActionFlow(items, 'none');

    expect(getMockFailed()).toBeNull();
    const outputs = getMockOutputs();
    expect(parseInt(outputs.blocker)).toBeGreaterThan(0);
  });

  it('should fail on major findings when fail-on=major', () => {
    const items: PreFlightItem[] = [
      {
        path: 'src/main/java/Overlay.java',
        content: [
          'package com.example;',
          'public class Overlay {',
          '  String path = "/libs/cq/core/content";',
          '}',
        ].join('\n'),
      },
    ];

    runActionFlow(items, 'major');

    expect(getMockFailed()).not.toBeNull();
    const outputs = getMockOutputs();
    expect(parseInt(outputs.major)).toBeGreaterThan(0);
  });
});
