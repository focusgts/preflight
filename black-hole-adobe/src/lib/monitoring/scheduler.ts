/**
 * Drift Monitoring Scheduler (ADR-035)
 *
 * A lightweight interval-based scheduler that periodically runs drift
 * checks on all monitored migrations. Uses setInterval (no cron deps).
 *
 * - Default interval: 6 hours
 * - Calls DriftMonitor.runDriftCheck() for each monitored migration
 * - Logs results to console
 * - Exports start/stop for lifecycle control
 * - Lazy-init guard prevents double-starting
 */

import {
  DriftMonitor,
  listMonitoredMigrations,
} from '@/lib/monitoring/drift-monitor';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;

/**
 * Run a single sweep: check all monitored migrations for drift.
 */
async function runAllChecks(): Promise<void> {
  const migrations = listMonitoredMigrations();

  if (migrations.length === 0) {
    console.log('[DriftScheduler] No monitored migrations — skipping sweep.');
    return;
  }

  console.log(
    `[DriftScheduler] Starting sweep for ${migrations.length} migration(s)...`,
  );

  const monitor = new DriftMonitor();

  for (const migration of migrations) {
    try {
      const check = await monitor.runDriftCheck(migration.migrationId);
      console.log(
        `[DriftScheduler] ${migration.migrationId} — drift: ${check.driftScore}, alert: ${check.alertLevel}, changes: ${check.changes.length}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[DriftScheduler] Failed check for "${migration.migrationId}": ${message}`,
      );
    }
  }

  console.log('[DriftScheduler] Sweep complete.');
}

/**
 * Start the scheduler. Safe to call multiple times — will only start once.
 *
 * @param intervalMs - Check interval in milliseconds (default: 6 hours)
 */
export function startScheduler(intervalMs: number = SIX_HOURS_MS): void {
  if (started) return;
  started = true;

  console.log(
    `[DriftScheduler] Started — checking every ${Math.round(intervalMs / 60000)} minutes.`,
  );

  intervalHandle = setInterval(() => {
    runAllChecks().catch((err) => {
      console.error('[DriftScheduler] Unhandled error during sweep:', err);
    });
  }, intervalMs);
}

/**
 * Stop the scheduler and allow it to be restarted.
 */
export function stopScheduler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  started = false;
  console.log('[DriftScheduler] Stopped.');
}

/**
 * Check whether the scheduler is currently running.
 */
export function isSchedulerRunning(): boolean {
  return started;
}
