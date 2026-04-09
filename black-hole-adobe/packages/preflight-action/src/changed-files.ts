/**
 * Get changed files from a pull request via the GitHub API.
 */

import * as github from '@actions/github';
import { isSupportedFile } from './utils';

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Fetch the list of changed files in the current pull request.
 * Returns relative file paths filtered to supported extensions.
 *
 * Returns an empty array if not in a PR context (caller should
 * fall back to full-repo scan).
 */
export async function getChangedFiles(token: string): Promise<string[]> {
  const { context } = github;
  const prNumber = context.payload.pull_request?.number;

  if (!prNumber) {
    return [];
  }

  const octokit: Octokit = github.getOctokit(token);
  const allFiles: string[] = [];
  let page = 1;
  const perPage = 100;

  // Paginate through all changed files
  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: perPage,
      page,
    });

    const files = response.data;
    if (files.length === 0) break;

    for (const file of files) {
      // Skip deleted files -- nothing to scan
      if (file.status === 'removed') continue;
      if (isSupportedFile(file.filename)) {
        allFiles.push(file.filename);
      }
    }

    if (files.length < perPage) break;
    page++;
  }

  return allFiles;
}
