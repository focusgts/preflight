/**
 * Black Hole - Migration Orchestrator
 *
 * Manages the full migration lifecycle from assessment through validation
 * and monitoring. Coordinates the Ingest, Sort, Distribute, Assessment,
 * and Validation engines into a cohesive workflow with phase management,
 * progress events, and error recovery.
 */

import { v4 as uuid } from 'uuid';
import {
  MigrationStatus,
  PhaseType,
} from '@/types';
import type {
  MigrationProject,
  MigrationPhase,
  MigrationItem,
} from '@/types';
import { IngestEngine, type IngestResult, type SourceConnector } from './ingest';
import { SortEngine, type ClassificationResult } from './sort';
import { DistributeEngine, type RouteResult } from './distribute';
import {
  AssessmentEngine,
  type ContentAnalysisInput,
  type IntegrationInput,
} from './assessment';
import { ValidationEngine, type ValidationReport } from './validator';

// ============================================================
// Types
// ============================================================

export type MigrationEventType =
  | 'phase:start'
  | 'phase:complete'
  | 'phase:error'
  | 'item:processed'
  | 'progress:update'
  | 'migration:complete'
  | 'migration:failed';

export interface MigrationEvent {
  type: MigrationEventType;
  migrationId: string;
  phase?: PhaseType;
  data: Record<string, unknown>;
  timestamp: string;
}

export type MigrationEventHandler = (event: MigrationEvent) => void;

export interface OrchestratorOptions {
  /** Maximum concurrent items to process within a phase. */
  concurrency: number;
  /** Whether to continue on non-critical errors. */
  continueOnError: boolean;
  /** Maximum retries for failed items. */
  maxRetries: number;
}

export interface MigrationProgress {
  migrationId: string;
  status: MigrationStatus;
  overallPercent: number;
  currentPhase: PhaseType | null;
  phases: PhaseProgress[];
  startedAt: string;
  updatedAt: string;
}

export interface PhaseProgress {
  phase: PhaseType;
  status: MigrationStatus;
  percent: number;
  itemsTotal: number;
  itemsCompleted: number;
  itemsFailed: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface MigrationState {
  project: MigrationProject;
  items: MigrationItem[];
  classifications: Map<string, ClassificationResult>;
  routes: Map<string, RouteResult>;
  progress: MigrationProgress;
  errors: MigrationPhaseError[];
}

export interface MigrationPhaseError {
  phase: PhaseType;
  itemId: string | null;
  message: string;
  recoverable: boolean;
  timestamp: string;
}

// ============================================================
// Phase Order Definition
// ============================================================

const PHASE_ORDER: PhaseType[] = [
  PhaseType.ASSESSMENT,
  PhaseType.PLANNING,
  PhaseType.CODE_MODERNIZATION,
  PhaseType.CONTENT_MIGRATION,
  PhaseType.INTEGRATION_RECONNECTION,
  PhaseType.TESTING,
  PhaseType.CUTOVER,
  PhaseType.MONITORING,
];

/** Phases that can run concurrently with each other. */
const PARALLEL_PHASES = new Set<PhaseType>([
  PhaseType.CODE_MODERNIZATION,
  PhaseType.CONTENT_MIGRATION,
  PhaseType.INTEGRATION_RECONNECTION,
]);

// ============================================================
// Engine
// ============================================================

const DEFAULT_OPTIONS: OrchestratorOptions = {
  concurrency: 10,
  continueOnError: true,
  maxRetries: 2,
};

export class MigrationOrchestrator {
  private readonly options: OrchestratorOptions;
  private readonly ingestEngine: IngestEngine;
  private readonly sortEngine: SortEngine;
  private readonly distributeEngine: DistributeEngine;
  private readonly assessmentEngine: AssessmentEngine;
  private readonly validationEngine: ValidationEngine;

  private migrations = new Map<string, MigrationState>();
  private eventHandlers: MigrationEventHandler[] = [];

  constructor(
    options: Partial<OrchestratorOptions> = {},
    deps?: {
      ingestEngine?: IngestEngine;
      sortEngine?: SortEngine;
      distributeEngine?: DistributeEngine;
      assessmentEngine?: AssessmentEngine;
      validationEngine?: ValidationEngine;
    },
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.ingestEngine = deps?.ingestEngine ?? new IngestEngine();
    this.sortEngine = deps?.sortEngine ?? new SortEngine();
    this.distributeEngine = deps?.distributeEngine ?? new DistributeEngine();
    this.assessmentEngine = deps?.assessmentEngine ?? new AssessmentEngine();
    this.validationEngine = deps?.validationEngine ?? new ValidationEngine();
  }

