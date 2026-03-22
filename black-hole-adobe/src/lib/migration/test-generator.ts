/**
 * Automated Test Generation Engine
 *
 * Generates portable test specifications (JSON) for migration validation
 * covering content integrity, SEO, visual regression, performance, and integrations.
 */
import { Severity } from '@/types';
import type { ContentNode, RedirectMapping } from './content-migrator';
import type { DiscoveredIntegration } from './integration-migrator';

export interface TestSuite { id: string; name: string; type: TestType; generatedAt: string; tests: TestSpec[]; metadata: Record<string, unknown>; }
export type TestType = 'content_integrity' | 'seo' | 'visual_regression' | 'performance' | 'integration';
export interface TestSpec { id: string; name: string; description: string; type: TestType; priority: 'critical' | 'high' | 'medium' | 'low'; steps: TestStep[]; assertions: TestAssertion[]; timeout: number; tags: string[]; }
export interface TestStep { action: string; target: string; value?: string; description: string; }
export interface TestAssertion { type: AssertionType; target: string; expected: unknown; tolerance?: number; message: string; }
export type AssertionType = 'equals' | 'contains' | 'exists' | 'not_exists' | 'status_code' | 'response_time' | 'visual_match' | 'greater_than' | 'less_than' | 'matches_regex' | 'count_equals' | 'header_contains';
export interface VisualTestConfig { baseUrl: string; pages: string[]; viewports: Array<{ width: number; height: number; name: string }>; threshold: number; ignoreRegions?: Array<{ selector: string; description: string }>; }
export interface PerformanceTestConfig { baseUrl: string; pages: string[]; metrics: PerformanceMetric[]; iterations: number; }
export interface PerformanceMetric { name: string; type: 'lcp' | 'fid' | 'cls' | 'ttfb' | 'fcp' | 'tti' | 'tbt' | 'custom'; threshold: number; unit: 'ms' | 'score' | 'bytes'; }

const DEFAULT_VIEWPORTS = [
  { width: 1920, height: 1080, name: 'desktop' }, { width: 1024, height: 768, name: 'tablet' },
  { width: 768, height: 1024, name: 'tablet-portrait' }, { width: 375, height: 812, name: 'mobile' },
];
const DEFAULT_METRICS: PerformanceMetric[] = [
  { name: 'LCP', type: 'lcp', threshold: 2500, unit: 'ms' }, { name: 'FID', type: 'fid', threshold: 100, unit: 'ms' },
  { name: 'CLS', type: 'cls', threshold: 0.1, unit: 'score' }, { name: 'TTFB', type: 'ttfb', threshold: 800, unit: 'ms' },
  { name: 'FCP', type: 'fcp', threshold: 1800, unit: 'ms' }, { name: 'TTI', type: 'tti', threshold: 3800, unit: 'ms' },
  { name: 'TBT', type: 'tbt', threshold: 200, unit: 'ms' },
];

export class TestGenerator {
  /** Generate content integrity tests: page existence, asset access, CF validation, metadata. */
  async generateContentTests(nodes: ContentNode[], baseUrl: string): Promise<TestSuite> {
    const tests: TestSpec[] = [];
    let id = 0;
    const pages = nodes.filter((n) => n.type === 'page');
    for (const p of pages) tests.push(this.spec(`ct-${id++}`, `Page: ${p.path}`, `Verify ${p.path} exists.`, 'content_integrity',
      p.published ? 'critical' : 'medium', [{ action: 'http_get', target: `${baseUrl}${p.path}.html`, description: `GET ${p.path}` }],
      [{ type: 'status_code', target: 'response', expected: 200, message: `${p.path} returns 200.` },
       { type: 'contains', target: 'response.body', expected: p.title, message: `Contains "${p.title}".` }], ['content', 'page']));
    const assets = nodes.filter((n) => n.type === 'asset').slice(0, 100);
    for (const a of assets) tests.push(this.spec(`ct-${id++}`, `Asset: ${a.path}`, `Verify ${a.path} accessible.`, 'content_integrity', 'high',
      [{ action: 'http_head', target: `${baseUrl}${a.path}`, description: `HEAD ${a.path}` }],
      [{ type: 'status_code', target: 'response', expected: 200, message: `Asset accessible.` }], ['content', 'asset']));
    const cfs = nodes.filter((n) => n.type === 'content_fragment');
    for (const cf of cfs) tests.push(this.spec(`ct-${id++}`, `CF: ${cf.path}`, `Verify CF "${cf.title}".`, 'content_integrity', 'high',
      [{ action: 'http_get', target: `${baseUrl}${cf.path}.json`, description: `GET CF JSON` }],
      [{ type: 'status_code', target: 'response', expected: 200, message: `CF exists.` },
       { type: 'contains', target: 'response.body', expected: cf.title, message: `Contains title.` }], ['content', 'cf']));
    return { id: `suite-ct-${Date.now()}`, name: 'Content Integrity', type: 'content_integrity', generatedAt: new Date().toISOString(), tests,
      metadata: { pages: pages.length, assets: assets.length, fragments: cfs.length, baseUrl } };
  }

