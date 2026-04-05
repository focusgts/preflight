/**
 * AEM Content Writer
 *
 * Provides two write mechanisms for transferring content between AEM instances:
 *
 * A. Sling POST Servlet - for individual items and incremental sync
 * B. Package Manager API - for bulk content transfers
 * C. Batch writer - orchestrates A and B based on batch size
 *
 * ADR-050: Content Transfer Implementation
 */

import type { MigrationItem } from '@/types';
import { CompatibilityLevel } from '@/types';
import { validateScanTarget } from '@/lib/security/url-validator';

// ============================================================
// Types
// ============================================================

export interface AemCredentials {
  authType: string;
  accessToken?: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface SlingPostResult {
  success: boolean;
  status: number;
  error?: string;
}

export interface PackageTransferResult {
  success: boolean;
  itemCount: number;
  errors: string[];
}

export interface BatchTransferResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ path: string; error: string }>;
}

// ============================================================
// Constants
// ============================================================

const SLING_POST_TIMEOUT_MS = 10_000;
const PACKAGE_TIMEOUT_MS = 60_000;
const DEFAULT_BATCH_SIZE = 50;
const SLING_POST_THRESHOLD = 20;
const MAX_PACKAGE_PATHS = 200;

// ============================================================
// Auth helpers
// ============================================================

function buildAuthHeaders(credentials: AemCredentials): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (credentials.authType) {
    case 'bearer':
    case 'oauth_s2s':
      if (credentials.accessToken) {
        headers['Authorization'] = `Bearer ${credentials.accessToken}`;
      } else if (credentials.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`;
      }
      break;
    case 'basic':
    default:
      if (credentials.username && credentials.password) {
        const encoded = btoa(`${credentials.username}:${credentials.password}`);
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
  }

  return headers;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function validateUrl(url: string): void {
  const result = validateScanTarget(url);
  if (!result.valid) {
    throw new ContentWriterError(`URL rejected by SSRF validation: ${result.reason}`, 'SSRF_BLOCKED');
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Error class
// ============================================================

export class ContentWriterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ContentWriterError';
  }
}

// ============================================================
// A. Sling POST — individual item writes
// ============================================================

/**
 * Write properties to a JCR node via the Sling POST Servlet.
 *
 * POST to `{targetUrl}{path}` with form-encoded properties.
 * Supports deep node creation via `childName/propertyName` notation.
 */
export async function slingPost(
  targetUrl: string,
  path: string,
  properties: Record<string, unknown>,
  credentials: AemCredentials,
): Promise<SlingPostResult> {
  validateUrl(targetUrl);

  const url = `${normalizeUrl(targetUrl)}${path}`;
  const authHeaders = buildAuthHeaders(credentials);

  // Build form-encoded body from properties
  const formParams = new URLSearchParams();
  flattenProperties(properties, '', formParams);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...authHeaders,
        },
        body: formParams.toString(),
      },
      SLING_POST_TIMEOUT_MS,
    );

    if (response.status === 200 || response.status === 201) {
      return { success: true, status: response.status };
    }

    if (response.status === 403) {
      return {
        success: false,
        status: response.status,
        error: `Auth failure writing to ${path} — check target credentials`,
      };
    }

    const body = await response.text().catch(() => '');
    return {
      success: false,
      status: response.status,
      error: `Sling POST returned ${response.status} for ${path}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 0,
      error: `Sling POST to ${path} failed: ${message}`,
    };
  }
}

/**
 * Send an HTTP DELETE to remove a node at the given path.
 */
