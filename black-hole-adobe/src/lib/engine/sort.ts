/**
 * Black Hole - Sort / Classification Engine
 *
 * AI-powered classification that tags migration items with Adobe product
 * targets, SEA categories, compatibility levels, effort estimates, and
 * risk scores.
 */

import { v4 as uuid } from 'uuid';
import {
  AdobeProduct,
  SEACategory,
  CompatibilityLevel,
  Severity,
} from '@/types';
import type { MigrationItem } from '@/types';

// ============================================================
// Types
// ============================================================

export interface ClassificationResult {
  itemId: string;
  adobeProducts: AdobeProduct[];
  seaCategory: SEACategory;
  compatibilityLevel: CompatibilityLevel;
  effortHours: number;
  riskScore: number; // 0-1
  confidence: number; // 0-1
  tags: string[];
  reasoning: string;
}

export interface DuplicateGroup {
  canonicalId: string;
  duplicateIds: string[];
  similarity: number; // 0-1
}

export interface SortOptions {
  enableDuplicateDetection: boolean;
  duplicateThreshold: number; // 0-1 similarity
  onItemClassified?: (result: ClassificationResult) => void;
}

// ============================================================
// Keyword Maps
// ============================================================

const PRODUCT_KEYWORDS: Record<AdobeProduct, string[]> = {
  [AdobeProduct.AEM_SITES]: [
    'page', 'template', 'component', 'site', 'wcm', 'cq:page', 'sling',
    'htl', 'sightly', 'editable-template', 'experience-fragment',
    'content-fragment', 'dispatcher', 'publish', 'author',
  ],
  [AdobeProduct.AEM_ASSETS]: [
    'dam', 'asset', 'rendition', 'metadata', 'smart-crop', 'dynamic-media',
    'image-profile', 'video', 'brand-portal',
  ],
  [AdobeProduct.AEM_FORMS]: [
    'form', 'adaptive-form', 'xdp', 'pdf-form', 'document-service',
    'form-data-model', 'submit-action',
  ],
  [AdobeProduct.AEM_SCREENS]: [
    'screens', 'channel', 'display', 'schedule', 'digital-signage',
  ],
  [AdobeProduct.AEM_EDS]: [
    'edge-delivery', 'eds', 'franklin', 'helix', 'document-based',
    'google-doc', 'sharepoint',
  ],
  [AdobeProduct.AEM_CLOUD_MANAGER]: [
    'cloud-manager', 'pipeline', 'ci-cd', 'deployment', 'environment',
    'repository',
  ],
  [AdobeProduct.ANALYTICS]: [
    'analytics', 'evar', 'prop', 'report-suite', 'segment', 'calculated-metric',
    'data-feed', 'classification', 'processing-rule', 'launch',
  ],
  [AdobeProduct.CJA]: [
    'cja', 'customer-journey', 'data-view', 'connection', 'workspace',
  ],
  [AdobeProduct.TARGET]: [
    'target', 'ab-test', 'experience-targeting', 'multivariate',
    'offer', 'audience', 'activity', 'personalization',
  ],
  [AdobeProduct.CAMPAIGN]: [
    'campaign', 'delivery', 'workflow', 'email-template', 'recipient',
    'broadcast', 'transactional', 'message-center',
  ],
  [AdobeProduct.AJO]: [
    'journey', 'journey-optimizer', 'ajo', 'orchestration', 'push-notification',
  ],
  [AdobeProduct.AEP]: [
    'experience-platform', 'aep', 'xdm', 'schema', 'dataset', 'source-connector',
    'destination', 'identity', 'merge-policy',
  ],
  [AdobeProduct.RTCDP]: [
    'rtcdp', 'real-time-cdp', 'profile', 'segment-builder', 'activation',
  ],
  [AdobeProduct.AAM]: [
    'audience-manager', 'aam', 'trait', 'segment', 'dmp',
  ],
  [AdobeProduct.COMMERCE]: [
    'commerce', 'magento', 'catalog', 'product', 'cart', 'checkout',
    'storefront', 'cif',
  ],
  [AdobeProduct.MARKETO]: [
    'marketo', 'munchkin', 'smart-campaign', 'smart-list', 'engagement-program',
    'lead', 'scoring',
  ],
  [AdobeProduct.WORKFRONT]: [
    'workfront', 'project', 'task', 'proof', 'approval', 'portfolio',
    'request-queue',
  ],
  [AdobeProduct.GENSTUDIO]: [
    'genstudio', 'generative', 'gen-ai', 'content-generation',
  ],
  [AdobeProduct.MIX_MODELER]: [
    'mix-modeler', 'media-mix', 'attribution', 'marketing-mix',
  ],
};

/** Patterns that indicate compatibility issues. */
const BLOCKER_PATTERNS = [
  'javax.jcr', 'org.apache.jackrabbit', 'crx2oak', 'replication-agent',
  'static-template', 'classic-ui', 'cq:widgets', 'ExtJS',
];

