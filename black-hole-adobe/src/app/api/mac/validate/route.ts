/**
 * POST /api/mac/validate
 *
 * Validate a Migration-as-Code config (YAML or JSON body).
 * Returns validation result with errors and warnings.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { MigrationConfigParser } from '@/lib/mac/parser';

const parser = new MigrationConfigParser();

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    const body = await request.text();

    if (!body.trim()) {
      return error('EMPTY_BODY', 'Request body is empty', 400);
    }

    const result = contentType.includes('application/json')
      ? parser.parseJSON(body)
      : parser.parseYAML(body);

    return success({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (err) {
    console.error('[API] POST /api/mac/validate error:', err);
    return error(
      'VALIDATION_ERROR',
      err instanceof Error ? err.message : 'Failed to validate config',
      500,
    );
  }
}
