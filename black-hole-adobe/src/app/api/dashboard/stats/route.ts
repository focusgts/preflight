/**
 * GET /api/dashboard/stats — Dashboard statistics
 *
 * Aggregates real data from the store to power the overview dashboard.
 * Returns stats, chart data, readiness scores, and recent activity
 * in the shapes expected by the dashboard components.
 */

import { success, error } from '@/lib/api/response';
import {
  listMigrations,
  listAssessments,
  listConnectors,
} from '@/lib/api/store';
import { MigrationStatus, MigrationType } from '@/types';
import type { MigrationProject, AssessmentResult } from '@/types';

/** Human-readable labels for migration types. */
const MIGRATION_TYPE_LABELS: Record<string, string> = {
  [MigrationType.AEM_ONPREM_TO_CLOUD]: 'AEM On-Prem to Cloud',
  [MigrationType.AEM_AMS_TO_CLOUD]: 'AEM AMS to Cloud',
  [MigrationType.AEM_VERSION_UPGRADE]: 'AEM Version Upgrade',
  [MigrationType.AEM_TO_EDS]: 'AEM to Edge Delivery',
  [MigrationType.WORDPRESS_TO_AEM]: 'WordPress to AEM',
  [MigrationType.SITECORE_TO_AEM]: 'Sitecore to AEM',
  [MigrationType.DRUPAL_TO_AEM]: 'Drupal to AEM',
  [MigrationType.GA_TO_ADOBE_ANALYTICS]: 'GA to Adobe Analytics',
  [MigrationType.GA_TO_CJA]: 'GA to Customer Journey Analytics',
  [MigrationType.ANALYTICS_TO_CJA]: 'Analytics to CJA',
  [MigrationType.CAMPAIGN_STD_TO_V8]: 'Campaign Standard to v8',
  [MigrationType.CAMPAIGN_CLASSIC_TO_V8]: 'Campaign Classic to v8',
  [MigrationType.SFMC_TO_ADOBE]: 'SFMC to Adobe',
  [MigrationType.AAM_TO_RTCDP]: 'AAM to Real-Time CDP',
  [MigrationType.COMPETITOR_CDP_TO_AEP]: 'CDP to AEP',
  [MigrationType.SHOPIFY_TO_COMMERCE]: 'Shopify to Commerce',
  [MigrationType.SFCC_TO_COMMERCE]: 'SFCC to Commerce',
  [MigrationType.DAM_TO_AEM_ASSETS]: 'DAM to AEM Assets',
  [MigrationType.JIRA_TO_WORKFRONT]: 'Jira to Workfront',
  [MigrationType.OPTIMIZELY_TO_TARGET]: 'Optimizely to Target',
  [MigrationType.HUBSPOT_TO_MARKETO]: 'HubSpot to Marketo',
  [MigrationType.CUSTOM]: 'Custom Migration',
};

/** Statuses considered "active" (in-flight, not terminal). */
const ACTIVE_STATUSES = new Set([
  MigrationStatus.ASSESSING,
  MigrationStatus.ASSESSED,
  MigrationStatus.PLANNING,
  MigrationStatus.PLANNED,
  MigrationStatus.TRANSFORMING,
  MigrationStatus.EXECUTING,
  MigrationStatus.VALIDATING,
]);

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function buildDashboardStats(migrations: MigrationProject[], assessments: AssessmentResult[]) {
  const total = migrations.length;
  const active = migrations.filter((m) => ACTIVE_STATUSES.has(m.status)).length;
  const completed = migrations.filter((m) => m.status === MigrationStatus.COMPLETED).length;

  // Total items migrated — sum estimatedCost as proxy (no per-item count on MigrationProject)
  // Use the totalItemsMigrated concept: sum progress * estimated items when available
  const totalItemsMigrated = 0;

  // Average time savings from assessments
  let averageTimeSavings = 0;
  let averageCostSavings = 0;
  if (assessments.length > 0) {
    const timeSavings = assessments
      .filter((a) => a.traditionalEstimate?.timeSavingsPercent != null)
      .map((a) => a.traditionalEstimate!.timeSavingsPercent);
    const costSavings = assessments
      .filter((a) => a.traditionalEstimate?.costSavingsPercent != null)
      .map((a) => a.traditionalEstimate!.costSavingsPercent);

    if (timeSavings.length > 0) {
      averageTimeSavings = Math.round(
        timeSavings.reduce((sum, v) => sum + v, 0) / timeSavings.length,
      );
    }
    if (costSavings.length > 0) {
      averageCostSavings = Math.round(
        costSavings.reduce((sum, v) => sum + v, 0) / costSavings.length,
      );
    }
  }

  // Top migration types by count
  const typeCounts = new Map<string, number>();
  for (const m of migrations) {
    typeCounts.set(m.migrationType, (typeCounts.get(m.migrationType) ?? 0) + 1);
  }
  const topMigrationTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({
      type,
      count,
      label: MIGRATION_TYPE_LABELS[type] ?? type,
    }));

  return {
    totalMigrations: total,
    activeMigrations: active,
    completedMigrations: completed,
    totalItemsMigrated,
    averageTimeSavings,
    averageCostSavings,
    topMigrationTypes,
    recentActivity: [] as Array<Record<string, unknown>>,
  };
}

