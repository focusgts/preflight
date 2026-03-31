/**
 * POST /api/scanner/integrations — Detect third-party integrations
 *
 * Accepts { url: string } and returns detected integrations for the
 * given URL. This is a focused endpoint (ADR-033) for when you only
 * need integration discovery without the full health score scan.
 *
 * Rate limited to 10 requests per IP per hour. Results cached 30 min.
 */

import { success, error } from '@/lib/api/response';
import {
  detectIntegrations,
  summarizeByCategory,
  groupByCompatibility,
  type DetectedIntegration,
} from '@/lib/scanner/integration-detector';
import type { RawScanData } from '@/types/scanner';

// ── In-memory rate limiter ────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// ── In-memory result cache ────────────────────────────────
interface CachedResult {
  integrations: DetectedIntegration[];
  cachedAt: number;
}
const integrationCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const PAGE_TIMEOUT_MS = 15_000;
const USER_AGENT = 'BlackHole-Scanner/1.0 (AEM Health Check; focusgts.com)';

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '127.0.0.1';
}

function extractDomain(url: string): string {
  try {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isValidUrl(url: string): boolean {
  try {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const parsed = new URL(u);
    return !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

async function fetchPage(url: string): Promise<RawScanData> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const html = await response.text();
    const responseTimeMs = Date.now() - start;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      url,
      statusCode: response.status,
      headers,
      html: html.substring(0, 500_000),
      responseTimeMs,
      contentLengthBytes: new TextEncoder().encode(html).length,
      redirectCount: response.redirected ? 1 : 0,
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── POST Handler ──────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return error('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== 'string') {
      return error('INVALID_INPUT', 'URL is required.', 400);
    }

    if (!isValidUrl(url)) {
      return error('INVALID_URL', 'Please enter a valid domain or URL.', 400);
    }

    const domain = extractDomain(url);

    // Check cache
    const cached = integrationCache.get(domain);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`[Integrations] Cache hit for ${domain}`);
      return success({
        url: normalizeUrl(url),
        domain,
        integrations: cached.integrations,
        summary: summarizeByCategory(cached.integrations),
        compatibility: groupByCompatibility(cached.integrations),
        scannedAt: new Date().toISOString(),
      });
    }

    // Fetch page and detect integrations
    const normalizedUrl = normalizeUrl(url);
    const raw = await fetchPage(normalizedUrl);
    const integrations = detectIntegrations(raw);

    // Cache
    integrationCache.set(domain, { integrations, cachedAt: Date.now() });

    console.log(
      `[Integrations] Scanned ${domain} — found ${integrations.length} integrations`,
    );

    return success({
      url: normalizedUrl,
      domain,
      integrations,
      summary: summarizeByCategory(integrations),
      compatibility: groupByCompatibility(integrations),
      scannedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Integrations] Scan failed:', message);

    if (message.includes('abort') || message.includes('timeout')) {
      return error(
        'SCAN_TIMEOUT',
        'The site took too long to respond. It may be down or blocking automated requests.',
        504,
      );
    }

    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      return error(
        'SITE_UNREACHABLE',
        'Could not resolve the domain. Please check the URL and try again.',
        502,
      );
    }

    return error(
      'SCAN_FAILED',
      'Failed to scan the site for integrations. Please try again later.',
      500,
    );
  }
}
