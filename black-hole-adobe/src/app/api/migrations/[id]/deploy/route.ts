/**
 * POST/GET /api/migrations/[id]/deploy — Cloud Manager Deployment (ADR-052)
 *
 * POST: Triggers a Cloud Manager pipeline execution for a migration.
 * GET:  Polls execution status + step details for the frontend.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import { getMigration } from '@/lib/api/store';
import {
  CloudManagerClient,
  CloudManagerError,
  type CMCredentials,
} from '@/lib/deployment/cloud-manager-client';

type RouteParams = { params: Promise<{ id: string }> };

// ── POST — Trigger deployment ───────────────────────────────────────────

interface DeployRequest {
  programId: string;
  pipelineId?: string;
  credentials: CMCredentials;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, resetAt } = checkRateLimit(ip, RATE_LIMITS.authenticatedWrite);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Try again later.', 429, {
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    });
  }

  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const body = (await request.json()) as DeployRequest;

    if (!body.programId || !body.credentials) {
      return error(
        'VALIDATION_ERROR',
        'programId and credentials are required',
        400,
      );
    }

    const { programId, credentials } = body;

    // Validate that at least one auth method is provided
    if (!credentials.accessToken && (!credentials.clientId || !credentials.clientSecret)) {
      return error(
        'VALIDATION_ERROR',
        'Either accessToken or clientId + clientSecret must be provided',
        400,
      );
    }

    const client = new CloudManagerClient(credentials, programId);

    // Resolve pipeline — use provided ID or auto-detect
    let pipelineId = body.pipelineId;

    if (!pipelineId) {
      const pipelines = await client.listPipelines();

      if (pipelines.length === 0) {
        return error(
          'NO_PIPELINES',
          'No pipelines found for the specified program',
          404,
        );
      }

      // Prefer a full-stack production pipeline; fall back to first available
      const preferred = pipelines.find(
        (p) =>
          p.type === 'FULL_STACK_CODE' ||
          p.name.toLowerCase().includes('deploy') ||
          p.name.toLowerCase().includes('prod'),
      );
      pipelineId = preferred?.id ?? pipelines[0].id;
    }

    // Trigger
    const execution = await client.triggerPipeline(pipelineId);

    console.log(
      `[API] POST /api/migrations/${id}/deploy — triggered pipeline ${pipelineId}, execution ${execution.id}`,
    );

    return success(
      {
        migrationId: id,
        executionId: execution.id,
        pipelineId,
        programId,
        status: execution.status,
        message: 'Pipeline execution triggered successfully.',
      },
      202,
    );
  } catch (err) {
    if (err instanceof CloudManagerError) {
      console.error('[API] Cloud Manager error:', err.message, err.details);
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 502;
      return error(err.code, err.message, status, err.details ?? null);
    }

    console.error('[API] POST /api/migrations/[id]/deploy error:', err);
    return error('INTERNAL_ERROR', 'Failed to trigger deployment', 500);
  }
}

// ── GET — Poll execution status ─────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, resetAt } = checkRateLimit(ip, RATE_LIMITS.authenticatedRead);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Try again later.', 429, {
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    });
  }

  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const url = new URL(request.url);
    const executionId = url.searchParams.get('executionId');
    const pipelineId = url.searchParams.get('pipelineId');
    const programId = url.searchParams.get('programId');
    const accessToken = url.searchParams.get('accessToken');
    const clientId = url.searchParams.get('clientId');
    const imsOrg = url.searchParams.get('imsOrg');

    if (!executionId || !pipelineId || !programId) {
      return error(
        'VALIDATION_ERROR',
        'executionId, pipelineId, and programId are required query parameters',
        400,
      );
    }

    if (!accessToken) {
      return error(
        'VALIDATION_ERROR',
        'accessToken query parameter is required for status polling',
        400,
      );
    }

    const credentials: CMCredentials = {
      clientId: clientId ?? '',
      clientSecret: '',
      imsOrg: imsOrg ?? '',
      technicalAccountId: '',
      accessToken,
    };

    const client = new CloudManagerClient(credentials, programId);
    const [execution, steps] = await Promise.all([
      client.getExecution(pipelineId, executionId),
      client.getExecutionSteps(pipelineId, executionId),
    ]);

    return success({
      migrationId: id,
      execution,
      steps,
    });
  } catch (err) {
    if (err instanceof CloudManagerError) {
      console.error('[API] Cloud Manager error:', err.message);
      const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 502;
      return error(err.code, err.message, status, err.details ?? null);
    }

    console.error('[API] GET /api/migrations/[id]/deploy error:', err);
    return error('INTERNAL_ERROR', 'Failed to fetch deployment status', 500);
  }
}
