/**
 * Failure Diagnostic Engine
 *
 * Analyzes migration errors to produce structured diagnoses with
 * categorized error types, searchable patterns, and root cause analysis.
 * Feeds into the healing engine for remedy matching.
 */

import { v4 as uuid } from 'uuid';
import { Severity } from '@/types';
import type { MigrationItem, PhaseType } from '@/types';
import type {
  Diagnosis,
  DiagnosisContext,
  HealingErrorType,
} from '@/types/healing';

// ============================================================
// Error Classification Rules
// ============================================================

interface ClassificationRule {
  type: HealingErrorType;
  patterns: RegExp[];
  severity: Severity;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    type: 'permission_denied',
    patterns: [
      /permission\s*denied/i,
      /access\s*denied/i,
      /forbidden/i,
      /401\s*unauthorized/i,
      /403\s*forbidden/i,
      /authentication\s*failed/i,
      /service\s*user\s*mapping/i,
      /ACL\s*violation/i,
    ],
    severity: Severity.HIGH,
  },
  {
    type: 'api_error',
    patterns: [
      /HTTP\s*(?:4\d{2}|5\d{2})/i,
      /rate\s*limit/i,
      /too\s*many\s*requests/i,
      /429/,
      /500\s*internal/i,
      /502\s*bad\s*gateway/i,
      /503\s*service\s*unavailable/i,
      /504\s*gateway\s*timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /api\s*error/i,
    ],
    severity: Severity.HIGH,
  },
  {
    type: 'resource_limit',
    patterns: [
      /timeout/i,
      /out\s*of\s*memory/i,
      /heap\s*space/i,
      /disk\s*space/i,
      /quota\s*exceeded/i,
      /too\s*large/i,
      /payload\s*too\s*large/i,
      /max\s*size\s*exceeded/i,
      /ENOMEM/i,
      /ENOSPC/i,
    ],
    severity: Severity.HIGH,
  },
  {
    type: 'configuration_error',
    patterns: [
      /invalid\s*config/i,
      /osgi\s*config/i,
      /dispatcher\s*rule/i,
      /dispatcher.*(?:syntax|error)/i,
      /rewrite\s*rule/i,
      /invalid\s*property/i,
      /unsupported\s*directive/i,
      /index\s*definition/i,
      /workflow\s*step/i,
      /replication\s*agent/i,
      /sling\s*mapping/i,
    ],
    severity: Severity.MEDIUM,
  },
  {
    type: 'code_compatibility',
    patterns: [
      /cannot\s*resolve/i,
      /compilation\s*error/i,
      /syntax\s*error/i,
      /deprecated\s*api/i,
      /class\s*not\s*found/i,
      /bundle\s*not\s*resolved/i,
      /import\s*not\s*found/i,
      /incompatible\s*type/i,
      /maven\s*build\s*failure/i,
      /osgi\s*bundle/i,
    ],
    severity: Severity.MEDIUM,
  },
  {
    type: 'content_integrity',
    patterns: [
      /broken\s*reference/i,
      /missing\s*reference/i,
      /invalid\s*node\s*type/i,
      /content\s*not\s*found/i,
      /path\s*not\s*found/i,
      /dangling\s*reference/i,
      /corrupt/i,
      /invalid\s*jcr/i,
      /asset\s*missing/i,
    ],
    severity: Severity.MEDIUM,
  },
];

// ============================================================
// Diagnostic Engine
// ============================================================