  // ----------------------------------------------------------
  // Event Emitter
  // ----------------------------------------------------------

  /**
   * Register a handler for migration events.
   */
  on(handler: MigrationEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(event: MigrationEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Event handlers should not break the orchestrator
      }
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Create a new migration from a project definition and ingested items.
   */
  async createMigration(
    project: MigrationProject,
    connector?: SourceConnector,
    rawItems?: MigrationItem[],
  ): Promise<string> {
    let items: MigrationItem[] = rawItems ?? [];

    // Ingest from connector if provided
    if (connector) {
      const result: IngestResult = await this.ingestEngine.ingestFromConnector(connector);
      items = [...items, ...result.items];
    }

    const migrationId = project.id || uuid();

    const progress: MigrationProgress = {
      migrationId,
      status: MigrationStatus.DRAFT,
      overallPercent: 0,
      currentPhase: null,
      phases: PHASE_ORDER.map((phase) => ({
        phase,
        status: MigrationStatus.DRAFT,
        percent: 0,
        itemsTotal: 0,
        itemsCompleted: 0,
        itemsFailed: 0,
        startedAt: null,
        completedAt: null,
      })),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.migrations.set(migrationId, {
      project: { ...project, id: migrationId },
      items,
      classifications: new Map(),
      routes: new Map(),
      progress,
      errors: [],
    });

    return migrationId;
  }

  /**
   * Run the assessment phase: classify items, analyze code/content,
   * and produce the assessment result.
   */
  async startAssessment(
    migrationId: string,
    contentInput: ContentAnalysisInput,
    integrationInputs: IntegrationInput[],
  ): Promise<void> {
    const state = this.getState(migrationId);
    this.beginPhase(state, PhaseType.ASSESSMENT);

    try {
      // Classify all items
      const classifications = await this.sortEngine.classifyBatch(state.items);
      for (const c of classifications) {
        state.classifications.set(c.itemId, c);
      }

      this.updatePhaseProgress(state, PhaseType.ASSESSMENT, 50);

      // Run full assessment
      const result = await this.assessmentEngine.runAssessment(
        state.project,
        state.items,
        contentInput,
        integrationInputs,
      );

      // Update project with assessment
      state.project.assessment = result;
      state.project.riskScore = result.riskFactors.length > 0
        ? result.riskFactors[0].probability
        : 0;
      state.project.estimatedDurationWeeks = result.estimatedTimeline.totalWeeks;
      state.project.estimatedCost = result.estimatedCost.totalEstimate;

      this.completePhase(state, PhaseType.ASSESSMENT);
    } catch (err) {
      this.failPhase(state, PhaseType.ASSESSMENT, err);
      throw err;
    }
  }

  /**
   * Run the transformation phase: apply auto-fixes and route items.
   */
  async startTransformation(migrationId: string): Promise<void> {
    const state = this.getState(migrationId);

    // Run parallel phases: code modernization, content migration, integration
    const parallelPhases = [
      PhaseType.CODE_MODERNIZATION,
      PhaseType.CONTENT_MIGRATION,
      PhaseType.INTEGRATION_RECONNECTION,
    ];

    // Start planning first
    this.beginPhase(state, PhaseType.PLANNING);
    try {
      // Route all items
      const routeResults = await this.distributeEngine.routeBatch(
        state.items,
        state.classifications,
      );

      for (const route of routeResults) {
        state.routes.set(route.itemId, route);
      }

      this.completePhase(state, PhaseType.PLANNING);
    } catch (err) {
      this.failPhase(state, PhaseType.PLANNING, err);
      throw err;
    }

    // Run parallel transformation phases
    const parallelPromises = parallelPhases.map((phase) =>
      this.runTransformationPhase(state, phase),
    );

    const results = await Promise.allSettled(parallelPromises);

    // Check for failures
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const reason = (results[i] as PromiseRejectedResult).reason;
        if (!this.options.continueOnError) {
          throw reason instanceof Error ? reason : new Error(String(reason));
        }
      }
    }
  }

