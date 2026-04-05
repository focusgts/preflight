/**
 * Remedy Executors — Real Remediation Actions (ADR-054)
 *
 * Each executor performs actual corrective actions against a target AEM
 * instance. When no target credentials are configured (demo mode), the
 * healing engine falls back to its existing in-memory behavior.
 *
 * Executors are intentionally simple — ~20-30 lines each. They call
 * standard AEM APIs (Sling POST, Felix Console, Oak index management)
 * and return success/failure with an optional rollback action.
 */

// ============================================================
// Types
// ============================================================

export interface TargetConfig {
  url: string;
  credentials: Record<string, unknown> | null;
}

export interface ExecutorContext {
  itemPath: string;
  errorMessage: string;
  phase: string;
}

export interface ExecutionResult {
  success: boolean;
  description: string;
  rollbackAction?: () => Promise<void>;
}

export interface RemedyExecutor {
  type: string;
  execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult>;
}

// ============================================================
// Shared Helpers
// ============================================================

const FETCH_TIMEOUT_MS = 15_000;

function buildAuthHeaders(
  credentials: Record<string, unknown> | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (!credentials) return headers;

  if (typeof credentials.token === 'string' && credentials.token) {
    headers['Authorization'] = `Bearer ${credentials.token}`;
    return headers;
  }
  if (
    typeof credentials.username === 'string' &&
    typeof credentials.password === 'string'
  ) {
    const encoded = btoa(`${credentials.username}:${credentials.password}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }
  return headers;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Content Retry Executor
// ============================================================

/**
 * Re-transfers a failed content item by POSTing it to the target
 * AEM instance via Sling POST servlet.
 */
export class ContentRetryExecutor implements RemedyExecutor {
  type = 'content-retry';

  async execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult> {
    const headers = buildAuthHeaders(target.credentials);
    const postUrl = `${normalizeUrl(target.url)}${context.itemPath}`;

    try {
      const response = await fetchWithTimeout(postUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          ':operation': 'import',
          ':contentType': 'json',
          ':replaceProperties': 'true',
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          description: `Content retry failed: HTTP ${response.status} for ${context.itemPath}`,
        };
      }

      return {
        success: true,
        description: `Re-transferred content at ${context.itemPath}`,
        rollbackAction: async () => {
          await fetchWithTimeout(postUrl, {
            method: 'POST',
            headers,
            body: new URLSearchParams({ ':operation': 'delete' }),
          });
        },
      };
    } catch (err) {
      return {
        success: false,
        description: `Content retry error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================================
// Permission Fix Executor
// ============================================================

/**
 * Fixes ACL issues by granting read access to common service users
 * via the modifyAce endpoint.
 */
export class PermissionFixExecutor implements RemedyExecutor {
  type = 'permission-fix';

  async execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult> {
    const headers = buildAuthHeaders(target.credentials);
    const aceUrl = `${normalizeUrl(target.url)}${context.itemPath}.modifyAce.html`;

    try {
      const response = await fetchWithTimeout(aceUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'principalId': 'content-reader-service',
          'privilege@jcr:read': 'granted',
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          description: `Permission fix failed: HTTP ${response.status} at ${context.itemPath}`,
        };
      }

      return {
        success: true,
        description: `Granted read permission to content-reader-service at ${context.itemPath}`,
        rollbackAction: async () => {
          await fetchWithTimeout(aceUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              'principalId': 'content-reader-service',
              'privilege@jcr:read': 'denied',
            }),
          });
        },
      };
    } catch (err) {
      return {
        success: false,
        description: `Permission fix error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================================
// Index Rebuild Executor
// ============================================================

/**
 * Triggers an Oak index re-index by setting reindex=true on the
 * index node. Only applicable to on-prem / AMS — not AEMaaCS.
 */
export class IndexRebuildExecutor implements RemedyExecutor {
  type = 'index-rebuild';

  async execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult> {
    const headers = buildAuthHeaders(target.credentials);
    // Default index path if none found in context
    const indexPath = context.itemPath.includes('/oak:index')
      ? context.itemPath
      : '/oak:index/lucene';
    const indexUrl = `${normalizeUrl(target.url)}${indexPath}`;

    try {
      const response = await fetchWithTimeout(indexUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'reindex': 'true' }),
      });

      if (!response.ok) {
        return {
          success: false,
          description: `Index rebuild failed: HTTP ${response.status} for ${indexPath}`,
        };
      }

      return {
        success: true,
        description: `Triggered re-index for ${indexPath}`,
      };
    } catch (err) {
      return {
        success: false,
        description: `Index rebuild error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================================
// Bundle Restart Executor
// ============================================================

/**
 * Restarts a failed OSGi bundle via the Felix Console API.
 * Only works on on-prem / AMS instances — not AEMaaCS.
 */
export class BundleRestartExecutor implements RemedyExecutor {
  type = 'bundle-restart';

  async execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult> {
    // Extract bundle name from error message
    const bundleMatch = context.errorMessage.match(
      /bundle\s+([a-z][a-z0-9._-]+)/i,
    );
    const bundleName = bundleMatch?.[1] ?? 'unknown';

    if (bundleName === 'unknown') {
      return {
        success: false,
        description: 'Could not identify bundle name from error message',
      };
    }

    const headers = buildAuthHeaders(target.credentials);
    const bundleUrl = `${normalizeUrl(target.url)}/system/console/bundles/${bundleName}`;

    try {
      const response = await fetchWithTimeout(bundleUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'start' }),
      });

      if (!response.ok) {
        return {
          success: false,
          description: `Bundle restart failed: HTTP ${response.status} for ${bundleName}`,
        };
      }

      return {
        success: true,
        description: `Restarted OSGi bundle: ${bundleName}`,
      };
    } catch (err) {
      return {
        success: false,
        description: `Bundle restart error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================================
// Deployment Retry Executor
// ============================================================

/**
 * Re-triggers a Cloud Manager pipeline execution. Since no
 * CloudManagerClient exists yet, this executor posts to the
 * Cloud Manager API directly using the provided credentials.
 */
export class DeploymentRetryExecutor implements RemedyExecutor {
  type = 'deployment-retry';

  async execute(
    target: TargetConfig,
    context: ExecutorContext,
  ): Promise<ExecutionResult> {
    // Cloud Manager requires a separate API endpoint and program/pipeline IDs
    const credentials = target.credentials;
    const programId = credentials?.programId as string | undefined;
    const pipelineId = credentials?.pipelineId as string | undefined;

    if (!programId || !pipelineId) {
      return {
        success: false,
        description:
          'Deployment retry requires programId and pipelineId in credentials',
      };
    }

    const headers = buildAuthHeaders(credentials);
    const cmUrl = `https://cloudmanager.adobe.io/api/program/${programId}/pipeline/${pipelineId}/execution`;

    try {
      const response = await fetchWithTimeout(cmUrl, {
        method: 'PUT',
        headers: { ...headers, 'x-api-key': (credentials?.apiKey as string) ?? '' },
      });

      if (!response.ok) {
        return {
          success: false,
          description: `Deployment retry failed: HTTP ${response.status} for pipeline ${pipelineId}`,
        };
      }

      return {
        success: true,
        description: `Re-triggered Cloud Manager pipeline ${pipelineId}`,
      };
    } catch (err) {
      return {
        success: false,
        description: `Deployment retry error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================================
// Registry
// ============================================================

/**
 * Maps remedy categories / error types to concrete executors.
 * The healing engine looks up an executor by type string.
 */
export class RemedyExecutorRegistry {
  private executors: Map<string, RemedyExecutor> = new Map();

  register(executor: RemedyExecutor): void {
    this.executors.set(executor.type, executor);
  }

  get(type: string): RemedyExecutor | null {
    return this.executors.get(type) ?? null;
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  /** Create a registry with all built-in executors. */
  static createDefault(): RemedyExecutorRegistry {
    const registry = new RemedyExecutorRegistry();
    registry.register(new ContentRetryExecutor());
    registry.register(new PermissionFixExecutor());
    registry.register(new IndexRebuildExecutor());
    registry.register(new BundleRestartExecutor());
    registry.register(new DeploymentRetryExecutor());
    return registry;
  }
}