export async function slingDelete(
  targetUrl: string,
  path: string,
  credentials: AemCredentials,
): Promise<SlingPostResult> {
  validateUrl(targetUrl);

  const url = `${normalizeUrl(targetUrl)}${path}`;
  const authHeaders = buildAuthHeaders(credentials);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...authHeaders,
        },
        body: ':operation=delete',
      },
      SLING_POST_TIMEOUT_MS,
    );

    if (response.status === 200 || response.status === 204) {
      return { success: true, status: response.status };
    }

    return {
      success: false,
      status: response.status,
      error: `Delete returned ${response.status} for ${path}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: 0,
      error: `Delete of ${path} failed: ${message}`,
    };
  }
}

/**
 * Flatten nested properties for Sling POST deep node creation.
 * `{ child: { prop: "val" } }` becomes `child/prop=val`.
 */
function flattenProperties(
  obj: Record<string, unknown>,
  prefix: string,
  params: URLSearchParams,
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}/${key}` : key;

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      flattenProperties(value as Record<string, unknown>, fullKey, params);
      continue;
    }

    if (Array.isArray(value)) {
      // Sling multi-value: add @TypeHint and multiple values
      for (const v of value) {
        params.append(fullKey, String(v));
      }
      params.set(`${fullKey}@TypeHint`, 'String[]');
      continue;
    }

    params.set(fullKey, String(value));

    // Add type hints for non-string types
    if (typeof value === 'boolean') {
      params.set(`${fullKey}@TypeHint`, 'Boolean');
    } else if (typeof value === 'number') {
      params.set(`${fullKey}@TypeHint`, Number.isInteger(value) ? 'Long' : 'Double');
    }
  }
}

// ============================================================
// B. Package Manager — bulk transfers
// ============================================================

/**
 * Transfer content between AEM instances via CRX Package Manager.
 *
 * 1. Create a package on source with the specified filter paths
 * 2. Build the package
 * 3. Download the built ZIP
 * 4. Upload the ZIP to the target
 * 5. Install the package on the target
 * 6. Clean up temporary packages
 */
