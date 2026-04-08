/**
 * AEM Repository Connector
 *
 * Connects to AEM 6.x instances via Sling/Package Manager APIs
 * to extract content, assets, components, configs, workflows,
 * indexes, and dispatcher configuration.
 */

import type { ConnectorConfig } from '@/types';
import {
  BaseConnector,
  ConnectorError,
  type ConnectorCapability,
  type ExtractionResult,
  type HttpClient,
  type HttpRequestOptions,
  type RateLimitConfig,
  type RetryConfig,
} from './base-connector';

// ============================================================
// AEM-specific types
// ============================================================

export interface AEMContent {
  path: string;
  title: string;
  resourceType: string;
  template: string | null;
  lastModified: string | null;
  lastModifiedBy: string | null;
  published: boolean;
  children: AEMContent[];
  properties: Record<string, unknown>;
}

export interface AEMAsset {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: string | null;
  metadata: Record<string, unknown>;
  renditions: string[];
}

export interface AEMComponent {
  path: string;
  resourceType: string;
  title: string;
  group: string;
  isContainer: boolean;
  superType: string | null;
  dialogPath: string | null;
  properties: Record<string, unknown>;
}

export interface AEMWorkflow {
  id: string;
  title: string;
  model: string;
  steps: AEMWorkflowStep[];
  isEnabled: boolean;
}

export interface AEMWorkflowStep {
  id: string;
  title: string;
  type: string;
  handlerClass: string | null;
}

export interface AEMOSGiConfig {
  pid: string;
  factoryPid: string | null;
  bundleLocation: string | null;
  properties: Record<string, unknown>;
}

export interface AEMIndex {
  path: string;
  name: string;
  type: string;
  reindexCount: number;
  includedPaths: string[];
  excludedPaths: string[];
  properties: Record<string, unknown>;
}

export interface AEMDispatcherConfig {
  farms: AEMDispatcherFarm[];
  rules: AEMDispatcherRule[];
  filters: AEMDispatcherFilter[];
}

export interface AEMDispatcherFarm {
  name: string;
  docroot: string;
  virtualhosts: string[];
}

export interface AEMDispatcherRule {
  type: 'allow' | 'deny';
  glob: string;
}

export interface AEMDispatcherFilter {
  type: 'allow' | 'deny';
  method: string;
  url: string;
}

export interface AEMExtractionData {
  content: AEMContent[];
  assets: AEMAsset[];
  components: AEMComponent[];
  configs: AEMOSGiConfig[];
  workflows: AEMWorkflow[];
  indexes: AEMIndex[];
  dispatcherConfig: AEMDispatcherConfig | null;
}

interface QueryBuilderResponse {
  success: boolean;
  results: number;
  total: number;
  offset: number;
  hits: Array<{
    'jcr:path': string;
    [key: string]: unknown;
  }>;
}

interface SlingResourceResponse {
  'jcr:primaryType'?: string;
  'jcr:title'?: string;
  'sling:resourceType'?: string;
  'cq:template'?: string;
  'jcr:lastModified'?: string;
  'jcr:lastModifiedBy'?: string;
  'cq:lastReplicated'?: string;
  [key: string]: unknown;
}

// ============================================================
// AEM Connector
// ============================================================

