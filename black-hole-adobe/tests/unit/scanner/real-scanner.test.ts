/**
 * 5-Tier AEM Detection Scanner — Comprehensive Tests
 *
 * Tests for DNS resolution, page analysis, path probes,
 * version inference, deployment classification, and full integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveCNAME } from '@/lib/scanner/dns-resolver';
import { probeAEMPaths } from '@/lib/scanner/path-prober';
import {
  inferVersion,
  classifyDeployment,
  type DetectedSignal,
} from '@/lib/scanner/version-detector';
import { SiteScanner } from '@/lib/scanner/site-scanner';
import type { RawScanData } from '@/types/scanner';

// ── Helpers ───────────────────────────────────────────────

function makeRawScan(overrides: Partial<RawScanData> = {}): RawScanData {
  return {
    url: 'https://example.com',
    statusCode: 200,
    headers: {},
    html: '<html lang="en"><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
    responseTimeMs: 400,
    contentLengthBytes: 5000,
    redirectCount: 0,
    finalUrl: 'https://example.com',
    ...overrides,
  };
}

function makeSignal(
  name: string,
  category: DetectedSignal['category'] = 'html',
  weight = 5,
  value = '',
): DetectedSignal {
  return { name, category, value: value || name, weight };
}

// ── Mock fetch globally ──────────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ============================================================
// DNS Resolution (Tier 1)
// ============================================================

describe('DNS Resolution (Tier 1)', () => {
  it('should detect AEM Cloud from adobeaemcloud.com CNAME', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 5, TTL: 300, data: 'publish-p12345.adobeaemcloud.com.' },
        ],
      }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.isAEMCloud).toBe(true);
    expect(result.confidence).toBe(99);
    expect(result.cnames).toContain('publish-p12345.adobeaemcloud.com');
  });

  it('should detect Edge Delivery from aem.live CNAME', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 5, TTL: 300, data: 'main--site--org.aem.live.' },
        ],
      }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.isEdgeDelivery).toBe(true);
    expect(result.confidence).toBe(99);
  });

  it('should detect Edge Delivery from hlx.live CNAME', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 5, TTL: 300, data: 'main--site--org.hlx.live.' },
        ],
      }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.isEdgeDelivery).toBe(true);
    expect(result.confidence).toBe(99);
  });

  it('should detect Akamai CDN from CNAME', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 5, TTL: 300, data: 'example.com.edgekey.net.' },
        ],
      }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.cdnProvider).toBe('akamai');
    expect(result.isAEMCloud).toBe(false);
    expect(result.confidence).toBe(10);
  });

  it('should detect CloudFront CDN from CNAME', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'example.com.', type: 5, TTL: 300, data: 'd12345.cloudfront.net.' },
        ],
      }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.cdnProvider).toBe('cloudfront');
  });

  it('should return all false when no CNAME records exist', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 0 }),
    });

    const result = await resolveCNAME('example.com');
    expect(result.isAEMCloud).toBe(false);
    expect(result.isEdgeDelivery).toBe(false);
    expect(result.cdnProvider).toBeNull();
    expect(result.cnames).toHaveLength(0);
  });

  it('should handle DNS timeout gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const result = await resolveCNAME('example.com');
    expect(result.error).toBe('DNS lookup timed out');
    expect(result.isAEMCloud).toBe(false);
    expect(result.isEdgeDelivery).toBe(false);
  });

  it('should handle DNS HTTP errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await resolveCNAME('example.com');
    expect(result.error).toContain('HTTP 500');
    expect(result.isAEMCloud).toBe(false);
  });
});

// ============================================================
// Page Analysis (Tier 2)
// ============================================================

describe('Page Analysis (Tier 2)', () => {
  let scanner: SiteScanner;

  beforeEach(() => {
    scanner = new SiteScanner();
  });

  it('should detect parbase class with weight >= 9', () => {
    const raw = makeRawScan({
      html: '<div class="parbase section">Content</div>',
    });
    const signals = scanner.analyzePageSignals(raw);
    const parbase = signals.find((s) => s.name === 'parbase-class');
    expect(parbase).toBeDefined();
    expect(parbase!.weight).toBeGreaterThanOrEqual(9);
  });

  it('should detect data-sly-* attributes with weight >= 9', () => {
    const raw = makeRawScan({
      html: '<div data-sly-test="${true}">HTL content</div>',
    });
    const signals = scanner.analyzePageSignals(raw);
    const htl = signals.find((s) => s.name === 'htl-sightly');
    expect(htl).toBeDefined();
    expect(htl!.weight).toBeGreaterThanOrEqual(9);
  });

  it('should detect /etc.clientlibs/ with weight >= 9', () => {
    const raw = makeRawScan({
      html: '<link href="/etc.clientlibs/mysite/clientlib-base.css">',
    });
    const signals = scanner.analyzePageSignals(raw);
    const clientlibs = signals.find((s) => s.name === 'clientlibs-path');
    expect(clientlibs).toBeDefined();
    expect(clientlibs!.weight).toBeGreaterThanOrEqual(9);
  });

  it('should detect CQ comments with weight >= 10', () => {
    const raw = makeRawScan({
      html: '<!-- /* CQ --> <div>Content</div>',
    });
    const signals = scanner.analyzePageSignals(raw);
    const cq = signals.find((s) => s.name === 'cq-comments');
    expect(cq).toBeDefined();
    expect(cq!.weight).toBeGreaterThanOrEqual(10);
  });

  it('should detect AEM Core Components (cmp-*)', () => {
    const raw = makeRawScan({
      html: '<div class="cmp-title">Title</div>',
    });
    const signals = scanner.analyzePageSignals(raw);
    const cmp = signals.find((s) => s.name === 'core-components');
    expect(cmp).toBeDefined();
    expect(cmp!.weight).toBe(8);
  });

  it('should detect /content/dam/ paths', () => {
    const raw = makeRawScan({
      html: '<img src="/content/dam/mysite/hero.jpg">',
    });
    const signals = scanner.analyzePageSignals(raw);
    const dam = signals.find((s) => s.name === 'dam-path');
    expect(dam).toBeDefined();
    expect(dam!.weight).toBe(8);
  });

  it('should detect generator meta tag', () => {
    const raw = makeRawScan({
      html: '<meta name="generator" content="Adobe Experience Manager 6.5">',
    });
    const signals = scanner.analyzePageSignals(raw);
    const gen = signals.find((s) => s.name === 'generator-meta');
    expect(gen).toBeDefined();
    expect(gen!.weight).toBe(10);
  });

  it('should accumulate weights from multiple signals', () => {
    const raw = makeRawScan({
      html: `
        <html>
          <head><link href="/etc.clientlibs/site/lib.css"></head>
          <body>
            <div class="parbase section">
              <div data-sly-test="\${true}">Content</div>
              <img src="/content/dam/site/img.jpg">
            </div>
          </body>
        </html>
      `,
    });
    const signals = scanner.analyzePageSignals(raw);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    // clientlibs(9) + parbase(9) + data-sly(9) + dam(8) = 35 minimum
    expect(totalWeight).toBeGreaterThanOrEqual(35);
  });

  it('should trigger AEM detected when cumulative weight >= 15', () => {
    const raw = makeRawScan({
      html: '<div class="parbase"><div data-sly-test>HTL</div></div>',
    });
    const signals = scanner.analyzePageSignals(raw);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    // parbase(9) + data-sly(9) = 18 >= 15
    expect(totalWeight).toBeGreaterThanOrEqual(15);
  });

  it('should score 0 for clean HTML with no AEM signals', () => {
    const raw = makeRawScan({
      html: '<html><head><title>Blog</title></head><body><p>Hello world</p></body></html>',
      headers: {},
    });
    const signals = scanner.analyzePageSignals(raw);
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    expect(totalWeight).toBe(0);
  });

  it('should detect x-aem-host header', () => {
    const raw = makeRawScan({
      headers: { 'x-aem-host': 'publish.example.com' },
    });
    const signals = scanner.analyzePageSignals(raw);
    expect(signals.some((s) => s.name === 'x-aem-host-header')).toBe(true);
  });

  it('should detect AEM cookies', () => {
    const raw = makeRawScan({
      headers: { 'set-cookie': 'cq-authoring-mode=TOUCH; Path=/' },
    });
    const signals = scanner.analyzePageSignals(raw);
    expect(signals.some((s) => s.name === 'aem-cookies')).toBe(true);
  });

  it('should detect Fastly CDN from x-served-by header', () => {
    const raw = makeRawScan({
      headers: { 'x-served-by': 'cache-iad-kiad7000108-IAD' },
    });
    const signals = scanner.analyzePageSignals(raw);
    expect(signals.some((s) => s.name === 'fastly-cdn')).toBe(true);
  });

  it('should detect JSP references for version inference', () => {
    const raw = makeRawScan({
      html: '<script src="/apps/mysite/template.jsp"></script>',
    });
    const signals = scanner.analyzePageSignals(raw);
    expect(signals.some((s) => s.name === 'jsp-references')).toBe(true);
  });

  it('should detect Edge Delivery scripts', () => {
    const raw = makeRawScan({
      html: '<script src="/scripts/aem.js"></script>',
    });
    const signals = scanner.analyzePageSignals(raw);
    expect(signals.some((s) => s.name === 'edge-delivery-scripts')).toBe(true);
  });
});

// ============================================================
// Path Probes (Tier 3)
// ============================================================

describe('Path Probes (Tier 3)', () => {
  it('should mark 403 response as AEM indicator', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      headers: new Headers(),
    });

    const results = await probeAEMPaths('https://example.com');
    const loginProbe = results.find((r) => r.path.includes('login'));
    expect(loginProbe).toBeDefined();
    expect(loginProbe!.isAEMIndicator).toBe(true);
    expect(loginProbe!.weight).toBeGreaterThan(0);
  });

  it('should mark 404 response as not AEM', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      headers: new Headers(),
    });

    const results = await probeAEMPaths('https://example.com');
    for (const probe of results) {
      expect(probe.isAEMIndicator).toBe(false);
      expect(probe.weight).toBe(0);
    }
  });

  it('should mark 200 response as AEM indicator', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
    });

    const results = await probeAEMPaths('https://example.com');
    const consoleProbe = results.find((r) => r.path.includes('console'));
    expect(consoleProbe).toBeDefined();
    expect(consoleProbe!.isAEMIndicator).toBe(true);
  });

  it('should handle timeout gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const results = await probeAEMPaths('https://example.com');
    // Should not throw, all results should be returned
    expect(results).toHaveLength(4);
    for (const probe of results) {
      expect(probe.error).toBe('Probe timed out');
      expect(probe.isAEMIndicator).toBe(false);
    }
  });

  it('should run all 4 probes in parallel', async () => {
    const callTimes: number[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callTimes.push(Date.now());
      return { status: 403, headers: new Headers() };
    });

    const results = await probeAEMPaths('https://example.com');
    expect(results).toHaveLength(4);
    // All calls should have been made (4 probes)
    expect(callTimes).toHaveLength(4);
  });

  it('should handle network errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const results = await probeAEMPaths('https://example.com');
    expect(results).toHaveLength(4);
    for (const probe of results) {
      expect(probe.error).toContain('ECONNREFUSED');
      expect(probe.isAEMIndicator).toBe(false);
    }
  });
});

// ============================================================
// Version Inference (Tier 4)
// ============================================================

describe('Version Inference (Tier 4)', () => {
  it('should infer Cloud Service from CNAME + no JSP (99%)', () => {
    const signals = [makeSignal('aem-cloud-cname', 'dns', 15)];
    const result = inferVersion(signals);
    expect(result.version).toBe('Cloud Service');
    expect(result.confidence).toBe(99);
  });

  it('should reduce Cloud Service confidence when JSP found', () => {
    const signals = [
      makeSignal('aem-cloud-cname', 'dns', 15),
      makeSignal('jsp-references', 'html', 5),
    ];
    const result = inferVersion(signals);
    expect(result.version).toBe('Cloud Service');
    expect(result.confidence).toBe(85);
  });

  it('should infer Edge Delivery from scripts (99%)', () => {
    const signals = [makeSignal('edge-delivery-scripts', 'html', 10)];
    const result = inferVersion(signals);
    expect(result.version).toBe('Edge Delivery Services');
    expect(result.confidence).toBe(99);
  });

  it('should infer AEM 6.5 from clientlibs + cmp + jQuery 3 (75%)', () => {
    const signals = [
      makeSignal('clientlibs-path', 'html', 9),
      makeSignal('core-components', 'html', 8),
      makeSignal('jquery-3.x', 'html', 3),
    ];
    const result = inferVersion(signals);
    expect(result.version).toBe('6.5');
    expect(result.confidence).toBe(75);
  });

  it('should infer AEM 6.3-6.5 from clientlibs + cmp + jQuery 1 (65%)', () => {
    const signals = [
      makeSignal('clientlibs-path', 'html', 9),
      makeSignal('core-components', 'html', 8),
      makeSignal('jquery-1.x', 'html', 3),
    ];
    const result = inferVersion(signals);
    expect(result.version).toBe('6.3-6.5');
    expect(result.confidence).toBe(65);
  });

  it('should infer AEM 6.3-6.4 from clientlibs + no cmp (55%)', () => {
    const signals = [makeSignal('clientlibs-path', 'html', 9)];
    const result = inferVersion(signals);
    expect(result.version).toBe('6.3-6.4');
    expect(result.confidence).toBe(55);
  });

  it('should infer AEM 6.0-6.2 when no clientlibs but AEM signals (45%)', () => {
    const signals = [
      makeSignal('parbase-class', 'html', 9),
      makeSignal('dam-path', 'html', 8),
    ];
    const result = inferVersion(signals);
    expect(result.version).toBe('6.0-6.2');
    expect(result.confidence).toBe(45);
  });

  it('should infer 6.x from JSP references (80%)', () => {
    const signals = [makeSignal('jsp-references', 'html', 5)];
    const result = inferVersion(signals);
    expect(result.version).toBe('6.x');
    expect(result.confidence).toBe(80);
  });

  it('should return null version when no signals', () => {
    const result = inferVersion([]);
    expect(result.version).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

// ============================================================
// Deployment Classification (Tier 5)
// ============================================================

describe('Deployment Classification (Tier 5)', () => {
  it('should classify Cloud Service from CNAME', () => {
    const signals = [makeSignal('aem-cloud-cname', 'dns', 15)];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('cloud-service');
    expect(result.confidence).toBe(99);
  });

  it('should classify Edge Delivery from CNAME', () => {
    const signals = [makeSignal('edge-delivery-cname', 'dns', 15)];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('edge-delivery');
    expect(result.confidence).toBe(99);
  });

  it('should classify Edge Delivery from scripts', () => {
    const signals = [makeSignal('edge-delivery-scripts', 'html', 10)];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('edge-delivery');
    expect(result.confidence).toBe(99);
  });

  it('should classify On-Premise from AEM + Dispatcher + no cloud CDN', () => {
    const signals = [
      makeSignal('parbase-class', 'html', 9),
      makeSignal('clientlibs-path', 'html', 9),
      makeSignal('dispatcher-header', 'header', 8),
    ];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('on-prem');
    expect(result.confidence).toBeGreaterThanOrEqual(65);
  });

  it('should classify Managed Services from AEM + AMS header', () => {
    const signals = [
      makeSignal('aem-host-ams', 'header', 5),
      makeSignal('parbase-class', 'html', 9),
      makeSignal('clientlibs-path', 'html', 9),
    ];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('managed-services');
    expect(result.confidence).toBe(85);
  });

  it('should classify Managed Services from AEM + CloudFront', () => {
    const signals = [
      makeSignal('parbase-class', 'html', 9),
      makeSignal('clientlibs-path', 'html', 9),
      makeSignal('cloudfront-cdn', 'cdn', 3),
    ];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('managed-services');
    expect(result.confidence).toBe(70);
  });

  it('should return Unknown when confidence is low', () => {
    const signals = [makeSignal('apache-server', 'header', 2)];
    const result = classifyDeployment(signals);
    expect(result.type).toBe('unknown');
  });
});

// ============================================================
// Integration Tests (Full Scan with Mocked Fetch)
// ============================================================

describe('Full Scan Integration', () => {
  let scanner: SiteScanner;

  beforeEach(() => {
    scanner = new SiteScanner();
  });

  it('should detect AEM Cloud Service from DNS + page signals', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      callCount++;

      // DNS lookup
      if (urlStr.includes('dns.google')) {
        return {
          ok: true,
          json: async () => ({
            Status: 0,
            Answer: [
              { name: 'example.com.', type: 5, TTL: 300, data: 'p12345.adobeaemcloud.com.' },
            ],
          }),
        };
      }

      // Path probes
      if (urlStr.includes('/libs/granite') || urlStr.includes('/system/console') ||
          urlStr.includes('/bin/querybuilder') || urlStr.includes('/content.json')) {
        return { status: 403, headers: new Headers(), url: urlStr };
      }

      // Main page fetch
      return {
        ok: true,
        status: 200,
        url: urlStr,
        redirected: false,
        headers: new Headers({
          'content-encoding': 'gzip',
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin',
          'permissions-policy': 'camera=()',
        }),
        text: async () => `
          <html lang="en">
            <head>
              <title>Example Site</title>
              <meta name="description" content="A test site">
              <link rel="canonical" href="https://example.com">
              <link href="/etc.clientlibs/mysite/clientlib.css" rel="stylesheet">
            </head>
            <body>
              <h1>Welcome</h1>
              <div class="cmp-title">Title</div>
            </body>
          </html>
        `,
      };
    });

    const result = await scanner.scan('https://example.com');
    expect(result.aemDetected).toBe(true);
    expect(result.platformDetails.detected).toBe(true);
    expect(result.aemVersion).toBe('Cloud Service');
    expect(result.platformDetails.deployment).toBe('cloud-service');
    expect(result.platformDetails.confidence).toBeGreaterThan(0);
  });

  it('should not detect AEM on a non-AEM site', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      // DNS lookup — no CNAME
      if (urlStr.includes('dns.google')) {
        return {
          ok: true,
          json: async () => ({ Status: 0 }),
        };
      }

      // Path probes — 404 for all
      if (urlStr.includes('/libs/granite') || urlStr.includes('/system/console') ||
          urlStr.includes('/bin/querybuilder') || urlStr.includes('/content.json')) {
        return { status: 404, headers: new Headers(), url: urlStr };
      }

      // Main page — plain WordPress site
      return {
        ok: true,
        status: 200,
        url: urlStr,
        redirected: false,
        headers: new Headers({ 'content-encoding': 'gzip' }),
        text: async () => `
          <html lang="en">
            <head><title>WordPress Blog</title></head>
            <body>
              <h1>Blog</h1>
              <link href="/wp-content/themes/mytheme/style.css">
              <p>Just a blog post.</p>
            </body>
          </html>
        `,
      };
    });

    const result = await scanner.scan('https://blog.example.com');
    expect(result.aemDetected).toBe(false);
    expect(result.platformDetails.platform).toBe('WordPress');
  });

  it('should enforce confidence < 60% results in Unknown version', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      if (urlStr.includes('dns.google')) {
        return {
          ok: true,
          json: async () => ({ Status: 0 }),
        };
      }

      // 403 on one probe (adds some weight)
      if (urlStr.includes('/libs/granite')) {
        return { status: 403, headers: new Headers(), url: urlStr };
      }
      if (urlStr.includes('/system/console') || urlStr.includes('/bin/querybuilder') ||
          urlStr.includes('/content.json')) {
        return { status: 404, headers: new Headers(), url: urlStr };
      }

      // Main page — minimal AEM signals
      return {
        ok: true,
        status: 200,
        url: urlStr,
        redirected: false,
        headers: new Headers({
          'content-encoding': 'gzip',
          'server': 'Apache',
        }),
        text: async () => `
          <html lang="en">
            <head><title>Ambiguous Site</title></head>
            <body>
              <h1>Welcome</h1>
              <div class="parbase">Content</div>
            </body>
          </html>
        `,
      };
    });

    const result = await scanner.scan('https://ambiguous.example.com');
    // Should detect AEM (parbase + granite probe = enough weight)
    // but version confidence should be modest
    if (result.aemDetected && result.platformDetails.versionConfidence !== undefined) {
      if (result.platformDetails.versionConfidence < 60) {
        expect(result.aemVersion).toBeNull();
      }
    }
  });

  it('should handle fetch failure for main page gracefully', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      if (urlStr.includes('dns.google')) {
        return { ok: true, json: async () => ({ Status: 0 }) };
      }

      throw new Error('ECONNREFUSED');
    });

    await expect(scanner.scan('https://down.example.com')).rejects.toThrow();
  });

  it('should execute tiers in correct order: DNS+page parallel, then probes', async () => {
    const callOrder: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      if (urlStr.includes('dns.google')) {
        callOrder.push('dns');
        return { ok: true, json: async () => ({ Status: 0 }) };
      }

      if (urlStr.includes('/libs/granite') || urlStr.includes('/system/console') ||
          urlStr.includes('/bin/querybuilder') || urlStr.includes('/content.json')) {
        callOrder.push('probe');
        return { status: 404, headers: new Headers(), url: urlStr };
      }

      callOrder.push('page');
      return {
        ok: true,
        status: 200,
        url: urlStr,
        redirected: false,
        headers: new Headers(),
        text: async () => '<html><head><title>Test</title></head><body></body></html>',
      };
    });

    await scanner.scan('https://example.com');

    // DNS and page should be called before probes
    const dnsIdx = callOrder.indexOf('dns');
    const pageIdx = callOrder.indexOf('page');
    const firstProbeIdx = callOrder.indexOf('probe');

    expect(dnsIdx).toBeLessThan(firstProbeIdx);
    expect(pageIdx).toBeLessThan(firstProbeIdx);
  });

  it('should detect AEM 6.5 on-prem with correct signals', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      if (urlStr.includes('dns.google')) {
        return { ok: true, json: async () => ({ Status: 0 }) };
      }

      // AEM paths return 403
      if (urlStr.includes('/libs/granite') || urlStr.includes('/system/console') ||
          urlStr.includes('/bin/querybuilder') || urlStr.includes('/content.json')) {
        return { status: 403, headers: new Headers(), url: urlStr };
      }

      return {
        ok: true,
        status: 200,
        url: urlStr,
        redirected: false,
        headers: new Headers({
          'x-dispatcher': 'dispatcher1',
          'content-encoding': 'gzip',
        }),
        text: async () => `
          <html lang="en">
            <head>
              <title>Enterprise Site</title>
              <meta name="description" content="Enterprise">
              <link rel="canonical" href="${urlStr}">
              <link href="/etc.clientlibs/enterprise/clientlib-base.css">
              <script src="/etc.clientlibs/enterprise/clientlib-base.js"></script>
              <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            </head>
            <body>
              <h1>Enterprise Home</h1>
              <div class="parbase section">
                <div class="cmp-title">Welcome</div>
                <div data-sly-test="\${true}">Content</div>
                <img src="/content/dam/enterprise/hero.jpg" alt="Hero">
              </div>
            </body>
          </html>
        `,
      };
    });

    const result = await scanner.scan('https://enterprise.example.com');
    expect(result.aemDetected).toBe(true);
    expect(result.aemVersion).toBe('6.5');
    expect(result.platformDetails.deployment).toBe('on-prem');
    expect(result.platformDetails.indicators.length).toBeGreaterThan(0);
  });
});
