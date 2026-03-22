/**
 * Adobe Experience Platform (AEP) Connector
 *
 * Extracts XDM schemas, datasets, segments, destinations,
 * and identity namespaces from AEP via Platform APIs.
 */

import type { ConnectorConfig } from '@/types';
import {
  BaseConnector,
  ConnectorError,
  type ConnectorCapability,
  type ExtractionResult,
  type HttpClient,
  type RateLimitConfig,
  type RetryConfig,
} from './base-connector';

// ============================================================
// AEP-specific types
// ============================================================

export interface XDMSchema {
  id: string;
  title: string;
  description: string;
  type: string;
  version: string;
  baseClass: string;
  fieldGroups: XDMFieldGroup[];
  fields: XDMField[];
  behaviors: string[];
  status: 'active' | 'disabled';
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface XDMFieldGroup {
  id: string;
  title: string;
  description: string;
  isCustom: boolean;
}

export interface XDMField {
  path: string;
  title: string;
  type: string;
  required: boolean;
  isArray: boolean;
  isIdentity: boolean;
  identityNamespace: string | null;
  enumValues: string[] | null;
}

export interface AEPDataset {
  id: string;
  name: string;
  description: string;
  schemaRef: string;
  format: string;
  recordCount: number;
  sizeBytes: number;
  isEnabled: boolean;
  isProfileEnabled: boolean;
  isIdentityEnabled: boolean;
  tags: Record<string, string[]>;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface AEPSegment {
  id: string;
  name: string;
  description: string;
  expression: AEPSegmentExpression;
  evaluationMethod: 'batch' | 'streaming' | 'edge';
  profileCount: number;
  status: string;
  mergePolicy: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface AEPSegmentExpression {
  type: 'PQL' | 'AAM' | 'custom';
  format: string;
  value: string;
}

export interface AEPDestination {
  id: string;
  name: string;
  type: string;
  category: 'advertising' | 'cloud_storage' | 'crm' | 'email_marketing' | 'personalization' | 'social' | 'other';
  connectionSpec: string;
  status: 'active' | 'inactive' | 'draft';
  dataflows: AEPDataflow[];
  createdAt: string | null;
}

export interface AEPDataflow {
  id: string;
  name: string;
  sourceDatasets: string[];
  targetConnection: string;
  status: string;
  schedule: string | null;
}

export interface AEPIdentityNamespace {
  id: string;
  code: string;
  name: string;
  description: string;
  type: 'Cookie' | 'Device' | 'CrossDevice' | 'Email' | 'Phone' | 'NonPeople' | 'Custom';
  isSystem: boolean;
  status: 'ACTIVE' | 'DISABLED';
  idType: string;
}

export interface AEPExtractionData {
  schemas: XDMSchema[];
  datasets: AEPDataset[];
  segments: AEPSegment[];
  destinations: AEPDestination[];
  identityNamespaces: AEPIdentityNamespace[];
}

// ============================================================
// AEP API response shapes
// ============================================================

interface SchemaRegistryResponse {
  results: Array<{
    $id: string;
    title: string;
    description?: string;
    type?: string;
    version?: string;
    'meta:class'?: string;
    'meta:extends'?: string[];
    properties?: Record<string, Record<string, unknown>>;
    'meta:status'?: string;
    'meta:createdDate'?: string;
    'meta:alteredDate'?: string;
    'meta:behaviors'?: string[];
  }>;
}

interface CatalogDatasetResponse {
  [key: string]: {
    name: string;
    description?: string;
    schemaRef?: { id: string };
    fileDescription?: { format: string };
    stats?: { recordCount: number; sizeBytes: number };
    tags?: Record<string, string[]>;
    enabled?: boolean;
    profileEnabled?: boolean;
    identityEnabled?: boolean;
    created?: number;
    updated?: number;
  };
}

// ============================================================
// AEP Connector
// ============================================================

export class AEPConnector extends BaseConnector {
  private imsOrgId: string;
  private sandboxName: string;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.imsOrgId = (config.connectionDetails.imsOrgId as string) || '';
    this.sandboxName = (config.connectionDetails.sandboxName as string) || 'prod';
  }

  async connect(): Promise<void> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://platform.adobe.io/data/foundation/schemaregistry/stats',
        headers: this.getAEPHeaders(),
        timeout: 15000,
      });
      if (response.status !== 200) {
        throw new ConnectorError('AEP connection failed', 'AEP_CONNECT_FAILED', response.status);
      }
      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(`AEP connect failed: ${(error as Error).message}`, 'AEP_CONNECT_FAILED');
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://platform.adobe.io/data/foundation/schemaregistry/stats',
        headers: this.getAEPHeaders(),
        timeout: 10000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async extract(): Promise<ExtractionResult<AEPExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    const [schemas, datasets, segments, destinations, identityNamespaces] = await Promise.all([
      this.extractSchemas().catch(e => { warnings.push(`Schemas: ${(e as Error).message}`); return []; }),
      this.extractDatasets().catch(e => { warnings.push(`Datasets: ${(e as Error).message}`); return []; }),
      this.extractSegments().catch(e => { warnings.push(`Segments: ${(e as Error).message}`); return []; }),
      this.extractDestinations().catch(e => { warnings.push(`Destinations: ${(e as Error).message}`); return []; }),
      this.extractIdentities().catch(e => { warnings.push(`Identities: ${(e as Error).message}`); return []; }),
    ]);

