/**
 * Base Connector - Abstract base class for all Black Hole connectors.
 *
 * Provides connection lifecycle management, rate limiting, retry logic
 * with exponential backoff, and progress reporting.
 */

import type { ConnectorConfig } from '@/types';

// ============================================================
// Connector-specific types
// ============================================================

export interface ConnectorCapability {
  name: string;
  description: string;
  requiresAuth: boolean;
}

export interface ExtractionProgress {
  phase: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
  startedAt: number;
  estimatedRemainingMs: number | null;
}

export interface ExtractionResult<T = unknown> {
  data: T;
  metadata: {
    extractedAt: string;
    durationMs: number;
    itemCount: number;
    warnings: string[];
  };
}

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  retryAfterMs: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequestOptions {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

/** Injectable HTTP client interface for testability. */
export interface HttpClient {
  request<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
}

export type ProgressCallback = (progress: ExtractionProgress) => void;

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

// ============================================================
// Default HTTP Client using fetch
// ============================================================

export class FetchHttpClient implements HttpClient {
  async request<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const url = new URL(options.url);
    if (options.queryParams) {
      for (const [key, value] of Object.entries(options.queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = options.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : null;

    try {
      const response = await fetch(url.toString(), {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { status: response.status, headers: responseHeaders, data };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

// ============================================================
// Abstract Base Connector
// ============================================================

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected httpClient: HttpClient;
  protected rateLimitConfig: RateLimitConfig;
  protected retryConfig: RetryConfig;
  protected isConnected: boolean = false;
  protected onProgress: ProgressCallback | null = null;

  private requestTimestamps: number[] = [];
  private minuteRequestTimestamps: number[] = [];

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
  ) {
    this.config = config;
    this.httpClient = httpClient ?? new FetchHttpClient();
    this.rateLimitConfig = {
      maxRequestsPerSecond: rateLimitConfig?.maxRequestsPerSecond ?? 10,
      maxRequestsPerMinute: rateLimitConfig?.maxRequestsPerMinute ?? 300,
      retryAfterMs: rateLimitConfig?.retryAfterMs ?? 1000,
    };
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      baseDelayMs: retryConfig?.baseDelayMs ?? 1000,
      maxDelayMs: retryConfig?.maxDelayMs ?? 30000,
      retryableStatusCodes: retryConfig?.retryableStatusCodes ?? [429, 500, 502, 503, 504],
    };
  }

  /** Set a progress callback for extraction operations. */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  /** Report progress to the registered callback. */
  protected reportProgress(
    phase: string,
    current: number,
    total: number,
    message: string,
    startedAt: number,
  ): void {
    if (!this.onProgress) return;
    const elapsed = Date.now() - startedAt;
    const rate = current > 0 ? elapsed / current : 0;
    const remaining = total > current ? (total - current) * rate : null;

    this.onProgress({
      phase,
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message,
      startedAt,
      estimatedRemainingMs: remaining ? Math.round(remaining) : null,
    });
  }

  /**
   * Connect to the source environment. Validates credentials
   * and establishes session state.
   */
  abstract connect(): Promise<void>;

  /** Disconnect and clean up resources. */
  abstract disconnect(): Promise<void>;

  /**
   * Test the connection without performing a full connect.
   * Returns true if the connection is valid.
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Extract all data from the source. Implementation varies
   * by connector type.
   */
  abstract extract(): Promise<ExtractionResult>;

  /** Return the capabilities of this connector. */
  abstract getCapabilities(): ConnectorCapability[];

  /** Get the current connection status. */
  getConnectionStatus(): ConnectorConfig['status'] {
    return this.config.status;
  }

  /** Get the connector config. */
  getConfig(): ConnectorConfig {
    return { ...this.config };
  }

  /**
   * Make an HTTP request with rate limiting and retry logic.
   * This is the primary method connectors should use for all HTTP calls.
   */
  protected async makeRequest<T = unknown>(
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    await this.enforceRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request<T>(options);

        if (response.status >= 200 && response.status < 300) {
          return response;
        }

        if (this.retryConfig.retryableStatusCodes.includes(response.status)) {
          const retryAfter = this.parseRetryAfter(response.headers);
          const delay = retryAfter ?? this.calculateBackoff(attempt);
          lastError = new ConnectorError(
            `HTTP ${response.status}`,
            'HTTP_ERROR',
            response.status,
          );
          if (attempt < this.retryConfig.maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        throw new ConnectorError(
          `HTTP request failed with status ${response.status}`,
          'HTTP_ERROR',
          response.status,
          { url: options.url, method: options.method },
        );
      } catch (error) {
        if (error instanceof ConnectorError) {
          lastError = error;
          if (attempt < this.retryConfig.maxRetries) {
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryConfig.maxRetries) {
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
      }
    }

    throw lastError ?? new ConnectorError('Request failed after retries', 'RETRY_EXHAUSTED');
  }

  /**
   * Paginate through an API endpoint, collecting all results.
   * The `getNextPage` function returns null when there are no more pages.
   */
  protected async paginateRequest<TItem, TResponse = unknown>(
    initialOptions: HttpRequestOptions,
    extractItems: (response: TResponse) => TItem[],
    getNextPage: (response: TResponse, currentOptions: HttpRequestOptions) => HttpRequestOptions | null,
    phase?: string,
  ): Promise<TItem[]> {
    const allItems: TItem[] = [];
    let currentOptions: HttpRequestOptions | null = initialOptions;
    let page = 0;
    const startedAt = Date.now();

    while (currentOptions) {
      const response = await this.makeRequest<TResponse>(currentOptions);
      const items = extractItems(response.data);
      allItems.push(...items);
      page++;

      if (phase) {
        this.reportProgress(
          phase,
          allItems.length,
          allItems.length, // total unknown during pagination
          `Fetched page ${page} (${allItems.length} items)`,
          startedAt,
        );
      }

      currentOptions = getNextPage(response.data, currentOptions);
    }

    return allItems;
  }

  /** Build authorization headers from the connector config credentials. */
  protected getAuthHeaders(): Record<string, string> {
    const creds = this.config.connectionDetails;
    const authType = (creds.authType as string) || 'basic';

    switch (authType) {
      case 'basic': {
        const username = creds.username as string;
        const password = creds.password as string;
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        return { Authorization: `Basic ${encoded}` };
      }
      case 'bearer':
      case 'oauth_s2s':
        return { Authorization: `Bearer ${creds.accessToken as string}` };
      case 'api_key':
        return { 'x-api-key': creds.apiKey as string };
      default:
        return {};
    }
  }

  /** Build a full URL from a base URL and path. */
  protected buildUrl(path: string): string {
    const baseUrl = (this.config.connectionDetails.baseUrl as string) || '';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }

  // ---- Private helpers ----

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 1000);
    this.minuteRequestTimestamps = this.minuteRequestTimestamps.filter(t => now - t < 60000);

    // Per-second limit
    if (this.requestTimestamps.length >= this.rateLimitConfig.maxRequestsPerSecond) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = 1000 - (now - oldestInWindow);
      if (waitMs > 0) await this.sleep(waitMs);
    }

    // Per-minute limit
    if (this.minuteRequestTimestamps.length >= this.rateLimitConfig.maxRequestsPerMinute) {
      const oldestInWindow = this.minuteRequestTimestamps[0];
      const waitMs = 60000 - (now - oldestInWindow);
      if (waitMs > 0) await this.sleep(waitMs);
    }

    const ts = Date.now();
    this.requestTimestamps.push(ts);
    this.minuteRequestTimestamps.push(ts);
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = delay * 0.1 * Math.random();
    return Math.min(delay + jitter, this.retryConfig.maxDelayMs);
  }

  private parseRetryAfter(headers: Record<string, string>): number | null {
    const retryAfter = headers['retry-after'];
    if (!retryAfter) return null;
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return null;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
