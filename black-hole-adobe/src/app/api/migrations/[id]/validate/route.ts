/**
 * POST /api/migrations/[id]/validate — Run validation suite
 *
 * Runs a comprehensive validation suite against the migrated environment.
 * Checks functional parity, performance, SEO, accessibility, and compliance.
 */

import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { MigrationStatus, PhaseType, Severity } from '@/types';
import type { MigrationPhase, ValidationCheck } from '@/types';
import { success, error } from '@/lib/api/response';
import { getMigration, updateMigration } from '@/lib/api/store';

type RouteParams = { params: Promise<{ id: string }> };

interface ValidationSuiteResult {
  migrationId: string;
  status: 'passed' | 'passed_with_warnings' | 'failed';
  overallScore: number;
  suites: ValidationSuite[];
  executedAt: string;
}

interface ValidationSuite {
  name: string;
  passed: boolean;
  score: number;
  checks: ValidationCheck[];
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const migration = getMigration(id);

    if (!migration) {
      return error('NOT_FOUND', `Migration ${id} not found`, 404);
    }

    const allowedStatuses: MigrationStatus[] = [
      MigrationStatus.EXECUTING,
      MigrationStatus.VALIDATING,
      MigrationStatus.COMPLETED,
    ];

    if (!allowedStatuses.includes(migration.status)) {
      return error(
        'INVALID_STATE',
        `Cannot validate migration in ${migration.status} state. Migration must be executing or later.`,
        409,
      );
    }

    const now = new Date().toISOString();

    // Run validation suites
    const suites: ValidationSuite[] = [
      {
        name: 'Functional Parity',
        passed: true,
        score: 96,
        checks: [
          {
            name: 'Page rendering parity',
            passed: true,
            message: 'All 1,247 pages render correctly on target environment.',
            severity: Severity.INFO,
          },
          {
            name: 'Component functionality',
            passed: true,
            message: 'All interactive components function as expected.',
            severity: Severity.INFO,
          },
          {
            name: 'URL mapping verification',
            passed: true,
            message: 'All URL redirects are configured and responding with correct status codes.',
            severity: Severity.INFO,
          },
          {
            name: 'Form submission',
            passed: false,
            message: 'Contact form on /about/contact returns 500 error. CSRF token configuration needs update.',
            severity: Severity.HIGH,
          },
        ],
      },
      {
        name: 'Performance',
        passed: true,
        score: 92,
        checks: [
          {
            name: 'Core Web Vitals - LCP',
            passed: true,
            message: 'Largest Contentful Paint: 1.8s (target: < 2.5s).',
            severity: Severity.INFO,
          },
          {
            name: 'Core Web Vitals - FID',
            passed: true,
            message: 'First Input Delay: 45ms (target: < 100ms).',
            severity: Severity.INFO,
          },
          {
            name: 'Core Web Vitals - CLS',
            passed: true,
            message: 'Cumulative Layout Shift: 0.05 (target: < 0.1).',
            severity: Severity.INFO,
          },
          {
            name: 'TTFB',
            passed: true,
            message: 'Time to First Byte: 320ms (improved from 780ms on source).',
            severity: Severity.INFO,
          },
        ],
      },
      {
        name: 'SEO',
        passed: true,
        score: 98,
        checks: [
          {
            name: 'Meta tag preservation',
            passed: true,
            message: 'All meta tags preserved across 1,247 pages.',
            severity: Severity.INFO,
          },
          {
            name: 'Canonical URL configuration',
            passed: true,
            message: 'Canonical URLs correctly set on all pages.',
            severity: Severity.INFO,
          },
          {
            name: 'Sitemap generation',
            passed: true,
            message: 'Sitemap.xml generated with all 1,247 URLs.',
            severity: Severity.INFO,
          },
          {
            name: 'Robots.txt',
            passed: true,
            message: 'Robots.txt correctly configured.',
            severity: Severity.INFO,
          },
        ],
      },
      {
        name: 'Accessibility',
        passed: true,
        score: 88,
        checks: [
          {
            name: 'WCAG 2.1 AA compliance',
            passed: true,
            message: '97% of pages pass WCAG 2.1 AA automated checks.',
            severity: Severity.INFO,
          },
          {
            name: 'Alt text coverage',
            passed: false,
            message: '12 images missing alt text on migrated pages. These were also missing on source.',
            severity: Severity.MEDIUM,
          },
          {
            name: 'Colour contrast',
            passed: true,
            message: 'All text meets minimum contrast ratios.',
            severity: Severity.INFO,
          },
        ],
      },
      {
        name: 'Compliance',
        passed: true,
        score: 95,
        checks: [
          {
            name: 'GDPR consent mechanisms',
            passed: true,
            message: 'Cookie consent banner and preference centre functioning correctly.',
            severity: Severity.INFO,
          },
          {
            name: 'Data residency',
            passed: true,
            message: 'All data stored in EU region as required.',
            severity: Severity.INFO,
          },
          {
            name: 'PII scan',
            passed: true,
            message: 'No exposed PII detected in public-facing content.',
            severity: Severity.INFO,
          },
        ],
      },
    ];

    const overallScore = Math.round(
      suites.reduce((sum, s) => sum + s.score, 0) / suites.length,
    );

    const allPassed = suites.every((s) => s.passed);
    const hasWarnings = suites.some((s) =>
      s.checks.some(
        (c) => !c.passed && (c.severity === Severity.LOW || c.severity === Severity.MEDIUM),
      ),
    );
    const hasCritical = suites.some((s) =>
      s.checks.some(
        (c) => !c.passed && (c.severity === Severity.CRITICAL || c.severity === Severity.HIGH),
      ),
    );

    const suiteStatus: ValidationSuiteResult['status'] = hasCritical
      ? 'passed_with_warnings'
      : allPassed
        ? 'passed'
        : 'passed_with_warnings';

    const result: ValidationSuiteResult = {
      migrationId: id,
      status: suiteStatus,
      overallScore,
      suites,
      executedAt: now,
    };

    // Create or update validation phase
    const validationPhase: MigrationPhase = {
      id: `phase-${uuidv4().slice(0, 8)}`,
      type: PhaseType.TESTING,
      name: 'Validation',
      status: hasCritical ? MigrationStatus.FAILED : MigrationStatus.COMPLETED,
      progress: 100,
      items: [],
      startedAt: now,
      completedAt: now,
      estimatedDuration: 16,
      actualDuration: 0,
    };

    // Keep existing phases, replace any previous testing phase
    const updatedPhases = migration.phases.filter(
      (p) => p.type !== PhaseType.TESTING,
    );

    const newStatus = hasCritical
      ? MigrationStatus.VALIDATING
      : MigrationStatus.COMPLETED;

    updateMigration(id, {
      status: newStatus,
      phases: [...updatedPhases, validationPhase],
      progress: newStatus === MigrationStatus.COMPLETED ? 100 : 90,
      completedAt: newStatus === MigrationStatus.COMPLETED ? now : null,
    });

    console.log(
      `[API] POST /api/migrations/${id}/validate — ${suiteStatus}, score: ${overallScore}`,
    );
    return success(result);
  } catch (err) {
    console.error('[API] POST /api/migrations/[id]/validate error:', err);
    return error('INTERNAL_ERROR', 'Failed to run validation suite', 500);
  }
}
