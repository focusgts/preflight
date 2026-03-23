/**
 * Simulation Engine Tests
 *
 * Tests for simulation creation, execution, sandbox state management,
 * risk prediction, confidence scoring, and report generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '@/lib/simulation/simulation-engine';
import { Sandbox } from '@/lib/simulation/sandbox';
import { RiskSimulator } from '@/lib/simulation/risk-simulator';
import { CompatibilityLevel, Severity, MigrationStatus, MigrationType, PhaseType } from '@/types';
import type { MigrationItem, MigrationProject, IntegrationDependency } from '@/types';
import type { SimulationResult, SimulationPhase } from '@/types/simulation';

// ── Factories ────────────────────────────────────────────────────────────

function createItem(overrides: Partial<MigrationItem> = {}): MigrationItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    type: 'code',
    name: 'test-item.java',
    sourcePath: '/apps/mysite/components/test',
    targetPath: null,
    status: 'pending',
    compatibilityLevel: CompatibilityLevel.COMPATIBLE,
    autoFixed: false,
    validationResult: null,
    error: null,
    processedAt: null,
    ...overrides,
  };
}

function createProject(overrides: Partial<MigrationProject> = {}): MigrationProject {
  return {
    id: 'mig-test001',
    name: 'Test Migration',
    organizationId: 'org-001',
    organizationName: 'Test Org',
    migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
    status: MigrationStatus.DRAFT,
    productsInScope: [],
    complianceRequirements: [],
    sourceEnvironment: {
      platform: 'aem_6x',
      version: '6.5',
      url: null,
      connectionType: 'package',
      credentials: null,
      metadata: {},
    },
    targetEnvironment: {
      platform: 'aem_cloud',
      organizationId: 'org-001',
      programId: null,
      environmentId: null,
      url: null,
      credentials: null,
      metadata: {},
    },
    assessment: null,
    phases: [],
    riskScore: 0,
    estimatedDurationWeeks: 0,
    estimatedCost: 0,
    actualCost: null,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targetCompletionDate: null,
    completedAt: null,
    ...overrides,
  };
}

function createIntegration(overrides: Partial<IntegrationDependency> = {}): IntegrationDependency {
  return {
    id: `int-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Integration',
    type: 'api',
    sourceConfig: {},
    targetConfig: { endpoint: 'https://target.example.com' },
    adobeProduct: null,
    authType: 'oauth_s2s',
    dataFlow: 'outbound',
    criticality: Severity.MEDIUM,
    autoMigratable: true,
    migrationNotes: '',
    ...overrides,
  };
}

// ── Simulation Engine Tests ──────────────────────────────────────────────

describe('SimulationEngine', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('should create a simulation', () => {
    const sim = engine.createSimulation('mig-001');
    expect(sim.id).toMatch(/^sim-/);
    expect(sim.migrationId).toBe('mig-001');
    expect(sim.status).toBe('pending');
    expect(sim.results).toHaveLength(0);
  });

  it('should create simulation with custom options', () => {
    const sim = engine.createSimulation('mig-001', {
      depth: 'thorough',
      riskThreshold: 0.5,
    });
    expect(sim.depth).toBe('thorough');
    expect(sim.options.riskThreshold).toBe(0.5);
  });

  it('should run a full simulation and produce a report', async () => {
    const sim = engine.createSimulation('mig-001');
    const project = createProject();
    const items = [
      createItem({ type: 'code', compatibilityLevel: CompatibilityLevel.COMPATIBLE }),
      createItem({ type: 'page', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE }),
      createItem({ type: 'config', compatibilityLevel: CompatibilityLevel.MANUAL_FIX }),
    ];

    const report = await engine.runSimulation(sim.id, project, items);

    expect(report).toBeDefined();
    expect(report.simulationId).toBe(sim.id);
    expect(report.overallConfidence).toBeGreaterThan(0);
    expect(report.phaseBreakdowns.length).toBeGreaterThan(0);
    expect(report.changesSummary).toBeDefined();
    expect(report.timelinePrediction).toBeDefined();
  });

  it('should list simulations filtered by migrationId', () => {
    engine.createSimulation('mig-001');
    engine.createSimulation('mig-001');
    engine.createSimulation('mig-002');

    expect(engine.listSimulations('mig-001')).toHaveLength(2);
    expect(engine.listSimulations('mig-002')).toHaveLength(1);
    expect(engine.listSimulations()).toHaveLength(3);
  });

  it('should throw when accessing non-existent simulation', () => {
    expect(engine.getSimulation('nonexistent')).toBeNull();
  });

  it('should simulate assessment phase', () => {
    const items = [
      createItem({ compatibilityLevel: CompatibilityLevel.COMPATIBLE }),
      createItem({ compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE }),
      createItem({ compatibilityLevel: CompatibilityLevel.BLOCKER }),
    ];

    const result = engine.simulateAssessment(items);

    expect(result.phase).toBe('assessment');
    expect(result.itemsAffected).toBe(3);
    expect(result.itemsAutoFixable).toBe(1);
    expect(result.itemsBlocker).toBe(1);
    expect(result.predictedOutcome).toBe('failure'); // has blocker
    expect(result.issuesFound.length).toBeGreaterThan(0);
  });

  it('should predict success for fully compatible items', () => {
    const items = [
      createItem({ compatibilityLevel: CompatibilityLevel.COMPATIBLE }),
      createItem({ compatibilityLevel: CompatibilityLevel.COMPATIBLE }),
    ];

    const result = engine.simulateAssessment(items);
    expect(result.predictedOutcome).toBe('success');
    expect(result.itemsBlocker).toBe(0);
  });

  it('should simulate code modernization', () => {
    const items = [
      createItem({ type: 'code', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE }),
      createItem({ type: 'component', compatibilityLevel: CompatibilityLevel.MANUAL_FIX }),
      createItem({ type: 'page' }), // should be filtered out
    ];
    const sandbox = new Sandbox();
    sandbox.createSandbox(items);

    const result = engine.simulateCodeModernization(items, sandbox);

    expect(result.phase).toBe('code_modernization');
    expect(result.itemsAffected).toBe(2); // only code + component
    expect(result.itemsAutoFixable).toBe(1);
    expect(result.itemsManualFix).toBe(1);
  });

  it('should simulate content migration with reference checking', () => {
    const items = [
      createItem({ type: 'page', name: 'homepage', sourcePath: '/content/site/en/home' }),
      createItem({ type: 'page', name: 'about', sourcePath: '/content/site/en/about' }),
      createItem({ type: 'asset', name: 'logo.png', sourcePath: '/content/dam/site/logo.png' }),
    ];
    const sandbox = new Sandbox();
    sandbox.createSandbox(items);

    const result = engine.simulateContentMigration(items, sandbox);

    expect(result.phase).toBe('content_migration');
    expect(result.itemsAffected).toBe(3);
    expect(result.estimatedDuration).toBeGreaterThan(0);
  });

  it('should simulate integration reconnection', () => {
    const integrations = [
      createIntegration({ authType: 'basic', criticality: Severity.CRITICAL, autoMigratable: false }),
      createIntegration({ authType: 'oauth_s2s' }),
    ];

    const result = engine.simulateIntegrationReconnection(integrations);

    expect(result.phase).toBe('integration_reconnection');
    expect(result.itemsAffected).toBe(2);
    expect(result.issuesFound.length).toBeGreaterThan(0); // basic auth should flag
    expect(result.itemsBlocker).toBeGreaterThan(0); // critical non-migratable
  });

  it('should simulate validation phase', () => {
    const items = [
      createItem({ type: 'page' }),
      createItem({ type: 'code' }),
    ];
    const sandbox = new Sandbox();
    sandbox.createSandbox(items);

    const result = engine.simulateValidation(items, sandbox);

    expect(result.phase).toBe('validation');
    expect(result.itemsAffected).toBe(2);
  });

  it('should get simulation report after completion', async () => {
    const sim = engine.createSimulation('mig-001');
    const project = createProject();
    const items = [createItem()];

    await engine.runSimulation(sim.id, project, items);

    const report = engine.getSimulationReport(sim.id);
    expect(report).toBeDefined();
    expect(report!.simulationId).toBe(sim.id);
  });

  it('should compare with actual results', async () => {
    const sim = engine.createSimulation('mig-001');
    const project = createProject();
    const items = [createItem()];

    await engine.runSimulation(sim.id, project, items);

    const comparison = engine.compareWithActual(sim.id, {
      duration: 4,
      issueCount: 2,
      successRate: 95,
    });

    expect(comparison).toBeDefined();
    expect(comparison!.actualDuration).toBe(4);
    expect(comparison!.actualIssueCount).toBe(2);
    expect(comparison!.accuracyScore).toBeGreaterThanOrEqual(0);
    expect(comparison!.accuracyScore).toBeLessThanOrEqual(100);
  });
});

// ── Sandbox Tests ────────────────────────────────────────────────────────

describe('Sandbox', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = new Sandbox();
  });

  it('should create sandbox from items', () => {
    const items = [createItem(), createItem()];
    const state = sandbox.createSandbox(items);

    expect(state.items).toHaveLength(2);
    expect(state.changes).toHaveLength(0);
  });

  it('should apply changes and track them', () => {
    const item = createItem();
    sandbox.createSandbox([item]);

    const changeId = sandbox.applyChange({
      itemId: item.id,
      type: 'transform',
      updates: { targetPath: '/new/path', status: 'processed' },
      phase: 'code_modernization',
      description: 'Test change',
    });

    expect(changeId).toBeDefined();
    const updatedItem = sandbox.getItem(item.id);
    expect(updatedItem!.targetPath).toBe('/new/path');
    expect(updatedItem!.status).toBe('processed');
  });

  it('should rollback a change', () => {
    const item = createItem();
    sandbox.createSandbox([item]);

    const changeId = sandbox.applyChange({
      itemId: item.id,
      type: 'modify',
      updates: { targetPath: '/changed' },
      phase: 'content_migration',
      description: 'Will be rolled back',
    });

    const success = sandbox.rollback(changeId);
    expect(success).toBe(true);

    const rolledBack = sandbox.getItem(item.id);
    expect(rolledBack!.targetPath).toBeNull();
  });

  it('should show diff from initial state', () => {
    const item = createItem();
    sandbox.createSandbox([item]);

    sandbox.applyChange({
      itemId: item.id,
      type: 'modify',
      updates: { targetPath: '/new/target' },
      phase: 'assessment',
      description: 'diff test',
    });

    const diff = sandbox.diff();
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].changes['targetPath']).toEqual({
      from: null,
      to: '/new/target',
    });
  });

  it('should validate sandbox state', () => {
    const items = [createItem(), createItem()];
    sandbox.createSandbox(items);

    const result = sandbox.validate();
    expect(result.valid).toBe(true);
    expect(result.itemCount).toBe(2);
  });

  it('should reset to initial state', () => {
    const item = createItem();
    sandbox.createSandbox([item]);

    sandbox.applyChange({
      itemId: item.id,
      type: 'modify',
      updates: { targetPath: '/changed' },
      phase: 'assessment',
      description: 'will be reset',
    });

    sandbox.reset();
    const state = sandbox.getState();

    expect(state.changes).toHaveLength(0);
    expect(state.items[0].targetPath).toBeNull();
  });

  it('should throw when applying change to non-existent item', () => {
    sandbox.createSandbox([]);

    expect(() => {
      sandbox.applyChange({
        itemId: 'nonexistent',
        type: 'modify',
        updates: {},
        phase: 'assessment',
        description: 'should fail',
      });
    }).toThrow('Item nonexistent not found in sandbox');
  });

  it('should get changes for a specific phase', () => {
    const item = createItem();
    sandbox.createSandbox([item]);

    sandbox.applyChange({
      itemId: item.id,
      type: 'modify',
      updates: { status: 'processed' },
      phase: 'code_modernization',
      description: 'code change',
    });

    sandbox.applyChange({
      itemId: item.id,
      type: 'modify',
      updates: { targetPath: '/new' },
      phase: 'content_migration',
      description: 'content change',
    });

    const codeChanges = sandbox.getChangesForPhase('code_modernization');
    expect(codeChanges).toHaveLength(1);

    const contentChanges = sandbox.getChangesForPhase('content_migration');
    expect(contentChanges).toHaveLength(1);
  });
});

// ── Risk Simulator Tests ─────────────────────────────────────────────────

describe('RiskSimulator', () => {
  let riskSim: RiskSimulator;

  beforeEach(() => {
    riskSim = new RiskSimulator();
  });

  it('should predict risks from simulation results', () => {
    const results: SimulationResult[] = [
      {
        phase: 'code_modernization',
        predictedOutcome: 'failure',
        confidence: 0.7,
        issuesFound: [
          { id: 'i1', phase: 'code_modernization', severity: Severity.CRITICAL, title: 'Blocker API', description: '', affectedPath: '', suggestedFix: 'fix it', autoFixable: false, estimatedHours: 8 },
        ],
        estimatedDuration: 40,
        itemsAffected: 100,
        itemsAutoFixable: 50,
        itemsManualFix: 30,
        itemsBlocker: 5,
        details: {},
      },
    ];

    const risks = riskSim.predictRisks(results);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.some((r) => r.level === 'critical')).toBe(true);
  });

  it('should calculate confidence', () => {
    const goodResults: SimulationResult[] = [
      {
        phase: 'assessment',
        predictedOutcome: 'success',
        confidence: 0.9,
        issuesFound: [],
        estimatedDuration: 10,
        itemsAffected: 50,
        itemsAutoFixable: 0,
        itemsManualFix: 0,
        itemsBlocker: 0,
        details: {},
      },
    ];

    const confidence = riskSim.calculateConfidence(goodResults);
    expect(confidence).toBeGreaterThan(0.7);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('should return 0 confidence for empty results', () => {
    expect(riskSim.calculateConfidence([])).toBe(0);
  });

  it('should reduce confidence when blockers exist', () => {
    const noBlockers: SimulationResult[] = [
      { phase: 'assessment', predictedOutcome: 'success', confidence: 0.9, issuesFound: [], estimatedDuration: 10, itemsAffected: 50, itemsAutoFixable: 5, itemsManualFix: 0, itemsBlocker: 0, details: {} },
    ];
    const withBlockers: SimulationResult[] = [
      { phase: 'assessment', predictedOutcome: 'success', confidence: 0.9, issuesFound: [], estimatedDuration: 10, itemsAffected: 50, itemsAutoFixable: 5, itemsManualFix: 0, itemsBlocker: 5, details: {} },
    ];

    const confNoBlockers = riskSim.calculateConfidence(noBlockers);
    const confWithBlockers = riskSim.calculateConfidence(withBlockers);
    expect(confWithBlockers).toBeLessThan(confNoBlockers);
  });

  it('should identify edge cases', () => {
    const results: SimulationResult[] = [
      {
        phase: 'content_migration',
        predictedOutcome: 'success',
        confidence: 0.5, // low confidence
        issuesFound: [],
        estimatedDuration: 10,
        itemsAffected: 15000, // very large
        itemsAutoFixable: 0,
        itemsManualFix: 0,
        itemsBlocker: 0,
        details: {},
      },
    ];

    const edgeCases = riskSim.identifyEdgeCases(results);
    expect(edgeCases.length).toBeGreaterThan(0);
    expect(edgeCases.some((e) => e.title.includes('large'))).toBe(true);
    expect(edgeCases.some((e) => e.title.includes('Low confidence'))).toBe(true);
  });

  it('should generate mitigation plan from risks', () => {
    const risks = [
      { id: 'r1', title: 'Critical risk', description: '', probability: 5, impact: 5, level: 'critical' as const, phase: 'assessment' as SimulationPhase, mitigation: 'Fix immediately' },
      { id: 'r2', title: 'Low risk', description: '', probability: 1, impact: 1, level: 'low' as const, phase: 'validation' as SimulationPhase, mitigation: 'Monitor' },
    ];

    const plan = riskSim.generateMitigationPlan(risks);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].action).toBe('address_first'); // Overall recommendation for critical risks
  });

  it('should recommend proceed when no critical risks', () => {
    const risks = [
      { id: 'r1', title: 'Minor thing', description: '', probability: 1, impact: 2, level: 'low' as const, phase: 'assessment' as SimulationPhase, mitigation: 'Monitor' },
    ];

    const plan = riskSim.generateMitigationPlan(risks);
    expect(plan[0].action).toBe('proceed');
  });
});
