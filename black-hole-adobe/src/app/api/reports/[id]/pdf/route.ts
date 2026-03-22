/**
 * GET /api/reports/[id]/pdf — Generate and download assessment PDF report
 *
 * Returns a professionally formatted PDF report for the given assessment.
 * Content-Type: application/pdf with attachment disposition for download.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAssessment, getAssessmentByMigration, getMigration } from '@/lib/api/store';
import { generateAssessmentPDF } from '@/lib/reports/pdf-generator';
import { error } from '@/lib/api/response';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;

    // Try to find assessment directly, then by migration ID
    const assessment = getAssessment(id) ?? getAssessmentByMigration(id);

    if (!assessment) {
      return error('NOT_FOUND', `Assessment for ${id} not found`, 404);
    }

    // Fetch the migration project for org name and metadata
    const migration = getMigration(assessment.migrationProjectId) ?? null;

    const pdfBuffer = await generateAssessmentPDF(assessment, migration);

    // Build a clean filename
    const orgSlug = (migration?.organizationName ?? 'client')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `assessment-report-${orgSlug}-${dateSlug}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[API] GET /api/reports/[id]/pdf error:', err);
    return error('INTERNAL_ERROR', 'Failed to generate PDF report', 500);
  }
}
