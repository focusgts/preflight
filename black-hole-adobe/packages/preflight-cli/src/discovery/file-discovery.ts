/**
 * File Discovery
 *
 * Walks the project directory tree to find scannable AEM files.
 * Honors .gitignore patterns and config include/exclude globs.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PreFlightConfig } from '../config/config-loader';

/** Default file extensions the engine can analyze. */
const DEFAULT_EXTENSIONS = new Set([
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
]);

/**
 * Directories to always skip regardless of config.
 */
const ALWAYS_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'target',
  'dist',
  '.next',
  '__pycache__',
]);

/**
 * Discover files to scan based on paths, config, and .gitignore.
 */
export async function discoverFiles(
  scanPaths: string[],
  config: PreFlightConfig
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const scanPath of scanPaths) {
    const resolved = path.resolve(scanPath);
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    if (!stat) continue;

    if (stat.isFile()) {
      if (isSupportedFile(resolved)) {
        allFiles.push(resolved);
      }
    } else if (stat.isDirectory()) {
      walkDirectory(resolved, allFiles, loadGitignorePatterns(resolved));
    }
  }

  // Apply config include/exclude filters
  return applyConfigFilters(allFiles, config);
}

/**
 * Recursively walk a directory and collect supported files.
 */
function walkDirectory(
  dir: string,
  results: string[],
  gitignorePatterns: string[]
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ALWAYS_SKIP_DIRS.has(entry.name)) continue;
      if (isGitignored(fullPath, gitignorePatterns)) continue;
      walkDirectory(fullPath, results, gitignorePatterns);
    } else if (entry.isFile()) {
      if (isGitignored(fullPath, gitignorePatterns)) continue;
      if (isSupportedFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }
}

/**
 * Check if a file path has a supported extension.
 */
function isSupportedFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of DEFAULT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Load .gitignore patterns from the project root.
 * Returns simple patterns for basic matching.
 */
function loadGitignorePatterns(rootDir: string): string[] {
  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * Basic gitignore pattern matching.
 * Handles simple patterns like "target/", "*.class", "build/".
 */
function isGitignored(filePath: string, patterns: string[]): boolean {
  const basename = path.basename(filePath);

  for (const pattern of patterns) {
    // Directory pattern (ending with /)
    if (pattern.endsWith('/')) {
      const dirName = pattern.slice(0, -1);
      if (basename === dirName || filePath.includes(`/${dirName}/`)) {
        return true;
      }
      continue;
    }

    // Glob pattern with *
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      if (basename.endsWith(suffix)) return true;
      continue;
    }

    // Exact match or path segment match
    if (basename === pattern || filePath.includes(`/${pattern}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Apply config include/exclude glob filters.
 */
function applyConfigFilters(
  files: string[],
  config: PreFlightConfig
): string[] {
  let result = files;

  if (config.include && config.include.length > 0) {
    result = result.filter((f) => matchesAnyGlob(f, config.include!));
  }

  if (config.exclude && config.exclude.length > 0) {
    result = result.filter((f) => !matchesAnyGlob(f, config.exclude!));
  }

  return result;
}

/**
 * Simple glob matching for config patterns.
 * Supports **, *, and literal path segments.
 */
function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlob(filePath, pattern)) return true;
  }
  return false;
}

function matchGlob(filePath: string, pattern: string): boolean {
  // Convert glob to regex
  const regexStr = pattern
    .replace(/\*\*/g, '<<DOUBLESTAR>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<DOUBLESTAR>>/g, '.*')
    .replace(/\?/g, '[^/]');

  try {
    const regex = new RegExp(regexStr);
    return regex.test(filePath);
  } catch {
    return false;
  }
}
