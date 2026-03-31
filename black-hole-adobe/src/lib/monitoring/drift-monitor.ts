/**
 * Post-Migration Drift Monitor Engine (ADR-035)
 *
 * Detects environment changes to migrated AEMaaCS sites after go-live.
 * Stores a baseline snapshot post-migration, then compares subsequent
 * scans against that baseline to calculate a drift score.
 *
 * Drift Categories: performance, security, content, configuration, seo
 * Alert Levels: green (0-10), yellow (11-30), red (31+)
 */

import { v4 as uuidv4 } from 'uuid';
import { SiteScanner } from '@/lib/scanner/site-scanner';
import type { ScanResult, RawScanData, PlatformDetails } from '@/types/scanner';

// ============================================================
// Types
// ============================================================

export interface PageSnapshot {
  url: string;
  title: string;
  statusCode: number;
  responseTimeMs: number;
}

export interface PerformanceBaseline {
  averageResponseTimeMs: number;
  hasCompression: boolean;
  contentSizeBytes: number;
  redirectCount: number;
}

export interface SecurityBaseline {
  headers: string[];
  isHttps: boolean;
}

export interface SeoBaseline {
  hasTitle: boolean;
  titleText: string;
  hasMetaDescription: boolean;
  hasCanonical: boolean;
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  h1Count: number;
}

export interface AemSignalBaseline {
  aemDetected: boolean;
  version: string | null;
  deployment: PlatformDetails['deployment'];
  indicators: string[];
  confidence: number;
}

export interface DriftBaseline {
  migrationId: string;
  capturedAt: string;
  siteUrl: string;
  healthScore: number;
  pages: PageSnapshot[];
  performance: PerformanceBaseline;
  security: SecurityBaseline;
  seo: SeoBaseline;
  aemSignals: AemSignalBaseline;
}

export type DriftCategory =
  | 'performance'
  | 'security'
  | 'content'
  | 'configuration'
  | 'seo';

export type AlertLevel = 'green' | 'yellow' | 'red';

