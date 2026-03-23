/**
 * Self-Healing Engine
 *
 * Core engine for automatic migration failure recovery. When a migration
 * step fails, the engine diagnoses the error, queries both built-in and
 * RuVector-learned remedies, and applies fixes based on confidence levels.
 *
 * Decision logic:
 *   > 0.95 AND successCount > 10 → Auto-apply, log for audit
 *   0.80 - 0.95 → Auto-apply with notification, allow rollback
 *   0.60 - 0.80 → Suggest fix, wait for human approval
 *   < 0.60 → Escalate to human, no suggestion
 *
 * Circuit breaker: if same item fails 3+ times, stop and escalate.
 */

import { v4 as uuid } from 'uuid';
import { DiagnosticEngine } from './diagnostics';
import { RemedyLibrary } from './remedy-library';
import type { PatternMatcher } from '@/lib/ruvector/pattern-matcher';
import type { PatternRecorder } from '@/lib/ruvector/pattern-recorder';
import type { MigrationItem } from '@/types';
import type {
  Diagnosis,
  HealingAction,
  HealingActionType,
  HealingActionResult,
  HealingReport,
  RemedyMatch,
  RemedyTarget,
  RemedyContext,
  CircuitBreakerState,
  CONFIDENCE_THRESHOLDS as ConfThresholds,
} from '@/types/healing';
import {
  CONFIDENCE_THRESHOLDS,
  CIRCUIT_BREAKER_LIMIT,
} from '@/types/healing';

// ============================================================
// Types
// ============================================================

export interface HealingEngineOptions {
  /** Enable auto-apply for high-confidence remedies. */
  autoApplyEnabled: boolean;
  /** Maximum retry attempts after applying a remedy. */
  maxRetryAfterFix: number;
  /** Callback when a fix is auto-applied. */
  onAutoApply?: (action: HealingAction) => void;
  /** Callback when a fix needs approval. */
  onSuggestion?: (action: HealingAction) => void;
  /** Callback when an item is escalated. */
  onEscalation?: (action: HealingAction) => void;
}

export interface HealingResult {
  action: HealingAction;
  shouldRetry: boolean;
  modifiedItem: Partial<MigrationItem> | null;
}

const DEFAULT_OPTIONS: HealingEngineOptions = {
  autoApplyEnabled: true,
  maxRetryAfterFix: 1,
};

// ============================================================
// Engine
// ============================================================

export class HealingEngine {
  private readonly diagnostics: DiagnosticEngine;
  private readonly remedyLibrary: RemedyLibrary;
  private readonly options: HealingEngineOptions;