const AUTO_FIX_PATTERNS = [
  'sling:resourceType', 'cq:editConfig', 'granite:',
  'cq:template', 'cq:allowedTemplates',
];

const MANUAL_FIX_PATTERNS = [
  'custom-workflow', 'custom-servlet', 'osgi-config',
  'oak-index', 'custom-login',
];

// ============================================================
// Engine
// ============================================================

const DEFAULT_SORT_OPTIONS: SortOptions = {
  enableDuplicateDetection: true,
  duplicateThreshold: 0.85,
};

export class SortEngine {
  private readonly options: SortOptions;

  constructor(options: Partial<SortOptions> = {}) {
    this.options = { ...DEFAULT_SORT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Classify a single migration item: detect Adobe products, SEA category,
   * compatibility level, effort, and risk.
   */
  classifyItem(item: MigrationItem): ClassificationResult {
    const products = this.detectProducts(item);
    const compatibility = this.assessCompatibility(item);
    const sea = this.classifySEA(item, compatibility);
    const effort = this.estimateEffort(item, compatibility);
    const risk = this.scoreRisk(item, compatibility, effort);
    const tags = this.buildTags(item, products, sea);
    const confidence = this.calculateConfidence(products, item);

    const result: ClassificationResult = {
      itemId: item.id,
      adobeProducts: products,
      seaCategory: sea,
      compatibilityLevel: compatibility,
      effortHours: effort,
      riskScore: risk,
      confidence,
      tags,
      reasoning: this.buildReasoning(item, products, compatibility, sea),
    };

    this.options.onItemClassified?.(result);
    return result;
  }

  /**
   * Classify a batch of items.
   */
  async classifyBatch(items: MigrationItem[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const item of items) {
      results.push(this.classifyItem(item));
    }
    return results;
  }

  /**
   * Calculate a readiness score (0-100) for a set of classified items.
   */
  scoreReadiness(classifications: ClassificationResult[]): number {
    if (classifications.length === 0) return 0;

    let totalScore = 0;
    for (const c of classifications) {
      let itemScore = 100;

      // Compatibility penalty
      switch (c.compatibilityLevel) {
        case CompatibilityLevel.COMPATIBLE:
          break;
        case CompatibilityLevel.AUTO_FIXABLE:
          itemScore -= 10;
          break;
        case CompatibilityLevel.MANUAL_FIX:
          itemScore -= 35;
          break;
        case CompatibilityLevel.BLOCKER:
          itemScore -= 70;
          break;
      }

      // Risk penalty
      itemScore -= c.riskScore * 20;

      // Low confidence penalty
      if (c.confidence < 0.5) itemScore -= 10;

      totalScore += Math.max(0, Math.min(100, itemScore));
    }

    return Math.round(totalScore / classifications.length);
  }

  /**
   * Detect duplicate items based on normalized path similarity.
   */
  detectDuplicates(items: MigrationItem[]): DuplicateGroup[] {
    if (!this.options.enableDuplicateDetection) return [];

    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      if (processed.has(items[i].id)) continue;

      const duplicateIds: string[] = [];
      const normA = this.normalizePath(items[i].sourcePath);

      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(items[j].id)) continue;

        const normB = this.normalizePath(items[j].sourcePath);
        const sim = this.similarity(normA, normB);

        if (sim >= this.options.duplicateThreshold) {
          duplicateIds.push(items[j].id);
          processed.add(items[j].id);
        }
      }

      if (duplicateIds.length > 0) {
        processed.add(items[i].id);
        groups.push({
          canonicalId: items[i].id,
          duplicateIds,
          similarity: 1,
        });
      }
    }

