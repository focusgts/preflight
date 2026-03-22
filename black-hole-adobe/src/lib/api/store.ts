/**
 * Data Store
 *
 * Provides CRUD operations for migrations, assessments, and connectors.
 * Backed by SQLite for persistence across restarts. Falls back to
 * in-memory Maps if SQLite fails to initialise (e.g. in edge runtime).
 *
 * Public API is unchanged from the original in-memory implementation.
 */

import type {
  MigrationProject,
  AssessmentResult,
  ConnectorConfig,
} from '@/types';

// ---------------------------------------------------------------------------
// Try to load SQLite — fall back to in-memory if unavailable
// ---------------------------------------------------------------------------

type StoreBackend = {
  listMigrations(): MigrationProject[];
  getMigration(id: string): MigrationProject | undefined;
  createMigration(project: MigrationProject): MigrationProject;
  updateMigration(id: string, patch: Partial<MigrationProject>): MigrationProject | undefined;
  deleteMigration(id: string): boolean;
  listAssessments(): AssessmentResult[];
  getAssessment(id: string): AssessmentResult | undefined;
  createAssessment(result: AssessmentResult): AssessmentResult;
  getAssessmentByMigration(migrationId: string): AssessmentResult | undefined;
  listConnectors(): ConnectorConfig[];
  getConnector(id: string): ConnectorConfig | undefined;
  createConnector(config: ConnectorConfig): ConnectorConfig;
  updateConnector(id: string, patch: Partial<ConnectorConfig>): ConnectorConfig | undefined;
};

let backend: StoreBackend | null = null;

function getBackend(): StoreBackend {
  if (backend) return backend;

  try {
    // Dynamic require to avoid bundling issues in edge runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase() as StoreBackend;
    backend = db;
    console.log('[Store] SQLite backend initialised');
    return db;
  } catch (err) {
    console.warn('[Store] SQLite unavailable, using in-memory fallback:', err);
    backend = createInMemoryBackend();
    return backend;
  }
}

// ---------------------------------------------------------------------------
// Public API (same signatures as before)
// ---------------------------------------------------------------------------

export function listMigrations(): MigrationProject[] {
  return getBackend().listMigrations();
}

export function getMigration(id: string): MigrationProject | undefined {
  return getBackend().getMigration(id);
}

export function createMigration(project: MigrationProject): MigrationProject {
  return getBackend().createMigration(project);
}

export function updateMigration(
  id: string,
  patch: Partial<MigrationProject>,
): MigrationProject | undefined {
  return getBackend().updateMigration(id, patch);
}

export function deleteMigration(id: string): boolean {
  return getBackend().deleteMigration(id);
}

export function listAssessments(): AssessmentResult[] {
  return getBackend().listAssessments();
}

export function getAssessment(id: string): AssessmentResult | undefined {
  return getBackend().getAssessment(id);
}

export function createAssessment(result: AssessmentResult): AssessmentResult {
  return getBackend().createAssessment(result);
}

export function getAssessmentByMigration(
  migrationId: string,
): AssessmentResult | undefined {
  return getBackend().getAssessmentByMigration(migrationId);
}

export function listConnectors(): ConnectorConfig[] {
  return getBackend().listConnectors();
}

export function getConnector(id: string): ConnectorConfig | undefined {
  return getBackend().getConnector(id);
}

export function createConnector(config: ConnectorConfig): ConnectorConfig {
  return getBackend().createConnector(config);
}

export function updateConnector(
  id: string,
  patch: Partial<ConnectorConfig>,
): ConnectorConfig | undefined {
  return getBackend().updateConnector(id, patch);
}

// ---------------------------------------------------------------------------
// In-Memory Fallback (original implementation)
// ---------------------------------------------------------------------------

function createInMemoryBackend(): StoreBackend {
  const migrations = new Map<string, MigrationProject>();
  const assessments = new Map<string, AssessmentResult>();
  const connectors = new Map<string, ConnectorConfig>();

  // Seed inline if fallback is used
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedInMemory } = require('./store-seed');
    seedInMemory(migrations, assessments, connectors);
  } catch {
    console.warn('[Store] In-memory seed data unavailable');
  }

  return {
    listMigrations: () => Array.from(migrations.values()),
    getMigration: (id) => migrations.get(id),
    createMigration: (project) => {
      migrations.set(project.id, project);
      return project;
    },
    updateMigration: (id, patch) => {
      const existing = migrations.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      migrations.set(id, updated);
      return updated;
    },
    deleteMigration: (id) => migrations.delete(id),
    listAssessments: () => Array.from(assessments.values()),
    getAssessment: (id) => assessments.get(id),
    createAssessment: (result) => {
      assessments.set(result.id, result);
      return result;
    },
    getAssessmentByMigration: (migrationId) =>
      Array.from(assessments.values()).find((a) => a.migrationProjectId === migrationId),
    listConnectors: () => Array.from(connectors.values()),
    getConnector: (id) => connectors.get(id),
    createConnector: (config) => {
      connectors.set(config.id, config);
      return config;
    },
    updateConnector: (id, patch) => {
      const existing = connectors.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch };
      connectors.set(id, updated);
      return updated;
    },
  };
}
