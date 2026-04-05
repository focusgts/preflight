/**
 * Content-Based Regression Engine (ADR-034)
 *
 * Validates pre-migration vs post-migration site state using lightweight
 * HTTP-based comparison. No browser dependencies (Puppeteer/Playwright).
 *
 * Checks: page inventory, content integrity, SEO regression, performance baseline.
 */

// ============================================================
// Types
// ============================================================

export interface RegressionConfig {
  sourceUrl: string;
  targetUrl: string;
  pageLimit: number;
  checkSeo: boolean;
  checkPerformance: boolean;
  checkContent: boolean;
  excludePatterns: string[];
}

export interface PageSnapshot {
  url: string;
  relativePath: string;
  statusCode: number;
  finalUrl: string;
  redirected: boolean;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  h1: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  contentLength: number;
  responseTimeMs: number;
  hasCompression: boolean;
  internalLinks: string[];
  imageUrls: string[];
  formActions: string[];
  componentCount: number;
}

export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface RegressionIssue {
  severity: IssueSeverity;
  category: 'missing_page' | 'status_change' | 'seo_regression' | 'content_change' | 'performance' | 'broken_link' | 'broken_asset';
  page: string;
  field: string;
  sourceValue: string;
  targetValue: string;
  message: string;
}

export interface PageComparisonResult {
  relativePath: string;
  sourceStatus: number;
  targetStatus: number;
  matched: boolean;
  issues: RegressionIssue[];
}

export interface RegressionReport {
  id: string;
  migrationId: string;
  sourceUrl: string;
  targetUrl: string;
  status: 'completed' | 'partial' | 'failed';
  executedAt: string;
  durationMs: number;
  summary: {
    totalPages: number;
    pagesCompared: number;
    matchRate: number;
    missingPages: number;
    newPages: number;
    issuesFound: number;
    criticalIssues: number;
    majorIssues: number;
    minorIssues: number;
  };
  pageResults: PageComparisonResult[];
  issues: RegressionIssue[];
}

export interface BaselineSnapshot {
  id: string;
  migrationId: string;
  sourceUrl: string;
  capturedAt: string;
  durationMs: number;
  pageCount: number;
  pages: PageSnapshot[];
}

// ============================================================
// Constants
// ============================================================

import { validateScanTarget } from '@/lib/security/url-validator';

const USER_AGENT = 'BlackHole-Regression/1.0 (Migration Validator; focusgts.com)';
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 5;
const MAX_CRAWL_DEPTH = 3;

// ============================================================
// Helpers
// ============================================================

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

function toRelativePath(pageUrl: string, baseUrl: string): string {
  try {
    const base = new URL(normalizeUrl(baseUrl));
    const page = new URL(pageUrl);
    if (page.hostname !== base.hostname) return pageUrl;
    return page.pathname + page.search;
  } catch {
    return pageUrl;
  }
}

function isSameOrigin(link: string, baseUrl: string): boolean {
  try {
    const base = new URL(normalizeUrl(baseUrl));
    const target = new URL(link, baseUrl);
    return target.hostname === base.hostname;
  } catch {
    return false;
  }
}

function matchesExcludePattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return regex.test(path);
  });
}

function extractText(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match?.[1]?.trim() ?? '';
}

