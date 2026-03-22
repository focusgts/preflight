/**
 * POST /api/migrations/[id]/execute — Execute migration
 *
 * Transitions the migration to EXECUTING status.
 * Creates cutover phase and begins simulated deployment.
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

    // Transformation must be complete before execution
    if (migration.status !== MigrationStatus.TRANSFORMING) {
      return error(
        'INVALID_STATE',
        `Cannot execute migration in ${migration.status} state. Transformation must be in progress or complete.`,
        409,
      );
    }

    // Check that code modernisation phase is substantially complete
    const codePhase = migration.phases.find(
      (p) => p.type === PhaseType.CODE_MODERNIZATION,
    );
    if (codePhase && codePhase.progress < 80) {
      return error(
        'PREREQUISITE_INCOMPLETE',
        `Code modernisation is only ${codePhase.progress}% complete. Must be at least 80% before execution.`,
        400,
      );
    }

    const now = new Date().toISOString();

    // Mark transformation phases as completed
    const updatedPhases = migration.phases.map((phase) => {
      if (
        phase.type === PhaseType.CODE_MODERNIZATION ||
        phase.type === PhaseType.CONTENT_MIGRATION
      ) {
        return {
          ...phase,
          status: MigrationStatus.COMPLETED,
          progress: 100,
          completedAt: now,
          items: phase.items.map((item) => ({
            ...item,
            status: 'completed' as const,
            processedAt: item.processedAt ?? now,
          })),
        };
      }
      return phase;
    });

    // Create cutover phase
    const cutoverItems: MigrationItem[] = [
      {
        id: `ei-${uuidv4().slice(0, 8)}`,
        type: 'dns-cutover',
        name: 'DNS Cutover',
        sourcePath: 'dns://source',
        targetPath: 'dns://target',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
      {
        id: `ei-${uuidv4().slice(0, 8)}`,
        type: 'ssl-provisioning',
        name: 'SSL Certificate Provisioning',
        sourcePath: 'ssl://source',
        targetPath: 'ssl://target',
        status: 'pending',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
      {
        id: `ei-${uuidv4().slice(0, 8)}`,
        type: 'cdn-configuration',
        name: 'CDN Configuration',
        sourcePath: 'cdn://source',
        targetPath: 'cdn://target',
        status: 'processing',
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        autoFixed: false,
        validationResult: null,
        error: null,
        processedAt: null,
      },
    ];

    const cutoverPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.CUTOVER,
      name: 'Cutover',
      status: MigrationStatus.EXECUTING,
      progress: 10,
      items: cutoverItems,
      startedAt: now,
      completedAt: null,
      estimatedDuration: 8,
      actualDuration: null,
    };

    updateMigration(id, {
      status: MigrationStatus.EXECUTING,
      phases: [...updatedPhases, cutoverPhase],
      progress: 75,
    });

    console.log(`[API] POST /api/migrations/${id}/execute — execution started`);
    return success(
      {
        migrationId: id,
        status: MigrationStatus.EXECUTING,
        cutoverPhase,
        message: 'Migration execution started. Cutover phase is in progress.',
      },
      202,
    );
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/execute error:', err);
    return error('INTERNAL_ERROR', 'Failed to execute migration', 500);
  }
}
