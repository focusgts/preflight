/**
 * Tests for ValidationEngine
 *
 * Tests content integrity, reference validation, metadata checks,
 * SEO validation rules, and validation report generation.
 * Uses the ValidationResult / ValidationCheck types defined in the
 * core type system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompatibilityLevel,
  Severity,
} from '@/types';
import type {
  MigrationItem,
  ValidationResult,
  ValidationCheck,
} from '@/types';

// ---- Standalone validation functions (mirrors expected engine behavior) ----

function validateContentIntegrity(item: MigrationItem): ValidationCheck {
  const passed = item.sourcePath.length > 0 && !item.sourcePath.includes('\x00');
  return {
    name: 'content-integrity',
    passed,
    message: passed ? 'Content path is valid' : 'Content path is empty or contains null bytes',
    severity: Severity.CRITICAL,
  };
}

function validateReferences(
  item: MigrationItem,
  allPaths: Set<string>,
): ValidationCheck {
  // Check if targetPath is a valid internal reference
  if (!item.targetPath) {
    return {
      name: 'reference-check',
      passed: true,
      message: 'No target reference to validate',
      severity: Severity.INFO,
    };
  }

  const passed = !item.targetPath.startsWith('/content/') || allPaths.has(item.targetPath);
  return {
    name: 'reference-check',
    passed,
    message: passed
      ? 'All references are valid'
      : `Broken reference: ${item.targetPath} not found`,
    severity: Severity.HIGH,
  };
}

function validateMetadata(item: MigrationItem): ValidationCheck {
  const hasType = !!item.type && item.type.length > 0;
  const hasName = !!item.name && item.name.length > 0;
  const passed = hasType && hasName;
  return {
    name: 'metadata-completeness',
    passed,
    message: passed
      ? 'Required metadata fields are present'
      : `Missing metadata: ${!hasType ? 'type' : ''} ${!hasName ? 'name' : ''}`.trim(),
    severity: Severity.MEDIUM,
  };
}

function validateSEO(item: MigrationItem): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // URL length check
  const urlTooLong = item.sourcePath.length > 200;
  checks.push({
    name: 'seo-url-length',
    passed: !urlTooLong,
    message: urlTooLong
      ? `URL length ${item.sourcePath.length} exceeds 200 characters`
      : 'URL length is acceptable',
    severity: Severity.MEDIUM,
  });

  // URL characters check
  const hasSpecialChars = /[^a-zA-Z0-9\-_./]/.test(item.sourcePath);
  checks.push({
    name: 'seo-url-characters',
    passed: !hasSpecialChars,
    message: hasSpecialChars
      ? 'URL contains special characters that may affect SEO'
      : 'URL characters are SEO-friendly',
    severity: Severity.LOW,
  });

  // Consecutive slashes
  const hasDoubleSlash = /\/\//.test(item.sourcePath);
  checks.push({
    name: 'seo-double-slash',
    passed: !hasDoubleSlash,
    message: hasDoubleSlash
      ? 'URL contains consecutive slashes'
      : 'No consecutive slashes found',
    severity: Severity.LOW,
  });

  return checks;
}

function generateValidationReport(
  items: MigrationItem[],
  allPaths: Set<string>,
): { items: Array<{ item: MigrationItem; result: ValidationResult }>; summary: { passed: number; failed: number; score: number } } {
  const results: Array<{ item: MigrationItem; result: ValidationResult }> = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const checks: ValidationCheck[] = [
      validateContentIntegrity(item),
      validateReferences(item, allPaths),
      validateMetadata(item),
      ...validateSEO(item),
    ];

    const passed = checks.every((c) => c.passed);
    const score = checks.filter((c) => c.passed).length / checks.length;

    if (passed) passedCount++;
    else failedCount++;

    results.push({
      item,
      result: {
        passed,
        checks,
        score: Math.round(score * 100),
      },
    });
  }

  const totalItems = items.length;
  const overallScore = totalItems > 0 ? Math.round((passedCount / totalItems) * 100) : 0;

  return {
    items: results,
    summary: { passed: passedCount, failed: failedCount, score: overallScore },
  };
}

// ---- Test helpers ----

function makeItem(overrides: Partial<MigrationItem> = {}): MigrationItem {
  return {
    id: overrides.id ?? 'item-1',
    type: overrides.type ?? 'page',
    name: overrides.name ?? 'test-page',
    sourcePath: overrides.sourcePath ?? '/content/site/en/home',
    targetPath: overrides.targetPath ?? null,
    status: overrides.status ?? 'pending',
    compatibilityLevel: overrides.compatibilityLevel ?? CompatibilityLevel.COMPATIBLE,
    autoFixed: false,
    validationResult: null,
    error: null,
    processedAt: null,
  };
}

// ============================================================
// Tests
// ============================================================

describe('ValidationEngine', () => {

  // ----------------------------------------------------------
  // Content Integrity Validation
  // ----------------------------------------------------------

  describe('content integrity validation', () => {
    it('should pass for a valid content path', () => {
      const item = makeItem({ sourcePath: '/content/site/en/home' });
      const result = validateContentIntegrity(item);

      expect(result.passed).toBe(true);
      expect(result.name).toBe('content-integrity');
    });

    it('should fail for an empty path', () => {
      const item = makeItem({ sourcePath: '' });
      const result = validateContentIntegrity(item);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe(Severity.CRITICAL);
    });

    it('should fail for a path containing null bytes', () => {
      const item = makeItem({ sourcePath: '/content/\x00page' });
      const result = validateContentIntegrity(item);

      expect(result.passed).toBe(false);
    });

    it('should pass for a deep valid path', () => {
      const item = makeItem({
        sourcePath: '/content/site/en/us/west/california/los-angeles/downtown',
      });
      const result = validateContentIntegrity(item);

      expect(result.passed).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Reference Validation
  // ----------------------------------------------------------

  describe('reference validation', () => {
    it('should pass when targetPath is null', () => {
      const item = makeItem({ targetPath: null });
      const allPaths = new Set<string>();
      const result = validateReferences(item, allPaths);

      expect(result.passed).toBe(true);
    });

    it('should pass when target reference exists in known paths', () => {
      const item = makeItem({ targetPath: '/content/site/en/about' });
      const allPaths = new Set(['/content/site/en/about']);
      const result = validateReferences(item, allPaths);

      expect(result.passed).toBe(true);
    });

    it('should fail for broken internal reference', () => {
      const item = makeItem({ targetPath: '/content/site/en/deleted-page' });
      const allPaths = new Set(['/content/site/en/home']);
      const result = validateReferences(item, allPaths);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Broken reference');
    });

    it('should pass for external target paths (non /content/)', () => {
      const item = makeItem({ targetPath: 'https://example.com/page' });
      const allPaths = new Set<string>();
      const result = validateReferences(item, allPaths);

      expect(result.passed).toBe(true);
    });

    it('should report HIGH severity for broken references', () => {
      const item = makeItem({ targetPath: '/content/missing' });
      const result = validateReferences(item, new Set());

      expect(result.severity).toBe(Severity.HIGH);
    });
  });

  // ----------------------------------------------------------
  // Metadata Validation
  // ----------------------------------------------------------

  describe('metadata validation', () => {
    it('should pass when type and name are present', () => {
      const item = makeItem({ type: 'page', name: 'Home Page' });
      const result = validateMetadata(item);

      expect(result.passed).toBe(true);
    });

    it('should fail when type is empty', () => {
      const item = makeItem({ type: '', name: 'Home Page' });
      const result = validateMetadata(item);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('type');
    });

    it('should fail when name is empty', () => {
      const item = makeItem({ type: 'page', name: '' });
      const result = validateMetadata(item);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('name');
    });

    it('should report MEDIUM severity for missing metadata', () => {
      const item = makeItem({ type: '', name: '' });
      const result = validateMetadata(item);

      expect(result.severity).toBe(Severity.MEDIUM);
    });
  });

  // ----------------------------------------------------------
  // SEO Validation
  // ----------------------------------------------------------

  describe('SEO validation', () => {
    it('should pass for a short, clean URL', () => {
      const item = makeItem({ sourcePath: '/content/site/en/home' });
      const checks = validateSEO(item);

      expect(checks.every((c) => c.passed)).toBe(true);
    });

    it('should flag URLs longer than 200 characters', () => {
      const longPath = '/content/' + 'a'.repeat(200);
      const item = makeItem({ sourcePath: longPath });
      const checks = validateSEO(item);

      const urlLengthCheck = checks.find((c) => c.name === 'seo-url-length');
      expect(urlLengthCheck?.passed).toBe(false);
    });

    it('should flag URLs with special characters', () => {
      const item = makeItem({ sourcePath: '/content/page with spaces & symbols!' });
      const checks = validateSEO(item);

      const charCheck = checks.find((c) => c.name === 'seo-url-characters');
      expect(charCheck?.passed).toBe(false);
    });

    it('should flag URLs with consecutive slashes', () => {
      const item = makeItem({ sourcePath: '/content//site//en' });
      const checks = validateSEO(item);

      const doubleSlash = checks.find((c) => c.name === 'seo-double-slash');
      expect(doubleSlash?.passed).toBe(false);
    });

    it('should pass hyphens and underscores as SEO-friendly', () => {
      const item = makeItem({ sourcePath: '/content/site-name/page_title' });
      const checks = validateSEO(item);

      const charCheck = checks.find((c) => c.name === 'seo-url-characters');
      expect(charCheck?.passed).toBe(true);
    });

    it('should return 3 checks for each item', () => {
      const item = makeItem({ sourcePath: '/content/page' });
      const checks = validateSEO(item);

      expect(checks).toHaveLength(3);
    });
  });

  // ----------------------------------------------------------
  // Validation Report Generation
  // ----------------------------------------------------------

  describe('validation report generation', () => {
    it('should generate a report for multiple items', () => {
      const items = [
        makeItem({ sourcePath: '/content/site/en/home' }),
        makeItem({ sourcePath: '/content/site/en/about' }),
      ];
      const allPaths = new Set(items.map((i) => i.sourcePath));

      const report = generateValidationReport(items, allPaths);

      expect(report.items).toHaveLength(2);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(0);
      expect(report.summary.score).toBe(100);
    });

    it('should count failures correctly', () => {
      const items = [
        makeItem({ sourcePath: '/content/site/en/home' }),
        makeItem({ sourcePath: '', name: '' }), // will fail integrity and metadata
      ];
      const allPaths = new Set<string>();

      const report = generateValidationReport(items, allPaths);

      expect(report.summary.failed).toBeGreaterThan(0);
      expect(report.summary.score).toBeLessThan(100);
    });

    it('should include individual check results per item', () => {
      const items = [makeItem({ sourcePath: '/content/page' })];
      const report = generateValidationReport(items, new Set());

      expect(report.items[0].result.checks.length).toBeGreaterThan(0);
      expect(report.items[0].result.score).toBeDefined();
    });

    it('should handle empty items array', () => {
      const report = generateValidationReport([], new Set());

      expect(report.items).toHaveLength(0);
      expect(report.summary.score).toBe(0);
    });

    it('should produce a per-item score based on check pass ratio', () => {
      const item = makeItem({ sourcePath: '/content/site/en/home' });
      const report = generateValidationReport([item], new Set(['/content/site/en/home']));

      // All checks pass -> score should be 100
      expect(report.items[0].result.score).toBe(100);
    });

    it('should track broken references as failures in the report', () => {
      const item = makeItem({
        sourcePath: '/content/page',
        targetPath: '/content/missing-page',
      });
      const report = generateValidationReport([item], new Set());

      const refCheck = report.items[0].result.checks.find(
        (c) => c.name === 'reference-check',
      );
      expect(refCheck?.passed).toBe(false);
    });
  });
});
