/**
 * Mock Live Migration Data
 *
 * Generates progressively advancing metrics to simulate a live migration
 * in progress. Each call to getMockLiveMetrics advances the state slightly.
 */

// ── Types ──────────────────────────────────────────────────

export interface LiveMetrics {
  migrationId: string;
  organizationName: string;
  migrationType: string;
  overallProgress: number;
  pages: { processed: number; total: number };
  assets: { processed: number; total: number };
  codeChanges: { processed: number; total: number };
  tests: { processed: number; total: number };
  throughput: number; // items per minute
  etaSeconds: number;
  phases: LivePhase[];
  events: LiveEvent[];
}

export interface LivePhase {
  name: string;
  status: 'completed' | 'active' | 'pending';
  progress: number;
  itemsProcessed: number;
  itemsTotal: number;
  durationSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface LiveEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

// ── Phase Definitions ──────────────────────────────────────

const PHASE_DEFS = [
  { name: 'Assessment', items: 1, durationSec: 180 },
  { name: 'Planning', items: 1, durationSec: 120 },
  { name: 'Code Modernization', items: 347, durationSec: 600 },
  { name: 'Content Migration', items: 1700000, durationSec: 3600 },
  { name: 'Testing & Validation', items: 2100, durationSec: 900 },
  { name: 'Go Live', items: 12, durationSec: 300 },
] as const;

// ── Event Templates ────────────────────────────────────────

const PAGE_PATHS = [
  '/en/products/widget-pro', '/en/about/leadership', '/en/blog/2026-roadmap',
  '/en/support/faq', '/en/products/enterprise-suite', '/de/produkte/uebersicht',
  '/fr/solutions/cloud', '/en/case-studies/fortune-500', '/en/resources/whitepaper',
  '/en/partners/technology', '/en/events/summit-2026', '/en/industries/healthcare',
  '/en/products/analytics-dashboard', '/en/docs/api-reference', '/en/careers/engineering',
];

const ASSET_PATHS = [
  'dam/hero-banner-2026.jpg', 'dam/product-hero.png', 'dam/video/demo-walkthrough.mp4',
  'dam/icons/navigation-sprite.svg', 'dam/pdf/annual-report-2025.pdf',
  'dam/images/team-photo.jpg', 'dam/brand/logo-dark.svg', 'dam/renders/3d-product.glb',
  'dam/thumbnails/blog-cover.webp', 'dam/documents/onboarding-guide.pdf',
];

const OSGI_CONFIGS = [
  'com.day.cq.dam.core.impl.AssetMoveValidationProcess',
  'com.adobe.granite.auth.oauth.impl.OAuthProviderImpl',
  'org.apache.sling.commons.log.LogManager',
  'com.day.cq.wcm.core.impl.VersionManagerImpl',
  'com.adobe.cq.social.commons.impl.DatastoreImpl',
];

const ASSET_SIZES = ['1.2MB', '4.2MB', '856KB', '12.7MB', '340KB', '2.1MB', '8.4MB'];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEvent(callCount: number, phase: string): LiveEvent {
  const now = new Date();
  now.setMilliseconds(now.getMilliseconds() - Math.random() * 2000);

  const generators: (() => LiveEvent)[] = [
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'success',
      message: `Content page ${randomPick(PAGE_PATHS)} migrated successfully`,
    }),
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'success',
      message: `Asset ${randomPick(ASSET_PATHS)} (${randomPick(ASSET_SIZES)}) transferred`,
    }),
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'info',
      message: `OSGi config ${randomPick(OSGI_CONFIGS)} auto-converted`,
    }),
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'info',
      message: `Sling model reference updated: ${randomPick(PAGE_PATHS)}/jcr:content`,
    }),
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'warning',
      message: `Deprecated API usage detected in bundle com.acme.core — auto-remediated`,
    }),
    () => ({
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'success',
      message: `Test suite "content-integrity" passed (${42 + Math.floor(Math.random() * 20)} assertions)`,
    }),
  ];

  // Occasionally produce a warning or error
  if (Math.random() < 0.03) {
    return {
      id: `evt-${callCount}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toISOString(),
      type: 'error',
      message: `Failed to transfer asset ${randomPick(ASSET_PATHS)} — retrying (attempt 2/3)`,
    };
  }

  return randomPick(generators)();
}

// ── Stateful Simulation ────────────────────────────────────

/**
 * In-memory call counter — persists across requests in the same
 * server process (suitable for demo / dev mode).
 */
const globalKey = Symbol.for('blackhole.mock-live-call-count');
const globalObj = globalThis as unknown as Record<symbol, number>;

function getCallCount(): number {
  const current = globalObj[globalKey] ?? 0;
  globalObj[globalKey] = current + 1;
  return current + 1;
}

export function resetMockState(): void {
  globalObj[globalKey] = 0;
}

// ── Main Export ────────────────────────────────────────────

export function getMockLiveMetrics(migrationId: string = 'demo-migration-001'): LiveMetrics {
  const callCount = getCallCount();

  // Simulation parameters: ~200 calls to reach 100%
  const progressFraction = Math.min(callCount / 200, 1);
  const jitter = (Math.random() - 0.5) * 0.01;
  const progress = Math.min(Math.round((progressFraction + jitter) * 100), 100);

  // Content totals
  const totalPages = 1_200_000;
  const totalAssets = 500_000;
  const totalCodeChanges = 347;
  const totalTests = 2_100;
  const totalItems = totalPages + totalAssets;

  // Phase progress computation
  const phaseWeights = [0.02, 0.03, 0.1, 0.6, 0.15, 0.1];
  let accumulated = 0;
  const baseTime = new Date('2026-03-22T08:00:00Z');

  const phases: LivePhase[] = PHASE_DEFS.map((def, i) => {
    const phaseStart = accumulated;
    const phaseEnd = accumulated + phaseWeights[i];
    accumulated = phaseEnd;

    let status: 'completed' | 'active' | 'pending';
    let phaseProgress: number;
    let itemsProcessed: number;

    if (progressFraction >= phaseEnd) {
      status = 'completed';
      phaseProgress = 100;
      itemsProcessed = def.items;
    } else if (progressFraction >= phaseStart) {
      status = 'active';
      const within = (progressFraction - phaseStart) / phaseWeights[i];
      phaseProgress = Math.round(within * 100);
      itemsProcessed = Math.round(within * def.items);
    } else {
      status = 'pending';
      phaseProgress = 0;
      itemsProcessed = 0;
    }

    const startedAt = progressFraction >= phaseStart
      ? new Date(baseTime.getTime() + phaseStart * 7200000).toISOString()
      : null;
    const completedAt = progressFraction >= phaseEnd
      ? new Date(baseTime.getTime() + phaseEnd * 7200000).toISOString()
      : null;
    const durationSeconds = status === 'completed'
      ? def.durationSec
      : status === 'active'
        ? Math.round(((progressFraction - phaseStart) / phaseWeights[i]) * def.durationSec)
        : null;

    return {
      name: def.name,
      status,
      progress: phaseProgress,
      itemsProcessed,
      itemsTotal: def.items,
      durationSeconds,
      startedAt,
      completedAt,
    };
  });

  // Aggregate item counts
  const contentPhase = phases[3]; // Content Migration
  const codePhase = phases[2]; // Code Modernization
  const testPhase = phases[4]; // Testing

  const pagesProcessed = Math.round((contentPhase.progress / 100) * totalPages);
  const assetsProcessed = Math.round((contentPhase.progress / 100) * totalAssets);
  const codeChangesProcessed = codePhase.status === 'completed'
    ? totalCodeChanges
    : Math.round((codePhase.progress / 100) * totalCodeChanges);
  const testsPassing = testPhase.status === 'completed'
    ? totalTests
    : Math.round((testPhase.progress / 100) * totalTests);

  // Throughput simulation (items per minute)
  const baseThroughput = 847;
  const throughputVariation = Math.sin(callCount * 0.3) * 120 + (Math.random() - 0.5) * 80;
  const throughput = Math.max(200, Math.round(baseThroughput + throughputVariation));

  // ETA
  const remainingItems = totalItems - pagesProcessed - assetsProcessed;
  const etaSeconds = throughput > 0 ? Math.round((remainingItems / throughput) * 60) : 0;

  // Generate events (3-6 per call)
  const eventCount = 3 + Math.floor(Math.random() * 4);
  const activePhase = phases.find((p) => p.status === 'active')?.name ?? 'Content Migration';
  const events: LiveEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    events.push(generateEvent(callCount, activePhase));
  }

  return {
    migrationId,
    organizationName: 'ACME Corporation',
    migrationType: 'AEM 6.5 On-Prem to Cloud Service',
    overallProgress: progress,
    pages: { processed: pagesProcessed, total: totalPages },
    assets: { processed: assetsProcessed, total: totalAssets },
    codeChanges: { processed: codeChangesProcessed, total: totalCodeChanges },
    tests: { processed: testsPassing, total: totalTests },
    throughput,
    etaSeconds,
    phases,
    events,
  };
}
