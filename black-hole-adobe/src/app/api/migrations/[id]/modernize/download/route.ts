/**
 * GET /api/migrations/[id]/modernize/download
 *
 * Download all auto-fixable modernization results as a ZIP archive.
 * Convenience endpoint that wraps the apply endpoint's ZIP mode.
 *
 * @see ADR-051 — Code Modernization File Output
 */

import { type NextRequest } from 'next/server';
import { Severity } from '@/types';
import { error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import type { ModernizationFinding } from '@/lib/migration/code-modernizer';
import { CodeModernizationWriter } from '@/lib/migration/code-writer';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Build sample source files from findings so the writer can apply diffs.
 */
function buildSampleFiles(findings: ModernizationFinding[]): Array<{ path: string; content: string }> {
  const files = new Map<string, string>();
  for (const f of findings) {
    const existing = files.get(f.filePath) ?? '';
    if (!existing.includes(f.beforeCode)) {
      files.set(f.filePath, existing + (existing ? '\n' : '') + f.beforeCode);
    }
  }
  return Array.from(files, ([path, content]) => ({ path, content }));
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    // Load the sample findings for this migration type
    const { generateFindings } = await import('../findings');
    const findings = generateFindings(migration.migrationType);

    const applicable = findings.filter(
      (f) => f.autoFixApplied && f.severity !== Severity.CRITICAL && f.afterCode !== null,
    );

    if (applicable.length === 0) {
      return error(
        'NO_FIXES',
        'No auto-fixable findings available for download.',
        404,
      );
    }

    const writer = new CodeModernizationWriter();
    const sourceFiles = buildSampleFiles(findings);
    const { buffer, manifest } = await writer.generateZip(
      findings,
      sourceFiles,
      { includeManual: true },
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="blackhole-modernized-${id}-${timestamp}.zip"`,
        'Content-Length': String(buffer.length),
        'X-Files-Modified': String(manifest.length - 1),
      },
    });
  } catch (err) {
    console.error('[API] GET /api/migrations/[id]/modernize/download error:', err);
    return error('INTERNAL_ERROR', 'Failed to generate modernization download', 500);
  }
}
