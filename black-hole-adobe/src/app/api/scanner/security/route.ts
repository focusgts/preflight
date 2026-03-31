/**
 * POST /api/scanner/security — Dispatcher Security Assessment
 *
 * Accepts { url: string } and returns a DispatcherSecurityResult
 * with findings from probing AEM-specific security-sensitive paths
 * and checking security headers (ADR-037).
 *
 * Rate limited to 10 scans per IP per hour.
 */

import { success, error } from '@/lib/api/response';
import { scanDispatcherSecurity } from '@/lib/scanner/dispatcher-security';

// ── In-memory rate limiter ────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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

// ── POST Handler ──────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return error('RATE_LIMITED', 'Too many scans. Please try again later.', 429);
    }

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== 'string') {
      return error('INVALID_INPUT', 'URL is required.', 400);
    }

    if (!isValidUrl(url)) {
      return error('INVALID_URL', 'Please enter a valid domain or URL.', 400);
    }

    const normalizedUrl = normalizeUrl(url);
    const result = await scanDispatcherSecurity(normalizedUrl);

    console.log(
      `[Security] Scanned ${normalizedUrl} — risk: ${result.overallRisk}, ` +
      `score: ${result.score}, findings: ${result.findings.length} ` +
      `(${result.summary.critical}C/${result.summary.high}H/${result.summary.medium}M/${result.summary.low}L)`,
    );

    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Security] Security scan failed:', message);

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
      'SECURITY_SCAN_FAILED',
      'Failed to run security assessment. Please try again later.',
      500,
    );
  }
}
