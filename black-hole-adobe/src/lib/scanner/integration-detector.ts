/**
 * Integration Discovery Engine — ADR-033
 *
 * Detects third-party integrations from page HTML and response headers.
 * This is the "External Discovery" layer (confidence 50-70%) that runs
 * as part of the public health score scan. Deep discovery (codebase
 * analysis) is a separate paid-tier feature.
 */

import type { RawScanData } from '@/types/scanner';

// ============================================================
// Types
// ============================================================

export type IntegrationCategory =
  | 'analytics'
  | 'personalization'
  | 'marketing'
  | 'cdn'
  | 'ecommerce'
  | 'social'
  | 'media';

export type AemcsCompatibility =
  | 'compatible'
  | 'needs-modification'
  | 'needs-replacement'
  | 'unknown';

export interface DetectedIntegration {
  name: string;
  category: IntegrationCategory;
  confidence: number;
  signals: string[];
  aemcsCompatibility: AemcsCompatibility;
  migrationNotes: string;
}

// ============================================================
// Detection Rules
// ============================================================

interface DetectionRule {
  name: string;
  category: IntegrationCategory;
  aemcsCompatibility: AemcsCompatibility;
  migrationNotes: string;
  /** Patterns to match in the HTML body. */
  htmlPatterns?: Array<{ pattern: RegExp; signal: string; weight: number }>;
  /** Patterns to match in response headers (key = header name, lowercase). */
  headerPatterns?: Array<{
    header: string;
    pattern: RegExp;
    signal: string;
    weight: number;
  }>;
}

