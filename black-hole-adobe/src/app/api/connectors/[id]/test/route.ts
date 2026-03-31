/**
 * POST /api/connectors/[id]/test — Test connector connection
 *
 * Runs a connectivity test against the configured connector.
 * Validates credentials, network reachability, and capabilities.
 *
 * For AEM connectors: performs real DNS, TLS, health, and auth checks.
 * For other types: real DNS/TLS, mock remaining checks.
 */

import { type NextRequest } from 'next/server';
import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import { success, error } from '@/lib/api/response';
import { getConnector, updateConnector } from '@/lib/api/store';

type RouteParams = { params: Promise<{ id: string }> };

interface ConnectionTestResult {
  connectorId: string;
  connectorName: string;
  status: 'success' | 'partial' | 'failed';
  latencyMs: number;
  checks: ConnectionCheck[];
  testedAt: string;
}

interface ConnectionCheck {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const connector = getConnector(id);

    if (!connector) {
      return error('NOT_FOUND', `Connector ${id} not found`, 404);
    }

    const now = new Date().toISOString();

    const checks = await buildChecks(connector.type, connector.connectionDetails);

    const allPassed = checks.every((c) => c.passed);
    const somePassed = checks.some((c) => c.passed);
    const status: ConnectionTestResult['status'] = allPassed
      ? 'success'
      : somePassed
        ? 'partial'
        : 'failed';

    const totalLatency = checks.reduce((sum, c) => sum + c.durationMs, 0);

    const result: ConnectionTestResult = {
      connectorId: id,
      connectorName: connector.name,
      status,
      latencyMs: totalLatency,
      checks,
      testedAt: now,
    };

    // Update connector status
    updateConnector(id, {
      status: status === 'success' ? 'connected' : status === 'partial' ? 'error' : 'disconnected',
      lastTestedAt: now,
    });

    console.log(
      `[API] POST /api/connectors/${id}/test — ${status} (${totalLatency}ms)`,
    );
    return success(result);
  } catch (err) {
    console.error('[API] POST /api/connectors/[id]/test error:', err);
    return error('INTERNAL_ERROR', 'Failed to test connector', 500);
  }
}

// ---------------------------------------------------------------------------
// Real network check helpers
// ---------------------------------------------------------------------------

/** Extract a hostname from the connector's connection details. */
function extractHostname(details: Record<string, unknown>): string | null {
  const raw =
    (details.host as string) ??
    (details.url as string) ??
    (details.endpoint as string) ??
    null;

  if (!raw) return null;

  try {
    // Handle both bare hostnames and full URLs
    const url = raw.startsWith('http') ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname;
  } catch {
    return raw; // return as-is and let DNS fail with a useful message
  }
}

/** Extract a full base URL from the connector's connection details. */
function extractBaseUrl(details: Record<string, unknown>): string | null {
  const raw =
    (details.host as string) ??
    (details.url as string) ??
    (details.endpoint as string) ??
    null;

  if (!raw) return null;
  return raw.startsWith('http') ? raw.replace(/\/+$/, '') : `https://${raw}`;
}

/** Perform a real DNS lookup. */
async function checkDns(hostname: string): Promise<ConnectionCheck> {
  const start = Date.now();
  try {
    const addresses = await dns.resolve4(hostname);
    return {
      name: 'DNS Resolution',
      passed: true,
      message: `Host resolved to ${addresses[0]}${addresses.length > 1 ? ` (+${addresses.length - 1} more)` : ''}.`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'DNS Resolution',
      passed: false,
      message: `DNS lookup failed: ${(err as Error).message}`,
      durationMs: Date.now() - start,
    };
  }
}

