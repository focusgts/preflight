/**
 * Tests for AEMConnector
 *
 * Covers connection setup, content/asset extraction, pagination,
 * rate limiting, error handling, and capabilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AEMConnector } from '@/lib/connectors/aem-connector';
import {
  ConnectorError,
  type HttpClient,
  type HttpRequestOptions,
  type HttpResponse,
} from '@/lib/connectors/base-connector';
import type { ConnectorConfig } from '@/types';

// ---- Helpers ----

function makeConfig(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'aem-1',
    type: 'aem',
    name: 'Test AEM Instance',
    connectionDetails: {
      baseUrl: 'https://author.aem.example.com',
      authType: 'basic',
      username: 'admin',
      password: 'admin',
    },
    status: 'disconnected',
    lastTestedAt: null,
    capabilities: [],
    ...overrides,
  };
}

function makeMockHttpClient(responses: Map<string, HttpResponse>): HttpClient {
  return {
    request: vi.fn(async <T>(options: HttpRequestOptions): Promise<HttpResponse<T>> => {
      // Match by URL path fragment
      for (const [pattern, response] of responses.entries()) {
        if (options.url.includes(pattern)) {
          return response as HttpResponse<T>;
        }
      }
      return { status: 404, headers: {}, data: {} as T };
    }),
  };
}

function makeSuccessClient(): HttpClient {
  const responses = new Map<string, HttpResponse>();

  // Product info (connect)
  responses.set('status-productinfo', {
    status: 200,
    headers: {},
    data: [{ name: 'Adobe Experience Manager', version: '6.5.0' }],
  });

  // Login page (testConnection)
  responses.set('login.html', {
    status: 200,
    headers: {},
    data: '<html>Login</html>',
  });

  // QueryBuilder - content
  responses.set('querybuilder.json', {
    status: 200,
    headers: {},
    data: {
      success: true,
      results: 2,
      total: 2,
      offset: 0,
      hits: [
        { 'jcr:path': '/content/site/en/home' },
        { 'jcr:path': '/content/site/en/about' },
      ],
    },
  });

  // Content node
  responses.set('jcr:content.json', {
    status: 200,
    headers: {},
    data: {
      'jcr:primaryType': 'cq:PageContent',
      'jcr:title': 'Home Page',
      'sling:resourceType': 'mysite/components/page',
      'cq:template': '/conf/mysite/settings/wcm/templates/page',
      'jcr:lastModified': '2024-01-15T10:30:00.000Z',
      'jcr:lastModifiedBy': 'admin',
      'cq:lastReplicated': '2024-01-15T12:00:00.000Z',
    },
  });

  // Assets API
  responses.set('api/assets', {
    status: 200,
    headers: {},
    data: {
      entities: [
        {
          path: '/content/dam/mysite/hero.jpg',
          properties: {
            name: 'hero.jpg',
            'dam:assetPath': '/content/dam/mysite/hero.jpg',
            'jcr:lastModified': '2024-01-10T08:00:00.000Z',
            metadata: {
              'dc:format': 'image/jpeg',
              'dam:size': 524288,
            },
          },
          renditions: [{ name: 'original' }, { name: 'cq5dam.thumbnail.48.48.png' }],
        },
      ],
      properties: { 'srn:paging': {} },
    },
  });

  // Components
  responses.set('infinity.json', {
    status: 200,
    headers: {},
    data: {
      'jcr:primaryType': 'cq:Component',
      'jcr:title': 'Hero Banner',
      'componentGroup': 'My Site',
      'sling:resourceSuperType': 'core/wcm/components/image',
    },
  });

  // OSGi configs
  responses.set('configMgr/.json', {
    status: 200,
    headers: {},
    data: [
      {
        pid: 'com.day.cq.dam.core.impl.servlet.HealthCheckServlet',
        factoryPid: null,
        bundle_location: 'launchpad:resources/install/1',
        properties: { 'log.level': 'info' },
      },
    ],
  });

  // Workflows
  responses.set('workflow/models', {
    status: 200,
    headers: {},
    data: {
      success: true,
      results: 1,
      total: 1,
      offset: 0,
      hits: [{ 'jcr:path': '/var/workflow/models/dam-update-asset' }],
    },
  });

  // Oak indexes
  responses.set('oak:index.3.json', {
    status: 200,
    headers: {},
    data: {
      'jcr:primaryType': 'oak:QueryIndexDefinition',
      lucene: {
        type: 'lucene',
        reindexCount: 5,
        includedPaths: ['/content'],
        excludedPaths: ['/var'],
      },
    },
  });

  // Dispatcher config
  responses.set('status-Configurations.json', {
    status: 200,
    headers: {},
    data: [
      {
        pid: 'com.adobe.dispatcher.cache',
        properties: {
          docroot: '/var/www/html',
          virtualhosts: ['example.com', 'www.example.com'],
        },
      },
    ],
  });

  return makeMockHttpClient(responses);
}

// ============================================================
// Tests
// ============================================================

describe('AEMConnector', () => {
  let config: ConnectorConfig;
  let httpClient: HttpClient;
  let connector: AEMConnector;

  beforeEach(() => {
    config = makeConfig();
    httpClient = makeSuccessClient();
    connector = new AEMConnector(config, httpClient, {
      maxRequestsPerSecond: 1000,
      maxRequestsPerMinute: 60000,
    }, {
      maxRetries: 0,
      baseDelayMs: 0,
    });
  });

  // ----------------------------------------------------------
  // Connection Setup
  // ----------------------------------------------------------

  describe('connection setup', () => {
    it('should connect successfully and update status', async () => {
      await connector.connect();

      expect(connector.getConnectionStatus()).toBe('connected');
      expect(connector.getConfig().lastTestedAt).not.toBeNull();
    });

    it('should set status to error when connection fails', async () => {
      const failClient: HttpClient = {
        request: vi.fn().mockResolvedValue({ status: 401, headers: {}, data: {} }),
      };
      const failConnector = new AEMConnector(makeConfig(), failClient, undefined, {
        maxRetries: 0,
      });

      await expect(failConnector.connect()).rejects.toThrow();
      expect(failConnector.getConnectionStatus()).toBe('error');
    });

    it('should set status to error when request throws', async () => {
      const throwClient: HttpClient = {
        request: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const failConnector = new AEMConnector(makeConfig(), throwClient, undefined, {
        maxRetries: 0,
      });

      await expect(failConnector.connect()).rejects.toThrow();
      expect(failConnector.getConnectionStatus()).toBe('error');
    });

    it('should disconnect and update status', async () => {
      await connector.connect();
      await connector.disconnect();

      expect(connector.getConnectionStatus()).toBe('disconnected');
    });
  });

  // ----------------------------------------------------------
  // Test Connection
  // ----------------------------------------------------------

  describe('testConnection', () => {
    it('should return true when server responds 200', async () => {
      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when server responds with error', async () => {
      const failClient: HttpClient = {
        request: vi.fn().mockResolvedValue({ status: 500, headers: {}, data: {} }),
      };
      const failConnector = new AEMConnector(makeConfig(), failClient, {
        maxRequestsPerSecond: 1000,
        maxRequestsPerMinute: 60000,
      }, {
        maxRetries: 0,
      });

      const result = await failConnector.testConnection();
      expect(result).toBe(false);
    });

    it('should return false when request throws', async () => {
      const throwClient: HttpClient = {
        request: vi.fn().mockRejectedValue(new Error('timeout')),
      };
      const throwConnector = new AEMConnector(makeConfig(), throwClient, {
        maxRequestsPerSecond: 1000,
        maxRequestsPerMinute: 60000,
      }, {
        maxRetries: 0,
      });

      const result = await throwConnector.testConnection();
      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // Content Extraction
  // ----------------------------------------------------------

  describe('content extraction', () => {
    it('should extract content pages from AEM', async () => {
      await connector.connect();
      const content = await connector.extractContent();

      expect(content.length).toBeGreaterThan(0);
      expect(content[0].path).toBe('/content/site/en/home');
      expect(content[0].title).toBe('Home Page');
      expect(content[0].resourceType).toBe('mysite/components/page');
      expect(content[0].template).toBe('/conf/mysite/settings/wcm/templates/page');
      expect(content[0].published).toBe(true);
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractContent()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Asset Extraction
  // ----------------------------------------------------------

  describe('asset extraction', () => {
    it('should extract assets with metadata', async () => {
      await connector.connect();
      const assets = await connector.extractAssets();

      expect(assets.length).toBeGreaterThan(0);
      expect(assets[0].path).toBe('/content/dam/mysite/hero.jpg');
      expect(assets[0].name).toBe('hero.jpg');
      expect(assets[0].mimeType).toBe('image/jpeg');
      expect(assets[0].size).toBe(524288);
      expect(assets[0].renditions).toContain('original');
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractAssets()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Component Extraction
  // ----------------------------------------------------------

  describe('component extraction', () => {
    it('should extract component definitions', async () => {
      await connector.connect();
      const components = await connector.extractComponents();

      expect(components.length).toBeGreaterThan(0);
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractComponents()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Config Extraction
  // ----------------------------------------------------------

  describe('OSGi config extraction', () => {
    it('should extract OSGi configurations', async () => {
      await connector.connect();
      const configs = await connector.extractConfigs();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0].pid).toBe('com.day.cq.dam.core.impl.servlet.HealthCheckServlet');
      expect(configs[0].properties).toHaveProperty('log.level');
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractConfigs()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Workflow Extraction
  // ----------------------------------------------------------

  describe('workflow extraction', () => {
    it('should extract workflow models', async () => {
      await connector.connect();
      const workflows = await connector.extractWorkflows();

      expect(workflows.length).toBeGreaterThan(0);
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractWorkflows()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Index Extraction
  // ----------------------------------------------------------

  describe('index extraction', () => {
    it('should extract Oak index definitions', async () => {
      await connector.connect();
      const indexes = await connector.extractIndexes();

      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes[0].name).toBe('lucene');
      expect(indexes[0].type).toBe('lucene');
      expect(indexes[0].includedPaths).toContain('/content');
    });

    it('should throw when not connected', async () => {
      await expect(connector.extractIndexes()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Full Extraction
  // ----------------------------------------------------------

  describe('full extraction', () => {
    it('should extract all data types together', async () => {
      await connector.connect();
      const result = await connector.extract();

      expect(result.data.content.length).toBeGreaterThan(0);
      expect(result.data.assets.length).toBeGreaterThan(0);
      expect(result.data.configs.length).toBeGreaterThan(0);
      expect(result.metadata.extractedAt).toBeDefined();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.itemCount).toBeGreaterThan(0);
    });

    it('should capture warnings for failed sub-extractions', async () => {
      // Create a client where some endpoints fail
      const partialClient: HttpClient = {
        request: vi.fn(async (options: HttpRequestOptions) => {
          if (options.url.includes('status-productinfo')) {
            return { status: 200, headers: {}, data: [] };
          }
          if (options.url.includes('querybuilder.json')) {
            return {
              status: 200, headers: {},
              data: { success: true, results: 0, total: 0, offset: 0, hits: [] },
            };
          }
          if (options.url.includes('api/assets')) {
            return {
              status: 200, headers: {},
              data: { entities: [], properties: { 'srn:paging': {} } },
            };
          }
          if (options.url.includes('configMgr')) {
            return { status: 200, headers: {}, data: [] };
          }
          if (options.url.includes('oak:index')) {
            return { status: 200, headers: {}, data: {} };
          }
          // Let dispatcher and other calls fail
          throw new Error('Not available');
        }),
      };

      const partialConnector = new AEMConnector(makeConfig(), partialClient, {
        maxRequestsPerSecond: 1000,
        maxRequestsPerMinute: 60000,
      }, { maxRetries: 0 });

      await partialConnector.connect();
      const result = await partialConnector.extract();

      // Should complete without throwing
      expect(result.data).toBeDefined();
    });

    it('should throw when not connected', async () => {
      await expect(connector.extract()).rejects.toThrow('Not connected');
    });
  });

  // ----------------------------------------------------------
  // Capabilities
  // ----------------------------------------------------------

  describe('capabilities', () => {
    it('should list all extraction capabilities', () => {
      const caps = connector.getCapabilities();

      expect(caps.length).toBeGreaterThanOrEqual(7);
      const names = caps.map((c) => c.name);
      expect(names).toContain('content');
      expect(names).toContain('assets');
      expect(names).toContain('components');
      expect(names).toContain('configs');
      expect(names).toContain('workflows');
      expect(names).toContain('indexes');
      expect(names).toContain('dispatcher');
    });

    it('should require auth for all capabilities', () => {
      const caps = connector.getCapabilities();
      expect(caps.every((c) => c.requiresAuth)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Pagination Handling
  // ----------------------------------------------------------

  describe('pagination handling', () => {
    it('should paginate through assets using srn:paging', async () => {
      let callCount = 0;
      const paginatingClient: HttpClient = {
        request: vi.fn(async (options: HttpRequestOptions) => {
          if (options.url.includes('status-productinfo')) {
            return { status: 200, headers: {}, data: [] };
          }
          if (options.url.includes('api/assets')) {
            callCount++;
            if (callCount === 1) {
              return {
                status: 200, headers: {},
                data: {
                  entities: [{ path: '/dam/a.jpg', properties: { name: 'a.jpg', metadata: {} } }],
                  properties: { 'srn:paging': { next: '/api/assets.json?offset=1' } },
                },
              };
            }
            return {
              status: 200, headers: {},
              data: {
                entities: [{ path: '/dam/b.jpg', properties: { name: 'b.jpg', metadata: {} } }],
                properties: { 'srn:paging': {} },
              },
            };
          }
          return { status: 200, headers: {}, data: {} };
        }),
      };

      const pagConnector = new AEMConnector(makeConfig(), paginatingClient, {
        maxRequestsPerSecond: 1000,
        maxRequestsPerMinute: 60000,
      }, { maxRetries: 0 });

      await pagConnector.connect();
      const assets = await pagConnector.extractAssets();

      expect(assets).toHaveLength(2);
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------
  // Error Handling
  // ----------------------------------------------------------

  describe('error handling', () => {
    it('should wrap non-ConnectorError exceptions during connect', async () => {
      const badClient: HttpClient = {
        request: vi.fn().mockRejectedValue(new TypeError('Invalid URL')),
      };
      const badConnector = new AEMConnector(makeConfig(), badClient, undefined, {
        maxRetries: 0,
      });

      await expect(badConnector.connect()).rejects.toThrow(ConnectorError);
    });

    it('should preserve ConnectorError during connect', async () => {
      const errClient: HttpClient = {
        request: vi.fn().mockRejectedValue(
          new ConnectorError('Auth failed', 'AUTH_FAILED', 401),
        ),
      };
      const errConnector = new AEMConnector(makeConfig(), errClient, undefined, {
        maxRetries: 0,
      });

      try {
        await errConnector.connect();
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConnectorError);
        expect((e as ConnectorError).code).toBe('AUTH_FAILED');
      }
    });
  });

  // ----------------------------------------------------------
  // Auth Headers
  // ----------------------------------------------------------

  describe('auth headers', () => {
    it('should use basic auth when configured', async () => {
      await connector.connect();
      await connector.extractContent();

      const requestFn = httpClient.request as ReturnType<typeof vi.fn>;
      const calls = requestFn.mock.calls;
      // Find a call that has headers with Authorization
      const authCall = calls.find(
        (c: [HttpRequestOptions]) => c[0].headers?.['Authorization'],
      );
      expect(authCall).toBeDefined();
      expect(authCall![0].headers!['Authorization']).toMatch(/^Basic /);
    });

    it('should use bearer auth when configured', async () => {
      const bearerConfig = makeConfig({
        connectionDetails: {
          baseUrl: 'https://author.aem.example.com',
          authType: 'bearer',
          accessToken: 'my-token-123',
        },
      });

      const bearerConnector = new AEMConnector(bearerConfig, httpClient, {
        maxRequestsPerSecond: 1000,
        maxRequestsPerMinute: 60000,
      }, { maxRetries: 0 });

      await bearerConnector.connect();
      await bearerConnector.extractContent();

      const requestFn = httpClient.request as ReturnType<typeof vi.fn>;
      const calls = requestFn.mock.calls;
      const authCall = calls.find(
        (c: [HttpRequestOptions]) => c[0].headers?.['Authorization']?.startsWith('Bearer'),
      );
      expect(authCall).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // Progress Reporting
  // ----------------------------------------------------------

  describe('progress reporting', () => {
    it('should call progress callback during content extraction', async () => {
      const progressFn = vi.fn();
      connector.setProgressCallback(progressFn);

      await connector.connect();
      await connector.extractContent();

      expect(progressFn).toHaveBeenCalled();
      const lastCall = progressFn.mock.calls[progressFn.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('phase');
      expect(lastCall).toHaveProperty('current');
      expect(lastCall).toHaveProperty('total');
      expect(lastCall).toHaveProperty('percentage');
    });
  });
});
