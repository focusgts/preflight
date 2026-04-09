/**
 * Git Utilities
 *
 * Shell out to git for staged file detection and diff-since operations.
 */
/**
 * Get the list of git-staged files, filtered to supported extensions.
 */
export declare function getStagedFiles(cwd: string): Promise<string[]>;
/**
 * Get files changed since a git ref, filtered to supported extensions.
 */
export declare function getChangedFilesSince(ref: string, cwd: string): Promise<string[]>;
//# sourceMappingURL=git.d.ts.map