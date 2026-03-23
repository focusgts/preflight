/**
 * Public Site Scanner Engine
 *
 * Crawls a public-facing URL to detect AEM version, check performance,
 * SEO, security headers, and accessibility. No credentials needed.
 */

import type {
  ScanResult,
  ScanFinding,
  PlatformDetails,
  RawScanData,
} from '@/types/scanner';
import { ScoreCalculator } from './score-calculator';

// ============================================================
// AEM Detection Patterns
// ============================================================

const AEM_HEADER_PATTERNS = [
  { header: 'x-aem-host', weight: 10 },
  { header: 'x-aem-cluster', weight: 10 },
  { header: 'x-dispatcher', weight: 6 },
  { header: 'x-vhost', weight: 4 },
];

const AEM_HTML_PATTERNS: { pattern: RegExp; label: string; weight: number }[] = [
  { pattern: /\/etc\.clientlibs\//i, label: 'AEM clientlibs path', weight: 9 },
  { pattern: /\/content\/dam\//i, label: 'AEM DAM path', weight: 8 },
  { pattern: /\/libs\/granite\//i, label: 'Granite UI libs', weight: 9 },
  { pattern: /\/etc\/designs\//i, label: 'AEM designs path', weight: 7 },
  { pattern: /cq-[\w-]+/i, label: 'CQ- prefixed attribute', weight: 6 },
  { pattern: /data-sly-/i, label: 'HTL/Sightly template', weight: 9 },
  { pattern: /\/content\/experience-fragments\//i, label: 'Experience Fragments', weight: 8 },
  { pattern: /<meta[^>]*generator[^>]*adobe\s*experience\s*manager/i, label: 'AEM generator meta', weight: 10 },
  { pattern: /<meta[^>]*generator[^>]*aem/i, label: 'AEM generator meta (short)', weight: 10 },
  { pattern: /wcmmode/i, label: 'WCM mode reference', weight: 5 },
];

const AEM_CLOUD_INDICATORS = [
  'skyline',
  'aemcs',
  'cloud-service',
  'author-p',
  'publish-p',
];

const AEM_6X_INDICATORS = [
  '/crx/',
  '/system/console',
  'cq-msm',
  'cq-wcm',
];

// ============================================================
// Site Scanner
// ============================================================

export class SiteScanner {
  private calculator = new ScoreCalculator();
  private timeout = 15000;

  /**
   * Full scan of a public URL.
   */
  async scan(url: string, industry?: string): Promise<ScanResult> {
    const normalizedUrl = this.normalizeUrl(url);
    const raw = await this.fetchPage(normalizedUrl);
    const platform = this.detectPlatform(raw);
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

    const domain = this.extractDomain(normalizedUrl);

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

  /**
   * Detect if a site runs AEM and which version.
   */
  detectPlatform(raw: RawScanData): PlatformDetails {
    const indicators: string[] = [];
    let score = 0;

    // Check headers
    for (const { header, weight } of AEM_HEADER_PATTERNS) {
      const key = header.toLowerCase();
      if (raw.headers[key]) {
        indicators.push(`Header: ${header}=${raw.headers[key]}`);
        score += weight;
      }
    }

    // Check server header
    const server = raw.headers['server'] ?? '';
    if (/apache/i.test(server) || /dispatcher/i.test(server)) {
      indicators.push(`Server: ${server}`);
      score += 3;
    }

    // Check HTML patterns
    for (const { pattern, label, weight } of AEM_HTML_PATTERNS) {
      if (pattern.test(raw.html)) {
        indicators.push(label);
        score += weight;
      }
    }

    // Check URL patterns
    if (/\.html$/i.test(raw.finalUrl) && /\/content\//i.test(raw.finalUrl)) {
      indicators.push('AEM-style URL pattern');
      score += 5;
    }

    const detected = score >= 8;
    const version = detected ? this.detectAEMVersion(raw.headers, raw.html) : null;
    const deployment = detected ? this.detectDeployment(raw.headers, raw.html) : 'unknown';

    return {
      detected,
      platform: detected ? 'Adobe Experience Manager' : this.detectOtherPlatform(raw),
      version,
      deployment: deployment as PlatformDetails['deployment'],
      indicators,
    };
  }

  /**
   * Fingerprint AEM version from response headers and HTML.
   */
  detectAEMVersion(
    headers: Record<string, string>,
    html: string,
  ): string | null {
    // Generator meta tag
    const genMatch = html.match(
      /<meta[^>]*generator[^>]*content=["']([^"']*aem[^"']*|[^"']*experience\s*manager[^"']*)["']/i,
    );
    if (genMatch) {
      const ver = genMatch[1].match(/(\d+\.\d+[\.\d]*)/);
      if (ver) return ver[1];
    }

    // Cloud Service indicators
    for (const indicator of AEM_CLOUD_INDICATORS) {
      const headerValues = Object.values(headers).join(' ').toLowerCase();
      if (headerValues.includes(indicator) || html.toLowerCase().includes(indicator)) {
        return 'Cloud Service';
      }
    }

    // 6.x indicators
    for (const indicator of AEM_6X_INDICATORS) {
      if (html.includes(indicator)) {
        // Try to narrow version
        if (html.includes('coral3') || html.includes('coral-')) return '6.5';
        if (html.includes('coral-2') || html.includes('coralui2')) return '6.4';
        return '6.x';
      }
    }

    // clientlibs version hints
    if (/\/etc\.clientlibs\//.test(html)) {
      if (/clientlib-grid/.test(html)) return '6.5';
      return '6.x';
    }

    return '6.x';
  }

  /**
   * Check performance via proxy metrics (TTFB, page size, response time).
   */
  checkPerformance(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];

    // TTFB / response time
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

    // Page size
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

    // Redirect count
    if (raw.redirectCount > 2) {
      findings.push({
        category: 'Performance',
        severity: 'medium',
        title: 'Excessive redirects',
        description: `${raw.redirectCount} redirects detected before reaching final page.`,
        recommendation: 'Reduce redirect chains to improve load time.',
      });
    }

    // Compression check
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

  /**
   * Check SEO: meta tags, sitemap, robots.txt, canonical URLs, structured data.
   */
  checkSEO(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const { html } = raw;

    // Title tag
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

    // Meta description
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

    // Canonical URL
    if (!/<link[^>]*rel=["']canonical["']/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'medium',
        title: 'Missing canonical URL',
        description: 'No canonical link tag found.',
        recommendation: 'Add a canonical URL to prevent duplicate content issues.',
      });
    }

    // Structured data (JSON-LD)
    if (!/<script[^>]*type=["']application\/ld\+json["']/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'low',
        title: 'No structured data found',
        description: 'No JSON-LD structured data detected.',
        recommendation: 'Add Schema.org structured data for rich search results.',
      });
    }

    // Open Graph tags
    if (!/<meta[^>]*property=["']og:/i.test(html)) {
      findings.push({
        category: 'SEO',
        severity: 'low',
        title: 'Missing Open Graph tags',
        description: 'No OG meta tags found for social sharing.',
        recommendation: 'Add og:title, og:description, og:image for better social previews.',
      });
    }

    // H1 check
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

  /**
   * Check security headers (HSTS, CSP, X-Frame-Options, etc.).
   */
  checkSecurity(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const h = raw.headers;

    const checks: {
      header: string;
      severity: ScanFinding['severity'];
      title: string;
      recommendation: string;
    }[] = [
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

    // HTTPS check
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

  /**
   * Basic accessibility checks (alt tags, heading hierarchy, lang attribute).
   */
  checkAccessibility(raw: RawScanData): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const { html } = raw;

    // Lang attribute
    if (!/<html[^>]*lang=["'][a-z]/i.test(html)) {
      findings.push({
        category: 'Accessibility',
        severity: 'high',
        title: 'Missing lang attribute',
        description: 'The <html> element has no lang attribute.',
        recommendation: 'Add lang="en" (or appropriate language) to the <html> element.',
      });
    }

    // Images without alt
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

    // Heading hierarchy
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

    // Skip navigation
    if (!/<a[^>]*skip/i.test(html) && !/#main/i.test(html)) {
      findings.push({
        category: 'Accessibility',
        severity: 'low',
        title: 'No skip navigation link',
        description: 'No "skip to content" link detected.',
        recommendation: 'Add a skip navigation link for keyboard users.',
      });
    }

    // Form labels
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

  // ── Private Helpers ──────────────────────────────────────

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

    if (platform.version && !platform.version.includes('Cloud')) {
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
    if (platform.version?.includes('Cloud')) return 95;
    if (platform.deployment === 'managed-services') return 60;
    if (platform.version === '6.5') return 50;
    if (platform.version === '6.4') return 35;
    if (platform.version?.startsWith('6.')) return 25;
    return 40;
  }

  private detectDeployment(
    headers: Record<string, string>,
    html: string,
  ): string {
    const all = Object.values(headers).join(' ').toLowerCase() + html.toLowerCase();
    if (AEM_CLOUD_INDICATORS.some((i) => all.includes(i))) return 'cloud-service';
    if (/managed/i.test(all) || /ams/i.test(headers['x-aem-host'] ?? '')) {
      return 'managed-services';
    }
    return 'on-prem';
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
          'User-Agent': 'BlackHole-Scanner/1.0 (AEM Health Check)',
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