  /** Generate SEO tests: redirects, meta tags, canonical URLs, robots.txt, sitemap. */
  async generateSEOTests(nodes: ContentNode[], redirects: RedirectMapping[], targetUrl: string, sourceUrl: string): Promise<TestSuite> {
    const tests: TestSpec[] = [];
    let id = 0;
    for (const r of redirects.filter((r) => !r.pattern)) tests.push(this.spec(`seo-${id++}`, `Redirect: ${r.sourcePath}`,
      `Verify ${r.statusCode} redirect.`, 'seo', 'critical',
      [{ action: 'http_get_no_follow', target: `${targetUrl}${r.sourcePath}`, description: 'Request old URL' }],
      [{ type: 'status_code', target: 'response', expected: r.statusCode, message: `Returns ${r.statusCode}.` },
       { type: 'header_contains', target: 'response.headers.location', expected: r.targetPath, message: `Redirects to ${r.targetPath}.` }], ['seo', 'redirect']));
    const published = nodes.filter((n) => n.type === 'page' && n.published).slice(0, 50);
    for (const p of published) tests.push(this.spec(`seo-${id++}`, `Meta: ${p.path}`, `Verify SEO tags.`, 'seo', 'high',
      [{ action: 'http_get', target: `${targetUrl}${p.path}.html`, description: 'GET page' }],
      [{ type: 'contains', target: 'response.body', expected: `<title>${p.title}`, message: `Has title tag.` },
       { type: 'contains', target: 'response.body', expected: 'rel="canonical"', message: `Has canonical.` }], ['seo', 'meta']));
    tests.push(this.spec(`seo-${id++}`, 'robots.txt', 'Verify robots.txt.', 'seo', 'critical',
      [{ action: 'http_get', target: `${targetUrl}/robots.txt`, description: 'GET robots.txt' }],
      [{ type: 'status_code', target: 'response', expected: 200, message: 'Accessible.' },
       { type: 'contains', target: 'response.body', expected: 'User-agent', message: 'Has User-agent.' },
       { type: 'contains', target: 'response.body', expected: 'Sitemap', message: 'References sitemap.' }], ['seo', 'robots']));
    tests.push(this.spec(`seo-${id++}`, 'sitemap.xml', 'Verify sitemap.', 'seo', 'critical',
      [{ action: 'http_get', target: `${targetUrl}/sitemap.xml`, description: 'GET sitemap' }],
      [{ type: 'status_code', target: 'response', expected: 200, message: 'Accessible.' },
       { type: 'contains', target: 'response.body', expected: '<urlset', message: 'Valid XML.' }], ['seo', 'sitemap']));
    return { id: `suite-seo-${Date.now()}`, name: 'SEO Validation', type: 'seo', generatedAt: new Date().toISOString(), tests,
      metadata: { redirects: redirects.length, publishedPages: published.length, sourceUrl, targetUrl } };
  }

