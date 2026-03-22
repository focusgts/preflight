/**
 * Black Hole - Distribution Engine
 *
 * Routes processed migration items to their target destinations based on
 * Adobe product mapping and classification results.
 */

import { v4 as uuid } from 'uuid';
import { AdobeProduct, CompatibilityLevel, Severity } from '@/types';
import type { MigrationItem, ValidationResult, ValidationCheck } from '@/types';
import type { ClassificationResult } from './sort';

// ============================================================
// Types
// ============================================================

export interface RoutingRule {
  id: string;
  name: string;
  targetProduct: AdobeProduct;
  pathPattern: RegExp;
  typePattern: string | null;
  targetPathTemplate: string;
  priority: number;
  enabled: boolean;
}

export interface RouteResult {
  itemId: string;
  targetProduct: AdobeProduct;
  targetPath: string;
  ruleId: string;
  validated: boolean;
  validationErrors: string[];
}

export interface DistributionReport {
  id: string;
  totalItems: number;
  routedItems: number;
  failedItems: number;
  skippedItems: number;
  byProduct: Record<string, number>;
  byStatus: Record<string, number>;
  errors: DistributionError[];
  createdAt: string;
}

export interface DistributionError {
  itemId: string;
  itemName: string;
  message: string;
  severity: Severity;
}

export interface DistributeOptions {
  dryRun: boolean;
  validateBeforeRoute: boolean;
  customRules?: RoutingRule[];
  onItemRouted?: (result: RouteResult) => void;
}

interface RollbackEntry {
  itemId: string;
  previousTargetPath: string | null;
  previousStatus: MigrationItem['status'];
  timestamp: string;
}

// ============================================================
// Default Routing Rules
// ============================================================

function buildDefaultRules(): RoutingRule[] {
  return [
    {
      id: 'rule-aem-sites-pages',
      name: 'AEM Sites Pages',
      targetProduct: AdobeProduct.AEM_SITES,
      pathPattern: /\/(content|sites)\//i,
      typePattern: 'page',
      targetPathTemplate: '/content/sites/{org}/{name}',
      priority: 10,
      enabled: true,
    },
    {
      id: 'rule-aem-sites-components',
      name: 'AEM Sites Components',
      targetProduct: AdobeProduct.AEM_SITES,
      pathPattern: /\/(components|apps)\//i,
      typePattern: 'component',
      targetPathTemplate: '/apps/{org}/components/{name}',
      priority: 10,
      enabled: true,
    },
    {
      id: 'rule-aem-assets',
      name: 'AEM Assets',
      targetProduct: AdobeProduct.AEM_ASSETS,
      pathPattern: /\/(dam|assets|media|images)\//i,
      typePattern: 'asset',
      targetPathTemplate: '/content/dam/{org}/{name}',
      priority: 10,
      enabled: true,
    },
    {
      id: 'rule-aem-forms',
      name: 'AEM Forms',
      targetProduct: AdobeProduct.AEM_FORMS,
      pathPattern: /\/(forms|adaptive-form)\//i,
      typePattern: null,
      targetPathTemplate: '/content/forms/af/{org}/{name}',
      priority: 10,
      enabled: true,
    },
    {
      id: 'rule-code',
      name: 'Code Bundles',
      targetProduct: AdobeProduct.AEM_SITES,
      pathPattern: /\.(java|jsp|js|ts|htl)$/i,
      typePattern: 'code',
      targetPathTemplate: '/apps/{org}/core/{name}',
      priority: 5,
      enabled: true,
    },
    {
      id: 'rule-config',
      name: 'Configuration',
      targetProduct: AdobeProduct.AEM_CLOUD_MANAGER,
      pathPattern: /\/(config|osgi|etc)\//i,
      typePattern: 'config',
      targetPathTemplate: '/apps/{org}/config/{name}',
      priority: 5,
      enabled: true,
    },
    {
      id: 'rule-analytics',
      name: 'Analytics Assets',
      targetProduct: AdobeProduct.ANALYTICS,
      pathPattern: /\/(analytics|report|segment|metric)\//i,
      typePattern: null,
      targetPathTemplate: '/analytics/{org}/{name}',
      priority: 8,
      enabled: true,
    },
    {
      id: 'rule-campaign',
      name: 'Campaign Assets',
      targetProduct: AdobeProduct.CAMPAIGN,
      pathPattern: /\/(campaign|delivery|workflow|email)\//i,
      typePattern: null,
      targetPathTemplate: '/campaign/{org}/{name}',
      priority: 8,
      enabled: true,
    },
    {
      id: 'rule-commerce',
      name: 'Commerce Assets',
      targetProduct: AdobeProduct.COMMERCE,
      pathPattern: /\/(catalog|product|cart|checkout|store)\//i,
      typePattern: null,
      targetPathTemplate: '/commerce/{org}/{name}',
      priority: 8,
      enabled: true,
    },
  ];
}

// ============================================================
// Engine
// ============================================================

const DEFAULT_OPTIONS: DistributeOptions = {
  dryRun: false,
  validateBeforeRoute: true,
};

export class DistributeEngine {
  private readonly options: DistributeOptions;
  private readonly rules: RoutingRule[];
  private rollbackLog: RollbackEntry[] = [];

