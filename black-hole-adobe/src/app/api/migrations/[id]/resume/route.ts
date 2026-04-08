/**
 * ADR-062: Resume endpoint for the Migration Orchestrator.
 *
 * GET  — inspect the resume plan without actually resuming.
 * POST — transition the migration back to its last active phase and start it.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { resumeManager } from '@/lib/orchestrator/resume';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const plan = await resumeManager.inspectResume(id);
    return success(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resume inspection failed';
    return error('RESUME_INSPECT_FAILED', message, 500);
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const result = await resumeManager.resume(id);
    return success(result, 202);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not resumable')) {
      return error('NOT_RESUMABLE', err.message, 400);
    }
    const message = err instanceof Error ? err.message : 'Resume failed';
    return error('RESUME_FAILED', message, 500);
  }
}
