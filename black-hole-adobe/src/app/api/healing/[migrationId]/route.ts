/**
 * GET /api/healing/[migrationId]  — Get healing report for a migration
 * POST /api/healing/[migrationId] — Manually trigger healing for a specific item
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { HealingEngine } from '@/lib/healing';
import type { MigrationItem } from '@/types';

// Shared engine instance (in production, use DI or singleton)
const healingEngine = new HealingEngine();

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  try {
    const { migrationId } = await params;

    if (!migrationId) {
      return error('MISSING_ID', 'Migration ID is required', 400);
    }

    const report = healingEngine.getHealingReport(migrationId);
    return success(report);
  } catch (err) {
    return error(
      'HEALING_REPORT_ERROR',
      err instanceof Error ? err.message : 'Failed to get healing report',
      500,
    );
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const triggerSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  itemType: z.string(),
  sourcePath: z.string(),
  targetPath: z.string().nullable().optional(),
  errorMessage: z.string(),
  phase: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  try {
    const { migrationId } = await params;

    if (!migrationId) {
      return error('MISSING_ID', 'Migration ID is required', 400);
    }

    const body = await request.json();
    const parsed = triggerSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        'VALIDATION_ERROR',
        'Invalid request body',
        400,
        { issues: parsed.error.issues },
      );
    }

    const item: MigrationItem = {
      id: parsed.data.itemId,
      type: parsed.data.itemType,
      name: parsed.data.itemName,
      sourcePath: parsed.data.sourcePath,
      targetPath: parsed.data.targetPath ?? null,
      status: 'failed',
      compatibilityLevel: 'manual_fix' as any,
      autoFixed: false,
      validationResult: null,
      error: parsed.data.errorMessage,
      processedAt: null,
    };

    const result = await healingEngine.handleFailure(
      migrationId,
      parsed.data.phase,
      item,
      new Error(parsed.data.errorMessage),
    );

    return success(
      {
        action: result.action,
        shouldRetry: result.shouldRetry,
      },
      201,
    );
  } catch (err) {
    return error(
      'HEALING_TRIGGER_ERROR',
      err instanceof Error ? err.message : 'Failed to trigger healing',
      500,
    );
  }
}