export async function createAndInstallPackage(
  sourceUrl: string,
  targetUrl: string,
  paths: string[],
  credentials: { source: AemCredentials; target: AemCredentials },
  options?: { packageName?: string; groupName?: string },
): Promise<PackageTransferResult> {
  validateUrl(sourceUrl);
  validateUrl(targetUrl);

  const errors: string[] = [];
  const pkgName = options?.packageName ?? `blackhole-transfer-${Date.now()}`;
  const groupName = options?.groupName ?? 'black-hole';

  // Chunk paths into manageable packages
  const pathChunks = chunkArray(paths, MAX_PACKAGE_PATHS);
  let totalItems = 0;

  for (let chunkIdx = 0; chunkIdx < pathChunks.length; chunkIdx++) {
    const chunk = pathChunks[chunkIdx];
    const chunkPkgName = pathChunks.length > 1
      ? `${pkgName}-part${chunkIdx + 1}`
      : pkgName;

    try {
      // Step 1: Create package on source
      const createResult = await packageManagerCommand(
        sourceUrl,
        credentials.source,
        {
          cmd: 'create',
          packageName: chunkPkgName,
          groupName,
        },
      );

      if (!createResult.success) {
        errors.push(`Failed to create package ${chunkPkgName}: ${createResult.message}`);
        continue;
      }

      // Step 2: Add filter paths
      const filterJson = JSON.stringify(
        chunk.map((p) => ({ root: p, rules: [] })),
      );

      const editResult = await packageManagerCommand(
        sourceUrl,
        credentials.source,
        {
          cmd: 'edit',
          packageName: chunkPkgName,
          groupName,
          filter: filterJson,
        },
      );

      if (!editResult.success) {
        errors.push(`Failed to set filters on ${chunkPkgName}: ${editResult.message}`);
        await cleanupPackage(sourceUrl, credentials.source, groupName, chunkPkgName);
        continue;
      }

      // Step 3: Build package
      const buildResult = await packageManagerCommand(
        sourceUrl,
        credentials.source,
        {
          cmd: 'build',
          packageName: chunkPkgName,
          groupName,
        },
      );

      if (!buildResult.success) {
        errors.push(`Failed to build package ${chunkPkgName}: ${buildResult.message}`);
        await cleanupPackage(sourceUrl, credentials.source, groupName, chunkPkgName);
        continue;
      }

      // Step 4: Download package from source
      const packageBytes = await downloadPackage(
        sourceUrl,
        credentials.source,
        groupName,
        chunkPkgName,
      );

      if (!packageBytes) {
        errors.push(`Failed to download package ${chunkPkgName}`);
        await cleanupPackage(sourceUrl, credentials.source, groupName, chunkPkgName);
        continue;
      }

      // Step 5: Upload package to target
      const uploadResult = await uploadPackage(
        targetUrl,
        credentials.target,
        packageBytes,
        chunkPkgName,
      );

      if (!uploadResult.success) {
        errors.push(`Failed to upload package ${chunkPkgName} to target: ${uploadResult.message}`);
        await cleanupPackage(sourceUrl, credentials.source, groupName, chunkPkgName);
        continue;
      }

      // Step 6: Install package on target
      const installResult = await packageManagerCommand(
        targetUrl,
        credentials.target,
        {
          cmd: 'install',
          packageName: chunkPkgName,
          groupName,
        },
      );

      if (!installResult.success) {
        errors.push(`Failed to install package ${chunkPkgName} on target: ${installResult.message}`);
      } else {
        totalItems += chunk.length;
      }

      // Step 7: Cleanup on both sides
      await cleanupPackage(sourceUrl, credentials.source, groupName, chunkPkgName);
      await cleanupPackage(targetUrl, credentials.target, groupName, chunkPkgName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Package transfer chunk ${chunkIdx + 1} failed: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    itemCount: totalItems,
    errors,
  };
}

// ---- Package Manager helpers ----

interface PackageCommandResult {
  success: boolean;
  message: string;
}

interface PackageCommandParams {
  cmd: string;
  packageName: string;
  groupName: string;
  filter?: string;
}

async function packageManagerCommand(
  baseUrl: string,
  credentials: AemCredentials,
  params: PackageCommandParams,
): Promise<PackageCommandResult> {
  const url = `${normalizeUrl(baseUrl)}/crx/packmgr/service.jsp`;
  const authHeaders = buildAuthHeaders(credentials);

  const formParams = new URLSearchParams();
  formParams.set('cmd', params.cmd);
  formParams.set('name', params.packageName);
  formParams.set('group', params.groupName);

  if (params.cmd === 'create') {
    formParams.set('version', '1.0');
  }

  if (params.filter) {
    formParams.set('filter', params.filter);
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...authHeaders,
        },
        body: formParams.toString(),
      },
      PACKAGE_TIMEOUT_MS,
    );

    const text = await response.text();

    // Package manager returns XML with success="true|false"
    const success =
      response.status === 200 &&
      (text.includes('status="200"') ||
        text.includes('code="200"') ||
        text.includes('<status code="200">') ||
        text.includes('success'));

    return {
      success,
      message: success ? 'OK' : text.slice(0, 300),
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function downloadPackage(
  baseUrl: string,
  credentials: AemCredentials,
  groupName: string,
  packageName: string,
): Promise<ArrayBuffer | null> {
  const url = `${normalizeUrl(baseUrl)}/etc/packages/${groupName}/${packageName}-1.0.zip`;
  const authHeaders = buildAuthHeaders(credentials);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: authHeaders,
      },
      PACKAGE_TIMEOUT_MS,
    );

    if (!response.ok) {
      return null;
    }

    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

async function uploadPackage(
  baseUrl: string,
  credentials: AemCredentials,
  packageBytes: ArrayBuffer,
  packageName: string,
): Promise<PackageCommandResult> {
  const url = `${normalizeUrl(baseUrl)}/crx/packmgr/service.jsp`;
  const authHeaders = buildAuthHeaders(credentials);

  const blob = new Blob([packageBytes], { type: 'application/zip' });
  const formData = new FormData();
  formData.append('cmd', 'upload');
  formData.append('force', 'true');
  formData.append('package', blob, `${packageName}-1.0.zip`);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: authHeaders, // No Content-Type — let browser set multipart boundary
        body: formData,
      },
      PACKAGE_TIMEOUT_MS,
    );

    const text = await response.text();
    const success = response.status === 200 && (text.includes('code="200"') || text.includes('success'));

    return { success, message: success ? 'OK' : text.slice(0, 300) };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function cleanupPackage(
  baseUrl: string,
  credentials: AemCredentials,
  groupName: string,
  packageName: string,
): Promise<void> {
  try {
    await packageManagerCommand(baseUrl, credentials, {
      cmd: 'delete',
      packageName,
      groupName,
    });
  } catch {
    // Best-effort cleanup — don't fail the transfer
  }
}

// ============================================================
// C. Batch writer — orchestrates Sling POST vs Package Manager
// ============================================================

/**
 * Execute a batch transfer of migration items between AEM instances.
 *
 * - Groups items into batches (default 50)
 * - Batches < 20 items use Sling POST (faster for small sets)
 * - Batches >= 20 items use Package Manager (more efficient for bulk)
 * - Retries failed items once before marking as failed
 * - Skips BLOCKER items
 */
