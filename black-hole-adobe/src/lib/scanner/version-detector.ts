/**
 * Version Inference Engine — Tier 4 Detection
 *
 * Correlates multiple detection signals to infer AEM version range
 * and deployment classification. Never claims exact minor versions.
 */

// ============================================================
// Types
// ============================================================

export interface DetectedSignal {
  name: string;
  category: 'dns' | 'header' | 'html' | 'probe' | 'cookie' | 'cdn';
  value: string;
  weight: number;
}

export interface VersionResult {
  version: string | null;
  confidence: number;
  signals: string[];
}

export type DeploymentType =
  | 'cloud-service'
  | 'managed-services'
  | 'on-prem'
  | 'edge-delivery'
  | 'unknown';

export interface DeploymentResult {
  type: DeploymentType;
  confidence: number;
  signals: string[];
}

// ============================================================
// Signal Helpers
// ============================================================

function hasSignal(signals: DetectedSignal[], name: string): boolean {
  return signals.some((s) => s.name === name);
}

function hasSignalCategory(
  signals: DetectedSignal[],
  category: DetectedSignal['category'],
): boolean {
  return signals.some((s) => s.category === category);
}

function signalNames(signals: DetectedSignal[]): string[] {
  return signals.map((s) => s.name);
}

// ============================================================
// Version Inference
// ============================================================

/**
 * Infer AEM version range from a collection of detected signals.
 * Returns version as a range string with confidence percentage.
 */
export function inferVersion(signals: DetectedSignal[]): VersionResult {
  const names = new Set(signals.map((s) => s.name));

  // Cloud Service CNAME + no JSP → Cloud Service (99%)
  if (names.has('aem-cloud-cname')) {
    const hasJSP = names.has('jsp-references');
    return {
      version: 'Cloud Service',
      confidence: hasJSP ? 85 : 99,
      signals: filterRelevant(signals, ['aem-cloud-cname', 'jsp-references']),
    };
  }

  // Edge Delivery scripts (aem.js / lib-franklin.js) → EDS (99%)
  if (names.has('edge-delivery-cname') || names.has('edge-delivery-scripts')) {
    return {
      version: 'Edge Delivery Services',
      confidence: 99,
      signals: filterRelevant(signals, [
        'edge-delivery-cname',
        'edge-delivery-scripts',
      ]),
    };
  }

  // Check for /etc.clientlibs/ presence (6.3+)
  const hasClientlibs = names.has('clientlibs-path');
  const hasCoreComponents = names.has('core-components');
  const hasJQuery3 = names.has('jquery-3.x');
  const hasJQuery1 = names.has('jquery-1.x');
  const hasJSP = names.has('jsp-references');

  // /etc.clientlibs/ + cmp-* + jQuery 3.x → AEM 6.5 SP6+ (75%)
  if (hasClientlibs && hasCoreComponents && hasJQuery3) {
    return {
      version: '6.5',
      confidence: 75,
      signals: filterRelevant(signals, [
        'clientlibs-path',
        'core-components',
        'jquery-3.x',
      ]),
    };
  }

  // /etc.clientlibs/ + cmp-* + jQuery 1.x → AEM 6.3-6.5 (65%)
  if (hasClientlibs && hasCoreComponents && hasJQuery1) {
    return {
      version: '6.3-6.5',
      confidence: 65,
      signals: filterRelevant(signals, [
        'clientlibs-path',
        'core-components',
        'jquery-1.x',
      ]),
    };
  }

  // /etc.clientlibs/ + no cmp-* → AEM 6.3-6.4 (55%)
  if (hasClientlibs && !hasCoreComponents) {
    return {
      version: '6.3-6.4',
      confidence: 55,
      signals: filterRelevant(signals, ['clientlibs-path']),
    };
  }

  // JSP references → AEM 6.x, not Cloud (80%)
  if (hasJSP) {
    return {
      version: '6.x',
      confidence: 80,
      signals: filterRelevant(signals, ['jsp-references']),
    };
  }

  // No /etc.clientlibs/ but other AEM signals → AEM 6.0-6.2 (45%)
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight >= 15 && !hasClientlibs) {
    return {
      version: '6.0-6.2',
      confidence: 45,
      signals: signalNames(signals).slice(0, 5),
    };
  }

  // /etc.clientlibs/ + cmp-* but no jQuery version info → 6.5 (60%)
  if (hasClientlibs && hasCoreComponents) {
    return {
      version: '6.5',
      confidence: 60,
      signals: filterRelevant(signals, [
        'clientlibs-path',
        'core-components',
      ]),
    };
  }

  // Has clientlibs but nothing else distinctive → 6.x
  if (hasClientlibs) {
    return {
      version: '6.x',
      confidence: 50,
      signals: filterRelevant(signals, ['clientlibs-path']),
    };
  }

  // Some AEM signals but can't narrow version
  if (totalWeight > 0) {
    return {
      version: '6.x',
      confidence: 40,
      signals: signalNames(signals).slice(0, 5),
    };
  }

  return {
    version: null,
    confidence: 0,
    signals: [],
  };
}

