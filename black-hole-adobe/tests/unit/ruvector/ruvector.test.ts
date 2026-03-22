/**
 * RuVector Integration Layer - Comprehensive Tests
 *
 * Tests covering vector storage, cosine similarity, pattern recording,
 * pattern matching, duplicate detection, risk prediction, trajectory
 * recording, persistence, and namespace isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { RuVectorClient } from '@/lib/ruvector/client';
import {
  generateEmbedding,
  cosineSimilarity,
  batchEmbed,
} from '@/lib/ruvector/embeddings';
import { PatternRecorder } from '@/lib/ruvector/pattern-recorder';
import { PatternMatcher } from '@/lib/ruvector/pattern-matcher';
import { TrajectoryRecorder } from '@/lib/ruvector/trajectory';
import {
  VALID_NAMESPACES,
  EMBEDDING_DIMENSIONS,
  type RuVectorConfig,
} from '@/config/ruvector-config';

// ============================================================
// Test Helpers
// ============================================================

const TEST_VECTOR_PATH = 'data/test-ruvector.json';
const TEST_TRAJECTORY_PATH = 'data/test-trajectories.json';

function testConfig(
  overrides: Partial<RuVectorConfig> = {},
): Partial<RuVectorConfig> {
  return {
    persistence: {
      vectorStorePath: TEST_VECTOR_PATH,
      trajectoryStorePath: TEST_TRAJECTORY_PATH,
      autoSaveIntervalMs: 30_000,
      maxEntriesPerNamespace: 100,
    },
    features: {
      persistenceEnabled: false,
      trajectoryRecording: true,
      autoSaveOnMutation: false,
      hnswIndexing: false,
      gnnEnhancedSearch: false,
      sonaAutoTuning: false,
    },
    ...overrides,
  };
}

function cleanupTestFiles(): void {
  for (const f of [TEST_VECTOR_PATH, TEST_TRAJECTORY_PATH]) {
    if (existsSync(f)) unlinkSync(f);
  }
}

// ============================================================
// Embedding Tests
// ============================================================

describe('Embeddings', () => {
  it('should generate 384-dimensional embedding', () => {
    const embedding = generateEmbedding('hello world');
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('should generate unit vector (L2 norm ~1)', () => {
    const embedding = generateEmbedding('test embedding normalization');
    const norm = Math.sqrt(
      embedding.reduce((sum, v) => sum + v * v, 0),
    );
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('should produce identical embeddings for identical text', () => {
    const a = generateEmbedding('identical text');
    const b = generateEmbedding('identical text');
    expect(a).toEqual(b);
  });

  it('should produce similar embeddings for similar text', () => {
    const a = generateEmbedding('AEM Cloud Service migration');
    const b = generateEmbedding('AEM Cloud Service migration project');
    const c = generateEmbedding('completely unrelated quantum physics');
    const simAB = cosineSimilarity(a, b);
    const simAC = cosineSimilarity(a, c);
    expect(simAB).toBeGreaterThan(simAC);
  });

  it('should produce different embeddings for different text', () => {
    const a = generateEmbedding('adobe experience manager');
    const b = generateEmbedding('postgresql database configuration');
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeLessThan(0.8);
  });

  it('should compute cosine similarity of identical vectors as 1', () => {
    const v = generateEmbedding('test');
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 4);
  });

  it('should compute cosine similarity in [-1, 1] range', () => {
    const a = generateEmbedding('one');
    const b = generateEmbedding('two');
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('should throw on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      'dimension mismatch',
    );
  });

  it('should batch embed multiple texts', () => {
    const results = batchEmbed(['text one', 'text two', 'text three']);
    expect(results).toHaveLength(3);
    for (const emb of results) {
      expect(emb).toHaveLength(EMBEDDING_DIMENSIONS);
    }
  });

  it('should handle very short text', () => {
    const embedding = generateEmbedding('ab');
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(
      embedding.reduce((sum, v) => sum + v * v, 0),
    );
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('should handle empty text', () => {
    const embedding = generateEmbedding('');
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });
});

// ============================================================
// Client - Store and Retrieve
// ============================================================

describe('RuVectorClient - Store and Retrieve', () => {
  let client: RuVectorClient;

  beforeEach(() => {
    client = new RuVectorClient(testConfig());
  });

  it('should store and retrieve a vector', async () => {
    const embedding = generateEmbedding('test value');
    await client.store('knowledge', 'key-1', 'test value', embedding, ['tag1']);
    const result = await client.retrieve('knowledge', 'key-1');
    expect(result).not.toBeNull();
    expect(result!.key).toBe('key-1');
    expect(result!.value).toBe('test value');
    expect(result!.namespace).toBe('knowledge');
    expect(result!.tags).toContain('tag1');
  });

  it('should return null for non-existent key', async () => {
    const result = await client.retrieve('knowledge', 'nonexistent');
    expect(result).toBeNull();
  });

  it('should overwrite existing entry with same key', async () => {
    const emb1 = generateEmbedding('first');
    const emb2 = generateEmbedding('second');
    await client.store('knowledge', 'key-1', 'first', emb1);
    await client.store('knowledge', 'key-1', 'second', emb2);
    const result = await client.retrieve('knowledge', 'key-1');
    expect(result!.value).toBe('second');
  });

  it('should reject invalid namespace', async () => {
    const embedding = generateEmbedding('test');
    await expect(
      client.store('invalid_ns' as never, 'k', 'v', embedding),
    ).rejects.toThrow('Invalid namespace');
  });

  it('should reject wrong embedding dimensions', async () => {
    await expect(
      client.store('knowledge', 'k', 'v', [1, 2, 3]),
    ).rejects.toThrow('384');
  });

  it('should delete an entry', async () => {
    const embedding = generateEmbedding('delete me');
    await client.store('knowledge', 'to-delete', 'val', embedding);
    const deleted = await client.delete('knowledge', 'to-delete');
    expect(deleted).toBe(true);
    const result = await client.retrieve('knowledge', 'to-delete');
    expect(result).toBeNull();
  });

  it('should return false when deleting non-existent entry', async () => {
    const deleted = await client.delete('knowledge', 'nonexistent');
    expect(deleted).toBe(false);
  });

  it('should list entries in a namespace', async () => {
    const emb = generateEmbedding('list test');
    await client.store('tickets', 'a', 'val-a', emb);
    await client.store('tickets', 'b', 'val-b', emb);
    await client.store('tickets', 'c', 'val-c', emb);
    const list = await client.list('tickets', 10);
    expect(list).toHaveLength(3);
  });

  it('should respect list limit', async () => {
    const emb = generateEmbedding('limit test');
    for (let i = 0; i < 5; i++) {
      await client.store('tickets', `item-${i}`, `val-${i}`, emb);
    }
    const list = await client.list('tickets', 2);
    expect(list).toHaveLength(2);
  });
});

// ============================================================
// Client - Search
// ============================================================

describe('RuVectorClient - Search', () => {
  let client: RuVectorClient;

  beforeEach(async () => {
    client = new RuVectorClient(testConfig());
    // Seed with known data
    await client.store(
      'fix_library',
      'fix-osgi',
      'Convert OSGi XML to JSON',
      generateEmbedding('OSGi configuration XML to JSON migration'),
      ['osgi', 'config'],
    );
    await client.store(
      'fix_library',
      'fix-dispatcher',
      'Modernize dispatcher config',
      generateEmbedding('dispatcher configuration modernization cloud'),
      ['dispatcher'],
    );
    await client.store(
      'fix_library',
      'fix-workflow',
      'Convert ECMA workflow to Java',
      generateEmbedding('ECMA script workflow conversion Java process step'),
      ['workflow'],
    );
  });

  it('should find similar vectors by cosine similarity', async () => {
    const query = generateEmbedding('OSGi config XML conversion');
    const results = await client.search('fix_library', query, 3, 0.3);
    expect(results.length).toBeGreaterThan(0);
    // OSGi fix should be the top result
    expect(results[0].entry.key).toBe('fix-osgi');
  });

  it('should return results sorted by similarity descending', async () => {
    const query = generateEmbedding('OSGi configuration migration');
    const results = await client.search('fix_library', query, 10, 0.1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
        results[i].similarity,
      );
    }
  });

  it('should filter by threshold', async () => {
    const query = generateEmbedding('completely unrelated quantum computing');
    const results = await client.search('fix_library', query, 10, 0.99);
    expect(results).toHaveLength(0);
  });

  it('should respect search limit', async () => {
    const query = generateEmbedding('migration');
    const results = await client.search('fix_library', query, 1, 0.1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return empty for empty namespace', async () => {
    const query = generateEmbedding('test');
    const results = await client.search('memories', query, 10, 0.1);
    expect(results).toHaveLength(0);
  });
});

// ============================================================
// Client - Namespace Isolation
// ============================================================

describe('RuVectorClient - Namespace Isolation', () => {
  let client: RuVectorClient;

  beforeEach(() => {
    client = new RuVectorClient(testConfig());
  });

  it('should isolate entries across namespaces', async () => {
    const emb = generateEmbedding('shared text');
    await client.store('knowledge', 'key-1', 'in knowledge', emb);
    await client.store('tickets', 'key-1', 'in tickets', emb);

    const knowledge = await client.retrieve('knowledge', 'key-1');
    const tickets = await client.retrieve('tickets', 'key-1');
    expect(knowledge!.value).toBe('in knowledge');
    expect(tickets!.value).toBe('in tickets');
  });

  it('should not return results from other namespaces in search', async () => {
    const emb = generateEmbedding('cross namespace test');
    await client.store('knowledge', 'k1', 'val', emb);
    const results = await client.search('tickets', emb, 10, 0.0);
    expect(results).toHaveLength(0);
  });

  it('should support all 14 namespaces', () => {
    expect(VALID_NAMESPACES).toHaveLength(14);
    expect(VALID_NAMESPACES).toContain('knowledge');
    expect(VALID_NAMESPACES).toContain('fix_library');
    expect(VALID_NAMESPACES).toContain('content_signatures');
    expect(VALID_NAMESPACES).toContain('integration_templates');
  });
});

// ============================================================
// Client - Stats and Clear
// ============================================================

describe('RuVectorClient - Stats and Clear', () => {
  let client: RuVectorClient;

  beforeEach(async () => {
    client = new RuVectorClient(testConfig());
    const emb = generateEmbedding('stats test');
    await client.store('knowledge', 'k1', 'v1', emb);
    await client.store('knowledge', 'k2', 'v2', emb);
    await client.store('tickets', 'k3', 'v3', emb);
  });

  it('should report correct stats', () => {
    const stats = client.getStats();
    expect(stats.totalVectors).toBe(3);
    expect(stats.namespaceCounts['knowledge']).toBe(2);
    expect(stats.namespaceCounts['tickets']).toBe(1);
  });

  it('should clear a single namespace', async () => {
    await client.clear('knowledge');
    const stats = client.getStats();
    expect(stats.namespaceCounts['knowledge']).toBe(0);
    expect(stats.namespaceCounts['tickets']).toBe(1);
  });

  it('should clear all namespaces', async () => {
    await client.clear();
    const stats = client.getStats();
    expect(stats.totalVectors).toBe(0);
  });
});

// ============================================================
// Client - Persistence
// ============================================================

describe('RuVectorClient - Persistence', () => {
  beforeEach(() => cleanupTestFiles());
  afterEach(() => cleanupTestFiles());

  it('should save to and load from disk', async () => {
    if (!existsSync('data')) mkdirSync('data', { recursive: true });

    const config = testConfig({
      features: {
        persistenceEnabled: true,
        trajectoryRecording: false,
        autoSaveOnMutation: false,
        hnswIndexing: false,
        gnnEnhancedSearch: false,
        sonaAutoTuning: false,
      },
    });

    const client1 = new RuVectorClient(config);
    const emb = generateEmbedding('persistence test');
    await client1.store('knowledge', 'persist-key', 'persist-value', emb, ['persisted']);
    client1.saveToDisk();

    // Create a new client that loads from disk
    const client2 = new RuVectorClient(config);
    const result = await client2.retrieve('knowledge', 'persist-key');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('persist-value');
    expect(result!.tags).toContain('persisted');
  });

  it('should handle missing persistence file gracefully', () => {
    const config = testConfig({
      features: {
        persistenceEnabled: true,
        trajectoryRecording: false,
        autoSaveOnMutation: false,
        hnswIndexing: false,
        gnnEnhancedSearch: false,
        sonaAutoTuning: false,
      },
    });
    const client = new RuVectorClient(config);
    const stats = client.getStats();
    expect(stats.totalVectors).toBe(0);
  });
});

// ============================================================
// Pattern Recorder
// ============================================================

describe('PatternRecorder', () => {
  let client: RuVectorClient;
  let recorder: PatternRecorder;

  beforeEach(() => {
    client = new RuVectorClient(testConfig());
    recorder = new PatternRecorder(client);
  });

  it('should record a code fix pattern', async () => {
    const entry = await recorder.recordCodeFix(
      'OSGi XML config not compatible',
      'Convert to .cfg.json format',
      'success',
      { category: 'osgi' },
    );
    expect(entry.namespace).toBe('fix_library');
    expect(entry.tags).toContain('code-fix');
    expect(entry.tags).toContain('outcome:success');
  });

  it('should record a migration outcome', async () => {
    const entry = await recorder.recordMigrationOutcome(
      {
        environment: 'AEM 6.5',
        migrationType: 'aem_onprem_to_cloud',
        scores: { overall: 65, codeCompatibility: 50, contentReadiness: 80, integrationComplexity: 60 },
        findings: ['deprecated API', 'custom workflow'],
      },
      16,
      150000,
      ['deployment failure', 'dispatcher issues'],
    );
    expect(entry.namespace).toBe('risk_outcomes');
    expect(entry.tags).toContain('migration-outcome');
  });

  it('should record a content pattern', async () => {
    const entry = await recorder.recordContentPattern(
      'Hero banner component with CTA',
      null,
      { pageType: 'landing' },
    );
    expect(entry.namespace).toBe('content_signatures');
  });

  it('should record an integration template', async () => {
    const entry = await recorder.recordIntegrationTemplate(
      'salesforce',
      'aep',
      { endpoint: '/api/v2', auth: 'oauth' },
      true,
    );
    expect(entry.namespace).toBe('integration_templates');
    expect(entry.tags).toContain('validated');
  });

  it('should record an assessment profile', async () => {
    const entry = await recorder.recordAssessmentProfile(
      'AEM 6.4 on-premise',
      { overall: 72, codeCompatibility: 60, contentReadiness: 85, integrationComplexity: 55 },
      ['deprecated API usage', 'custom search index'],
    );
    expect(entry.namespace).toBe('assessment_profiles');
    expect(entry.tags).toContain('assessment-profile');
  });
});

// ============================================================
// Pattern Matcher
// ============================================================

describe('PatternMatcher', () => {
  let client: RuVectorClient;
  let recorder: PatternRecorder;
  let matcher: PatternMatcher;

  beforeEach(async () => {
    client = new RuVectorClient(testConfig());
    recorder = new PatternRecorder(client);
    matcher = new PatternMatcher(client);

    // Seed fix library
    await recorder.recordCodeFix(
      'loginAdministrative deprecated in AEM Cloud Service',
      'Replace with loginService and service user mapping',
      'success',
    );
    await recorder.recordCodeFix(
      'OSGi XML configuration not supported in Cloud',
      'Convert to .cfg.json format under ui.config',
      'success',
    );
    await recorder.recordCodeFix(
      'Dispatcher allowedClients section not supported',
      'Remove allowedClients, managed by Cloud CDN',
      'success',
    );

    // Seed outcomes
    await recorder.recordMigrationOutcome(
      {
        environment: 'AEM 6.5',
        migrationType: 'aem_onprem_to_cloud',
        scores: { overall: 65, codeCompatibility: 50, contentReadiness: 80, integrationComplexity: 60 },
        findings: ['deprecated APIs', 'custom workflows'],
      },
      16,
      120000,
      ['dispatcher config', 'oak index'],
    );

    // Seed content
    await recorder.recordContentPattern(
      'Homepage hero banner with video background and CTA button',
      null,
    );
  });

  it('should find similar fixes for a known problem', async () => {
    // Use a query very close to the stored problem text for reliable matching
    const fixes = await matcher.findSimilarFixes(
      'loginAdministrative deprecated in AEM Cloud Service replacement',
      5,
    );
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0].fix).toContain('loginService');
  });

  it('should return fixes with similarity scores', async () => {
    const fixes = await matcher.findSimilarFixes('OSGi XML config', 5);
    for (const fix of fixes) {
      expect(fix.similarity).toBeGreaterThan(0);
      expect(fix.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('should return fixes with confidence scores', async () => {
    const fixes = await matcher.findSimilarFixes('OSGi config', 5);
    for (const fix of fixes) {
      expect(fix.confidence).toBeGreaterThan(0);
      expect(fix.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should predict risk from historical data', async () => {
    const prediction = await matcher.predictRisk({
      environment: 'AEM 6.5',
      migrationType: 'aem_onprem_to_cloud',
      scores: { overall: 60, codeCompatibility: 45, contentReadiness: 75, integrationComplexity: 55 },
      findings: ['deprecated APIs'],
    });
    expect(prediction.predictedRiskLevel).toBeDefined();
    expect(prediction.riskScore).toBeGreaterThanOrEqual(0);
    expect(prediction.riskScore).toBeLessThanOrEqual(1);
    expect(prediction.basedOnSamples).toBeGreaterThan(0);
  });

  it('should provide fallback risk prediction when no data', async () => {
    const emptyClient = new RuVectorClient(testConfig());
    const emptyMatcher = new PatternMatcher(emptyClient);
    const prediction = await emptyMatcher.predictRisk({
      environment: 'WordPress 6.x',
      migrationType: 'wordpress_to_aem',
      scores: { overall: 40, codeCompatibility: 30, contentReadiness: 50, integrationComplexity: 40 },
      findings: [],
    });
    expect(prediction.basedOnSamples).toBe(0);
    expect(prediction.confidence).toBe(0.3);
  });

  it('should estimate timeline from historical data', async () => {
    const estimate = await matcher.estimateTimeline({
      environment: 'AEM 6.5',
      migrationType: 'aem_onprem_to_cloud',
      scores: { overall: 65, codeCompatibility: 50, contentReadiness: 80, integrationComplexity: 60 },
      findings: ['deprecated APIs'],
    });
    expect(estimate.estimatedWeeks).toBeGreaterThan(0);
    expect(estimate.rangeMin).toBeLessThanOrEqual(estimate.rangeMax);
  });

  it('should find duplicate content', async () => {
    const duplicates = await matcher.findDuplicateContent(
      'Homepage hero banner with video background and call to action',
      0.5,
    );
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0].similarity).toBeGreaterThan(0.5);
  });

  it('should return empty for no duplicate content', async () => {
    const duplicates = await matcher.findDuplicateContent(
      'completely unique quantum physics content',
      0.99,
    );
    expect(duplicates).toHaveLength(0);
  });

  it('should find integration template by exact match', async () => {
    await recorder.recordIntegrationTemplate(
      'salesforce',
      'aep',
      { endpoint: '/api/v2' },
      true,
    );
    const template = await matcher.getIntegrationTemplate('salesforce', 'aep');
    expect(template).not.toBeNull();
    expect(template!.sourceType).toBe('salesforce');
    expect(template!.targetType).toBe('aep');
    expect(template!.validated).toBe(true);
  });

  it('should return null for unknown integration template', async () => {
    const template = await matcher.getIntegrationTemplate(
      'nonexistent',
      'nowhere',
    );
    expect(template).toBeNull();
  });
});

// ============================================================
// Trajectory Recorder
// ============================================================

describe('TrajectoryRecorder', () => {
  let trajectory: TrajectoryRecorder;

  beforeEach(() => {
    trajectory = new TrajectoryRecorder(testConfig());
  });

  it('should record a query trajectory', () => {
    const id = trajectory.recordQuery('fix_library', 'OSGi config', [
      { key: 'fix-1', similarity: 0.9 },
      { key: 'fix-2', similarity: 0.7 },
    ]);
    expect(id).toBeTruthy();
    expect(trajectory.count).toBe(1);
  });

  it('should record feedback on a result', () => {
    const queryId = trajectory.recordQuery('fix_library', 'test', []);
    const feedbackId = trajectory.recordFeedback(
      queryId,
      'fix-1',
      'useful',
      'worked perfectly',
    );
    expect(feedbackId).toBeTruthy();
    expect(trajectory.count).toBe(2);
  });

  it('should record an outcome', () => {
    const id = trajectory.recordOutcome(
      'pattern-123',
      'success',
      'Fix applied successfully',
      { timeSaved: 4 },
    );
    expect(id).toBeTruthy();
  });

  it('should get trajectories by namespace', () => {
    trajectory.recordQuery('fix_library', 'query 1', []);
    trajectory.recordQuery('knowledge', 'query 2', []);
    trajectory.recordQuery('fix_library', 'query 3', []);

    const fixTrajectories = trajectory.getTrajectories('fix_library');
    expect(fixTrajectories).toHaveLength(2);
  });

  it('should return trajectories most recent first', () => {
    trajectory.recordQuery('fix_library', 'first', []);
    trajectory.recordQuery('fix_library', 'second', []);
    trajectory.recordQuery('fix_library', 'third', []);

    const results = trajectory.getTrajectories('fix_library');
    expect(results).toHaveLength(3);
    // Most recent first
    const timestamps = results.map((r) => new Date(r.timestamp).getTime());
    expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
  });

  it('should compute feedback statistics', () => {
    const q1 = trajectory.recordQuery('fix_library', 'q1', [{ key: 'r1', similarity: 0.9 }]);
    trajectory.recordFeedback(q1, 'r1', 'useful');
    const q2 = trajectory.recordQuery('fix_library', 'q2', [{ key: 'r2', similarity: 0.8 }]);
    trajectory.recordFeedback(q2, 'r2', 'not_useful');
    const q3 = trajectory.recordQuery('fix_library', 'q3', [{ key: 'r3', similarity: 0.7 }]);
    trajectory.recordFeedback(q3, 'r3', 'useful');

    const stats = trajectory.getFeedbackStats('fix_library');
    expect(stats.total).toBe(3);
    expect(stats.useful).toBe(2);
    expect(stats.notUseful).toBe(1);
    expect(stats.usefulRate).toBeCloseTo(2 / 3, 2);
  });

  it('should compute outcome statistics', () => {
    trajectory.recordOutcome('p1', 'success', 'ok');
    trajectory.recordOutcome('p2', 'success', 'ok');
    trajectory.recordOutcome('p3', 'failure', 'failed');

    const stats = trajectory.getOutcomeStats();
    expect(stats.total).toBe(3);
    expect(stats.success).toBe(2);
    expect(stats.failure).toBe(1);
    expect(stats.successRate).toBeCloseTo(2 / 3, 2);
  });

  it('should respect limit on getTrajectories', () => {
    for (let i = 0; i < 10; i++) {
      trajectory.recordQuery('fix_library', `query-${i}`, []);
    }
    const limited = trajectory.getTrajectories('fix_library', 3);
    expect(limited).toHaveLength(3);
  });

  it('should get trajectories by type', () => {
    trajectory.recordQuery('fix_library', 'q', []);
    trajectory.recordOutcome('p1', 'success', '');
    trajectory.recordOutcome('p2', 'failure', '');

    const outcomes = trajectory.getTrajectoriesByType('outcome');
    expect(outcomes).toHaveLength(2);
  });
});

// ============================================================
// Trajectory Persistence
// ============================================================

describe('TrajectoryRecorder - Persistence', () => {
  beforeEach(() => cleanupTestFiles());
  afterEach(() => cleanupTestFiles());

  it('should save and load trajectories', () => {
    if (!existsSync('data')) mkdirSync('data', { recursive: true });

    const config = testConfig({
      features: {
        persistenceEnabled: true,
        trajectoryRecording: true,
        autoSaveOnMutation: false,
        hnswIndexing: false,
        gnnEnhancedSearch: false,
        sonaAutoTuning: false,
      },
    });

    const recorder1 = new TrajectoryRecorder(config);
    recorder1.recordQuery('fix_library', 'persist test', [
      { key: 'r1', similarity: 0.9 },
    ]);
    recorder1.recordOutcome('p1', 'success', 'persisted');
    recorder1.saveToDisk();

    const recorder2 = new TrajectoryRecorder(config);
    expect(recorder2.count).toBe(2);
    const trajectories = recorder2.getTrajectories();
    expect(trajectories).toHaveLength(2);
  });
});
