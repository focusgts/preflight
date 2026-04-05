/**
 * Rate Limiting Middleware
 *
 * ADR-049: Configurable rate limiter with pluggable backend.
 * Default implementation uses an in-memory Map with automatic
 * window expiry. Designed for easy swap to Redis in multi-instance
 * deployments.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window. */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Increment the counter for `key` within the given window. */
  increment(key: string, windowMs: number): { count: number; resetAt: number };
}

// ── Default configs ────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Public scanner endpoints — 10 requests per hour. */
  publicScanner: { windowMs: 3_600_000, maxRequests: 10 } satisfies RateLimitConfig,
  /** Authenticated read endpoints — 100 requests per minute. */
  authenticatedRead: { windowMs: 60_000, maxRequests: 100 } satisfies RateLimitConfig,
  /** Authenticated write endpoints — 30 requests per minute. */
  authenticatedWrite: { windowMs: 60_000, maxRequests: 30 } satisfies RateLimitConfig,
  /** Connector operations (expensive) — 5 requests per minute. */
  connectorOps: { windowMs: 60_000, maxRequests: 5 } satisfies RateLimitConfig,
} as const;

// ── In-memory store ────────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, WindowEntry>();

  increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now();
    const existing = this.windows.get(key);

    // Window expired or no entry — start a new window
    if (!existing || now >= existing.resetAt) {
      const entry: WindowEntry = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, entry);
      this.cleanup();
      return { count: 1, resetAt: entry.resetAt };
    }

    // Within current window — increment
    existing.count += 1;
    return { count: existing.count, resetAt: existing.resetAt };
  }

  /** Periodically prune expired entries to prevent unbounded growth. */
  private cleanup(): void {
    // Only clean up every 100 increments to avoid overhead
    if (this.windows.size < 100) return;

    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

// ── Singleton store ────────────────────────────────────────────────────

const defaultStore = new InMemoryRateLimitStore();

// ── Main function ──────────────────────────────────────────────────────

/**
 * Check whether a request identified by `key` is within rate limits.
 *
 * @param key      Unique identifier — typically IP address or session ID.
 * @param config   Rate limit configuration (window + max requests).
 * @param store    Optional pluggable store (defaults to in-memory).
 * @returns        Result with allowed flag, remaining count, and reset time.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  store: RateLimitStore = defaultStore,
): RateLimitResult {
  const { count, resetAt } = store.increment(key, config.windowMs);
  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);

  return { allowed, remaining, resetAt };
}
