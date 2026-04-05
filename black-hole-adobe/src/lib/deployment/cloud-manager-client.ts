/**
 * Cloud Manager API Client (ADR-052)
 *
 * Typed wrapper around the Adobe Cloud Manager REST API.
 * Handles IMS authentication, rate-limit retries, and
 * maps responses to domain interfaces.
 *
 * @see https://developer.adobe.com/experience-cloud/cloud-manager/reference/api/
 */

// ── Credentials & Config ────────────────────────────────────────────────

export interface CMCredentials {
  clientId: string;
  clientSecret: string;
  imsOrg: string;
  technicalAccountId: string;
  /** PEM-encoded private key for JWT auth (legacy). */
  privateKey?: string;
  /** Pre-generated access token — skips IMS exchange when provided. */
  accessToken?: string;
}

// ── Domain Models ───────────────────────────────────────────────────────

export interface CMEnvironment {
  id: string;
  name: string;
  type: 'dev' | 'stage' | 'prod';
  status: string;
}

export interface CMPipeline {
  id: string;
  name: string;
  type: string;
  status: string;
}

export type CMExecutionStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FINISHED'
  | 'ERROR'
  | 'FAILED';

export interface CMExecution {
  id: string;
  pipelineId: string;
  status: CMExecutionStatus;
  currentStep?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface CMExecutionStep {
  id: string;
  name: string;
  action: string;
  status: 'NOT_STARTED' | 'RUNNING' | 'FINISHED' | 'ERROR' | 'FAILED' | 'CANCELLED' | 'WAITING';
  startedAt?: string;
  finishedAt?: string;
}

export interface CMRepository {
  url: string;
  branch: string;
}

// ── Error ───────────────────────────────────────────────────────────────

export class CloudManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CloudManagerError';
  }
}

// ── Client ──────────────────────────────────────────────────────────────

const CM_BASE_URL = 'https://cloudmanager.adobe.io';
const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = [429, 502, 503, 504];

