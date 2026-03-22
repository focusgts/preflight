/**
 * Campaign Connector
 *
 * Supports Adobe Campaign Standard, Campaign Classic, Campaign v8,
 * and Salesforce Marketing Cloud (SFMC). Extracts profiles, workflows,
 * deliveries, templates, data extensions, and journeys.
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
// Campaign-specific types
// ============================================================

export type CampaignPlatform = 'campaign_standard' | 'campaign_classic' | 'campaign_v8' | 'sfmc';

export interface CampaignProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
  subscriptions: string[];
  createdAt: string | null;
  lastModified: string | null;
}

export interface CampaignWorkflow {
  id: string;
  name: string;
  label: string;
  type: 'technical' | 'targeting' | 'campaign';
  status: 'started' | 'paused' | 'stopped' | 'editing' | 'unknown';
  activities: CampaignActivity[];
  schedule: string | null;
  lastRun: string | null;
  createdAt: string | null;
}

export interface CampaignActivity {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  transitions: string[];
  properties: Record<string, unknown>;
}

export interface CampaignDelivery {
  id: string;
  name: string;
  label: string;
  channel: 'email' | 'sms' | 'push' | 'dm' | 'inApp';
  status: string;
  template: string | null;
  subject: string | null;
  sentCount: number;
  openRate: number | null;
  clickRate: number | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  label: string;
  type: 'delivery' | 'workflow' | 'landing_page';
  channel: string | null;
  htmlContent: string | null;
  properties: Record<string, unknown>;
}

export interface SFMCDataExtension {
  id: string;
  name: string;
  customerKey: string;
  fields: SFMCField[];
  rowCount: number;
  isSendable: boolean;
  sendableField: string | null;
  createdAt: string | null;
}

export interface SFMCField {
  name: string;
  type: string;
  maxLength: number | null;
  isPrimaryKey: boolean;
  isRequired: boolean;
  defaultValue: string | null;
}

export interface SFMCJourney {
  id: string;
  name: string;
  status: string;
  version: number;
  entrySource: string;
  activities: Array<{
    id: string;
    key: string;
    type: string;
    name: string;
  }>;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface CampaignExtractionData {
  platform: CampaignPlatform;
  profiles: CampaignProfile[];
  profileCount: number;
  workflows: CampaignWorkflow[];
  deliveries: CampaignDelivery[];
  templates: CampaignTemplate[];
  dataExtensions: SFMCDataExtension[];
  journeys: SFMCJourney[];
}

// ============================================================
// Campaign Connector
// ============================================================

export class CampaignConnector extends BaseConnector {
  private platform: CampaignPlatform;
  private sfmcAuthToken: string | null = null;
  private sfmcRestBaseUrl: string | null = null;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.platform = (config.connectionDetails.platform as CampaignPlatform) || 'campaign_standard';
  }

  async connect(): Promise<void> {
    try {
      switch (this.platform) {
        case 'campaign_standard':
          await this.connectCampaignStandard();
          break;
        case 'campaign_classic':
        case 'campaign_v8':
          await this.connectCampaignClassic();
          break;
        case 'sfmc':
          await this.connectSFMC();
          break;
      }
      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(`Campaign connect failed: ${(error as Error).message}`, 'CAMPAIGN_CONNECT_FAILED');
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
    this.sfmcAuthToken = null;
    this.sfmcRestBaseUrl = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async extract(): Promise<ExtractionResult<CampaignExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    let profiles: CampaignProfile[] = [];
    let profileCount = 0;
    let workflows: CampaignWorkflow[] = [];
    let deliveries: CampaignDelivery[] = [];
    let templates: CampaignTemplate[] = [];
    let dataExtensions: SFMCDataExtension[] = [];
    let journeys: SFMCJourney[] = [];

    if (this.platform === 'sfmc') {
      [dataExtensions, journeys, templates] = await Promise.all([
        this.extractSFMCDataExtensions().catch(e => { warnings.push(`DEs: ${(e as Error).message}`); return []; }),
        this.extractSFMCJourneys().catch(e => { warnings.push(`Journeys: ${(e as Error).message}`); return []; }),
        this.extractTemplates().catch(e => { warnings.push(`Templates: ${(e as Error).message}`); return []; }),
      ]);
    } else {
      const results = await Promise.all([
        this.extractProfiles(100).catch(e => { warnings.push(`Profiles: ${(e as Error).message}`); return { items: [], count: 0 }; }),
        this.extractWorkflows().catch(e => { warnings.push(`Workflows: ${(e as Error).message}`); return []; }),
        this.extractDeliveries().catch(e => { warnings.push(`Deliveries: ${(e as Error).message}`); return []; }),
        this.extractTemplates().catch(e => { warnings.push(`Templates: ${(e as Error).message}`); return []; }),
      ]);
      profiles = results[0].items;
      profileCount = results[0].count;
      workflows = results[1];
      deliveries = results[2];
      templates = results[3];
    }

    const totalItems = profiles.length + workflows.length + deliveries.length +
      templates.length + dataExtensions.length + journeys.length;

    return {
      data: {
        platform: this.platform,
        profiles,
        profileCount,
        workflows,
        deliveries,
        templates,
        dataExtensions,
        journeys,
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
    const base: ConnectorCapability[] = [
      { name: 'profiles', description: 'Extract profile/subscriber data', requiresAuth: true },
      { name: 'workflows', description: 'Extract workflow definitions', requiresAuth: true },
      { name: 'deliveries', description: 'Extract delivery/send history', requiresAuth: true },
      { name: 'templates', description: 'Extract email/workflow templates', requiresAuth: true },
    ];
    if (this.platform === 'sfmc') {
      base.push(
        { name: 'data_extensions', description: 'Extract SFMC data extensions', requiresAuth: true },
        { name: 'journeys', description: 'Extract Journey Builder automations', requiresAuth: true },
      );
    }
    return base;
  }

  // ============================================================
  // Public extraction methods
  // ============================================================

  /**
   * Extract profiles. Returns a sample and total count
   * to avoid pulling entire subscriber lists.
   */
  async extractProfiles(sampleSize: number = 100): Promise<{ items: CampaignProfile[]; count: number }> {
    this.ensureConnected();
    if (this.platform === 'sfmc') {
      return this.extractSFMCProfiles(sampleSize);
    }
    return this.extractACSProfiles(sampleSize);
  }

  /** Extract workflow definitions. */
  async extractWorkflows(): Promise<CampaignWorkflow[]> {
    this.ensureConnected();
    if (this.platform === 'campaign_classic' || this.platform === 'campaign_v8') {
      return this.extractClassicWorkflows();
    }
    return this.extractACSWorkflows();
  }

  /** Extract delivery history and stats. */
  async extractDeliveries(): Promise<CampaignDelivery[]> {
    this.ensureConnected();
    if (this.platform === 'campaign_classic' || this.platform === 'campaign_v8') {
      return this.extractClassicDeliveries();
    }
    return this.extractACSDeliveries();
  }

  /** Extract templates for deliveries, workflows, and landing pages. */
  async extractTemplates(): Promise<CampaignTemplate[]> {
    this.ensureConnected();
    if (this.platform === 'sfmc') {
      return this.extractSFMCTemplates();
    }
    return this.extractACSTemplates();
  }

  // ============================================================
  // Campaign Standard (ACS) REST API
  // ============================================================

  private async extractACSProfiles(sampleSize: number): Promise<{ items: CampaignProfile[]; count: number }> {
    const countResponse = await this.makeRequest<{ count: number }>({
      method: 'GET',
      url: this.buildUrl('/profileAndServicesExt/profile'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: '0' },
    });

    const response = await this.makeRequest<{ content: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/profileAndServicesExt/profile'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: String(sampleSize), _lineStart: '0' },
    });

    const profiles = (response.data.content || []).map((p) => this.mapACSProfile(p));
    return { items: profiles, count: countResponse.data.count || profiles.length };
  }

  private async extractACSWorkflows(): Promise<CampaignWorkflow[]> {
    const response = await this.makeRequest<{ content: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/workflow'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: '200' },
    });

    return (response.data.content || []).map((wf) => ({
      id: (wf.PKey as string) || '',
      name: (wf.internalName as string) || '',
      label: (wf.label as string) || '',
      type: this.classifyWorkflowType((wf.type as string) || ''),
      status: this.normalizeWorkflowStatus((wf.state as string) || ''),
      activities: this.mapActivities((wf.activities as Record<string, unknown>) || {}),
      schedule: (wf.schedule as string) || null,
      lastRun: (wf.lastRun as string) || null,
      createdAt: (wf.created as string) || null,
    }));
  }

  private async extractACSDeliveries(): Promise<CampaignDelivery[]> {
    const response = await this.makeRequest<{ content: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/profileAndServicesExt/delivery'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: '200' },
    });

    return (response.data.content || []).map((d) => ({
      id: (d.PKey as string) || '',
      name: (d.internalName as string) || '',
      label: (d.label as string) || '',
      channel: this.normalizeChannel((d.channel as string) || ''),
      status: (d.state as string) || 'unknown',
      template: (d.template as string) || null,
      subject: (d.subject as string) || null,
      sentCount: (d.sentCount as number) || 0,
      openRate: (d.openRate as number) || null,
      clickRate: (d.clickRate as number) || null,
      createdAt: (d.created as string) || null,
      sentAt: (d.sentAt as string) || null,
    }));
  }

  private async extractACSTemplates(): Promise<CampaignTemplate[]> {
    const response = await this.makeRequest<{ content: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/profileAndServicesExt/contentTemplate'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: '200' },
    });

    return (response.data.content || []).map((t) => ({
      id: (t.PKey as string) || '',
      name: (t.internalName as string) || '',
      label: (t.label as string) || '',
      type: 'delivery' as const,
      channel: (t.channel as string) || null,
      htmlContent: (t.htmlContent as string) || null,
      properties: t,
    }));
  }

  // ============================================================
  // Campaign Classic / v8 (SOAP-based, via JSON gateway)
  // ============================================================

  private async extractClassicWorkflows(): Promise<CampaignWorkflow[]> {
    const response = await this.makeRequest<{ entities: Array<Record<string, unknown>> }>({
      method: 'POST',
      url: this.buildUrl('/nl/jsp/soaprouter.jsp'),
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        'SOAPAction': 'xtk:queryDef#ExecuteQuery',
      },
      body: {
        queryDef: {
          schema: 'xtk:workflow',
          operation: 'select',
          lineCount: 200,
          select: { node: [
            { expr: '@id' }, { expr: '@internalName' }, { expr: '@label' },
            { expr: '@state' }, { expr: '@type' },
          ]},
        },
      },
    });

    return (response.data.entities || []).map((wf) => ({
      id: String((wf['@id'] as number) || ''),
      name: (wf['@internalName'] as string) || '',
      label: (wf['@label'] as string) || '',
      type: this.classifyWorkflowType(String((wf['@type'] as number) || '')),
      status: this.normalizeWorkflowStatus(String((wf['@state'] as number) || '')),
      activities: [],
      schedule: null,
      lastRun: null,
      createdAt: null,
    }));
  }

  private async extractClassicDeliveries(): Promise<CampaignDelivery[]> {
    const response = await this.makeRequest<{ entities: Array<Record<string, unknown>> }>({
      method: 'POST',
      url: this.buildUrl('/nl/jsp/soaprouter.jsp'),
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        'SOAPAction': 'xtk:queryDef#ExecuteQuery',
      },
      body: {
        queryDef: {
          schema: 'nms:delivery',
          operation: 'select',
          lineCount: 200,
          select: { node: [
            { expr: '@id' }, { expr: '@internalName' }, { expr: '@label' },
            { expr: '@state' }, { expr: '@channel' }, { expr: '@subject' },
          ]},
        },
      },
    });

    return (response.data.entities || []).map((d) => ({
      id: String((d['@id'] as number) || ''),
      name: (d['@internalName'] as string) || '',
      label: (d['@label'] as string) || '',
      channel: this.normalizeChannel(String((d['@channel'] as number) || '')),
      status: String((d['@state'] as number) || 'unknown'),
      template: null,
      subject: (d['@subject'] as string) || null,
      sentCount: 0,
      openRate: null,
      clickRate: null,
      createdAt: null,
      sentAt: null,
    }));
  }

  // ============================================================
  // SFMC REST API
  // ============================================================

  private async connectSFMC(): Promise<void> {
    const authUrl = (this.config.connectionDetails.authUrl as string) ||
      'https://mc.exacttarget.com/v2/token';
    const response = await this.makeRequest<{
      access_token: string;
      rest_instance_url: string;
    }>({
      method: 'POST',
      url: authUrl,
      body: {
        grant_type: 'client_credentials',
        client_id: this.config.connectionDetails.clientId,
        client_secret: this.config.connectionDetails.clientSecret,
      },
    });

    this.sfmcAuthToken = response.data.access_token;
    this.sfmcRestBaseUrl = response.data.rest_instance_url?.replace(/\/+$/, '') || '';
  }

  private getSFMCHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.sfmcAuthToken}` };
  }

  private async extractSFMCProfiles(sampleSize: number): Promise<{ items: CampaignProfile[]; count: number }> {
    const response = await this.makeRequest<{ count: number; items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${this.sfmcRestBaseUrl}/contacts/v1/contacts`,
      headers: this.getSFMCHeaders(),
      queryParams: { $pageSize: String(sampleSize) },
    });

    const items = (response.data.items || []).map((p) => ({
      id: (p.contactKey as string) || '',
      email: (p.emailAddress as string) || null,
      firstName: (p.firstName as string) || null,
      lastName: (p.lastName as string) || null,
      customFields: p,
      subscriptions: [],
      createdAt: (p.createdDate as string) || null,
      lastModified: (p.modifiedDate as string) || null,
    }));

    return { items, count: response.data.count || items.length };
  }

  /** Extract SFMC data extensions with field schemas. */
  async extractSFMCDataExtensions(): Promise<SFMCDataExtension[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${this.sfmcRestBaseUrl}/data/v1/customobjectdata`,
      headers: this.getSFMCHeaders(),
      queryParams: { $pageSize: '100' },
    });

    const extensions: SFMCDataExtension[] = [];
    for (const de of (response.data.items || [])) {
      const fields = await this.extractDEFields((de.key as string) || '');
      extensions.push({
        id: (de.id as string) || '',
        name: (de.name as string) || '',
        customerKey: (de.key as string) || '',
        fields,
        rowCount: (de.rowCount as number) || 0,
        isSendable: (de.isSendable as boolean) || false,
        sendableField: (de.sendableField as string) || null,
        createdAt: (de.createdDate as string) || null,
      });
    }
    return extensions;
  }

  private async extractDEFields(deKey: string): Promise<SFMCField[]> {
    try {
      const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
        method: 'GET',
        url: `${this.sfmcRestBaseUrl}/data/v1/customobjectdata/key/${deKey}/fields`,
        headers: this.getSFMCHeaders(),
      });

      return (response.data.items || []).map((f) => ({
        name: (f.name as string) || '',
        type: (f.fieldType as string) || 'Text',
        maxLength: (f.maxLength as number) || null,
        isPrimaryKey: (f.isPrimaryKey as boolean) || false,
        isRequired: (f.isRequired as boolean) || false,
        defaultValue: (f.defaultValue as string) || null,
      }));
    } catch {
      return [];
    }
  }

  /** Extract SFMC Journey Builder automations. */
  async extractSFMCJourneys(): Promise<SFMCJourney[]> {
    this.ensureConnected();
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${this.sfmcRestBaseUrl}/interaction/v1/interactions`,
      headers: this.getSFMCHeaders(),
      queryParams: { $pageSize: '100' },
    });

    return (response.data.items || []).map((j) => ({
      id: (j.id as string) || '',
      name: (j.name as string) || '',
      status: (j.status as string) || 'Draft',
      version: (j.version as number) || 1,
      entrySource: ((j.triggers as Array<Record<string, unknown>>) || [])[0]?.type as string || 'unknown',
      activities: ((j.activities as Array<Record<string, unknown>>) || []).map((a) => ({
        id: (a.id as string) || '',
        key: (a.key as string) || '',
        type: (a.type as string) || '',
        name: (a.name as string) || '',
      })),
      createdAt: (j.createdDate as string) || null,
      modifiedAt: (j.modifiedDate as string) || null,
    }));
  }

  private async extractSFMCTemplates(): Promise<CampaignTemplate[]> {
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: `${this.sfmcRestBaseUrl}/asset/v1/content/assets`,
      headers: this.getSFMCHeaders(),
      queryParams: {
        '$filter': "assetType.name eq 'templatebasedemail'",
        '$pageSize': '100',
      },
    });

    return (response.data.items || []).map((t) => ({
      id: String((t.id as number) || ''),
      name: (t.name as string) || '',
      label: (t.name as string) || '',
      type: 'delivery' as const,
      channel: 'email',
      htmlContent: ((t.views as Record<string, Record<string, string>>) || {}).html?.content || null,
      properties: t,
    }));
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  private async connectCampaignStandard(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/profileAndServices/profile'),
      headers: this.getACSHeaders(),
      queryParams: { _lineCount: '1' },
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Campaign Standard connect failed', 'ACS_CONNECT_FAILED', response.status);
    }
  }

  private async connectCampaignClassic(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/nl/jsp/ping.jsp'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Campaign Classic connect failed', 'ACC_CONNECT_FAILED', response.status);
    }
  }

  private getACSHeaders(): Record<string, string> {
    return {
      ...this.getAuthHeaders(),
      'Cache-Control': 'no-cache',
    };
  }

  private mapACSProfile(p: Record<string, unknown>): CampaignProfile {
    return {
      id: (p.PKey as string) || '',
      email: (p.email as string) || null,
      firstName: (p.firstName as string) || null,
      lastName: (p.lastName as string) || null,
      customFields: p,
      subscriptions: ((p.subscriptions as Record<string, unknown>)?.content as string[]) || [],
      createdAt: (p.created as string) || null,
      lastModified: (p.lastModified as string) || null,
    };
  }

  private classifyWorkflowType(type: string): 'technical' | 'targeting' | 'campaign' {
    const t = type.toLowerCase();
    if (t === 'technical' || t === '1') return 'technical';
    if (t === 'targeting' || t === '0') return 'targeting';
    return 'campaign';
  }

  private normalizeWorkflowStatus(state: string): 'started' | 'paused' | 'stopped' | 'editing' | 'unknown' {
    const s = state.toLowerCase();
    if (s === 'started' || s === '2' || s === 'running') return 'started';
    if (s === 'paused' || s === '3' || s === 'pause') return 'paused';
    if (s === 'stopped' || s === '4' || s === 'finished') return 'stopped';
    if (s === 'editing' || s === '0' || s === 'edition') return 'editing';
    return 'unknown';
  }

  private normalizeChannel(channel: string): 'email' | 'sms' | 'push' | 'dm' | 'inApp' {
    const c = channel.toLowerCase();
    if (c.includes('email') || c === '0') return 'email';
    if (c.includes('sms') || c === '1') return 'sms';
    if (c.includes('push') || c === '2') return 'push';
    if (c.includes('dm') || c.includes('direct') || c === '3') return 'dm';
    if (c.includes('inapp') || c === '4') return 'inApp';
    return 'email';
  }

  private mapActivities(data: Record<string, unknown>): CampaignActivity[] {
    const activities: CampaignActivity[] = [];
    if (Array.isArray(data.activity)) {
      for (const act of data.activity as Array<Record<string, unknown>>) {
        activities.push({
          id: (act.PKey as string) || '',
          name: (act.name as string) || '',
          type: (act.type as string) || '',
          position: { x: (act.x as number) || 0, y: (act.y as number) || 0 },
          transitions: ((act.transitions as Array<Record<string, string>>) || []).map(t => t.target || ''),
          properties: act,
        });
      }
    }
    return activities;
  }
}
