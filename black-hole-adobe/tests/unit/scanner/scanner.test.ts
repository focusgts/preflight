/**
 * Public AEM Health Score — Scanner Tests
 *
 * Tests for URL validation, AEM detection, scoring, benchmarking,
 * and recommendation generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SiteScanner } from '@/lib/scanner/site-scanner';
import { ScoreCalculator } from '@/lib/scanner/score-calculator';
import type { RawScanData, ScanResult, ScanFinding, CategoryScore } from '@/types/scanner';

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

function makeCategory(
  name: string,
  score: number,
  weight: number,
  findings: ScanFinding[] = [],
): CategoryScore {
  return {
    name,
    score,
    weight,
    grade: ScoreCalculator.toGrade(score),
    findings,
  };
}

// ── Tests ─────────────────────────────────────────────────

describe('SiteScanner', () => {
  let scanner: SiteScanner;

  beforeEach(() => {
    scanner = new SiteScanner();
  });

  // -- AEM Version Detection --

  describe('detectAEMVersion', () => {
    it('should detect AEM version from generator meta tag', () => {
      const html = '<meta name="generator" content="Adobe Experience Manager 6.5.12">';
      const version = scanner.detectAEMVersion({}, html);
      expect(version).toBe('6.5.12');
    });

    it('should detect AEM Cloud Service from header indicators', () => {
      const headers = { 'x-aem-host': 'publish-p12345-e67890.adobeaemcloud.com' };
      const html = '<html><head></head><body>skyline content</body></html>';
      const version = scanner.detectAEMVersion(headers, html);
      expect(version).toBe('Cloud Service');
    });

    it('should detect AEM 6.5 from coral3 patterns', () => {
      const html = '<html><body><div class="coral3-Shell">/crx/de</div></body></html>';
      const version = scanner.detectAEMVersion({}, html);
      expect(version).toBe('6.5');
    });

    it('should detect AEM 6.4 from coral-2 patterns', () => {
      const html = '<html><body><div class="coralui2">/crx/content</div></body></html>';
      const version = scanner.detectAEMVersion({}, html);
      expect(version).toBe('6.4');
    });

    it('should return 6.x when clientlibs detected but no specific version', () => {
      const html = '<html><body><link href="/etc.clientlibs/mysite/clientlib.css"></body></html>';
      const version = scanner.detectAEMVersion({}, html);
      expect(version).toBe('6.x');
    });
  });

  // -- Platform Detection --

  describe('detectPlatform', () => {
    it('should detect AEM from clientlibs HTML pattern', () => {
      const raw = makeRawScan({
        html: '<html><head></head><body><link href="/etc.clientlibs/site/clientlib-base.css"><img src="/content/dam/image.jpg"></body></html>',
      });
      const platform = scanner.detectPlatform(raw);
      expect(platform.detected).toBe(true);
      expect(platform.platform).toBe('Adobe Experience Manager');
    });

    it('should detect AEM from response headers', () => {
      const raw = makeRawScan({
        headers: {
          'x-aem-host': 'publish.example.com',
          'x-dispatcher': 'dispatcher1',
        },
      });
      const platform = scanner.detectPlatform(raw);
      expect(platform.detected).toBe(true);
      expect(platform.indicators.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect AEM from HTL/Sightly templates', () => {
      const raw = makeRawScan({
        html: '<html><body><div data-sly-test="${true}">Content</div></body></html>',
        headers: { 'x-vhost': 'publish' },
      });
      const platform = scanner.detectPlatform(raw);
      expect(platform.detected).toBe(true);
    });

    it('should not detect AEM on a plain HTML page', () => {
      const raw = makeRawScan({
        html: '<html><head><title>Plain</title></head><body><p>Hello</p></body></html>',
        headers: {},
      });
      const platform = scanner.detectPlatform(raw);
      expect(platform.detected).toBe(false);
    });

    it('should detect WordPress from wp-content patterns', () => {
      const raw = makeRawScan({
        html: '<html><body><link href="/wp-content/themes/style.css"></body></html>',
      });
      const platform = scanner.detectPlatform(raw);
      expect(platform.detected).toBe(false);
      expect(platform.platform).toBe('WordPress');
    });
  });

  // -- Performance Checks --

  describe('checkPerformance', () => {
    it('should flag very slow response times as critical', () => {
      const raw = makeRawScan({ responseTimeMs: 4000 });
      const findings = scanner.checkPerformance(raw);
      const critical = findings.find((f) => f.severity === 'critical' && f.title.includes('slow'));
      expect(critical).toBeDefined();
    });

    it('should flag large page sizes', () => {
      const raw = makeRawScan({ contentLengthBytes: 4_000_000 });
      const findings = scanner.checkPerformance(raw);
      const large = findings.find((f) => f.title.includes('large'));
      expect(large).toBeDefined();
    });

    it('should flag excessive redirects', () => {
      const raw = makeRawScan({ redirectCount: 4 });
      const findings = scanner.checkPerformance(raw);
      const redirect = findings.find((f) => f.title.includes('redirect'));
      expect(redirect).toBeDefined();
    });

    it('should flag missing compression', () => {
      const raw = makeRawScan({ headers: {} });
      const findings = scanner.checkPerformance(raw);
      const compression = findings.find((f) => f.title.includes('compression'));
      expect(compression).toBeDefined();
    });

    it('should not flag compression when gzip is present', () => {
      const raw = makeRawScan({
        headers: { 'content-encoding': 'gzip' },
      });
      const findings = scanner.checkPerformance(raw);
      const compression = findings.find((f) => f.title.includes('compression'));
      expect(compression).toBeUndefined();
    });
  });

  // -- SEO Checks --

  describe('checkSEO', () => {
    it('should flag missing page title', () => {
      const raw = makeRawScan({ html: '<html><head></head><body></body></html>' });
      const findings = scanner.checkSEO(raw);
      expect(findings.some((f) => f.title.includes('title'))).toBe(true);
    });

    it('should flag missing meta description', () => {
      const raw = makeRawScan({ html: '<html><head><title>Test</title></head><body></body></html>' });
      const findings = scanner.checkSEO(raw);
      expect(findings.some((f) => f.title.includes('meta description'))).toBe(true);
    });

    it('should flag missing H1', () => {
      const raw = makeRawScan({
        html: '<html><head><title>Test</title></head><body><h2>Sub</h2></body></html>',
      });
      const findings = scanner.checkSEO(raw);
      expect(findings.some((f) => f.title.includes('H1'))).toBe(true);
    });

    it('should flag multiple H1 headings', () => {
      const raw = makeRawScan({
        html: '<html><head><title>Test</title></head><body><h1>One</h1><h1>Two</h1></body></html>',
      });
      const findings = scanner.checkSEO(raw);
      expect(findings.some((f) => f.title.includes('Multiple H1'))).toBe(true);
    });
  });

  // -- Security Checks --

  describe('checkSecurity', () => {
    it('should flag missing HSTS header', () => {
      const raw = makeRawScan({ headers: {}, finalUrl: 'https://example.com' });
      const findings = scanner.checkSecurity(raw);
      expect(findings.some((f) => f.title.includes('HSTS'))).toBe(true);
    });

    it('should flag missing CSP header', () => {
      const raw = makeRawScan({ headers: {}, finalUrl: 'https://example.com' });
      const findings = scanner.checkSecurity(raw);
      expect(findings.some((f) => f.title.includes('Content Security Policy'))).toBe(true);
    });

    it('should flag HTTP-only sites as critical', () => {
      const raw = makeRawScan({ finalUrl: 'http://example.com' });
      const findings = scanner.checkSecurity(raw);
      const httpFinding = findings.find((f) => f.title.includes('HTTPS'));
      expect(httpFinding).toBeDefined();
      expect(httpFinding!.severity).toBe('critical');
    });

    it('should not flag security headers that are present', () => {
      const raw = makeRawScan({
        headers: {
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin',
          'permissions-policy': 'camera=()',
        },
        finalUrl: 'https://example.com',
      });
      const findings = scanner.checkSecurity(raw);
      // Only non-header findings should be present (e.g., no HTTPS finding)
      expect(findings.length).toBe(0);
    });
  });

  // -- Accessibility Checks --

  describe('checkAccessibility', () => {
    it('should flag missing lang attribute', () => {
      const raw = makeRawScan({ html: '<html><head></head><body></body></html>' });
      const findings = scanner.checkAccessibility(raw);
      expect(findings.some((f) => f.title.includes('lang'))).toBe(true);
    });

    it('should flag images without alt text', () => {
      const raw = makeRawScan({
        html: '<html lang="en"><body><img src="a.jpg"><img src="b.jpg" alt="B"></body></html>',
      });
      const findings = scanner.checkAccessibility(raw);
      expect(findings.some((f) => f.title.includes('alt text'))).toBe(true);
    });
  });
});

// ── Score Calculator Tests ────────────────────────────────

describe('ScoreCalculator', () => {
  let calculator: ScoreCalculator;

  beforeEach(() => {
    calculator = new ScoreCalculator();
  });

  describe('calculate', () => {
    it('should calculate weighted overall score', () => {
      const categories: ScanResult['categories'] = {
        performance: makeCategory('Performance', 80, 0.25),
        seo: makeCategory('SEO', 70, 0.20),
        security: makeCategory('Security', 60, 0.20),
        accessibility: makeCategory('Accessibility', 90, 0.10),
        migration: makeCategory('Migration', 50, 0.25),
      };
      const score = calculator.calculate(categories);
      // 80*0.25 + 70*0.20 + 60*0.20 + 90*0.10 + 50*0.25 = 20+14+12+9+12.5 = 67.5 -> 68
      expect(score).toBe(68);
    });

    it('should clamp score to 0-100 range', () => {
      const categories: ScanResult['categories'] = {
        performance: makeCategory('Performance', 100, 0.25),
        seo: makeCategory('SEO', 100, 0.20),
        security: makeCategory('Security', 100, 0.20),
        accessibility: makeCategory('Accessibility', 100, 0.10),
        migration: makeCategory('Migration', 100, 0.25),
      };
      const score = calculator.calculate(categories);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getIndustryBenchmark', () => {
    it('should return benchmark for known industry', () => {
      const benchmark = calculator.getIndustryBenchmark(55, 'financial-services');
      expect(benchmark.industry).toBe('financial-services');
      expect(benchmark.averageScore).toBe(52);
      expect(benchmark.percentile).toBeGreaterThan(0);
    });

    it('should use default benchmark for unknown industry', () => {
      const benchmark = calculator.getIndustryBenchmark(50, 'space-exploration');
      expect(benchmark.averageScore).toBe(54);
    });

    it('should return above when score exceeds average', () => {
      const benchmark = calculator.getIndustryBenchmark(75, 'healthcare');
      expect(benchmark.comparison).toBe('above');
    });

    it('should return below when score is under average', () => {
      const benchmark = calculator.getIndustryBenchmark(30, 'retail');
      expect(benchmark.comparison).toBe('below');
    });
  });

  describe('getMigrationUrgency', () => {
    it('should return none when no AEM version detected', () => {
      const urgency = calculator.getMigrationUrgency(null, 60);
      expect(urgency.level).toBe('none');
    });

    it('should return low for Cloud Service', () => {
      const urgency = calculator.getMigrationUrgency('Cloud Service', 80);
      expect(urgency.level).toBe('low');
    });

    it('should calculate days until deadline for AEM 6.5', () => {
      const urgency = calculator.getMigrationUrgency('6.5', 50);
      expect(urgency.daysUntilDeadline).not.toBeNull();
      expect(urgency.deadlineDate).toBe('2027-03-31');
      expect(urgency.level).not.toBe('none');
    });

    it('should report critical for expired versions', () => {
      const urgency = calculator.getMigrationUrgency('6.1', 30);
      expect(urgency.level).toBe('critical');
      expect(urgency.message).toContain('ended');
    });
  });

  describe('getRecommendations', () => {
    it('should sort recommendations by severity', () => {
      const categories: ScanResult['categories'] = {
        performance: makeCategory('Performance', 50, 0.25, [
          { category: 'Performance', severity: 'low', title: 'Low', description: '', recommendation: '' },
        ]),
        seo: makeCategory('SEO', 50, 0.20, [
          { category: 'SEO', severity: 'critical', title: 'Critical', description: '', recommendation: '' },
        ]),
        security: makeCategory('Security', 50, 0.20, [
          { category: 'Security', severity: 'high', title: 'High', description: '', recommendation: '' },
        ]),
        accessibility: makeCategory('Accessibility', 50, 0.10),
        migration: makeCategory('Migration', 50, 0.25),
      };
      const recs = calculator.getRecommendations(categories);
      expect(recs[0].title).toBe('Critical');
      expect(recs[1].title).toBe('High');
      expect(recs[2].title).toBe('Low');
    });

    it('should limit to 15 recommendations', () => {
      const many: ScanFinding[] = Array.from({ length: 20 }, (_, i) => ({
        category: 'Test',
        severity: 'medium' as const,
        title: `Finding ${i}`,
        description: '',
        recommendation: '',
      }));
      const categories: ScanResult['categories'] = {
        performance: makeCategory('Performance', 30, 0.25, many),
        seo: makeCategory('SEO', 50, 0.20),
        security: makeCategory('Security', 50, 0.20),
        accessibility: makeCategory('Accessibility', 50, 0.10),
        migration: makeCategory('Migration', 50, 0.25),
      };
      const recs = calculator.getRecommendations(categories);
      expect(recs.length).toBeLessThanOrEqual(15);
    });
  });

  describe('toGrade', () => {
    it('should return A for scores >= 90', () => {
      expect(ScoreCalculator.toGrade(90)).toBe('A');
      expect(ScoreCalculator.toGrade(100)).toBe('A');
    });

    it('should return B for scores 75-89', () => {
      expect(ScoreCalculator.toGrade(75)).toBe('B');
      expect(ScoreCalculator.toGrade(89)).toBe('B');
    });

    it('should return C for scores 60-74', () => {
      expect(ScoreCalculator.toGrade(60)).toBe('C');
    });

    it('should return D for scores 40-59', () => {
      expect(ScoreCalculator.toGrade(40)).toBe('D');
    });

    it('should return F for scores below 40', () => {
      expect(ScoreCalculator.toGrade(39)).toBe('F');
      expect(ScoreCalculator.toGrade(0)).toBe('F');
    });
  });
});