export class AEMConnector extends BaseConnector {
  private readonly batchSize: number;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
    batchSize: number = 100,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.batchSize = batchSize;
  }

  /** Detected environment type after connect(). */
  private detectedEnvironment: 'cloud-service' | 'on-prem' | 'unknown' = 'unknown';

  /** Get the detected environment type (only valid after connect()). */
  getDetectedEnvironment(): 'cloud-service' | 'on-prem' | 'unknown' {
    return this.detectedEnvironment;
  }

  /**
   * Connect to the AEM instance and verify access.
   *
   * Uses /libs/granite/core/content/login.html as the primary connectivity
   * check because /system/console endpoints are blocked on AEMaaCS.
   * After verifying the login page, checks /content.1.json to confirm
   * actual content access with the provided credentials.
   */
  async connect(): Promise<void> {
    try {
      // Step 1: Verify AEM is reachable via the login page
      const loginResponse = await this.makeRequest({
        method: 'GET',
        url: this.buildUrl('/libs/granite/core/content/login.html'),
        headers: this.getAuthHeaders(),
        timeout: 15000,
      });

      if (loginResponse.status !== 200) {
        throw new ConnectorError(
          'Failed to reach AEM login page',
          'AEM_CONNECT_FAILED',
          loginResponse.status,
        );
      }

      // Step 2: Verify actual content access with credentials
      const contentResponse = await this.makeRequest({
        method: 'GET',
        url: this.buildUrl('/content.1.json'),
        headers: this.getAuthHeaders(),
        timeout: 15000,
      });

      if (contentResponse.status !== 200) {
        throw new ConnectorError(
          'AEM is reachable but content access denied — check credentials',
          'AEM_AUTH_FAILED',
          contentResponse.status,
        );
      }

      // Step 3: Detect environment type (Cloud Service vs on-prem)
      await this.detectEnvironment();

      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(
            `AEM connection failed: ${(error as Error).message}`,
            'AEM_CONNECT_FAILED',
          );
    }
  }

  /**
   * Detect whether the instance is AEM as a Cloud Service or on-prem.
   * Cloud Service blocks /system/console with 403.
   */
  private async detectEnvironment(): Promise<void> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: this.buildUrl('/system/console/status-productinfo.json'),
        headers: this.getAuthHeaders(),
        timeout: 10000,
      });

      // If we can access the system console, it is on-prem
      if (response.status === 200) {
        this.detectedEnvironment = 'on-prem';
        return;
      }
    } catch (err) {
      const statusCode = (err as ConnectorError).statusCode;
      if (statusCode === 403 || statusCode === 404) {
        // System console blocked — this is AEMaaCS
        this.detectedEnvironment = 'cloud-service';
        return;
      }
    }
    this.detectedEnvironment = 'unknown';
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: this.buildUrl('/libs/granite/core/content/login.html'),
        headers: this.getAuthHeaders(),
        timeout: 10000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /** Full extraction of all AEM data. */
  async extract(): Promise<ExtractionResult<AEMExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    const [content, assets, components, configs, workflows, indexes, dispatcherConfig] =
      await Promise.all([
        this.extractContent().catch(e => { warnings.push(`Content: ${(e as Error).message}`); return []; }),
        this.extractAssets().catch(e => { warnings.push(`Assets: ${(e as Error).message}`); return []; }),
        this.extractComponents().catch(e => { warnings.push(`Components: ${(e as Error).message}`); return []; }),
        this.extractConfigs().catch(e => { warnings.push(`Configs: ${(e as Error).message}`); return []; }),
        this.extractWorkflows().catch(e => { warnings.push(`Workflows: ${(e as Error).message}`); return []; }),
        this.extractIndexes().catch(e => { warnings.push(`Indexes: ${(e as Error).message}`); return []; }),
        this.extractDispatcherConfig().catch(e => { warnings.push(`Dispatcher: ${(e as Error).message}`); return null; }),
      ]);

    const totalItems = content.length + assets.length + components.length +
      configs.length + workflows.length + indexes.length;

    return {
      data: { content, assets, components, configs, workflows, indexes, dispatcherConfig },
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        itemCount: totalItems,
        warnings,
      },
    };
  }

  getCapabilities(): ConnectorCapability[] {
    return [
      { name: 'content', description: 'Extract AEM content pages', requiresAuth: true },
      { name: 'assets', description: 'Extract DAM assets and metadata', requiresAuth: true },
      { name: 'components', description: 'Extract component definitions', requiresAuth: true },
      { name: 'configs', description: 'Extract OSGi configurations', requiresAuth: true },
      { name: 'workflows', description: 'Extract workflow models', requiresAuth: true },
      { name: 'indexes', description: 'Extract Oak index definitions', requiresAuth: true },
      { name: 'dispatcher', description: 'Extract dispatcher configuration', requiresAuth: true },
    ];
  }

  // ============================================================
  // Public extraction methods
  // ============================================================

  /** Extract content pages from /content using QueryBuilder. */
  async extractContent(rootPath: string = '/content'): Promise<AEMContent[]> {
    this.ensureConnected();
    const hits = await this.queryBuilder({
      'type': 'cq:Page',
      'path': rootPath,
      'p.limit': String(this.batchSize),
    }, 'Extracting content');

    const pages: AEMContent[] = [];
    const startedAt = Date.now();

    for (let i = 0; i < hits.length; i++) {
      const path = hits[i]['jcr:path'];
      const page = await this.fetchContentNode(path);
      if (page) pages.push(page);
      this.reportProgress('content', i + 1, hits.length, `Extracting page ${path}`, startedAt);
    }

    return pages;
  }

  /** Extract DAM assets from /content/dam. */
  async extractAssets(rootPath: string = '/content/dam'): Promise<AEMAsset[]> {
    this.ensureConnected();
    return this.paginateRequest<AEMAsset, { entities: Array<Record<string, unknown>>; properties: { 'srn:paging': { next?: string } } }>(
      {
        method: 'GET',
        url: this.buildUrl(`/api/assets${rootPath.replace('/content/dam', '')}.json`),
        headers: this.getAuthHeaders(),
        queryParams: { limit: String(this.batchSize) },
      },
      (response) => {
        return (response.entities || []).map((entity) => this.mapAsset(entity));
      },
      (response, currentOptions) => {
        const nextLink = response.properties?.['srn:paging']?.next;
        if (!nextLink) return null;
        return { ...currentOptions, url: this.buildUrl(nextLink) };
      },
      'Extracting assets',
    );
  }

  /** Extract component definitions from /apps. */
  async extractComponents(): Promise<AEMComponent[]> {
    this.ensureConnected();
    const hits = await this.queryBuilder({
      'type': 'cq:Component',
      'path': '/apps',
      'p.limit': String(this.batchSize),
    }, 'Extracting components');

    const components: AEMComponent[] = [];
    for (const hit of hits) {
      const path = hit['jcr:path'];
      try {
        const response = await this.makeRequest<SlingResourceResponse>({
          method: 'GET',
          url: this.buildUrl(`${path}.infinity.json`),
          headers: this.getAuthHeaders(),
        });
        components.push(this.mapComponent(path, response.data));
      } catch {
        // Skip inaccessible components
      }
    }
    return components;
  }

  /**
   * Extract OSGi configurations from /system/console.
   * On AEMaaCS the system console is blocked (403/404), so this method
   * gracefully returns an empty array with a warning instead of throwing.
   */
  async extractConfigs(): Promise<AEMOSGiConfig[]> {
    this.ensureConnected();
    try {
      const response = await this.makeRequest<Array<Record<string, unknown>>>({
        method: 'GET',
        url: this.buildUrl('/system/console/configMgr/.json'),
        headers: this.getAuthHeaders(),
      });

      return (response.data || []).map((cfg) => ({
        pid: (cfg.pid as string) || '',
        factoryPid: (cfg.factoryPid as string) || null,
        bundleLocation: (cfg.bundle_location as string) || null,
        properties: (cfg.properties as Record<string, unknown>) || {},
      }));
    } catch (err) {
      const statusCode = (err as ConnectorError).statusCode;
      if (statusCode === 403 || statusCode === 404) {
        console.warn(
          '[AEMConnector] OSGi config endpoint unavailable (likely AEMaaCS) — returning empty configs',
        );
        return [];
      }
      throw err;
    }
  }

  /** Extract workflow model definitions. */
  async extractWorkflows(): Promise<AEMWorkflow[]> {
    this.ensureConnected();
    const hits = await this.queryBuilder({
      'type': 'cq:WorkflowModel',
      'path': '/var/workflow/models',
      'p.limit': '-1',
    }, 'Extracting workflows');

    const workflows: AEMWorkflow[] = [];
    for (const hit of hits) {
      const path = hit['jcr:path'];
      try {
        const response = await this.makeRequest<SlingResourceResponse>({
          method: 'GET',
          url: this.buildUrl(`${path}.infinity.json`),
          headers: this.getAuthHeaders(),
        });
        workflows.push(this.mapWorkflow(path, response.data));
      } catch {
        // Skip inaccessible workflows
      }
    }
    return workflows;
  }

  /** Extract Oak index definitions. */
  async extractIndexes(): Promise<AEMIndex[]> {
    this.ensureConnected();
    const response = await this.makeRequest<SlingResourceResponse>({
      method: 'GET',
      url: this.buildUrl('/oak:index.3.json'),
      headers: this.getAuthHeaders(),
    });

    const indexes: AEMIndex[] = [];
    const data = response.data;
    for (const [name, value] of Object.entries(data)) {
      if (name.startsWith('jcr:') || typeof value !== 'object' || !value) continue;
      const indexData = value as Record<string, unknown>;
      indexes.push({
        path: `/oak:index/${name}`,
        name,
        type: (indexData.type as string) || 'property',
        reindexCount: (indexData.reindexCount as number) || 0,
        includedPaths: (indexData.includedPaths as string[]) || [],
        excludedPaths: (indexData.excludedPaths as string[]) || [],
        properties: indexData,
      });
    }
    return indexes;
  }

  /** Extract dispatcher configuration via system console. */
  async extractDispatcherConfig(): Promise<AEMDispatcherConfig | null> {
    this.ensureConnected();
    try {
      const response = await this.makeRequest<Record<string, unknown>>({
        method: 'GET',
        url: this.buildUrl('/system/console/status-Configurations.json'),
        headers: this.getAuthHeaders(),
      });
      // Dispatcher configs are typically in repository config nodes
      return this.parseDispatcherFromConfigs(response.data);
    } catch {
      return null;
    }
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected to AEM. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  /** Run a QueryBuilder query with automatic pagination. */
  private async queryBuilder(
    params: Record<string, string>,
    phase: string,
  ): Promise<Array<{ 'jcr:path': string; [key: string]: unknown }>> {
    const allHits: Array<{ 'jcr:path': string; [key: string]: unknown }> = [];
    let offset = 0;
    const limit = parseInt(params['p.limit'] || String(this.batchSize), 10);
    const startedAt = Date.now();

    while (true) {
      const queryParams: Record<string, string> = {
        ...params,
        'p.offset': String(offset),
        'p.limit': limit === -1 ? '-1' : String(limit),
      };

      const response = await this.makeRequest<QueryBuilderResponse>({
        method: 'GET',
        url: this.buildUrl('/bin/querybuilder.json'),
        headers: this.getAuthHeaders(),
        queryParams,
      });

      const data = response.data;
      if (!data.hits || data.hits.length === 0) break;
      // AEMaaCS QueryBuilder returns the path under "path" instead of "jcr:path"
      // on some endpoints. Normalize so downstream code can always read jcr:path.
      const normalized = data.hits.map((h) => {
        const rawPath = (h as Record<string, unknown>)['jcr:path']
          ?? (h as Record<string, unknown>)['path'];
        return { ...h, 'jcr:path': rawPath as string };
      });
      allHits.push(...normalized);

      this.reportProgress(phase, allHits.length, data.total || allHits.length,
        `${phase}: ${allHits.length} / ${data.total || '?'}`, startedAt);

      if (limit === -1 || allHits.length >= (data.total || 0)) break;
      offset += limit;
    }

    return allHits;
  }

  private async fetchContentNode(path: string): Promise<AEMContent | null> {
    try {
      const response = await this.makeRequest<SlingResourceResponse>({
        method: 'GET',
        url: this.buildUrl(`${path}/jcr:content.json`),
        headers: this.getAuthHeaders(),
      });
      const data = response.data;
      return {
        path,
        title: (data['jcr:title'] as string) || path.split('/').pop() || '',
        resourceType: (data['sling:resourceType'] as string) || '',
        template: (data['cq:template'] as string) || null,
        lastModified: (data['jcr:lastModified'] as string) || null,
        lastModifiedBy: (data['jcr:lastModifiedBy'] as string) || null,
        published: !!data['cq:lastReplicated'],
        children: [],
        properties: data,
      };
    } catch {
      // Some cq:Page nodes (folder-like containers, legacy nodes) have no
      // jcr:content subnode. Return a minimal stub so we still account for
      // the page in the extraction rather than silently dropping it.
      return {
        path,
        title: path.split('/').pop() || '',
        resourceType: '',
        template: null,
        lastModified: null,
        lastModifiedBy: null,
        published: false,
        children: [],
        properties: { _incomplete: true },
      };
    }
  }

  private mapAsset(entity: Record<string, unknown>): AEMAsset {
    const properties = (entity.properties || {}) as Record<string, unknown>;
    const metadata = (properties.metadata || {}) as Record<string, unknown>;
    return {
      path: (properties['dam:assetPath'] as string) || (entity.path as string) || '',
      name: (properties.name as string) || '',
      mimeType: (metadata['dc:format'] as string) || '',
      size: (metadata['dam:size'] as number) || 0,
      lastModified: (properties['jcr:lastModified'] as string) || null,
      metadata,
      renditions: ((entity.renditions || []) as Array<{ name: string }>).map(r => r.name),
    };
  }

  private mapComponent(path: string, data: SlingResourceResponse): AEMComponent {
    return {
      path,
      resourceType: path.replace('/apps/', ''),
      title: (data['jcr:title'] as string) || path.split('/').pop() || '',
      group: (data.componentGroup as string) || '.hidden',
      isContainer: (data.isContainer as boolean) || false,
      superType: (data['sling:resourceSuperType'] as string) || null,
      dialogPath: data['cq:dialog'] ? `${path}/cq:dialog` : null,
      properties: data,
    };
  }

  private mapWorkflow(path: string, data: SlingResourceResponse): AEMWorkflow {
    const nodes = (data.nodes as Record<string, unknown>) || {};
    const steps: AEMWorkflowStep[] = [];
    for (const [id, value] of Object.entries(nodes)) {
      if (typeof value !== 'object' || !value) continue;
      const step = value as Record<string, unknown>;
      steps.push({
        id,
        title: (step['jcr:title'] as string) || id,
        type: (step.type as string) || 'PROCESS',
        handlerClass: (step.PROCESS_AUTO_ADVANCE as string) || null,
      });
    }
    return {
      id: path,
      title: (data['jcr:title'] as string) || path.split('/').pop() || '',
      model: path,
      steps,
      isEnabled: (data.enabled as boolean) !== false,
    };
  }

  private parseDispatcherFromConfigs(
    data: Record<string, unknown>,
  ): AEMDispatcherConfig {
    // Parse dispatcher configuration from system console output
    const farms: AEMDispatcherFarm[] = [];
    const rules: AEMDispatcherRule[] = [];
    const filters: AEMDispatcherFilter[] = [];

    const configArray = Array.isArray(data) ? data : [data];
    for (const entry of configArray) {
      if (typeof entry !== 'object' || !entry) continue;
      const entryObj = entry as Record<string, unknown>;
      const pid = (entryObj.pid as string) || '';

      if (pid.includes('dispatcher') || pid.includes('cache')) {
        const props = (entryObj.properties || {}) as Record<string, unknown>;
        if (props.docroot) {
          farms.push({
            name: pid,
            docroot: props.docroot as string,
            virtualhosts: (props.virtualhosts as string[]) || [],
          });
        }
      }
    }

    return { farms, rules, filters };
  }
}