  private actions: Map<string, HealingAction[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  constructor(
    private readonly patternMatcher?: PatternMatcher,
    private readonly patternRecorder?: PatternRecorder,
    options?: Partial<HealingEngineOptions>,
  ) {
    this.diagnostics = new DiagnosticEngine();
    this.remedyLibrary = new RemedyLibrary();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Main Entry Point
  // ----------------------------------------------------------

  /**
   * Handle a migration failure. Diagnoses the error, finds remedies,
   * and either auto-applies, suggests, or escalates based on confidence.
   */
  async handleFailure(
    migrationId: string,
    phase: string,
    item: MigrationItem,
    error: Error | string,
    allItems?: MigrationItem[],
  ): Promise<HealingResult> {
    // Check circuit breaker first
    if (this.isCircuitBroken(item.id)) {
      const escalation = this.createEscalationAction(
        migrationId,
        item,
        'Circuit breaker tripped: item has failed too many times',
        null,
      );
      this.recordAction(migrationId, escalation);
      this.options.onEscalation?.(escalation);

      return {
        action: escalation,
        shouldRetry: false,
        modifiedItem: null,
      };
    }

    // Diagnose the failure
    const diagnosis = this.diagnose(error, migrationId, phase, item, allItems);

    // Find remedies from built-in library and RuVector
    const remedyMatch = await this.findRemedy(diagnosis);

    if (!remedyMatch) {
      // No remedy found — escalate
      const escalation = this.escalate(migrationId, item, diagnosis);
      return {
        action: escalation,
        shouldRetry: false,
        modifiedItem: null,
      };
    }

    // Apply based on confidence level
    return this.applyRemedy(migrationId, item, remedyMatch, diagnosis);
  }

  /**
   * Diagnose a failure to understand what went wrong.
   */
  diagnose(
    error: Error | string,
    migrationId: string,
    phase: string,
    item: MigrationItem,
    allItems?: MigrationItem[],
  ): Diagnosis {
    return this.diagnostics.analyze(error, migrationId, phase, item, allItems);
  }

  /**
   * Query both built-in remedies and RuVector for matching fixes.
   */
  async findRemedy(diagnosis: Diagnosis): Promise<RemedyMatch | null> {
    // Check built-in remedies first
    const builtinMatches = this.remedyLibrary.findRemedy(diagnosis);

    // Query RuVector for learned fixes
    let ruvectorMatches: RemedyMatch[] = [];
    if (this.patternMatcher) {
      try {
        const searchText = [
          diagnosis.errorMessage,
          ...diagnosis.patterns,
        ].join(' ');
        const fixes = await this.patternMatcher.findSimilarFixes(searchText, 3);

        ruvectorMatches = fixes
          .filter((f) => f.confidence > 0.5)
          .map((f) => ({
            remedy: {
              id: `ruvector-${uuid()}`,
              name: `Learned Fix: ${f.problem.substring(0, 50)}`,
              description: f.fix,
              errorPattern: f.problem,
              fix: () => ({
                success: f.outcome === 'success',
                modifiedItem: {},
                description: f.fix,
              }),
              confidence: f.confidence,
              successCount: Math.round(f.successRate * 100),
              failCount: Math.round((1 - f.successRate) * 100),
              autoApplicable: f.confidence > CONFIDENCE_THRESHOLDS.AUTO_WITH_NOTIFICATION,
              category: diagnosis.errorType,
              tags: ['ruvector', 'learned'],
            },
            confidence: f.confidence,
            source: 'ruvector' as const,
          }));
      } catch {
        // RuVector unavailable — continue with built-in only
      }
    }

    // Combine and sort by confidence
    const allMatches = [...builtinMatches, ...ruvectorMatches].sort(
      (a, b) => b.confidence - a.confidence,
    );

    return allMatches.length > 0 ? allMatches[0] : null;
  }

  /**
   * Apply a remedy based on confidence thresholds.
   */
  async applyRemedy(
    migrationId: string,
    item: MigrationItem,
    match: RemedyMatch,
    diagnosis: Diagnosis,
  ): Promise<HealingResult> {
    const { remedy, confidence } = match;
    const retryCount = this.getRetryCount(item.id);

    // Determine action type based on confidence
    let actionType: HealingActionType;
    let shouldRetry = false;
    let modifiedItem: Partial<MigrationItem> | null = null;

    if (
      confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY &&
      remedy.successCount > 10 &&
      this.options.autoApplyEnabled
    ) {
      // High confidence: auto-apply silently
      actionType = 'auto_applied';
      const result = await this.executeRemedy(item, remedy, diagnosis, migrationId, retryCount);
      shouldRetry = result.success;
      modifiedItem = result.success ? (result.modifiedItem as Partial<MigrationItem>) : null;

      const action = this.createAction(
        migrationId, item, diagnosis, remedy, actionType,
        result.success ? 'success' : 'failed',
        confidence, result.description, retryCount,
      );
      this.recordAction(migrationId, action);
      this.options.onAutoApply?.(action);

      // Record outcome for learning
      await this.recordOutcome(remedy.id, result.success, diagnosis);

      return { action, shouldRetry, modifiedItem };
    }

    if (
      confidence >= CONFIDENCE_THRESHOLDS.AUTO_WITH_NOTIFICATION &&
      this.options.autoApplyEnabled
    ) {
      // Medium-high confidence: auto-apply with notification
      actionType = 'auto_applied';
      const result = await this.executeRemedy(item, remedy, diagnosis, migrationId, retryCount);
      shouldRetry = result.success;
      modifiedItem = result.success ? (result.modifiedItem as Partial<MigrationItem>) : null;

      const action = this.createAction(
        migrationId, item, diagnosis, remedy, actionType,
        result.success ? 'success' : 'failed',
        confidence, result.description, retryCount,
      );
      this.recordAction(migrationId, action);
      this.options.onAutoApply?.(action);

      await this.recordOutcome(remedy.id, result.success, diagnosis);

      return { action, shouldRetry, modifiedItem };
    }

    if (confidence >= CONFIDENCE_THRESHOLDS.SUGGEST) {
      // Medium confidence: suggest and wait
      actionType = 'suggested';
      const action = this.createAction(
        migrationId, item, diagnosis, remedy, actionType,
        'pending', confidence, remedy.description, retryCount,
      );
      this.recordAction(migrationId, action);
      this.options.onSuggestion?.(action);

      return { action, shouldRetry: false, modifiedItem: null };
    }

    // Low confidence: escalate
    return {
      action: this.escalate(migrationId, item, diagnosis),
      shouldRetry: false,
      modifiedItem: null,
    };
  }

  /**
   * Escalate an item for human review.
   */
  escalate(
    migrationId: string,
    item: MigrationItem,
    diagnosis: Diagnosis,
  ): HealingAction {
    const action = this.createEscalationAction(
      migrationId,
      item,
      diagnosis.errorMessage,
      diagnosis,
    );
    this.recordAction(migrationId, action);
    this.options.onEscalation?.(action);
    return action;
  }

  /**
   * Record whether a remedy worked (feeds learning loop).
   */
  async recordOutcome(
    remedyId: string,
    success: boolean,
    diagnosis?: Diagnosis,
  ): Promise<void> {
    this.remedyLibrary.recordOutcome(remedyId, success);

    // Record to RuVector for future learning
    if (this.patternRecorder && diagnosis) {
      try {
        await this.patternRecorder.recordCodeFix(
          diagnosis.errorMessage,
          `Remedy ${remedyId} applied`,
          success ? 'success' : 'failure',
          {
            errorType: diagnosis.errorType,
            patterns: diagnosis.patterns,
            remedyId,
          },
        );
      } catch {
        // RuVector unavailable — skip recording
      }
    }
  }

  /**
   * Approve a suggested remedy and apply it.
   */
  async approveSuggestion(
    migrationId: string,
    actionId: string,
    approvedBy: string,
  ): Promise<HealingAction | null> {
    const actions = this.actions.get(migrationId);
    if (!actions) return null;

    const action = actions.find((a) => a.id === actionId);
    if (!action || action.action !== 'suggested') return null;

    action.result = 'success';
    action.resolvedAt = new Date().toISOString();
    action.resolvedBy = approvedBy;
    action.action = 'auto_applied';

    if (action.remedyId) {
      await this.recordOutcome(action.remedyId, true);
    }

    return action;
  }

  /**
   * Reject a suggested remedy.
   */
  rejectSuggestion(
    migrationId: string,
    actionId: string,
    rejectedBy: string,
  ): HealingAction | null {
    const actions = this.actions.get(migrationId);
    if (!actions) return null;

    const action = actions.find((a) => a.id === actionId);
    if (!action || action.action !== 'suggested') return null;

    action.result = 'rejected';
    action.resolvedAt = new Date().toISOString();
    action.resolvedBy = rejectedBy;

    if (action.remedyId) {
      this.remedyLibrary.recordOutcome(action.remedyId, false);
    }

    return action;
  }

  /**
   * Get the full healing report for a migration.
   */
  getHealingReport(migrationId: string): HealingReport {
    const actions = this.actions.get(migrationId) ?? [];

    const autoHealed = actions.filter(
      (a) => a.action === 'auto_applied' && a.result === 'success',
    ).length;
    const suggested = actions.filter((a) => a.action === 'suggested').length;
    const escalated = actions.filter((a) => a.action === 'escalated').length;
    const totalFailures = actions.length;
    const healingRate = totalFailures > 0 ? autoHealed / totalFailures : 0;

    return {
      migrationId,
      totalFailures,
      autoHealed,
      suggested,
      escalated,
      healingRate: Math.round(healingRate * 100) / 100,
      actions: [...actions],
      topRemedies: this.remedyLibrary.getRemedyStats().slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all actions for a migration.
   */
  getActions(migrationId: string): HealingAction[] {
    return [...(this.actions.get(migrationId) ?? [])];
  }

  /**
   * Access the remedy library directly.
   */
  getRemedyLibrary(): RemedyLibrary {
    return this.remedyLibrary;
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private async executeRemedy(
    item: MigrationItem,
    remedy: RemedyMatch['remedy'],
    diagnosis: Diagnosis,
    migrationId: string,
    retryCount: number,
  ): Promise<{ success: boolean; modifiedItem: Record<string, unknown>; description: string }> {
    const target: RemedyTarget = {
      id: item.id,
      type: item.type,
      name: item.name,
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
      error: item.error,
    };

    const context: RemedyContext = {
      migrationId,
      phase: diagnosis.context.phase,
      diagnosis,
      retryCount,
    };

    try {
      const result = await remedy.fix(target, context);
      return {
        success: result.success,
        modifiedItem: result.modifiedItem as Record<string, unknown>,
        description: result.description,
      };
    } catch (err) {
      return {
        success: false,
        modifiedItem: {},
        description: `Remedy execution failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private createAction(
    migrationId: string,
    item: MigrationItem,
    diagnosis: Diagnosis,
    remedy: RemedyMatch['remedy'],
    actionType: HealingActionType,
    result: HealingActionResult,
    confidence: number,
    fixDescription: string,
    retryCount: number,
  ): HealingAction {
    return {
      id: uuid(),
      migrationId,
      diagnosisId: diagnosis.id,
      remedyId: remedy.id,
      remedyName: remedy.name,
      itemId: item.id,
      itemName: item.name,
      action: actionType,
      result,
      confidence,
      errorMessage: diagnosis.errorMessage,
      fixDescription,
      rootCause: diagnosis.rootCause,
      severity: diagnosis.severity,
      retryCount,
      timestamp: new Date().toISOString(),
      resolvedAt: result === 'success' ? new Date().toISOString() : null,
      resolvedBy: result === 'success' ? 'auto' : null,
    };
  }

  private createEscalationAction(
    migrationId: string,
    item: MigrationItem,
    errorMessage: string,
    diagnosis: Diagnosis | null,
  ): HealingAction {
    return {
      id: uuid(),
      migrationId,
      diagnosisId: diagnosis?.id ?? '',
      remedyId: null,
      remedyName: null,
      itemId: item.id,
      itemName: item.name,
      action: 'escalated',
      result: 'pending',
      confidence: 0,
      errorMessage,
      fixDescription: null,
      rootCause: diagnosis?.rootCause ?? null,
      severity: diagnosis?.severity ?? 'high' as any,
      retryCount: this.getRetryCount(item.id),
      timestamp: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    };
  }

  private recordAction(migrationId: string, action: HealingAction): void {
    let actions = this.actions.get(migrationId);
    if (!actions) {
      actions = [];
      this.actions.set(migrationId, actions);
    }
    actions.push(action);

    // Update circuit breaker
    if (action.result !== 'success') {
      this.incrementCircuitBreaker(action.itemId);
    }
  }

  private isCircuitBroken(itemId: string): boolean {
    const state = this.circuitBreakers.get(itemId);
    return state?.tripped ?? false;
  }

  private incrementCircuitBreaker(itemId: string): void {
    let state = this.circuitBreakers.get(itemId);
    if (!state) {
      state = {
        itemId,
        failureCount: 0,
        lastFailure: new Date().toISOString(),
        tripped: false,
      };
      this.circuitBreakers.set(itemId, state);
    }

    state.failureCount++;
    state.lastFailure = new Date().toISOString();

    if (state.failureCount >= CIRCUIT_BREAKER_LIMIT) {
      state.tripped = true;
    }
  }

  private getRetryCount(itemId: string): number {
    return this.circuitBreakers.get(itemId)?.failureCount ?? 0;
  }
}
