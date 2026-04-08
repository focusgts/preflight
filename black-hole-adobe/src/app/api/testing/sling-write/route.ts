/**
 * POST /api/testing/sling-write — TEST-ONLY endpoint for Phase 2 validation
 *
 * This endpoint is for running Phase 2 sandbox validation tests only.
 * It exposes slingPost and slingDelete directly so test scripts can
 * exercise the write path against a live AEM instance.
 *
 * It is behind dashboard auth (session cookie required). Remove after
 * Phase 2 testing is complete OR gate behind a feature flag in production.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { slingPost, slingDelete } from '@/lib/migration/aem-content-writer';

interface TestRequest {
  operation: 'create' | 'delete' | 'read';
  targetUrl: string;
  accessToken: string;
  path: string;
  properties?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestRequest;

    if (!body.operation || !body.targetUrl || !body.accessToken || !body.path) {
      return error('VALIDATION_ERROR', 'Missing required fields', 400);
    }

    const credentials = {
      authType: 'bearer',
      accessToken: body.accessToken,
    };

    if (body.operation === 'create') {
      const result = await slingPost(
        body.targetUrl,
        body.path,
        body.properties || {
          'jcr:primaryType': 'cq:Page',
        },
        credentials,
      );
      return success({ operation: 'create', path: body.path, result });
    }

    if (body.operation === 'delete') {
      const result = await slingDelete(body.targetUrl, body.path, credentials);
      return success({ operation: 'delete', path: body.path, result });
    }

    if (body.operation === 'read') {
      // Direct fetch to verify the write landed
      const url = `${body.targetUrl}${body.path}.json`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${body.accessToken}` },
      });
      const text = await response.text();
      return success({
        operation: 'read',
        path: body.path,
        status: response.status,
        exists: response.status === 200,
        preview: text.slice(0, 300),
      });
    }

    return error('VALIDATION_ERROR', 'Unknown operation', 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] POST /api/testing/sling-write error:', message);
    return error('TEST_FAILED', message, 500);
  }
}
