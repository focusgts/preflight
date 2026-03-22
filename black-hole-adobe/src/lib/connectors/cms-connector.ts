/**
 * CMS Connector
 *
 * Supports WordPress, Sitecore, and Drupal. Extracts pages, media,
 * templates, taxonomies, and menus for migration to AEM.
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
// CMS-specific types
// ============================================================

export type CMSPlatform = 'wordpress' | 'sitecore' | 'drupal';

export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  url: string;
  content: string;
  excerpt: string;
  template: string;
  status: 'published' | 'draft' | 'pending' | 'archived';
  author: string | null;
  parentId: string | null;
  order: number;
  contentType: string;
  customFields: Record<string, unknown>;
  seoMeta: CMSSeoMeta;
  createdAt: string | null;
  modifiedAt: string | null;
  suggestedAEMComponent: string | null;
}

export interface CMSSeoMeta {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
}

export interface CMSMedia {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  altText: string;
  caption: string;
  metadata: Record<string, unknown>;
}

export interface CMSTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  regions: string[];
  suggestedAEMTemplate: string | null;
}

export interface CMSTaxonomy {
  id: string;
  name: string;
  slug: string;
  type: 'category' | 'tag' | 'custom';
  taxonomyName: string;
  parentId: string | null;
  count: number;
  description: string;
}

export interface CMSMenu {
  id: string;
  name: string;
  location: string;
  items: CMSMenuItem[];
}

export interface CMSMenuItem {
  id: string;
  title: string;
  url: string;
  target: string;
  parentId: string | null;
  order: number;
  type: 'page' | 'custom' | 'category' | 'post';
  objectId: string | null;
  children: CMSMenuItem[];
}

export interface URLRedirectMapping {
  sourceUrl: string;
  targetUrl: string;
  statusCode: 301 | 302;
  contentType: string;
}

export interface CMSExtractionData {
  platform: CMSPlatform;
  pages: CMSPage[];
  media: CMSMedia[];
  templates: CMSTemplate[];
  taxonomies: CMSTaxonomy[];
  menus: CMSMenu[];
  urlMappings: URLRedirectMapping[];
}

// ============================================================
// WordPress API response shapes
// ============================================================

interface WPPost {
  id: number;
  title: { rendered: string };
  slug: string;
  link: string;
  content: { rendered: string };
  excerpt: { rendered: string };
  template: string;
  status: string;
  author: number;
  parent: number;
  menu_order: number;
  type: string;
  date: string;
  modified: string;
  meta: Record<string, unknown>;
  yoast_head_json?: {
    title?: string;
    description?: string;
    canonical?: string;
    robots?: Record<string, string>;
    og_title?: string;
    og_description?: string;
    og_image?: Array<{ url: string }>;
  };
}

interface WPMedia {
  id: number;
  title: { rendered: string };
  source_url: string;
  mime_type: string;
  media_details: {
    filesize?: number;
    width?: number;
    height?: number;
  };
  alt_text: string;
  caption: { rendered: string };
}

interface WPTaxonomyTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
  count: number;
  description: string;
}

// ============================================================
// CMS Connector
// ============================================================

export class CMSConnector extends BaseConnector {
  private platform: CMSPlatform;
  private readonly pageSize: number;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
    pageSize: number = 100,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.platform = (config.connectionDetails.platform as CMSPlatform) || 'wordpress';
    this.pageSize = pageSize;
  }

  async connect(): Promise<void> {
    try {
      switch (this.platform) {
        case 'wordpress': await this.connectWordPress(); break;
        case 'sitecore': await this.connectSitecore(); break;
        case 'drupal': await this.connectDrupal(); break;
      }
      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(`CMS connect failed: ${(error as Error).message}`, 'CMS_CONNECT_FAILED');
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.config.status = 'disconnected';
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

  async extract(): Promise<ExtractionResult<CMSExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    const [pages, media, templates, taxonomies, menus] = await Promise.all([
      this.extractPages().catch(e => { warnings.push(`Pages: ${(e as Error).message}`); return []; }),
      this.extractMedia().catch(e => { warnings.push(`Media: ${(e as Error).message}`); return []; }),
      this.extractTemplates().catch(e => { warnings.push(`Templates: ${(e as Error).message}`); return []; }),
      this.extractTaxonomies().catch(e => { warnings.push(`Taxonomies: ${(e as Error).message}`); return []; }),
      this.extractMenus().catch(e => { warnings.push(`Menus: ${(e as Error).message}`); return []; }),
    ]);

    const urlMappings = this.generateURLMappings(pages);
    const totalItems = pages.length + media.length + templates.length +
      taxonomies.length + menus.length;

    return {
      data: { platform: this.platform, pages, media, templates, taxonomies, menus, urlMappings },
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
      { name: 'pages', description: 'Extract content pages and posts', requiresAuth: this.platform !== 'wordpress' },
      { name: 'media', description: 'Extract media library', requiresAuth: this.platform !== 'wordpress' },
      { name: 'templates', description: 'Extract page templates', requiresAuth: true },
      { name: 'taxonomies', description: 'Extract categories, tags, and custom taxonomies', requiresAuth: false },
      { name: 'menus', description: 'Extract navigation menus', requiresAuth: false },
    ];
  }

  // ============================================================
  // Public extraction methods
  // ============================================================

  /** Extract all pages/content with pagination. */
  async extractPages(): Promise<CMSPage[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'wordpress': return this.extractWPPages();
      case 'sitecore': return this.extractSitecorePages();
      case 'drupal': return this.extractDrupalPages();
    }
  }

  /** Extract media library items. */
  async extractMedia(): Promise<CMSMedia[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'wordpress': return this.extractWPMedia();
      case 'sitecore': return this.extractSitecoreMedia();
      case 'drupal': return this.extractDrupalMedia();
    }
  }

  /** Extract page/content templates. */
  async extractTemplates(): Promise<CMSTemplate[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'wordpress': return this.extractWPTemplates();
      case 'sitecore': return this.extractSitecoreTemplates();
      case 'drupal': return this.extractDrupalTemplates();
    }
  }

  /** Extract taxonomy terms (categories, tags, custom). */
  async extractTaxonomies(): Promise<CMSTaxonomy[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'wordpress': return this.extractWPTaxonomies();
      case 'sitecore': return []; // Sitecore uses a different taxonomy model
      case 'drupal': return this.extractDrupalTaxonomies();
    }
  }

  /** Extract navigation menus. */
  async extractMenus(): Promise<CMSMenu[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'wordpress': return this.extractWPMenus();
      case 'sitecore': return []; // Sitecore navigation is item-based
      case 'drupal': return this.extractDrupalMenus();
    }
  }

  // ============================================================
  // WordPress REST API
  // ============================================================

  private async connectWordPress(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/wp-json/wp/v2/types'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('WordPress connect failed', 'WP_CONNECT_FAILED', response.status);
    }
  }

  private async extractWPPages(): Promise<CMSPage[]> {
    // Extract both pages and posts
    const [pages, posts] = await Promise.all([
      this.extractWPPostType('pages'),
      this.extractWPPostType('posts'),
    ]);
    return [...pages, ...posts];
  }

  private async extractWPPostType(type: string): Promise<CMSPage[]> {
    return this.paginateRequest<CMSPage, WPPost[]>(
      {
        method: 'GET',
        url: this.buildUrl(`/wp-json/wp/v2/${type}`),
        headers: this.getAuthHeaders(),
        queryParams: { per_page: String(this.pageSize), page: '1', _embed: 'true' },
      },
      (response) => (response || []).map(p => this.mapWPPost(p)),
      (response, currentOptions) => {
        if ((response || []).length < this.pageSize) return null;
        const currentPage = parseInt(currentOptions.queryParams?.page || '1', 10);
        return {
          ...currentOptions,
          queryParams: { ...currentOptions.queryParams, page: String(currentPage + 1) },
        };
      },
      `Extracting WP ${type}`,
    );
  }

  private mapWPPost(p: WPPost): CMSPage {
    const yoast = p.yoast_head_json;
    return {
      id: String(p.id),
      title: p.title.rendered,
      slug: p.slug,
      url: p.link,
      content: p.content.rendered,
      excerpt: p.excerpt.rendered,
      template: p.template || 'default',
      status: this.normalizeWPStatus(p.status),
      author: p.author ? String(p.author) : null,
      parentId: p.parent ? String(p.parent) : null,
      order: p.menu_order,
      contentType: p.type,
      customFields: p.meta || {},
      seoMeta: {
        title: yoast?.title || null,
        description: yoast?.description || null,
        canonical: yoast?.canonical || null,
        robots: yoast?.robots ? Object.values(yoast.robots).join(', ') : null,
        ogTitle: yoast?.og_title || null,
        ogDescription: yoast?.og_description || null,
        ogImage: yoast?.og_image?.[0]?.url || null,
      },
      createdAt: p.date,
      modifiedAt: p.modified,
      suggestedAEMComponent: this.suggestAEMComponent(p.type, p.template),
    };
  }

  private async extractWPMedia(): Promise<CMSMedia[]> {
    return this.paginateRequest<CMSMedia, WPMedia[]>(
      {
        method: 'GET',
        url: this.buildUrl('/wp-json/wp/v2/media'),
        headers: this.getAuthHeaders(),
        queryParams: { per_page: String(this.pageSize), page: '1' },
      },
      (response) => (response || []).map(m => ({
        id: String(m.id),
        title: m.title.rendered,
        url: m.source_url,
        mimeType: m.mime_type,
        fileSize: m.media_details?.filesize || 0,
        width: m.media_details?.width || null,
        height: m.media_details?.height || null,
        altText: m.alt_text || '',
        caption: m.caption.rendered || '',
        metadata: m.media_details as unknown as Record<string, unknown>,
      })),
      (response, currentOptions) => {
        if ((response || []).length < this.pageSize) return null;
        const currentPage = parseInt(currentOptions.queryParams?.page || '1', 10);
        return {
          ...currentOptions,
          queryParams: { ...currentOptions.queryParams, page: String(currentPage + 1) },
        };
      },
      'Extracting WP media',
    );
  }

  private async extractWPTemplates(): Promise<CMSTemplate[]> {
    const response = await this.makeRequest<Array<Record<string, unknown>>>({
      method: 'GET',
      url: this.buildUrl('/wp-json/wp/v2/templates'),
      headers: this.getAuthHeaders(),
    });

    return (response.data || []).map((t) => ({
      id: (t.id as string) || '',
      name: (t.title as Record<string, string>)?.rendered || (t.slug as string) || '',
      slug: (t.slug as string) || '',
      description: (t.description as string) || '',
      type: (t.type as string) || 'wp_template',
      regions: [],
      suggestedAEMTemplate: null,
    }));
  }

  private async extractWPTaxonomies(): Promise<CMSTaxonomy[]> {
    const [categories, tags] = await Promise.all([
      this.fetchWPTerms('categories', 'category'),
      this.fetchWPTerms('tags', 'tag'),
    ]);
    return [...categories, ...tags];
  }

  private async fetchWPTerms(endpoint: string, type: 'category' | 'tag'): Promise<CMSTaxonomy[]> {
    return this.paginateRequest<CMSTaxonomy, WPTaxonomyTerm[]>(
      {
        method: 'GET',
        url: this.buildUrl(`/wp-json/wp/v2/${endpoint}`),
        headers: this.getAuthHeaders(),
        queryParams: { per_page: String(this.pageSize), page: '1' },
      },
      (response) => (response || []).map(t => ({
        id: String(t.id),
        name: t.name,
        slug: t.slug,
        type,
        taxonomyName: t.taxonomy,
        parentId: t.parent ? String(t.parent) : null,
        count: t.count,
        description: t.description,
      })),
      (response, currentOptions) => {
        if ((response || []).length < this.pageSize) return null;
        const currentPage = parseInt(currentOptions.queryParams?.page || '1', 10);
        return {
          ...currentOptions,
          queryParams: { ...currentOptions.queryParams, page: String(currentPage + 1) },
        };
      },
    );
  }

  private async extractWPMenus(): Promise<CMSMenu[]> {
    try {
      const response = await this.makeRequest<Array<Record<string, unknown>>>({
        method: 'GET',
        url: this.buildUrl('/wp-json/wp/v2/menus'),
        headers: this.getAuthHeaders(),
      });

      const menus: CMSMenu[] = [];
      for (const menu of (response.data || [])) {
        const itemsResponse = await this.makeRequest<Array<Record<string, unknown>>>({
          method: 'GET',
          url: this.buildUrl(`/wp-json/wp/v2/menu-items`),
          headers: this.getAuthHeaders(),
          queryParams: { menus: String(menu.id), per_page: '100' },
        });

        const flatItems = (itemsResponse.data || []).map((item) => ({
          id: String((item.id as number) || ''),
          title: ((item.title as Record<string, string>)?.rendered) || '',
          url: (item.url as string) || '',
          target: (item.target as string) || '_self',
          parentId: (item.parent as number) ? String(item.parent) : null,
          order: (item.menu_order as number) || 0,
          type: this.normalizeMenuItemType((item.type as string) || ''),
          objectId: (item.object_id as number) ? String(item.object_id) : null,
          children: [],
        }));

        menus.push({
          id: String((menu.id as number) || ''),
          name: (menu.name as string) || '',
          location: ((menu.locations as string[]) || [])[0] || '',
          items: this.nestMenuItems(flatItems),
        });
      }
      return menus;
    } catch {
      // Menu endpoint may not be available on all WP installations
      return [];
    }
  }

  // ============================================================
  // Sitecore REST API
  // ============================================================

  private async connectSitecore(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/sitecore/api/ssc/auth/login'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Sitecore connect failed', 'SITECORE_CONNECT_FAILED', response.status);
    }
  }

  private async extractSitecorePages(): Promise<CMSPage[]> {
    const rootId = (this.config.connectionDetails.rootItemId as string) || '{0DE95AE4-41AB-4D01-9EB0-67441B7C2450}';
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl(`/sitecore/api/ssc/item/${rootId}/children`),
      headers: this.getAuthHeaders(),
      queryParams: { includeStandardTemplateFields: 'false', fields: 'Title,Content,__Created,__Updated,__Created by' },
    });

    const pages: CMSPage[] = [];
    for (const item of (response.data.items || [])) {
      pages.push(this.mapSitecoreItem(item));
      // Recursively fetch children
      const childPages = await this.fetchSitecoreChildren((item.ItemID as string) || '');
      pages.push(...childPages);
    }
    return pages;
  }

  private async fetchSitecoreChildren(parentId: string): Promise<CMSPage[]> {
    try {
      const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
        method: 'GET',
        url: this.buildUrl(`/sitecore/api/ssc/item/${parentId}/children`),
        headers: this.getAuthHeaders(),
      });
      const pages: CMSPage[] = [];
      for (const item of (response.data.items || [])) {
        pages.push(this.mapSitecoreItem(item));
        const childPages = await this.fetchSitecoreChildren((item.ItemID as string) || '');
        pages.push(...childPages);
      }
      return pages;
    } catch {
      return [];
    }
  }

  private mapSitecoreItem(item: Record<string, unknown>): CMSPage {
    return {
      id: (item.ItemID as string) || '',
      title: (item.Title as string) || (item.ItemName as string) || '',
      slug: ((item.ItemName as string) || '').toLowerCase().replace(/\s+/g, '-'),
      url: (item.ItemPath as string) || '',
      content: (item.Content as string) || (item.Text as string) || '',
      excerpt: '',
      template: (item.TemplateName as string) || '',
      status: 'published',
      author: (item['__Created by'] as string) || null,
      parentId: (item.ParentID as string) || null,
      order: (item.Sortorder as number) || 0,
      contentType: (item.TemplateName as string) || 'page',
      customFields: item,
      seoMeta: {
        title: (item['Browser Title'] as string) || null,
        description: (item['Meta Description'] as string) || null,
        canonical: null,
        robots: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
      },
      createdAt: (item['__Created'] as string) || null,
      modifiedAt: (item['__Updated'] as string) || null,
      suggestedAEMComponent: null,
    };
  }

  private async extractSitecoreMedia(): Promise<CMSMedia[]> {
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/sitecore/api/ssc/item/{3D6658D8-A0BF-4E75-B3E2-D050FABCF4E1}/children'),
      headers: this.getAuthHeaders(),
      queryParams: { includeStandardTemplateFields: 'false' },
    });

    return (response.data.items || []).map((m) => ({
      id: (m.ItemID as string) || '',
      title: (m.ItemName as string) || '',
      url: this.buildUrl(`/sitecore/shell/-/media/${(m.ItemPath as string)?.replace('/sitecore/media library/', '') || ''}`),
      mimeType: (m.MimeType as string) || '',
      fileSize: (m.Size as number) || 0,
      width: (m.Width as number) || null,
      height: (m.Height as number) || null,
      altText: (m.Alt as string) || '',
      caption: '',
      metadata: m,
    }));
  }

  private async extractSitecoreTemplates(): Promise<CMSTemplate[]> {
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/sitecore/api/ssc/item/{3C1715FE-6A13-4FCF-845F-DE308BA9741D}/children'),
      headers: this.getAuthHeaders(),
    });

    return (response.data.items || []).map((t) => ({
      id: (t.ItemID as string) || '',
      name: (t.ItemName as string) || '',
      slug: ((t.ItemName as string) || '').toLowerCase().replace(/\s+/g, '-'),
      description: '',
      type: 'sitecore_template',
      regions: [],
      suggestedAEMTemplate: null,
    }));
  }

  // ============================================================
  // Drupal JSON:API
  // ============================================================

  private async connectDrupal(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/jsonapi'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Drupal connect failed', 'DRUPAL_CONNECT_FAILED', response.status);
    }
  }

  private async extractDrupalPages(): Promise<CMSPage[]> {
    return this.paginateRequest<CMSPage, { data: Array<Record<string, unknown>>; links?: { next?: { href: string } } }>(
      {
        method: 'GET',
        url: this.buildUrl('/jsonapi/node/page'),
        headers: this.getAuthHeaders(),
        queryParams: { 'page[limit]': String(this.pageSize) },
      },
      (response) => (response.data || []).map(n => this.mapDrupalNode(n)),
      (response) => {
        const nextUrl = response.links?.next?.href;
        if (!nextUrl) return null;
        return { method: 'GET' as const, url: nextUrl, headers: this.getAuthHeaders() };
      },
      'Extracting Drupal pages',
    );
  }

  private mapDrupalNode(node: Record<string, unknown>): CMSPage {
    const attrs = (node.attributes as Record<string, unknown>) || {};
    const body = (attrs.body as Record<string, unknown>) || {};

    return {
      id: (node.id as string) || '',
      title: (attrs.title as string) || '',
      slug: (attrs.path as Record<string, unknown>)?.alias as string ||
        ((attrs.title as string) || '').toLowerCase().replace(/\s+/g, '-'),
      url: (attrs.path as Record<string, unknown>)?.alias as string || '',
      content: (body.processed as string) || (body.value as string) || '',
      excerpt: (body.summary as string) || '',
      template: (node.type as string) || 'page',
      status: (attrs.status as boolean) ? 'published' : 'draft',
      author: null,
      parentId: null,
      order: 0,
      contentType: ((node.type as Record<string, string>)?.target_id) || 'page',
      customFields: attrs,
      seoMeta: {
        title: (attrs.metatag as Record<string, unknown>)?.title as string || null,
        description: (attrs.metatag as Record<string, unknown>)?.description as string || null,
        canonical: null,
        robots: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
      },
      createdAt: (attrs.created as string) || null,
      modifiedAt: (attrs.changed as string) || null,
      suggestedAEMComponent: null,
    };
  }

  private async extractDrupalMedia(): Promise<CMSMedia[]> {
    return this.paginateRequest<CMSMedia, { data: Array<Record<string, unknown>>; links?: { next?: { href: string } } }>(
      {
        method: 'GET',
        url: this.buildUrl('/jsonapi/media/image'),
        headers: this.getAuthHeaders(),
        queryParams: { 'page[limit]': String(this.pageSize), include: 'field_media_image' },
      },
      (response) => (response.data || []).map(m => {
        const attrs = (m.attributes as Record<string, unknown>) || {};
        const fileAttrs = ((m.relationships as Record<string, Record<string, Record<string, unknown>>>)
          ?.field_media_image?.data?.meta) as Record<string, unknown> ?? {};
        return {
          id: (m.id as string) || '',
          title: (attrs.name as string) || '',
          url: (fileAttrs.uri as string) || '',
          mimeType: (fileAttrs.filemime as string) || '',
          fileSize: (fileAttrs.filesize as number) || 0,
          width: (fileAttrs.width as number) || null,
          height: (fileAttrs.height as number) || null,
          altText: (fileAttrs.alt as string) || '',
          caption: '',
          metadata: attrs,
        };
      }),
      (response) => {
        const nextUrl = response.links?.next?.href;
        if (!nextUrl) return null;
        return { method: 'GET' as const, url: nextUrl, headers: this.getAuthHeaders() };
      },
      'Extracting Drupal media',
    );
  }

  private async extractDrupalTemplates(): Promise<CMSTemplate[]> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/jsonapi/node_type/node_type'),
      headers: this.getAuthHeaders(),
    });

    return (response.data.data || []).map((t) => {
      const attrs = (t.attributes as Record<string, unknown>) || {};
      return {
        id: (t.id as string) || '',
        name: (attrs.name as string) || '',
        slug: (attrs.drupal_internal__type as string) || '',
        description: (attrs.description as string) || '',
        type: 'drupal_content_type',
        regions: [],
        suggestedAEMTemplate: null,
      };
    });
  }

  private async extractDrupalTaxonomies(): Promise<CMSTaxonomy[]> {
    const vocabResponse = await this.makeRequest<{ data: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/jsonapi/taxonomy_vocabulary/taxonomy_vocabulary'),
      headers: this.getAuthHeaders(),
    });

    const allTerms: CMSTaxonomy[] = [];
    for (const vocab of (vocabResponse.data.data || [])) {
      const vocabAttrs = (vocab.attributes as Record<string, unknown>) || {};
      const machineName = (vocabAttrs.drupal_internal__vid as string) || '';
      try {
        const termsResponse = await this.makeRequest<{ data: Array<Record<string, unknown>> }>({
          method: 'GET',
          url: this.buildUrl(`/jsonapi/taxonomy_term/${machineName}`),
          headers: this.getAuthHeaders(),
          queryParams: { 'page[limit]': '100' },
        });
        for (const term of (termsResponse.data.data || [])) {
          const attrs = (term.attributes as Record<string, unknown>) || {};
          allTerms.push({
            id: (term.id as string) || '',
            name: (attrs.name as string) || '',
            slug: (attrs.drupal_internal__tid as string) || '',
            type: 'custom',
            taxonomyName: machineName,
            parentId: ((term.relationships as Record<string, Record<string, Record<string, unknown>>>)?.parent?.data?.id as string) || null,
            count: 0,
            description: ((attrs.description as Record<string, unknown>)?.value as string) || '',
          });
        }
      } catch {
        // Skip inaccessible vocabularies
      }
    }
    return allTerms;
  }

  private async extractDrupalMenus(): Promise<CMSMenu[]> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/jsonapi/menu/menu'),
      headers: this.getAuthHeaders(),
    });

    const menus: CMSMenu[] = [];
    for (const menu of (response.data.data || [])) {
      const menuAttrs = (menu.attributes as Record<string, unknown>) || {};
      const menuId = (menuAttrs.drupal_internal__id as string) || '';
      try {
        const linksResponse = await this.makeRequest<{ data: Array<Record<string, unknown>> }>({
          method: 'GET',
          url: this.buildUrl(`/jsonapi/menu_link_content/${menuId}`),
          headers: this.getAuthHeaders(),
        });

        const items: CMSMenuItem[] = (linksResponse.data.data || []).map((link) => {
          const attrs = (link.attributes as Record<string, unknown>) || {};
          return {
            id: (link.id as string) || '',
            title: (attrs.title as string) || '',
            url: ((attrs.link as Record<string, unknown>)?.uri as string) || '',
            target: '_self',
            parentId: ((link.relationships as Record<string, Record<string, Record<string, unknown>>>)?.parent?.data?.id as string) || null,
            order: (attrs.weight as number) || 0,
            type: 'custom' as const,
            objectId: null,
            children: [],
          };
        });

        menus.push({
          id: (menu.id as string) || '',
          name: (menuAttrs.label as string) || '',
          location: menuId,
          items: this.nestMenuItems(items),
        });
      } catch {
        // Skip inaccessible menus
      }
    }
    return menus;
  }

  // ============================================================
  // URL mapping and component suggestions
  // ============================================================

  /**
   * Generate URL redirect mappings from source CMS URLs
   * to suggested AEM paths.
   */
  private generateURLMappings(pages: CMSPage[]): URLRedirectMapping[] {
    return pages
      .filter(p => p.url && p.status === 'published')
      .map(p => {
        const sourcePath = new URL(p.url, 'https://placeholder.com').pathname;
        const targetPath = this.mapUrlToAEM(sourcePath, p.contentType);
        return {
          sourceUrl: sourcePath,
          targetUrl: targetPath,
          statusCode: 301 as const,
          contentType: p.contentType,
        };
      });
  }

  private mapUrlToAEM(sourcePath: string, contentType: string): string {
    const cleanPath = sourcePath.replace(/\/$/, '') || '/';
    if (contentType === 'post') {
      return `/content/site/blog${cleanPath}`;
    }
    return `/content/site${cleanPath}`;
  }

  /**
   * Suggest an AEM component based on the WordPress content type
   * and template.
   */
  private suggestAEMComponent(contentType: string, template: string): string | null {
    const componentMap: Record<string, string> = {
      page: 'core/wcm/components/page/v3/page',
      post: 'core/wcm/components/page/v3/page',
      product: 'commerce/components/product',
      landing_page: 'core/wcm/components/page/v3/page',
    };

    if (template && template !== 'default') {
      return `custom/components/templates/${template.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
    }

    return componentMap[contentType] || null;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  private normalizeWPStatus(status: string): CMSPage['status'] {
    if (status === 'publish') return 'published';
    if (status === 'draft') return 'draft';
    if (status === 'pending') return 'pending';
    return 'archived';
  }

  private normalizeMenuItemType(type: string): CMSMenuItem['type'] {
    if (type === 'post_type') return 'page';
    if (type === 'taxonomy') return 'category';
    if (type === 'post') return 'post';
    return 'custom';
  }

  private nestMenuItems(flatItems: CMSMenuItem[]): CMSMenuItem[] {
    const map = new Map<string, CMSMenuItem>();
    const roots: CMSMenuItem[] = [];

    for (const item of flatItems) {
      map.set(item.id, { ...item, children: [] });
    }

    for (const item of flatItems) {
      const current = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children.push(current);
      } else {
        roots.push(current);
      }
    }

    return roots.sort((a, b) => a.order - b.order);
  }
}
