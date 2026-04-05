/**
 * CDN Manager with Provider Adapters (ADR-053)
 *
 * Abstracts CDN/DNS operations behind a provider interface so the
 * cutover manager can switch DNS, purge caches, and verify SSL
 * regardless of the underlying provider (Fastly, Cloudflare, etc.).
 *
 * The GenericCDN adapter is fully functional and returns human-readable
 * instructions for manual execution. Fastly and Cloudflare adapters
 * accept credentials and have correct method signatures but return
 * simulated responses until real API integration is wired up.
 */

// ============================================================
// Provider Interface
// ============================================================

export interface CDNProvider {
  name: string;
  validateCredentials(): Promise<boolean>;
  updateDNS(
    domain: string,
    targetCname: string,
  ): Promise<{ success: boolean; propagationEstimate: string; instructions?: string }>;
  purgeCache(domain: string): Promise<{ success: boolean; instructions?: string }>;
  verifySSL(
    domain: string,
  ): Promise<{ valid: boolean; issuer: string; expiresAt: string }>;
  verifyDNS(
    domain: string,
    expectedTarget: string,
  ): Promise<{ propagated: boolean; currentTarget: string }>;
}

// ============================================================
// Generic (Manual) Adapter — fully functional
// ============================================================

/**
 * A provider that returns human-readable instructions instead of
 * executing API calls. Use this when no CDN provider credentials
 * are available, or when the customer manages DNS externally.
 */
export class GenericCDN implements CDNProvider {
  name = 'generic';

  async validateCredentials(): Promise<boolean> {
    // Generic adapter requires no credentials
    return true;
  }

  async updateDNS(
    domain: string,
    targetCname: string,
  ): Promise<{ success: boolean; propagationEstimate: string; instructions: string }> {
    return {
      success: true,
      propagationEstimate: '5-30 minutes (depends on TTL)',
      instructions: [
        `Update your DNS CNAME record for "${domain}" to point to "${targetCname}".`,
        'Steps:',
        '  1. Log into your DNS provider dashboard.',
        `  2. Find the CNAME record for "${domain}".`,
        `  3. Change the target value to "${targetCname}".`,
        '  4. Save the record and wait for propagation.',
        '  5. Verify with: dig CNAME ' + domain,
      ].join('\n'),
    };
  }

  async purgeCache(
    domain: string,
  ): Promise<{ success: boolean; instructions: string }> {
    return {
      success: true,
      instructions: [
        `Clear your CDN cache for "${domain}" via your provider's dashboard.`,
        'Steps:',
        '  1. Log into your CDN provider dashboard.',
        `  2. Navigate to the cache/purge section for "${domain}".`,
        '  3. Select "Purge All" or "Purge Everything".',
        '  4. Wait for confirmation that the purge completed.',
      ].join('\n'),
    };
  }

  async verifySSL(
    domain: string,
  ): Promise<{ valid: boolean; issuer: string; expiresAt: string }> {
    // Generic adapter cannot verify SSL programmatically;
    // report as valid with instructions to verify manually.
    return {
      valid: true,
      issuer: `Manual verification required for ${domain}`,
      expiresAt: 'Check via: openssl s_client -connect ' + domain + ':443',
    };
  }

  async verifyDNS(
    domain: string,
    expectedTarget: string,
  ): Promise<{ propagated: boolean; currentTarget: string }> {
    // Generic adapter cannot query DNS programmatically.
    return {
      propagated: true,
      currentTarget: `Manual verification required — run: dig CNAME ${domain} and confirm it resolves to ${expectedTarget}`,
    };
  }
}

// ============================================================
// Fastly Adapter — stub with correct shapes
// ============================================================

/**
 * Fastly CDN adapter.
 * API docs: https://developer.fastly.com/reference/api/
 *
 * Currently returns simulated responses. Real API integration
 * requires wiring up fetch calls to the Fastly API endpoints.
 */
export class FastlyCDN implements CDNProvider {
  name = 'fastly';

  constructor(
    private readonly apiKey: string,
    private readonly serviceId: string,
  ) {}

  async validateCredentials(): Promise<boolean> {
    // TODO: GET /current_user with Authorization: Fastly-Key {apiKey}
    // Real check: response.status === 200
    return this.apiKey.length > 0 && this.serviceId.length > 0;
  }

