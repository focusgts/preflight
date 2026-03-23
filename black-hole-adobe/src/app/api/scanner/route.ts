/**
 * POST /api/scanner — Start a public site scan
 *
 * Accepts { url: string, industry?: string } and returns a ScanResult.
 * Rate limited to 10 scans per IP per hour.
 * In development: returns realistic mock results seeded by domain hash.
 */

import { success, error } from '@/lib/api/response';
import type { ScanResult, ScanFinding, CategoryScore, Grade } from '@/types/scanner';
import { ScoreCalculator } from '@/lib/scanner/score-calculator';

// ── In-memory rate limiter ────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// ── In-memory result cache ────────────────────────────────
const scanCache = new Map<string, { result: ScanResult; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '127.0.0.1';
}

// ── Deterministic hash for consistent mock scores ─────────
function hashDomain(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

function scoreToGrade(score: number): Grade {
  return ScoreCalculator.toGrade(score);
}

// ── Mock scan result generator ────────────────────────────
function generateMockResult(url: string, industry?: string): ScanResult {
  const domain = extractDomain(url);
  const seed = hashDomain(domain);
  const calculator = new ScoreCalculator();

  const isAdobeSite = /adobe|aem|experience/i.test(domain);
  const boost = isAdobeSite ? 20 : 0;

  const perfScore = Math.min(100, Math.round(seededRandom(seed, 1) * 40 + 35 + boost));
  const seoScore = Math.min(100, Math.round(seededRandom(seed, 2) * 35 + 40 + boost));
  const secScore = Math.min(100, Math.round(seededRandom(seed, 3) * 40 + 30 + boost));
  const a11yScore = Math.min(100, Math.round(seededRandom(seed, 4) * 30 + 45 + boost));
  const migScore = isAdobeSite
    ? Math.min(100, Math.round(seededRandom(seed, 5) * 25 + 60))
    : Math.round(seededRandom(seed, 5) * 35 + 30);

  const aemDetected = seededRandom(seed, 6) > 0.3 || isAdobeSite;
  const versions = ['6.4', '6.5', '6.5', '6.5', 'Cloud Service'];
  const aemVersion = aemDetected
    ? versions[Math.floor(seededRandom(seed, 7) * versions.length)]
    : null;

  function makeFinding(
    cat: string,
    sev: ScanFinding['severity'],
    title: string,
    desc: string,
    rec: string,
  ): ScanFinding {
    return { category: cat, severity: sev, title, description: desc, recommendation: rec };
  }

  const perfFindings: ScanFinding[] = [];
  if (perfScore < 70) {
    perfFindings.push(makeFinding('Performance', 'high', 'Slow server response', `TTFB estimated at ${Math.round(800 + seededRandom(seed, 10) * 2200)}ms.`, 'Enable CDN and dispatcher caching.'));
  }
  if (perfScore < 55) {
    perfFindings.push(makeFinding('Performance', 'critical', 'Large page size', `Page weight ~${Math.round(1500 + seededRandom(seed, 11) * 3000)}KB.`, 'Optimize images and lazy-load content.'));
  }
  perfFindings.push(makeFinding('Performance', 'medium', 'No compression detected', 'Response not compressed.', 'Enable Gzip or Brotli.'));

  const seoFindings: ScanFinding[] = [];
  if (seoScore < 65) {
    seoFindings.push(makeFinding('SEO', 'high', 'Missing meta description', 'No meta description tag found.', 'Add unique meta descriptions.'));
  }
  seoFindings.push(makeFinding('SEO', 'low', 'No structured data', 'No JSON-LD schema found.', 'Add Schema.org structured data.'));
  if (seoScore < 50) {
    seoFindings.push(makeFinding('SEO', 'critical', 'Missing page title', 'No <title> tag detected.', 'Add descriptive page titles.'));
  }

  const secFindings: ScanFinding[] = [];
  if (secScore < 60) {
    secFindings.push(makeFinding('Security', 'critical', 'Missing HSTS header', 'Strict-Transport-Security not set.', 'Add HSTS with max-age 31536000.'));
  }
  secFindings.push(makeFinding('Security', 'high', 'Missing CSP header', 'No Content-Security-Policy header.', 'Implement a CSP to prevent XSS.'));
  if (secScore < 45) {
    secFindings.push(makeFinding('Security', 'medium', 'Missing X-Frame-Options', 'No clickjacking protection.', 'Add X-Frame-Options: DENY.'));
  }

  const a11yFindings: ScanFinding[] = [];
  if (a11yScore < 70) {
    a11yFindings.push(makeFinding('Accessibility', 'high', 'Images missing alt text', `${Math.round(seededRandom(seed, 20) * 15 + 3)} images lack alt attributes.`, 'Add alt text to all images.'));
  }
  a11yFindings.push(makeFinding('Accessibility', 'medium', 'Heading hierarchy gaps', 'Heading levels skip from H2 to H4.', 'Use sequential heading levels.'));

  const migFindings: ScanFinding[] = [];
  if (aemDetected && aemVersion && !aemVersion.includes('Cloud')) {
    migFindings.push(makeFinding('Migration', 'high', `Legacy AEM ${aemVersion}`, `Running AEM ${aemVersion} requires migration to Cloud Service.`, 'Run BPA and start migration planning.'));
    migFindings.push(makeFinding('Migration', 'medium', 'On-premise deployment', 'On-prem deployments need full migration.', 'Consider AEM as a Cloud Service.'));
  }

  function buildCat(name: string, score: number, weight: number, findings: ScanFinding[]): CategoryScore {
    return { name, score, weight, grade: scoreToGrade(score), findings };
  }

  const categories: ScanResult['categories'] = {
    performance: buildCat('Performance', perfScore, 0.25, perfFindings),
    seo: buildCat('SEO', seoScore, 0.20, seoFindings),
    security: buildCat('Security', secScore, 0.20, secFindings),
    accessibility: buildCat('Accessibility', a11yScore, 0.10, a11yFindings),
    migration: buildCat('Migration Risk', migScore, 0.25, migFindings),
  };

  const overallScore = calculator.calculate(categories);
  const benchmark = calculator.getIndustryBenchmark(overallScore, industry);
  const urgency = calculator.getMigrationUrgency(aemVersion, overallScore);
  const allFindings = [
    ...perfFindings, ...seoFindings, ...secFindings, ...a11yFindings, ...migFindings,
  ].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });

  return {
    url,
    domain,
    overallScore,
    grade: scoreToGrade(overallScore),
    categories,
    aemDetected,
    aemVersion,
    platformDetails: {
      detected: aemDetected,
      platform: aemDetected ? 'Adobe Experience Manager' : 'Unknown',
      version: aemVersion,
      deployment: aemDetected
        ? (aemVersion?.includes('Cloud') ? 'cloud-service' : 'on-prem')
        : 'unknown',
      indicators: aemDetected
        ? ['Header: x-aem-host', 'AEM clientlibs path', 'AEM DAM path']
        : [],
    },
    recommendations: allFindings.slice(0, 10),
    industryBenchmark: benchmark,
    migrationUrgency: urgency,
    scannedAt: new Date().toISOString(),
  };
}

function extractDomain(url: string): string {
  try {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isValidUrl(url: string): boolean {
  try {
    let u = url.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const parsed = new URL(u);
    return !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

// ── POST Handler ──────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return error('RATE_LIMITED', 'Too many scans. Please try again later.', 429);
    }

    const body = await request.json();
    const { url, industry } = body as { url?: string; industry?: string };

    if (!url || typeof url !== 'string') {
      return error('INVALID_INPUT', 'URL is required.', 400);
    }

    if (!isValidUrl(url)) {
      return error('INVALID_URL', 'Please enter a valid domain or URL.', 400);
    }

    const domain = extractDomain(url);

    // Check cache
    const cached = scanCache.get(domain);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`[Scanner] Cache hit for ${domain}`);
      return success(cached.result);
    }

    // Generate mock result (replace with real SiteScanner in production)
    const result = generateMockResult(url, industry);

    // Cache result
    scanCache.set(domain, { result, cachedAt: Date.now() });

    console.log(`[Scanner] Scanned ${domain} — score: ${result.overallScore}`);
    return success(result);
  } catch (err) {
    console.error('[Scanner] Error:', err);
    return error('SCAN_FAILED', 'Failed to scan the site. Please try again.', 500);
  }
}
