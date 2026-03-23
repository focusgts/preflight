/**
 * Black Hole - Simulation Engine
 *
 * Core dry-run simulation engine. Runs the entire migration pipeline
 * in-memory without touching production. Uses the same assessment,
 * sort, and validation engines but in sandbox mode.
 *
 * Zero side effects. No external calls. No mutations.
 */

import { v4 as uuid } from 'uuid';
import {
  CompatibilityLevel,
  Severity,
  PhaseType,
} from '@/types';
import type {
  MigrationItem,
  MigrationProject,
  AssessmentFinding,
  IntegrationDependency,
} from '@/types';
import type {
  Simulation,
  SimulationOptions,
  SimulationResult,
  SimulationReport,
  SimulationIssue,
  SimulationPhase,
  SimulationProgress,
  SimulationProgressCallback,
  SimulationDepth,
  ChangesSummary,
  TimelinePrediction,
  PhaseTimeline,
  ComparisonData,
} from '@/types/simulation';
import { Sandbox } from './sandbox';
import { RiskSimulator } from './risk-simulator';

// ============================================================
// Default Options
// ============================================================

const DEFAULT_OPTIONS: SimulationOptions = {
  phases: [
    'assessment',
    'code_modernization',
    'content_migration',
    'integration_reconnection',
    'validation',
  ],
  depth: 'standard',
  riskThreshold: 0.3,
  generateDiffs: true,
  validateIntegrations: true,
};

const DEPTH_MULTIPLIERS: Record<SimulationDepth, number> = {
  quick: 0.5,
  standard: 1.0,
  thorough: 2.0,
};

// ============================================================
// Engine
// ============================================================

export class SimulationEngine {
  private simulations = new Map<string, SimulationState>();
  private riskSimulator = new RiskSimulator();

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Create a new simulation run for a migration project.
   */
  createSimulation(
    migrationId: string,
    options: Partial<SimulationOptions> = {},
  ): Simulation {
    const id = `sim-${uuid().slice(0, 8)}`;
    const now = new Date().toISOString();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    const simulation: Simulation = {
      id,
      migrationId,
      status: 'pending',
      depth: mergedOptions.depth,
      options: mergedOptions,
      results: [],
      report: null,
      progress: createInitialProgress(),
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };

    this.simulations.set(id, {
      simulation,
      sandbox: new Sandbox(),
      project: null,
      items: [],
    });

    return { ...simulation };
  }

  /**
   * Execute a full simulation across all configured phases.
   * Requires the project and items to simulate against.
   */
  async runSimulation(
    simulationId: string,
    project: MigrationProject,
    items: MigrationItem[],
    onProgress?: SimulationProgressCallback,
  ): Promise<SimulationReport> {
    const state = this.getState(simulationId);
    const sim = state.simulation;

    sim.status = 'running';
    sim.startedAt = new Date().toISOString();
    state.project = project;
    state.items = JSON.parse(JSON.stringify(items)); // Deep copy

    // Initialize sandbox
    state.sandbox.createSandbox(state.items);

    try {
      const results: SimulationResult[] = [];
      const phases = sim.options.phases;

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];

        // Update progress
        sim.progress.currentPhase = phase;
        const basePercent = Math.round((i / phases.length) * 100);
        sim.progress.overallPercent = basePercent;
        onProgress?.(sim.progress);

        let result: SimulationResult;

        switch (phase) {
          case 'assessment':
            result = this.simulateAssessment(state.items, sim.options);
            break;
          case 'code_modernization':
            result = this.simulateCodeModernization(state.items, state.sandbox, sim.options);
            break;
          case 'content_migration':
            result = this.simulateContentMigration(state.items, state.sandbox, sim.options);
            break;
          case 'integration_reconnection':
            result = this.simulateIntegrationReconnection(
              project.assessment?.integrationMap ?? [],
              sim.options,
            );
            break;
          case 'validation':
            result = this.simulateValidation(state.items, state.sandbox, sim.options);
            break;
          default:
            continue;
        }

        results.push(result);
        sim.results.push(result);
        sim.progress.completedPhases.push(phase);
        sim.progress.phasePercents[phase] = 100;

        const phasePercent = Math.round(((i + 1) / phases.length) * 100);
        sim.progress.overallPercent = phasePercent;
        onProgress?.(sim.progress);
      }