  /** Generate visual regression test configs across viewports. */
  async generateVisualTests(config: VisualTestConfig): Promise<TestSuite> {
    const tests: TestSpec[] = [];
    let id = 0;
    const vps = config.viewports.length > 0 ? config.viewports : DEFAULT_VIEWPORTS;
    for (const page of config.pages) for (const vp of vps) {
      const slug = page.replace(/\//g, '_');
      tests.push(this.spec(`vis-${id++}`, `Visual: ${page} @ ${vp.name}`, `Screenshot comparison at ${vp.width}x${vp.height}.`, 'visual_regression',
        vp.name === 'desktop' ? 'critical' : 'high',
        [{ action: 'set_viewport', target: 'browser', value: `${vp.width}x${vp.height}`, description: `Set ${vp.name}` },
         { action: 'navigate', target: `${config.baseUrl}${page}`, description: `Go to ${page}` },
         { action: 'wait_for_load', target: 'page', value: '3000', description: 'Wait for load' },
         { action: 'screenshot', target: `${slug}_${vp.name}`, description: 'Capture' }],
        [{ type: 'visual_match', target: 'screenshot', expected: `baseline_${slug}_${vp.name}`, tolerance: config.threshold,
           message: `Match within ${config.threshold * 100}%.` }], ['visual', vp.name]));
    }
    return { id: `suite-vis-${Date.now()}`, name: 'Visual Regression', type: 'visual_regression', generatedAt: new Date().toISOString(), tests,
      metadata: { baseUrl: config.baseUrl, threshold: config.threshold, viewports: vps } };
  }

  /** Generate Core Web Vitals and performance benchmark tests. */
  async generatePerformanceTests(config: PerformanceTestConfig): Promise<TestSuite> {
    const tests: TestSpec[] = [];
    let id = 0;
    const metrics = config.metrics.length > 0 ? config.metrics : DEFAULT_METRICS;
    for (const page of config.pages) {
      tests.push(this.spec(`perf-${id++}`, `CWV: ${page}`, `Core Web Vitals for ${page}, ${config.iterations} runs.`, 'performance', 'high',
        [{ action: 'clear_cache', target: 'browser', description: 'Clear cache' },
         { action: 'navigate', target: `${config.baseUrl}${page}`, description: `Go to ${page}` },
         { action: 'collect_metrics', target: 'performance', value: String(config.iterations), description: 'Collect metrics' }],
        metrics.map((m) => ({ type: 'less_than' as AssertionType, target: `performance.${m.type}`, expected: m.threshold,
          message: `${m.name} under ${m.threshold}${m.unit}.` })), ['performance', 'cwv']));
      tests.push(this.spec(`perf-${id++}`, `Weight: ${page}`, `Page weight check.`, 'performance', 'medium',
        [{ action: 'navigate', target: `${config.baseUrl}${page}`, description: `Go to ${page}` },
         { action: 'collect_network', target: 'resources', description: 'Collect network' }],
        [{ type: 'less_than', target: 'network.totalBytes', expected: 3 * 1024 * 1024, message: 'Under 3 MB.' },
         { type: 'less_than', target: 'network.requests', expected: 100, message: 'Under 100 requests.' }], ['performance', 'weight']));
    }
    return { id: `suite-perf-${Date.now()}`, name: 'Performance Benchmarks', type: 'performance', generatedAt: new Date().toISOString(), tests,
      metadata: { baseUrl: config.baseUrl, metrics, iterations: config.iterations } };
  }

  /** Generate integration endpoint tests: connectivity, auth, data flow. */
  async generateIntegrationTests(integrations: DiscoveredIntegration[], baseUrl: string): Promise<TestSuite> {
    const tests: TestSpec[] = [];
    let id = 0;
    for (const int of integrations) {
      if (int.endpoint) tests.push(this.spec(`int-${id++}`, `Connect: ${int.name}`, `Verify ${int.name} endpoint.`, 'integration',
        int.criticality === Severity.CRITICAL ? 'critical' : 'high',
        [{ action: 'http_options', target: int.endpoint, description: `OPTIONS ${int.name}` }],
        [{ type: 'status_code', target: 'response', expected: 200, tolerance: 204, message: 'Reachable.' },
         { type: 'response_time', target: 'response', expected: 5000, message: 'Under 5s.' }], ['integration', int.type]));
      tests.push(this.spec(`int-${id++}`, `Auth: ${int.name}`, `Verify auth for ${int.name}.`, 'integration', 'critical',
        [{ action: 'authenticate', target: int.endpoint ?? baseUrl, value: int.authType, description: `Auth with ${int.authType}` }],
        [{ type: 'exists', target: 'auth.token', expected: true, message: 'Auth succeeds.' }], ['integration', 'auth']));
      if (int.dataFlow !== 'inbound') tests.push(this.spec(`int-${id++}`, `Flow: ${int.name}`, `Data flow to ${int.name}.`, 'integration', 'high',
        [{ action: 'http_post', target: int.endpoint ?? baseUrl, value: '{"test":true}', description: `POST test payload` }],
        [{ type: 'status_code', target: 'response', expected: 200, tolerance: 202, message: 'Accepts data.' }], ['integration', 'data-flow']));
    }
    return { id: `suite-int-${Date.now()}`, name: 'Integration Tests', type: 'integration', generatedAt: new Date().toISOString(), tests,
      metadata: { total: integrations.length, baseUrl } };
  }

  private spec(id: string, name: string, desc: string, type: TestType, priority: TestSpec['priority'],
    steps: TestStep[], assertions: TestAssertion[], tags: string[]): TestSpec {
    return { id, name, description: desc, type, priority, steps, assertions, timeout: 15000, tags };
  }
}