export class DiagnosticEngine {
  /**
   * Produce a structured diagnosis from an error and migration context.
   */
  analyze(
    error: Error | string,
    migrationId: string,
    phase: string,
    item: MigrationItem,
    allItems?: MigrationItem[],
  ): Diagnosis {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stackTrace = typeof error === 'string' ? null : (error.stack ?? null);

    const errorType = this.classifyError(errorMessage);
    const patterns = this.extractPatterns(errorMessage, stackTrace);
    const severity = this.getSeverity(errorType, errorMessage);
    const httpStatus = this.extractHttpStatus(errorMessage);
    const rootCause = this.suggestRootCause(errorType, errorMessage, patterns);
    const relatedItemIds = allItems
      ? this.findRelatedItems(item, allItems).map((i) => i.id)
      : [];

    const context: DiagnosisContext = {
      migrationId,
      phase,
      itemId: item.id,
      itemType: item.type,
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
    };

    return {
      id: uuid(),
      errorType,
      errorMessage,
      patterns,
      rootCause,
      relatedItemIds,
      severity,
      httpStatus,
      stackTrace,
      context,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Classify an error message into a known category.
   */
  classifyError(errorMessage: string): HealingErrorType {
    for (const rule of CLASSIFICATION_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(errorMessage)) {
          return rule.type;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Extract searchable patterns from error message and stack trace.
   * These patterns are used to query RuVector for matching fixes.
   */
  extractPatterns(errorMessage: string, stackTrace?: string | null): string[] {
    const patterns: string[] = [];

    // Extract HTTP status codes
    const httpMatch = errorMessage.match(/HTTP\s*(\d{3})/i);
    if (httpMatch) {
      patterns.push(`http_${httpMatch[1]}`);
    }

    // Extract error codes (e.g., ECONNREFUSED, ERR_*)
    const codeMatch = errorMessage.match(/\b(E[A-Z]{3,}|ERR_[A-Z_]+)\b/);
    if (codeMatch) {
      patterns.push(codeMatch[1].toLowerCase());
    }

    // Extract Java-style exception class names
    const exceptionMatch = errorMessage.match(
      /\b([A-Z][a-zA-Z]*(?:Exception|Error|Fault))\b/,
    );
    if (exceptionMatch) {
      patterns.push(exceptionMatch[1].toLowerCase());
    }

    // Extract OSGi bundle identifiers
    const bundleMatch = errorMessage.match(
      /bundle\s+([a-z][a-z0-9._-]+)/i,
    );
    if (bundleMatch) {
      patterns.push(`bundle:${bundleMatch[1]}`);
    }

    // Extract JCR node types
    const nodeTypeMatch = errorMessage.match(
      /node\s*type\s+([a-z:]+[a-zA-Z]+)/i,
    );
    if (nodeTypeMatch) {
      patterns.push(`nodetype:${nodeTypeMatch[1]}`);
    }

    // Extract file paths
    const pathMatch = errorMessage.match(
      /(?:\/[a-zA-Z0-9._-]+){2,}/,
    );
    if (pathMatch) {
      patterns.push(`path:${pathMatch[0]}`);
    }

    // Extract key phrases (2-3 word combos from error message)
    const words = errorMessage
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (words.length >= 2) {
      patterns.push(words.slice(0, 3).join(' '));
    }

    // Stack trace patterns
    if (stackTrace) {
      const stackClasses = stackTrace.match(
        /at\s+([a-zA-Z0-9.]+)\./g,
      );
      if (stackClasses) {
        const unique = [...new Set(stackClasses.slice(0, 3))];
        patterns.push(...unique.map((c) => c.replace(/^at\s+/, '').replace(/\.$/, '')));
      }
    }

    return [...new Set(patterns)];
  }

  /**
   * Find items that might be affected by the same underlying issue.
   * Groups by type, path prefix, and shared dependency patterns.
   */
  findRelatedItems(
    failedItem: MigrationItem,
    allItems: MigrationItem[],
  ): MigrationItem[] {
    const pathPrefix = this.getPathPrefix(failedItem.sourcePath);

    return allItems.filter((item) => {
      if (item.id === failedItem.id) return false;

      // Same type and similar path
      if (item.type === failedItem.type && this.getPathPrefix(item.sourcePath) === pathPrefix) {
        return true;
      }

      // Same type with same error (already failed)
      if (
        item.type === failedItem.type &&
        item.status === 'failed' &&
        item.error === failedItem.error
      ) {
        return true;
      }

      return false;
    });
  }

  /**
   * Suggest a root cause based on error type and extracted patterns.
   */
  suggestRootCause(
    errorType: HealingErrorType,
    errorMessage: string,
    patterns: string[],
  ): string {
    switch (errorType) {
      case 'api_error': {
        if (patterns.some((p) => p.includes('429') || p.includes('rate'))) {
          return 'API rate limit exceeded. The migration is sending requests too quickly.';
        }
        if (patterns.some((p) => p.includes('5'))) {
          return 'Remote server error. The target API is experiencing issues.';
        }
        return 'API communication failure. Check connectivity and credentials.';
      }

      case 'code_compatibility': {
        if (errorMessage.toLowerCase().includes('bundle')) {
          return 'OSGi bundle cannot resolve dependencies. Missing imports or incompatible versions.';
        }
        if (errorMessage.toLowerCase().includes('deprecated')) {
          return 'Code uses deprecated APIs not available in AEM as a Cloud Service.';
        }
        return 'Code is not compatible with the target platform version.';
      }

      case 'content_integrity': {
        if (errorMessage.toLowerCase().includes('reference')) {
          return 'Content contains references to paths that do not exist in the target structure.';
        }
        return 'Content structure does not match target platform requirements.';
      }

      case 'permission_denied':
        return 'Insufficient permissions. Service user mappings or ACLs need to be configured.';

      case 'resource_limit': {
        if (errorMessage.toLowerCase().includes('timeout')) {
          return 'Operation timed out. Item may be too large or system under heavy load.';
        }
        return 'System resource limit exceeded. Consider reducing batch size or splitting items.';
      }

      case 'configuration_error': {
        if (errorMessage.toLowerCase().includes('dispatcher')) {
          return 'Dispatcher configuration contains syntax errors or unsupported directives for AEMaaCS.';
        }
        if (errorMessage.toLowerCase().includes('workflow')) {
          return 'Workflow uses steps not available in AEM as a Cloud Service.';
        }
        return 'Configuration is invalid or incompatible with the target environment.';
      }

      default:
        return 'Unknown error. Manual investigation required.';
    }
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private getSeverity(errorType: HealingErrorType, errorMessage: string): Severity {
    const rule = CLASSIFICATION_RULES.find((r) => r.type === errorType);
    if (rule) return rule.severity;

    // Escalate if error message contains critical keywords
    if (/critical|fatal|corrupt/i.test(errorMessage)) {
      return Severity.CRITICAL;
    }
    return Severity.MEDIUM;
  }

  private extractHttpStatus(errorMessage: string): number | null {
    const match = errorMessage.match(/\b([1-5]\d{2})\b/);
    if (match) {
      const code = parseInt(match[1], 10);
      if (code >= 100 && code <= 599) return code;
    }
    return null;
  }

  private getPathPrefix(path: string): string {
    const parts = path.split('/');
    return parts.slice(0, Math.min(3, parts.length)).join('/');
  }
}
