/**
 * POST /api/connectors/aem/extract
 *
 * Connect to an AEM instance and extract data for the requested
 * capabilities (content, assets, components, configs, workflows,
 * indexes, dispatcher).
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectorConfig } from '@/types';
import { success, error } from '@/lib/api/response';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import { AEMConnector } from '@/lib/connectors/aem-connector';

// ── Validation ──────────────────────────────────────────────────────────

const VALID_CAPABILITIES = [
  'content',
  'assets',
  'components',
  'configs',
  'workflows',
  'indexes',
  'dispatcher',
] as const;

type Capability = (typeof VALID_CAPABILITIES)[number];

const extractSchema = z.object({
  baseUrl: z.string().url(),
  authType: z.enum(['basic', 'bearer']),
  accessToken: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  extract: z.array(z.enum(VALID_CAPABILITIES)).min(1),
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

  try {
    const body = await request.json();
    const parsed = extractSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
        validCapabilities: VALID_CAPABILITIES,
      });
    }

    const { baseUrl, authType, accessToken, username, password, extract } = parsed.data;

    const config: ConnectorConfig = {
      id: `aem-${uuidv4().slice(0, 8)}`,
      type: 'aem',
      name: 'AEM Extraction',
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
    await connector.connect();

    const startTime = Date.now();
    const warnings: string[] = [];
    const requested = new Set<Capability>(extract);

    // Run all requested extractions in parallel
    const [content, assets, components, configs, workflows, indexes, dispatcherConfig] =
      await Promise.all([
        requested.has('content')
          ? connector.extractContent().catch((e) => {
              warnings.push(`Content: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('assets')
          ? connector.extractAssets().catch((e) => {
              warnings.push(`Assets: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('components')
          ? connector.extractComponents().catch((e) => {
              warnings.push(`Components: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('configs')
          ? connector.extractConfigs().catch((e) => {
              warnings.push(`Configs: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('workflows')
          ? connector.extractWorkflows().catch((e) => {
              warnings.push(`Workflows: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('indexes')
          ? connector.extractIndexes().catch((e) => {
              warnings.push(`Indexes: ${(e as Error).message}`);
              return [];
            })
          : Promise.resolve([]),
        requested.has('dispatcher')
          ? connector.extractDispatcherConfig().catch((e) => {
              warnings.push(`Dispatcher: ${(e as Error).message}`);
              return null;
            })
          : Promise.resolve(null),
      ]);

    const totalItems =
      content.length +
      assets.length +
      components.length +
      configs.length +
      workflows.length +
      indexes.length;

    const durationMs = Date.now() - startTime;

    console.log(
      `[API] POST /api/connectors/aem/extract — ${extract.join(',')} — ${totalItems} items in ${durationMs}ms`,
    );

    return success({
      environment: connector.getDetectedEnvironment(),
      data: {
        content,
        assets,
        components,
        configs,
        workflows,
        indexes,
        dispatcherConfig,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs,
        itemCount: totalItems,
        warnings,
        requested: extract,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] POST /api/connectors/aem/extract error:', message);
    return error('AEM_EXTRACT_FAILED', message, 502);
  }
}
