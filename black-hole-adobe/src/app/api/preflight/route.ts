/**
 * POST /api/preflight — Standalone Cloud Manager pre-flight check
 *
 * ADR-036: Cloud Manager Pre-Flight Simulation (engine)
 * ADR-064: Public Pre-Flight Web UI (rate limiting + public wrapper)
 *
 * Accepts code files directly (no migration required) and returns a pre-flight
 * report. Powers both the migration-linked dashboard flow and the public
 * /preflight page.
 *
 * Request body:
 *   { files: [{ path: string, content: string }] }
 *
 * Response:
 *   PreFlightReport with findings, success probability, and remediation guidance.
 *
 * Public-surface protections:
 *   - 20 runs per IP per hour (sliding window, in-memory store)
 *   - 100 KB max request body
 *   - X-RateLimit-* headers on every response
 *   - Friendly 429 with upgrade CTA URL
 *   - Authenticated sessions (valid bh_session cookie) bypass the limiter
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import {
  PreFlightEngine,
  type PreFlightItem,
} from '@/lib/preflight/cloud-manager-rules';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limiter';
import { validateSession, SESSION_COOKIE } from '@/lib/auth/auth';

// ── Constants ────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 100 * 1024; // 100 KB
const UPGRADE_CTA_URL = '/pricing';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the client IP from standard proxy headers, falling back to
 * a stable sentinel so the limiter still groups unknown clients.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return '127.0.0.1';
}

/**
 * Is the request authenticated? A valid bh_session cookie bypasses
 * public rate limiting. Any failure (missing, expired, unknown user)
 * falls through to the public path.
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return false;
    const user = await validateSession(token);
    return !!user;
  } catch {
    return false;
  }
}

/**
 * Build standard rate-limit response headers.
 */
function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  retryAfterSec?: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
  };
  if (retryAfterSec != null) {
    headers['Retry-After'] = String(retryAfterSec);
  }
  return headers;
}

/**
 * Attach headers to an existing Response without mutating the original.
 */
function withHeaders(res: Response, extra: Record<string, string>): Response {
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) merged.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

/**
 * Read and size-cap the request body. Returns null for an over-size body.
 * We use request.text() (not request.json()) so we can measure byte length
 * before parsing — safer against JSON bombs.
 */
async function readCappedJson(
  request: NextRequest,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too-large' | 'invalid-json' }
> {
  const raw = await request.text();
  // Count bytes, not characters — a multi-byte UTF-8 payload can exceed the
  // limit while having a short .length.
  const bytes = new TextEncoder().encode(raw).byteLength;
  if (bytes > MAX_BODY_BYTES) {
    return { ok: false, reason: 'too-large' };
  }
  if (!raw.trim()) {
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const limit = RATE_LIMITS.publicPreflight;

  try {
    // 1. Rate limiting (skipped for authenticated sessions)
    const authed = await isAuthenticated(request);
    let rateHeaders: Record<string, string> = {};

    if (!authed) {
      const ip = getClientIp(request);
      const rl = checkRateLimit(`preflight:${ip}`, limit);
      const retryAfter = Math.max(
        1,
        Math.ceil((rl.resetAt - Date.now()) / 1000),
      );
      rateHeaders = rateLimitHeaders(
        limit.maxRequests,
        rl.remaining,
        rl.resetAt,
        rl.allowed ? undefined : retryAfter,
      );

      if (!rl.allowed) {
        const res = error(
          'RATE_LIMITED',
          'You have reached the free pre-flight limit (20 runs per hour). Sign up for unlimited runs.',
          429,
          { upgradeUrl: UPGRADE_CTA_URL, resetAt: rl.resetAt },
        );
        return withHeaders(res, rateHeaders);
      }
    } else {
      // Authenticated: surface a consistent, unambiguous "not applied"
      // signal so clients have a stable header shape.
      rateHeaders = {
        'X-RateLimit-Limit': 'unlimited',
        'X-RateLimit-Remaining': 'unlimited',
        'X-RateLimit-Reset': '0',
      };
    }

    // 2. Body size + parse
    const parsed = await readCappedJson(request);
    if (!parsed.ok) {
      const res =
        parsed.reason === 'too-large'
          ? error(
              'PAYLOAD_TOO_LARGE',
              `Request body exceeds the ${Math.floor(MAX_BODY_BYTES / 1024)} KB limit for public pre-flight runs.`,
              413,
            )
          : error(
              'INVALID_JSON',
              'Request body must be valid JSON: { files: [{ path, content }] }.',
              400,
            );
      return withHeaders(res, rateHeaders);
    }

    const body = parsed.value as { files?: unknown } | null;
    if (!body || !Array.isArray(body?.files) || body.files.length === 0) {
      return withHeaders(
        error(
          'MISSING_FILES',
          'Request body must include a "files" array with at least one entry: { files: [{ path: string, content: string }] }.',
          422,
        ),
        rateHeaders,
      );
    }

    const items: PreFlightItem[] = (
      body.files as Array<{ path?: string; content?: string }>
    )
      .filter(
        (f): f is PreFlightItem =>
          typeof f?.path === 'string' &&
          typeof f?.content === 'string' &&
          f.content.length > 0,
      )
      .map((f) => ({ path: f.path, content: f.content }));

    if (items.length === 0) {
      return withHeaders(
        error(
          'INVALID_FILES',
          'No valid files found. Each file must have a non-empty "path" (string) and "content" (string).',
          422,
        ),
        rateHeaders,
      );
    }

    // 3. Run the engine
    const engine = new PreFlightEngine();
    const report = engine.runPreFlight(items);

    console.log(
      `[API] POST /api/preflight — ${items.length} files scanned, ` +
        `${report.findings.length} findings, success probability: ${report.successProbability}` +
        (authed ? ' (authed)' : ' (public)'),
    );

    return withHeaders(success(report, 200), rateHeaders);
  } catch (err) {
    console.error('[API] POST /api/preflight error:', err);
    return error('INTERNAL_ERROR', 'Failed to run pre-flight analysis', 500);
  }
}
