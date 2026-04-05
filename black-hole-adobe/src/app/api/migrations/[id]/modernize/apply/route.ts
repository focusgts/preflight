/**
 * POST /api/migrations/[id]/modernize/apply
 *
 * Apply auto-fixable modernization findings and return the modified files
 * as either structured JSON or a downloadable ZIP archive.
 *
 * @see ADR-051 — Code Modernization File Output
 */

import { type NextRequest } from 'next/server';
import { Severity, CompatibilityLevel } from '@/types';
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

    // -----------------------------------------------------------------------
    // Re-run the modernizer to get the canonical finding list.
    // In a production system these would be cached / stored; for now we
    // regenerate from the same deterministic inputs.
    // -----------------------------------------------------------------------
    const modernizer = new CodeModernizer();
    const report = await modernizer.replaceDeprecatedAPIs(body.files ?? []);
    let findings = report.findings;

    // If no real files were supplied, fall back to the sample set used by
    // the main modernize endpoint.
    if (findings.length === 0 && (!body.files || body.files.length === 0)) {
      // Import the same sample generator used by the parent route
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
        message: 'No auto-fixable findings to apply. Critical findings require manual review.',
        files: [],
      });
    }

    const writer = new CodeModernizationWriter();
    const sourceFiles = body.files && body.files.length > 0
      ? body.files
      : buildSampleFiles(findings);

    // ----- JSON format -----
    if (format === 'json') {
      const applied = writer.applyFixes(findings, sourceFiles);
      return success({
        applied: applied.length,
        files: applied.map((f) => ({
          path: f.path,
          original: f.originalContent,
          modified: f.modifiedContent,
          changes: f.changes,
        })),
      });
    }

    // ----- ZIP format -----
    const { buffer, manifest } = await writer.generateZip(
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
        'X-Files-Modified': String(manifest.length - 1), // exclude CHANGES.md
      },
    });
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/modernize/apply error:', err);
    return error('INTERNAL_ERROR', 'Failed to apply code modernization fixes', 500);
  }
}