function buildRecentActivity(migrations: MigrationProject[], limit = 10) {
  // Generate activity entries from migrations sorted by updatedAt desc
  const sorted = [...migrations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

  return sorted.map((m, i) => ({
    id: `act-${m.id}-${i}`,
    migrationId: m.id,
    migrationName: m.name,
    action: describeAction(m.status),
    timestamp: m.updatedAt,
    details: describeDetails(m),
  }));
}

function describeAction(status: MigrationStatus): string {
  switch (status) {
    case MigrationStatus.DRAFT:
      return 'Migration created';
    case MigrationStatus.ASSESSING:
      return 'Assessment initiated';
    case MigrationStatus.ASSESSED:
      return 'Assessment completed';
    case MigrationStatus.PLANNING:
      return 'Planning phase started';
    case MigrationStatus.PLANNED:
      return 'Planning phase completed';
    case MigrationStatus.TRANSFORMING:
      return 'Asset transformation in progress';
    case MigrationStatus.EXECUTING:
      return 'Content batch migrated';
    case MigrationStatus.VALIDATING:
      return 'Validation phase started';
    case MigrationStatus.COMPLETED:
      return 'Migration completed';
    case MigrationStatus.FAILED:
      return 'Migration failed';
    case MigrationStatus.CANCELLED:
      return 'Migration cancelled';
    default:
      return 'Status updated';
  }
}

function describeDetails(m: MigrationProject): string {
  const pct = m.progress ?? 0;
  if (m.status === MigrationStatus.COMPLETED) {
    return `Migration completed successfully. Progress: 100%.`;
  }
  if (m.status === MigrationStatus.FAILED) {
    return `Migration encountered an error at ${pct}% progress.`;
  }
  return `Progress: ${pct}%. Target completion: ${m.targetCompletionDate ? new Date(m.targetCompletionDate).toLocaleDateString() : 'TBD'}.`;
}

function buildChartData(migrations: MigrationProject[]) {
  // Group migrations by the month they were created, last 6 months
  const now = new Date();
  const months: { month: string; migrations: number; completed: number; items: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
    const monthStart = d.getTime();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();

    const created = migrations.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= monthStart && t < monthEnd;
    });
    const completedInMonth = migrations.filter((m) => {
      if (!m.completedAt) return false;
      const t = new Date(m.completedAt).getTime();
      return t >= monthStart && t < monthEnd;
    });

    months.push({
      month: monthLabel,
      migrations: created.length,
      completed: completedInMonth.length,
      items: 0,
    });
  }

  return months;
}

function buildReadinessScores(assessments: AssessmentResult[]) {
  if (assessments.length === 0) return [];

  // Collect per-category scores across all assessments and average them
  const categories: { key: string; product: string; scores: number[] }[] = [
    { key: 'codeCompatibilityScore', product: 'Code Compatibility', scores: [] },
    { key: 'contentReadinessScore', product: 'Content Readiness', scores: [] },
    { key: 'integrationComplexityScore', product: 'Integration', scores: [] },
    { key: 'configurationReadinessScore', product: 'Configuration', scores: [] },
    { key: 'complianceScore', product: 'Compliance', scores: [] },
  ];

  for (const a of assessments) {
    for (const cat of categories) {
      const val = (a as unknown as Record<string, unknown>)[cat.key];
      if (typeof val === 'number') {
        cat.scores.push(val);
      }
    }
  }

  return categories
    .filter((c) => c.scores.length > 0)
    .map((c) => ({
      product: c.product,
      score: Math.round(c.scores.reduce((s, v) => s + v, 0) / c.scores.length),
    }));
}

// ---------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------

export async function GET() {
  try {
    const migrations = listMigrations();
    const assessments = listAssessments();
    listConnectors(); // called for future use; connectors not surfaced yet

    const stats = buildDashboardStats(migrations, assessments);
    const activity = buildRecentActivity(migrations);
    const chartData = buildChartData(migrations);
    const readinessScores = buildReadinessScores(assessments);

    console.log(
      `[API] GET /api/dashboard/stats — ${migrations.length} migrations, ${assessments.length} assessments`,
    );

    return success({
      stats,
      chartData,
      activity,
      readinessScores,
    });
  } catch (err) {
    console.error('[API] GET /api/dashboard/stats — error:', err);
    return error('DASHBOARD_STATS_ERROR', 'Failed to aggregate dashboard statistics', 500);
  }
}
