/**
 * Tests for ConnectorFactory
 *
 * Tests creating each connector type, handling unknown connector types,
 * and validating connector configuration.
 */

import { describe, it, expect, vi } from 'vitest';
import { AEMConnector } from '@/lib/connectors/aem-connector';
import {
  BaseConnector,
  ConnectorError,
  type HttpClient,
  type ConnectorCapability,
  type ExtractionResult,
} from '@/lib/connectors/base-connector';
import type { ConnectorConfig } from '@/types';

// ---- Minimal concrete connector for testing ----

class FileUploadConnector extends BaseConnector {
  async connect(): Promise<void> {
    this.isConnected = true;
    this.config.status = 'connected';
  }
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
  }
  async testConnection(): Promise<boolean> {
    return true;
  }
  async extract(): Promise<ExtractionResult> {
    return {
      data: [],
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs: 0,
        itemCount: 0,
        warnings: [],
      },
    };
  }
  getCapabilities(): ConnectorCapability[] {
    return [
      { name: 'csv', description: 'Parse CSV files', requiresAuth: false },
      { name: 'json', description: 'Parse JSON files', requiresAuth: false },
    ];
  }
}

class AnalyticsConnector extends BaseConnector {
  async connect(): Promise<void> {
    this.isConnected = true;
    this.config.status = 'connected';
  }
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
  }
  async testConnection(): Promise<boolean> {
    return true;
  }
  async extract(): Promise<ExtractionResult> {
    return {
      data: { reportSuites: [], segments: [] },
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs: 0,
        itemCount: 0,
        warnings: [],
      },
    };
  }
  getCapabilities(): ConnectorCapability[] {
    return [
      { name: 'report-suites', description: 'Extract report suites', requiresAuth: true },
      { name: 'segments', description: 'Extract segments', requiresAuth: true },
    ];
  }
}

// ---- Factory implementation ----

type ConnectorClass = new (config: ConnectorConfig, httpClient?: HttpClient) => BaseConnector;

const CONNECTOR_REGISTRY: Record<string, ConnectorClass> = {
  aem: AEMConnector,
  file: FileUploadConnector,
  analytics: AnalyticsConnector,
};

class ConnectorFactory {
  static create(config: ConnectorConfig, httpClient?: HttpClient): BaseConnector {
    const ConnectorClass = CONNECTOR_REGISTRY[config.type];
    if (!ConnectorClass) {
      throw new ConnectorError(
        `Unknown connector type: ${config.type}`,
        'UNKNOWN_CONNECTOR_TYPE',
      );
    }
    ConnectorFactory.validateConfig(config);
    return new ConnectorClass(config, httpClient);
  }

  static getSupportedTypes(): string[] {
    return Object.keys(CONNECTOR_REGISTRY);
  }

  static validateConfig(config: ConnectorConfig): void {
    if (!config.id || config.id.trim().length === 0) {
      throw new ConnectorError('Connector ID is required', 'INVALID_CONFIG');
    }
    if (!config.type || config.type.trim().length === 0) {
      throw new ConnectorError('Connector type is required', 'INVALID_CONFIG');
    }
    if (!config.name || config.name.trim().length === 0) {
      throw new ConnectorError('Connector name is required', 'INVALID_CONFIG');
    }

    // AEM-specific validations
    if (config.type === 'aem') {
      const details = config.connectionDetails;
      if (!details.baseUrl) {
        throw new ConnectorError('AEM connector requires baseUrl', 'INVALID_CONFIG');
      }
    }

    // Analytics-specific validations
    if (config.type === 'analytics') {
      const details = config.connectionDetails;
      if (!details.apiKey && !details.accessToken) {
        throw new ConnectorError(
          'Analytics connector requires apiKey or accessToken',
          'INVALID_CONFIG',
        );
      }
    }
  }
}

// ---- Helpers ----

