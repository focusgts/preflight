/**
 * Dispatcher Security Scanner — ADR-037
 *
 * Probes AEM sites for common Dispatcher security misconfigurations
 * using HEAD requests against known sensitive paths, and checks for
 * missing security headers.
 *
 * Methodology mirrors standard AEM security assessments (WithSecure,
 * Burp AEM Scanner, SecureAEM). Only HEAD requests are used to
 * minimise server impact. Probes run sequentially to avoid flooding.
 */

// ============================================================
// Types
// ============================================================

export interface DispatcherSecurityResult {
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'secure';
  score: number; // 0-100 (100 = fully secure)
  findings: SecurityFinding[];
  headers: HeaderCheck[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: number;
  };
}

export interface SecurityFinding {
  path: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: number;
  title: string;
  description: string;
  recommendation: string;
  owaspCategory?: string;
}

export interface HeaderCheck {
  header: string;
  present: boolean;
  value: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  recommendation: string;
}

// ============================================================
// Constants
// ============================================================

const PROBE_TIMEOUT_MS = 3000;
const USER_AGENT = 'BlackHole-Security-Scanner/1.0';

// ── Critical Paths (200 = CRITICAL) ─────────────────────────

const CRITICAL_PATHS: Array<{
  path: string;
  title: string;
  description: string;
  recommendation: string;
}> = [
  {
    path: '/crx/de/index.jsp',
    title: 'CRXDE Lite exposed',
    description:
      'CRXDE Lite is publicly accessible, granting full JCR repository browsing and editing. An attacker can read all content, modify templates, and deploy code.',
    recommendation:
      'Block /crx/* in Dispatcher filters. This path must never be accessible on publish instances.',
  },
  {
    path: '/system/console',
    title: 'Apache Felix Console exposed',
    description:
      'The OSGi web console is publicly accessible, allowing bundle installation, configuration changes, and full server control.',
    recommendation:
      'Block /system/console* in Dispatcher filters. Restrict access to author only via VPN.',
  },
  {
    path: '/system/console/bundles',
    title: 'OSGi Bundle Admin exposed',
    description:
      'The bundle administration page is publicly accessible, allowing an attacker to install, start, and stop OSGi bundles.',
    recommendation:
      'Block /system/console* in Dispatcher filters.',
  },
  {
    path: '/bin/querybuilder.json',
    title: 'QueryBuilder API exposed',
    description:
      'The QueryBuilder JSON endpoint is publicly accessible. An attacker can execute arbitrary JCR queries to exfiltrate content, user data, and internal paths.',
    recommendation:
      'Block /bin/* in Dispatcher filters. If QueryBuilder is needed for frontend, restrict via allowed query parameters.',
  },
  {
    path: '/etc/mobile/useragent-test.html',
    title: 'AEM fingerprint page exposed',
    description:
      'The user-agent test page confirms AEM is in use and reveals server information, aiding reconnaissance.',
    recommendation:
      'Block /etc/* (except /etc/clientlibs and /etc.clientlibs) in Dispatcher filters.',
  },
  {
    path: '/libs/granite/security/content/useradmin.html',
    title: 'User Admin console exposed',
    description:
      'The Granite User Administration page is publicly accessible, potentially allowing user enumeration or account management.',
    recommendation:
      'Block /libs/granite/security/* in Dispatcher filters.',
  },
  {
    path: '/libs/cq/search/content/querydebug.html',
    title: 'Query Debugger exposed',
    description:
      'The CQ Query Debugger is publicly accessible, allowing arbitrary query execution against the JCR repository.',
    recommendation:
      'Block /libs/cq/* in Dispatcher filters.',
  },
];

// ── Content Grabbing Paths (200 = HIGH) ─────────────────────

const CONTENT_GRAB_PATHS: Array<{
  path: string;
  title: string;
  description: string;
  recommendation: string;
}> = [
  {
    path: '/.json',
    title: 'Root JSON export accessible',
    description:
      'The root node is exported as JSON, exposing the entire content tree structure including internal paths.',
    recommendation:
      'Block requests with JSON selectors at the Dispatcher level. Deny .json extension for content paths.',
  },
  {
    path: '/content.infinity.json',
    title: 'Infinite-depth JSON export accessible',
    description:
      'The infinity selector exports the entire content tree as JSON with unlimited depth, enabling mass data exfiltration.',
    recommendation:
      'Block .infinity. selector in Dispatcher filters. Limit JSON depth selectors to specific allowed paths.',
  },
  {
    path: '/content.tidy.-1.json',
    title: 'Tidy JSON export accessible',
    description:
      'The tidy selector with depth -1 exports the entire content tree as formatted JSON.',
    recommendation:
      'Block .tidy. selector and negative depth values in Dispatcher filters.',
  },
  {
    path: '/content.childrenlist.json',
    title: 'Children list export accessible',
    description:
      'The childrenlist selector exposes child node listings, aiding content tree enumeration.',
    recommendation:
      'Block .childrenlist. selector in Dispatcher filters.',
  },
  {
    path: '/content.1.json',
    title: 'Depth-limited JSON export accessible',
    description:
      'Content is accessible via numeric depth selectors, allowing controlled content tree enumeration.',
    recommendation:
      'Block numeric depth selectors (.1.json, .2.json, etc.) in Dispatcher filters.',
  },
  {
    path: '/content.model.json',
    title: 'Sling Model JSON export accessible',
    description:
      'Sling Model exporter JSON is publicly accessible, exposing structured content and potentially internal data models.',
    recommendation:
      'Block .model.json selector in Dispatcher filters unless explicitly needed for headless delivery.',
  },
  {
    path: '/content.feed.xml',
    title: 'Feed XML export accessible',
    description:
      'The feed selector exposes content as XML feeds, enabling content scraping.',
    recommendation:
      'Block .feed. selector in Dispatcher filters unless RSS feeds are intentional.',
  },
];