    return groups;
  }

  // ----------------------------------------------------------
  // Internal classification logic
  // ----------------------------------------------------------

  private detectProducts(item: MigrationItem): AdobeProduct[] {
    const searchText = `${item.type} ${item.name} ${item.sourcePath}`.toLowerCase();
    const matched = new Set<AdobeProduct>();

    for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
      for (const kw of keywords) {
        if (searchText.includes(kw.toLowerCase())) {
          matched.add(product as AdobeProduct);
          break;
        }
      }
    }

    // Fallback: infer from file extension
    if (matched.size === 0) {
      const ext = item.sourcePath.split('.').pop()?.toLowerCase() ?? '';
      if (['html', 'htm', 'jsp', 'htl'].includes(ext)) {
        matched.add(AdobeProduct.AEM_SITES);
      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'pdf'].includes(ext)) {
        matched.add(AdobeProduct.AEM_ASSETS);
      }
    }

    return Array.from(matched);
  }

  private assessCompatibility(item: MigrationItem): CompatibilityLevel {
    const searchText = `${item.type} ${item.name} ${item.sourcePath}`.toLowerCase();

    for (const pattern of BLOCKER_PATTERNS) {
      if (searchText.includes(pattern.toLowerCase())) {
        return CompatibilityLevel.BLOCKER;
      }
    }
    for (const pattern of MANUAL_FIX_PATTERNS) {
      if (searchText.includes(pattern.toLowerCase())) {
        return CompatibilityLevel.MANUAL_FIX;
      }
    }
    for (const pattern of AUTO_FIX_PATTERNS) {
      if (searchText.includes(pattern.toLowerCase())) {
        return CompatibilityLevel.AUTO_FIXABLE;
      }
    }

    return CompatibilityLevel.COMPATIBLE;
  }

  private classifySEA(
    item: MigrationItem,
    compatibility: CompatibilityLevel,
  ): SEACategory {
    // SUPPORT: items that migrate with minimal effort (compatible / auto-fix)
    if (
      compatibility === CompatibilityLevel.COMPATIBLE ||
      compatibility === CompatibilityLevel.AUTO_FIXABLE
    ) {
      return SEACategory.SUPPORT;
    }

    // ADVISE: blockers need human advisory
    if (compatibility === CompatibilityLevel.BLOCKER) {
      return SEACategory.ADVISE;
    }

    // ENHANCE: manual-fix items benefit from guided enhancement
    return SEACategory.ENHANCE;
  }

  private estimateEffort(
    item: MigrationItem,
    compatibility: CompatibilityLevel,
  ): number {
    const baseEffort: Record<string, number> = {
      page: 0.5,
      component: 2,
      code: 4,
      config: 1,
      style: 1,
      asset: 0.1,
      content: 0.25,
    };

    let hours = baseEffort[item.type] ?? 1;

    // Multiply by compatibility factor
    const compatFactor: Record<CompatibilityLevel, number> = {
      [CompatibilityLevel.COMPATIBLE]: 0.25,
      [CompatibilityLevel.AUTO_FIXABLE]: 0.5,
      [CompatibilityLevel.MANUAL_FIX]: 2,
      [CompatibilityLevel.BLOCKER]: 8,
    };

    hours *= compatFactor[compatibility];

    // Path depth adds complexity
    const depth = item.sourcePath.split('/').filter(Boolean).length;
    if (depth > 5) hours *= 1.2;

    return Math.round(hours * 10) / 10;
  }

  private scoreRisk(
    item: MigrationItem,
    compatibility: CompatibilityLevel,
    effort: number,
  ): number {
    let risk = 0;

    // Compatibility risk
    const compatRisk: Record<CompatibilityLevel, number> = {
      [CompatibilityLevel.COMPATIBLE]: 0,
      [CompatibilityLevel.AUTO_FIXABLE]: 0.15,
      [CompatibilityLevel.MANUAL_FIX]: 0.45,
      [CompatibilityLevel.BLOCKER]: 0.85,
    };
    risk += compatRisk[compatibility];

    // Effort risk: high effort items are riskier
    if (effort > 8) risk += 0.1;
    if (effort > 16) risk += 0.1;

    // Code items are inherently riskier
    if (item.type === 'code' || item.type === 'component') {
      risk += 0.05;
    }

    return Math.min(1, Math.round(risk * 100) / 100);
  }

  private calculateConfidence(
    products: AdobeProduct[],
    item: MigrationItem,
  ): number {
    let confidence = 0.7; // base

    if (products.length > 0) confidence += 0.15;
    if (item.type && item.type !== 'content') confidence += 0.1;
    if (item.sourcePath.includes('/')) confidence += 0.05;

    return Math.min(1, Math.round(confidence * 100) / 100);
  }

  private buildTags(
    item: MigrationItem,
    products: AdobeProduct[],
    sea: SEACategory,
  ): string[] {
    const tags: string[] = [
      `type:${item.type}`,
      `sea:${sea}`,
      ...products.map((p) => `product:${p}`),
    ];

    const ext = item.sourcePath.split('.').pop()?.toLowerCase();
    if (ext) tags.push(`ext:${ext}`);

    return tags;
  }

  private buildReasoning(
    item: MigrationItem,
    products: AdobeProduct[],
    compatibility: CompatibilityLevel,
    sea: SEACategory,
  ): string {
    const productNames = products.length > 0
      ? products.join(', ')
      : 'no specific product detected';

    return (
      `Item "${item.name}" (${item.type}) classified as ${sea} ` +
      `with ${compatibility} compatibility. ` +
      `Detected Adobe products: ${productNames}. ` +
      `Source: ${item.sourcePath}.`
    );
  }

  // ----------------------------------------------------------
  // Utility
  // ----------------------------------------------------------

  private normalizePath(path: string): string {
    return path
      .toLowerCase()
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  }

  /**
   * Compute Dice coefficient between two strings for similarity detection.
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigrams = (s: string): Set<string> => {
      const set = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        set.add(s.substring(i, i + 2));
      }
      return set;
    };

    const setA = bigrams(a);
    const setB = bigrams(b);
    let intersection = 0;
    for (const bi of setA) {
      if (setB.has(bi)) intersection++;
    }

    return (2 * intersection) / (setA.size + setB.size);
  }
}

// ============================================================
// Error Class
// ============================================================

export class SortEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SortEngineError';
  }
}