export async function executeBatchTransfer(
  sourceUrl: string,
  targetUrl: string,
  items: MigrationItem[],
  credentials: { source: AemCredentials; target: AemCredentials },
  onProgress?: (processed: number, total: number, current: string) => void,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<BatchTransferResult> {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ path: string; error: string }> = [];

  // Filter out blockers
  const transferable: MigrationItem[] = [];
  for (const item of items) {
    if (item.compatibilityLevel === CompatibilityLevel.BLOCKER) {
      item.status = 'skipped';
      skipped++;
      continue;
    }
    transferable.push(item);
  }

  // Chunk into batches
  const batches = chunkArray(transferable, batchSize);
  let processed = 0;

  for (const batch of batches) {
    if (batch.length < SLING_POST_THRESHOLD) {
      // Use Sling POST for small batches
      const failedItems: MigrationItem[] = [];

      for (const item of batch) {
        item.status = 'processing';
        onProgress?.(processed, items.length, item.sourcePath);

        const result = await slingPost(
          targetUrl,
          item.targetPath ?? item.sourcePath,
          { 'jcr:primaryType': 'cq:Page' },
          credentials.target,
        );

        if (result.success) {
          item.status = 'completed';
          item.processedAt = new Date().toISOString();
          success++;
        } else {
          failedItems.push(item);
        }

        processed++;
      }

      // Retry failed items once
      for (const item of failedItems) {
        const retryResult = await slingPost(
          targetUrl,
          item.targetPath ?? item.sourcePath,
          { 'jcr:primaryType': 'cq:Page' },
          credentials.target,
        );

        if (retryResult.success) {
          item.status = 'completed';
          item.processedAt = new Date().toISOString();
          success++;
        } else {
          item.status = 'failed';
          item.error = retryResult.error ?? 'Sling POST failed after retry';
          failed++;
          errors.push({ path: item.sourcePath, error: item.error });
        }
      }
    } else {
      // Use Package Manager for larger batches
      const paths = batch.map((item) => item.sourcePath);

      for (const item of batch) {
        item.status = 'processing';
      }

      onProgress?.(processed, items.length, `Package: ${batch.length} items`);

      const pkgResult = await createAndInstallPackage(
        sourceUrl,
        targetUrl,
        paths,
        credentials,
      );

      if (pkgResult.success) {
        for (const item of batch) {
          item.status = 'completed';
          item.processedAt = new Date().toISOString();
          success++;
        }
      } else {
        // Package failed — fall back to individual Sling POSTs
        for (const item of batch) {
          const fallbackResult = await slingPost(
            targetUrl,
            item.targetPath ?? item.sourcePath,
            { 'jcr:primaryType': 'cq:Page' },
            credentials.target,
          );

          if (fallbackResult.success) {
            item.status = 'completed';
            item.processedAt = new Date().toISOString();
            success++;
          } else {
            item.status = 'failed';
            item.error = fallbackResult.error ?? 'Transfer failed';
            failed++;
            errors.push({ path: item.sourcePath, error: item.error });
          }
        }

        // Add package-level errors for diagnostics
        for (const pkgError of pkgResult.errors) {
          errors.push({ path: '[package]', error: pkgError });
        }
      }

      processed += batch.length;
    }
  }

  return { success, failed, skipped, errors };
}

// ============================================================
// Utility
// ============================================================

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================
// Credential extraction helpers
// ============================================================

/**
 * Extract AemCredentials from a generic credential record (used by
 * SyncSourceConfig / SyncTargetConfig).
 */
export function toAemCredentials(
  creds: Record<string, unknown> | null,
): AemCredentials | null {
  if (!creds) return null;

  return {
    authType: (creds.authType as string) ?? (creds.token ? 'bearer' : 'basic'),
    accessToken: (creds.accessToken as string) ?? (creds.token as string) ?? undefined,
    token: (creds.token as string) ?? undefined,
    username: (creds.username as string) ?? undefined,
    password: (creds.password as string) ?? undefined,
  };
}

/**
 * Check whether credentials contain enough information for a real
 * HTTP request.  Returns false for null or empty credentials,
 * which signals "demo mode".
 */
export function hasRealCredentials(
  creds: Record<string, unknown> | null,
): boolean {
  if (!creds) return false;

  // Bearer / OAuth
  if (creds.accessToken || creds.token) return true;

  // Basic auth
  if (creds.username && creds.password) return true;

  return false;
}
