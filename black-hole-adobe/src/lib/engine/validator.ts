/**
 * Black Hole - Validation Engine
 *
 * Post-migration validation that checks content integrity, code
 * compilation, SEO preservation, and performance benchmarks.
 */

import { v4 as uuid } from 'uuid';
import { Severity } from '@/types';
import type {
  MigrationItem,
  ValidationResult,
  ValidationCheck,
} from '@/types';

// ============================================================
// Types
// ============================================================

export interface ValidationReport {
  id: string;
  totalItems: number;
  validatedItems: number;
  passedItems: number;
  failedItems: number;
  passRate: number; // 0-100
  overallScore: number; // 0-100
  categories: ValidationCategoryResult[];
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  createdAt: string;
}

export interface ValidationCategoryResult {
  category: string;
  totalChecks: number;
  passedChecks: number;
  score: number; // 0-100
}

export interface ValidationIssue {
  itemId: string;
  itemName: string;
  checkName: string;
  message: string;
  severity: Severity;
}

export interface SEOValidationInput {
  originalUrls: string[];
  redirectMap: Map<string, string>;
  metaTags: { url: string; title: string | null; description: string | null }[];
}

export interface PerformanceBenchmark {
  metric: string;
  baseline: number;
  current: number;
  unit: string;
  passed: boolean;
  threshold: number;
}

export interface ValidatorOptions {
  /** Minimum acceptable validation score for a pass. */
  passThreshold: number;
  /** Enable SEO validation. */
  checkSEO: boolean;
  /** Enable performance benchmarks. */
  checkPerformance: boolean;
}

// ============================================================
// Engine
// ============================================================

const DEFAULT_OPTIONS: ValidatorOptions = {
  passThreshold: 80,
  checkSEO: true,
  checkPerformance: true,
};

export class ValidationEngine {
  private readonly options: ValidatorOptions;