    const totalItems = schemas.length + datasets.length + segments.length +
      destinations.length + identityNamespaces.length;

    return {
      data: { schemas, datasets, segments, destinations, identityNamespaces },
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
      { name: 'schemas', description: 'Extract XDM schema definitions', requiresAuth: true },
      { name: 'datasets', description: 'Extract dataset configurations', requiresAuth: true },
      { name: 'segments', description: 'Extract segment definitions and PQL', requiresAuth: true },
      { name: 'destinations', description: 'Extract destination configs and dataflows', requiresAuth: true },
      { name: 'identities', description: 'Extract identity namespace mapping', requiresAuth: true },
    ];
  }

  // ============================================================
  // Public extraction methods
  // ============================================================

  /** Extract all XDM schemas from the schema registry. */
  async extractSchemas(): Promise<XDMSchema[]> {
    this.ensureConnected();
    const response = await this.makeRequest<SchemaRegistryResponse>({
      method: 'GET',
      url: 'https://platform.adobe.io/data/foundation/schemaregistry/tenant/schemas',
      headers: {
        ...this.getAEPHeaders(),
        Accept: 'application/vnd.adobe.xed-full+json; version=1',
      },
      queryParams: { orderby: 'title', limit: '100' },
    });

    const startedAt = Date.now();
    const results = response.data.results || [];
    const schemas: XDMSchema[] = [];

    for (let i = 0; i < results.length; i++) {
      const s = results[i];
      const fields = this.extractXDMFields(s.properties || {});
      const fieldGroups = await this.resolveFieldGroups(s['meta:extends'] || []);

      schemas.push({
        id: s.$id,
        title: s.title,
        description: s.description || '',
        type: s.type || 'object',
        version: s.version || '1',
        baseClass: s['meta:class'] || '',
        fieldGroups,
        fields,
        behaviors: s['meta:behaviors'] || [],
        status: s['meta:status'] === 'disabled' ? 'disabled' : 'active',
        createdAt: s['meta:createdDate'] || null,
        modifiedAt: s['meta:alteredDate'] || null,
      });

      this.reportProgress('schemas', i + 1, results.length, `Schema: ${s.title}`, startedAt);
    }

    return schemas;
  }

  /** Extract all datasets from the Catalog Service. */
  async extractDatasets(): Promise<AEPDataset[]> {
    this.ensureConnected();
    const response = await this.makeRequest<CatalogDatasetResponse>({
      method: 'GET',
      url: 'https://platform.adobe.io/data/foundation/catalog/dataSets',
      headers: this.getAEPHeaders(),
      queryParams: { limit: '100', properties: 'name,description,schemaRef,fileDescription,stats,tags,enabled,profileEnabled,identityEnabled,created,updated' },
    });

    const datasets: AEPDataset[] = [];
    for (const [id, ds] of Object.entries(response.data || {})) {
      datasets.push({
        id,
        name: ds.name || '',
        description: ds.description || '',
        schemaRef: ds.schemaRef?.id || '',
        format: ds.fileDescription?.format || 'parquet',
        recordCount: ds.stats?.recordCount || 0,
        sizeBytes: ds.stats?.sizeBytes || 0,
        isEnabled: ds.enabled !== false,
        isProfileEnabled: ds.profileEnabled || false,
        isIdentityEnabled: ds.identityEnabled || false,
        tags: ds.tags || {},
        createdAt: ds.created ? new Date(ds.created).toISOString() : null,
        modifiedAt: ds.updated ? new Date(ds.updated).toISOString() : null,
      });
    }

    return datasets;
  }

  /** Extract segment definitions from the Segmentation Service. */
  async extractSegments(): Promise<AEPSegment[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ segments: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: 'https://platform.adobe.io/data/core/ups/segment/definitions',
      headers: this.getAEPHeaders(),
      queryParams: { limit: '100' },
    });

    return (response.data.segments || []).map((seg) => ({
      id: (seg.id as string) || '',
      name: (seg.name as string) || '',
      description: (seg.description as string) || '',
      expression: this.parseSegmentExpression(seg.expression as Record<string, unknown>),
      evaluationMethod: this.normalizeEvalMethod((seg.evaluationInfo as Record<string, unknown>)?.segmentationType as string),
      profileCount: (seg.profileCount as number) || 0,
      status: (seg.lifecycleState as string) || 'draft',
      mergePolicy: ((seg.mergePolicy as Record<string, unknown>)?.id as string) || null,
      createdAt: (seg.creationTime as string) || null,
      modifiedAt: (seg.updateTime as string) || null,
    }));
  }

  /** Extract destination configurations and their dataflows. */
  async extractDestinations(): Promise<AEPDestination[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: 'https://platform.adobe.io/data/foundation/flowservice/connections',
      headers: this.getAEPHeaders(),
      queryParams: { property: 'connectionSpec.connectionType==destination', limit: '100' },
    });

    const destinations: AEPDestination[] = [];
    for (const item of (response.data.items || [])) {
      const dataflows = await this.fetchDataflows((item.id as string) || '');
      destinations.push({
        id: (item.id as string) || '',
        name: (item.name as string) || '',
        type: ((item.connectionSpec as Record<string, unknown>)?.name as string) || 'unknown',
        category: this.classifyDestCategory(
          ((item.connectionSpec as Record<string, unknown>)?.category as string) || '',
        ),
        connectionSpec: ((item.connectionSpec as Record<string, unknown>)?.id as string) || '',
        status: (item.state as string) === 'enabled' ? 'active' : 'inactive',
        dataflows,
        createdAt: (item.createdAt as string) || null,
      });
    }

    return destinations;
  }

  /** Extract identity namespaces. */
  async extractIdentities(): Promise<AEPIdentityNamespace[]> {
    this.ensureConnected();
    const response = await this.makeRequest<Array<Record<string, unknown>>>({
      method: 'GET',
      url: 'https://platform.adobe.io/data/core/idnamespace/identities',
      headers: this.getAEPHeaders(),
    });

    return (response.data || []).map((ns) => ({
      id: String((ns.id as number) || ''),
      code: (ns.code as string) || '',
      name: (ns.name as string) || '',
      description: (ns.description as string) || '',
      type: this.normalizeIdentityType((ns.idType as string) || ''),
      isSystem: (ns.custom as boolean) === false,
      status: (ns.status as string) === 'ACTIVE' ? 'ACTIVE' : 'DISABLED',
      idType: (ns.idType as string) || '',
    }));
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected to AEP. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  private getAEPHeaders(): Record<string, string> {
    return {
      ...this.getAuthHeaders(),
      'x-api-key': (this.config.connectionDetails.clientId as string) || '',
      'x-gw-ims-org-id': this.imsOrgId,
      'x-sandbox-name': this.sandboxName,
    };
  }

  private extractXDMFields(
    properties: Record<string, Record<string, unknown>>,
    prefix: string = '',
  ): XDMField[] {
    const fields: XDMField[] = [];
    for (const [name, prop] of Object.entries(properties)) {
      if (name.startsWith('_') || name.startsWith('$')) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      const type = (prop.type as string) || 'string';

      fields.push({
        path,
        title: (prop.title as string) || name,
        type,
        required: (prop['meta:required'] as boolean) || false,
        isArray: type === 'array',
        isIdentity: !!(prop['meta:xdmType'] as string)?.includes('identity'),
        identityNamespace: (prop['meta:xdmType'] as string)?.includes('identity')
          ? (prop['xdm:namespace'] as string) || null
          : null,
        enumValues: (prop.enum as string[]) || null,
      });

      // Recurse into nested objects
      if (type === 'object' && prop.properties) {
        fields.push(
          ...this.extractXDMFields(
            prop.properties as Record<string, Record<string, unknown>>,
            path,
          ),
        );
      }
    }
    return fields;
  }

  private async resolveFieldGroups(extends_: string[]): Promise<XDMFieldGroup[]> {
    const groups: XDMFieldGroup[] = [];
    for (const ref of extends_) {
      // Only resolve tenant field groups (custom ones)
      if (ref.includes('/tenant/')) {
        try {
          const response = await this.makeRequest<{ $id: string; title: string; description: string }>({
            method: 'GET',
            url: `https://platform.adobe.io/data/foundation/schemaregistry/tenant/fieldgroups/${encodeURIComponent(ref)}`,
            headers: {
              ...this.getAEPHeaders(),
              Accept: 'application/vnd.adobe.xed+json; version=1',
            },
          });
          groups.push({
            id: response.data.$id,
            title: response.data.title,
            description: response.data.description || '',
            isCustom: true,
          });
        } catch {
          groups.push({ id: ref, title: ref.split('/').pop() || ref, description: '', isCustom: true });
        }
      } else {
        groups.push({
          id: ref,
          title: ref.split('/').pop() || ref,
          description: '',
          isCustom: false,
        });
      }
    }
    return groups;
  }

  private async fetchDataflows(connectionId: string): Promise<AEPDataflow[]> {
    try {
      const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
        method: 'GET',
        url: 'https://platform.adobe.io/data/foundation/flowservice/flows',
        headers: this.getAEPHeaders(),
        queryParams: { property: `targetConnectionId==${connectionId}`, limit: '50' },
      });

      return (response.data.items || []).map((flow) => ({
        id: (flow.id as string) || '',
        name: (flow.name as string) || '',
        sourceDatasets: ((flow.sourceConnectionIds as string[]) || []),
        targetConnection: connectionId,
        status: (flow.state as string) || 'inactive',
        schedule: ((flow.scheduleParams as Record<string, unknown>)?.cron as string) || null,
      }));
    } catch {
      return [];
    }
  }

  private parseSegmentExpression(expr: Record<string, unknown> | undefined): AEPSegmentExpression {
    if (!expr) {
      return { type: 'PQL', format: 'pql/text', value: '' };
    }
    return {
      type: ((expr.type as string) || 'PQL').toUpperCase() as AEPSegmentExpression['type'],
      format: (expr.format as string) || 'pql/text',
      value: (expr.value as string) || '',
    };
  }

  private normalizeEvalMethod(method: string | undefined): 'batch' | 'streaming' | 'edge' {
    if (!method) return 'batch';
    const m = method.toLowerCase();
    if (m === 'streaming' || m === 'continuous') return 'streaming';
    if (m === 'edge') return 'edge';
    return 'batch';
  }

  private classifyDestCategory(
    category: string,
  ): AEPDestination['category'] {
    const c = category.toLowerCase();
    if (c.includes('advertising') || c.includes('ads')) return 'advertising';
    if (c.includes('cloud') || c.includes('storage')) return 'cloud_storage';
    if (c.includes('crm')) return 'crm';
    if (c.includes('email')) return 'email_marketing';
    if (c.includes('personal')) return 'personalization';
    if (c.includes('social')) return 'social';
    return 'other';
  }

  private normalizeIdentityType(
    idType: string,
  ): AEPIdentityNamespace['type'] {
    const t = idType.toUpperCase();
    if (t === 'COOKIE') return 'Cookie';
    if (t === 'DEVICE') return 'Device';
    if (t === 'CROSS_DEVICE') return 'CrossDevice';
    if (t === 'EMAIL') return 'Email';
    if (t === 'PHONE') return 'Phone';
    if (t === 'NON_PEOPLE') return 'NonPeople';
    return 'Custom';
  }
}
