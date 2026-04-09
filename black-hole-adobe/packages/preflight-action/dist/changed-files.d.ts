/**
 * Get changed files from a pull request via the GitHub API.
 */
/**
 * Fetch the list of changed files in the current pull request.
 * Returns relative file paths filtered to supported extensions.
 *
 * Returns an empty array if not in a PR context (caller should
 * fall back to full-repo scan).
 */
export declare function getChangedFiles(token: string): Promise<string[]>;