function extractMetaContent(html: string, nameOrProperty: string): string {
  // Handles both name= and property= with content before or after
  const patterns = [
    new RegExp(`<meta[^>]*(?:name|property)=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*?)["'][^>]*(?:name|property)=["']${nameOrProperty}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl).href;
      if (isSameOrigin(resolved, baseUrl)) {
        links.push(resolved);
      }
    } catch {
      // Skip malformed URLs
    }
  }
  return [...new Set(links)];
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const srcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRegex.exec(html)) !== null) {
    try {
      images.push(new URL(match[1], baseUrl).href);
    } catch {
      // Skip malformed
    }
  }
  return [...new Set(images)];
}

function extractFormActions(html: string, baseUrl: string): string[] {
  const actions: string[] = [];
  const formRegex = /<form[^>]+action=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = formRegex.exec(html)) !== null) {
    try {
      actions.push(new URL(match[1], baseUrl).href);
    } catch {
      // Skip malformed
    }
  }
  return [...new Set(actions)];
}

function countComponents(html: string): number {
  // Count AEM-style components and generic semantic sections
  const patterns = [
    /class=["'][^"']*(?:cmp-|parbase|aem-Grid)[^"']*["']/gi,
    /data-component/gi,
    /<(?:section|article|aside|nav|header|footer)[\s>]/gi,
  ];
  let count = 0;
  for (const p of patterns) {
    const matches = html.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

/** Run an async function for each item with bounded concurrency. */
async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================
// Page Fetcher
// ============================================================

async function fetchPageSnapshot(url: string, baseUrl: string): Promise<PageSnapshot> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    const html = await response.text();
    const responseTimeMs = Date.now() - start;

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    const encoding = headers['content-encoding'] ?? '';
    const hasCompression = /gzip|br|deflate/i.test(encoding);

    return {
      url,
      relativePath: toRelativePath(url, baseUrl),
      statusCode: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      title: extractText(html, /<title[^>]*>(.*?)<\/title>/is),
      metaDescription: extractMetaContent(html, 'description'),
      canonicalUrl: extractText(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
      h1: extractText(html, /<h1[^>]*>(.*?)<\/h1>/is),
      ogTitle: extractMetaContent(html, 'og:title'),
      ogDescription: extractMetaContent(html, 'og:description'),
      ogImage: extractMetaContent(html, 'og:image'),
      contentLength: new TextEncoder().encode(html).length,
      responseTimeMs,
      hasCompression,
      internalLinks: extractInternalLinks(html, baseUrl),
      imageUrls: extractImageUrls(html, baseUrl),
      formActions: extractFormActions(html, baseUrl),
      componentCount: countComponents(html),
    };
  } catch {
    return {
      url,
      relativePath: toRelativePath(url, baseUrl),
      statusCode: 0,
      finalUrl: url,
      redirected: false,
      title: '',
      metaDescription: '',
      canonicalUrl: '',
      h1: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      contentLength: 0,
      responseTimeMs: Date.now() - start,
      hasCompression: false,
      internalLinks: [],
      imageUrls: [],
      formActions: [],
      componentCount: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Crawler
// ============================================================

export async function crawlSite(
  baseUrl: string,
  pageLimit: number,
  excludePatterns: string[],
): Promise<PageSnapshot[]> {
  const normalized = normalizeUrl(baseUrl);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: normalized, depth: 0 }];
  const pages: PageSnapshot[] = [];

  while (queue.length > 0 && pages.length < pageLimit) {
    // Take a batch from the queue
    const batchSize = Math.min(CONCURRENCY, pageLimit - pages.length, queue.length);
    const batch = queue.splice(0, batchSize);

    const snapshots = await parallelMap(batch, CONCURRENCY, async ({ url, depth }) => {
      if (visited.has(url)) return null;
      visited.add(url);

      const path = toRelativePath(url, normalized);
      if (matchesExcludePattern(path, excludePatterns)) return null;

      // Skip non-HTML resources by extension
      if (/\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|mp4|mp3|css|js|woff|woff2|ttf|eot)$/i.test(path)) {
        return null;
      }

      const snapshot = await fetchPageSnapshot(url, normalized);

      // Queue discovered internal links for further crawling
      if (depth < MAX_CRAWL_DEPTH && snapshot.statusCode >= 200 && snapshot.statusCode < 400) {
        for (const link of snapshot.internalLinks) {
          const cleanLink = link.split('#')[0].replace(/\/+$/, '');
          if (!visited.has(cleanLink) && pages.length + queue.length < pageLimit * 2) {
            queue.push({ url: cleanLink, depth: depth + 1 });
          }
        }
      }

      return snapshot;
    });

    for (const s of snapshots) {
      if (s && pages.length < pageLimit) {
        pages.push(s);
      }
    }
  }

  return pages;
}

// ============================================================
// Comparison Engine
// ============================================================

function comparePage(
  source: PageSnapshot,
  target: PageSnapshot,
  config: Pick<RegressionConfig, 'checkSeo' | 'checkPerformance' | 'checkContent'>,
): PageComparisonResult {
  const issues: RegressionIssue[] = [];
  const path = source.relativePath;

  // Status code change
  if (source.statusCode !== target.statusCode) {
    const severity: IssueSeverity =
      target.statusCode === 404 || target.statusCode === 0 ? 'critical' :
      target.statusCode >= 500 ? 'critical' :
      target.statusCode >= 300 && source.statusCode === 200 ? 'major' :
      'minor';
    issues.push({
      severity,
      category: 'status_change',
      page: path,
      field: 'statusCode',
      sourceValue: String(source.statusCode),
      targetValue: String(target.statusCode),
      message: `Status code changed from ${source.statusCode} to ${target.statusCode}`,
    });
  }

  // SEO checks
  if (config.checkSeo) {
    if (source.title && source.title !== target.title) {
      issues.push({
        severity: 'major',
        category: 'seo_regression',
        page: path,
        field: 'title',
        sourceValue: source.title,
        targetValue: target.title,
        message: `Title changed: "${source.title}" -> "${target.title}"`,
      });
    }

    if (source.metaDescription && source.metaDescription !== target.metaDescription) {
      issues.push({
        severity: 'major',
        category: 'seo_regression',
        page: path,
        field: 'metaDescription',
        sourceValue: source.metaDescription,
        targetValue: target.metaDescription,
        message: `Meta description changed`,
      });
    }

    if (source.canonicalUrl && source.canonicalUrl !== target.canonicalUrl) {
      issues.push({
        severity: 'major',
        category: 'seo_regression',
        page: path,
        field: 'canonicalUrl',
        sourceValue: source.canonicalUrl,
        targetValue: target.canonicalUrl,
        message: `Canonical URL changed: "${source.canonicalUrl}" -> "${target.canonicalUrl}"`,
      });
    }

    if (source.h1 && source.h1 !== target.h1) {
      issues.push({
        severity: 'minor',
        category: 'seo_regression',
        page: path,
        field: 'h1',
        sourceValue: source.h1,
        targetValue: target.h1,
        message: `H1 heading changed`,
      });
    }

    if (source.ogTitle && !target.ogTitle) {
      issues.push({
        severity: 'major',
        category: 'seo_regression',
        page: path,
        field: 'ogTitle',
        sourceValue: source.ogTitle,
        targetValue: '',
        message: `OG title tag removed`,
      });
    }

    if (source.ogDescription && !target.ogDescription) {
      issues.push({
        severity: 'minor',
        category: 'seo_regression',
        page: path,
        field: 'ogDescription',
        sourceValue: source.ogDescription,
        targetValue: '',
        message: `OG description tag removed`,
      });
    }

    if (source.ogImage && !target.ogImage) {
      issues.push({
        severity: 'minor',
        category: 'seo_regression',
        page: path,
        field: 'ogImage',
        sourceValue: source.ogImage,
        targetValue: '',
        message: `OG image tag removed`,
      });
    }
  }

  // Content checks
  if (config.checkContent) {
    // Component count drop (>20% drop is significant)
    if (source.componentCount > 0) {
      const drop = source.componentCount - target.componentCount;
      const dropPct = (drop / source.componentCount) * 100;
      if (dropPct > 20) {
        issues.push({
          severity: 'major',
          category: 'content_change',
          page: path,
          field: 'componentCount',
          sourceValue: String(source.componentCount),
          targetValue: String(target.componentCount),
          message: `Component count dropped by ${Math.round(dropPct)}% (${source.componentCount} -> ${target.componentCount})`,
        });
      }
    }

    // Content length change (>50% change is significant)
    if (source.contentLength > 0) {
      const change = Math.abs(target.contentLength - source.contentLength);
      const changePct = (change / source.contentLength) * 100;
      if (changePct > 50) {
        const direction = target.contentLength > source.contentLength ? 'increased' : 'decreased';
        issues.push({
          severity: 'major',
          category: 'content_change',
          page: path,
          field: 'contentLength',
          sourceValue: `${Math.round(source.contentLength / 1024)}KB`,
          targetValue: `${Math.round(target.contentLength / 1024)}KB`,
          message: `Content size ${direction} by ${Math.round(changePct)}%`,
        });
      }
    }
  }

  // Performance checks
  if (config.checkPerformance) {
    // Response time regression (>2x slower)
    if (source.responseTimeMs > 0 && target.responseTimeMs > source.responseTimeMs * 2) {
      issues.push({
        severity: 'minor',
        category: 'performance',
        page: path,
        field: 'responseTimeMs',
        sourceValue: `${source.responseTimeMs}ms`,
        targetValue: `${target.responseTimeMs}ms`,
        message: `Response time regressed from ${source.responseTimeMs}ms to ${target.responseTimeMs}ms`,
      });
    }

    // Compression missing
    if (source.hasCompression && !target.hasCompression) {
      issues.push({
        severity: 'minor',
        category: 'performance',
        page: path,
        field: 'compression',
        sourceValue: 'enabled',
        targetValue: 'disabled',
        message: `Response compression is missing on target`,
      });
    }
  }

  return {
    relativePath: path,
    sourceStatus: source.statusCode,
    targetStatus: target.statusCode,
    matched: issues.length === 0,
    issues,
  };
}

// ============================================================
// Public API
// ============================================================

/**
 * Capture a baseline snapshot of the source site for later comparison.
 */
export async function captureBaseline(
  migrationId: string,
  sourceUrl: string,
  pageLimit: number,
  excludePatterns: string[] = [],
): Promise<BaselineSnapshot> {
  // ADR-047: SSRF protection
  const sourceValidation = validateScanTarget(sourceUrl);
  if (!sourceValidation.valid) {
    throw new Error(`Source URL rejected: ${sourceValidation.reason}`);
  }

  const start = Date.now();
  const pages = await crawlSite(sourceUrl, pageLimit, excludePatterns);

  return {
    id: `baseline-${migrationId}-${Date.now()}`,
    migrationId,
    sourceUrl: normalizeUrl(sourceUrl),
    capturedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    pageCount: pages.length,
    pages,
  };
}

/**
 * Run a full regression comparison between source and target sites.
 */
export async function runRegression(
  migrationId: string,
  config: RegressionConfig,
): Promise<RegressionReport> {
  // ADR-047: SSRF protection — validate both source and target
  const sourceValidation = validateScanTarget(config.sourceUrl);
  if (!sourceValidation.valid) {
    throw new Error(`Source URL rejected: ${sourceValidation.reason}`);
  }
  const targetValidation = validateScanTarget(config.targetUrl);
  if (!targetValidation.valid) {
    throw new Error(`Target URL rejected: ${targetValidation.reason}`);
  }

  const start = Date.now();
  const normalizedSource = normalizeUrl(config.sourceUrl);
  const normalizedTarget = normalizeUrl(config.targetUrl);

  // Crawl both sites in parallel
  const [sourcePages, targetPages] = await Promise.all([
    crawlSite(normalizedSource, config.pageLimit, config.excludePatterns),
    crawlSite(normalizedTarget, config.pageLimit, config.excludePatterns),
  ]);

  // Build lookup maps by relative path
  const sourceMap = new Map<string, PageSnapshot>();
  for (const page of sourcePages) {
    sourceMap.set(page.relativePath, page);
  }

  const targetMap = new Map<string, PageSnapshot>();
  for (const page of targetPages) {
    targetMap.set(page.relativePath, page);
  }

  const allIssues: RegressionIssue[] = [];
  const pageResults: PageComparisonResult[] = [];

  // Compare pages that exist on source
  for (const [path, sourcePage] of sourceMap) {
    const targetPage = targetMap.get(path);
    if (!targetPage) {
      // Missing on target
      const issue: RegressionIssue = {
        severity: 'critical',
        category: 'missing_page',
        page: path,
        field: 'page',
        sourceValue: String(sourcePage.statusCode),
        targetValue: 'missing',
        message: `Page "${path}" exists on source (status ${sourcePage.statusCode}) but is missing on target`,
      };
      allIssues.push(issue);
      pageResults.push({
        relativePath: path,
        sourceStatus: sourcePage.statusCode,
        targetStatus: 0,
        matched: false,
        issues: [issue],
      });
    } else {
      const result = comparePage(sourcePage, targetPage, config);
      pageResults.push(result);
      allIssues.push(...result.issues);
    }
  }

  // Detect pages on target that are not on source (new pages)
  const newPages: string[] = [];
  for (const path of targetMap.keys()) {
    if (!sourceMap.has(path)) {
      newPages.push(path);
    }
  }

  // Check for broken internal links on target
  if (config.checkContent) {
    const targetPathSet = new Set(targetMap.keys());
    for (const [path, targetPage] of targetMap) {
      for (const link of targetPage.internalLinks) {
        const linkPath = toRelativePath(link, normalizedTarget);
        if (!targetPathSet.has(linkPath) && !targetPathSet.has(linkPath + '/') && !targetPathSet.has(linkPath.replace(/\/$/, ''))) {
          allIssues.push({
            severity: 'major',
            category: 'broken_link',
            page: path,
            field: 'internalLink',
            sourceValue: '',
            targetValue: linkPath,
            message: `Internal link to "${linkPath}" on target page "${path}" may be broken`,
          });
        }
      }
    }
  }

  const matchedPages = pageResults.filter((r) => r.matched).length;
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length;
  const majorIssues = allIssues.filter((i) => i.severity === 'major').length;
  const minorIssues = allIssues.filter((i) => i.severity === 'minor').length;

  const pagesCompared = pageResults.length;
  const matchRate = pagesCompared > 0 ? Math.round((matchedPages / pagesCompared) * 100) : 0;

  return {
    id: `regression-${migrationId}-${Date.now()}`,
    migrationId,
    sourceUrl: normalizedSource,
    targetUrl: normalizedTarget,
    status: criticalIssues > 0 ? 'partial' : 'completed',
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    summary: {
      totalPages: sourcePages.length,
      pagesCompared,
      matchRate,
      missingPages: pageResults.filter((r) => r.targetStatus === 0).length,
      newPages: newPages.length,
      issuesFound: allIssues.length,
      criticalIssues,
      majorIssues,
      minorIssues,
    },
    pageResults,
    issues: allIssues,
  };
}

/**
 * Compare a target crawl against a previously captured baseline.
 */
export async function compareAgainstBaseline(
  baseline: BaselineSnapshot,
  config: RegressionConfig,
): Promise<RegressionReport> {
  const start = Date.now();
  const normalizedTarget = normalizeUrl(config.targetUrl);

  // Only crawl target since we have the baseline
  const targetPages = await crawlSite(normalizedTarget, config.pageLimit, config.excludePatterns);

  const sourceMap = new Map<string, PageSnapshot>();
  for (const page of baseline.pages) {
    sourceMap.set(page.relativePath, page);
  }

  const targetMap = new Map<string, PageSnapshot>();
  for (const page of targetPages) {
    targetMap.set(page.relativePath, page);
  }

  const allIssues: RegressionIssue[] = [];
  const pageResults: PageComparisonResult[] = [];

  for (const [path, sourcePage] of sourceMap) {
    const targetPage = targetMap.get(path);
    if (!targetPage) {
      const issue: RegressionIssue = {
        severity: 'critical',
        category: 'missing_page',
        page: path,
        field: 'page',
        sourceValue: String(sourcePage.statusCode),
        targetValue: 'missing',
        message: `Page "${path}" exists in baseline but is missing on target`,
      };
      allIssues.push(issue);
      pageResults.push({
        relativePath: path,
        sourceStatus: sourcePage.statusCode,
        targetStatus: 0,
        matched: false,
        issues: [issue],
      });
    } else {
      const result = comparePage(sourcePage, targetPage, config);
      pageResults.push(result);
      allIssues.push(...result.issues);
    }
  }

  const newPages: string[] = [];
  for (const path of targetMap.keys()) {
    if (!sourceMap.has(path)) newPages.push(path);
  }

  const matchedPages = pageResults.filter((r) => r.matched).length;
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length;
  const majorIssues = allIssues.filter((i) => i.severity === 'major').length;
  const minorIssues = allIssues.filter((i) => i.severity === 'minor').length;
  const pagesCompared = pageResults.length;
  const matchRate = pagesCompared > 0 ? Math.round((matchedPages / pagesCompared) * 100) : 0;

  return {
    id: `regression-${baseline.migrationId}-${Date.now()}`,
    migrationId: baseline.migrationId,
    sourceUrl: baseline.sourceUrl,
    targetUrl: normalizedTarget,
    status: criticalIssues > 0 ? 'partial' : 'completed',
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    summary: {
      totalPages: baseline.pageCount,
      pagesCompared,
      matchRate,
      missingPages: pageResults.filter((r) => r.targetStatus === 0).length,
      newPages: newPages.length,
      issuesFound: allIssues.length,
      criticalIssues,
      majorIssues,
      minorIssues,
    },
    pageResults,
    issues: allIssues,
  };
}
