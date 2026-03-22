/**
 * Commerce Connector
 *
 * Supports Adobe Commerce (Magento), Shopify, and Salesforce Commerce Cloud (SFCC).
 * Extracts products, categories, customers, and orders via REST and GraphQL APIs.
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
// Commerce-specific types
// ============================================================

export type CommercePlatform = 'adobe_commerce' | 'shopify' | 'sfcc';

export interface CommerceProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  type: 'simple' | 'configurable' | 'grouped' | 'bundle' | 'virtual' | 'downloadable';
  status: 'enabled' | 'disabled';
  price: number;
  currency: string;
  categories: string[];
  images: CommerceImage[];
  variants: CommerceVariant[];
  attributes: Record<string, unknown>;
  inventory: { qty: number; inStock: boolean } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CommerceImage {
  url: string;
  label: string;
  position: number;
  isDefault: boolean;
}

export interface CommerceVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  attributes: Record<string, string>;
  inventory: { qty: number; inStock: boolean } | null;
}

export interface CommerceCategory {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  level: number;
  position: number;
  productCount: number;
  isActive: boolean;
  children: CommerceCategory[];
}

export interface CommerceCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  group: string;
  createdAt: string | null;
  orderCount: number;
  totalSpent: number;
  addresses: CommerceAddress[];
}

export interface CommerceAddress {
  type: 'billing' | 'shipping';
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
}

export interface CommerceOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string | null;
  email: string;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  currency: string;
  itemCount: number;
  items: CommerceOrderItem[];
  createdAt: string | null;
}

export interface CommerceOrderItem {
  sku: string;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface CommerceExtractionData {
  platform: CommercePlatform;
  products: CommerceProduct[];
  categories: CommerceCategory[];
  customers: CommerceCustomer[];
  orders: CommerceOrder[];
  productCount: number;
  orderCount: number;
  customerCount: number;
}

// ============================================================
// Commerce Connector
// ============================================================

export class CommerceConnector extends BaseConnector {
  private platform: CommercePlatform;
  private readonly pageSize: number;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
    pageSize: number = 100,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
    this.platform = (config.connectionDetails.platform as CommercePlatform) || 'adobe_commerce';
    this.pageSize = pageSize;
  }

  async connect(): Promise<void> {
    try {
      switch (this.platform) {
        case 'adobe_commerce': await this.connectAdobeCommerce(); break;
        case 'shopify': await this.connectShopify(); break;
        case 'sfcc': await this.connectSFCC(); break;
      }
      this.isConnected = true;
      this.config.status = 'connected';
      this.config.lastTestedAt = new Date().toISOString();
    } catch (error) {
      this.config.status = 'error';
      this.isConnected = false;
      throw error instanceof ConnectorError
        ? error
        : new ConnectorError(`Commerce connect failed: ${(error as Error).message}`, 'COMMERCE_CONNECT_FAILED');
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

  async extract(): Promise<ExtractionResult<CommerceExtractionData>> {
    this.ensureConnected();
    const startTime = Date.now();
    const warnings: string[] = [];

    const [products, categories, customers, orders] = await Promise.all([
      this.extractProducts().catch(e => { warnings.push(`Products: ${(e as Error).message}`); return []; }),
      this.extractCategories().catch(e => { warnings.push(`Categories: ${(e as Error).message}`); return []; }),
      this.extractCustomers(200).catch(e => { warnings.push(`Customers: ${(e as Error).message}`); return []; }),
      this.extractOrders(200).catch(e => { warnings.push(`Orders: ${(e as Error).message}`); return []; }),
    ]);

    const totalItems = products.length + categories.length + customers.length + orders.length;

    return {
      data: {
        platform: this.platform,
        products,
        categories,
        customers,
        orders,
        productCount: products.length,
        orderCount: orders.length,
        customerCount: customers.length,
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
    return [
      { name: 'products', description: 'Extract product catalog with variants', requiresAuth: true },
      { name: 'categories', description: 'Extract category tree', requiresAuth: true },
      { name: 'customers', description: 'Extract customer profiles', requiresAuth: true },
      { name: 'orders', description: 'Extract order history', requiresAuth: true },
    ];
  }

  // ============================================================
  // Public extraction methods
  // ============================================================

  /** Extract products with pagination for large catalogs. */
  async extractProducts(): Promise<CommerceProduct[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'adobe_commerce': return this.extractMagentoProducts();
      case 'shopify': return this.extractShopifyProducts();
      case 'sfcc': return this.extractSFCCProducts();
    }
  }

  /** Extract category tree. */
  async extractCategories(): Promise<CommerceCategory[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'adobe_commerce': return this.extractMagentoCategories();
      case 'shopify': return this.extractShopifyCategories();
      case 'sfcc': return this.extractSFCCCategories();
    }
  }

  /** Extract customer profiles (sample). */
  async extractCustomers(limit: number = 200): Promise<CommerceCustomer[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'adobe_commerce': return this.extractMagentoCustomers(limit);
      case 'shopify': return this.extractShopifyCustomers(limit);
      case 'sfcc': return this.extractSFCCCustomers(limit);
    }
  }

  /** Extract recent orders (sample). */
  async extractOrders(limit: number = 200): Promise<CommerceOrder[]> {
    this.ensureConnected();
    switch (this.platform) {
      case 'adobe_commerce': return this.extractMagentoOrders(limit);
      case 'shopify': return this.extractShopifyOrders(limit);
      case 'sfcc': return this.extractSFCCOrders(limit);
    }
  }

  // ============================================================
  // Adobe Commerce (Magento) REST API
  // ============================================================

  private async connectAdobeCommerce(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/rest/V1/store/storeConfigs'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Adobe Commerce connect failed', 'MAGENTO_CONNECT_FAILED', response.status);
    }
  }

  private async extractMagentoProducts(): Promise<CommerceProduct[]> {
    return this.paginateRequest<CommerceProduct, { items: Array<Record<string, unknown>>; total_count: number }>(
      {
        method: 'GET',
        url: this.buildUrl('/rest/V1/products'),
        headers: this.getAuthHeaders(),
        queryParams: {
          'searchCriteria[pageSize]': String(this.pageSize),
          'searchCriteria[currentPage]': '1',
        },
      },
      (response) => (response.items || []).map(p => this.mapMagentoProduct(p)),
      (response, current) => {
        const currentPage = parseInt(current.queryParams?.['searchCriteria[currentPage]'] || '1', 10);
        const totalPages = Math.ceil((response.total_count || 0) / this.pageSize);
        if (currentPage >= totalPages) return null;
        return {
          ...current,
          queryParams: {
            ...current.queryParams,
            'searchCriteria[currentPage]': String(currentPage + 1),
          },
        };
      },
      'Extracting products',
    );
  }

  private mapMagentoProduct(p: Record<string, unknown>): CommerceProduct {
    const customAttrs = (p.custom_attributes as Array<{ attribute_code: string; value: unknown }>) || [];
    const findAttr = (code: string): unknown =>
      customAttrs.find(a => a.attribute_code === code)?.value;

    const mediaEntries = (p.media_gallery_entries as Array<Record<string, unknown>>) || [];
    const extensionAttrs = (p.extension_attributes as Record<string, unknown>) || {};
    const stockItem = (extensionAttrs.stock_item as Record<string, unknown>) || {};
    const configurableOptions = (extensionAttrs.configurable_product_options as Array<Record<string, unknown>>) || [];

    return {
      id: String((p.id as number) || ''),
      sku: (p.sku as string) || '',
      name: (p.name as string) || '',
      description: (findAttr('description') as string) || '',
      type: this.normalizeMagentoType((p.type_id as string) || ''),
      status: (p.status as number) === 1 ? 'enabled' : 'disabled',
      price: (p.price as number) || 0,
      currency: 'USD',
      categories: ((findAttr('category_ids') as string[]) || []),
      images: mediaEntries.map((m, i) => ({
        url: (m.file as string) || '',
        label: (m.label as string) || '',
        position: (m.position as number) || i,
        isDefault: i === 0,
      })),
      variants: configurableOptions.length > 0
        ? this.buildMagentoVariants(configurableOptions)
        : [],
      attributes: Object.fromEntries(customAttrs.map(a => [a.attribute_code, a.value])),
      inventory: stockItem.qty !== undefined
        ? { qty: (stockItem.qty as number) || 0, inStock: (stockItem.is_in_stock as boolean) || false }
        : null,
      createdAt: (p.created_at as string) || null,
      updatedAt: (p.updated_at as string) || null,
    };
  }

  private buildMagentoVariants(options: Array<Record<string, unknown>>): CommerceVariant[] {
    // Configurable options describe available axes (color, size), not individual variants.
    // Return the option definitions as variant stubs.
    return options.map((opt) => ({
      id: String((opt.id as number) || ''),
      sku: '',
      name: (opt.label as string) || '',
      price: 0,
      attributes: { [(opt.attribute_id as string) || '']: (opt.label as string) || '' },
      inventory: null,
    }));
  }

  private async extractMagentoCategories(): Promise<CommerceCategory[]> {
    const response = await this.makeRequest<Record<string, unknown>>({
      method: 'GET',
      url: this.buildUrl('/rest/V1/categories'),
      headers: this.getAuthHeaders(),
    });
    return this.flattenMagentoCategories(response.data);
  }

  private flattenMagentoCategories(
    node: Record<string, unknown>,
    result: CommerceCategory[] = [],
  ): CommerceCategory[] {
    const cat: CommerceCategory = {
      id: String((node.id as number) || ''),
      name: (node.name as string) || '',
      parentId: (node.parent_id as number) ? String(node.parent_id) : null,
      path: (node.path as string) || '',
      level: (node.level as number) || 0,
      position: (node.position as number) || 0,
      productCount: (node.product_count as number) || 0,
      isActive: (node.is_active as boolean) !== false,
      children: [],
    };
    result.push(cat);

    const children = (node.children_data as Array<Record<string, unknown>>) || [];
    for (const child of children) {
      this.flattenMagentoCategories(child, result);
    }
    return result;
  }

  private async extractMagentoCustomers(limit: number): Promise<CommerceCustomer[]> {
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/rest/V1/customers/search'),
      headers: this.getAuthHeaders(),
      queryParams: {
        'searchCriteria[pageSize]': String(limit),
        'searchCriteria[currentPage]': '1',
      },
    });

    return (response.data.items || []).map((c) => ({
      id: String((c.id as number) || ''),
      email: (c.email as string) || '',
      firstName: (c.firstname as string) || '',
      lastName: (c.lastname as string) || '',
      group: String((c.group_id as number) || 0),
      createdAt: (c.created_at as string) || null,
      orderCount: 0,
      totalSpent: 0,
      addresses: ((c.addresses as Array<Record<string, unknown>>) || []).map(a => this.mapMagentoAddress(a)),
    }));
  }

  private mapMagentoAddress(a: Record<string, unknown>): CommerceAddress {
    return {
      type: (a.default_billing as boolean) ? 'billing' : 'shipping',
      street: ((a.street as string[]) || []).join(', '),
      city: (a.city as string) || '',
      region: ((a.region as Record<string, unknown>)?.region as string) || '',
      postcode: (a.postcode as string) || '',
      country: (a.country_id as string) || '',
    };
  }

  private async extractMagentoOrders(limit: number): Promise<CommerceOrder[]> {
    const response = await this.makeRequest<{ items: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/rest/V1/orders'),
      headers: this.getAuthHeaders(),
      queryParams: {
        'searchCriteria[pageSize]': String(limit),
        'searchCriteria[currentPage]': '1',
        'searchCriteria[sortOrders][0][field]': 'created_at',
        'searchCriteria[sortOrders][0][direction]': 'DESC',
      },
    });

    return (response.data.items || []).map((o) => ({
      id: String((o.entity_id as number) || ''),
      orderNumber: (o.increment_id as string) || '',
      status: (o.status as string) || '',
      customerId: (o.customer_id as number) ? String(o.customer_id) : null,
      email: (o.customer_email as string) || '',
      total: (o.grand_total as number) || 0,
      subtotal: (o.subtotal as number) || 0,
      tax: (o.tax_amount as number) || 0,
      shipping: (o.shipping_amount as number) || 0,
      currency: (o.order_currency_code as string) || 'USD',
      itemCount: (o.total_item_count as number) || 0,
      items: ((o.items as Array<Record<string, unknown>>) || []).map(i => ({
        sku: (i.sku as string) || '',
        name: (i.name as string) || '',
        qty: (i.qty_ordered as number) || 0,
        price: (i.price as number) || 0,
        total: (i.row_total as number) || 0,
      })),
      createdAt: (o.created_at as string) || null,
    }));
  }

  // ============================================================
  // Shopify GraphQL / REST
  // ============================================================

  private async connectShopify(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/admin/api/2024-01/shop.json'),
      headers: this.getShopifyHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('Shopify connect failed', 'SHOPIFY_CONNECT_FAILED', response.status);
    }
  }

  private getShopifyHeaders(): Record<string, string> {
    return { 'X-Shopify-Access-Token': (this.config.connectionDetails.accessToken as string) || '' };
  }

  private async extractShopifyProducts(): Promise<CommerceProduct[]> {
    return this.paginateRequest<CommerceProduct, { products: Array<Record<string, unknown>> }>(
      {
        method: 'GET',
        url: this.buildUrl('/admin/api/2024-01/products.json'),
        headers: this.getShopifyHeaders(),
        queryParams: { limit: String(Math.min(this.pageSize, 250)) },
      },
      (response) => (response.products || []).map(p => this.mapShopifyProduct(p)),
      (_response, currentOptions) => {
        // Shopify uses Link header pagination
        return null; // Simplified: single page. Real impl would parse Link header.
      },
      'Extracting Shopify products',
    );
  }

  private mapShopifyProduct(p: Record<string, unknown>): CommerceProduct {
    const variants = (p.variants as Array<Record<string, unknown>>) || [];
    const images = (p.images as Array<Record<string, unknown>>) || [];

    return {
      id: String((p.id as number) || ''),
      sku: variants[0] ? (variants[0].sku as string) || '' : '',
      name: (p.title as string) || '',
      description: (p.body_html as string) || '',
      type: variants.length > 1 ? 'configurable' : 'simple',
      status: (p.status as string) === 'active' ? 'enabled' : 'disabled',
      price: variants[0] ? parseFloat((variants[0].price as string) || '0') : 0,
      currency: 'USD',
      categories: ((p.tags as string) || '').split(',').map(t => t.trim()).filter(Boolean),
      images: images.map((img, i) => ({
        url: (img.src as string) || '',
        label: (img.alt as string) || '',
        position: (img.position as number) || i,
        isDefault: i === 0,
      })),
      variants: variants.map((v) => ({
        id: String((v.id as number) || ''),
        sku: (v.sku as string) || '',
        name: (v.title as string) || '',
        price: parseFloat((v.price as string) || '0'),
        attributes: {
          option1: (v.option1 as string) || '',
          option2: (v.option2 as string) || '',
          option3: (v.option3 as string) || '',
        },
        inventory: {
          qty: (v.inventory_quantity as number) || 0,
          inStock: ((v.inventory_quantity as number) || 0) > 0,
        },
      })),
      attributes: {},
      inventory: variants[0]
        ? { qty: (variants[0].inventory_quantity as number) || 0, inStock: ((variants[0].inventory_quantity as number) || 0) > 0 }
        : null,
      createdAt: (p.created_at as string) || null,
      updatedAt: (p.updated_at as string) || null,
    };
  }

  private async extractShopifyCategories(): Promise<CommerceCategory[]> {
    const response = await this.makeRequest<{ custom_collections: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/admin/api/2024-01/custom_collections.json'),
      headers: this.getShopifyHeaders(),
      queryParams: { limit: '250' },
    });

    return (response.data.custom_collections || []).map((c, i) => ({
      id: String((c.id as number) || ''),
      name: (c.title as string) || '',
      parentId: null,
      path: (c.handle as string) || '',
      level: 0,
      position: (c.sort_order as number) || i,
      productCount: (c.products_count as number) || 0,
      isActive: (c.published as boolean) !== false,
      children: [],
    }));
  }

  private async extractShopifyCustomers(limit: number): Promise<CommerceCustomer[]> {
    const response = await this.makeRequest<{ customers: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/admin/api/2024-01/customers.json'),
      headers: this.getShopifyHeaders(),
      queryParams: { limit: String(Math.min(limit, 250)) },
    });

    return (response.data.customers || []).map((c) => ({
      id: String((c.id as number) || ''),
      email: (c.email as string) || '',
      firstName: (c.first_name as string) || '',
      lastName: (c.last_name as string) || '',
      group: (c.tags as string) || 'default',
      createdAt: (c.created_at as string) || null,
      orderCount: (c.orders_count as number) || 0,
      totalSpent: parseFloat((c.total_spent as string) || '0'),
      addresses: ((c.addresses as Array<Record<string, unknown>>) || []).map(a => ({
        type: (a.default as boolean) ? 'billing' as const : 'shipping' as const,
        street: `${(a.address1 as string) || ''} ${(a.address2 as string) || ''}`.trim(),
        city: (a.city as string) || '',
        region: (a.province as string) || '',
        postcode: (a.zip as string) || '',
        country: (a.country_code as string) || '',
      })),
    }));
  }

  private async extractShopifyOrders(limit: number): Promise<CommerceOrder[]> {
    const response = await this.makeRequest<{ orders: Array<Record<string, unknown>> }>({
      method: 'GET',
      url: this.buildUrl('/admin/api/2024-01/orders.json'),
      headers: this.getShopifyHeaders(),
      queryParams: { limit: String(Math.min(limit, 250)), status: 'any' },
    });

    return (response.data.orders || []).map((o) => ({
      id: String((o.id as number) || ''),
      orderNumber: (o.name as string) || '',
      status: (o.financial_status as string) || '',
      customerId: (o.customer as Record<string, unknown>)?.id ? String((o.customer as Record<string, unknown>).id) : null,
      email: (o.email as string) || '',
      total: parseFloat((o.total_price as string) || '0'),
      subtotal: parseFloat((o.subtotal_price as string) || '0'),
      tax: parseFloat((o.total_tax as string) || '0'),
      shipping: parseFloat(((o.total_shipping_price_set as Record<string, Record<string, string>>)?.shop_money?.amount) || '0'),
      currency: (o.currency as string) || 'USD',
      itemCount: ((o.line_items as unknown[]) || []).length,
      items: ((o.line_items as Array<Record<string, unknown>>) || []).map(i => ({
        sku: (i.sku as string) || '',
        name: (i.title as string) || '',
        qty: (i.quantity as number) || 0,
        price: parseFloat((i.price as string) || '0'),
        total: parseFloat((i.price as string) || '0') * ((i.quantity as number) || 0),
      })),
      createdAt: (o.created_at as string) || null,
    }));
  }

  // ============================================================
  // SFCC (Salesforce Commerce Cloud) OCAPI
  // ============================================================

  private async connectSFCC(): Promise<void> {
    const response = await this.makeRequest({
      method: 'GET',
      url: this.buildUrl('/s/-/dw/data/v21_3/sites'),
      headers: this.getAuthHeaders(),
      timeout: 15000,
    });
    if (response.status !== 200) {
      throw new ConnectorError('SFCC connect failed', 'SFCC_CONNECT_FAILED', response.status);
    }
  }

  private async extractSFCCProducts(): Promise<CommerceProduct[]> {
    const siteId = (this.config.connectionDetails.siteId as string) || 'default';
    return this.paginateRequest<CommerceProduct, { hits: Array<Record<string, unknown>>; total: number; next?: Record<string, unknown> }>(
      {
        method: 'POST',
        url: this.buildUrl(`/s/${siteId}/dw/shop/v21_3/product_search`),
        headers: this.getAuthHeaders(),
        body: { query: { match_all_query: {} }, count: this.pageSize, start: 0 },
      },
      (response) => (response.hits || []).map(h => {
        const p = (h.product as Record<string, unknown>) || h;
        return this.mapSFCCProduct(p);
      }),
      (response, currentOptions) => {
        const body = currentOptions.body as { start: number; count: number; query: unknown };
        const nextStart = body.start + body.count;
        if (nextStart >= (response.total || 0)) return null;
        return { ...currentOptions, body: { ...body, start: nextStart } };
      },
      'Extracting SFCC products',
    );
  }

  private mapSFCCProduct(p: Record<string, unknown>): CommerceProduct {
    return {
      id: (p.id as string) || '',
      sku: (p.id as string) || '',
      name: (p.name as string) || '',
      description: (p.long_description as string) || (p.short_description as string) || '',
      type: (p.type as Record<string, boolean>)?.master ? 'configurable' : 'simple',
      status: (p.online as boolean) !== false ? 'enabled' : 'disabled',
      price: (p.price as number) || 0,
      currency: (p.currency as string) || 'USD',
      categories: ((p.primary_category_id as string) ? [p.primary_category_id as string] : []),
      images: ((p.image_groups as Array<Record<string, unknown>>) || []).slice(0, 1).flatMap(g =>
        ((g.images as Array<Record<string, unknown>>) || []).map((img, i) => ({
          url: (img.link as string) || '',
          label: (img.alt as string) || '',
          position: i,
          isDefault: i === 0,
        })),
      ),
      variants: ((p.variants as Array<Record<string, unknown>>) || []).map(v => ({
        id: (v.product_id as string) || '',
        sku: (v.product_id as string) || '',
        name: '',
        price: (v.price as number) || 0,
        attributes: (v.variation_values as Record<string, string>) || {},
        inventory: null,
      })),
      attributes: {},
      inventory: (p.inventory as Record<string, unknown>)
        ? { qty: ((p.inventory as Record<string, unknown>).stock_level as number) || 0, inStock: ((p.inventory as Record<string, unknown>).orderable as boolean) || false }
        : null,
      createdAt: null,
      updatedAt: null,
    };
  }

  private async extractSFCCCategories(): Promise<CommerceCategory[]> {
    const siteId = (this.config.connectionDetails.siteId as string) || 'default';
    const response = await this.makeRequest<Record<string, unknown>>({
      method: 'GET',
      url: this.buildUrl(`/s/${siteId}/dw/shop/v21_3/categories/root`),
      headers: this.getAuthHeaders(),
      queryParams: { levels: '4' },
    });
    return this.flattenSFCCCategories(response.data);
  }

  private flattenSFCCCategories(
    node: Record<string, unknown>,
    result: CommerceCategory[] = [],
    level: number = 0,
  ): CommerceCategory[] {
    result.push({
      id: (node.id as string) || '',
      name: (node.name as string) || '',
      parentId: (node.parent_category_id as string) || null,
      path: (node.id as string) || '',
      level,
      position: 0,
      productCount: 0,
      isActive: (node.online as boolean) !== false,
      children: [],
    });
    for (const child of ((node.categories as Array<Record<string, unknown>>) || [])) {
      this.flattenSFCCCategories(child, result, level + 1);
    }
    return result;
  }

  private async extractSFCCCustomers(limit: number): Promise<CommerceCustomer[]> {
    const response = await this.makeRequest<{ hits: Array<Record<string, unknown>> }>({
      method: 'POST',
      url: this.buildUrl('/s/-/dw/data/v21_3/customer_search'),
      headers: this.getAuthHeaders(),
      body: { query: { match_all_query: {} }, count: limit, start: 0 },
    });

    return (response.data.hits || []).map((c) => ({
      id: (c.customer_no as string) || '',
      email: (c.email as string) || '',
      firstName: (c.first_name as string) || '',
      lastName: (c.last_name as string) || '',
      group: '',
      createdAt: (c.creation_date as string) || null,
      orderCount: 0,
      totalSpent: 0,
      addresses: [],
    }));
  }

  private async extractSFCCOrders(limit: number): Promise<CommerceOrder[]> {
    const response = await this.makeRequest<{ hits: Array<Record<string, unknown>> }>({
      method: 'POST',
      url: this.buildUrl('/s/-/dw/data/v21_3/order_search'),
      headers: this.getAuthHeaders(),
      body: { query: { match_all_query: {} }, count: limit, start: 0, sorts: [{ field: 'creation_date', sort_order: 'desc' }] },
    });

    return (response.data.hits || []).map((o) => {
      const data = (o.data as Record<string, unknown>) || o;
      return {
        id: (data.order_no as string) || '',
        orderNumber: (data.order_no as string) || '',
        status: (data.status as string) || '',
        customerId: (data.customer_no as string) || null,
        email: (data.customer_info as Record<string, unknown>)?.email as string || '',
        total: (data.order_total as number) || 0,
        subtotal: (data.product_sub_total as number) || 0,
        tax: (data.tax_total as number) || 0,
        shipping: (data.shipping_total as number) || 0,
        currency: (data.currency as string) || 'USD',
        itemCount: ((data.product_items as unknown[]) || []).length,
        items: ((data.product_items as Array<Record<string, unknown>>) || []).map(i => ({
          sku: (i.product_id as string) || '',
          name: (i.product_name as string) || '',
          qty: (i.quantity as number) || 0,
          price: (i.base_price as number) || 0,
          total: (i.price as number) || 0,
        })),
        createdAt: (data.creation_date as string) || null,
      };
    });
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new ConnectorError('Not connected. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  private normalizeMagentoType(typeId: string): CommerceProduct['type'] {
    const map: Record<string, CommerceProduct['type']> = {
      simple: 'simple',
      configurable: 'configurable',
      grouped: 'grouped',
      bundle: 'bundle',
      virtual: 'virtual',
      downloadable: 'downloadable',
    };
    return map[typeId] || 'simple';
  }
}
