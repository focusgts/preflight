/**
 * Integration Tests for API Routes
 *
 * Tests the expected API behavior for migration, assessment,
 * connector, and health endpoints. Uses an in-memory store
 * to simulate the API layer since the actual Next.js route
 * handlers are not yet implemented.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import {
  MigrationStatus,
  MigrationType,
  AdobeProduct,
  ComplianceFramework,
} from '@/types';
import type {
  MigrationProject,
  AssessmentResult,
  ConnectorConfig,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

// ---- In-memory API simulation ----

interface Store {
  migrations: Map<string, MigrationProject>;
  assessments: Map<string, AssessmentResult>;
  connectors: Map<string, ConnectorConfig>;
}

function createStore(): Store {
  return {
    migrations: new Map(),
    assessments: new Map(),
    connectors: new Map(),
  };
}

function makeApiResponse<T>(data: T | null, error: { code: string; message: string } | null = null): ApiResponse<T> {
  return {
    success: !error,
    data,
    error: error ? { code: error.code, message: error.message, details: null } : null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuid(),
    },
  };
}

function makePaginatedResponse<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return {
    success: true,
    data: paginatedItems,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuid(),
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

// ---- API handlers ----

function createMigration(
  store: Store,
  body: Partial<MigrationProject>,
): ApiResponse<MigrationProject> {
  if (!body.name) return makeApiResponse(null, { code: 'VALIDATION_ERROR', message: 'name is required' });
  if (!body.migrationType) return makeApiResponse(null, { code: 'VALIDATION_ERROR', message: 'migrationType is required' });

  const project: MigrationProject = {
    id: uuid(),
    name: body.name,
    organizationId: body.organizationId ?? 'org-default',
    organizationName: body.organizationName ?? 'Default Org',
    migrationType: body.migrationType,
    status: MigrationStatus.DRAFT,
    productsInScope: body.productsInScope ?? [],
    complianceRequirements: body.complianceRequirements ?? [],
    sourceEnvironment: body.sourceEnvironment ?? {
      platform: 'aem_6x',
      version: '6.5',
      url: null,
      connectionType: 'api',
      credentials: null,
      metadata: {},
    },
    targetEnvironment: body.targetEnvironment ?? {
      platform: 'aem_cloud',
      organizationId: 'org-default',
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
  };

  store.migrations.set(project.id, project);
  return makeApiResponse(project);
}

function listMigrations(
  store: Store,
  filters: { status?: MigrationStatus; type?: MigrationType },
  page: number = 1,
  pageSize: number = 10,
): PaginatedResponse<MigrationProject> {
  let items = Array.from(store.migrations.values());

  if (filters.status) {
    items = items.filter((m) => m.status === filters.status);
  }
  if (filters.type) {
    items = items.filter((m) => m.migrationType === filters.type);
  }

  return makePaginatedResponse(items, page, pageSize);
}

function getMigration(store: Store, id: string): ApiResponse<MigrationProject> {
  const project = store.migrations.get(id);
  if (!project) return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Migration not found' });
  return makeApiResponse(project);
}

function updateMigration(
  store: Store,
  id: string,
  updates: Partial<MigrationProject>,
): ApiResponse<MigrationProject> {
  const project = store.migrations.get(id);
  if (!project) return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Migration not found' });

  const updated = { ...project, ...updates, id: project.id, updatedAt: new Date().toISOString() };
  store.migrations.set(id, updated);
  return makeApiResponse(updated);
}

function deleteMigration(store: Store, id: string): ApiResponse<{ deleted: boolean }> {
  if (!store.migrations.has(id)) {
    return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Migration not found' });
  }
  store.migrations.delete(id);
  return makeApiResponse({ deleted: true });
}

function createAssessment(
  store: Store,
  migrationId: string,
): ApiResponse<AssessmentResult> {
  if (!store.migrations.has(migrationId)) {
    return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Migration not found' });
  }

  const assessment: AssessmentResult = {
    id: uuid(),
    migrationProjectId: migrationId,
    overallScore: 75,
    codeCompatibilityScore: 80,
    contentReadinessScore: 70,
    integrationComplexityScore: 65,
    configurationReadinessScore: 85,
    complianceScore: 90,
    findings: [],
    contentHealth: {
      totalPages: 500,
      totalAssets: 1200,
      totalContentFragments: 50,
      totalExperienceFragments: 20,
      duplicatesDetected: 15,
      brokenReferences: 8,
      metadataCompleteness: 72,
      structuralIssues: 3,
      totalSizeGB: 4.5,
      publishedPercentage: 65,
    },
    integrationMap: [],
    riskFactors: [],
    estimatedTimeline: {
      totalWeeks: 12,
      phases: [],
      confidenceLevel: 0.75,
    },
    estimatedCost: {
      platformFee: 15000,
      estimatedSIHours: 480,
      estimatedSICost: 96000,
      totalEstimate: 111000,
      currency: 'USD',
    },
    traditionalEstimate: {
      durationWeeks: 30,
      cost: 275000,
      timeSavingsPercent: 60,
      costSavingsPercent: 60,
    },
    recommendations: ['Modernize OSGi configurations', 'Update dispatcher configs'],
    createdAt: new Date().toISOString(),
  };

  store.assessments.set(assessment.id, assessment);

  // Update migration
  const migration = store.migrations.get(migrationId)!;
  migration.assessment = assessment;
  migration.status = MigrationStatus.ASSESSED;
  store.migrations.set(migrationId, migration);

  return makeApiResponse(assessment);
}

function getAssessment(store: Store, id: string): ApiResponse<AssessmentResult> {
  const assessment = store.assessments.get(id);
  if (!assessment) return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Assessment not found' });
  return makeApiResponse(assessment);
}

function createConnector(
  store: Store,
  config: Partial<ConnectorConfig>,
): ApiResponse<ConnectorConfig> {
  if (!config.type) return makeApiResponse(null, { code: 'VALIDATION_ERROR', message: 'type is required' });
  if (!config.name) return makeApiResponse(null, { code: 'VALIDATION_ERROR', message: 'name is required' });

  const connector: ConnectorConfig = {
    id: uuid(),
    type: config.type,
    name: config.name,
    connectionDetails: config.connectionDetails ?? {},
    status: 'disconnected',
    lastTestedAt: null,
    capabilities: config.capabilities ?? [],
  };

  store.connectors.set(connector.id, connector);
  return makeApiResponse(connector);
}

function testConnector(store: Store, id: string): ApiResponse<{ success: boolean; message: string }> {
  const connector = store.connectors.get(id);
  if (!connector) return makeApiResponse(null, { code: 'NOT_FOUND', message: 'Connector not found' });

  const hasBaseUrl = !!connector.connectionDetails.baseUrl;
  connector.status = hasBaseUrl ? 'connected' : 'error';
  connector.lastTestedAt = new Date().toISOString();
  store.connectors.set(id, connector);

  return makeApiResponse({
    success: hasBaseUrl,
    message: hasBaseUrl ? 'Connection successful' : 'Connection failed: missing baseUrl',
  });
}

function getHealth(): ApiResponse<{ status: string; version: string; uptime: number }> {
  return makeApiResponse({
    status: 'healthy',
    version: '0.1.0',
    uptime: 12345,
  });
}

// ============================================================
// Tests
// ============================================================

describe('API Integration Tests', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore();
  });

  // ----------------------------------------------------------
  // POST /api/migrations
  // ----------------------------------------------------------

  describe('POST /api/migrations', () => {
    it('should create a migration with valid data', () => {
      const response = createMigration(store, {
        name: 'AEM 6.5 to Cloud Service',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
        productsInScope: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS],
      });

      expect(response.success).toBe(true);
      expect(response.data?.id).toBeDefined();
      expect(response.data?.name).toBe('AEM 6.5 to Cloud Service');
      expect(response.data?.status).toBe(MigrationStatus.DRAFT);
      expect(response.data?.productsInScope).toContain(AdobeProduct.AEM_SITES);
    });

    it('should return error when name is missing', () => {
      const response = createMigration(store, {
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return error when migrationType is missing', () => {
      const response = createMigration(store, { name: 'Test' });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should set default status to DRAFT', () => {
      const response = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      expect(response.data?.status).toBe(MigrationStatus.DRAFT);
    });

    it('should set timestamps on creation', () => {
      const response = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.WORDPRESS_TO_AEM,
      });

      expect(response.data?.createdAt).toBeDefined();
      expect(response.data?.updatedAt).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // GET /api/migrations
  // ----------------------------------------------------------

  describe('GET /api/migrations', () => {
    it('should list all migrations', () => {
      createMigration(store, { name: 'Proj 1', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      createMigration(store, { name: 'Proj 2', migrationType: MigrationType.WORDPRESS_TO_AEM });

      const response = listMigrations(store, {});

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
    });

    it('should filter by status', () => {
      const created = createMigration(store, { name: 'Proj', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      updateMigration(store, created.data!.id, { status: MigrationStatus.EXECUTING });

      createMigration(store, { name: 'Draft', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });

      const response = listMigrations(store, { status: MigrationStatus.DRAFT });

      expect(response.data).toHaveLength(1);
      expect(response.data![0].name).toBe('Draft');
    });

    it('should filter by migration type', () => {
      createMigration(store, { name: 'AEM', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      createMigration(store, { name: 'WP', migrationType: MigrationType.WORDPRESS_TO_AEM });

      const response = listMigrations(store, { type: MigrationType.WORDPRESS_TO_AEM });

      expect(response.data).toHaveLength(1);
      expect(response.data![0].name).toBe('WP');
    });

    it('should return empty list when no migrations exist', () => {
      const response = listMigrations(store, {});
      expect(response.data).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // GET /api/migrations/[id]
  // ----------------------------------------------------------

  describe('GET /api/migrations/[id]', () => {
    it('should retrieve a migration by ID', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      const response = getMigration(store, created.data!.id);

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe('Test');
    });

    it('should return 404 for non-existent migration', () => {
      const response = getMigration(store, 'nonexistent-id');

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // PATCH /api/migrations/[id]
  // ----------------------------------------------------------

  describe('PATCH /api/migrations/[id]', () => {
    it('should update migration status', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      const response = updateMigration(store, created.data!.id, {
        status: MigrationStatus.EXECUTING,
      });

      expect(response.success).toBe(true);
      expect(response.data?.status).toBe(MigrationStatus.EXECUTING);
    });

    it('should update migration progress', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      const response = updateMigration(store, created.data!.id, { progress: 50 });

      expect(response.data?.progress).toBe(50);
    });

    it('should set updatedAt on update', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });

      const response = updateMigration(store, created.data!.id, { progress: 25 });

      expect(response.data?.updatedAt).toBeDefined();
      const ts = new Date(response.data!.updatedAt);
      expect(ts.getTime()).not.toBeNaN();
    });

    it('should not allow changing the ID', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      const response = updateMigration(store, created.data!.id, { id: 'different-id' } as Partial<MigrationProject>);

      expect(response.data?.id).toBe(created.data!.id);
    });

    it('should return 404 for non-existent migration', () => {
      const response = updateMigration(store, 'nonexistent', { progress: 50 });
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // DELETE /api/migrations/[id]
  // ----------------------------------------------------------

  describe('DELETE /api/migrations/[id]', () => {
    it('should delete an existing migration', () => {
      const created = createMigration(store, { name: 'Test', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      const response = deleteMigration(store, created.data!.id);

      expect(response.success).toBe(true);
      expect(response.data?.deleted).toBe(true);

      const getResponse = getMigration(store, created.data!.id);
      expect(getResponse.success).toBe(false);
    });

    it('should return 404 for non-existent migration', () => {
      const response = deleteMigration(store, 'nonexistent');
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // POST /api/assessments
  // ----------------------------------------------------------

  describe('POST /api/assessments', () => {
    it('should create an assessment for a valid migration', () => {
      const migration = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      const response = createAssessment(store, migration.data!.id);

      expect(response.success).toBe(true);
      expect(response.data?.overallScore).toBeGreaterThan(0);
      expect(response.data?.migrationProjectId).toBe(migration.data!.id);
    });

    it('should update migration status to ASSESSED', () => {
      const migration = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      createAssessment(store, migration.data!.id);

      const updated = getMigration(store, migration.data!.id);
      expect(updated.data?.status).toBe(MigrationStatus.ASSESSED);
    });

    it('should include content health data', () => {
      const migration = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      const response = createAssessment(store, migration.data!.id);

      expect(response.data?.contentHealth.totalPages).toBeGreaterThan(0);
      expect(response.data?.contentHealth.totalAssets).toBeGreaterThan(0);
    });

    it('should include cost estimates', () => {
      const migration = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });

      const response = createAssessment(store, migration.data!.id);

      expect(response.data?.estimatedCost.totalEstimate).toBeGreaterThan(0);
      expect(response.data?.estimatedCost.currency).toBe('USD');
    });

    it('should return error for non-existent migration', () => {
      const response = createAssessment(store, 'nonexistent');
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // GET /api/assessments/[id]
  // ----------------------------------------------------------

  describe('GET /api/assessments/[id]', () => {
    it('should retrieve an assessment by ID', () => {
      const migration = createMigration(store, {
        name: 'Test',
        migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      });
      const created = createAssessment(store, migration.data!.id);
      const response = getAssessment(store, created.data!.id);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(created.data!.id);
    });

    it('should return 404 for non-existent assessment', () => {
      const response = getAssessment(store, 'nonexistent');
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------
  // POST /api/connectors
  // ----------------------------------------------------------

  describe('POST /api/connectors', () => {
    it('should create a connector with valid config', () => {
      const response = createConnector(store, {
        type: 'aem',
        name: 'Production AEM',
        connectionDetails: {
          baseUrl: 'https://author.aem.example.com',
          authType: 'basic',
          username: 'admin',
        },
      });

      expect(response.success).toBe(true);
      expect(response.data?.id).toBeDefined();
      expect(response.data?.status).toBe('disconnected');
    });

    it('should return error when type is missing', () => {
      const response = createConnector(store, { name: 'Test' });
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return error when name is missing', () => {
      const response = createConnector(store, { type: 'aem' });
      expect(response.success).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // POST /api/connectors/[id]/test
  // ----------------------------------------------------------

  describe('POST /api/connectors/[id]/test', () => {
    it('should test connector and update status to connected', () => {
      const connector = createConnector(store, {
        type: 'aem',
        name: 'Test AEM',
        connectionDetails: { baseUrl: 'https://aem.example.com' },
      });

      const response = testConnector(store, connector.data!.id);

      expect(response.success).toBe(true);
      expect(response.data?.success).toBe(true);
    });

    it('should update lastTestedAt', () => {
      const connector = createConnector(store, {
        type: 'aem',
        name: 'Test AEM',
        connectionDetails: { baseUrl: 'https://aem.example.com' },
      });

      testConnector(store, connector.data!.id);

      const updated = store.connectors.get(connector.data!.id);
      expect(updated?.lastTestedAt).not.toBeNull();
    });

    it('should set status to error when no baseUrl', () => {
      const connector = createConnector(store, {
        type: 'aem',
        name: 'Test AEM',
        connectionDetails: {},
      });

      const response = testConnector(store, connector.data!.id);

      expect(response.data?.success).toBe(false);
      const updated = store.connectors.get(connector.data!.id);
      expect(updated?.status).toBe('error');
    });

    it('should return 404 for non-existent connector', () => {
      const response = testConnector(store, 'nonexistent');
      expect(response.success).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // GET /api/health
  // ----------------------------------------------------------

  describe('GET /api/health', () => {
    it('should return healthy status', () => {
      const response = getHealth();

      expect(response.success).toBe(true);
      expect(response.data?.status).toBe('healthy');
      expect(response.data?.version).toBeDefined();
      expect(response.data?.uptime).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // Error Responses
  // ----------------------------------------------------------

  describe('error responses', () => {
    it('should include error code in response', () => {
      const response = getMigration(store, 'bad-id');

      expect(response.error?.code).toBe('NOT_FOUND');
      expect(response.error?.message).toBeDefined();
    });

    it('should include requestId in meta', () => {
      const response = getMigration(store, 'bad-id');

      expect(response.meta.requestId).toBeDefined();
      expect(response.meta.requestId.length).toBeGreaterThan(0);
    });

    it('should include timestamp in meta', () => {
      const response = getMigration(store, 'bad-id');

      expect(response.meta.timestamp).toBeDefined();
      const ts = new Date(response.meta.timestamp);
      expect(ts.getTime()).not.toBeNaN();
    });
  });

  // ----------------------------------------------------------
  // Pagination
  // ----------------------------------------------------------

  describe('pagination', () => {
    it('should paginate results', () => {
      for (let i = 0; i < 25; i++) {
        createMigration(store, { name: `Proj ${i}`, migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      }

      const page1 = listMigrations(store, {}, 1, 10);
      const page2 = listMigrations(store, {}, 2, 10);
      const page3 = listMigrations(store, {}, 3, 10);

      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page3.data).toHaveLength(5);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.totalItems).toBe(25);
    });

    it('should return correct pagination metadata', () => {
      for (let i = 0; i < 5; i++) {
        createMigration(store, { name: `Proj ${i}`, migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });
      }

      const response = listMigrations(store, {}, 1, 2);

      expect(response.pagination.page).toBe(1);
      expect(response.pagination.pageSize).toBe(2);
      expect(response.pagination.totalItems).toBe(5);
      expect(response.pagination.totalPages).toBe(3);
    });

    it('should return empty data for page beyond range', () => {
      createMigration(store, { name: 'Proj', migrationType: MigrationType.AEM_ONPREM_TO_CLOUD });

      const response = listMigrations(store, {}, 5, 10);

      expect(response.data).toHaveLength(0);
    });
  });
});