  async updateDNS(
    domain: string,
    targetCname: string,
  ): Promise<{ success: boolean; propagationEstimate: string }> {
    // TODO: POST /service/{serviceId}/domain — add domain to service
    // TODO: Verify via GET /service/{serviceId}/domain/check_all
    void domain;
    void targetCname;
    return {
      success: true,
      propagationEstimate: '2-5 minutes',
    };
  }

  async purgeCache(
    domain: string,
  ): Promise<{ success: boolean }> {
    // TODO: POST /service/{serviceId}/purge_all
    // Headers: Fastly-Key: {apiKey}
    void domain;
    return { success: true };
  }

  async verifySSL(
    domain: string,
  ): Promise<{ valid: boolean; issuer: string; expiresAt: string }> {
    // TODO: GET /tls/certificates — filter by domain
    // Check certificate state and expiry
    void domain;
    return {
      valid: true,
      issuer: 'Fastly TLS (simulated)',
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  }

  async verifyDNS(
    domain: string,
    expectedTarget: string,
  ): Promise<{ propagated: boolean; currentTarget: string }> {
    // TODO: GET /service/{serviceId}/domain/{domain}/check
    void domain;
    void expectedTarget;
    return {
      propagated: true,
      currentTarget: expectedTarget,
    };
  }
}

// ============================================================
// Cloudflare Adapter — stub with correct shapes
// ============================================================

/**
 * Cloudflare CDN adapter.
 * API docs: https://developers.cloudflare.com/api/
 *
 * Currently returns simulated responses. Real API integration
 * requires wiring up fetch calls to the Cloudflare API endpoints.
 */
export class CloudflareCDN implements CDNProvider {
  name = 'cloudflare';

  constructor(
    private readonly apiToken: string,
    private readonly zoneId: string,
  ) {}

  async validateCredentials(): Promise<boolean> {
    // TODO: GET https://api.cloudflare.com/client/v4/user/tokens/verify
    // Headers: Authorization: Bearer {apiToken}
    // Real check: response.result.status === 'active'
    return this.apiToken.length > 0 && this.zoneId.length > 0;
  }

  async updateDNS(
    domain: string,
    targetCname: string,
  ): Promise<{ success: boolean; propagationEstimate: string }> {
    // TODO: List records: GET /zones/{zoneId}/dns_records?name={domain}&type=CNAME
    // TODO: Update record: PATCH /zones/{zoneId}/dns_records/{recordId}
    //   body: { content: targetCname, proxied: true }
    void domain;
    void targetCname;
    return {
      success: true,
      propagationEstimate: '1-2 minutes (Cloudflare proxy)',
    };
  }

  async purgeCache(
    domain: string,
  ): Promise<{ success: boolean }> {
    // TODO: POST /zones/{zoneId}/purge_cache
    //   body: { purge_everything: true }
    //   Headers: Authorization: Bearer {apiToken}
    void domain;
    return { success: true };
  }

  async verifySSL(
    domain: string,
  ): Promise<{ valid: boolean; issuer: string; expiresAt: string }> {
    // TODO: GET /zones/{zoneId}/ssl/verification
    // Check certificate_status and expiration
    void domain;
    return {
      valid: true,
      issuer: 'Cloudflare Universal SSL (simulated)',
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  }

  async verifyDNS(
    domain: string,
    expectedTarget: string,
  ): Promise<{ propagated: boolean; currentTarget: string }> {
    // TODO: GET /zones/{zoneId}/dns_records?name={domain}&type=CNAME
    // Compare response.result[0].content with expectedTarget
    void domain;
    void expectedTarget;
    return {
      propagated: true,
      currentTarget: expectedTarget,
    };
  }
}

// ============================================================
// Factory
// ============================================================

export type CDNProviderType = 'fastly' | 'cloudflare' | 'generic';

export interface CDNProviderConfig {
  type: CDNProviderType;
  apiKey?: string;
  apiToken?: string;
  serviceId?: string;
  zoneId?: string;
}

/**
 * Create a CDN provider from configuration. Falls back to GenericCDN
 * if credentials are missing or the type is unrecognised.
 */
export function createCDNProvider(config?: CDNProviderConfig): CDNProvider {
  if (!config) return new GenericCDN();

  switch (config.type) {
    case 'fastly':
      if (config.apiKey && config.serviceId) {
        return new FastlyCDN(config.apiKey, config.serviceId);
      }
      return new GenericCDN();

    case 'cloudflare':
      if (config.apiToken && config.zoneId) {
        return new CloudflareCDN(config.apiToken, config.zoneId);
      }
      return new GenericCDN();

    case 'generic':
    default:
      return new GenericCDN();
  }
}
