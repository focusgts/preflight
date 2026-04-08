/**
 * Code Modernization Writer
 *
 * Applies auto-fix findings to source files and produces downloadable
 * output (ZIP or JSON). Does NOT write to the local filesystem, making
 * it safe for serverless / edge deployments.
 *
 * @see ADR-051 — Code Modernization File Output
 */

import JSZip from 'jszip';
import { Severity } from '@/types';
import type { ModernizationFinding } from './code-modernizer';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WriteResult {
  filesModified: string[];
  filesSkipped: string[];
  errors: Array<{ path: string; error: string }>;
  outputPath: string;
  zipBuffer?: Buffer;
}

export interface AppliedFile {
  path: string;
  originalContent: string;
  modifiedContent: string;
  changes: string[];
}

export interface ZipResult {
  buffer: Buffer;
  manifest: string[];
  /** Number of files whose content was actually modified. */
  modifiedCount: number;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export class CodeModernizationWriter {
  /**
   * Apply auto-fix findings and return as an array of path/content pairs.
   *
   * Only findings that satisfy ALL of these conditions are applied:
   *   1. `autoFixApplied` is true
   *   2. `severity` is not CRITICAL
   *   3. `afterCode` is non-null
   *
   * For each qualifying finding the `beforeCode` pattern is replaced with
   * `afterCode` inside the matching original file content.
   */
  applyFixes(
    findings: ModernizationFinding[],
    originalFiles: Array<{ path: string; content: string }>,
  ): AppliedFile[] {
    const fileMap = new Map<string, { original: string; current: string; changes: string[] }>();

    // Seed the map with original file contents
    for (const f of originalFiles) {
      fileMap.set(f.path, { original: f.content, current: f.content, changes: [] });
    }

    // Apply each qualifying finding (ADR-059 Bug 2).
    // Multiple findings may affect the same file — apply sequentially.
    for (const finding of findings) {
      if (!this.isApplicable(finding)) continue;

      const entry = fileMap.get(finding.filePath);
      if (!entry) continue;

      const before = entry.current;
      const after = this.applyReplacement(before, finding.beforeCode, finding.afterCode as string);

      if (after !== before) {
        entry.current = after;
        entry.changes.push(finding.title);
      }
    }

    // Return ALL input files so callers (ZIP generation) can include the
    // full uploaded set. Only files with recorded changes will show as
    // modified in the response.
    const results: AppliedFile[] = [];
    for (const [path, entry] of fileMap) {
      results.push({
        path,
        originalContent: entry.original,
        modifiedContent: entry.current,
        changes: entry.changes,
      });
    }
    return results;
  }

  /**
   * Replace `beforeCode` with `afterCode` inside content. Tries a literal
   * `replaceAll` first, then falls back to a regex-escaped global replace
   * so that patterns containing regex metacharacters still match.
   */
  private applyReplacement(content: string, beforeCode: string, afterCode: string): string {
    if (!beforeCode) return content;
    const literal = content.replaceAll(beforeCode, afterCode);
    if (literal !== content) return literal;
    // Regex fallback: escape the beforeCode and run a global replace.
    const escaped = beforeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return content.replace(new RegExp(escaped, 'g'), afterCode);
    } catch {
      return content;
    }
  }

  /**
   * Generate a ZIP buffer containing all auto-fixed files in their
   * original directory structure, plus a CHANGES.md manifest.
   *
   * When `includeManual` is true, findings that are NOT auto-fixable are
   * still listed in CHANGES.md (but never applied to files).
   */
  async generateZip(
    findings: ModernizationFinding[],
    originalFiles: Array<{ path: string; content: string }>,
    options?: { includeManual?: boolean },
  ): Promise<ZipResult> {
    const applied = this.applyFixes(findings, originalFiles);
    const zip = new JSZip();
    const manifest: string[] = [];

    // ADR-059 Bug 4: include EVERY uploaded file in the ZIP, with
    // modifications applied where applicable. No placeholder files are
    // generated — the archive mirrors the customer's input 1:1.
    for (const file of applied) {
      // Strip leading slash so ZIP paths are relative
      const zipPath = file.path.replace(/^\//, '');
      zip.file(zipPath, file.modifiedContent);
      manifest.push(zipPath);
    }

    // CHANGES.md lists only files that were actually modified.
    const changedFiles = applied.filter((f) => f.modifiedContent !== f.originalContent);
    const changesContent = this.buildChangesManifest(findings, changedFiles, options?.includeManual ?? false);
    zip.file('CHANGES.md', changesContent);
    manifest.push('CHANGES.md');

    const buffer = Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
    return { buffer, manifest, modifiedCount: changedFiles.length };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private isApplicable(finding: ModernizationFinding): boolean {
    return (
      finding.autoFixApplied === true &&
      finding.severity !== Severity.CRITICAL &&
      finding.afterCode !== null
    );
  }

  private buildChangesManifest(
    allFindings: ModernizationFinding[],
    applied: AppliedFile[],
    includeManual: boolean,
  ): string {
    const lines: string[] = [
      '# Code Modernization Changes',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Applied Auto-Fixes',
      '',
    ];

    if (applied.length === 0) {
      lines.push('No auto-fixes were applied.');
    } else {
      for (const file of applied) {
        lines.push(`### ${file.path}`);
        for (const change of file.changes) {
          lines.push(`- ${change}`);
        }
        lines.push('');
      }
    }

    if (includeManual) {
      const manual = allFindings.filter((f) => !f.autoFixApplied || f.severity === Severity.CRITICAL);
      if (manual.length > 0) {
        lines.push('## Manual Review Required', '');
        for (const f of manual) {
          lines.push(`- **[${f.severity}]** ${f.filePath}: ${f.title}`);
          lines.push(`  ${f.description}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
