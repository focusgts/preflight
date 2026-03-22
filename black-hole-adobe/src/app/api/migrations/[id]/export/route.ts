/**
 * POST /api/migrations/[id]/export — Export migration to Navigator
 *
 * Triggers a full export of a completed migration into the Navigator
 * Portal, including tickets, KB articles, ROI data, Navi memories,
 * and RuVector indexing.
 *
 * Prerequisites:
 *   - Migration must be in COMPLETED status
 *
 * Returns the handoff report plus per-component export status.
 */

import { type NextRequest } from 'next/server';
import { MigrationStatus } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import { NavigatorClient, MigrationExporter, generateHandoffReport } from '@/lib/bridge';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    if (migration.status !== MigrationStatus.COMPLETED) {
      return error(
        'INVALID_STATE',
        `Migration must be in COMPLETED status to export. Current status: ${migration.status}`,
        409,
      );
    }

    console.log(`[API] POST /api/migrations/${id}/export — starting Navigator export`);

    // Build the handoff report first (synchronous, no API calls)
    const handoffReport = generateHandoffReport(migration, migration.assessment);

    // Run the export pipeline
    const client = new NavigatorClient();
    const exporter = new MigrationExporter(client);
    const exportResult = await exporter.exportMigration(migration);

    console.log(
      `[API] Export complete: ${exportResult.tickets.exported} tickets, ` +
      `${exportResult.knowledgeArticles.exported} KB articles, ` +
      `${exportResult.roiEntries.exported} ROI entries, ` +
      `${exportResult.memories.exported} memories, ` +
      `${exportResult.ruVectorEntries.exported} RuVector entries ` +
      `(mode: ${exportResult.mode})`,
    );

    return success({
      exportResult,
      handoffReport,
    });
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/export error:', err);
    return error('INTERNAL_ERROR', 'Failed to export migration to Navigator', 500);
  }
}