  /**
   * Run the execution / cutover phase.
   */
  async startExecution(migrationId: string): Promise<void> {
    const state = this.getState(migrationId);
    this.beginPhase(state, PhaseType.CUTOVER);

    try {
      const totalItems = state.items.length;
      let processed = 0;

      // Process items in batches
      const batchSize = this.options.concurrency;
      for (let i = 0; i < totalItems; i += batchSize) {
        const batch = state.items.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (item) => {
            const route = state.routes.get(item.id);
            if (!route || !route.validated) {
              item.status = 'skipped';
              return;
            }

            try {
              item.targetPath = route.targetPath;
              item.status = 'completed';
              item.processedAt = new Date().toISOString();
            } catch (err) {
              item.status = 'failed';
              item.error = err instanceof Error ? err.message : String(err);
            }

            processed++;
            this.emit({
              type: 'item:processed',
              migrationId,
              phase: PhaseType.CUTOVER,
              data: { itemId: item.id, status: item.status },
              timestamp: new Date().toISOString(),
            });
          }),
        );

        this.updatePhaseProgress(
          state,
          PhaseType.CUTOVER,
          Math.round((processed / totalItems) * 100),
        );
      }

      this.completePhase(state, PhaseType.CUTOVER);
    } catch (err) {
      this.failPhase(state, PhaseType.CUTOVER, err);
      throw err;
    }
  }

  /**
   * Run validation on completed migration items.
   */
  async startValidation(migrationId: string): Promise<ValidationReport> {
    const state = this.getState(migrationId);
    this.beginPhase(state, PhaseType.TESTING);

    try {
      const completedItems = state.items.filter((i) => i.status === 'completed');

      const report = await this.validationEngine.generateValidationReport(
        completedItems,
        state.items,
      );

      // Update items with validation results
      for (const item of completedItems) {
        const contentResult = await this.validationEngine.validateContent(item, state.items);
        item.validationResult = contentResult;
      }

      this.completePhase(state, PhaseType.TESTING);

      // If all phases complete, mark migration done
      const allDone = state.progress.phases.every(
        (p) =>
          p.status === MigrationStatus.COMPLETED ||
          p.status === MigrationStatus.FAILED,
      );

      if (allDone) {
        state.progress.status = MigrationStatus.COMPLETED;
        state.project.status = MigrationStatus.COMPLETED;
        state.project.completedAt = new Date().toISOString();

        this.emit({
          type: 'migration:complete',
          migrationId,
          data: { overallPercent: 100 },
          timestamp: new Date().toISOString(),
        });
      }

      return report;
    } catch (err) {
      this.failPhase(state, PhaseType.TESTING, err);
      throw err;
    }
  }

  /**
   * Get current migration progress.
   */
  getProgress(migrationId: string): MigrationProgress {
    const state = this.migrations.get(migrationId);
    if (!state) {
      throw new OrchestratorError(`Migration ${migrationId} not found`);
    }
    return { ...state.progress };
  }

  /**
   * Get the full migration project state.
   */
  getProject(migrationId: string): MigrationProject {
    const state = this.getState(migrationId);
    return { ...state.project };
  }

  /**
   * Get errors for a migration.
   */
  getErrors(migrationId: string): MigrationPhaseError[] {
    const state = this.getState(migrationId);
    return [...state.errors];
  }

  /**
   * Cancel a migration in progress.
   */
  cancel(migrationId: string): void {
    const state = this.getState(migrationId);
    state.progress.status = MigrationStatus.CANCELLED;
    state.project.status = MigrationStatus.CANCELLED;
    state.progress.updatedAt = new Date().toISOString();
  }

  // ----------------------------------------------------------
  // Internal Phase Management
  // ----------------------------------------------------------

  private async runTransformationPhase(
    state: MigrationState,
    phase: PhaseType,
  ): Promise<void> {
    this.beginPhase(state, phase);

    try {
      // Filter items relevant to this phase
      const phaseItems = this.getPhaseItems(state, phase);
      let processed = 0;

      for (const item of phaseItems) {
        const classification = state.classifications.get(item.id);
        if (!classification) continue;

        let retries = 0;
        let success = false;

        while (retries <= this.options.maxRetries && !success) {
          try {
            // Simulate transformation based on classification
            if (classification.compatibilityLevel === 'auto_fixable') {
              item.autoFixed = true;
            }
            item.status = 'processing';
            // Mark as completed for this phase
            item.status = 'completed';
            item.processedAt = new Date().toISOString();
            success = true;
          } catch (err) {
            retries++;
            if (retries > this.options.maxRetries) {
              item.status = 'failed';
              item.error = err instanceof Error ? err.message : String(err);
              state.errors.push({
                phase,
                itemId: item.id,
                message: item.error,
                recoverable: false,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        processed++;
        this.updatePhaseProgress(
          state,
          phase,
          Math.round((processed / phaseItems.length) * 100),
        );
      }

      this.completePhase(state, phase);
    } catch (err) {
      this.failPhase(state, phase, err);
      if (!this.options.continueOnError) throw err;
    }
  }

  private getPhaseItems(state: MigrationState, phase: PhaseType): MigrationItem[] {
    switch (phase) {
      case PhaseType.CODE_MODERNIZATION:
        return state.items.filter((i) =>
          i.type === 'code' || i.type === 'component',
        );
      case PhaseType.CONTENT_MIGRATION:
        return state.items.filter((i) =>
          i.type === 'page' || i.type === 'content' || i.type === 'asset',
        );
      case PhaseType.INTEGRATION_RECONNECTION:
        return state.items.filter((i) => i.type === 'config');
      default:
        return state.items;
    }
  }

  private getState(migrationId: string): MigrationState {
    const state = this.migrations.get(migrationId);
    if (!state) {
      throw new OrchestratorError(`Migration ${migrationId} not found`);
    }
    return state;
  }

  private beginPhase(state: MigrationState, phase: PhaseType): void {
    const phaseProgress = state.progress.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.status = MigrationStatus.EXECUTING;
      phaseProgress.startedAt = new Date().toISOString();
      phaseProgress.itemsTotal = this.getPhaseItems(state, phase).length;
    }

    state.progress.currentPhase = phase;
    state.progress.status = MigrationStatus.EXECUTING;
    state.progress.updatedAt = new Date().toISOString();

    this.emit({
      type: 'phase:start',
      migrationId: state.project.id,
      phase,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  private completePhase(state: MigrationState, phase: PhaseType): void {
    const phaseProgress = state.progress.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.status = MigrationStatus.COMPLETED;
      phaseProgress.percent = 100;
      phaseProgress.completedAt = new Date().toISOString();
    }

    this.recalculateOverall(state);

    this.emit({
      type: 'phase:complete',
      migrationId: state.project.id,
      phase,
      data: { percent: 100 },
      timestamp: new Date().toISOString(),
    });
  }

  private failPhase(state: MigrationState, phase: PhaseType, err: unknown): void {
    const phaseProgress = state.progress.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.status = MigrationStatus.FAILED;
      phaseProgress.completedAt = new Date().toISOString();
    }

    const message = err instanceof Error ? err.message : String(err);
    state.errors.push({
      phase,
      itemId: null,
      message,
      recoverable: this.options.continueOnError,
      timestamp: new Date().toISOString(),
    });

    this.emit({
      type: 'phase:error',
      migrationId: state.project.id,
      phase,
      data: { error: message },
      timestamp: new Date().toISOString(),
    });

    if (!this.options.continueOnError) {
      state.progress.status = MigrationStatus.FAILED;
      state.project.status = MigrationStatus.FAILED;

      this.emit({
        type: 'migration:failed',
        migrationId: state.project.id,
        data: { error: message, phase },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private updatePhaseProgress(
    state: MigrationState,
    phase: PhaseType,
    percent: number,
  ): void {
    const phaseProgress = state.progress.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.percent = percent;
      phaseProgress.itemsCompleted = Math.round(
        (percent / 100) * phaseProgress.itemsTotal,
      );
    }

    this.recalculateOverall(state);

    this.emit({
      type: 'progress:update',
      migrationId: state.project.id,
      phase,
      data: { percent },
      timestamp: new Date().toISOString(),
    });
  }

  private recalculateOverall(state: MigrationState): void {
    const totalPhases = state.progress.phases.length;
    const totalPercent = state.progress.phases.reduce(
      (sum, p) => sum + p.percent,
      0,
    );
    state.progress.overallPercent = Math.round(totalPercent / totalPhases);
    state.progress.updatedAt = new Date().toISOString();
    state.project.progress = state.progress.overallPercent;
  }
}

// ============================================================
// Error Class
// ============================================================

export class OrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestratorError';
  }
}
