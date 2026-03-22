/**
 * GET  /api/connectors — List configured connectors
 * POST /api/connectors — Add a new connector
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectorConfig } from '@/types';
import { success, error, paginated } from '@/lib/api/response';
import { listConnectors, createConnector } from '@/lib/api/store';

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '20')));
    const typeFilter = params.get('type');
    const statusFilter = params.get('status') as ConnectorConfig['status'] | null;

    let items = listConnectors();

    if (typeFilter) {
      items = items.filter((c) => c.type === typeFilter);
    }
    if (statusFilter) {
      items = items.filter((c) => c.status === statusFilter);
    }

    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    console.log(`[API] GET /api/connectors — ${totalItems} total`);
    return paginated(paged, page, pageSize, totalItems);
  } catch (err) {
    console.error('[API] GET /api/connectors error:', err);
    return error('INTERNAL_ERROR', 'Failed to list connectors', 500);
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const SUPPORTED_CONNECTOR_TYPES = [
  'aem',
  'aem-cloud',
  'analytics',
  'cja',
  'campaign',
  'campaign-v8',
  'target',
  'ajo',
  'aep',
  'rtcdp',
  'marketo',
  'workfront',
  'commerce',
  'google-analytics',
  'wordpress',
  'sitecore',
  'drupal',
  'salesforce-mc',
  'shopify',
  'custom',
] as const;

const createConnectorSchema = z.object({
  type: z.enum(SUPPORTED_CONNECTOR_TYPES),
  name: z.string().min(1).max(200),
  connectionDetails: z.record(z.string(), z.unknown()),
  capabilities: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createConnectorSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
        supportedTypes: SUPPORTED_CONNECTOR_TYPES,
      });
    }

    const data = parsed.data;

    const connector: ConnectorConfig = {
      id: `conn-${uuidv4().slice(0, 8)}`,
      type: data.type,
      name: data.name,
      connectionDetails: data.connectionDetails,
      status: 'disconnected',
      lastTestedAt: null,
      capabilities: data.capabilities,
    };

    createConnector(connector);

    console.log(`[API] POST /api/connectors — created ${connector.id} (${connector.type})`);
    return success(connector, 201);
  } catch (err) {
    console.error('[API] POST /api/connectors error:', err);
    return error('INTERNAL_ERROR', 'Failed to create connector', 500);
  }
}
