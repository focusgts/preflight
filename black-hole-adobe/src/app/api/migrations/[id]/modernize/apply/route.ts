/**
 * POST /api/migrations/[id]/modernize/apply
 *
 * Apply auto-fixable modernization findings and return the modified files
 * as either structured JSON or a downloadable ZIP archive.
 *
 * @see ADR-051 — Code Modernization File Output
 */

import { type NextRequest } from 'next/server';
import { Severity } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import {
  CodeModernizer,
  type ModernizationFinding,
} from '@/lib/migration/code-modernizer';
import { CodeModernizationWriter } from '@/lib/migration/code-writer';

type RouteParams = { params: Promise<{ id: string }> };

interface ApplyRequest {
  findingIds?: string[];
  format?: 'json' | 'zip';
  /** Original source files needed to apply diffs. */
  files?: Array<{ path: string; content: string }>;
  /** When true, include manual-review findings in the ZIP manifest. */
  includeManual?: boolean;
  /**
   * When true, compute what WOULD change without mutating any state
   * and return before/after diffs per finding. Does not write files.
   */
  dryRun?: boolean;
}

/**
 * Build sample source files that match the generated findings so that
 * `applyFixes` can locate them by path. This covers the demo/estimated
 * flow where the caller has no real source code to supply.
 */
function buildSampleFiles(findings: ModernizationFinding[]): Array<{ path: string; content: string }> {
  const files = new Map<string, string>();
  for (const f of findings) {
    const existing = files.get(f.filePath) ?? '';
    // Ensure the file contains the before-code so the replacement can match
    if (!existing.includes(f.beforeCode)) {
      files.set(f.filePath, existing + (existing ? '\n' : '') + f.beforeCode);
    }
  }
  return Array.from(files, ([path, content]) => ({ path, content }));
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    let body: ApplyRequest = {};
    try {
      body = await request.json();
    } catch {
      // Empty body defaults apply
    }

    const format = body.format ?? 'json';
    const dryRun = body.dryRun === true;
    const hasUploadedFiles = Array.isArray(body.files) && body.files.length > 0;

    // -----------------------------------------------------------------------
    // Finding source selection (ADR-059 Bug 1):
    //   - If caller provided files, run the modernizer fresh against them
    //     and use those findings as the canonical working set.
    //   - Otherwise fall back to the migration's deterministic sample set.
    // -----------------------------------------------------------------------
    let findings: ModernizationFinding[];
    if (hasUploadedFiles) {
      const modernizer = new CodeModernizer();
      const report = await modernizer.replaceDeprecatedAPIs(body.files!);
      findings = report.findings;
    } else {
      const { generateFindings } = await import('../findings');
      findings = generateFindings(migration.migrationType);
    }

    // Filter to requested finding IDs if provided
    if (body.findingIds && body.findingIds.length > 0) {
      const requestedIds = new Set(body.findingIds);
      findings = findings.filter((_f, i) => {
        const findingId = `finding-${String(i + 1).padStart(3, '0')}`;
        return requestedIds.has(findingId);
      });
    }

    // Safety: never auto-apply CRITICAL findings
    const applicable = findings.filter(
      (f) => f.autoFixApplied && f.severity !== Severity.CRITICAL && f.afterCode !== null,
    );

    if (applicable.length === 0) {
      return success({
        applied: 0,
        dryRun,
        message: 'No auto-fixable findings to apply. Critical findings require manual review.',
        files: [],
      });
    }

    const writer = new CodeModernizationWriter();
    // ADR-059 Bug 1 & 4: uploaded files are the canonical working set.
    // Only fall back to sample content when no files were uploaded.
    const sourceFiles = hasUploadedFiles
      ? body.files!
      : buildSampleFiles(findings);

    // ----- Dry-run (ADR-059 Bug 5) -----
    if (dryRun) {
      const applied = writer.applyFixes(findings, sourceFiles);
      const changedFiles = applied.filter((f) => f.modifiedContent !== f.originalContent);
      return success({
        dryRun: true,
        wouldApply: changedFiles.length,
        files: changedFiles.map((f) => ({
          path: f.path,
          original: f.originalContent,
          modified: f.modifiedContent,
          changes: f.changes,
          changed: true,
        })),
        diffs: applicable.map((f) => ({
          filePath: f.filePath,
          title: f.title,
          severity: f.severity,
          before: f.beforeCode,
          after: f.afterCode,
        })),
      });
    }

    // ----- JSON format -----
    if (format === 'json') {
      const applied = writer.applyFixes(findings, sourceFiles);
      const changedCount = applied.filter((f) => f.modifiedContent !== f.originalContent).length;
      return success({
        applied: changedCount,
        dryRun: false,
        files: applied.map((f) => ({
          path: f.path,
          original: f.originalContent,
          modified: f.modifiedContent,
          changes: f.changes,
          changed: f.modifiedContent !== f.originalContent,
        })),
      });
    }

    // ----- ZIP format -----
    const { buffer, modifiedCount } = await writer.generateZip(
      findings,
      sourceFiles,
      { includeManual: body.includeManual ?? false },
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="blackhole-modernized-${id}-${Date.now()}.zip"`,
        'Content-Length': String(buffer.length),
        'X-Files-Modified': String(modifiedCount),
      },
    });
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/modernize/apply error:', err);
    return error('INTERNAL_ERROR', 'Failed to apply code modernization fixes', 500);
  }
}
