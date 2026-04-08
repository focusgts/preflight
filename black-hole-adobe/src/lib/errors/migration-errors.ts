/**
 * ADR-061: Structured error taxonomy for migration operations.
 *
 * Every migration operation should throw one of these typed errors so the
 * orchestrator can decide the appropriate recovery strategy based on
 * `category` and `retryable`.
 */

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'rate-limit'
  | 'validation'
  | 'content'
  | 'fatal';

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly category: ErrorCategory,
    public readonly retryable: boolean,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class NetworkError extends MigrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'NETWORK_ERROR', 'network', true, context);
    this.name = 'NetworkError';
  }
}

export class AuthError extends MigrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'AUTH_ERROR', 'auth', false, context);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends MigrationError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    context: Record<string, unknown> = {},
  ) {
    super(message, 'RATE_LIMIT_ERROR', 'rate-limit', true, {
      ...context,
      retryAfterMs,
    });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends MigrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', 'validation', false, context);
    this.name = 'ValidationError';
  }
}

export class ContentError extends MigrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CONTENT_ERROR', 'content', false, context);
    this.name = 'ContentError';
  }
}

export class FatalError extends MigrationError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'FATAL_ERROR', 'fatal', false, context);
    this.name = 'FatalError';
  }
}

/**
 * Classify an unknown thrown value into the migration error taxonomy.
 * Pattern-matches common error messages from HTTP clients and Node.js.
 */
export function classifyError(err: unknown): MigrationError {
  if (err instanceof MigrationError) return err;

  if (err instanceof Error) {
    const message = err.message;
    const lower = message.toLowerCase();

    if (
      lower.includes('timeout') ||
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('econnreset') ||
      lower.includes('network')
    ) {
      return new NetworkError(message, { originalName: err.name });
    }
    if (
      message.includes('401') ||
      message.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden')
    ) {
      return new AuthError(message, { originalName: err.name });
    }
    if (message.includes('429') || lower.includes('rate limit')) {
      return new RateLimitError(message, 60_000, { originalName: err.name });
    }
    return new MigrationError(message, 'UNKNOWN_ERROR', 'fatal', false, {
      originalName: err.name,
    });
  }

  return new FatalError(String(err));
}