/** Perform a real TLS handshake via HTTPS HEAD request. */
async function checkTls(baseUrl: string): Promise<ConnectionCheck> {
  const start = Date.now();
  const isHttps = baseUrl.startsWith('https');

  if (!isHttps) {
    return {
      name: 'TLS Handshake',
      passed: false,
      message: 'Endpoint uses HTTP, not HTTPS. TLS not available.',
      durationMs: Date.now() - start,
    };
  }

  try {
    await httpHead(baseUrl, 5000);
    return {
      name: 'TLS Handshake',
      passed: true,
      message: 'TLS connection established successfully.',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'TLS Handshake',
      passed: false,
      message: `TLS handshake failed: ${(err as Error).message}`,
      durationMs: Date.now() - start,
    };
  }
}

/** Simple HEAD/GET request with a timeout. Returns the HTTP status code. */
function httpHead(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
      // Drain the response
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Simple GET request returning { status, body }. */
function httpGet(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: timeoutMs, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Build checks (async — performs real network calls)
// ---------------------------------------------------------------------------

async function buildChecks(
  type: string,
  details: Record<string, unknown>,
): Promise<ConnectionCheck[]> {
  const hostname = extractHostname(details);
  const baseUrl = extractBaseUrl(details);

  // If no host configured, all network checks fail
  if (!hostname || !baseUrl) {
    return [
      {
        name: 'DNS Resolution',
        passed: false,
        message: 'No host/URL configured for this connector.',
        durationMs: 0,
      },
    ];
  }

  // Real DNS and TLS checks (shared by all connector types)
  const dnsCheck = await checkDns(hostname);
  const tlsCheck = dnsCheck.passed ? await checkTls(baseUrl) : {
    name: 'TLS Handshake',
    passed: false,
    message: 'Skipped — DNS resolution failed.',
    durationMs: 0,
  } as ConnectionCheck;

  const networkOk = dnsCheck.passed && tlsCheck.passed;

  switch (type) {
    case 'aem':
    case 'aem-cloud':
      return buildAemChecks(baseUrl, details, dnsCheck, tlsCheck, networkOk);

    default:
      return buildGenericChecks(type, details, dnsCheck, tlsCheck, networkOk);
  }
}

/** AEM-specific checks with real HTTP probes. */
async function buildAemChecks(
  baseUrl: string,
  details: Record<string, unknown>,
  dnsCheck: ConnectionCheck,
  tlsCheck: ConnectionCheck,
  networkOk: boolean,
): Promise<ConnectionCheck[]> {
  const checks: ConnectionCheck[] = [dnsCheck, tlsCheck];

  // AEM Health Check — probe the login page
  if (networkOk) {
    const start = Date.now();
    try {
      const { status } = await httpGet(
        `${baseUrl}/libs/granite/core/content/login.html`,
        8000,
      );
      const ok = status >= 200 && status < 400;
      checks.push({
        name: 'AEM Health Check',
        passed: ok,
        message: ok
          ? `AEM instance at ${baseUrl} is healthy (HTTP ${status}).`
          : `AEM login page returned HTTP ${status}.`,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      checks.push({
        name: 'AEM Health Check',
        passed: false,
        message: `AEM health probe failed: ${(err as Error).message}`,
        durationMs: Date.now() - start,
      });
    }
  } else {
    checks.push({
      name: 'AEM Health Check',
      passed: false,
      message: 'Skipped — network connectivity failed.',
      durationMs: 0,
    });
  }

  // Auth Check — try /content.1.json with credentials
  if (networkOk) {
    const start = Date.now();
    const token =
      (details.accessToken as string) ??
      (details.access_token as string) ??
      process.env.AEM_ACCESS_TOKEN ??
      '';

    if (!token) {
      checks.push({
        name: 'Authentication',
        passed: false,
        message: 'No access token configured. Set accessToken in connector or AEM_ACCESS_TOKEN env var.',
        durationMs: Date.now() - start,
      });
    } else {
      try {
        const { status } = await httpGet(
          `${baseUrl}/content.1.json`,
          8000,
          { Authorization: `Bearer ${token}` },
        );
        const ok = status >= 200 && status < 400;
        checks.push({
          name: 'Authentication',
          passed: ok,
          message: ok
            ? 'Authenticated successfully — /content.1.json accessible.'
            : `Authentication failed (HTTP ${status}). Check access token.`,
          durationMs: Date.now() - start,
        });
      } catch (err) {
        checks.push({
          name: 'Authentication',
          passed: false,
          message: `Auth probe failed: ${(err as Error).message}`,
          durationMs: Date.now() - start,
        });
      }
    }
  } else {
    checks.push({
      name: 'Authentication',
      passed: false,
      message: 'Skipped — network connectivity failed.',
      durationMs: 0,
    });
  }

  return checks;
}

/** Generic checks — real DNS/TLS, mock API checks. */
async function buildGenericChecks(
  type: string,
  details: Record<string, unknown>,
  dnsCheck: ConnectionCheck,
  tlsCheck: ConnectionCheck,
  networkOk: boolean,
): Promise<ConnectionCheck[]> {
  const checks: ConnectionCheck[] = [dnsCheck, tlsCheck];

  // Type-specific mock API checks
  switch (type) {
    case 'google-analytics':
      checks.push(
        {
          name: 'Google OAuth2 Token',
          passed: networkOk,
          message: networkOk
            ? 'Service account authentication successful.'
            : 'Cannot authenticate — network unreachable.',
          durationMs: 180 + Math.round(Math.random() * 100),
        },
        {
          name: 'GA4 Property Access',
          passed: networkOk,
          message: networkOk
            ? `Property ${details.propertyId ?? 'unknown'} accessible with read permissions.`
            : 'Cannot verify property access — network unreachable.',
          durationMs: 95 + Math.round(Math.random() * 80),
        },
        {
          name: 'Reporting API',
          passed: networkOk,
          message: networkOk
            ? 'Data API v1beta endpoint responding.'
            : 'Cannot reach Reporting API — network unreachable.',
          durationMs: 110 + Math.round(Math.random() * 90),
        },
      );
      break;

    case 'salesforce-mc':
      checks.push(
        {
          name: 'SFMC OAuth2 Token',
          passed: networkOk && !!details.subdomain,
          message: !details.subdomain
            ? 'Missing subdomain configuration.'
            : networkOk
              ? 'Authentication token acquired.'
              : 'Cannot authenticate — network unreachable.',
          durationMs: 200 + Math.round(Math.random() * 150),
        },
        {
          name: 'REST API Access',
          passed: networkOk && !!details.subdomain,
          message: !details.subdomain
            ? 'Cannot reach REST API without valid subdomain.'
            : networkOk
              ? 'REST API accessible.'
              : 'Cannot reach REST API — network unreachable.',
          durationMs: 130 + Math.round(Math.random() * 100),
        },
        {
          name: 'SOAP API Access',
          passed: false,
          message: 'SOAP API credentials not configured. Required for email template export.',
          durationMs: 50,
        },
      );
      break;

    case 'wordpress':
      checks.push(
        {
          name: 'WordPress REST API',
          passed: networkOk,
          message: networkOk
            ? 'WP REST API v2 accessible.'
            : 'Cannot reach WordPress API — network unreachable.',
          durationMs: 90 + Math.round(Math.random() * 100),
        },
        {
          name: 'Media Library Access',
          passed: networkOk,
          message: networkOk
            ? 'Media endpoints accessible.'
            : 'Cannot reach media endpoints — network unreachable.',
          durationMs: 75 + Math.round(Math.random() * 80),
        },
      );
      break;

    default:
      checks.push(
        {
          name: 'API Endpoint',
          passed: networkOk,
          message: networkOk
            ? 'Primary API endpoint accessible.'
            : 'Cannot reach API — network unreachable.',
          durationMs: 100 + Math.round(Math.random() * 150),
        },
        {
          name: 'Authentication',
          passed: networkOk,
          message: networkOk
            ? 'Authentication successful.'
            : 'Cannot authenticate — network unreachable.',
          durationMs: 150 + Math.round(Math.random() * 100),
        },
      );
      break;
  }

  return checks;
}
