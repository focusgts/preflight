/**
 * Tests for sticky PR comment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMocks } from './__mocks__/actions-core';
import {
  resetGithubMocks,
  setMockComments,
  getCreatedComments,
  getUpdatedComments,
} from './__mocks__/actions-github';

vi.mock('@actions/core', () => import('./__mocks__/actions-core'));
vi.mock('@actions/github', () => import('./__mocks__/actions-github'));

import { postOrUpdateComment, buildCommentBody } from '../src/comment';
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

describe('comment', () => {
  beforeEach(() => {
    resetMocks();
    resetGithubMocks();
  });

  describe('postOrUpdateComment', () => {
    it('should create a new comment on first run', async () => {
      setMockComments([]);
      await postOrUpdateComment('fake-token', [makeFinding()]);

      const created = getCreatedComments();
      expect(created).toHaveLength(1);
      expect(created[0].issue_number).toBe(42);
      expect(created[0].body).toContain('<!-- blackhole-preflight -->');
    });

    it('should update existing comment on re-run', async () => {
      setMockComments([
        { id: 123, body: '<!-- blackhole-preflight -->\nOld content' },
      ]);
      await postOrUpdateComment('fake-token', [makeFinding()]);

      const updated = getUpdatedComments();
      expect(updated).toHaveLength(1);
      expect(updated[0].comment_id).toBe(123);
      expect(getCreatedComments()).toHaveLength(0);
    });
  });

  describe('buildCommentBody', () => {
    it('should show "all clear" for zero findings', () => {
      const body = buildCommentBody([]);
      expect(body).toContain('No findings detected');
      expect(body).toContain('<!-- blackhole-preflight -->');
    });

    it('should include correct severity table', () => {
      const findings = [
        makeFinding({ severity: 'blocker' }),
        makeFinding({ severity: 'blocker' }),
        makeFinding({ severity: 'critical' }),
        makeFinding({ severity: 'major' }),
      ];
      const body = buildCommentBody(findings);
      expect(body).toContain('| Blocker | 2 |');
      expect(body).toContain('| Critical | 1 |');
      expect(body).toContain('| Major | 1 |');
      expect(body).toContain('| Minor | 0 |');
      expect(body).toContain('| **Total** | **4** |');
    });

    it('should include findings in details section', () => {
      const findings = [
        makeFinding({
          severity: 'blocker',
          ruleId: 'CQRules:Test',
          filePath: 'src/Bar.java',
          line: 42,
          message: 'Bad code',
          remediation: 'Fix the bad code',
        }),
      ];
      const body = buildCommentBody(findings);
      expect(body).toContain('<details>');
      expect(body).toContain('### Blockers');
      expect(body).toContain('[CQRules:Test]');
      expect(body).toContain('`src/Bar.java:42`');
      expect(body).toContain('Fix the bad code');
    });
  });
});
