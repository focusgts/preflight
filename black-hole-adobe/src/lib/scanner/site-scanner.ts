/**
 * Public Site Scanner Engine — 5-Tier Multi-Signal Detection
 *
 * Implements ADR-030: DNS resolution, page analysis, safe path probes,
 * version inference, and deployment classification. Every claim includes
 * a confidence score. If confidence < 60%, we report "Unknown."
 */

import type {
  ScanResult,
  ScanFinding,
  PlatformDetails,
  RawScanData,
} from '@/types/scanner';
import { ScoreCalculator } from './score-calculator';
import { resolveCNAME, type DNSResult } from './dns-resolver';
import { probeAEMPaths, type ProbeResult } from './path-prober';
import {
  inferVersion,
  classifyDeployment,
  type DetectedSignal,
  type VersionResult,
  type DeploymentResult,
} from './version-detector';

// ============================================================
// Constants
// ============================================================

const PAGE_TIMEOUT_MS = 15000;
const USER_AGENT = 'BlackHole-Scanner/1.0 (AEM Health Check; focusgts.com)';
const AEM_DETECTION_THRESHOLD = 15;
const MIN_DISPLAY_CONFIDENCE = 60;

// ============================================================
// Tier 2: Header Patterns
// ============================================================

const AEM_HEADER_PATTERNS: Array<{
  header: string;
  weight: number;
  signalName: string;
}> = [
  { header: 'x-aem-host', weight: 10, signalName: 'x-aem-host-header' },
  { header: 'x-aem-cluster', weight: 10, signalName: 'x-aem-cluster-header' },
  { header: 'x-dispatcher', weight: 8, signalName: 'dispatcher-header' },
  { header: 'x-served-by', weight: 6, signalName: 'x-served-by-header' },
  { header: 'x-vhost', weight: 4, signalName: 'x-vhost-header' },
];

// ============================================================
// Tier 2: HTML Patterns
// ============================================================

