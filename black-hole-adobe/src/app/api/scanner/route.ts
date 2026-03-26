/**
 * POST /api/scanner — Start a public site scan
 *
 * Accepts { url: string, industry?: string } and returns a real ScanResult
 * using the 5-tier AEM detection methodology (ADR-030).
 * Rate limited to 10 scans per IP per hour. Results cached for 30 minutes.
 */

import { success, error } from '@/lib/api/response';
import type { ScanResult } from '@/types/scanner';
import { SiteScanner } from '@/lib/scanner/site-scanner';

// ── In-memory rate limiter ────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// ── In-memory result cache ────────────────────────────────
const scanCache = new Map<string, { result: ScanResult; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

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

// ── POST Handler ──────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return error('RATE_LIMITED', 'Too many scans. Please try again later.', 429);
    }

    const body = await request.json();
    const { url, industry } = body as { url?: string; industry?: string };

    if (!url || typeof url !== 'string') {
      return error('INVALID_INPUT', 'URL is required.', 400);
    }

    if (!isValidUrl(url)) {
      return error('INVALID_URL', 'Please enter a valid domain or URL.', 400);
    }

    const domain = extractDomain(url);

    // Check cache
    const cached = scanCache.get(domain);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`[Scanner] Cache hit for ${domain}`);
      return success(cached.result);
    }

    // Run real 5-tier scan
    const scanner = new SiteScanner();
    const result = await scanner.scan(url, industry);

    // Cache result
    scanCache.set(domain, { result, cachedAt: Date.now() });

    console.log(
      `[Scanner] Scanned ${domain} — score: ${result.overallScore}, ` +
      `AEM: ${result.aemDetected}, ` +
      `version: ${result.aemVersion ?? 'N/A'} (${result.platformDetails.versionConfidence ?? 0}%), ` +
      `deployment: ${result.platformDetails.deployment} (${result.platformDetails.deploymentConfidence ?? 0}%)`,
    );

    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Scanner] Scan failed:', message);

    // Provide a helpful error message based on the failure type
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

    if (message.includes('SSL') || message.includes('certificate') || message.includes('CERT')) {
      return error(
        'SSL_ERROR',
        'SSL certificate error when connecting to the site. The site may have an invalid certificate.',
        502,
      );
    }

    if (message.includes('ECONNREFUSED') || message.includes('ECONNRESET')) {
      return error(
        'CONNECTION_REFUSED',
        'The site refused the connection. It may be down or blocking requests.',
        502,
      );
    }

    return error(
      'SCAN_FAILED',
      'Failed to scan the site. Please try again later.',
      500,
    );
  }
}
