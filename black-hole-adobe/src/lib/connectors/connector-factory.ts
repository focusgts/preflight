/**
 * Connector Factory
 *
 * Creates the appropriate connector instance based on the source type.
 * Maintains a registry of all available connector types.
 */

import type { ConnectorConfig } from '@/types';
import {
  type BaseConnector,
  type HttpClient,
  type RateLimitConfig,
  type RetryConfig,
} from './base-connector';
import { AEMConnector } from './aem-connector';
import { AnalyticsConnector } from './analytics-connector';
import { CampaignConnector } from './campaign-connector';
import { AEPConnector } from './aep-connector';
import { CommerceConnector } from './commerce-connector';
import { CMSConnector } from './cms-connector';
import { FileConnector } from './file-connector';
import { ConnectorError } from './base-connector';

// ============================================================
// Factory types
// ============================================================

export type ConnectorType =
  | 'aem'
  | 'analytics'
  | 'adobe_analytics'
  | 'google_analytics'
  | 'campaign'
  | 'campaign_standard'
  | 'campaign_classic'
  | 'campaign_v8'
  | 'sfmc'
  | 'aep'
  | 'commerce'
  | 'adobe_commerce'
  | 'shopify'
  | 'sfcc'
  | 'cms'
  | 'wordpress'
  | 'sitecore'
  | 'drupal'
  | 'file'
  | 'csv'
  | 'json'
  | 'xml';

export interface ConnectorTypeInfo {
  type: ConnectorType;
  name: string;
  description: string;
  category: 'content' | 'analytics' | 'marketing' | 'platform' | 'commerce' | 'cms' | 'file';
  platforms: string[];
}

export interface CreateConnectorOptions {
  httpClient?: HttpClient;
  rateLimitConfig?: Partial<RateLimitConfig>;
  retryConfig?: Partial<RetryConfig>;
}

// ============================================================
// Type-to-platform resolution
// ============================================================

interface PlatformResolution {
  connectorClass: 'aem' | 'analytics' | 'campaign' | 'aep' | 'commerce' | 'cms' | 'file';
  platformOverride?: string;
}

const TYPE_RESOLUTION: Record<string, PlatformResolution> = {
  aem: { connectorClass: 'aem' },
  analytics: { connectorClass: 'analytics', platformOverride: 'adobe_analytics' },
  adobe_analytics: { connectorClass: 'analytics', platformOverride: 'adobe_analytics' },
  google_analytics: { connectorClass: 'analytics', platformOverride: 'google_analytics' },
  campaign: { connectorClass: 'campaign', platformOverride: 'campaign_standard' },
  campaign_standard: { connectorClass: 'campaign', platformOverride: 'campaign_standard' },
  campaign_classic: { connectorClass: 'campaign', platformOverride: 'campaign_classic' },
  campaign_v8: { connectorClass: 'campaign', platformOverride: 'campaign_v8' },
  sfmc: { connectorClass: 'campaign', platformOverride: 'sfmc' },
  aep: { connectorClass: 'aep' },
  commerce: { connectorClass: 'commerce', platformOverride: 'adobe_commerce' },
  adobe_commerce: { connectorClass: 'commerce', platformOverride: 'adobe_commerce' },
  shopify: { connectorClass: 'commerce', platformOverride: 'shopify' },
  sfcc: { connectorClass: 'commerce', platformOverride: 'sfcc' },
  cms: { connectorClass: 'cms', platformOverride: 'wordpress' },
  wordpress: { connectorClass: 'cms', platformOverride: 'wordpress' },
  sitecore: { connectorClass: 'cms', platformOverride: 'sitecore' },
  drupal: { connectorClass: 'cms', platformOverride: 'drupal' },
  file: { connectorClass: 'file' },
  csv: { connectorClass: 'file' },
  json: { connectorClass: 'file' },
  xml: { connectorClass: 'file' },
};

// ============================================================
// Connector Factory
// ============================================================

export class ConnectorFactory {
  /** Create a connector instance based on the given type and config. */
  static createConnector(
    type: ConnectorType,
    config: ConnectorConfig,
    options?: CreateConnectorOptions,
  ): BaseConnector {
    const resolution = TYPE_RESOLUTION[type];
    if (!resolution) {
      throw new ConnectorError(
        `Unknown connector type: ${type}. Use getAvailableTypes() to see supported types.`,
        'UNKNOWN_TYPE',
      );
    }

    // Apply platform override to connectionDetails if needed
    const resolvedConfig: ConnectorConfig = {
      ...config,
      connectionDetails: {
        ...config.connectionDetails,
        ...(resolution.platformOverride
          ? { platform: resolution.platformOverride }
          : {}),
      },
    };

    switch (resolution.connectorClass) {
      case 'aem':
        return new AEMConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'analytics':
        return new AnalyticsConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'campaign':
        return new CampaignConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'aep':
        return new AEPConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'commerce':
        return new CommerceConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'cms':
        return new CMSConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      case 'file':
        return new FileConnector(
          resolvedConfig,
          options?.httpClient,
          options?.rateLimitConfig,
          options?.retryConfig,
        );
      default:
        throw new ConnectorError(`Unhandled connector class: ${resolution.connectorClass}`, 'INTERNAL_ERROR');
    }
  }

  /** Get all available connector types with descriptions. */
  static getAvailableTypes(): ConnectorTypeInfo[] {
    return [
      {
        type: 'aem',
        name: 'AEM Repository',
        description: 'Connect to AEM 6.x instances via Sling/Package Manager APIs',
        category: 'content',
        platforms: ['AEM 6.x'],
      },
      {
        type: 'analytics',
        name: 'Analytics',
        description: 'Adobe Analytics or Google Analytics extraction',
        category: 'analytics',
        platforms: ['Adobe Analytics', 'Google Analytics 4'],
      },
      {
        type: 'campaign',
        name: 'Campaign',
        description: 'Adobe Campaign or SFMC extraction',
        category: 'marketing',
        platforms: ['Campaign Standard', 'Campaign Classic', 'Campaign v8', 'SFMC'],
      },
      {
        type: 'aep',
        name: 'Adobe Experience Platform',
        description: 'Extract schemas, datasets, segments, and identities from AEP',
        category: 'platform',
        platforms: ['AEP'],
      },
      {
        type: 'commerce',
        name: 'Commerce',
        description: 'Extract product catalogs, orders, and customers',
        category: 'commerce',
        platforms: ['Adobe Commerce', 'Shopify', 'SFCC'],
      },
      {
        type: 'cms',
        name: 'CMS',
        description: 'Extract content from third-party CMS platforms',
        category: 'cms',
        platforms: ['WordPress', 'Sitecore', 'Drupal'],
      },
      {
        type: 'file',
        name: 'File Import',
        description: 'Import data from CSV, JSON, or XML files',
        category: 'file',
        platforms: ['CSV', 'JSON', 'XML'],
      },
    ];
  }

  /** Check if a connector type is supported. */
  static isSupported(type: string): type is ConnectorType {
    return type in TYPE_RESOLUTION;
  }
}
