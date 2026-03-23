/**
 * POST /api/mac/execute
 *
 * Execute a migration from a YAML or JSON config.
 * Validates the config, creates the migration project, and returns the ID.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { MigrationConfigParser } from '@/lib/mac/parser';
import { MigrationConfigExecutor } from '@/lib/mac/executor';

const parser = new MigrationConfigParser();
const executor = new MigrationConfigExecutor();

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const body = await request.text();

    if (!body.trim()) {
      return error('EMPTY_BODY', 'Request body is empty', 400);
    }

    // Parse and validate
    const parseResult = contentType.includes('application/json')
      ? parser.parseJSON(body)
      : parser.parseYAML(body);

    if (!parseResult.valid || !parseResult.config) {
      return error(
        'INVALID_CONFIG',
        'Migration config validation failed',
        400,
        { errors: parseResult.errors, warnings: parseResult.warnings },
      );
    }

    // Check for dry-run mode
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
    if (dryRun) {
      const result = executor.dryRun(parseResult.config);
      return success({ dryRun: true, ...result });
    }

    // Execute
    const result = executor.execute(parseResult.config, {
      resolveEnvVars: false, // Don't resolve on server for security
    });

    if (result.status === 'failed') {
      return error('EXECUTION_FAILED', result.message, 500);
    }

    console.log(`[API] POST /api/mac/execute — created ${result.migrationId}`);
    return success(
      {
        migrationId: result.migrationId,
        project: result.project,
        message: result.message,
      },
      201,
    );
  } catch (err) {
    console.error('[API] POST /api/mac/execute error:', err);
    return error(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Failed to execute migration',
      500,
    );
  }
}
