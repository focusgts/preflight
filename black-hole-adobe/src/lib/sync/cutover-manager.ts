/**
 * Cutover Manager
 *
 * Manages the zero-downtime cutover process. Total content freeze time
 * is reduced from days/weeks to minutes.
 *
 * Cutover sequence:
 * 1. Final sync (capture any last changes)
 * 2. Pause source authoring briefly (minutes, not days/weeks)
 * 3. Verify all changes synced
 * 4. Switch DNS / routing           (ADR-053: CDN provider)
 * 5. CDN config: purge + SSL verify (ADR-053: CDN provider)
 * 6. Smoke test via regression       (ADR-053: regression engine)
 * 7. Go live + drift baseline        (ADR-053: drift monitor)
 */

import type {
  CutoverPlan,
  CutoverStep,
  ContentSync,
} from '@/types/sync';
import { CutoverStepStatus, SyncStatus } from '@/types/sync';
import { ContentSyncEngine, SyncError } from './content-sync-engine';
import type { CDNProvider, CDNProviderConfig } from '@/lib/deployment/cdn-manager';
import { createCDNProvider } from '@/lib/deployment/cdn-manager';
import { runRegression } from '@/lib/validation/regression-engine';
import type { RegressionConfig } from '@/lib/validation/regression-engine';
import { DriftMonitor } from '@/lib/monitoring/drift-monitor';

export interface CutoverValidation {
  passed: boolean;
  checks: CutoverCheck[];
  overallScore: number;
}

export interface CutoverCheck {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

export class CutoverManager {
  private cdnProvider: CDNProvider;
  private driftMonitor: DriftMonitor;

  constructor(
    private readonly syncEngine: ContentSyncEngine,
    cdnConfig?: CDNProviderConfig,
  ) {
    this.cdnProvider = createCDNProvider(cdnConfig);
    this.driftMonitor = new DriftMonitor();
  }

  /**
   * Replace the CDN provider at runtime (e.g. when credentials become available).
   */
  setCDNProvider(provider: CDNProvider): void {
    this.cdnProvider = provider;
  }

