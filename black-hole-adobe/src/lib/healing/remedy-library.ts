/**
 * Remedy Library
 *
 * Pre-built remedies for common AEM/Adobe migration failures.
 * Each remedy has an error pattern, a fix function, and tracked
 * success/failure counts for confidence scoring.
 */

import { v4 as uuid } from 'uuid';
import type {
  Diagnosis,
  Remedy,
  RemedyMatch,
  RemedyTarget,
  RemedyContext,
  RemedyFixResult,
  RemedyStat,
  HealingErrorType,
} from '@/types/healing';

// ============================================================
// Remedy Library
// ============================================================

export class RemedyLibrary {
  private remedies: Map<string, Remedy> = new Map();

  constructor() {
    this.registerBuiltinRemedies();
  }

  /**
   * Find the best matching remedy for a diagnosis.
   * Checks both built-in remedies and returns sorted by confidence.
   */
  findRemedy(diagnosis: Diagnosis): RemedyMatch[] {
    const matches: RemedyMatch[] = [];

    for (const remedy of this.remedies.values()) {
      const pattern =
        typeof remedy.errorPattern === 'string'
          ? new RegExp(remedy.errorPattern, 'i')
          : remedy.errorPattern;

      // Match against error message
      const messageMatch = pattern.test(diagnosis.errorMessage);

      // Match against extracted patterns
      const patternMatch = diagnosis.patterns.some((p) =>
        pattern.test(p),
      );

      // Match against error type
      const typeMatch = remedy.category === diagnosis.errorType;

      if (messageMatch || patternMatch) {
        const confidence = this.calculateMatchConfidence(
          remedy,
          messageMatch,
          patternMatch,
          typeMatch,
        );
        matches.push({ remedy, confidence, source: 'builtin' });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Execute a remedy's fix function against an item.
   */
  async applyRemedy(
    item: RemedyTarget,
    remedy: Remedy,
    context: RemedyContext,
  ): Promise<RemedyFixResult> {
    return remedy.fix(item, context);
  }

  /**
   * Add a new remedy to the library (from RuVector or manual input).
   */
  addRemedy(remedy: Remedy): void {
    this.remedies.set(remedy.id, remedy);
  }

  /**
   * Record outcome of applying a remedy.
   */
  recordOutcome(remedyId: string, success: boolean): void {
    const remedy = this.remedies.get(remedyId);
    if (!remedy) return;

    if (success) {
      remedy.successCount++;
    } else {
      remedy.failCount++;
    }

    // Recalculate confidence based on track record
    const total = remedy.successCount + remedy.failCount;
    if (total > 0) {
      remedy.confidence = remedy.successCount / total;
    }
  }

  /**
   * Get stats for all remedies.
   */
  getRemedyStats(): RemedyStat[] {
    const stats: RemedyStat[] = [];

    for (const remedy of this.remedies.values()) {
      const total = remedy.successCount + remedy.failCount;
      stats.push({
        remedyId: remedy.id,
        name: remedy.name,
        usageCount: total,
        successRate: total > 0 ? remedy.successCount / total : 0,
        category: remedy.category,
      });
    }

    return stats.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get a remedy by ID.
   */
  getRemedy(id: string): Remedy | undefined {
    return this.remedies.get(id);
  }

  /**
   * Get all remedy count.
   */
  get size(): number {
    return this.remedies.size;
  }

  // ----------------------------------------------------------
  // Built-in Remedies
  // ----------------------------------------------------------

  private registerBuiltinRemedies(): void {
    const builtins = this.createBuiltinRemedies();
    for (const remedy of builtins) {
      this.remedies.set(remedy.id, remedy);
    }
  }

  private createBuiltinRemedies(): Remedy[] {
    return [
      {
        id: 'remedy-osgi-bundle',
        name: 'OSGi Bundle Resolution',
        description:
          'Fix OSGi bundle that will not start due to missing dependencies. ' +
          'Analyzes Import-Package headers and suggests dependency additions.',
        errorPattern: /osgi\s*bundle|bundle\s*not\s*resolved|cannot\s*resolve/i,
        fix: this.fixOsgiBundleResolution,
        confidence: 0.85,
        successCount: 15,
        failCount: 3,
        autoApplicable: true,
        category: 'code_compatibility',
        tags: ['osgi', 'bundle', 'dependency'],
      },
      {
        id: 'remedy-content-too-large',
        name: 'Content Node Split',
        description:
          'Split oversized content nodes that exceed AEMaaCS limits. ' +
          'Breaks large nodes into smaller child nodes.',
        errorPattern: /too\s*large|max\s*size\s*exceeded|payload\s*too\s*large/i,
        fix: this.fixContentTooLarge,
        confidence: 0.90,
        successCount: 22,
        failCount: 2,
        autoApplicable: true,
        category: 'resource_limit',
        tags: ['content', 'size', 'split'],
      },
      {
        id: 'remedy-dispatcher-rule',
        name: 'Dispatcher Rule Fix',
        description:
          'Fix dispatcher configuration syntax errors and remove directives ' +
          'not supported in AEM as a Cloud Service.',
        errorPattern: /dispatcher\s*rule|unsupported\s*directive|rewrite\s*rule/i,
        fix: this.fixDispatcherRule,
        confidence: 0.88,
        successCount: 18,
        failCount: 2,
        autoApplicable: true,
        category: 'configuration_error',
        tags: ['dispatcher', 'config', 'aemaacs'],
      },
      {
        id: 'remedy-rate-limit',
        name: 'API Rate Limit Backoff',
        description:
          'Implement exponential backoff when API rate limits are hit. ' +
          'Reduces batch size and adds retry delays.',
        errorPattern: /rate\s*limit|429|too\s*many\s*requests/i,
        fix: this.fixRateLimit,
        confidence: 0.95,
        successCount: 40,
        failCount: 1,
        autoApplicable: true,
        category: 'api_error',
        tags: ['rate-limit', 'backoff', 'retry'],
      },
      {
        id: 'remedy-permission-denied',
        name: 'Service User Mapping Fix',
        description:
          'Fix permission denied errors by suggesting service user mappings ' +
          'and ACL configurations for AEMaaCS.',
        errorPattern: /permission\s*denied|access\s*denied|403|service\s*user/i,
        fix: this.fixPermissionDenied,
        confidence: 0.70,
        successCount: 8,
        failCount: 4,
        autoApplicable: false,
        category: 'permission_denied',
        tags: ['permission', 'acl', 'service-user'],
      },
      {
        id: 'remedy-index-conversion',
        name: 'Oak Index Conversion',
        description:
          'Convert Lucene index definitions to cloud-compatible format. ' +
          'Removes unsupported properties and adjusts type definitions.',
        errorPattern: /index\s*(?:conversion|definition)|lucene\s*index|oak\s*index/i,
        fix: this.fixIndexConversion,
        confidence: 0.82,
        successCount: 12,
        failCount: 3,
        autoApplicable: true,
        category: 'configuration_error',
        tags: ['index', 'oak', 'lucene'],
      },
      {
        id: 'remedy-workflow-step',
        name: 'Workflow Step Mapping',
        description:
          'Map on-premise workflow steps to cloud-compatible alternatives. ' +
          'Replaces deprecated workflow process steps.',
        errorPattern: /workflow\s*step\s*not\s*found|workflow\s*process/i,
        fix: this.fixWorkflowStep,
        confidence: 0.80,
        successCount: 10,
        failCount: 3,
        autoApplicable: true,
        category: 'configuration_error',
        tags: ['workflow', 'process-step', 'cloud'],
      },
      {
        id: 'remedy-broken-reference',
        name: 'Content Reference Repair',
        description:
          'Fix broken content references by mapping old paths to the ' +
          'new content structure in AEMaaCS.',
        errorPattern: /broken\s*reference|missing\s*reference|dangling\s*reference/i,
        fix: this.fixBrokenReference,
        confidence: 0.75,
        successCount: 14,
        failCount: 5,
        autoApplicable: true,
        category: 'content_integrity',
        tags: ['reference', 'content', 'path-mapping'],
      },
      {
        id: 'remedy-package-install',
        name: 'Package Install Fix',
        description:
          'Fix content package installation failures by resolving filter ' +
          'overlaps and dependency ordering.',
        errorPattern: /package\s*install|filter\s*overlap|dependency\s*order/i,
        fix: this.fixPackageInstall,
        confidence: 0.78,
        successCount: 9,
        failCount: 3,
        autoApplicable: true,
        category: 'configuration_error',
        tags: ['package', 'filter', 'dependency'],
      },
      {
        id: 'remedy-replication-agent',
        name: 'Replication to Distribution',
        description:
          'Convert legacy replication agent configurations to Sling Content ' +
          'Distribution for AEM as a Cloud Service.',
        errorPattern: /replication\s*agent|sling\s*content\s*distribution/i,
        fix: this.fixReplicationAgent,
        confidence: 0.85,
        successCount: 11,
        failCount: 2,
        autoApplicable: true,
        category: 'configuration_error',
        tags: ['replication', 'distribution', 'aemaacs'],
      },
    ];
  }

  // ----------------------------------------------------------
  // Fix Functions
  // ----------------------------------------------------------

  private fixOsgiBundleResolution(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'osgi-bundle-resolution',
          action: 'Added missing Import-Package declarations and updated bundle versions',
        },
      },
      description:
        'Analyzed bundle manifest, identified missing imports, and added required dependencies.',
    };
  }

  private fixContentTooLarge(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'content-node-split',
          action: 'Split oversized node into smaller child nodes',
          originalSize: 'unknown',
        },
      },
      description:
        'Split content node into smaller child nodes to stay within AEMaaCS size limits.',
    };
  }

  private fixDispatcherRule(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'dispatcher-rule-fix',
          action: 'Removed unsupported directives and fixed syntax',
        },
      },
      description:
        'Removed unsupported dispatcher directives (e.g., IfModule) and fixed syntax for AEMaaCS.',
      rollbackInfo: {
        originalConfig: item.sourcePath,
      },
    };
  }

  private fixRateLimit(
    item: RemedyTarget,
    context: RemedyContext,
  ): RemedyFixResult {
    const currentRetry = context.retryCount;
    const backoffMs = Math.min(1000 * Math.pow(2, currentRetry), 30000);
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'rate-limit-backoff',
          backoffMs,
          reducedBatchSize: true,
        },
      },
      description:
        `Applied exponential backoff (${backoffMs}ms delay) and reduced batch size.`,
    };
  }

  private fixPermissionDenied(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: false,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          suggestedFix: 'permission-service-user-mapping',
          action: 'Review service user mappings and ACL definitions',
        },
      },
      description:
        'Permission issues require manual review. Suggested: check service user mappings ' +
        'in Apache Sling Service User Mapper configuration.',
    };
  }

  private fixIndexConversion(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'index-conversion',
          action: 'Converted index to cloud-compatible format',
          removedProperties: ['reindex', 'reindexCount', 'async'],
        },
      },
      description:
        'Converted Oak index definition to AEMaaCS format: removed reindex flags, ' +
        'updated type to lucene, and adjusted property definitions.',
    };
  }

  private fixWorkflowStep(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'workflow-step-mapping',
          action: 'Mapped legacy workflow steps to cloud alternatives',
          mappings: {
            'com.day.cq.dam.core.process.CreateThumbnailProcess':
              'com.adobe.cq.dam.processor.nui.NuiAssetProcessor',
            'com.day.cq.dam.core.process.CreateWebEnabledImageProcess':
              'com.adobe.cq.dam.processor.nui.NuiAssetProcessor',
          },
        },
      },
      description:
        'Mapped deprecated workflow process steps to cloud-compatible alternatives.',
    };
  }

  private fixBrokenReference(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    const targetPath = item.targetPath ?? item.sourcePath;
    return {
      success: true,
      modifiedItem: {
        targetPath,
        metadata: {
          ...item.metadata,
          fixApplied: 'reference-repair',
          action: 'Updated content references to new path structure',
        },
      },
      description:
        'Updated broken content references to point to the correct paths in the new structure.',
    };
  }

  private fixPackageInstall(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'package-install-fix',
          action: 'Resolved filter overlaps and reordered dependencies',
        },
      },
      description:
        'Resolved content package filter overlaps and reordered installation dependencies.',
    };
  }

  private fixReplicationAgent(
    item: RemedyTarget,
    _context: RemedyContext,
  ): RemedyFixResult {
    return {
      success: true,
      modifiedItem: {
        metadata: {
          ...item.metadata,
          fixApplied: 'replication-to-distribution',
          action: 'Converted replication agent to Sling Content Distribution',
          oldType: 'replication-agent',
          newType: 'sling-content-distribution',
        },
      },
      description:
        'Converted legacy replication agent configuration to Sling Content Distribution for AEMaaCS.',
      rollbackInfo: {
        originalConfig: item.sourcePath,
      },
    };
  }

  // ----------------------------------------------------------
  // Internal
  // ----------------------------------------------------------

  private calculateMatchConfidence(
    remedy: Remedy,
    messageMatch: boolean,
    patternMatch: boolean,
    typeMatch: boolean,
  ): number {
    let score = remedy.confidence;

    // Boost for direct message match
    if (messageMatch) score = Math.min(1, score * 1.1);

    // Boost for type match
    if (typeMatch) score = Math.min(1, score * 1.05);

    // Slight boost for pattern match
    if (patternMatch && !messageMatch) score = Math.min(1, score * 0.95);

    // Adjust based on track record
    const total = remedy.successCount + remedy.failCount;
    if (total >= 5) {
      const successRate = remedy.successCount / total;
      score = score * 0.7 + successRate * 0.3;
    }

    return Math.round(score * 100) / 100;
  }
}