function makeConfig(type: string, overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: `conn-${type}`,
    type,
    name: `Test ${type} connector`,
    connectionDetails: {
      baseUrl: 'https://example.com',
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

// ============================================================
// Tests
// ============================================================

describe('ConnectorFactory', () => {

  // ----------------------------------------------------------
  // Creating Each Connector Type
  // ----------------------------------------------------------

  describe('creating connectors by type', () => {
    it('should create an AEM connector', () => {
      const config = makeConfig('aem');
      const connector = ConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(AEMConnector);
      expect(connector.getConfig().type).toBe('aem');
    });

    it('should create a file upload connector', () => {
      const config = makeConfig('file');
      const connector = ConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(FileUploadConnector);
    });

    it('should create an analytics connector', () => {
      const config = makeConfig('analytics', {
        connectionDetails: {
          baseUrl: 'https://analytics.adobe.io',
          apiKey: 'test-key',
        },
      });
      const connector = ConnectorFactory.create(config);

      expect(connector).toBeInstanceOf(AnalyticsConnector);
    });

    it('should pass httpClient to the connector', () => {
      const mockClient: HttpClient = {
        request: vi.fn().mockResolvedValue({ status: 200, headers: {}, data: {} }),
      };
      const config = makeConfig('aem');
      const connector = ConnectorFactory.create(config, mockClient);

      expect(connector).toBeInstanceOf(AEMConnector);
    });

    it('should preserve config values in created connector', () => {
      const config = makeConfig('file', {
        id: 'custom-id',
        name: 'My File Connector',
      });
      const connector = ConnectorFactory.create(config);

      const savedConfig = connector.getConfig();
      expect(savedConfig.id).toBe('custom-id');
      expect(savedConfig.name).toBe('My File Connector');
    });
  });

  // ----------------------------------------------------------
  // Unknown Connector Type Error
  // ----------------------------------------------------------

  describe('unknown connector type', () => {
    it('should throw ConnectorError for unknown type', () => {
      const config = makeConfig('salesforce');

      expect(() => ConnectorFactory.create(config)).toThrow(ConnectorError);
    });

    it('should include the type name in error message', () => {
      const config = makeConfig('nonexistent');

      try {
        ConnectorFactory.create(config);
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as ConnectorError).message).toContain('nonexistent');
        expect((e as ConnectorError).code).toBe('UNKNOWN_CONNECTOR_TYPE');
      }
    });

    it('should throw for empty type string', () => {
      const config = makeConfig('');

      expect(() => ConnectorFactory.create(config)).toThrow();
    });
  });

  // ----------------------------------------------------------
  // Configuration Validation
  // ----------------------------------------------------------

  describe('configuration validation', () => {
    it('should throw for missing connector ID', () => {
      const config = makeConfig('file', { id: '' });

      expect(() => ConnectorFactory.create(config)).toThrow('Connector ID is required');
    });

    it('should throw for missing connector name', () => {
      const config = makeConfig('file', { name: '' });

      expect(() => ConnectorFactory.create(config)).toThrow('Connector name is required');
    });

    it('should throw for AEM connector missing baseUrl', () => {
      const config = makeConfig('aem', {
        connectionDetails: { authType: 'basic', username: 'admin', password: 'admin' },
      });

      expect(() => ConnectorFactory.create(config)).toThrow('baseUrl');
    });

    it('should throw for analytics connector missing credentials', () => {
      const config = makeConfig('analytics', {
        connectionDetails: {},
      });

      expect(() => ConnectorFactory.create(config)).toThrow('apiKey or accessToken');
    });

    it('should accept analytics connector with apiKey', () => {
      const config = makeConfig('analytics', {
        connectionDetails: { apiKey: 'key-123' },
      });

      expect(() => ConnectorFactory.create(config)).not.toThrow();
    });

    it('should accept analytics connector with accessToken', () => {
      const config = makeConfig('analytics', {
        connectionDetails: { accessToken: 'token-abc' },
      });

      expect(() => ConnectorFactory.create(config)).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // Supported Types
  // ----------------------------------------------------------

  describe('supported types listing', () => {
    it('should list all supported connector types', () => {
      const types = ConnectorFactory.getSupportedTypes();

      expect(types).toContain('aem');
      expect(types).toContain('file');
      expect(types).toContain('analytics');
    });

    it('should return an array of strings', () => {
      const types = ConnectorFactory.getSupportedTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(typeof t).toBe('string');
      }
    });
  });

  // ----------------------------------------------------------
  // Connector Lifecycle
  // ----------------------------------------------------------

  describe('connector lifecycle', () => {
    it('should be able to connect and disconnect a created connector', async () => {
      const config = makeConfig('file');
      const connector = ConnectorFactory.create(config);

      await connector.connect();
      expect(connector.getConnectionStatus()).toBe('connected');

      await connector.disconnect();
      expect(connector.getConnectionStatus()).toBe('disconnected');
    });

    it('should be able to test connection on a created connector', async () => {
      const config = makeConfig('file');
      const connector = ConnectorFactory.create(config);

      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it('should be able to extract from a created connector', async () => {
      const config = makeConfig('file');
      const connector = ConnectorFactory.create(config);

      await connector.connect();
      const result = await connector.extract();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('extractedAt');
    });
  });
});