  constructor(options: Partial<DistributeOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    const defaultRules = buildDefaultRules();
    this.rules = [
      ...defaultRules,
      ...(this.options.customRules ?? []),
    ].sort((a, b) => b.priority - a.priority);
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Route a single migration item using its classification result.
   * Returns the routing decision with the target path.
   */
  routeItem(
    item: MigrationItem,
    classification: ClassificationResult,
  ): RouteResult {
    // Validate before routing
    const validationErrors: string[] = [];
    if (this.options.validateBeforeRoute) {
      validationErrors.push(...this.validateItem(item, classification));
    }

    if (validationErrors.length > 0) {
      return {
        itemId: item.id,
        targetProduct: classification.adobeProducts[0] ?? AdobeProduct.AEM_SITES,
        targetPath: item.targetPath ?? item.sourcePath,
        ruleId: '',
        validated: false,
        validationErrors,
      };
    }

    // Find matching rule
    const matchedRule = this.findMatchingRule(item, classification);

    const targetProduct =
      classification.adobeProducts[0] ?? matchedRule?.targetProduct ?? AdobeProduct.AEM_SITES;

    const targetPath = matchedRule
      ? this.applyTemplate(matchedRule.targetPathTemplate, item)
      : this.fallbackTargetPath(item, targetProduct);

    // Store rollback info
    if (!this.options.dryRun) {
      this.rollbackLog.push({
        itemId: item.id,
        previousTargetPath: item.targetPath,
        previousStatus: item.status,
        timestamp: new Date().toISOString(),
      });
    }

    const result: RouteResult = {
      itemId: item.id,
      targetProduct,
      targetPath,
      ruleId: matchedRule?.id ?? 'fallback',
      validated: true,
      validationErrors: [],
    };

    this.options.onItemRouted?.(result);
    return result;
  }

  /**
   * Route a batch of items.
   */
  async routeBatch(
    items: MigrationItem[],
    classifications: Map<string, ClassificationResult>,
  ): Promise<RouteResult[]> {
    const results: RouteResult[] = [];

    for (const item of items) {
      const classification = classifications.get(item.id);
      if (!classification) {
        results.push({
          itemId: item.id,
          targetProduct: AdobeProduct.AEM_SITES,
          targetPath: item.sourcePath,
          ruleId: '',
          validated: false,
          validationErrors: ['No classification result found for item'],
        });
        continue;
      }
      results.push(this.routeItem(item, classification));
    }

    return results;
  }

  /**
   * Generate a distribution report summarizing routing outcomes.
   */
  generateReport(
    items: MigrationItem[],
    routeResults: RouteResult[],
  ): DistributionReport {
    const byProduct: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const errors: DistributionError[] = [];
    let routed = 0;
    let failed = 0;
    let skipped = 0;

    for (const result of routeResults) {
      const item = items.find((i) => i.id === result.itemId);

      if (result.validated) {
        routed++;
        byProduct[result.targetProduct] =
          (byProduct[result.targetProduct] ?? 0) + 1;
      } else if (result.validationErrors.length > 0) {
        failed++;
        errors.push({
          itemId: result.itemId,
          itemName: item?.name ?? result.itemId,
          message: result.validationErrors.join('; '),
          severity: Severity.HIGH,
        });
      } else {
        skipped++;
      }

      const status = item?.status ?? 'unknown';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }

    return {
      id: uuid(),
      totalItems: items.length,
      routedItems: routed,
      failedItems: failed,
      skippedItems: skipped,
      byProduct,
      byStatus,
      errors,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Rollback the last N routing operations. Returns the item IDs that were
   * rolled back.
   */
  rollback(count?: number): RollbackEntry[] {
    const n = count ?? this.rollbackLog.length;
    const entries = this.rollbackLog.splice(-n, n);
    return entries;
  }

  /**
   * Get current routing rules.
   */
  getRules(): readonly RoutingRule[] {
    return this.rules;
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private validateItem(
    item: MigrationItem,
    classification: ClassificationResult,
  ): string[] {
    const errors: string[] = [];

    if (!item.sourcePath || item.sourcePath.trim().length === 0) {
      errors.push('Item has no source path');
    }

    if (classification.compatibilityLevel === CompatibilityLevel.BLOCKER) {
      errors.push(
        `Item has BLOCKER compatibility level and cannot be routed automatically`,
      );
    }

    if (classification.riskScore >= 0.9) {
      errors.push(
        `Item risk score (${classification.riskScore}) exceeds safe routing threshold`,
      );
    }

    return errors;
  }

  private findMatchingRule(
    item: MigrationItem,
    classification: ClassificationResult,
  ): RoutingRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const pathMatch = rule.pathPattern.test(item.sourcePath);
      const typeMatch =
        rule.typePattern === null || rule.typePattern === item.type;

      // Also check if classification products match the rule target
      const productMatch =
        classification.adobeProducts.length === 0 ||
        classification.adobeProducts.includes(rule.targetProduct);

      if (pathMatch && typeMatch && productMatch) {
        return rule;
      }
    }
    return null;
  }

  private applyTemplate(template: string, item: MigrationItem): string {
    const orgSlug = this.extractOrg(item.sourcePath);
    return template
      .replace('{org}', orgSlug)
      .replace('{name}', this.extractFileName(item.sourcePath));
  }

  private fallbackTargetPath(item: MigrationItem, product: AdobeProduct): string {
    const fileName = this.extractFileName(item.sourcePath);
    return `/${product}/${fileName}`;
  }

  private extractOrg(path: string): string {
    const segments = path.split('/').filter(Boolean);
    // Use first meaningful segment as org
    for (const seg of segments) {
      if (!['content', 'apps', 'etc', 'var', 'conf', 'dam'].includes(seg.toLowerCase())) {
        return seg.toLowerCase();
      }
    }
    return 'default';
  }

  private extractFileName(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? 'untitled';
  }
}

// ============================================================
// Error Class
// ============================================================

export class DistributeEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributeEngineError';
  }
}
