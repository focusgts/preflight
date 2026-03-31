/**
 * DNS Resolution Utility — Tier 1 Detection
 *
 * Uses Google DNS-over-HTTPS to resolve CNAME records for a domain,
 * checking for AEM Cloud Service, Edge Delivery, and CDN indicators.
 */

// ============================================================
// Types
// ============================================================

export interface DNSResult {
  cnames: string[];
  isAEMCloud: boolean;
  isEdgeDelivery: boolean;
  cdnProvider: string | null;
  confidence: number;
  error: string | null;
}

interface GoogleDNSResponse {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

// ============================================================
// Constants
// ============================================================

const DNS_TIMEOUT_MS = 3000;
const GOOGLE_DNS_URL = 'https://dns.google/resolve';
const USER_AGENT = 'BlackHole-Scanner/1.0 (AEM Health Check; focusgts.com)';

const AEM_CLOUD_CNAME = 'adobeaemcloud.com';
const EDGE_DELIVERY_CNAMES = ['aem.live', 'hlx.live'];
const CDN_INDICATORS: Record<string, string> = {
  akamai: 'akamai',
  cloudfront: 'cloudfront',
  fastly: 'fastly',
  edgekey: 'akamai',
  edgesuite: 'akamai',
  'cloudflare': 'cloudflare',
};

// ============================================================
// DNS Resolver
// ============================================================

/**
 * Resolve CNAME records for a domain using Google DNS-over-HTTPS.
 * Returns structured result with AEM/EDS/CDN classification.
 */
export async function resolveCNAME(domain: string): Promise<DNSResult> {
  const result: DNSResult = {
    cnames: [],
    isAEMCloud: false,
    isEdgeDelivery: false,
    cdnProvider: null,
    confidence: 0,
    error: null,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

    const url = `${GOOGLE_DNS_URL}?name=${encodeURIComponent(domain)}&type=CNAME`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/dns-json',
        'User-Agent': USER_AGENT,
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      result.error = `DNS lookup returned HTTP ${response.status}`;
      return result;
    }

    const data: GoogleDNSResponse = await response.json();

    if (data.Status !== 0) {
      // Non-zero status means no records or error — not necessarily a problem
      return result;
    }

    if (!data.Answer || data.Answer.length === 0) {
      return result;
    }

    // Collect all CNAME records (type 5)
    result.cnames = data.Answer
      .filter((record) => record.type === 5)
      .map((record) => record.data.replace(/\.$/, '').toLowerCase());

    // Check if the domain itself is on adobeaemcloud.com (sandbox/direct URLs)
    if (domain.toLowerCase().endsWith(AEM_CLOUD_CNAME)) {
      result.isAEMCloud = true;
      result.confidence = 99;
    }

    // Check for AEM Cloud Service in CNAME chain
    if (!result.isAEMCloud) {
      for (const cname of result.cnames) {
        if (cname.includes(AEM_CLOUD_CNAME)) {
          result.isAEMCloud = true;
          result.confidence = 99;
          break;
        }
      }
    }

    // Check for Edge Delivery Services
    if (!result.isAEMCloud) {
      for (const cname of result.cnames) {
        for (const edsCname of EDGE_DELIVERY_CNAMES) {
          if (cname.includes(edsCname)) {
            result.isEdgeDelivery = true;
            result.confidence = 99;
            break;
          }
        }
        if (result.isEdgeDelivery) break;
      }
    }

    // Check for CDN providers
    for (const cname of result.cnames) {
      for (const [pattern, provider] of Object.entries(CDN_INDICATORS)) {
        if (cname.includes(pattern)) {
          result.cdnProvider = provider;
          // CDN alone is a weak signal for AEM
          if (result.confidence === 0) {
            result.confidence = 10;
          }
          break;
        }
      }
      if (result.cdnProvider) break;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        result.error = 'DNS lookup timed out';
      } else {
        result.error = `DNS lookup failed: ${err.message}`;
      }
    } else {
      result.error = 'DNS lookup failed with unknown error';
    }
  }

  return result;
}
