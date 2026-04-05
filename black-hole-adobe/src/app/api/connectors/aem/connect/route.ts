/**
 * POST /api/connectors/aem/connect
 *
 * Connect to an AEM instance (on-prem or AEMaaCS) and return a quick
 * inventory of available content, assets, components, and workflows.
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectorConfig } from '@/types';
import { success, error } from '@/lib/api/response';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import { AEMConnector } from '@/lib/connectors/aem-connector';

// ── Validation ──────────────────────────────────────────────────────────

const connectSchema = z.object({
  baseUrl: z.string().url(),
  authType: z.enum(['basic', 'bearer']),
  accessToken: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).refine(
  (data) => {
    if (data.authType === 'bearer') return !!data.accessToken;
    if (data.authType === 'basic') return !!data.username && !!data.password;
    return false;
  },
  { message: 'bearer auth requires accessToken; basic auth requires username and password' },
);

// ── Route handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed, resetAt } = checkRateLimit(ip, RATE_LIMITS.connectorOps);
  if (!allowed) {
    return error('RATE_LIMITED', 'Too many requests. Try again later.', 429, { retryAfter: Math.ceil((resetAt - Date.now()) / 1000) });
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const { baseUrl, authType, accessToken, username, password } = parsed.data;

    // Build a ConnectorConfig for the AEM connector
    const config: ConnectorConfig = {
      id: `aem-${uuidv4().slice(0, 8)}`,
      type: 'aem',
      name: 'AEM Connection Test',
      connectionDetails: {
        baseUrl,
        authType,
        ...(authType === 'bearer' ? { accessToken } : { username, password }),
      },
      status: 'disconnected',
      lastTestedAt: null,
      capabilities: [],
    };

    const connector = new AEMConnector(config);

    // Connect (validates reachability + credentials + detects environment)
    await connector.connect();

    const environment = connector.getDetectedEnvironment();

    // Run a quick inventory using QueryBuilder counts
    const [pages, assets, components, workflows] = await Promise.all([
      countViaQueryBuilder(connector, { type: 'cq:Page', path: '/content' }),
      countViaQueryBuilder(connector, { type: 'dam:Asset', path: '/content/dam' }),
      countViaQueryBuilder(connector, { type: 'cq:Component', path: '/apps' }),
      countViaQueryBuilder(connector, { type: 'cq:WorkflowModel', path: '/var/workflow/models' }),
    ]);

    // Determine which capabilities are available vs unavailable
    const capabilities: string[] = ['content', 'assets', 'components', 'workflows', 'indexes'];
    const unavailable: string[] = [];

    if (environment === 'cloud-service') {
      unavailable.push('configs', 'dispatcher');
    } else {
      capabilities.push('configs', 'dispatcher');
    }

    const latencyMs = Date.now() - startTime;

    console.log(
      `[API] POST /api/connectors/aem/connect — ${environment}, ${latencyMs}ms`,
    );

    return success({
      connected: true,
      environment,
      inventory: { pages, assets, components, workflows },
      capabilities,
      unavailable,
      latencyMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] POST /api/connectors/aem/connect error:', message);
    return error('AEM_CONNECT_FAILED', message, 502);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Use the connector's internal queryBuilder to get a count.
 * We call the public extractX methods' underlying QueryBuilder endpoint
 * with p.limit=0 so we only get the total, not the actual results.
 */
async function countViaQueryBuilder(
  connector: AEMConnector,
  params: { type: string; path: string },
): Promise<number> {
  try {
    // Access the connector's makeRequest and buildUrl via a thin wrapper.
    // Since those are protected, we use the connector as an HttpClient proxy
    // by hitting the QueryBuilder endpoint directly through fetch.
    const config = connector.getConfig();
    const baseUrl = (config.connectionDetails.baseUrl as string).replace(/\/+$/, '');
    const authType = config.connectionDetails.authType as string;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${config.connectionDetails.accessToken as string}`;
    } else {
      const encoded = Buffer.from(
        `${config.connectionDetails.username}:${config.connectionDetails.password}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }

    const queryParams = new URLSearchParams({
      'type': params.type,
      'path': params.path,
      'p.limit': '0',
    });

    const url = `${baseUrl}/bin/querybuilder.json?${queryParams.toString()}`;
    const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });

    if (!response.ok) return 0;

    const data = (await response.json()) as { total?: number };
    return data.total ?? 0;
  } catch {
    return 0;
  }
}
