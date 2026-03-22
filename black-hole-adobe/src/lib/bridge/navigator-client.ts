/**
 * Navigator Portal API Client
 *
 * Connects Black Hole to the Navigator Portal so that completed
 * migration data flows seamlessly into Navigator for ongoing
 * managed services.
 *
 * Configured via environment variables:
 *   NAVIGATOR_API_URL  — Base URL of the Navigator Portal API
 *   NAVIGATOR_API_KEY  — API key for authentication
 *
 * When neither variable is set the client operates in "demo mode",
 * returning simulated success responses without making network calls.
 */

// ============================================================
// Types
// ============================================================

export interface NavigatorOrganization {
  id: string;
  name: string;
  slack_channel_id: string | null;
  metadata: Record<string, unknown>;
}

export interface NavigatorTicket {
  title: string;
  description: string;
  sea_category: 'support' | 'enhance' | 'advise';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  platform_tags: string[];
  capex_opex: 'capex' | 'opex';
  complexity_hours: number;
  source: 'black_hole_migration';
  source_id: string;
}

export interface NavigatorKnowledgeArticle {
  title: string;
  content: string;
  source: 'black_hole_migration' | 'ticket_resolution' | 'manual';
  platform_tags: string[];
  visibility: 'internal' | 'client';
  metadata: Record<string, unknown>;
}

export interface NavigatorTimeEntry {
  description: string;
  hours: number;
  billable: boolean;
  sea_category: 'support' | 'enhance' | 'advise';
  source: 'black_hole_migration';
  logged_at: string;
}

export interface NavigatorROIEntry {
  category: string;
  estimated_value: number;
  confidence_score: number;
  calculation_inputs: Record<string, unknown>;
  description: string;
}

export interface NavigatorMemory {
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: 'black_hole_migration';
}

export interface RuVectorEntry {
  namespace: string;
  key: string;
  value: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface NavigatorApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ============================================================
// Configuration
// ============================================================

interface NavigatorConfig {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

function loadConfig(): NavigatorConfig {
  const apiUrl = process.env.NAVIGATOR_API_URL ?? '';
  const apiKey = process.env.NAVIGATOR_API_KEY ?? '';
  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    enabled: Boolean(apiUrl && apiKey),
  };
}

// ============================================================
// Retry helpers
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[NavigatorClient] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ============================================================
// Demo-mode helpers
// ============================================================

let demoIdCounter = 1000;

function demoResponse<T>(data: T): NavigatorApiResponse<T> {
  return { success: true, data, error: null };
}

function nextDemoId(): string {
  return `demo-${++demoIdCounter}`;
}

// ============================================================
// NavigatorClient
// ============================================================

export class NavigatorClient {
  private readonly config: NavigatorConfig;

  constructor(config?: Partial<NavigatorConfig>) {
    const envConfig = loadConfig();
    this.config = {
      apiUrl: config?.apiUrl ?? envConfig.apiUrl,
      apiKey: config?.apiKey ?? envConfig.apiKey,
      enabled: config?.enabled ?? envConfig.enabled,
    };
  }

  /** True when Navigator API credentials are configured. */
  get isConfigured(): boolean {
    return this.config.enabled;
  }

  // ── HTTP ────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<NavigatorApiResponse<T>> {
    const url = `${this.config.apiUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(
        `Navigator API ${method} ${path} returned ${res.status}: ${text}`,
      );
    }

    return (await res.json()) as NavigatorApiResponse<T>;
  }

  // ── Public methods ──────────────────────────────────────────

  async healthCheck(): Promise<{ ok: boolean; mode: 'live' | 'demo' }> {
    if (!this.config.enabled) {
      return { ok: true, mode: 'demo' };
    }
    try {
      await withRetry(
        () => this.request('GET', '/health'),
        'healthCheck',
      );
      return { ok: true, mode: 'live' };
    } catch {
      return { ok: false, mode: 'live' };
    }
  }

  async createOrganization(
    name: string,
    slackChannelId: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<NavigatorApiResponse<NavigatorOrganization>> {
    if (!this.config.enabled) {
      return demoResponse<NavigatorOrganization>({
        id: nextDemoId(),
        name,
        slack_channel_id: slackChannelId,
        metadata,
      });
    }
    return withRetry(
      () =>
        this.request<NavigatorOrganization>('POST', '/api/organizations', {
          name,
          slack_channel_id: slackChannelId,
          metadata,
        }),
      'createOrganization',
    );
  }

  async createTicket(
    orgId: string,
    ticket: NavigatorTicket,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>(
          'POST',
          `/api/organizations/${orgId}/tickets`,
          ticket,
        ),
      'createTicket',
    );
  }

  async createKnowledgeArticle(
    orgId: string,
    article: NavigatorKnowledgeArticle,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>(
          'POST',
          `/api/organizations/${orgId}/knowledge`,
          article,
        ),
      'createKnowledgeArticle',
    );
  }

  async createTimeEntry(
    orgId: string,
    entry: NavigatorTimeEntry,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>(
          'POST',
          `/api/organizations/${orgId}/time-entries`,
          entry,
        ),
      'createTimeEntry',
    );
  }

  async createROIEntry(
    orgId: string,
    entry: NavigatorROIEntry,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>(
          'POST',
          `/api/organizations/${orgId}/roi`,
          entry,
        ),
      'createROIEntry',
    );
  }

  async storeMemory(
    orgId: string,
    memory: NavigatorMemory,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>(
          'POST',
          `/api/organizations/${orgId}/memories`,
          memory,
        ),
      'storeMemory',
    );
  }

  async indexInRuVector(
    namespace: string,
    key: string,
    value: string,
    tags: string[],
    metadata?: Record<string, unknown>,
  ): Promise<NavigatorApiResponse<{ id: string }>> {
    if (!this.config.enabled) {
      return demoResponse({ id: nextDemoId() });
    }
    return withRetry(
      () =>
        this.request<{ id: string }>('POST', '/api/ruvector/index', {
          namespace,
          key,
          value,
          tags,
          metadata,
        }),
      'indexInRuVector',
    );
  }
}