// ============================================================
// Deployment Classification
// ============================================================

/**
 * Classify the deployment type from all detected signals.
 * Returns deployment type with confidence.
 */
export function classifyDeployment(signals: DetectedSignal[]): DeploymentResult {
  const names = new Set(signals.map((s) => s.name));

  // Edge Delivery: CNAME or scripts
  if (names.has('edge-delivery-cname') || names.has('edge-delivery-scripts')) {
    return {
      type: 'edge-delivery',
      confidence: 99,
      signals: filterRelevant(signals, [
        'edge-delivery-cname',
        'edge-delivery-scripts',
      ]),
    };
  }

  // Cloud Service: CNAME definitive
  if (names.has('aem-cloud-cname')) {
    return {
      type: 'cloud-service',
      confidence: 99,
      signals: filterRelevant(signals, ['aem-cloud-cname']),
    };
  }

  // Cloud Service: Fastly headers + no JSP
  if (names.has('fastly-cdn') && !names.has('jsp-references')) {
    return {
      type: 'cloud-service',
      confidence: 75,
      signals: filterRelevant(signals, ['fastly-cdn']),
    };
  }

  // Managed Services: AEM + AWS/CloudFront
  if (names.has('cloudfront-cdn')) {
    const hasAEM = signals.reduce((sum, s) => sum + s.weight, 0) >= 15;
    if (hasAEM) {
      return {
        type: 'managed-services',
        confidence: 70,
        signals: filterRelevant(signals, ['cloudfront-cdn']),
      };
    }
  }

  // Managed Services: x-aem-host containing "ams"
  if (names.has('aem-host-ams')) {
    return {
      type: 'managed-services',
      confidence: 85,
      signals: filterRelevant(signals, ['aem-host-ams']),
    };
  }

  // On-Premise: AEM + Dispatcher + no cloud CDN
  const hasDispatcher =
    names.has('dispatcher-header') || names.has('x-vhost-header');
  const hasCloudCDN =
    names.has('fastly-cdn') ||
    names.has('cloudfront-cdn') ||
    names.has('akamai-cdn');
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const hasAEM = totalWeight >= 15;

  if (hasAEM && hasDispatcher && !hasCloudCDN) {
    return {
      type: 'on-prem',
      confidence: 75,
      signals: filterRelevant(signals, [
        'dispatcher-header',
        'x-vhost-header',
      ]),
    };
  }

  // On-Premise: AEM detected + no cloud indicators at all
  if (hasAEM && !hasCloudCDN) {
    return {
      type: 'on-prem',
      confidence: 65,
      signals: ['No cloud CDN detected'],
    };
  }

  // Unknown: insufficient confidence
  return {
    type: 'unknown',
    confidence: 0,
    signals: ['Insufficient signals for deployment classification'],
  };
}

// ============================================================
// Helpers
// ============================================================

function filterRelevant(
  signals: DetectedSignal[],
  names: string[],
): string[] {
  const nameSet = new Set(names);
  const found = signals
    .filter((s) => nameSet.has(s.name))
    .map((s) => s.name);
  // Also include names that weren't in signals (for negative indicators)
  const missing = names.filter((n) => !found.includes(n));
  return [...found, ...missing.map((n) => `(not found: ${n})`)];
}