const AEM_HTML_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  weight: number;
  signalName: string;
}> = [
  {
    pattern: /class\s*=\s*["'][^"']*parbase[^"']*["']/i,
    label: 'AEM paragraph system (parbase)',
    weight: 9,
    signalName: 'parbase-class',
  },
  {
    pattern: /class\s*=\s*["'][^"']*aem-Grid[^"']*["']/i,
    label: 'AEM responsive grid',
    weight: 9,
    signalName: 'aem-grid-class',
  },
  {
    pattern: /data-sly-/i,
    label: 'HTL/Sightly template attributes',
    weight: 9,
    signalName: 'htl-sightly',
  },
  {
    pattern: /class\s*=\s*["'][^"']*cmp-[^"']*["']/i,
    label: 'AEM Core Components',
    weight: 8,
    signalName: 'core-components',
  },
  {
    pattern: /\/etc\.clientlibs\//i,
    label: 'AEM clientlibs proxy path',
    weight: 9,
    signalName: 'clientlibs-path',
  },
  {
    pattern: /\/content\/dam\//i,
    label: 'AEM DAM asset path',
    weight: 8,
    signalName: 'dam-path',
  },
  {
    pattern: /<!--\s*\/?\*\s*CQ\b/i,
    label: 'CQ/AEM HTML comments',
    weight: 10,
    signalName: 'cq-comments',
  },
  {
    pattern: /\/etc\/designs\//i,
    label: 'AEM designs path',
    weight: 7,
    signalName: 'designs-path',
  },
  {
    pattern: /\/libs\/granite\//i,
    label: 'Granite UI framework',
    weight: 9,
    signalName: 'granite-libs',
  },
  {
    pattern: /wcmmode/i,
    label: 'WCM mode reference',
    weight: 5,
    signalName: 'wcmmode',
  },
  {
    pattern: /<meta[^>]*generator[^>]*(?:adobe\s*experience\s*manager|aem)/i,
    label: 'AEM generator meta tag',
    weight: 10,
    signalName: 'generator-meta',
  },
  {
    pattern: /cq-[\w-]+/i,
    label: 'CQ-prefixed attributes',
    weight: 6,
    signalName: 'cq-attributes',
  },
];

// ============================================================
// Additional signal patterns for version detection
// ============================================================

const VERSION_SIGNAL_PATTERNS: Array<{
  pattern: RegExp;
  signalName: string;
  category: DetectedSignal['category'];
  weight: number;
  value: string;
}> = [
  {
    pattern: /\.jsp['"?\s>]/i,
    signalName: 'jsp-references',
    category: 'html',
    weight: 5,
    value: 'JSP file references found',
  },
  {
    pattern: /jquery[/-]3\.\d/i,
    signalName: 'jquery-3.x',
    category: 'html',
    weight: 3,
    value: 'jQuery 3.x detected',
  },
  {
    pattern: /jquery[/-]1\.\d/i,
    signalName: 'jquery-1.x',
    category: 'html',
    weight: 3,
    value: 'jQuery 1.x detected',
  },
  {
    pattern: /(?:aem\.js|lib-franklin\.js)/i,
    signalName: 'edge-delivery-scripts',
    category: 'html',
    weight: 10,
    value: 'Edge Delivery Services scripts',
  },
];

// ============================================================
// Site Scanner
// ============================================================

export class SiteScanner {
  private calculator = new ScoreCalculator();
  private timeout = PAGE_TIMEOUT_MS;

  /**
   * Full 5-tier scan of a public URL.
   */
  async scan(url: string, industry?: string): Promise<ScanResult> {
    const normalizedUrl = this.normalizeUrl(url);
    const domain = this.extractDomain(normalizedUrl);

    // Run Tier 1 (DNS) and Tier 2 (page fetch) in parallel
    const [dnsResult, raw] = await Promise.all([
      this.resolveDNS(domain),
      this.fetchPage(normalizedUrl),
    ]);

    // Tier 2: Analyze page content
    const pageSignals = this.analyzePageSignals(raw);

    // Tier 3: Safe path probes (run in parallel)
    const probeResults = await this.probePaths(normalizedUrl);

    // Combine all signals
    const allSignals = this.combineSignals(dnsResult, pageSignals, probeResults, raw);
    const cumulativeWeight = allSignals.reduce((sum, s) => sum + s.weight, 0);
    const aemDetected = cumulativeWeight >= AEM_DETECTION_THRESHOLD
      || dnsResult.isAEMCloud
      || dnsResult.isEdgeDelivery;

    // Tier 4: Version inference
    const versionResult = this.inferVersion(allSignals);

    // Tier 5: Deployment classification
    const deploymentResult = this.classifyDeployment(allSignals);

    // Build platform details
    const platform = this.buildPlatformDetails(
      aemDetected,
      versionResult,
      deploymentResult,
      allSignals,
      cumulativeWeight,
      raw,
    );

    // Health check scoring (existing logic preserved)
    const performanceFindings = this.checkPerformance(raw);
    const seoFindings = this.checkSEO(raw);
    const securityFindings = this.checkSecurity(raw);
    const accessibilityFindings = this.checkAccessibility(raw);
    const migrationFindings = this.checkMigration(platform);

    const performanceScore = this.findingsToScore(performanceFindings, 100);
    const seoScore = this.findingsToScore(seoFindings, 100);
    const securityScore = this.findingsToScore(securityFindings, 100);
    const accessibilityScore = this.findingsToScore(accessibilityFindings, 100);
    const migrationScore = platform.detected
      ? this.migrationReadinessScore(platform)
      : 80;

    const categories: ScanResult['categories'] = {
      performance: ScoreCalculator.buildCategory(
        'Performance', performanceScore, 0.25, performanceFindings,
      ),
      seo: ScoreCalculator.buildCategory(
        'SEO', seoScore, 0.20, seoFindings,
      ),
      security: ScoreCalculator.buildCategory(
        'Security', securityScore, 0.20, securityFindings,
      ),
      accessibility: ScoreCalculator.buildCategory(
        'Accessibility', accessibilityScore, 0.10, accessibilityFindings,
      ),
      migration: ScoreCalculator.buildCategory(
        'Migration Risk', migrationScore, 0.25, migrationFindings,
      ),
    };

    const overallScore = this.calculator.calculate(categories);
    const benchmark = this.calculator.getIndustryBenchmark(overallScore, industry);
    const urgency = this.calculator.getMigrationUrgency(
      platform.version,
      overallScore,
    );
    const recommendations = this.calculator.getRecommendations(categories);

    return {
      url: normalizedUrl,
      domain,
      overallScore,
      grade: ScoreCalculator.toGrade(overallScore),
      categories,
      aemDetected: platform.detected,
      aemVersion: platform.version,
      platformDetails: platform,
      recommendations,
      industryBenchmark: benchmark,
      migrationUrgency: urgency,
      scannedAt: new Date().toISOString(),
    };
  }

  // ── Tier 1: DNS Resolution ─────────────────────────────────

  async resolveDNS(domain: string): Promise<DNSResult> {
    return resolveCNAME(domain);
  }

  // ── Tier 2: Page Analysis ──────────────────────────────────

  /**
   * Fetch a page and return raw scan data for analysis.
   */
  async fetchAndAnalyzePage(url: string): Promise<{
    raw: RawScanData;
    signals: DetectedSignal[];
    cumulativeWeight: number;
    aemDetected: boolean;
  }> {
    const raw = await this.fetchPage(url);
    const signals = this.analyzePageSignals(raw);
    const cumulativeWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    return {
      raw,
      signals,
      cumulativeWeight,
      aemDetected: cumulativeWeight >= AEM_DETECTION_THRESHOLD,
    };
  }

  /**
   * Extract detection signals from headers and HTML content.
   */
  analyzePageSignals(raw: RawScanData): DetectedSignal[] {
    const signals: DetectedSignal[] = [];

    // Check response headers
    for (const { header, weight, signalName } of AEM_HEADER_PATTERNS) {
      const key = header.toLowerCase();
      if (raw.headers[key]) {
        signals.push({
          name: signalName,
          category: 'header',
          value: `${header}: ${raw.headers[key]}`,
          weight,
        });

        // Special: x-aem-host containing "ams" for managed services
        if (key === 'x-aem-host' && /ams/i.test(raw.headers[key])) {
          signals.push({
            name: 'aem-host-ams',
            category: 'header',
            value: raw.headers[key],
            weight: 5,
          });
        }
      }
    }

    // Check server header
    const server = raw.headers['server'] ?? '';
    if (/apache/i.test(server)) {
      signals.push({
        name: 'apache-server',
        category: 'header',
        value: `Server: ${server}`,
        weight: 2,
      });
    }

    // Check for AEM-specific cookies
    const cookies = raw.headers['set-cookie'] ?? '';
    if (/cq-|login-token/i.test(cookies)) {
      signals.push({
        name: 'aem-cookies',
        category: 'cookie',
        value: 'AEM-specific cookies detected',
        weight: 9,
      });
    }

    // Check x-served-by for Fastly format
    const servedBy = raw.headers['x-served-by'] ?? '';
    if (/cache-/i.test(servedBy)) {
      signals.push({
        name: 'fastly-cdn',
        category: 'cdn',
        value: `x-served-by: ${servedBy}`,
        weight: 4,
      });
    }

    // Check HTML patterns
    for (const { pattern, label, weight, signalName } of AEM_HTML_PATTERNS) {
      if (pattern.test(raw.html)) {
        signals.push({
          name: signalName,
          category: 'html',
          value: label,
          weight,
        });
      }
    }

    // Check version-specific HTML patterns
    for (const { pattern, signalName, category, weight, value } of VERSION_SIGNAL_PATTERNS) {
      if (pattern.test(raw.html)) {
        signals.push({ name: signalName, category, value, weight });
      }
    }

    // URL pattern: /content/*.html
    if (/\.html$/i.test(raw.finalUrl) && /\/content\//i.test(raw.finalUrl)) {
      signals.push({
        name: 'aem-url-pattern',
        category: 'html',
        value: 'AEM-style URL pattern (/content/*.html)',
        weight: 5,
      });
    }

    return signals;
  }

  // ── Tier 3: Safe Path Probes ───────────────────────────────

  async probePaths(baseUrl: string): Promise<ProbeResult[]> {
    return probeAEMPaths(baseUrl);
  }

  // ── Tier 4: Version Inference ──────────────────────────────

  inferVersion(signals: DetectedSignal[]): VersionResult {
    return inferVersion(signals);
  }

  // ── Tier 5: Deployment Classification ──────────────────────

  classifyDeployment(signals: DetectedSignal[]): DeploymentResult {
    return classifyDeployment(signals);
  }

  // ── Combined Platform Detection ────────────────────────────

  detectPlatform(raw: RawScanData): PlatformDetails {
    const signals = this.analyzePageSignals(raw);
    const cumulativeWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const aemDetected = cumulativeWeight >= AEM_DETECTION_THRESHOLD;
    const versionResult = this.inferVersion(signals);
    const deploymentResult = this.classifyDeployment(signals);

    return this.buildPlatformDetails(
      aemDetected,
      versionResult,
      deploymentResult,
      signals,
      cumulativeWeight,
      raw,
    );
  }

  // ── Signal Combination ─────────────────────────────────────

  private combineSignals(
    dns: DNSResult,
    pageSignals: DetectedSignal[],
    probes: ProbeResult[],
    raw: RawScanData,
  ): DetectedSignal[] {
    const signals: DetectedSignal[] = [...pageSignals];

    // DNS signals
    if (dns.isAEMCloud) {
      signals.push({
        name: 'aem-cloud-cname',
        category: 'dns',
        value: `CNAME → ${dns.cnames.join(', ')}`,
        weight: 15,
      });
    }

    if (dns.isEdgeDelivery) {
      signals.push({
        name: 'edge-delivery-cname',
        category: 'dns',
        value: `CNAME → ${dns.cnames.join(', ')}`,
        weight: 15,
      });
    }

    if (dns.cdnProvider && !dns.isAEMCloud && !dns.isEdgeDelivery) {
      const cdnSignalName = `${dns.cdnProvider}-cdn`;
      // Only add if not already detected from headers
      if (!signals.some((s) => s.name === cdnSignalName)) {
        signals.push({
          name: cdnSignalName,
          category: 'cdn',
          value: `CDN: ${dns.cdnProvider} (from DNS)`,
          weight: 3,
        });
      }
    }

    // Probe signals
    for (const probe of probes) {
      if (probe.isAEMIndicator && probe.weight > 0) {
        signals.push({
          name: `probe-${probe.path.replace(/\//g, '-').replace(/^-/, '')}`,
          category: 'probe',
          value: `${probe.path} returned ${probe.statusCode}`,
          weight: probe.weight,
        });
      }
    }

    // CDN from headers (CloudFront)
    const via = raw.headers['via'] ?? '';
    if (/cloudfront/i.test(via) && !signals.some((s) => s.name === 'cloudfront-cdn')) {
      signals.push({
        name: 'cloudfront-cdn',
        category: 'cdn',
        value: `Via: ${via}`,
        weight: 3,
      });
    }

    // Akamai from headers
    const xCache = raw.headers['x-cache'] ?? '';
    if (/akamai/i.test(xCache) && !signals.some((s) => s.name === 'akamai-cdn')) {
      signals.push({
        name: 'akamai-cdn',
        category: 'cdn',
        value: `X-Cache: ${xCache}`,
        weight: 3,
      });
    }

    return signals;
  }

  // ── Platform Details Builder ───────────────────────────────

  private buildPlatformDetails(
    aemDetected: boolean,
    versionResult: VersionResult,
    deploymentResult: DeploymentResult,
    signals: DetectedSignal[],
    cumulativeWeight: number,
    raw: RawScanData,
  ): PlatformDetails {
    const detectionConfidence = Math.min(100, cumulativeWeight * 3);

    // Determine if we should show version
    const showVersion = versionResult.confidence >= MIN_DISPLAY_CONFIDENCE;
    const showDeployment = deploymentResult.confidence >= MIN_DISPLAY_CONFIDENCE;

    // Map deployment type to PlatformDetails type
    let deployment: PlatformDetails['deployment'] = 'unknown';
    if (showDeployment) {
      if (deploymentResult.type === 'edge-delivery') {
        deployment = 'cloud-service'; // EDS is part of Cloud Service
      } else {
        deployment = deploymentResult.type as PlatformDetails['deployment'];
      }
    }

    const indicators = signals
      .filter((s) => s.weight >= 5)
      .map((s) => s.value)
      .slice(0, 15);

    if (!aemDetected) {
      return {
        detected: false,
        platform: this.detectOtherPlatform(raw),
        version: null,
        deployment: 'unknown',
        indicators: [],
        confidence: detectionConfidence,
        versionConfidence: 0,
        deploymentConfidence: 0,
      };
    }

    // When deployment is definitively Cloud Service, override version
    // to prevent showing "6.5" for a site that's already on Cloud.
    // Cloud Service sites may have 6.5-era HTML patterns (clientlibs,
    // Core Components) that carry over after migration.
    let version = showVersion ? versionResult.version : null;
    let versionConf = versionResult.confidence;
    if (deployment === 'cloud-service' && deploymentResult.confidence >= 70) {
      version = 'Cloud Service';
      versionConf = deploymentResult.confidence;
    }

    return {
      detected: true,
      platform: 'Adobe Experience Manager',
      version,
      deployment,
      indicators,
      confidence: detectionConfidence,
      versionConfidence: versionConf,
      deploymentConfidence: deploymentResult.confidence,
    };
  }

  // ── Health Check Methods (preserved from original) ─────────

  checkPerformance(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];

    if (raw.responseTimeMs > 3000) {
      findings.push({
        category: 'Performance',
        severity: 'critical',
        title: 'Very slow server response',
        description: `Server responded in ${raw.responseTimeMs}ms (should be under 800ms).`,
        recommendation: 'Enable CDN caching, optimize server-side rendering, check dispatcher cache.',
      });
    } else if (raw.responseTimeMs > 1500) {
      findings.push({
        category: 'Performance',
        severity: 'high',
        title: 'Slow server response',
        description: `Server responded in ${raw.responseTimeMs}ms (target: under 800ms).`,
        recommendation: 'Review dispatcher cache configuration and server-side performance.',
      });
    } else if (raw.responseTimeMs > 800) {
      findings.push({
        category: 'Performance',
        severity: 'medium',
        title: 'Server response could be faster',
        description: `Server responded in ${raw.responseTimeMs}ms.`,
        recommendation: 'Consider CDN caching for static content.',
      });
    }

    const sizeKB = raw.contentLengthBytes / 1024;
    if (sizeKB > 3000) {
      findings.push({
        category: 'Performance',
        severity: 'critical',
        title: 'Page is very large',
        description: `Page size is ${Math.round(sizeKB)}KB (should be under 1500KB).`,
        recommendation: 'Optimize images, lazy-load below-fold content, minify CSS/JS.',
      });
    } else if (sizeKB > 1500) {
      findings.push({
        category: 'Performance',
        severity: 'high',
        title: 'Page size is above recommended limit',
        description: `Page size is ${Math.round(sizeKB)}KB.`,
        recommendation: 'Compress images, enable Brotli/Gzip, defer non-critical scripts.',
      });
    }

    if (raw.redirectCount > 2) {
      findings.push({
        category: 'Performance',
        severity: 'medium',
        title: 'Excessive redirects',
        description: `${raw.redirectCount} redirects detected before reaching final page.`,
        recommendation: 'Reduce redirect chains to improve load time.',
      });
    }

    const encoding = raw.headers['content-encoding'] ?? '';
    if (!encoding.includes('gzip') && !encoding.includes('br')) {
      findings.push({
        category: 'Performance',
        severity: 'high',
        title: 'No compression detected',
        description: 'Response is not compressed with Gzip or Brotli.',
        recommendation: 'Enable Gzip or Brotli compression on your web server.',
      });
    }

    return findings;
  }

  checkSEO(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const { html } = raw;

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    if (!titleMatch || !titleMatch[1].trim()) {
      findings.push({
        category: 'SEO',
        severity: 'critical',
        title: 'Missing page title',
        description: 'No <title> tag found in the page.',
        recommendation: 'Add a descriptive <title> tag to every page.',
      });
    } else if (titleMatch[1].trim().length > 60) {
      findings.push({
        category: 'SEO',
        severity: 'low',
        title: 'Page title is too long',
        description: `Title is ${titleMatch[1].trim().length} characters (recommended: under 60).`,
        recommendation: 'Shorten the page title for better search engine display.',
      });
    }

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    if (!descMatch || !descMatch[1].trim()) {
      findings.push({
        category: 'SEO',
        severity: 'high',
        title: 'Missing meta description',
        description: 'No meta description found.',
        recommendation: 'Add a unique meta description (150-160 characters) to every page.',
      });
    }

    if (!/<link[^>]*rel=["']canonical["']/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'medium',
        title: 'Missing canonical URL',
        description: 'No canonical link tag found.',
        recommendation: 'Add a canonical URL to prevent duplicate content issues.',
      });
    }

    if (!/<script[^>]*type=["']application\/ld\+json["']/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'low',
        title: 'No structured data found',
        description: 'No JSON-LD structured data detected.',
        recommendation: 'Add Schema.org structured data for rich search results.',
      });
    }

    if (!/<meta[^>]*property=["']og:/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'low',
        title: 'Missing Open Graph tags',
        description: 'No OG meta tags found for social sharing.',
        recommendation: 'Add og:title, og:description, og:image for better social previews.',
      });
    }

    const h1Matches = html.match(/<h1[\s>]/gi);
    if (!h1Matches) {
      findings.push({
        category: 'SEO',
        severity: 'high',
        title: 'Missing H1 heading',
        description: 'No H1 heading found on the page.',
        recommendation: 'Add exactly one H1 heading with your primary keyword.',
      });
    } else if (h1Matches.length > 1) {
      findings.push({
        category: 'SEO',
        severity: 'medium',
        title: 'Multiple H1 headings',
        description: `Found ${h1Matches.length} H1 headings (recommended: 1).`,
        recommendation: 'Use a single H1 heading per page.',
      });
    }

    return findings;
  }

  checkSecurity(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const h = raw.headers;

    const checks: Array<{
      header: string;
      severity: ScanFinding['severity'];
      title: string;
      recommendation: string;
    }> = [
      {
        header: 'strict-transport-security',
        severity: 'critical',
        title: 'Missing HSTS header',
        recommendation: 'Add Strict-Transport-Security with max-age of at least 31536000.',
      },
      {
        header: 'content-security-policy',
        severity: 'high',
        title: 'Missing Content Security Policy',
        recommendation: 'Implement a Content-Security-Policy header to prevent XSS attacks.',
      },
      {
        header: 'x-frame-options',
        severity: 'medium',
        title: 'Missing X-Frame-Options',
        recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking.',
      },
      {
        header: 'x-content-type-options',
        severity: 'medium',
        title: 'Missing X-Content-Type-Options',
        recommendation: 'Add X-Content-Type-Options: nosniff to prevent MIME sniffing.',
      },
      {
        header: 'referrer-policy',
        severity: 'low',
        title: 'Missing Referrer-Policy',
        recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin.',
      },
      {
        header: 'permissions-policy',
        severity: 'low',
        title: 'Missing Permissions-Policy',
        recommendation: 'Add Permissions-Policy to control browser feature access.',
      },
    ];

    for (const check of checks) {
      if (!h[check.header]) {
        findings.push({
          category: 'Security',
          severity: check.severity,
          title: check.title,
          description: `The ${check.header} header is not set.`,
          recommendation: check.recommendation,
        });
      }
    }

    if (raw.finalUrl.startsWith('http://')) {
      findings.push({
        category: 'Security',
        severity: 'critical',
        title: 'Site not served over HTTPS',
        description: 'The site is accessible over plain HTTP.',
        recommendation: 'Enable HTTPS and redirect all HTTP traffic.',
      });
    }

    return findings;
  }

  checkAccessibility(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const { html } = raw;

    if (!/<html[^>]*lang=["'][a-z]/i.test(html)) {
      findings.push({
        category: 'Accessibility',
        severity: 'high',
        title: 'Missing lang attribute',
        description: 'The <html> element has no lang attribute.',
        recommendation: 'Add lang="en" (or appropriate language) to the <html> element.',
      });
    }

    const imgTags = html.match(/<img[^>]*>/gi) ?? [];
    const noAlt = imgTags.filter((tag) => !/alt=["']/i.test(tag));
    if (noAlt.length > 0) {
      findings.push({
        category: 'Accessibility',
        severity: noAlt.length > 5 ? 'critical' : 'high',
        title: `${noAlt.length} images missing alt text`,
        description: `Found ${noAlt.length} of ${imgTags.length} images without alt attributes.`,
        recommendation: 'Add descriptive alt text to all meaningful images.',
      });
    }

    const headings = html.match(/<h([1-6])[\s>]/gi) ?? [];
    const levels = headings.map((h) => parseInt(h.match(/\d/)![0], 10));
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        findings.push({
          category: 'Accessibility',
          severity: 'medium',
          title: 'Heading hierarchy has gaps',
          description: `Heading level jumps from H${levels[i - 1]} to H${levels[i]}.`,
          recommendation: 'Use heading levels sequentially (H1, H2, H3, etc.).',
        });
        break;
      }
    }

    if (!/<a[^>]*skip/i.test(html) && !/#main/i.test(html)) {
      findings.push({
        category: 'Accessibility',
        severity: 'low',
        title: 'No skip navigation link',
        description: 'No "skip to content" link detected.',
        recommendation: 'Add a skip navigation link for keyboard users.',
      });
    }

    const inputs = html.match(/<input[^>]*type=["']text["']/gi) ?? [];
    if (inputs.length > 0) {
      const labels = html.match(/<label/gi) ?? [];
      if (labels.length < inputs.length) {
        findings.push({
          category: 'Accessibility',
          severity: 'medium',
          title: 'Form inputs may lack labels',
          description: `Found ${inputs.length} text inputs but only ${labels.length} labels.`,
          recommendation: 'Associate a <label> with every form input.',
        });
      }
    }

    return findings;
  }

  // ── Private Helpers ────────────────────────────────────────

  private checkMigration(platform: PlatformDetails): ScanFinding[] {
    const findings: ScanFinding[] = [];

    if (!platform.detected) {
      findings.push({
        category: 'Migration',
        severity: 'info',
        title: 'AEM not detected',
        description: `Site appears to run on ${platform.platform}.`,
        recommendation: 'This score is most relevant for AEM-powered sites.',
      });
      return findings;
    }

    if (platform.deployment === 'on-prem') {
      findings.push({
        category: 'Migration',
        severity: 'high',
        title: 'On-premise AEM deployment detected',
        description: 'On-prem deployments require full migration to Cloud Service.',
        recommendation: 'Start planning migration to AEM as a Cloud Service.',
      });
    }

    if (platform.version && !platform.version.includes('Cloud') && !platform.version.includes('Edge')) {
      findings.push({
        category: 'Migration',
        severity: 'high',
        title: `Legacy AEM version (${platform.version})`,
        description: 'Running an older AEM version increases migration complexity.',
        recommendation: 'Use the Best Practices Analyzer (BPA) to assess migration readiness.',
      });
    }

    return findings;
  }

  private migrationReadinessScore(platform: PlatformDetails): number {
    // Cloud Service or Edge Delivery = already migrated, high score
    if (platform.deployment === 'cloud-service') return 95;
    if (platform.version?.includes('Cloud')) return 95;
    if (platform.version?.includes('Edge')) return 95;
    if (platform.deployment === 'managed-services') return 60;
    if (platform.version === '6.5') return 50;
    if (platform.version === '6.4' || platform.version === '6.3-6.4') return 35;
    if (platform.version?.startsWith('6.')) return 25;
    return 40;
  }

  private detectOtherPlatform(raw: RawScanData): string {
    const { html, headers } = raw;
    if (/wp-content|wordpress/i.test(html)) return 'WordPress';
    if (/drupal/i.test(html) || headers['x-drupal-cache']) return 'Drupal';
    if (/sitecore/i.test(html)) return 'Sitecore';
    if (/shopify/i.test(html)) return 'Shopify';
    if (/next/i.test(headers['x-powered-by'] ?? '')) return 'Next.js';
    return 'Unknown';
  }

  private findingsToScore(findings: ScanFinding[], base: number): number {
    const penalties: Record<string, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      info: 0,
    };
    const total = findings.reduce(
      (acc, f) => acc + (penalties[f.severity] ?? 0),
      0,
    );
    return Math.max(0, base - total);
  }

  private normalizeUrl(url: string): string {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      u = 'https://' + u;
    }
    return u;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private async fetchPage(url: string): Promise<RawScanData> {
    const start = Date.now();
    let redirectCount = 0;
    let finalUrl = url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      finalUrl = response.url;
      if (response.redirected) redirectCount = 1;

      const html = await response.text();
      const responseTimeMs = Date.now() - start;

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      return {
        url,
        statusCode: response.status,
        headers,
        html: html.substring(0, 500000),
        responseTimeMs,
        contentLengthBytes: new TextEncoder().encode(html).length,
        redirectCount,
        finalUrl,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
