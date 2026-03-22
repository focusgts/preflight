/**
 * Analytics Connector
 *
 * Supports Adobe Analytics (AA) and Google Analytics (GA4).
 * Extracts report suites, dimensions, metrics, segments,
 * calculated metrics, and implementation details for migration mapping.
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
// Analytics-specific types
// ============================================================

export type AnalyticsPlatform = 'adobe_analytics' | 'google_analytics';

export interface ReportSuite {
  id: string;
  name: string;
  baseUrl: string;
  currency: string;
  timezone: string;
  calendarType: string;
  createdAt: string | null;
}

export interface AnalyticsDimension {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  sourcePlatform: AnalyticsPlatform;
  sourceId: string;
  mappedTargetId: string | null;
}

export interface AnalyticsMetric {
  id: string;
  name: string;
  type: 'standard' | 'calculated' | 'custom';
  formula: string | null;
  polarity: 'positive' | 'negative' | 'neutral';
  category: string;
  sourcePlatform: AnalyticsPlatform;
  mappedTargetId: string | null;
}

export interface AnalyticsSegment {
  id: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  owner: string | null;
  shared: boolean;
  sourcePlatform: AnalyticsPlatform;
}

export interface CalculatedMetric {
  id: string;
  name: string;
  description: string;
  formula: string;
  type: string;
  polarity: 'positive' | 'negative' | 'neutral';
  components: string[];
}

export interface GAProperty {
  id: string;
  name: string;
  propertyType: string;
  createTime: string;
  industryCategory: string;
  timeZone: string;
  currencyCode: string;
}

export interface GAEvent {
  name: string;
  isCustom: boolean;
  parameterCount: number;
  parameters: Array<{ name: string; type: string }>;
}

export interface GAAudience {
  id: string;
  name: string;
  description: string;
  membershipDurationDays: number;
  filterClauses: Record<string, unknown>;
}

export interface VariableMapping {
  sourceId: string;
  sourceName: string;
  sourcePlatform: AnalyticsPlatform;
  targetId: string;
  targetName: string;
  targetType: 'evar' | 'prop' | 'event' | 'dimension' | 'metric';
  confidence: number;
  notes: string;
}

export interface ImplementationAnalysis {
  trackingLibrary: string;
  version: string;
  customizations: string[];
  gtagMappings: Array<{ gtagCall: string; webSdkEquivalent: string }>;
  dataLayerStructure: Record<string, unknown>;
}

export interface AnalyticsExtractionData {
  platform: AnalyticsPlatform;
  reportSuites: ReportSuite[];
  dimensions: AnalyticsDimension[];
  metrics: AnalyticsMetric[];
  segments: AnalyticsSegment[];
  calculatedMetrics: CalculatedMetric[];
  gaProperties: GAProperty[];
  gaEvents: GAEvent[];
  gaAudiences: GAAudience[];
  variableMappings: VariableMapping[];
  implementationAnalysis: ImplementationAnalysis | null;
}

// ============================================================
// Adobe Analytics API response shapes
// ============================================================

interface AAReportSuiteResponse {
  rsid: string;
  site_title: string;
  base_url: string;
  currency: string;
  timezone_zoneinfo: string;
  calendar_type: string;
  creation_date?: string;
}

interface AADimensionResponse {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
}

interface AAMetricResponse {
  id: string;
  name: string;
  type: string;
  polarity: string;
  category: string;
}

interface AASegmentResponse {
  id: string;
  name: string;
  description: string;
  definition: Record<string, unknown>;
  owner: { name: string } | null;
  shares: Array<unknown>;
}

interface AACalcMetricResponse {
  id: string;
  name: string;
  description: string;
  formula: Record<string, unknown>;
  type: string;
  polarity: string;
}

// ============================================================
// Analytics Connector
// ============================================================

export class AnalyticsConnector extends BaseConnector {
  private platform: AnalyticsPlatform;
  private globalCompanyId: string;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.platform = (config.connectionDetails.platform as AnalyticsPlatform) || 'adobe_analytics';
    this.globalCompanyId = (config.connectionDetails.globalCompanyId as string) || '';
  }

  async connect(): Promise<void> {
    try {
      if (this.platform === 'adobe_analytics') {
        await this.connectAdobeAnalytics();
      } else {
        await this.connectGoogleAnalytics();
      }
      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(`Analytics connect failed: ${(error as Error).message}`, 'ANALYTICS_CONNECT_FAILED');
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.platform === 'adobe_analytics') {
        const response = await this.makeRequest({
          method: 'GET',
          url: this.buildAAUrl('/discovery/me'),
          headers: this.getAAHeaders(),
          timeout: 10000,
        });
        return response.status === 200;
      } else {
        const response = await this.makeRequest({
          method: 'GET',
          url: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
          headers: this.getAuthHeaders(),
          timeout: 10000,
        });
        return response.status === 200;
      }
    } catch {
      return false;
    }
  }

  async extract(): Promise<ExtractionResult<AnalyticsExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    let reportSuites: ReportSuite[] = [];
    let dimensions: AnalyticsDimension[] = [];
    let metrics: AnalyticsMetric[] = [];
    let segments: AnalyticsSegment[] = [];
    let calculatedMetrics: CalculatedMetric[] = [];
    let gaProperties: GAProperty[] = [];
    let gaEvents: GAEvent[] = [];
    let gaAudiences: GAAudience[] = [];

    if (this.platform === 'adobe_analytics') {
      [reportSuites, dimensions, metrics, segments, calculatedMetrics] = await Promise.all([
        this.extractReportSuites().catch(e => { warnings.push(`ReportSuites: ${(e as Error).message}`); return []; }),
        this.extractDimensions().catch(e => { warnings.push(`Dimensions: ${(e as Error).message}`); return []; }),
        this.extractMetrics().catch(e => { warnings.push(`Metrics: ${(e as Error).message}`); return []; }),
        this.extractSegments().catch(e => { warnings.push(`Segments: ${(e as Error).message}`); return []; }),
        this.extractCalculatedMetrics().catch(e => { warnings.push(`CalcMetrics: ${(e as Error).message}`); return []; }),
      ]);
    } else {
      [gaProperties, gaEvents, gaAudiences] = await Promise.all([
        this.extractGAProperties().catch(e => { warnings.push(`Properties: ${(e as Error).message}`); return []; }),
        this.extractGAEvents().catch(e => { warnings.push(`Events: ${(e as Error).message}`); return []; }),
        this.extractGAAudiences().catch(e => { warnings.push(`Audiences: ${(e as Error).message}`); return []; }),
      ]);
      // Map GA dimensions/metrics to the common format
      dimensions = this.mapGADimensions(gaProperties);
      metrics = this.mapGAMetrics(gaEvents);
    }

    const variableMappings = this.generateVariableMappings(dimensions, metrics);
    const totalItems = reportSuites.length + dimensions.length + metrics.length +
      segments.length + calculatedMetrics.length + gaProperties.length + gaEvents.length;

    return {
      data: {
        platform: this.platform,
        reportSuites,
        dimensions,
        metrics,
        segments,
        calculatedMetrics,
        gaProperties,
        gaEvents,
        gaAudiences,
        variableMappings,
        implementationAnalysis: null,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        itemCount: totalItems,
        warnings,
      },
    };
  }

  getCapabilities(): ConnectorCapability[] {
    if (this.platform === 'adobe_analytics') {
      return [
        { name: 'report_suites', description: 'Extract report suite configurations', requiresAuth: true },
        { name: 'dimensions', description: 'Extract eVars, props, and dimensions', requiresAuth: true },
        { name: 'metrics', description: 'Extract events and metrics', requiresAuth: true },
        { name: 'segments', description: 'Extract segment definitions', requiresAuth: true },
        { name: 'calculated_metrics', description: 'Extract calculated metric formulas', requiresAuth: true },
      ];
    }
    return [
      { name: 'properties', description: 'Extract GA4 properties', requiresAuth: true },
      { name: 'events', description: 'Extract custom events', requiresAuth: true },
      { name: 'audiences', description: 'Extract audience definitions', requiresAuth: true },
      { name: 'variable_mapping', description: 'Map GA dimensions to eVars/props', requiresAuth: false },
    ];
  }

  // ============================================================
  // Adobe Analytics extraction
  // ============================================================

  /** Extract all report suites from Adobe Analytics. */
  async extractReportSuites(): Promise<ReportSuite[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ content: AAReportSuiteResponse[] }>({
      method: 'GET',
      url: this.buildAAUrl('/collections/suites'),
      headers: this.getAAHeaders(),
      queryParams: { limit: '100', page: '0' },
    });

    return (response.data.content || []).map((rs) => ({
      id: rs.rsid,
      name: rs.site_title,
      baseUrl: rs.base_url,
      currency: rs.currency,
      timezone: rs.timezone_zoneinfo,
      calendarType: rs.calendar_type,
      createdAt: rs.creation_date || null,
    }));
  }

  /** Extract dimensions for the configured report suite. */
  async extractDimensions(rsid?: string): Promise<AnalyticsDimension[]> {
    this.ensureConnected();
    const reportSuiteId = rsid || (this.config.connectionDetails.reportSuiteId as string);
    if (!reportSuiteId) throw new ConnectorError('No report suite ID configured', 'MISSING_RSID');

    const response = await this.makeRequest<AADimensionResponse[]>({
      method: 'GET',
      url: this.buildAAUrl(`/dimensions`),
      headers: this.getAAHeaders(),
      queryParams: { rsid: reportSuiteId },
    });

    return (response.data || []).map((dim) => ({
      id: dim.id,
      name: dim.name,
      type: dim.type,
      category: dim.category,
      description: dim.description,
      sourcePlatform: 'adobe_analytics' as const,
      sourceId: dim.id,
      mappedTargetId: null,
    }));
  }

  /** Extract metrics for the configured report suite. */
  async extractMetrics(rsid?: string): Promise<AnalyticsMetric[]> {
    this.ensureConnected();
    const reportSuiteId = rsid || (this.config.connectionDetails.reportSuiteId as string);
    if (!reportSuiteId) throw new ConnectorError('No report suite ID configured', 'MISSING_RSID');

    const response = await this.makeRequest<AAMetricResponse[]>({
      method: 'GET',
      url: this.buildAAUrl(`/metrics`),
      headers: this.getAAHeaders(),
      queryParams: { rsid: reportSuiteId },
    });

    return (response.data || []).map((m) => ({
      id: m.id,
      name: m.name,
      type: this.classifyMetricType(m.type),
      formula: null,
      polarity: this.normalizePolarity(m.polarity),
      category: m.category,
      sourcePlatform: 'adobe_analytics' as const,
      mappedTargetId: null,
    }));
  }

  /** Extract segment definitions. */
  async extractSegments(): Promise<AnalyticsSegment[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ content: AASegmentResponse[] }>({
      method: 'GET',
      url: this.buildAAUrl('/segments'),
      headers: this.getAAHeaders(),
      queryParams: {
        includeType: 'all',
        limit: '100',
      },
    });

    return (response.data.content || []).map((seg) => ({
      id: seg.id,
      name: seg.name,
      description: seg.description,
      definition: seg.definition,
      owner: seg.owner?.name || null,
      shared: (seg.shares || []).length > 0,
      sourcePlatform: 'adobe_analytics' as const,
    }));
  }

  /** Extract calculated metric definitions. */
  async extractCalculatedMetrics(): Promise<CalculatedMetric[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ content: AACalcMetricResponse[] }>({
      method: 'GET',
      url: this.buildAAUrl('/calculatedmetrics'),
      headers: this.getAAHeaders(),
      queryParams: { limit: '100' },
    });

    return (response.data.content || []).map((cm) => ({
      id: cm.id,
      name: cm.name,
      description: cm.description,
      formula: JSON.stringify(cm.formula),
      type: cm.type,
      polarity: this.normalizePolarity(cm.polarity),
      components: this.extractFormulaComponents(cm.formula),
    }));
  }

  // ============================================================
  // Google Analytics extraction
  // ============================================================

  /** Extract GA4 properties. */
  private async extractGAProperties(): Promise<GAProperty[]> {
    const accountId = this.config.connectionDetails.accountId as string;
    const response = await this.makeRequest<{ properties: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `https://analyticsadmin.googleapis.com/v1beta/properties`,
      headers: this.getAuthHeaders(),
      queryParams: { filter: `parent:accounts/${accountId}` },
    });

    return (response.data.properties || []).map((p) => ({
      id: (p.name as string) || '',
      name: (p.displayName as string) || '',
      propertyType: (p.propertyType as string) || '',
      createTime: (p.createTime as string) || '',
      industryCategory: (p.industryCategory as string) || '',
      timeZone: (p.timeZone as string) || '',
      currencyCode: (p.currencyCode as string) || '',
    }));
  }

  /** Extract GA4 custom events. */
  private async extractGAEvents(): Promise<GAEvent[]> {
    const propertyId = this.config.connectionDetails.propertyId as string;
    if (!propertyId) return [];

    const response = await this.makeRequest<{ customEvents: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `https://analyticsadmin.googleapis.com/v1beta/${propertyId}/customDimensions`,
      headers: this.getAuthHeaders(),
    });

    return (response.data.customEvents || []).map((evt) => ({
      name: (evt.eventName as string) || '',
      isCustom: true,
      parameterCount: ((evt.parameters as unknown[]) || []).length,
      parameters: ((evt.parameters as Array<Record<string, string>>) || []).map((p) => ({
        name: p.name || '',
        type: p.type || 'string',
      })),
    }));
  }

  /** Extract GA4 audiences. */
  private async extractGAAudiences(): Promise<GAAudience[]> {
    const propertyId = this.config.connectionDetails.propertyId as string;
    if (!propertyId) return [];

    const response = await this.makeRequest<{ audiences: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `https://analyticsadmin.googleapis.com/v1beta/${propertyId}/audiences`,
      headers: this.getAuthHeaders(),
    });

    return (response.data.audiences || []).map((aud) => ({
      id: (aud.name as string) || '',
      name: (aud.displayName as string) || '',
      description: (aud.description as string) || '',
      membershipDurationDays: (aud.membershipDurationDays as number) || 30,
      filterClauses: (aud.filterClauses as Record<string, unknown>) || {},
    }));
  }

  // ============================================================
  // Variable mapping (GA -> Adobe)
  // ============================================================

  /**
   * Generate variable mappings from GA dimensions/events
   * to Adobe Analytics eVars/props/events.
   */
  private generateVariableMappings(
    dimensions: AnalyticsDimension[],
    metrics: AnalyticsMetric[],
  ): VariableMapping[] {
    const mappings: VariableMapping[] = [];

    /** Well-known GA -> AA dimension mappings. */
    const knownDimensionMappings: Record<string, { targetId: string; targetName: string; targetType: 'evar' | 'prop' | 'dimension' }> = {
      'ga:pagePath': { targetId: 'variables/page', targetName: 'Page', targetType: 'dimension' },
      'ga:pageTitle': { targetId: 'variables/pagetitle', targetName: 'Page Title', targetType: 'dimension' },
      'ga:source': { targetId: 'variables/referringdomain', targetName: 'Referring Domain', targetType: 'dimension' },
      'ga:medium': { targetId: 'variables/trackingcode', targetName: 'Tracking Code', targetType: 'dimension' },
      'ga:campaign': { targetId: 'variables/campaign', targetName: 'Campaign', targetType: 'dimension' },
      'ga:country': { targetId: 'variables/geocountry', targetName: 'Country', targetType: 'dimension' },
      'ga:city': { targetId: 'variables/geocity', targetName: 'City', targetType: 'dimension' },
      'ga:browser': { targetId: 'variables/browser', targetName: 'Browser', targetType: 'dimension' },
      'ga:deviceCategory': { targetId: 'variables/mobiledevicetype', targetName: 'Mobile Device Type', targetType: 'dimension' },
      'ga:language': { targetId: 'variables/language', targetName: 'Language', targetType: 'dimension' },
    };

    for (const dim of dimensions) {
      const known = knownDimensionMappings[dim.sourceId];
      if (known) {
        mappings.push({
          sourceId: dim.sourceId,
          sourceName: dim.name,
          sourcePlatform: dim.sourcePlatform,
          targetId: known.targetId,
          targetName: known.targetName,
          targetType: known.targetType,
          confidence: 0.95,
          notes: 'Standard mapping',
        });
      } else if (dim.sourceId.startsWith('ga:dimension')) {
        const idx = dim.sourceId.replace('ga:dimension', '');
        mappings.push({
          sourceId: dim.sourceId,
          sourceName: dim.name,
          sourcePlatform: dim.sourcePlatform,
          targetId: `variables/evar${idx}`,
          targetName: `eVar${idx}`,
          targetType: 'evar',
          confidence: 0.5,
          notes: 'Custom dimension mapped to eVar by index',
        });
      }
    }

    const knownMetricMappings: Record<string, { targetId: string; targetName: string }> = {
      'ga:pageviews': { targetId: 'metrics/pageviews', targetName: 'Page Views' },
      'ga:sessions': { targetId: 'metrics/visits', targetName: 'Visits' },
      'ga:users': { targetId: 'metrics/visitors', targetName: 'Unique Visitors' },
      'ga:bounceRate': { targetId: 'metrics/bouncerate', targetName: 'Bounce Rate' },
      'ga:avgSessionDuration': { targetId: 'metrics/averagetimespentonsite', targetName: 'Avg Time on Site' },
    };

    for (const metric of metrics) {
      const known = knownMetricMappings[metric.id];
      if (known) {
        mappings.push({
          sourceId: metric.id,
          sourceName: metric.name,
          sourcePlatform: metric.sourcePlatform,
          targetId: known.targetId,
          targetName: known.targetName,
          targetType: 'metric',
          confidence: 0.95,
          notes: 'Standard mapping',
        });
      }
    }

    return mappings;
  }

  /** Map GA properties into the generic dimension format. */
  private mapGADimensions(properties: GAProperty[]): AnalyticsDimension[] {
    const standardDimensions = [
      'ga:pagePath', 'ga:pageTitle', 'ga:source', 'ga:medium',
      'ga:campaign', 'ga:country', 'ga:city', 'ga:browser',
      'ga:deviceCategory', 'ga:language',
    ];
    return standardDimensions.map((id) => ({
      id,
      name: id.replace('ga:', ''),
      type: 'string',
      category: 'standard',
      description: `GA standard dimension: ${id.replace('ga:', '')}`,
      sourcePlatform: 'google_analytics' as const,
      sourceId: id,
      mappedTargetId: null,
    }));
  }

  /** Map GA events to the generic metric format. */
  private mapGAMetrics(events: GAEvent[]): AnalyticsMetric[] {
    const standardMetrics: AnalyticsMetric[] = [
      { id: 'ga:pageviews', name: 'Pageviews', type: 'standard', formula: null, polarity: 'positive', category: 'standard', sourcePlatform: 'google_analytics', mappedTargetId: null },
      { id: 'ga:sessions', name: 'Sessions', type: 'standard', formula: null, polarity: 'positive', category: 'standard', sourcePlatform: 'google_analytics', mappedTargetId: null },
      { id: 'ga:users', name: 'Users', type: 'standard', formula: null, polarity: 'positive', category: 'standard', sourcePlatform: 'google_analytics', mappedTargetId: null },
      { id: 'ga:bounceRate', name: 'Bounce Rate', type: 'standard', formula: null, polarity: 'negative', category: 'standard', sourcePlatform: 'google_analytics', mappedTargetId: null },
    ];

    const customMetrics: AnalyticsMetric[] = events.map((evt) => ({
      id: `event:${evt.name}`,
      name: evt.name,
      type: 'custom' as const,
      formula: null,
      polarity: 'neutral' as const,
      category: 'custom_event',
      sourcePlatform: 'google_analytics' as const,
      mappedTargetId: null,
    }));

    return [...standardMetrics, ...customMetrics];
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  private async connectAdobeAnalytics(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildAAUrl('/discovery/me'),
      headers: this.getAAHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Failed to connect to Adobe Analytics', 'AA_CONNECT_FAILED', response.status);
    }
  }

  private async connectGoogleAnalytics(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Failed to connect to Google Analytics', 'GA_CONNECT_FAILED', response.status);
    }
  }

  private buildAAUrl(path: string): string {
    return `https://analytics.adobe.io/api/${this.globalCompanyId}${path}`;
  }

  private getAAHeaders(): Record<string, string> {
    return {
      ...this.getAuthHeaders(),
      'x-api-key': (this.config.connectionDetails.clientId as string) || '',
      'x-proxy-global-company-id': this.globalCompanyId,
    };
  }

  private classifyMetricType(type: string): 'standard' | 'calculated' | 'custom' {
    if (type === 'calculated') return 'calculated';
    if (type.startsWith('custom') || type.startsWith('event')) return 'custom';
    return 'standard';
  }

  private normalizePolarity(polarity: string): 'positive' | 'negative' | 'neutral' {
    if (polarity === 'positive' || polarity === 'negative') return polarity;
    return 'neutral';
  }

  private extractFormulaComponents(formula: Record<string, unknown>): string[] {
    const components: string[] = [];
    const walk = (obj: unknown): void => {
      if (!obj || typeof obj !== 'object') return;
      const record = obj as Record<string, unknown>;
      if (record.id && typeof record.id === 'string') {
        components.push(record.id);
      }
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else if (typeof value === 'object') {
          walk(value);
        }
      }
    };
    walk(formula);
    return components;
  }
}
