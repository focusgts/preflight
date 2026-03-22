/**
 * POST /api/migrations/[id]/transform — Start transformation phase
 *
 * Transitions the migration from ASSESSED/PLANNED to TRANSFORMING.
 * Creates transformation phase records and begins simulated processing.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { MigrationStatus, PhaseType, CompatibilityLevel } from '@/types';
import type { MigrationPhase, MigrationItem } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration, updateMigration } from '@/lib/api/store';

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

    const allowedStatuses: MigrationStatus[] = [
      MigrationStatus.ASSESSED,
      MigrationStatus.PLANNED,
    ];

    if (!allowedStatuses.includes(migration.status)) {
      return error(
        'INVALID_STATE',
        `Cannot start transformation in ${migration.status} state. Migration must be assessed or planned.`,
        409,
      );
    }

    if (!migration.assessment) {
      return error(
        'PREREQUISITE_MISSING',
        'Assessment must be completed before transformation can begin.',
        400,
      );
    }

    const now = new Date().toISOString();
    const findings = migration.assessment.findings;

    // Create transformation items from assessment findings
    const transformItems: MigrationItem[] = findings.map((finding, idx) => ({
      id: `ti-${uuidv4().slice(0, 8)}`,
      type: 'code-transform',
      name: finding.title,
      sourcePath: finding.affectedPath,
      targetPath: finding.affectedPath,
      status: idx === 0 ? 'processing' : 'pending',
      compatibilityLevel: finding.compatibilityLevel,
      autoFixed: false,
      validationResult: null,
      error: null,
      processedAt: null,
    }));

    // Build code modernisation phase
    const codeModPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CODE_MODERNIZATION,
      name: 'Code Modernisation',
      status: MigrationStatus.TRANSFORMING,
      progress: 0,
      items: transformItems,
      startedAt: now,
      completedAt: null,
      estimatedDuration: findings.reduce((sum, f) => sum + f.estimatedHours, 0),
      actualDuration: null,
    };

    // Build content migration phase
    const contentItems: MigrationItem[] = [
      {
        id: `ti-${uuidv4().slice(0, 8)}`,
        type: 'content-transfer',
        name: 'Content Package Transfer',
        sourcePath: '/content',
        targetPath: '/content',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
      {
        id: `ti-${uuidv4().slice(0, 8)}`,
        type: 'asset-transfer',
        name: 'DAM Asset Transfer',
        sourcePath: '/content/dam',
        targetPath: '/content/dam',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
    ];

    const contentPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CONTENT_MIGRATION,
      name: 'Content Migration',
      status: MigrationStatus.DRAFT,
      progress: 0,
      items: contentItems,
      startedAt: null,
      completedAt: null,
      estimatedDuration: 40,
      actualDuration: null,
    };

    // Preserve existing phases and add new ones
    const existingPhases = migration.phases.filter(
      (p) =>
        p.type !== PhaseType.CODE_MODERNIZATION &&
        p.type !== PhaseType.CONTENT_MIGRATION,
    );

    updateMigration(id, {
      status: MigrationStatus.TRANSFORMING,
      phases: [...existingPhases, codeModPhase, contentPhase],
      progress: 20,
    });

    console.log(`[API] POST /api/migrations/${id}/transform — started`);
    return success(
      {
        migrationId: id,
        status: MigrationStatus.TRANSFORMING,
        phases: [codeModPhase, contentPhase],
        message: 'Transformation phase started. Code modernisation is in progress.',
      },
      202,
    );
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/transform error:', err);
    return error('INTERNAL_ERROR', 'Failed to start transformation', 500);
  }
}
