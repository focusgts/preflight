/**
 * Sticky PR comment with pre-flight results.
 *
 * Creates or updates a single comment on the PR. Uses a hidden
 * HTML marker to find the existing comment on re-runs.
 */

import * as github from '@actions/github';
import type { PreFlightFinding, PreFlightSeverity } from '@blackhole/preflight-engine';
import { countBySeverity } from './utils';

type Octokit = ReturnType<typeof github.getOctokit>;

const COMMENT_MARKER = '<!-- blackhole-preflight -->';

/**
 * Post or update the sticky pre-flight PR comment.
 */
export async function postOrUpdateComment(
  token: string,
  findings: PreFlightFinding[]
): Promise<void> {
  const { context } = github;
  const prNumber = context.payload.pull_request?.number;
  if (!prNumber) return;

  const octokit: Octokit = github.getOctokit(token);
  const body = buildCommentBody(findings);

  // Search for existing comment with our marker
  const existingComment = await findExistingComment(octokit, prNumber);

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });
  }
}

async function findExistingComment(
  octokit: Octokit,
  prNumber: number
): Promise<{ id: number } | null> {
  const { context } = github;
  let page = 1;
  const perPage = 30;

  while (true) {
    const response = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      per_page: perPage,
      page,
    });

    const comments = response.data;
    if (comments.length === 0) break;

    for (const comment of comments) {
      if (comment.body?.includes(COMMENT_MARKER)) {
        return { id: comment.id };
      }
    }

    if (comments.length < perPage) break;
    page++;
  }

  return null;
}

/**
 * Build the markdown body for the PR comment.
 */
export function buildCommentBody(findings: PreFlightFinding[]): string {
  const counts = countBySeverity(findings);
  const total = findings.length;

  const lines: string[] = [COMMENT_MARKER, '', '## Pre-Flight Results', ''];

  if (total === 0) {
    lines.push(
      'No findings detected. All scanned files pass Cloud Manager quality gates.',
      ''
    );
  } else {
    lines.push(
      '| Severity | Count |',
      '|----------|-------|',
      `| Blocker | ${counts.blocker} |`,
      `| Critical | ${counts.critical} |`,
      `| Major | ${counts.major} |`,
      `| Minor | ${counts.minor} |`,
      `| **Total** | **${total}** |`,
      ''
    );

    lines.push(`<details>`, `<summary>Findings (${total} total)</summary>`, '');

    const severityGroups: { label: string; severity: PreFlightSeverity }[] = [
      { label: 'Blockers', severity: 'blocker' },
      { label: 'Critical', severity: 'critical' },
      { label: 'Major', severity: 'major' },
      { label: 'Minor', severity: 'minor' },
    ];

    for (const { label, severity } of severityGroups) {
      const group = findings.filter((f) => f.severity === severity);
      if (group.length === 0) continue;

      lines.push(`### ${label}`, '');
      for (const f of group) {
        const location = f.line
          ? `\`${f.filePath}:${f.line}\``
          : `\`${f.filePath}\``;
        lines.push(
          `- **[${f.ruleId}]** ${location} -- ${f.message}`,
          `  > ${f.remediation}`,
          ''
        );
      }
    }

    lines.push('</details>', '');
  }

  lines.push(
    '---',
    '*Black Hole Pre-Flight -- [Run locally](https://www.npmjs.com/package/@blackhole/preflight) | [Web UI](https://blackhole.focusgts.com/preflight)*'
  );

  return lines.join('\n');
}