// ── Security Header Checks ──────────────────────────────────

const HEADER_CHECKS: Array<{
  header: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  recommendation: string;
}> = [
  {
    header: 'x-content-type-options',
    severity: 'medium',
    title: 'Missing X-Content-Type-Options header',
    recommendation:
      'Add "X-Content-Type-Options: nosniff" to prevent MIME-type sniffing attacks.',
  },
  {
    header: 'x-frame-options',
    severity: 'medium',
    title: 'Missing X-Frame-Options header',
    recommendation:
      'Add "X-Frame-Options: DENY" or "SAMEORIGIN" to prevent clickjacking attacks.',
  },
  {
    header: 'content-security-policy',
    severity: 'medium',
    title: 'Missing Content-Security-Policy header',
    recommendation:
      'Implement a Content-Security-Policy header to mitigate XSS and injection attacks.',
  },
  {
    header: 'strict-transport-security',
    severity: 'low',
    title: 'Missing Strict-Transport-Security header',
    recommendation:
      'Add "Strict-Transport-Security: max-age=31536000; includeSubDomains" to enforce HTTPS.',
  },
  {
    header: 'referrer-policy',
    severity: 'low',
    title: 'Missing Referrer-Policy header',
    recommendation:
      'Add "Referrer-Policy: strict-origin-when-cross-origin" to control referrer information.',
  },
  {
    header: 'permissions-policy',
    severity: 'low',
    title: 'Missing Permissions-Policy header',
    recommendation:
      'Add a Permissions-Policy header to restrict browser feature access (camera, microphone, geolocation, etc.).',
  },
];

// ============================================================
// Scanner Implementation
// ============================================================

/**
 * Send a HEAD request to a single path and return the HTTP status code.
 * Returns null on timeout or network error.
 */
async function probeHead(
  baseUrl: string,
  path: string,
): Promise<{ status: number | null; headers: Record<string, string> }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const url = new URL(path, baseUrl).toString();
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });

    clearTimeout(timer);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return { status: response.status, headers };
  } catch {
    return { status: null, headers: {} };
  }
}

/**
 * Run dispatcher security assessment against a public URL.
 *
 * Probes run sequentially (not in parallel) to avoid hammering the
 * target server. Each probe uses a HEAD request with a 3-second timeout.
 */
export async function scanDispatcherSecurity(
  url: string,
): Promise<DispatcherSecurityResult> {
  const findings: SecurityFinding[] = [];
  const headerChecks: HeaderCheck[] = [];
  let passed = 0;

  // ── Phase 1: Critical path probes (sequential) ────────────

  for (const probe of CRITICAL_PATHS) {
    const { status } = await probeHead(url, probe.path);

    if (status === 200) {
      findings.push({
        path: probe.path,
        severity: 'critical',
        status,
        title: probe.title,
        description: probe.description,
        recommendation: probe.recommendation,
        owaspCategory: 'A01:2021 Broken Access Control',
      });
    } else if (status === 403 || status === 404) {
      // Correctly blocked or not present
      passed++;
    }
    // null (timeout) or other codes = inconclusive, skip
  }

  // ── Phase 2: Content grabbing path probes (sequential) ────

  for (const probe of CONTENT_GRAB_PATHS) {
    const { status } = await probeHead(url, probe.path);

    if (status === 200) {
      findings.push({
        path: probe.path,
        severity: 'high',
        status,
        title: probe.title,
        description: probe.description,
        recommendation: probe.recommendation,
        owaspCategory: 'A01:2021 Broken Access Control',
      });
    } else if (status === 403 || status === 404) {
      passed++;
    }
  }

  // ── Phase 3: Security header checks ───────────────────────
  // Fetch headers from the root page (single request)

  const { headers: rootHeaders } = await probeHead(url, '/');

  for (const check of HEADER_CHECKS) {
    const value = rootHeaders[check.header] ?? null;
    const present = value !== null;

    headerChecks.push({
      header: check.header,
      present,
      value,
      severity: check.severity,
      title: check.title,
      recommendation: check.recommendation,
    });

    if (present) {
      passed++;
    } else {
      findings.push({
        path: '/',
        severity: check.severity,
        status: 0, // Not a path probe — header check
        title: check.title,
        description: `The ${check.header} response header is not set.`,
        recommendation: check.recommendation,
        owaspCategory: 'A05:2021 Security Misconfiguration',
      });
    }
  }

  // ── Summarise ─────────────────────────────────────────────

  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    passed,
  };

  const score = calculateSecurityScore(summary);
  const overallRisk = determineOverallRisk(summary);

  return {
    overallRisk,
    score,
    findings,
    headers: headerChecks,
    summary,
  };
}

// ============================================================
// Scoring Helpers
// ============================================================

/**
 * Calculate a 0-100 security score.
 * Starts at 100 and deducts for each finding by severity.
 */
function calculateSecurityScore(summary: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}): number {
  const penalties =
    summary.critical * 25 +
    summary.high * 15 +
    summary.medium * 5 +
    summary.low * 2;

  return Math.max(0, Math.min(100, 100 - penalties));
}

/**
 * Determine overall risk level from finding counts.
 */
function determineOverallRisk(summary: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}): DispatcherSecurityResult['overallRisk'] {
  if (summary.critical > 0) return 'critical';
  if (summary.high > 0) return 'high';
  if (summary.medium > 0) return 'medium';
  if (summary.low > 0) return 'low';
  return 'secure';
}