  /**
   * Generate a cutover plan with steps, estimated duration, and rollback plan.
   */
  planCutover(syncId: string): CutoverPlan {
    const { sync } = this.syncEngine.getSyncStatus(syncId);

    const unresolvedConflicts = sync.conflicts.filter((c) => !c.resolution).length;
    if (unresolvedConflicts > 0) {
      throw new SyncError(
        `Cannot plan cutover with ${unresolvedConflicts} unresolved conflicts. Resolve them first.`,
      );
    }

    const steps = this.buildCutoverSteps(sync);
    const rollbackSteps = this.buildRollbackSteps();
    const estimatedMinutes = steps.reduce((t, s) => t + s.estimatedDurationMinutes, 0);

    return {
      id: `cutover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      syncId,
      steps,
      estimatedDurationMinutes: estimatedMinutes,
      rollbackSteps,
      createdAt: new Date().toISOString(),
      status: CutoverStepStatus.PENDING,
      startedAt: null,
      completedAt: null,
    };
  }

  /**
   * Execute the cutover sequence step-by-step with live progress.
   */
  async executeCutover(
    plan: CutoverPlan,
    onProgress?: (step: CutoverStep, percent: number) => void,
  ): Promise<CutoverPlan> {
    plan.status = CutoverStepStatus.IN_PROGRESS;
    plan.startedAt = new Date().toISOString();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      step.status = CutoverStepStatus.IN_PROGRESS;
      step.startedAt = new Date().toISOString();

      try {
        await this.executeStep(plan.syncId, step);
        step.status = CutoverStepStatus.COMPLETED;
        step.completedAt = new Date().toISOString();
        step.actualDurationMinutes = this.minutesBetween(step.startedAt, step.completedAt);
      } catch (err) {
        step.status = CutoverStepStatus.FAILED;
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date().toISOString();
        step.actualDurationMinutes = this.minutesBetween(step.startedAt, step.completedAt);

        plan.status = CutoverStepStatus.FAILED;
        plan.completedAt = new Date().toISOString();

        // Mark remaining steps as skipped
        for (let j = i + 1; j < plan.steps.length; j++) {
          plan.steps[j].status = CutoverStepStatus.SKIPPED;
        }

        return plan;
      }

      const percent = Math.round(((i + 1) / plan.steps.length) * 100);
      onProgress?.(step, percent);
    }

    plan.status = CutoverStepStatus.COMPLETED;
    plan.completedAt = new Date().toISOString();
    return plan;
  }

  /**
   * Validate that a cutover completed successfully.
   */
  async validateCutover(plan: CutoverPlan): Promise<CutoverValidation> {
    const checks: CutoverCheck[] = [];

    // Check all steps completed
    const allComplete = plan.steps.every(
      (s) => s.status === CutoverStepStatus.COMPLETED,
    );
    checks.push({
      name: 'All cutover steps completed',
      passed: allComplete,
      message: allComplete
        ? 'All steps finished successfully'
        : `${plan.steps.filter((s) => s.status !== CutoverStepStatus.COMPLETED).length} steps did not complete`,
      critical: true,
    });

    // Verify sync is in completed or cutover state
    try {
      const { sync, health } = this.syncEngine.getSyncStatus(plan.syncId);

      const syncComplete =
        sync.status === SyncStatus.COMPLETED ||
        sync.status === SyncStatus.CUTOVER_IN_PROGRESS;
      checks.push({
        name: 'Sync status valid',
        passed: syncComplete,
        message: syncComplete
          ? `Sync is in ${sync.status} state`
          : `Sync is in unexpected ${sync.status} state`,
        critical: true,
      });

      // Check no pending changes
      const pendingChanges = sync.changeLog.filter((c) => !c.synced).length;
      checks.push({
        name: 'No pending changes',
        passed: pendingChanges === 0,
        message: pendingChanges === 0
          ? 'All changes have been synced'
          : `${pendingChanges} changes still pending`,
        critical: pendingChanges > 5,
      });

      // Check no unresolved conflicts
      const unresolvedConflicts = sync.conflicts.filter((c) => !c.resolution).length;
      checks.push({
        name: 'No unresolved conflicts',
        passed: unresolvedConflicts === 0,
        message: unresolvedConflicts === 0
          ? 'All conflicts resolved'
          : `${unresolvedConflicts} conflicts unresolved`,
        critical: true,
      });

      // Check error rate
      const errorRate = health.errorRate;
      checks.push({
        name: 'Error rate acceptable',
        passed: errorRate < 0.01,
        message: `Error rate: ${Math.round(errorRate * 100)}%`,
        critical: errorRate > 0.05,
      });
    } catch {
      checks.push({
        name: 'Sync status accessible',
        passed: false,
        message: 'Could not read sync status',
        critical: true,
      });
    }

    // Check total duration was reasonable
    if (plan.startedAt && plan.completedAt) {
      const actualMinutes = this.minutesBetween(plan.startedAt, plan.completedAt);
      const withinEstimate = actualMinutes <= plan.estimatedDurationMinutes * 1.5;
      checks.push({
        name: 'Cutover duration within estimate',
        passed: withinEstimate,
        message: `Took ${Math.round(actualMinutes)} min (estimated ${plan.estimatedDurationMinutes} min)`,
        critical: false,
      });
    }

    const passed = checks.filter((c) => c.critical).every((c) => c.passed);
    const score = (checks.filter((c) => c.passed).length / checks.length) * 100;

    return { passed, checks, overallScore: Math.round(score) };
  }

  /**
   * Undo cutover if validation fails. Executes rollback steps in reverse.
   */
  async rollbackCutover(
    plan: CutoverPlan,
    onProgress?: (step: CutoverStep, percent: number) => void,
  ): Promise<CutoverPlan> {
    for (let i = 0; i < plan.rollbackSteps.length; i++) {
      const step = plan.rollbackSteps[i];
      step.status = CutoverStepStatus.IN_PROGRESS;
      step.startedAt = new Date().toISOString();

      try {
        await this.executeRollbackStep(plan.syncId, step);
        step.status = CutoverStepStatus.COMPLETED;
        step.completedAt = new Date().toISOString();
        step.actualDurationMinutes = this.minutesBetween(step.startedAt, step.completedAt);
      } catch (err) {
        step.status = CutoverStepStatus.FAILED;
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date().toISOString();
      }

      const percent = Math.round(((i + 1) / plan.rollbackSteps.length) * 100);
      onProgress?.(step, percent);
    }

    // Reset sync to active state
    try {
      const { sync } = this.syncEngine.getSyncStatus(plan.syncId);
      if (sync.status === SyncStatus.CUTOVER_IN_PROGRESS) {
        await this.syncEngine.resumeSync(plan.syncId);
      }
    } catch {
      // Best-effort rollback
    }

    plan.status = CutoverStepStatus.FAILED;
    plan.completedAt = new Date().toISOString();
    return plan;
  }

  // ── Private Helpers ──────────────────────────────────────────────

  private buildCutoverSteps(sync: ContentSync): CutoverStep[] {
    const pendingChanges = sync.changeLog.filter((c) => !c.synced).length;
    const finalSyncMinutes = Math.max(2, Math.ceil(pendingChanges / 50));

    return [
      this.step(1, 'Final content sync', 'Capture and apply any remaining source changes', finalSyncMinutes, true),
      this.step(2, 'Pause source authoring', 'Temporarily disable content editing in the source CMS', 1, true),
      this.step(3, 'Verify sync completeness', 'Confirm all content changes have been replicated to the target', 2, true),
      this.step(4, 'Switch DNS / routing', 'Update DNS records via CDN provider to point to the target system', 3, true),
      this.step(5, 'CDN config and SSL verification', 'Purge CDN cache and verify SSL certificate for the target domain', 2, true),
      this.step(6, 'Smoke test', 'Run regression tests to confirm the target system is serving content correctly', 3, true),
      this.step(7, 'Go live', 'Mark migration as complete and capture drift monitoring baseline', 2, false),
    ];
  }

  private buildRollbackSteps(): CutoverStep[] {
    return [
      this.step(1, 'Revert DNS / routing', 'Point DNS back to the source system via CDN provider', 3, true),
      this.step(2, 'Purge CDN cache', 'Clear CDN cache after DNS revert to serve fresh content', 2, true),
      this.step(3, 'Restart forward sync', 'Resume continuous sync from source to target', 2, true),
      this.step(4, 'Verify source is live', 'Verify DNS propagation points back to the source system', 2, true),
    ];
  }

  private step(
    order: number,
    name: string,
    description: string,
    estimatedMinutes: number,
    rollbackable: boolean,
  ): CutoverStep {
    return {
      id: `step-${order}-${Math.random().toString(36).slice(2, 6)}`,
      order,
      name,
      description,
      status: CutoverStepStatus.PENDING,
      estimatedDurationMinutes: estimatedMinutes,
      actualDurationMinutes: null,
      startedAt: null,
      completedAt: null,
      error: null,
      rollbackable,
    };
  }

  private async executeStep(syncId: string, step: CutoverStep): Promise<void> {
    switch (step.order) {
      case 1: // Final sync
        await this.syncEngine.runSyncCycle(syncId);
        break;
      case 2: // Pause source authoring
        await this.syncEngine.pauseSync(syncId);
        break;
      case 3: // Verify sync completeness
        {
          const { sync } = this.syncEngine.getSyncStatus(syncId);
          const pending = sync.changeLog.filter((c) => !c.synced).length;
          if (pending > 0) {
            throw new SyncError(`${pending} changes still pending sync`);
          }
        }
        break;
      case 4: // Switch DNS via CDN provider (ADR-053)
        {
          const { sync: s4 } = this.syncEngine.getSyncStatus(syncId);
          const targetDomain = new URL(s4.targetConfig.url).hostname;
          const targetCname = `cdn.${targetDomain}`;

          const dnsResult = await this.cdnProvider.updateDNS(targetDomain, targetCname);
          if (!dnsResult.success) {
            throw new SyncError('DNS switch failed — CDN provider returned an error');
          }
        }
        break;

      case 5: // CDN config: purge cache + verify SSL (ADR-053)
        {
          const { sync: s5 } = this.syncEngine.getSyncStatus(syncId);
          const domain5 = new URL(s5.targetConfig.url).hostname;

          const purgeResult = await this.cdnProvider.purgeCache(domain5);
          if (!purgeResult.success) {
            throw new SyncError('CDN cache purge failed');
          }

          const sslResult = await this.cdnProvider.verifySSL(domain5);
          if (!sslResult.valid) {
            throw new SyncError(
              `SSL verification failed for ${domain5} — issuer: ${sslResult.issuer}`,
            );
          }
        }
        break;

      case 6: // Smoke test via regression engine (ADR-053)
        {
          const { sync: s6 } = this.syncEngine.getSyncStatus(syncId);
          const regressionConfig: RegressionConfig = {
            sourceUrl: s6.sourceConfig.url,
            targetUrl: s6.targetConfig.url,
            pageLimit: 50,
            checkSeo: true,
            checkPerformance: true,
            checkContent: true,
            excludePatterns: [],
          };

          const report = await runRegression(s6.migrationId, regressionConfig);
          if (report.summary.criticalIssues > 0) {
            throw new SyncError(
              `Smoke test found ${report.summary.criticalIssues} critical issue(s) across ${report.summary.pagesCompared} pages — aborting cutover`,
            );
          }
        }
        break;

      case 7: // Go live: finalize sync + capture drift baseline (ADR-053)
        {
          const { sync: s7 } = this.syncEngine.getSyncStatus(syncId);

          // Stop the sync engine — migration is complete
          await this.syncEngine.stopSync(syncId);

          // Capture drift monitoring baseline for post-go-live monitoring
          try {
            await this.driftMonitor.captureBaseline(
              s7.migrationId,
              s7.targetConfig.url,
            );
          } catch {
            // Non-fatal — drift monitoring baseline capture is best-effort
          }
        }
        break;
      default:
        break;
    }
  }

  private async executeRollbackStep(syncId: string, step: CutoverStep): Promise<void> {
    switch (step.order) {
      case 1: // Revert DNS — point back to source (ADR-053)
        {
          const { sync } = this.syncEngine.getSyncStatus(syncId);
          const targetDomain = new URL(sync.targetConfig.url).hostname;
          const originalCname = new URL(sync.sourceConfig.url).hostname;

          await this.cdnProvider.updateDNS(targetDomain, originalCname);
        }
        break;

      case 2: // Purge cache after DNS revert (ADR-053)
        {
          const { sync: s2 } = this.syncEngine.getSyncStatus(syncId);
          const domain = new URL(s2.targetConfig.url).hostname;
          await this.cdnProvider.purgeCache(domain);
        }
        break;

      case 3: // Restart forward sync
        {
          const { sync: s3 } = this.syncEngine.getSyncStatus(syncId);
          // If sync was completed or in cutover, resume it
          if (
            s3.status === SyncStatus.COMPLETED ||
            s3.status === SyncStatus.CUTOVER_IN_PROGRESS
          ) {
            await this.syncEngine.resumeSync(syncId);
          }
        }
        break;

      case 4: // Verify source is live — best-effort DNS check
        {
          const { sync: s4 } = this.syncEngine.getSyncStatus(syncId);
          const domain = new URL(s4.targetConfig.url).hostname;
          const expectedSource = new URL(s4.sourceConfig.url).hostname;

          const dnsCheck = await this.cdnProvider.verifyDNS(domain, expectedSource);
          if (!dnsCheck.propagated) {
            throw new SyncError(
              `DNS rollback verification failed — domain still points to ${dnsCheck.currentTarget}`,
            );
          }
        }
        break;

      default:
        break;
    }
  }

  private minutesBetween(start: string, end: string): number {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  }
}