const DETECTION_RULES: DetectionRule[] = [
  // ─── Analytics & Tag Management ──────────────────────────

  {
    name: 'Adobe Analytics',
    category: 'analytics',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Adobe Analytics works natively with AEMaaCS. Verify Launch property is updated to reference new Cloud Service domains.',
    htmlPatterns: [
      { pattern: /s_code\.js/i, signal: 'Script: s_code.js', weight: 30 },
      { pattern: /AppMeasurement\.js/i, signal: 'Script: AppMeasurement.js', weight: 30 },
      { pattern: /\/\/assets\.adobedtm\.com/i, signal: 'Adobe DTM/Launch CDN reference', weight: 25 },
      { pattern: /\b_satellite\b/i, signal: 'Adobe Launch _satellite object', weight: 20 },
    ],
  },
  {
    name: 'Google Analytics',
    category: 'analytics',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Google Analytics is CDN-hosted and domain-agnostic. Update allowed domains in GA property settings after migration.',
    htmlPatterns: [
      { pattern: /googletagmanager\.com/i, signal: 'Google Tag Manager script', weight: 30 },
      { pattern: /gtag\s*\(/i, signal: 'gtag() function call', weight: 25 },
      { pattern: /\/analytics\.js/i, signal: 'Script: analytics.js (Universal Analytics)', weight: 25 },
      { pattern: /\/ga\.js/i, signal: 'Script: ga.js (legacy GA)', weight: 20 },
    ],
  },
  {
    name: 'Adobe Launch / DTM',
    category: 'analytics',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Adobe Launch is the recommended tag manager for AEMaaCS. Ensure the embed code references the correct environment after migration.',
    htmlPatterns: [
      { pattern: /assets\.adobedtm\.com/i, signal: 'Adobe Launch/DTM CDN embed', weight: 30 },
      { pattern: /\b_satellite\b/i, signal: 'Adobe Launch _satellite runtime', weight: 20 },
    ],
  },
  {
    name: 'Tealium',
    category: 'analytics',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Tealium is externally hosted. Update publish settings and domain allowlists after migration.',
    htmlPatterns: [
      { pattern: /tags\.tiqcdn\.com/i, signal: 'Tealium iQ CDN', weight: 30 },
      { pattern: /utag\.js/i, signal: 'Script: utag.js', weight: 25 },
    ],
  },
  {
    name: 'Segment',
    category: 'analytics',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Segment is CDN-hosted. Update source domain settings after migration.',
    htmlPatterns: [
      { pattern: /cdn\.segment\.com/i, signal: 'Segment CDN', weight: 30 },
      { pattern: /analytics\.js/i, signal: 'Segment analytics.js (ambiguous with GA)', weight: 10 },
    ],
  },

  // ─── Personalization & Testing ───────────────────────────

  {
    name: 'Adobe Target',
    category: 'personalization',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Adobe Target integrates natively with AEMaaCS via IMS. Verify at.js version and mbox configuration after migration.',
    htmlPatterns: [
      { pattern: /\bat\.js\b/i, signal: 'Script: at.js', weight: 25 },
      { pattern: /\bmbox\b/i, signal: 'Adobe Target mbox reference', weight: 20 },
      { pattern: /tt\.omtrdc\.net/i, signal: 'Adobe Target delivery domain', weight: 30 },
    ],
  },
  {
    name: 'Optimizely',
    category: 'personalization',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Optimizely is externally hosted. No AEMaaCS-specific changes required beyond domain updates.',
    htmlPatterns: [
      { pattern: /cdn\.optimizely\.com/i, signal: 'Optimizely CDN', weight: 30 },
    ],
  },
  {
    name: 'Google Optimize',
    category: 'personalization',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Google Optimize is loaded via GTM or inline snippet. No server-side changes needed.',
    htmlPatterns: [
      { pattern: /optimize\.google\.com/i, signal: 'Google Optimize script', weight: 30 },
    ],
  },

  // ─── Marketing Automation ────────────────────────────────

  {
    name: 'Marketo',
    category: 'marketing',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Marketo forms embedded via JS are compatible. Server-side Marketo REST API calls require AEMaaCS Advanced Networking (dedicated egress IP) if Marketo IP-whitelists the caller.',
    htmlPatterns: [
      { pattern: /munchkin\.js/i, signal: 'Marketo Munchkin tracking', weight: 30 },
      { pattern: /\bmkto\b/i, signal: 'Marketo form/embed reference', weight: 15 },
      { pattern: /marketo\.com/i, signal: 'Marketo domain reference', weight: 20 },
    ],
  },
  {
    name: 'HubSpot',
    category: 'marketing',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'HubSpot tracking code and forms are externally hosted. No server-side dependency.',
    htmlPatterns: [
      { pattern: /js\.hs-scripts\.com/i, signal: 'HubSpot tracking script', weight: 30 },
      { pattern: /hs-banner\.com/i, signal: 'HubSpot banner/consent', weight: 20 },
    ],
  },
  {
    name: 'Pardot',
    category: 'marketing',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Pardot tracking JS is compatible. Server-side form handlers posting to Pardot may need Advanced Networking for static egress IP.',
    htmlPatterns: [
      { pattern: /pi\.pardot\.com/i, signal: 'Pardot tracking pixel', weight: 30 },
      { pattern: /pardot\.com/i, signal: 'Pardot domain reference', weight: 20 },
    ],
  },
  {
    name: 'Eloqua',
    category: 'marketing',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Eloqua client-side JS is compatible. Server-side bulk API or SOAP integrations require Advanced Networking.',
    htmlPatterns: [
      { pattern: /eloqua\.com/i, signal: 'Eloqua domain reference', weight: 25 },
      { pattern: /\belqCfg\b/i, signal: 'Eloqua config object', weight: 25 },
    ],
  },

  // ─── CDN & Infrastructure ────────────────────────────────

  {
    name: 'Fastly',
    category: 'cdn',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'AEMaaCS includes a built-in Fastly CDN. Custom Fastly configurations must be migrated to the Adobe-managed CDN or use a BYOCDN setup.',
    htmlPatterns: [
      { pattern: /fastly\.net/i, signal: 'Fastly domain in asset URL', weight: 20 },
    ],
    headerPatterns: [
      { header: 'x-served-by', pattern: /cache-/i, signal: 'Fastly x-served-by header', weight: 25 },
    ],
  },
  {
    name: 'Akamai',
    category: 'cdn',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'AEMaaCS has its own CDN (Fastly). Akamai can be retained as a BYOCDN but requires origin reconfiguration to point at the Cloud Service publish tier.',
    htmlPatterns: [
      { pattern: /akamaized\.net/i, signal: 'Akamai CDN domain', weight: 25 },
    ],
    headerPatterns: [
      { header: 'x-akamai-transformed', pattern: /.+/, signal: 'Akamai x-akamai-transformed header', weight: 25 },
      { header: 'x-akamai-request-id', pattern: /.+/, signal: 'Akamai x-akamai-request-id header', weight: 25 },
      { header: 'x-cache', pattern: /akamai/i, signal: 'Akamai x-cache header', weight: 20 },
    ],
  },
  {
    name: 'Cloudflare',
    category: 'cdn',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Cloudflare can be retained as a BYOCDN. Reconfigure origin to point at the AEMaaCS publish tier. Disable features that conflict with Adobe CDN (e.g., Rocket Loader, Auto Minify).',
    headerPatterns: [
      { header: 'cf-ray', pattern: /.+/, signal: 'Cloudflare cf-ray header', weight: 30 },
      { header: 'server', pattern: /cloudflare/i, signal: 'Cloudflare server header', weight: 25 },
    ],
    htmlPatterns: [
      { pattern: /cloudflare/i, signal: 'Cloudflare reference in HTML', weight: 10 },
    ],
  },
  {
    name: 'CloudFront',
    category: 'cdn',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'CloudFront can be retained as a BYOCDN. Update origin to point at AEMaaCS publish tier and configure cache invalidation via Adobe Cloud Manager.',
    headerPatterns: [
      { header: 'x-amz-cf-id', pattern: /.+/, signal: 'CloudFront x-amz-cf-id header', weight: 30 },
      { header: 'x-amz-cf-pop', pattern: /.+/, signal: 'CloudFront x-amz-cf-pop header', weight: 25 },
      { header: 'via', pattern: /cloudfront/i, signal: 'CloudFront via header', weight: 20 },
    ],
  },

  // ─── E-Commerce ──────────────────────────────────────────

  {
    name: 'Adobe Commerce / Magento',
    category: 'ecommerce',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Adobe Commerce integration with AEMaaCS uses the Commerce Integration Framework (CIF). Existing custom Magento integrations must be refactored to use CIF or GraphQL APIs.',
    htmlPatterns: [
      { pattern: /\bMagento\b/i, signal: 'Magento reference', weight: 20 },
      { pattern: /\bmage\//i, signal: 'Magento mage/ module path', weight: 25 },
      { pattern: /requirejs-config/i, signal: 'RequireJS config (common in Magento)', weight: 15 },
    ],
  },
  {
    name: 'Shopify',
    category: 'ecommerce',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Shopify is a headless/external platform. Buy buttons and Storefront API calls are client-side and unaffected by AEM migration.',
    htmlPatterns: [
      { pattern: /cdn\.shopify\.com/i, signal: 'Shopify CDN', weight: 30 },
    ],
  },
  {
    name: 'Salesforce Commerce Cloud',
    category: 'ecommerce',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Demandware/SFCC integration typically uses server-side API calls that require AEMaaCS Advanced Networking for egress IP allowlisting.',
    htmlPatterns: [
      { pattern: /demandware\.net/i, signal: 'Salesforce Commerce (Demandware) domain', weight: 30 },
    ],
  },

  // ─── Social & Chat ───────────────────────────────────────

  {
    name: 'Facebook Pixel',
    category: 'social',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'Facebook Pixel is client-side only. Update domain verification in Facebook Business Manager after migration.',
    htmlPatterns: [
      { pattern: /\bfbq\s*\(/i, signal: 'Facebook Pixel fbq() call', weight: 25 },
      { pattern: /connect\.facebook\.net/i, signal: 'Facebook SDK script', weight: 25 },
    ],
  },
  {
    name: 'LinkedIn Insight Tag',
    category: 'social',
    aemcsCompatibility: 'compatible',
    migrationNotes:
      'LinkedIn Insight Tag is client-side. No server-side changes needed.',
    htmlPatterns: [
      { pattern: /snap\.licdn\.com/i, signal: 'LinkedIn Insight script', weight: 30 },
      { pattern: /_linkedin_data_partner_ids/i, signal: 'LinkedIn data partner IDs', weight: 25 },
    ],
  },
  {
    name: 'Drift',
    category: 'social',
    aemcsCompatibility: 'compatible',
    migrationNotes: 'Drift chat widget is client-side. No migration impact.',
    htmlPatterns: [
      { pattern: /js\.driftt\.com/i, signal: 'Drift chat script', weight: 30 },
      { pattern: /drift\.com/i, signal: 'Drift domain reference', weight: 15 },
    ],
  },
  {
    name: 'Intercom',
    category: 'social',
    aemcsCompatibility: 'compatible',
    migrationNotes: 'Intercom widget is client-side. No migration impact.',
    htmlPatterns: [
      { pattern: /widget\.intercom\.io/i, signal: 'Intercom widget script', weight: 30 },
      { pattern: /intercomSettings/i, signal: 'Intercom settings object', weight: 20 },
    ],
  },
  {
    name: 'Zendesk',
    category: 'social',
    aemcsCompatibility: 'compatible',
    migrationNotes: 'Zendesk chat/web widget is client-side. No migration impact.',
    htmlPatterns: [
      { pattern: /static\.zdassets\.com/i, signal: 'Zendesk assets CDN', weight: 30 },
      { pattern: /zopim/i, signal: 'Zendesk/Zopim chat reference', weight: 20 },
    ],
  },

  // ─── DAM & Media ─────────────────────────────────────────

  {
    name: 'Scene7 / Dynamic Media',
    category: 'media',
    aemcsCompatibility: 'needs-modification',
    migrationNotes:
      'Dynamic Media is available in AEMaaCS but requires re-provisioning. Scene7 Classic endpoints must migrate to Dynamic Media with OpenAPI or DM Next Gen.',
    htmlPatterns: [
      { pattern: /scene7\.com/i, signal: 'Scene7 domain reference', weight: 30 },
      { pattern: /\bs7viewers\b/i, signal: 'Scene7 viewer library', weight: 25 },
      { pattern: /is\/image\//i, signal: 'Dynamic Media image serving URL', weight: 20 },
    ],
  },
  {
    name: 'YouTube Embeds',
    category: 'media',
    aemcsCompatibility: 'compatible',
    migrationNotes: 'YouTube embeds are client-side iframes. No migration impact.',
    htmlPatterns: [
      { pattern: /youtube\.com\/embed/i, signal: 'YouTube embed iframe', weight: 30 },
      { pattern: /youtube\.com\/iframe_api/i, signal: 'YouTube iframe API', weight: 25 },
      { pattern: /youtu\.be\//i, signal: 'YouTube short URL reference', weight: 15 },
    ],
  },
  {
    name: 'Vimeo Embeds',
    category: 'media',
    aemcsCompatibility: 'compatible',
    migrationNotes: 'Vimeo embeds are client-side iframes. No migration impact.',
    htmlPatterns: [
      { pattern: /player\.vimeo\.com/i, signal: 'Vimeo player embed', weight: 30 },
      { pattern: /vimeo\.com\/video/i, signal: 'Vimeo video URL', weight: 25 },
    ],
  },
];

// ============================================================
// Deduplication
// ============================================================

/**
 * Some rules share signal patterns (e.g., Adobe Analytics and Adobe
 * Launch both look for `assets.adobedtm.com`). When the same named
 * integration appears more than once we keep only the highest-
 * confidence entry and merge signals.
 */
function deduplicateIntegrations(
  integrations: DetectedIntegration[],
): DetectedIntegration[] {
  const map = new Map<string, DetectedIntegration>();

  for (const integration of integrations) {
    const existing = map.get(integration.name);
    if (!existing) {
      map.set(integration.name, { ...integration });
      continue;
    }
    // Merge: keep highest confidence and union signals
    const merged = { ...existing };
    merged.confidence = Math.max(merged.confidence, integration.confidence);
    const signalSet = new Set([...merged.signals, ...integration.signals]);
    merged.signals = [...signalSet];
    map.set(integration.name, merged);
  }

  return [...map.values()];
}

// ============================================================
// Public API
// ============================================================

/**
 * Scan page HTML and response headers to detect third-party
 * integrations. Returns an array of detected integrations sorted
 * by confidence (highest first).
 */
export function detectIntegrations(raw: RawScanData): DetectedIntegration[] {
  const results: DetectedIntegration[] = [];

  for (const rule of DETECTION_RULES) {
    const signals: string[] = [];
    let totalWeight = 0;

    // Match HTML patterns
    if (rule.htmlPatterns) {
      for (const { pattern, signal, weight } of rule.htmlPatterns) {
        if (pattern.test(raw.html)) {
          signals.push(signal);
          totalWeight += weight;
        }
      }
    }

    // Match header patterns
    if (rule.headerPatterns) {
      for (const { header, pattern, signal, weight } of rule.headerPatterns) {
        const headerValue = raw.headers[header.toLowerCase()];
        if (headerValue && pattern.test(headerValue)) {
          signals.push(`${signal} (${headerValue})`);
          totalWeight += weight;
        }
      }
    }

    if (signals.length > 0) {
      // Confidence is capped at 70 for external-only discovery (per ADR-033)
      const confidence = Math.min(70, totalWeight);

      results.push({
        name: rule.name,
        category: rule.category,
        confidence,
        signals,
        aemcsCompatibility: rule.aemcsCompatibility,
        migrationNotes: rule.migrationNotes,
      });
    }
  }

  const deduplicated = deduplicateIntegrations(results);

  // Sort by confidence descending, then alphabetically
  deduplicated.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });

  return deduplicated;
}

/**
 * Convenience: returns a summary count by category.
 */
export function summarizeByCategory(
  integrations: DetectedIntegration[],
): Record<IntegrationCategory, number> {
  const summary: Record<IntegrationCategory, number> = {
    analytics: 0,
    personalization: 0,
    marketing: 0,
    cdn: 0,
    ecommerce: 0,
    social: 0,
    media: 0,
  };

  for (const integration of integrations) {
    summary[integration.category]++;
  }

  return summary;
}

/**
 * Convenience: returns integrations grouped by AEMaaCS compatibility.
 */
export function groupByCompatibility(
  integrations: DetectedIntegration[],
): Record<AemcsCompatibility, DetectedIntegration[]> {
  const groups: Record<AemcsCompatibility, DetectedIntegration[]> = {
    compatible: [],
    'needs-modification': [],
    'needs-replacement': [],
    unknown: [],
  };

  for (const integration of integrations) {
    groups[integration.aemcsCompatibility].push(integration);
  }

  return groups;
}
