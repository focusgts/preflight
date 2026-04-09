/**
 * Git Utilities
 *
 * Shell out to git for staged file detection and diff-since operations.
 */

import { execSync } from 'child_process';
import * as path from 'path';

/** Default file extensions the engine can analyze. */
const SUPPORTED_EXTENSIONS = [
  '.java',
  '.jsp',
  '.jspx',
  '.xml',
  '.cfg.json',
  '.properties',
  '.yaml',
  '.yml',
  '.html',
  '.htl',
];

/**
 * Get the list of git-staged files, filtered to supported extensions.
 */
export async function getStagedFiles(cwd: string): Promise<string[]> {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseGitOutput(output, cwd);
  } catch {
    return [];
  }
}

/**
 * Get files changed since a git ref, filtered to supported extensions.
 */
export async function getChangedFilesSince(
  ref: string,
  cwd: string
): Promise<string[]> {
  try {
    const output = execSync(`git diff --name-only ${ref}...HEAD`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseGitOutput(output, cwd);
  } catch {
    return [];
  }
}

/**
 * Parse git output lines into absolute paths, filtering by supported extensions.
 */
function parseGitOutput(output: string, cwd: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => isSupportedExtension(line))
    .map((line) => path.resolve(cwd, line));
}

function isSupportedExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