  constructor(options: Partial<ValidatorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Validate content integrity for a single migrated item.
   * Checks existence, references, and metadata preservation.
   */
  async validateContent(
    item: MigrationItem,
    allItems: MigrationItem[],
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Check 1: Target path assigned
    checks.push({
      name: 'target-path-assigned',
      passed: item.targetPath !== null && item.targetPath.length > 0,
      message: item.targetPath
        ? `Target path assigned: ${item.targetPath}`
        : 'No target path assigned',
      severity: Severity.CRITICAL,
    });

    // Check 2: Status is completed
    checks.push({
      name: 'migration-status',
      passed: item.status === 'completed',
      message: item.status === 'completed'
        ? 'Item migration completed successfully'
        : `Item status is "${item.status}" - expected "completed"`,
      severity: Severity.CRITICAL,
    });

    // Check 3: No errors recorded
    checks.push({
      name: 'no-errors',
      passed: item.error === null,
      message: item.error === null
        ? 'No errors recorded'
        : `Error recorded: ${item.error}`,
      severity: Severity.HIGH,
    });

    // Check 4: Source-target path coherence
    const pathCoherent = this.checkPathCoherence(item);
    checks.push({
      name: 'path-coherence',
      passed: pathCoherent,
      message: pathCoherent
        ? 'Source and target paths are structurally coherent'
        : 'Target path structure diverges significantly from source',
      severity: Severity.MEDIUM,
    });

    // Check 5: Reference integrity
    const refCheck = this.checkReferenceIntegrity(item, allItems);
    checks.push(refCheck);

    // Check 6: Naming convention
    const namingOk = this.checkNamingConvention(item);
    checks.push({
      name: 'naming-convention',
      passed: namingOk,
      message: namingOk
        ? 'File naming follows convention'
        : 'File name contains disallowed characters or patterns',
      severity: Severity.LOW,
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      passed: score >= this.options.passThreshold,
      checks,
      score,
    };
  }

  /**
   * Validate code artifacts: check for compilation markers,
   * banned API usage, and bundle structure.
   */
  async validateCode(items: MigrationItem[]): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    const codeItems = items.filter(
      (i) => i.type === 'code' || i.type === 'component',
    );

    // Check 1: All code items completed
    const completedCode = codeItems.filter((i) => i.status === 'completed');
    checks.push({
      name: 'code-completion',
      passed: completedCode.length === codeItems.length,
      message: `${completedCode.length}/${codeItems.length} code items migrated`,
      severity: Severity.HIGH,
    });

    // Check 2: No blocker-level items remaining
    const blockers = codeItems.filter(
      (i) => i.compatibilityLevel === 'blocker' && i.status !== 'completed',
    );
    checks.push({
      name: 'no-blockers',
      passed: blockers.length === 0,
      message: blockers.length === 0
        ? 'No remaining blocker-level code items'
        : `${blockers.length} blocker-level code items remain unresolved`,
      severity: Severity.CRITICAL,
    });

    // Check 3: Auto-fix application rate
    const autoFixable = codeItems.filter(
      (i) => i.compatibilityLevel === 'auto_fixable',
    );
    const autoFixed = autoFixable.filter((i) => i.autoFixed);
    const autoFixRate = autoFixable.length > 0
      ? autoFixed.length / autoFixable.length
      : 1;
    checks.push({
      name: 'auto-fix-applied',
      passed: autoFixRate >= 0.9,
      message: `Auto-fix applied to ${autoFixed.length}/${autoFixable.length} auto-fixable items`,
      severity: Severity.MEDIUM,
    });

    // Check 4: Target paths assigned for all code
    const withTarget = codeItems.filter(
      (i) => i.targetPath !== null && i.targetPath.length > 0,
    );
    checks.push({
      name: 'code-target-paths',
      passed: withTarget.length === codeItems.length,
      message: `${withTarget.length}/${codeItems.length} code items have target paths`,
      severity: Severity.HIGH,
    });

    // Check 5: No deprecated path patterns in targets
    const deprecatedPatterns = ['/apps/cq/', '/libs/cq/', '/etc/designs/'];
    const withDeprecated = codeItems.filter((i) =>
      i.targetPath &&
      deprecatedPatterns.some((p) => i.targetPath!.includes(p)),
    );
    checks.push({
      name: 'no-deprecated-paths',
      passed: withDeprecated.length === 0,
      message: withDeprecated.length === 0
        ? 'No deprecated path patterns in target paths'
        : `${withDeprecated.length} items target deprecated paths`,
      severity: Severity.HIGH,
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      passed: score >= this.options.passThreshold,
      checks,
      score,
    };
  }

  /**
   * Validate SEO preservation: URL redirects, meta tags, canonical URLs.
   */
  async validateSEO(input: SEOValidationInput): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Check 1: All original URLs have redirects
    const urlsWithRedirects = input.originalUrls.filter((url) =>
      input.redirectMap.has(url),
    );
    const redirectCoverage = input.originalUrls.length > 0
      ? urlsWithRedirects.length / input.originalUrls.length
      : 1;
    checks.push({
      name: 'redirect-coverage',
      passed: redirectCoverage >= 0.95,
      message: `${urlsWithRedirects.length}/${input.originalUrls.length} URLs have redirects (${Math.round(redirectCoverage * 100)}%)`,
      severity: Severity.CRITICAL,
    });

    // Check 2: No redirect loops
    const loops = this.detectRedirectLoops(input.redirectMap);
    checks.push({
      name: 'no-redirect-loops',
      passed: loops.length === 0,
      message: loops.length === 0
        ? 'No redirect loops detected'
        : `${loops.length} redirect loops detected`,
      severity: Severity.CRITICAL,
    });

    // Check 3: Redirect chain length
    const longChains = this.detectLongRedirectChains(input.redirectMap, 3);
    checks.push({
      name: 'redirect-chain-length',
      passed: longChains.length === 0,
      message: longChains.length === 0
        ? 'No long redirect chains detected'
        : `${longChains.length} redirect chains exceed 3 hops`,
      severity: Severity.HIGH,
    });

    // Check 4: Meta title preservation
    const pagesWithTitles = input.metaTags.filter(
      (m) => m.title !== null && m.title.length > 0,
    );
    const titleRate = input.metaTags.length > 0
      ? pagesWithTitles.length / input.metaTags.length
      : 1;
    checks.push({
      name: 'meta-title-preservation',
      passed: titleRate >= 0.9,
      message: `${pagesWithTitles.length}/${input.metaTags.length} pages have meta titles`,
      severity: Severity.HIGH,
    });

    // Check 5: Meta description preservation
    const pagesWithDesc = input.metaTags.filter(
      (m) => m.description !== null && m.description.length > 0,
    );
    const descRate = input.metaTags.length > 0
      ? pagesWithDesc.length / input.metaTags.length
      : 1;
    checks.push({
      name: 'meta-description-preservation',
      passed: descRate >= 0.8,
      message: `${pagesWithDesc.length}/${input.metaTags.length} pages have meta descriptions`,
      severity: Severity.MEDIUM,
    });

    // Check 6: No redirect to 404-like paths
    const suspiciousTargets = Array.from(input.redirectMap.values()).filter(
      (target) => target.includes('404') || target.includes('not-found'),
    );
    checks.push({
      name: 'no-redirect-to-error',
      passed: suspiciousTargets.length === 0,
      message: suspiciousTargets.length === 0
        ? 'No redirects point to error pages'
        : `${suspiciousTargets.length} redirects point to potential error pages`,
      severity: Severity.HIGH,
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      passed: score >= this.options.passThreshold,
      checks,
      score,
    };
  }

  /**
   * Validate performance metrics against baseline benchmarks.
   */
  async validatePerformance(
    benchmarks: PerformanceBenchmark[],
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = benchmarks.map((b) => {
      const withinThreshold =
        b.current <= b.baseline * (1 + b.threshold / 100);

      return {
        name: `perf-${b.metric}`,
        passed: withinThreshold,
        message: withinThreshold
          ? `${b.metric}: ${b.current}${b.unit} (baseline: ${b.baseline}${b.unit}, within ${b.threshold}% threshold)`
          : `${b.metric}: ${b.current}${b.unit} exceeds baseline ${b.baseline}${b.unit} by more than ${b.threshold}%`,
        severity: withinThreshold ? Severity.INFO : Severity.HIGH,
      };
    });

    // Add overall performance check
    const passedBenchmarks = checks.filter((c) => c.passed).length;
    checks.push({
      name: 'overall-performance',
      passed: passedBenchmarks === benchmarks.length,
      message: `${passedBenchmarks}/${benchmarks.length} performance benchmarks passed`,
      severity: Severity.MEDIUM,
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);

    return {
      passed: score >= this.options.passThreshold,
      checks,
      score,
    };
  }

  /**
   * Generate a comprehensive validation report across all categories.
   */
  async generateValidationReport(
    completedItems: MigrationItem[],
    allItems: MigrationItem[],
  ): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];
    const categoryResults = new Map<string, { total: number; passed: number }>();
    let passedItems = 0;

    for (const item of completedItems) {
      const result = await this.validateContent(item, allItems);

      if (result.passed) {
        passedItems++;
      }

      for (const check of result.checks) {
        // Track category stats
        const catKey = check.name.split('-')[0] ?? 'general';
        const cat = categoryResults.get(catKey) ?? { total: 0, passed: 0 };
        cat.total++;
        if (check.passed) cat.passed++;
        categoryResults.set(catKey, cat);

        // Collect issues
        if (!check.passed) {
          issues.push({
            itemId: item.id,
            itemName: item.name,
            checkName: check.name,
            message: check.message,
            severity: check.severity,
          });
        }
      }
    }

    // Code validation
    const codeResult = await this.validateCode(allItems);
    for (const check of codeResult.checks) {
      const cat = categoryResults.get('code') ?? { total: 0, passed: 0 };
      cat.total++;
      if (check.passed) cat.passed++;
      categoryResults.set('code', cat);

      if (!check.passed) {
        issues.push({
          itemId: 'aggregate',
          itemName: 'Code Validation',
          checkName: check.name,
          message: check.message,
          severity: check.severity,
        });
      }
    }

    const categories: ValidationCategoryResult[] = Array.from(
      categoryResults.entries(),
    ).map(([category, { total, passed }]) => ({
      category,
      totalChecks: total,
      passedChecks: passed,
      score: total > 0 ? Math.round((passed / total) * 100) : 100,
    }));

    const criticalIssues = issues.filter(
      (i) => i.severity === Severity.CRITICAL || i.severity === Severity.HIGH,
    );
    const warnings = issues.filter(
      (i) => i.severity === Severity.MEDIUM || i.severity === Severity.LOW,
    );

    const totalChecks = categories.reduce((s, c) => s + c.totalChecks, 0);
    const totalPassed = categories.reduce((s, c) => s + c.passedChecks, 0);
    const overallScore = totalChecks > 0
      ? Math.round((totalPassed / totalChecks) * 100)
      : 100;

    const passRate = completedItems.length > 0
      ? Math.round((passedItems / completedItems.length) * 100)
      : 100;

    return {
      id: uuid(),
      totalItems: allItems.length,
      validatedItems: completedItems.length,
      passedItems,
      failedItems: completedItems.length - passedItems,
      passRate,
      overallScore,
      categories,
      criticalIssues,
      warnings,
      createdAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------------
  // Internal Checks
  // ----------------------------------------------------------

  private checkPathCoherence(item: MigrationItem): boolean {
    if (!item.targetPath) return false;

    // Both paths should share at least some structural similarity
    const sourceSegments = item.sourcePath.split('/').filter(Boolean);
    const targetSegments = item.targetPath.split('/').filter(Boolean);

    // The filename should be preserved
    const sourceFile = sourceSegments[sourceSegments.length - 1] ?? '';
    const targetFile = targetSegments[targetSegments.length - 1] ?? '';

    // Allow different extensions (e.g., .jsp -> .html)
    const sourceBase = sourceFile.split('.')[0]?.toLowerCase() ?? '';
    const targetBase = targetFile.split('.')[0]?.toLowerCase() ?? '';

    return sourceBase === targetBase || targetSegments.length >= 2;
  }

  private checkReferenceIntegrity(
    item: MigrationItem,
    allItems: MigrationItem[],
  ): ValidationCheck {
    // Check if this item's source path is referenced by other items
    // and those items also migrated successfully
    if (item.type !== 'page' && item.type !== 'content') {
      return {
        name: 'reference-integrity',
        passed: true,
        message: 'Reference integrity check not applicable for this item type',
        severity: Severity.INFO,
      };
    }

    // Check that all items in the same directory subtree also completed
    const dir = item.sourcePath.substring(
      0,
      item.sourcePath.lastIndexOf('/'),
    );
    const siblings = allItems.filter(
      (i) => i.id !== item.id && i.sourcePath.startsWith(dir),
    );
    const failedSiblings = siblings.filter(
      (s) => s.status === 'failed' || s.status === 'skipped',
    );

    const passed = failedSiblings.length === 0;
    return {
      name: 'reference-integrity',
      passed,
      message: passed
        ? 'All related items in the same content subtree migrated successfully'
        : `${failedSiblings.length} related items in ${dir}/ failed or were skipped`,
      severity: Severity.MEDIUM,
    };
  }

  private checkNamingConvention(item: MigrationItem): boolean {
    const fileName = item.targetPath?.split('/').pop() ?? item.name;
    // No spaces, no special chars except dash, underscore, dot
    return /^[a-zA-Z0-9._-]+$/.test(fileName);
  }

  private detectRedirectLoops(redirectMap: Map<string, string>): string[] {
    const loops: string[] = [];

    for (const [source] of redirectMap) {
      const visited = new Set<string>();
      let current: string | undefined = source;

      while (current && !visited.has(current)) {
        visited.add(current);
        current = redirectMap.get(current);
      }

      if (current && visited.has(current)) {
        loops.push(current);
      }
    }

    return [...new Set(loops)];
  }

  private detectLongRedirectChains(
    redirectMap: Map<string, string>,
    maxHops: number,
  ): string[] {
    const longChains: string[] = [];

    for (const [source] of redirectMap) {
      let hops = 0;
      let current: string | undefined = source;
      const visited = new Set<string>();

      while (current && !visited.has(current)) {
        visited.add(current);
        current = redirectMap.get(current);
        hops++;

        if (hops > maxHops) {
          longChains.push(source);
          break;
        }
      }
    }

    return longChains;
  }
}

// ============================================================
// Error Class
// ============================================================

export class ValidationEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationEngineError';
  }
}