export class CloudManagerClient {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly credentials: CMCredentials,
    private readonly programId: string,
  ) {}

  // ── Auth ────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    // Use pre-generated token if available
    if (this.credentials.accessToken) {
      return this.credentials.accessToken;
    }

    // Return cached token if still valid (5-minute buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 300_000) {
      return this.cachedToken;
    }

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      grant_type: 'client_credentials',
      scope: 'AdobeID,openid,read_organizations,additional_info.projectedProductContext',
    });

    const response = await this.rawFetch(IMS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new CloudManagerError(
        `IMS token exchange failed: ${text}`,
        'AUTH_FAILED',
        response.status,
      );
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.cachedToken;
  }

  // ── Environments ────────────────────────────────────────────────────

  async listEnvironments(): Promise<CMEnvironment[]> {
    const res = await this.request<{
      _embedded: { environments: Array<{ id: string; name: string; type: string; status: string }> };
    }>('GET', `/api/program/${this.programId}/environments`);

    return (res._embedded?.environments ?? []).map((e) => ({
      id: String(e.id),
      name: e.name,
      type: e.type as CMEnvironment['type'],
      status: e.status,
    }));
  }

  async getEnvironment(envId: string): Promise<CMEnvironment> {
    const e = await this.request<{ id: string; name: string; type: string; status: string }>(
      'GET',
      `/api/program/${this.programId}/environment/${envId}`,
    );
    return {
      id: String(e.id),
      name: e.name,
      type: e.type as CMEnvironment['type'],
      status: e.status,
    };
  }

  // ── Pipelines ───────────────────────────────────────────────────────

  async listPipelines(): Promise<CMPipeline[]> {
    const res = await this.request<{
      _embedded: { pipelines: Array<{ id: string; name: string; type: string; status: string }> };
    }>('GET', `/api/program/${this.programId}/pipelines`);

    return (res._embedded?.pipelines ?? []).map((p) => ({
      id: String(p.id),
      name: p.name,
      type: p.type,
      status: p.status,
    }));
  }

  async getPipeline(pipelineId: string): Promise<CMPipeline> {
    const p = await this.request<{ id: string; name: string; type: string; status: string }>(
      'GET',
      `/api/program/${this.programId}/pipeline/${pipelineId}`,
    );
    return {
      id: String(p.id),
      name: p.name,
      type: p.type,
      status: p.status,
    };
  }

  // ── Execution ───────────────────────────────────────────────────────

  async triggerPipeline(pipelineId: string): Promise<CMExecution> {
    const e = await this.request<{
      id: string;
      pipelineId: string;
      status: { state: string };
      _links?: { 'http://ns.adobe.com/adobecloud/rel/pipeline/currentStep'?: { href: string; name?: string } };
      createdAt?: string;
      finishedAt?: string;
    }>('PUT', `/api/program/${this.programId}/pipeline/${pipelineId}/execution`);

    return this.mapExecution(e, pipelineId);
  }

  async getExecution(pipelineId: string, executionId: string): Promise<CMExecution> {
    const e = await this.request<{
      id: string;
      pipelineId: string;
      status: { state: string };
      _links?: { 'http://ns.adobe.com/adobecloud/rel/pipeline/currentStep'?: { href: string; name?: string } };
      createdAt?: string;
      finishedAt?: string;
    }>('GET', `/api/program/${this.programId}/pipeline/${pipelineId}/execution/${executionId}`);

    return this.mapExecution(e, pipelineId);
  }

  async getExecutionSteps(pipelineId: string, executionId: string): Promise<CMExecutionStep[]> {
    const res = await this.request<{
      _embedded: {
        stepStates: Array<{
          id: string;
          stepId: string;
          action: string;
          status: string;
          startedAt?: string;
          finishedAt?: string;
        }>;
      };
    }>(
      'GET',
      `/api/program/${this.programId}/pipeline/${pipelineId}/execution/${executionId}/steps`,
    );

    return (res._embedded?.stepStates ?? []).map((s) => ({
      id: s.id ?? s.stepId,
      name: this.actionToStepName(s.action),
      action: s.action,
      status: s.status as CMExecutionStep['status'],
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    }));
  }

  // ── Repository ──────────────────────────────────────────────────────

  async getRepositoryInfo(): Promise<CMRepository> {
    const res = await this.request<{
      _embedded: {
        repositories: Array<{ repo: string; defaultBranch?: string }>;
      };
    }>('GET', `/api/program/${this.programId}/repositories`);

    const repo = res._embedded?.repositories?.[0];
    if (!repo) {
      throw new CloudManagerError(
        'No repositories found for program',
        'NO_REPOSITORY',
      );
    }

    return {
      url: repo.repo,
      branch: repo.defaultBranch ?? 'main',
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private mapExecution(
    raw: {
      id: string;
      pipelineId?: string;
      status: { state: string };
      _links?: Record<string, { href: string; name?: string }>;
      createdAt?: string;
      finishedAt?: string;
    },
    pipelineId: string,
  ): CMExecution {
    const currentStepLink =
      raw._links?.['http://ns.adobe.com/adobecloud/rel/pipeline/currentStep'];

    return {
      id: String(raw.id),
      pipelineId: String(raw.pipelineId ?? pipelineId),
      status: raw.status.state as CMExecutionStatus,
      currentStep: currentStepLink?.name,
      startedAt: raw.createdAt,
      finishedAt: raw.finishedAt,
    };
  }

  private actionToStepName(action: string): string {
    const names: Record<string, string> = {
      validate: 'Validation',
      build: 'Build',
      codeQuality: 'Code Quality',
      testing: 'Testing',
      securityTest: 'Security Test',
      approval: 'Approval',
      deploy: 'Deploy',
      loadTest: 'Load Test',
      contentAudit: 'Content Audit',
    };
    return names[action] ?? action;
  }

  /**
   * Make an authenticated request to the Cloud Manager API
   * with timeout, retry on 429/503, and error mapping.
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${CM_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'x-gw-ims-org-id': this.credentials.imsOrg,
      'x-api-key': this.credentials.clientId,
      Accept: 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.rawFetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.ok) {
          // PUT /execution returns 201 with Location header, may have empty body
          const text = await response.text();
          if (!text) {
            // For trigger responses, build a minimal object from the Location header
            const location = response.headers.get('Location') ?? '';
            const idMatch = location.match(/\/execution\/(\d+)/);
            return { id: idMatch?.[1] ?? 'unknown', status: { state: 'NOT_STARTED' } } as T;
          }
          return JSON.parse(text) as T;
        }

        if (RETRYABLE_STATUS_CODES.includes(response.status)) {
          const retryAfter = response.headers.get('retry-after');
          const delayMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 30_000);

          lastError = new CloudManagerError(
            `HTTP ${response.status} from ${method} ${path}`,
            'HTTP_ERROR',
            response.status,
          );

          if (attempt < MAX_RETRIES) {
            await this.sleep(delayMs);
            continue;
          }
        }

        // Non-retryable error
        const errorText = await response.text().catch(() => '');
        throw new CloudManagerError(
          `Cloud Manager API error: ${response.status} ${errorText}`,
          'API_ERROR',
          response.status,
          { method, path, responseBody: errorText },
        );
      } catch (err) {
        if (err instanceof CloudManagerError) {
          lastError = err;
          if (attempt < MAX_RETRIES && err.statusCode && RETRYABLE_STATUS_CODES.includes(err.statusCode)) {
            await this.sleep(Math.min(1000 * Math.pow(2, attempt), 30_000));
            continue;
          }
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await this.sleep(Math.min(1000 * Math.pow(2, attempt), 30_000));
          continue;
        }
      }
    }

    throw lastError ?? new CloudManagerError('Request failed after retries', 'RETRY_EXHAUSTED');
  }

  /** Wrapper around fetch with timeout via AbortController. */
  private async rawFetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new CloudManagerError(
          `Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`,
          'TIMEOUT',
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