      // Generate report
      const report = this.generateReport(simulationId, project, results, state.sandbox);
      sim.report = report;
      sim.status = 'completed';
      sim.completedAt = new Date().toISOString();
      sim.progress.overallPercent = 100;
      sim.progress.currentPhase = null;
      onProgress?.(sim.progress);

      return report;
    } catch (err) {
      sim.status = 'failed';
      sim.completedAt = new Date().toISOString();
      throw err;
    }
  }

  /**
   * Simulate the assessment phase.
   * Analyzes items for compatibility issues without running external tools.
   */
  simulateAssessment(
    items: MigrationItem[],
    options: SimulationOptions = DEFAULT_OPTIONS,
  ): SimulationResult {
    const issues: SimulationIssue[] = [];
    const depthMultiplier = DEPTH_MULTIPLIERS[options.depth];

    let autoFixable = 0;
    let manualFix = 0;
    let blockers = 0;

    for (const item of items) {
      switch (item.compatibilityLevel) {
        case CompatibilityLevel.AUTO_FIXABLE:
          autoFixable++;
          break;
        case CompatibilityLevel.MANUAL_FIX:
          manualFix++;
          issues.push(createIssue(
            'assessment',
            Severity.MEDIUM,
            `Manual fix required: ${item.name}`,
            `Item at ${item.sourcePath} requires manual intervention to migrate.`,
            item.sourcePath,
            'Review and apply manual fixes before migration.',
            false,
            4 * depthMultiplier,
          ));
          break;
        case CompatibilityLevel.BLOCKER:
          blockers++;
          issues.push(createIssue(
            'assessment',
            Severity.CRITICAL,
            `Migration blocker: ${item.name}`,
            `Item at ${item.sourcePath} cannot be migrated automatically.`,
            item.sourcePath,
            'Rewrite or restructure this item before migration.',
            false,
            8 * depthMultiplier,
          ));
          break;
      }
    }

    const totalIssueItems = manualFix + blockers;
    const successRate = items.length > 0 ? 1 - totalIssueItems / items.length : 1;
    const estimatedHours = issues.reduce((s, i) => s + i.estimatedHours, 0);

    return {
      phase: 'assessment',
      predictedOutcome: blockers > 0 ? 'failure' : manualFix > items.length * 0.3 ? 'partial_success' : 'success',
      confidence: this.computePhaseConfidence(items.length, options.depth, blockers),
      issuesFound: issues,
      estimatedDuration: estimatedHours,
      itemsAffected: items.length,
      itemsAutoFixable: autoFixable,
      itemsManualFix: manualFix,
      itemsBlocker: blockers,
      details: {
        successRate,
        compatibleCount: items.filter((i) => i.compatibilityLevel === CompatibilityLevel.COMPATIBLE).length,
      },
    };
  }

  /**
   * Simulate code modernization phase.
   * Generates predicted diffs without applying changes.
   */
  simulateCodeModernization(
    items: MigrationItem[],
    sandbox: Sandbox,
    options: SimulationOptions = DEFAULT_OPTIONS,
  ): SimulationResult {
    const codeItems = items.filter(
      (i) => i.type === 'code' || i.type === 'component',
    );
    const issues: SimulationIssue[] = [];
    const depthMultiplier = DEPTH_MULTIPLIERS[options.depth];

    let autoFixable = 0;
    let manualFix = 0;
    let blockers = 0;

    for (const item of codeItems) {
      // Simulate modernization in sandbox
      const targetPath = this.predictTargetPath(item);

      if (item.compatibilityLevel === CompatibilityLevel.BLOCKER) {
        blockers++;
        issues.push(createIssue(
          'code_modernization',
          Severity.CRITICAL,
          `Blocker: ${item.name} uses unsupported APIs`,
          `Source at ${item.sourcePath} cannot be auto-modernized.`,
          item.sourcePath,
          'Rewrite using Cloud Service compatible APIs.',
          false,
          16 * depthMultiplier,
        ));
        continue;
      }

      if (item.compatibilityLevel === CompatibilityLevel.MANUAL_FIX) {
        manualFix++;
        issues.push(createIssue(
          'code_modernization',
          Severity.HIGH,
          `Manual modernization: ${item.name}`,
          `Code at ${item.sourcePath} requires manual updates for Cloud Service compatibility.`,
          item.sourcePath,
          'Review and update API usage, configuration, and bundle structure.',
          false,
          8 * depthMultiplier,
        ));
      }

      if (item.compatibilityLevel === CompatibilityLevel.AUTO_FIXABLE) {
        autoFixable++;
      }

      // Apply simulated change in sandbox
      try {
        sandbox.applyChange({
          itemId: item.id,
          type: 'transform',
          updates: {
            targetPath,
            status: 'processed',
          },
          phase: 'code_modernization',
          description: `Simulated modernization of ${item.name}`,
        });
      } catch {
        // Item may not exist in sandbox if it was filtered
      }
    }

    const estimatedHours = issues.reduce((s, i) => s + i.estimatedHours, 0)
      + autoFixable * 0.5; // Auto-fixes still take some time

    return {
      phase: 'code_modernization',
      predictedOutcome: blockers > 0 ? 'failure' : manualFix > codeItems.length * 0.5 ? 'partial_success' : 'success',
      confidence: this.computePhaseConfidence(codeItems.length, options.depth, blockers),
      issuesFound: issues,
      estimatedDuration: estimatedHours,
      itemsAffected: codeItems.length,
      itemsAutoFixable: autoFixable,
      itemsManualFix: manualFix,
      itemsBlocker: blockers,
      details: {
        diffs: options.generateDiffs ? sandbox.diff() : null,
      },
    };
  }

  /**
   * Simulate content migration phase.
   * Validates references and predicts content transfer outcomes.
   */
  simulateContentMigration(
    items: MigrationItem[],
    sandbox: Sandbox,
    options: SimulationOptions = DEFAULT_OPTIONS,
  ): SimulationResult {
    const contentItems = items.filter(
      (i) => i.type === 'page' || i.type === 'content' || i.type === 'asset',
    );
    const issues: SimulationIssue[] = [];
    const depthMultiplier = DEPTH_MULTIPLIERS[options.depth];

    let autoFixable = 0;
    let manualFix = 0;
    let blockers = 0;

    // Build a path map for reference validation
    const pathMap = new Map<string, string>();
    for (const item of contentItems) {
      const targetPath = this.predictContentTargetPath(item);
      pathMap.set(item.sourcePath, targetPath);
    }

    for (const item of contentItems) {
      const targetPath = pathMap.get(item.sourcePath) ?? this.predictContentTargetPath(item);

      // Reference validation: check if this item references other items
      const referencedPaths = this.extractReferences(item);
      const brokenRefs = referencedPaths.filter((ref) => {
        const resolvedTarget = pathMap.get(ref);
        return !resolvedTarget && !ref.startsWith('http');
      });

      if (brokenRefs.length > 0) {
        issues.push(createIssue(
          'content_migration',
          Severity.MEDIUM,
          `Broken references in ${item.name}`,
          `${brokenRefs.length} internal reference(s) may break after migration.`,
          item.sourcePath,
          `Update references: ${brokenRefs.slice(0, 3).join(', ')}`,
          true,
          2 * depthMultiplier,
        ));
        autoFixable++;
      }

      if (item.compatibilityLevel === CompatibilityLevel.BLOCKER) {
        blockers++;
      } else if (item.compatibilityLevel === CompatibilityLevel.MANUAL_FIX) {
        manualFix++;
      } else {
        // Apply simulated move in sandbox
        try {
          sandbox.applyChange({
            itemId: item.id,
            type: 'move',
            updates: {
              targetPath,
              status: 'processed',
            },
            phase: 'content_migration',
            description: `Simulated content move: ${item.sourcePath} -> ${targetPath}`,
          });
        } catch {
          // Skip if item not in sandbox
        }
      }
    }

    // Size-based timing estimate
    const totalItems = contentItems.length;
    const baseHoursPerItem = 0.02; // ~30 seconds per item for content
    const estimatedHours = totalItems * baseHoursPerItem * depthMultiplier
      + issues.reduce((s, i) => s + i.estimatedHours, 0);

    return {
      phase: 'content_migration',
      predictedOutcome: blockers > 0 ? 'failure' : issues.length > totalItems * 0.2 ? 'partial_success' : 'success',
      confidence: this.computePhaseConfidence(totalItems, options.depth, blockers),
      issuesFound: issues,
      estimatedDuration: estimatedHours,
      itemsAffected: totalItems,
      itemsAutoFixable: autoFixable,
      itemsManualFix: manualFix,
      itemsBlocker: blockers,
      details: {
        totalPages: contentItems.filter((i) => i.type === 'page').length,
        totalAssets: contentItems.filter((i) => i.type === 'asset').length,
        totalContent: contentItems.filter((i) => i.type === 'content').length,
        brokenReferenceCount: issues.filter((i) => i.title.includes('reference')).length,
      },
    };
  }

  /**
   * Simulate integration reconnection phase.
   * Validates integration configs without making external calls.
   */
  simulateIntegrationReconnection(
    integrations: IntegrationDependency[],
    options: SimulationOptions = DEFAULT_OPTIONS,
  ): SimulationResult {
    const issues: SimulationIssue[] = [];
    const depthMultiplier = DEPTH_MULTIPLIERS[options.depth];

    let autoFixable = 0;
    let manualFix = 0;
    let blockers = 0;

    for (const integration of integrations) {
      // Check auth type compatibility
      const authIssue = this.checkAuthCompatibility(integration);
      if (authIssue) {
        issues.push(createIssue(
          'integration_reconnection',
          authIssue.severity,
          `Auth incompatibility: ${integration.name}`,
          authIssue.description,
          integration.name,
          authIssue.fix,
          authIssue.autoFixable,
          6 * depthMultiplier,
        ));
        if (authIssue.autoFixable) autoFixable++;
        else manualFix++;
      }

      // Check if target config is available
      if (!integration.targetConfig || Object.keys(integration.targetConfig).length === 0) {
        issues.push(createIssue(
          'integration_reconnection',
          Severity.HIGH,
          `Missing target config: ${integration.name}`,
          `Integration "${integration.name}" has no target environment configuration.`,
          integration.name,
          'Configure target endpoint and credentials before migration.',
          false,
          4 * depthMultiplier,
        ));
        manualFix++;
      }

      // Check data flow direction support
      if (integration.dataFlow === 'bidirectional' && !integration.autoMigratable) {
        issues.push(createIssue(
          'integration_reconnection',
          Severity.MEDIUM,
          `Bidirectional sync: ${integration.name}`,
          'Bidirectional data flows require careful sequencing during cutover.',
          integration.name,
          'Plan cutover window with sync pause. Test both directions independently.',
          false,
          8 * depthMultiplier,
        ));
        manualFix++;
      }

      // Critical integrations that cannot be auto-migrated
      if (integration.criticality === Severity.CRITICAL && !integration.autoMigratable) {
        blockers++;
        issues.push(createIssue(
          'integration_reconnection',
          Severity.CRITICAL,
          `Critical non-migratable integration: ${integration.name}`,
          `Critical integration "${integration.name}" cannot be auto-migrated.`,
          integration.name,
          'Manual reconfiguration required. Test thoroughly in staging.',
          false,
          16 * depthMultiplier,
        ));
      }
    }

    const estimatedHours = issues.reduce((s, i) => s + i.estimatedHours, 0);

    return {
      phase: 'integration_reconnection',
      predictedOutcome: blockers > 0 ? 'failure' : manualFix > integrations.length * 0.5 ? 'partial_success' : 'success',
      confidence: this.computePhaseConfidence(integrations.length, options.depth, blockers),
      issuesFound: issues,
      estimatedDuration: estimatedHours,
      itemsAffected: integrations.length,
      itemsAutoFixable: autoFixable,
      itemsManualFix: manualFix,
      itemsBlocker: blockers,
      details: {
        integrationCount: integrations.length,
        autoMigratableCount: integrations.filter((i) => i.autoMigratable).length,
      },
    };
  }

  /**
   * Simulate the validation phase.
   * Run validation checks against the simulated sandbox state.
   */
  simulateValidation(
    items: MigrationItem[],
    sandbox: Sandbox,
    options: SimulationOptions = DEFAULT_OPTIONS,
  ): SimulationResult {
    const issues: SimulationIssue[] = [];
    const depthMultiplier = DEPTH_MULTIPLIERS[options.depth];
    const sandboxValidation = sandbox.validate();
    const sandboxDiff = sandbox.diff();

    let autoFixable = 0;
    let manualFix = 0;
    let blockers = 0;

    // Check sandbox integrity
    if (!sandboxValidation.valid) {
      for (const err of sandboxValidation.errors) {
        blockers++;
        issues.push(createIssue(
          'validation',
          Severity.CRITICAL,
          'Sandbox integrity failure',
          err,
          'sandbox',
          'Review and fix the underlying data integrity issue.',
          false,
          4 * depthMultiplier,
        ));
      }
    }

    for (const warning of sandboxValidation.warnings) {
      issues.push(createIssue(
        'validation',
        Severity.MEDIUM,
        'Sandbox validation warning',
        warning,
        'sandbox',
        'Review the warning and assess impact.',
        true,
        1 * depthMultiplier,
      ));
      autoFixable++;
    }

    // Check for items that were not processed
    const unprocessed = items.filter((item) => {
      const sandboxItem = sandbox.getItem(item.id);
      return sandboxItem && sandboxItem.status === 'pending';
    });

    if (unprocessed.length > 0) {
      issues.push(createIssue(
        'validation',
        Severity.HIGH,
        `${unprocessed.length} items not processed`,
        'Some items were not touched during simulation. They may be skipped during real migration.',
        'multiple',
        'Review unprocessed items and determine if they should be included.',
        false,
        2 * depthMultiplier,
      ));
      manualFix++;
    }

    // Check for path collisions in modified items
    const targetPaths = sandboxDiff.modified
      .map((m) => m.changes['targetPath']?.to as string)
      .filter(Boolean);
    const pathSet = new Set<string>();
    const collisions: string[] = [];
    for (const path of targetPaths) {
      if (pathSet.has(path)) collisions.push(path);
      pathSet.add(path);
    }

    if (collisions.length > 0) {
      issues.push(createIssue(
        'validation',
        Severity.CRITICAL,
        `${collisions.length} target path collision(s)`,
        `Multiple items targeting the same path: ${collisions.slice(0, 3).join(', ')}`,
        collisions[0],
        'Rename conflicting target paths.',
        true,
        1 * depthMultiplier,
      ));
      blockers++;
    }

    const estimatedHours = issues.reduce((s, i) => s + i.estimatedHours, 0);

    return {
      phase: 'validation',
      predictedOutcome: blockers > 0 ? 'failure' : issues.length > 5 ? 'partial_success' : 'success',
      confidence: this.computePhaseConfidence(items.length, options.depth, blockers),
      issuesFound: issues,
      estimatedDuration: estimatedHours,
      itemsAffected: items.length,
      itemsAutoFixable: autoFixable,
      itemsManualFix: manualFix,
      itemsBlocker: blockers,
      details: {
        sandboxValid: sandboxValidation.valid,
        totalChanges: sandboxDiff.totalChanges,
        unprocessedCount: unprocessed.length,
        collisionCount: collisions.length,
      },
    };
  }

  /**
   * Get the simulation report for a completed simulation.
   */
  getSimulationReport(simulationId: string): SimulationReport | null {
    const state = this.simulations.get(simulationId);
    if (!state) return null;
    return state.simulation.report ? { ...state.simulation.report } : null;
  }

  /**
   * Get the simulation data.
   */
  getSimulation(simulationId: string): Simulation | null {
    const state = this.simulations.get(simulationId);
    if (!state) return null;
    return { ...state.simulation };
  }

  /**
   * List all simulations, optionally filtered by migration ID.
   */
  listSimulations(migrationId?: string): Simulation[] {
    const all = Array.from(this.simulations.values()).map((s) => ({
      ...s.simulation,
    }));
    if (migrationId) {
      return all.filter((s) => s.migrationId === migrationId);
    }
    return all;
  }

  /**
   * After the real migration completes, compare simulation predictions
   * against actual results.
   */
  compareWithActual(
    simulationId: string,
    actual: {
      duration: number;
      issueCount: number;
      successRate: number;
    },
  ): ComparisonData | null {
    const state = this.simulations.get(simulationId);
    if (!state || !state.simulation.report) return null;

    const report = state.simulation.report;
    const predictedDuration = report.timelinePrediction.estimatedWeeks;
    const predictedIssueCount = report.phaseBreakdowns.reduce(
      (s, r) => s + r.issuesFound.length,
      0,
    );
    const predictedSuccessRate = report.overallConfidence * 100;

    // Accuracy = inverse of average deviation
    const durationAccuracy = 1 - Math.abs(predictedDuration - actual.duration) / Math.max(predictedDuration, actual.duration, 1);
    const issueAccuracy = 1 - Math.abs(predictedIssueCount - actual.issueCount) / Math.max(predictedIssueCount, actual.issueCount, 1);
    const successAccuracy = 1 - Math.abs(predictedSuccessRate - actual.successRate) / 100;
    const accuracyScore = Math.round(((durationAccuracy + issueAccuracy + successAccuracy) / 3) * 100);

    const comparison: ComparisonData = {
      predictedDuration,
      actualDuration: actual.duration,
      predictedIssueCount,
      actualIssueCount: actual.issueCount,
      predictedSuccessRate,
      actualSuccessRate: actual.successRate,
      accuracyScore,
    };

    report.comparisonData = comparison;
    return comparison;
  }

  // ----------------------------------------------------------
  // Report Generation
  // ----------------------------------------------------------

  private generateReport(
    simulationId: string,
    project: MigrationProject,
    results: SimulationResult[],
    sandbox: Sandbox,
  ): SimulationReport {
    const risks = this.riskSimulator.predictRisks(results);
    const confidence = this.riskSimulator.calculateConfidence(results);
    const recommendations = this.riskSimulator.generateMitigationPlan(risks);

    const overallPrediction = this.computeOverallPrediction(results, confidence);
    const changesSummary = this.computeChangesSummary(results, sandbox);
    const timelinePrediction = this.computeTimeline(results);

    return {
      simulationId,
      migrationId: project.id,
      overallPrediction,
      overallConfidence: confidence,
      phaseBreakdowns: results,
      riskMatrix: risks,
      recommendations,
      changesSummary,
      timelinePrediction,
      comparisonData: null,
      generatedAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private getState(simulationId: string): SimulationState {
    const state = this.simulations.get(simulationId);
    if (!state) {
      throw new SimulationEngineError(`Simulation ${simulationId} not found`);
    }
    return state;
  }

  private computePhaseConfidence(
    itemCount: number,
    depth: SimulationDepth,
    blockers: number,
  ): number {
    // Base confidence from depth
    const depthConfidence: Record<SimulationDepth, number> = {
      quick: 0.65,
      standard: 0.80,
      thorough: 0.92,
    };

    let confidence = depthConfidence[depth];

    // More items = slightly lower per-item confidence
    if (itemCount > 1000) confidence *= 0.95;
    if (itemCount > 5000) confidence *= 0.90;

    // Blockers reduce confidence
    if (blockers > 0) confidence *= Math.max(0.5, 1 - blockers * 0.1);

    // Very small item sets have high confidence
    if (itemCount <= 10 && itemCount > 0) confidence = Math.min(confidence + 0.05, 1);

    return Math.round(confidence * 100) / 100;
  }

  private computeOverallPrediction(
    results: SimulationResult[],
    confidence: number,
  ): SimulationReport['overallPrediction'] {
    const failures = results.filter((r) => r.predictedOutcome === 'failure');
    const partials = results.filter((r) => r.predictedOutcome === 'partial_success');

    if (failures.length > 0) return 'high_risk';
    if (partials.length > results.length * 0.5) return 'needs_attention';
    if (confidence >= 0.8) return 'will_succeed';
    return 'likely_succeed';
  }

  private computeChangesSummary(
    results: SimulationResult[],
    sandbox: Sandbox,
  ): ChangesSummary {
    const diff = sandbox.diff();
    const contentResult = results.find((r) => r.phase === 'content_migration');
    const codeResult = results.find((r) => r.phase === 'code_modernization');
    const integrationResult = results.find((r) => r.phase === 'integration_reconnection');

    return {
      pagesMovedCount: (contentResult?.details?.totalPages as number) ?? 0,
      configsConvertedCount: (codeResult?.issuesFound ?? []).filter((i) => i.title.includes('config')).length,
      apisReplacedCount: (codeResult?.issuesFound ?? []).filter((i) => i.title.includes('API') || i.title.includes('api')).length,
      assetsTransferredCount: (contentResult?.details?.totalAssets as number) ?? 0,
      codeFilesModifiedCount: codeResult?.itemsAffected ?? 0,
      integrationsReconnectedCount: integrationResult?.itemsAffected ?? 0,
      totalItemsCount: diff.totalChanges,
    };
  }

  private computeTimeline(results: SimulationResult[]): TimelinePrediction {
    const HOURS_PER_WEEK = 40;
    const phaseTimelines: PhaseTimeline[] = [];

    const parallelPhases = new Set<SimulationPhase>([
      'code_modernization',
      'content_migration',
      'integration_reconnection',
    ]);

    let serialHours = 0;
    let maxParallelHours = 0;

    for (const result of results) {
      const canParallelize = parallelPhases.has(result.phase);
      const hours = result.estimatedDuration;

      phaseTimelines.push({
        phase: result.phase,
        estimatedHours: hours,
        estimatedWeeks: Math.ceil(hours / HOURS_PER_WEEK * 10) / 10,
        canParallelize,
      });

      if (canParallelize) {
        maxParallelHours = Math.max(maxParallelHours, hours);
      } else {
        serialHours += hours;
      }
    }

    const totalHours = serialHours + maxParallelHours;
    const estimatedWeeks = Math.ceil(totalHours / HOURS_PER_WEEK * 10) / 10;
    const traditionalWeeks = Math.ceil(estimatedWeeks * 3.5 * 10) / 10;

    return {
      estimatedWeeks,
      traditionalWeeks,
      timeSavingsPercent: Math.round((1 - estimatedWeeks / traditionalWeeks) * 100),
      phaseTimelines,
    };
  }

  private predictTargetPath(item: MigrationItem): string {
    const source = item.sourcePath;
    // AEM Cloud Service path transformations
    return source
      .replace('/apps/cq/', '/apps/')
      .replace('/libs/cq/', '/libs/')
      .replace('/etc/designs/', '/apps/')
      .replace('.jsp', '.html')
      .replace('.esp', '.html');
  }

  private predictContentTargetPath(item: MigrationItem): string {
    const source = item.sourcePath;
    return source
      .replace('/content/dam/', '/content/dam/')
      .replace('/content/', '/content/');
  }

  private extractReferences(item: MigrationItem): string[] {
    // Simulate reference extraction from item paths
    const refs: string[] = [];
    const pathParts = item.sourcePath.split('/').filter(Boolean);

    // Check for parent/sibling references
    if (pathParts.length > 2) {
      const parentPath = '/' + pathParts.slice(0, -1).join('/');
      refs.push(parentPath);
    }

    return refs;
  }

  private checkAuthCompatibility(
    integration: IntegrationDependency,
  ): { severity: Severity; description: string; fix: string; autoFixable: boolean } | null {
    const legacyAuthTypes = ['basic', 'jwt_legacy', 'api_key'];

    if (legacyAuthTypes.includes(integration.authType)) {
      return {
        severity: integration.authType === 'basic' ? Severity.CRITICAL : Severity.HIGH,
        description: `Integration uses "${integration.authType}" authentication which is deprecated for Cloud Service. Must migrate to OAuth Server-to-Server.`,
        fix: 'Configure OAuth Server-to-Server credentials in Adobe Developer Console.',
        autoFixable: false,
      };
    }

    return null;
  }
}

// ============================================================
// Internal Types
// ============================================================

interface SimulationState {
  simulation: Simulation;
  sandbox: Sandbox;
  project: MigrationProject | null;
  items: MigrationItem[];
}

// ============================================================
// Helpers
// ============================================================

function createInitialProgress(): SimulationProgress {
  return {
    currentPhase: null,
    completedPhases: [],
    overallPercent: 0,
    phasePercents: {
      assessment: 0,
      code_modernization: 0,
      content_migration: 0,
      integration_reconnection: 0,
      validation: 0,
    },
    startedAt: null,
    estimatedRemainingMs: null,
  };
}

function createIssue(
  phase: SimulationPhase,
  severity: Severity,
  title: string,
  description: string,
  affectedPath: string,
  suggestedFix: string,
  autoFixable: boolean,
  estimatedHours: number,
): SimulationIssue {
  return {
    id: `issue-${uuid().slice(0, 8)}`,
    phase,
    severity,
    title,
    description,
    affectedPath,
    suggestedFix,
    autoFixable,
    estimatedHours,
  };
}

// ============================================================
// Error
// ============================================================

export class SimulationEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationEngineError';
  }
}
