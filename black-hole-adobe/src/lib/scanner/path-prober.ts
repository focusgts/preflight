/**
 * Safe Path Prober — Tier 3 Detection
 *
 * Sends HEAD requests to known AEM-specific paths.
 * A 403 response indicates the path exists (AEM), while 404 means it does not.
 */

// ============================================================
// Types
// ============================================================

export interface ProbeResult {
  path: string;
  statusCode: number | null;
  isAEMIndicator: boolean;
  weight: number;
  error: string | null;
}

// ============================================================
// Constants
// ============================================================

const PROBE_TIMEOUT_MS = 5000;
const USER_AGENT = 'BlackHole-Scanner/1.0 (AEM Health Check; focusgts.com)';

/**
 * AEM-specific paths that exist on all installations.
 * Non-AEM servers return 404; AEM returns 200 or 403.
 */
const AEM_PROBE_PATHS: Array<{ path: string; weight: number }> = [
  { path: '/libs/granite/core/content/login.html', weight: 10 },
  { path: '/system/console', weight: 10 },
  { path: '/bin/querybuilder.json', weight: 8 },
  { path: '/content.json', weight: 7 },
];

// ============================================================
// Path Prober
// ============================================================

/**
 * Probe a single AEM path with a HEAD request.
 */
async function probeSinglePath(
  baseUrl: string,
  pathDef: { path: string; weight: number },
): Promise<ProbeResult> {
  const result: ProbeResult = {
    path: pathDef.path,
    statusCode: null,
    isAEMIndicator: false,
    weight: 0,
    error: null,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const url = new URL(pathDef.path, baseUrl).toString();
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    clearTimeout(timer);
    result.statusCode = response.status;

    // 403 = path exists but requires auth → strong AEM signal
    // 200 = path exists and is accessible → also AEM signal
    // 401 = path exists but requires auth → also AEM signal
    // 302/301 to login → path exists, AEM signal
    if (response.status === 403 || response.status === 401) {
      result.isAEMIndicator = true;
      result.weight = pathDef.weight;
    } else if (response.status === 200) {
      result.isAEMIndicator = true;
      result.weight = pathDef.weight;
    } else if (response.status === 302 || response.status === 301) {
      // Redirect might indicate AEM login redirect — weaker signal
      const location = response.headers.get('location') ?? '';
      if (/login|auth/i.test(location)) {
        result.isAEMIndicator = true;
        result.weight = Math.round(pathDef.weight * 0.7);
      }
    }
    // 404 = path does not exist → not AEM indicator, weight stays 0
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        result.error = 'Probe timed out';
      } else {
        result.error = `Probe failed: ${err.message}`;
      }
    } else {
      result.error = 'Probe failed with unknown error';
    }
  }

  return result;
}

/**
 * Probe all AEM-specific paths in parallel.
 * Returns results for each path including status and AEM indicator weight.
 */
export async function probeAEMPaths(baseUrl: string): Promise<ProbeResult[]> {
  const results = await Promise.allSettled(
    AEM_PROBE_PATHS.map((pathDef) => probeSinglePath(baseUrl, pathDef)),
  );

  return results.map((settled, index) => {
    if (settled.status === 'fulfilled') {
      return settled.value;
    }
    // Promise.allSettled should not reject since probeSinglePath catches errors,
    // but handle it defensively
    return {
      path: AEM_PROBE_PATHS[index].path,
      statusCode: null,
      isAEMIndicator: false,
      weight: 0,
      error: 'Probe promise rejected unexpectedly',
    };
  });
}
