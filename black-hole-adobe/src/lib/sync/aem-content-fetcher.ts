/**
 * AEM Content Fetcher
 *
 * Lightweight helper function that fetches content items from an AEM
 * instance and returns them as SnapshotItem[] for change detection.
 *
 * Uses fetch() directly (not the full AEMConnector class) to keep
 * the sync engine dependency-free and fast.
 */

import type { SnapshotItem } from '@/types/sync';

// ============================================================
// Types
// ============================================================

/** Shape returned by AEM QueryBuilder JSON endpoint. */
interface QueryBuilderResponse {
  success: boolean;
  results: number;
  total: number;
  offset: number;
  hits: Array<{
    'jcr:path': string;
    'jcr:title'?: string;
    'jcr:content/jcr:title'?: string;
    'jcr:content/jcr:lastModified'?: string;
    'jcr:content/sling:resourceType'?: string;
    'jcr:content/cq:template'?: string;
    [key: string]: unknown;
  }>;
}

/** Shape returned by Sling JSON export for a single node. */
interface SlingNodeResponse {
  'jcr:primaryType'?: string;
  'jcr:title'?: string;
  'sling:resourceType'?: string;
  'cq:template'?: string;
  'jcr:lastModified'?: string;
  'jcr:lastModifiedBy'?: string;
  'cq:lastReplicated'?: string;
  [key: string]: unknown;
}

// ============================================================
// Constants
// ============================================================

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 500;

// ============================================================
// Public API
// ============================================================

/**
 * Fetch content items from an AEM instance under the given basePath.
 *
 * Uses the QueryBuilder JSON endpoint to list cq:Page nodes, then
 * fetches jcr:content for each page to build a SnapshotItem with
 * path, type, lastModified, hash, and metadata.
 *
 * Returns an empty array on any error (network, auth, timeout, etc.)
 * so the sync engine degrades gracefully when AEM is unreachable.
 */
export async function fetchAemContentItems(
  url: string,
  basePath: string,
  credentials: Record<string, unknown> | null,
): Promise<SnapshotItem[]> {
  try {
    const headers = buildAuthHeaders(credentials);
    const hits = await fetchPageList(url, basePath, headers);

    if (hits.length === 0) {
      return [];
    }

    // Fetch jcr:content details for each page in parallel (batched)
    const items = await Promise.all(
      hits.map((hit) => fetchPageSnapshot(url, hit, headers)),
    );

    // Filter out nulls (pages we couldn't read)
    return items.filter((item): item is SnapshotItem => item !== null);
  } catch (err) {
    console.warn(
      `[aem-content-fetcher] Failed to fetch content from ${url}${basePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return [];
  }
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Build HTTP auth headers from credential config.
 * Supports bearer token and basic auth (username/password).
 */
function buildAuthHeaders(
  credentials: Record<string, unknown> | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!credentials) return headers;

  // Bearer token auth
  if (typeof credentials.token === 'string' && credentials.token) {
    headers['Authorization'] = `Bearer ${credentials.token}`;
    return headers;
  }

  // Basic auth
  if (
    typeof credentials.username === 'string' &&
    typeof credentials.password === 'string'
  ) {
    const encoded = btoa(`${credentials.username}:${credentials.password}`);
    headers['Authorization'] = `Basic ${encoded}`;
    return headers;
  }

  return headers;
}

/**
 * Query AEM QueryBuilder for cq:Page nodes under basePath.
 */
async function fetchPageList(
  baseUrl: string,
  basePath: string,
  headers: Record<string, string>,
): Promise<
  Array<{ path: string; title?: string; lastModified?: string }>
> {
  const params = new URLSearchParams({
    'type': 'cq:Page',
    'path': basePath,
    'p.limit': String(MAX_RESULTS),
    'p.hits': 'selective',
    'p.properties': 'jcr:path jcr:content/jcr:title jcr:content/jcr:lastModified',
  });

  const queryUrl = `${normalizeUrl(baseUrl)}/bin/querybuilder.json?${params.toString()}`;

  const response = await fetchWithTimeout(queryUrl, { headers });

  if (!response.ok) {
    console.warn(
      `[aem-content-fetcher] QueryBuilder returned ${response.status} for ${basePath}`,
    );
    return [];
  }

  const data: QueryBuilderResponse = await response.json();

  if (!data.hits || !Array.isArray(data.hits)) {
    return [];
  }

  return data.hits.map((hit) => ({
    path: hit['jcr:path'],
    title:
      hit['jcr:content/jcr:title'] ??
      hit['jcr:title'] ??
      undefined,
    lastModified: hit['jcr:content/jcr:lastModified'] ?? undefined,
  }));
}

/**
 * Fetch jcr:content for a single page and map to SnapshotItem.
 * Returns null if the page is inaccessible.
 */
async function fetchPageSnapshot(
  baseUrl: string,
  page: { path: string; title?: string; lastModified?: string },
  headers: Record<string, string>,
): Promise<SnapshotItem | null> {
  try {
    const nodeUrl = `${normalizeUrl(baseUrl)}${page.path}/jcr:content.json`;
    const response = await fetchWithTimeout(nodeUrl, { headers });

    if (!response.ok) {
      // Fall back to the data we got from QueryBuilder
      return buildSnapshotFromQueryHit(page);
    }

    const data: SlingNodeResponse = await response.json();

    const lastModified =
      (data['jcr:lastModified'] as string) ??
      page.lastModified ??
      new Date().toISOString();

    const item: SnapshotItem = {
      path: page.path,
      hash: '', // Will be computed by ChangeDetector.snapshot()
      type: 'page',
      lastModified,
      metadata: {
        title:
          (data['jcr:title'] as string) ??
          page.title ??
          page.path.split('/').pop() ??
          '',
        resourceType: (data['sling:resourceType'] as string) ?? '',
        template: (data['cq:template'] as string) ?? null,
        lastModifiedBy: (data['jcr:lastModifiedBy'] as string) ?? null,
        published: !!data['cq:lastReplicated'],
      },
    };

    return item;
  } catch {
    // If individual page fetch fails, use QueryBuilder data
    return buildSnapshotFromQueryHit(page);
  }
}

/**
 * Build a minimal SnapshotItem from QueryBuilder hit data alone
 * (used as fallback when jcr:content fetch fails).
 */
function buildSnapshotFromQueryHit(
  page: { path: string; title?: string; lastModified?: string },
): SnapshotItem {
  return {
    path: page.path,
    hash: '', // Will be computed by ChangeDetector.snapshot()
    type: 'page',
    lastModified: page.lastModified ?? new Date().toISOString(),
    metadata: {
      title: page.title ?? page.path.split('/').pop() ?? '',
    },
  };
}

/**
 * fetch() wrapper with AbortController timeout.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Remove trailing slash from URL.
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