export interface DriftChange {
  category: DriftCategory;
  field: string;
  baselineValue: string;
  currentValue: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface DriftCheck {
  id: string;
  migrationId: string;
  checkedAt: string;
  driftScore: number;
  alertLevel: AlertLevel;
  changes: DriftChange[];
  currentHealthScore: number;
  baselineHealthScore: number;
}

export interface MonitoringSummary {
  migrationId: string;
  siteUrl: string;
  baselineCapturedAt: string;
  lastCheckAt: string | null;
  currentAlertLevel: AlertLevel;
  currentDriftScore: number;
  totalChecks: number;
}

// ============================================================
// In-Memory Store
// ============================================================

const baselines = new Map<string, DriftBaseline>();
const driftHistory = new Map<string, DriftCheck[]>();

// ── Store Helpers ────────────────────────────────────────────

export function storeBaseline(
  migrationId: string,
  baseline: DriftBaseline,
): void {
  baselines.set(migrationId, baseline);
  // Initialise history array if not present
  if (!driftHistory.has(migrationId)) {
    driftHistory.set(migrationId, []);
  }
}

export function getBaseline(
  migrationId: string,
): DriftBaseline | undefined {
  return baselines.get(migrationId);
}

export function storeDriftCheck(
  migrationId: string,
  check: DriftCheck,
): void {
  const history = driftHistory.get(migrationId) ?? [];
  history.push(check);
  driftHistory.set(migrationId, history);
}

export function getDriftHistory(
  migrationId: string,
  limit = 50,
): DriftCheck[] {
  const history = driftHistory.get(migrationId) ?? [];
  // Return most recent first, capped by limit
  return history.slice(-limit).reverse();
}

export function listMonitoredMigrations(): MonitoringSummary[] {
  const summaries: MonitoringSummary[] = [];

  for (const [migrationId, baseline] of baselines.entries()) {
    const history = driftHistory.get(migrationId) ?? [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    summaries.push({
      migrationId,
      siteUrl: baseline.siteUrl,
      baselineCapturedAt: baseline.capturedAt,
      lastCheckAt: latest?.checkedAt ?? null,
      currentAlertLevel: latest?.alertLevel ?? 'green',
      currentDriftScore: latest?.driftScore ?? 0,
      totalChecks: history.length,
    });
  }

  return summaries;
}

export function deleteMonitoring(migrationId: string): boolean {
  const hadBaseline = baselines.delete(migrationId);
  driftHistory.delete(migrationId);
  return hadBaseline;
}

// ============================================================
// Drift Monitor Engine
// ============================================================

export class DriftMonitor {
  private scanner = new SiteScanner();

  /**
   * Capture a post-migration baseline for a site.
   * Runs a full scan and extracts all metrics for future comparison.
   */
  async captureBaseline(
    migrationId: string,
    siteUrl: string,
  ): Promise<DriftBaseline> {
    const scanResult = await this.scanner.scan(siteUrl);

    const baseline = this.buildBaselineFromScan(
      migrationId,
      siteUrl,
      scanResult,
    );

    storeBaseline(migrationId, baseline);
    return baseline;
  }

  /**
   * Run a drift check against the stored baseline.
   * Returns a DriftCheck with a score and list of changes.
   */
  async runDriftCheck(migrationId: string): Promise<DriftCheck> {
    const baseline = getBaseline(migrationId);
    if (!baseline) {
      throw new Error(
        `No baseline found for migration "${migrationId}". Capture a baseline first.`,
      );
    }

    const scanResult = await this.scanner.scan(baseline.siteUrl);
    const currentSnapshot = this.buildBaselineFromScan(
      migrationId,
      baseline.siteUrl,
      scanResult,
    );

    const changes = this.compareBaselines(baseline, currentSnapshot);
    const driftScore = this.calculateDriftScore(changes);
    const alertLevel = this.resolveAlertLevel(driftScore);

    const check: DriftCheck = {
      id: uuidv4(),
      migrationId,
      checkedAt: new Date().toISOString(),
      driftScore,
      alertLevel,
      changes,
      currentHealthScore: scanResult.overallScore,
      baselineHealthScore: baseline.healthScore,
    };

    storeDriftCheck(migrationId, check);
    return check;
  }

  // ── Baseline Builder ───────────────────────────────────────

  private buildBaselineFromScan(
    migrationId: string,
    siteUrl: string,
    scan: ScanResult,
  ): DriftBaseline {
    const perfFindings = scan.categories.performance.findings;
    const hasCompression = !perfFindings.some(
      (f) => f.title === 'No compression detected',
    );

    const secHeaders: string[] = [];
    const securityChecked = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
    ];
    const secFindings = scan.categories.security.findings;
    for (const header of securityChecked) {
      const missing = secFindings.some(
        (f) => f.description.includes(header),
      );
      if (!missing) {
        secHeaders.push(header);
      }
    }

    // Extract SEO signals from findings
    const seoFindings = scan.categories.seo.findings;
    const hasTitle = !seoFindings.some((f) => f.title === 'Missing page title');
    const hasMetaDescription = !seoFindings.some(
      (f) => f.title === 'Missing meta description',
    );
    const hasCanonical = !seoFindings.some(
      (f) => f.title === 'Missing canonical URL',
    );
    const hasStructuredData = !seoFindings.some(
      (f) => f.title === 'No structured data found',
    );
    const hasOpenGraph = !seoFindings.some(
      (f) => f.title === 'Missing Open Graph tags',
    );
    const h1Finding = seoFindings.find(
      (f) => f.title === 'Missing H1 heading',
    );
    const multiH1 = seoFindings.find(
      (f) => f.title === 'Multiple H1 headings',
    );
    let h1Count = 1;
    if (h1Finding) h1Count = 0;
    if (multiH1) {
      const match = multiH1.description.match(/Found (\d+)/);
      h1Count = match ? parseInt(match[1], 10) : 2;
    }

    const page: PageSnapshot = {
      url: scan.url,
      title: '',
      statusCode: 200,
      responseTimeMs: 0,
    };

    // Extract response time from performance findings
    const slowFinding = scan.categories.performance.findings.find(
      (f) =>
        f.title.includes('slow') ||
        f.title.includes('Slow') ||
        f.title.includes('faster'),
    );
    if (slowFinding) {
      const match = slowFinding.description.match(/(\d+)ms/);
      if (match) page.responseTimeMs = parseInt(match[1], 10);
    }

    return {
      migrationId,
      capturedAt: new Date().toISOString(),
      siteUrl,
      healthScore: scan.overallScore,
      pages: [page],
      performance: {
        averageResponseTimeMs: page.responseTimeMs,
        hasCompression,
        contentSizeBytes: 0,
        redirectCount: 0,
      },
      security: {
        headers: secHeaders,
        isHttps: scan.url.startsWith('https'),
      },
      seo: {
        hasTitle,
        titleText: '',
        hasMetaDescription,
        hasCanonical,
        hasStructuredData,
        hasOpenGraph,
        h1Count,
      },
      aemSignals: {
        aemDetected: scan.aemDetected,
        version: scan.aemVersion,
        deployment: scan.platformDetails.deployment,
        indicators: scan.platformDetails.indicators,
        confidence: scan.platformDetails.confidence ?? 0,
      },
    };
  }

  // ── Comparison Engine ──────────────────────────────────────

  private compareBaselines(
    baseline: DriftBaseline,
    current: DriftBaseline,
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Performance drift
    this.comparePerformance(baseline, current, changes);

    // Security drift
    this.compareSecurity(baseline, current, changes);

    // Content drift
    this.compareContent(baseline, current, changes);

    // Configuration drift (AEM signals)
    this.compareConfiguration(baseline, current, changes);

    // SEO drift
    this.compareSeo(baseline, current, changes);

    return changes;
  }

  private comparePerformance(
    baseline: DriftBaseline,
    current: DriftBaseline,
    changes: DriftChange[],
  ): void {
    const baseTime = baseline.performance.averageResponseTimeMs;
    const currTime = current.performance.averageResponseTimeMs;

    // Response time degradation > 20%
    if (baseTime > 0 && currTime > 0) {
      const pctChange = ((currTime - baseTime) / baseTime) * 100;
      if (pctChange > 20) {
        changes.push({
          category: 'performance',
          field: 'responseTime',
          baselineValue: `${baseTime}ms`,
          currentValue: `${currTime}ms`,
          severity: pctChange > 50 ? 'high' : 'medium',
          description: `Response time increased by ${Math.round(pctChange)}% (${baseTime}ms -> ${currTime}ms)`,
        });
      }
    }

    // Compression removed
    if (baseline.performance.hasCompression && !current.performance.hasCompression) {
      changes.push({
        category: 'performance',
        field: 'compression',
        baselineValue: 'enabled',
        currentValue: 'disabled',
        severity: 'high',
        description: 'Response compression (Gzip/Brotli) has been removed',
      });
    }

    // Health score degradation
    const scoreDiff = baseline.healthScore - current.healthScore;
    if (scoreDiff > 10) {
      changes.push({
        category: 'performance',
        field: 'healthScore',
        baselineValue: String(baseline.healthScore),
        currentValue: String(current.healthScore),
        severity: scoreDiff > 25 ? 'high' : 'medium',
        description: `Overall health score dropped by ${scoreDiff} points (${baseline.healthScore} -> ${current.healthScore})`,
      });
    }
  }

  private compareSecurity(
    baseline: DriftBaseline,
    current: DriftBaseline,
    changes: DriftChange[],
  ): void {
    // Security headers removed
    for (const header of baseline.security.headers) {
      if (!current.security.headers.includes(header)) {
        changes.push({
          category: 'security',
          field: `header:${header}`,
          baselineValue: 'present',
          currentValue: 'missing',
          severity: header === 'strict-transport-security' || header === 'content-security-policy'
            ? 'high'
            : 'medium',
          description: `Security header "${header}" was present at baseline but is now missing`,
        });
      }
    }

    // HTTPS downgrade
    if (baseline.security.isHttps && !current.security.isHttps) {
      changes.push({
        category: 'security',
        field: 'https',
        baselineValue: 'https',
        currentValue: 'http',
        severity: 'high',
        description: 'Site has downgraded from HTTPS to HTTP',
      });
    }
  }

  private compareContent(
    baseline: DriftBaseline,
    current: DriftBaseline,
    changes: DriftChange[],
  ): void {
    // Pages removed (check by URL)
    const currentUrls = new Set(current.pages.map((p) => p.url));
    for (const page of baseline.pages) {
      if (!currentUrls.has(page.url)) {
        changes.push({
          category: 'content',
          field: `page:${page.url}`,
          baselineValue: `status ${page.statusCode}`,
          currentValue: 'missing',
          severity: 'high',
          description: `Page "${page.url}" was in baseline but is no longer found`,
        });
      }
    }

    // Pages added
    const baselineUrls = new Set(baseline.pages.map((p) => p.url));
    for (const page of current.pages) {
      if (!baselineUrls.has(page.url)) {
        changes.push({
          category: 'content',
          field: `page:${page.url}`,
          baselineValue: 'not present',
          currentValue: `status ${page.statusCode}`,
          severity: 'low',
          description: `New page "${page.url}" detected that was not in baseline`,
        });
      }
    }

    // Page status code changes
    for (const basePage of baseline.pages) {
      const currPage = current.pages.find((p) => p.url === basePage.url);
      if (currPage && currPage.statusCode !== basePage.statusCode) {
        changes.push({
          category: 'content',
          field: `pageStatus:${basePage.url}`,
          baselineValue: String(basePage.statusCode),
          currentValue: String(currPage.statusCode),
          severity: currPage.statusCode >= 400 ? 'high' : 'medium',
          description: `Page "${basePage.url}" status changed from ${basePage.statusCode} to ${currPage.statusCode}`,
        });
      }
    }
  }

  private compareConfiguration(
    baseline: DriftBaseline,
    current: DriftBaseline,
    changes: DriftChange[],
  ): void {
    // AEM version changed (Adobe auto-update)
    if (
      baseline.aemSignals.version !== current.aemSignals.version &&
      baseline.aemSignals.version !== null &&
      current.aemSignals.version !== null
    ) {
      changes.push({
        category: 'configuration',
        field: 'aemVersion',
        baselineValue: baseline.aemSignals.version,
        currentValue: current.aemSignals.version,
        severity: 'medium',
        description: `AEM version changed from "${baseline.aemSignals.version}" to "${current.aemSignals.version}" (possible Adobe auto-update)`,
      });
    }

    // Deployment type changed
    if (baseline.aemSignals.deployment !== current.aemSignals.deployment) {
      changes.push({
        category: 'configuration',
        field: 'deploymentType',
        baselineValue: baseline.aemSignals.deployment,
        currentValue: current.aemSignals.deployment,
        severity: 'high',
        description: `Deployment type changed from "${baseline.aemSignals.deployment}" to "${current.aemSignals.deployment}"`,
      });
    }

    // AEM detection lost
    if (baseline.aemSignals.aemDetected && !current.aemSignals.aemDetected) {
      changes.push({
        category: 'configuration',
        field: 'aemDetected',
        baselineValue: 'true',
        currentValue: 'false',
        severity: 'high',
        description: 'AEM is no longer detected on this site — platform may have changed entirely',
      });
    }

    // Indicators removed (significant signals disappeared)
    const removedIndicators = baseline.aemSignals.indicators.filter(
      (i) => !current.aemSignals.indicators.includes(i),
    );
    if (removedIndicators.length >= 3) {
      changes.push({
        category: 'configuration',
        field: 'aemIndicators',
        baselineValue: `${baseline.aemSignals.indicators.length} indicators`,
        currentValue: `${current.aemSignals.indicators.length} indicators`,
        severity: 'medium',
        description: `${removedIndicators.length} AEM detection indicators disappeared since baseline`,
      });
    }
  }

  private compareSeo(
    baseline: DriftBaseline,
    current: DriftBaseline,
    changes: DriftChange[],
  ): void {
    // Canonical URL removed
    if (baseline.seo.hasCanonical && !current.seo.hasCanonical) {
      changes.push({
        category: 'seo',
        field: 'canonical',
        baselineValue: 'present',
        currentValue: 'missing',
        severity: 'high',
        description: 'Canonical URL tag was removed — risk of duplicate content issues',
      });
    }

    // Meta description removed
    if (baseline.seo.hasMetaDescription && !current.seo.hasMetaDescription) {
      changes.push({
        category: 'seo',
        field: 'metaDescription',
        baselineValue: 'present',
        currentValue: 'missing',
        severity: 'medium',
        description: 'Meta description tag was removed',
      });
    }

    // Title removed
    if (baseline.seo.hasTitle && !current.seo.hasTitle) {
      changes.push({
        category: 'seo',
        field: 'title',
        baselineValue: 'present',
        currentValue: 'missing',
        severity: 'high',
        description: 'Page title tag was removed',
      });
    }

    // Structured data removed
    if (baseline.seo.hasStructuredData && !current.seo.hasStructuredData) {
      changes.push({
        category: 'seo',
        field: 'structuredData',
        baselineValue: 'present',
        currentValue: 'missing',
        severity: 'medium',
        description: 'JSON-LD structured data was removed',
      });
    }

    // Open Graph removed
    if (baseline.seo.hasOpenGraph && !current.seo.hasOpenGraph) {
      changes.push({
        category: 'seo',
        field: 'openGraph',
        baselineValue: 'present',
        currentValue: 'missing',
        severity: 'low',
        description: 'Open Graph meta tags were removed — social sharing previews affected',
      });
    }

    // H1 count changed significantly
    if (
      baseline.seo.h1Count !== current.seo.h1Count &&
      (baseline.seo.h1Count === 0 || current.seo.h1Count === 0)
    ) {
      changes.push({
        category: 'seo',
        field: 'h1Count',
        baselineValue: String(baseline.seo.h1Count),
        currentValue: String(current.seo.h1Count),
        severity: current.seo.h1Count === 0 ? 'high' : 'low',
        description: `H1 heading count changed from ${baseline.seo.h1Count} to ${current.seo.h1Count}`,
      });
    }
  }

  // ── Scoring ────────────────────────────────────────────────

  private calculateDriftScore(changes: DriftChange[]): number {
    if (changes.length === 0) return 0;

    const severityWeights: Record<DriftChange['severity'], number> = {
      low: 3,
      medium: 8,
      high: 15,
    };

    const totalWeight = changes.reduce(
      (sum, c) => sum + severityWeights[c.severity],
      0,
    );

    // Cap at 100
    return Math.min(100, totalWeight);
  }

  private resolveAlertLevel(driftScore: number): AlertLevel {
    if (driftScore <= 10) return 'green';
    if (driftScore <= 30) return 'yellow';
    return 'red';
  }
}
