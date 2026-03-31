/**
 * SQLite Database Wrapper
 *
 * Singleton that auto-creates tables on first run, provides CRUD for all
 * entities, and seeds demo data when the database is empty.
 */

import path from 'node:path';
import fs from 'node:fs';
import BetterSqlite3 from 'better-sqlite3';
import type {
  MigrationProject,
  AssessmentResult,
  AssessmentFinding,
  ConnectorConfig,
  MigrationPhase,
  MigrationItem,
  ActivityEntry,
} from '@/types';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbSession {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

// -----------------------------------------------------------------------
// Singleton
// -----------------------------------------------------------------------

let _instance: DatabaseWrapper | null = null;

export function getDatabase(): DatabaseWrapper {
  if (!_instance) {
    _instance = new DatabaseWrapper();
  }
  return _instance;
}

// -----------------------------------------------------------------------
// Database Wrapper
// -----------------------------------------------------------------------

export class DatabaseWrapper {
  private db: BetterSqlite3.Database;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath ??
      path.resolve(process.cwd(), '.data', 'blackhole.sqlite');

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(resolvedPath);

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.applySchema();
    this.seedIfEmpty();
  }

  // =====================================================================
  // Schema & Seeding
  // =====================================================================

  private applySchema(): void {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    let sql: string;
    try {
      sql = fs.readFileSync(schemaPath, 'utf-8');
    } catch {
      // When bundled, __dirname may not contain schema.sql.
      // Fall back to inline schema creation.
      sql = this.getInlineSchema();
    }

    this.db.exec(sql);
  }

  private getInlineSchema(): string {
    // Minimal inline fallback matching schema.sql
    return `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, organization_id TEXT NOT NULL,
        organization_name TEXT NOT NULL, migration_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft', products_in_scope TEXT NOT NULL DEFAULT '[]',
        compliance_requirements TEXT NOT NULL DEFAULT '[]',
        source_environment TEXT NOT NULL DEFAULT '{}', target_environment TEXT NOT NULL DEFAULT '{}',
        risk_score REAL NOT NULL DEFAULT 0.0, estimated_duration_weeks INTEGER NOT NULL DEFAULT 0,
        estimated_cost REAL NOT NULL DEFAULT 0, actual_cost REAL, progress INTEGER NOT NULL DEFAULT 0,
        target_completion_date TEXT, completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY, migration_project_id TEXT NOT NULL,
        overall_score INTEGER NOT NULL DEFAULT 0,
        code_compatibility_score INTEGER NOT NULL DEFAULT 0,
        content_readiness_score INTEGER NOT NULL DEFAULT 0,
        integration_complexity_score INTEGER NOT NULL DEFAULT 0,
        configuration_readiness_score INTEGER NOT NULL DEFAULT 0,
        compliance_score INTEGER NOT NULL DEFAULT 0,
        content_health TEXT NOT NULL DEFAULT '{}', integration_map TEXT NOT NULL DEFAULT '[]',
        risk_factors TEXT NOT NULL DEFAULT '[]', estimated_timeline TEXT NOT NULL DEFAULT '{}',
        estimated_cost TEXT NOT NULL DEFAULT '{}', traditional_estimate TEXT NOT NULL DEFAULT '{}',
        recommendations TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (migration_project_id) REFERENCES migrations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS assessment_findings (
        id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL,
        category TEXT NOT NULL, sub_category TEXT NOT NULL,
        severity TEXT NOT NULL, compatibility_level TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL,
        affected_path TEXT NOT NULL, remediation_guide TEXT NOT NULL,
        auto_fix_available INTEGER NOT NULL DEFAULT 0,
        estimated_hours REAL NOT NULL DEFAULT 0, bpa_pattern_code TEXT,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
        connection_details TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'disconnected',
        last_tested_at TEXT, capabilities TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS migration_phases (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL,
        type TEXT NOT NULL, name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft', progress INTEGER NOT NULL DEFAULT 0,
        started_at TEXT, completed_at TEXT,
        estimated_duration REAL NOT NULL DEFAULT 0, actual_duration REAL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS migration_items (
        id TEXT PRIMARY KEY, phase_id TEXT NOT NULL,
        type TEXT NOT NULL, name TEXT NOT NULL,
        source_path TEXT NOT NULL, target_path TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        compatibility_level TEXT NOT NULL DEFAULT 'compatible',
        auto_fixed INTEGER NOT NULL DEFAULT 0,
        validation_result TEXT, error TEXT, processed_at TEXT,
        FOREIGN KEY (phase_id) REFERENCES migration_phases(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL,
        migration_name TEXT NOT NULL, action TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS drift_baselines (
        migration_id TEXT PRIMARY KEY, site_url TEXT NOT NULL,
        data TEXT NOT NULL, captured_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS drift_checks (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL,
        drift_score REAL NOT NULL, alert_level TEXT NOT NULL,
        data TEXT NOT NULL, checked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preflight_reports (
        id TEXT PRIMARY KEY, migration_id TEXT NOT NULL,
        data TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `;
  }

  private seedIfEmpty(): void {
    const count = this.db
      .prepare('SELECT COUNT(*) as c FROM migrations')
      .get() as { c: number };

    if (count.c > 0) return;

    // Import and run seed data
    this.seedDemoData();
  }

  // =====================================================================
  // Transaction helper
  // =====================================================================

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Execute raw SQL (DDL / multi-statement). */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Prepare a single SQL statement for parameterized execution. */
  prepare(sql: string): BetterSqlite3.Statement {
    return this.db.prepare(sql);
  }

  // =====================================================================
  // CRUD: Migrations
  // =====================================================================

  listMigrations(): MigrationProject[] {
    const rows = this.db
      .prepare('SELECT * FROM migrations ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];

    return rows.map((r) => this.rowToMigration(r));
  }

  getMigration(id: string): MigrationProject | undefined {
    const row = this.db
      .prepare('SELECT * FROM migrations WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToMigration(row) : undefined;
  }

  createMigration(project: MigrationProject): MigrationProject {
    this.db
      .prepare(
        `INSERT INTO migrations (
          id, name, organization_id, organization_name, migration_type,
          status, products_in_scope, compliance_requirements,
          source_environment, target_environment, risk_score,
          estimated_duration_weeks, estimated_cost, actual_cost,
          progress, target_completion_date, completed_at,
          created_at, updated_at
        ) VALUES (
          @id, @name, @organizationId, @organizationName, @migrationType,
          @status, @productsInScope, @complianceRequirements,
          @sourceEnvironment, @targetEnvironment, @riskScore,
          @estimatedDurationWeeks, @estimatedCost, @actualCost,
          @progress, @targetCompletionDate, @completedAt,
          @createdAt, @updatedAt
        )`,
      )
      .run({
        id: project.id,
        name: project.name,
        organizationId: project.organizationId,
        organizationName: project.organizationName,
        migrationType: project.migrationType,
        status: project.status,
        productsInScope: JSON.stringify(project.productsInScope),
        complianceRequirements: JSON.stringify(project.complianceRequirements),
        sourceEnvironment: JSON.stringify(project.sourceEnvironment),
        targetEnvironment: JSON.stringify(project.targetEnvironment),
        riskScore: project.riskScore,
        estimatedDurationWeeks: project.estimatedDurationWeeks,
        estimatedCost: project.estimatedCost,
        actualCost: project.actualCost,
        progress: project.progress,
        targetCompletionDate: project.targetCompletionDate,
        completedAt: project.completedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });

    // Store phases
    if (project.phases.length > 0) {
      this.insertPhases(project.id, project.phases);
    }

    // Store assessment if embedded
    if (project.assessment) {
      this.createAssessment(project.assessment);
    }

    return project;
  }

  updateMigration(
    id: string,
    patch: Partial<MigrationProject>,
  ): MigrationProject | undefined {
    const existing = this.getMigration(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };

    this.db
      .prepare(
        `UPDATE migrations SET
          name = @name, organization_id = @organizationId,
          organization_name = @organizationName, migration_type = @migrationType,
          status = @status, products_in_scope = @productsInScope,
          compliance_requirements = @complianceRequirements,
          source_environment = @sourceEnvironment,
          target_environment = @targetEnvironment,
          risk_score = @riskScore, estimated_duration_weeks = @estimatedDurationWeeks,
          estimated_cost = @estimatedCost, actual_cost = @actualCost,
          progress = @progress, target_completion_date = @targetCompletionDate,
          completed_at = @completedAt, updated_at = @updatedAt
        WHERE id = @id`,
      )
      .run({
        id: updated.id,
        name: updated.name,
        organizationId: updated.organizationId,
        organizationName: updated.organizationName,
        migrationType: updated.migrationType,
        status: updated.status,
        productsInScope: JSON.stringify(updated.productsInScope),
        complianceRequirements: JSON.stringify(updated.complianceRequirements),
        sourceEnvironment: JSON.stringify(updated.sourceEnvironment),
        targetEnvironment: JSON.stringify(updated.targetEnvironment),
        riskScore: updated.riskScore,
        estimatedDurationWeeks: updated.estimatedDurationWeeks,
        estimatedCost: updated.estimatedCost,
        actualCost: updated.actualCost,
        progress: updated.progress,
        targetCompletionDate: updated.targetCompletionDate,
        completedAt: updated.completedAt,
        updatedAt: updated.updatedAt,
      });

    return updated;
  }

  deleteMigration(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM migrations WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  // =====================================================================
  // CRUD: Assessments
  // =====================================================================

  listAssessments(): AssessmentResult[] {
    const rows = this.db
      .prepare('SELECT * FROM assessments ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];

    return rows.map((r) => this.rowToAssessment(r));
  }

  getAssessment(id: string): AssessmentResult | undefined {
    const row = this.db
      .prepare('SELECT * FROM assessments WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToAssessment(row) : undefined;
  }

  getAssessmentByMigration(migrationId: string): AssessmentResult | undefined {
    const row = this.db
      .prepare('SELECT * FROM assessments WHERE migration_project_id = ?')
      .get(migrationId) as Record<string, unknown> | undefined;

    return row ? this.rowToAssessment(row) : undefined;
  }

  createAssessment(result: AssessmentResult): AssessmentResult {
    // Check if assessment already exists (idempotent for seeding)
    const existing = this.db
      .prepare('SELECT id FROM assessments WHERE id = ?')
      .get(result.id);
    if (existing) return result;

    this.db
      .prepare(
        `INSERT INTO assessments (
          id, migration_project_id, overall_score,
          code_compatibility_score, content_readiness_score,
          integration_complexity_score, configuration_readiness_score,
          compliance_score, content_health, integration_map,
          risk_factors, estimated_timeline, estimated_cost,
          traditional_estimate, recommendations, created_at
        ) VALUES (
          @id, @migrationProjectId, @overallScore,
          @codeCompatibilityScore, @contentReadinessScore,
          @integrationComplexityScore, @configurationReadinessScore,
          @complianceScore, @contentHealth, @integrationMap,
          @riskFactors, @estimatedTimeline, @estimatedCost,
          @traditionalEstimate, @recommendations, @createdAt
        )`,
      )
      .run({
        id: result.id,
        migrationProjectId: result.migrationProjectId,
        overallScore: result.overallScore,
        codeCompatibilityScore: result.codeCompatibilityScore,
        contentReadinessScore: result.contentReadinessScore,
        integrationComplexityScore: result.integrationComplexityScore,
        configurationReadinessScore: result.configurationReadinessScore,
        complianceScore: result.complianceScore,
        contentHealth: JSON.stringify(result.contentHealth),
        integrationMap: JSON.stringify(result.integrationMap),
        riskFactors: JSON.stringify(result.riskFactors),
        estimatedTimeline: JSON.stringify(result.estimatedTimeline),
        estimatedCost: JSON.stringify(result.estimatedCost),
        traditionalEstimate: JSON.stringify(result.traditionalEstimate),
        recommendations: JSON.stringify(result.recommendations),
        createdAt: result.createdAt,
      });

    // Store findings
    if (result.findings.length > 0) {
      const insertFinding = this.db.prepare(
        `INSERT INTO assessment_findings (
          id, assessment_id, category, sub_category, severity,
          compatibility_level, title, description, affected_path,
          remediation_guide, auto_fix_available, estimated_hours,
          bpa_pattern_code
        ) VALUES (
          @id, @assessmentId, @category, @subCategory, @severity,
          @compatibilityLevel, @title, @description, @affectedPath,
          @remediationGuide, @autoFixAvailable, @estimatedHours,
          @bpaPatternCode
        )`,
      );

      for (const f of result.findings) {
        insertFinding.run({
          id: f.id,
          assessmentId: result.id,
          category: f.category,
          subCategory: f.subCategory,
          severity: f.severity,
          compatibilityLevel: f.compatibilityLevel,
          title: f.title,
          description: f.description,
          affectedPath: f.affectedPath,
          remediationGuide: f.remediationGuide,
          autoFixAvailable: f.autoFixAvailable ? 1 : 0,
          estimatedHours: f.estimatedHours,
          bpaPatternCode: f.bpaPatternCode,
        });
      }
    }

    return result;
  }

  // =====================================================================
  // CRUD: Connectors
  // =====================================================================

  listConnectors(): ConnectorConfig[] {
    const rows = this.db
      .prepare('SELECT * FROM connectors ORDER BY name')
      .all() as Record<string, unknown>[];

    return rows.map((r) => this.rowToConnector(r));
  }

  getConnector(id: string): ConnectorConfig | undefined {
    const row = this.db
      .prepare('SELECT * FROM connectors WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToConnector(row) : undefined;
  }

  createConnector(config: ConnectorConfig): ConnectorConfig {
    this.db
      .prepare(
        `INSERT INTO connectors (id, type, name, connection_details, status, last_tested_at, capabilities)
         VALUES (@id, @type, @name, @connectionDetails, @status, @lastTestedAt, @capabilities)`,
      )
      .run({
        id: config.id,
        type: config.type,
        name: config.name,
        connectionDetails: JSON.stringify(config.connectionDetails),
        status: config.status,
        lastTestedAt: config.lastTestedAt,
        capabilities: JSON.stringify(config.capabilities),
      });

    return config;
  }

  updateConnector(
    id: string,
    patch: Partial<ConnectorConfig>,
  ): ConnectorConfig | undefined {
    const existing = this.getConnector(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...patch };

    this.db
      .prepare(
        `UPDATE connectors SET
          type = @type, name = @name,
          connection_details = @connectionDetails,
          status = @status, last_tested_at = @lastTestedAt,
          capabilities = @capabilities
        WHERE id = @id`,
      )
      .run({
        id: updated.id,
        type: updated.type,
        name: updated.name,
        connectionDetails: JSON.stringify(updated.connectionDetails),
        status: updated.status,
        lastTestedAt: updated.lastTestedAt,
        capabilities: JSON.stringify(updated.capabilities),
      });

    return updated;
  }

  // =====================================================================
  // CRUD: Users & Sessions
  // =====================================================================

  getUserByEmail(email: string): DbUser | undefined {
    const row = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as Record<string, unknown> | undefined;

    return row ? this.rowToUser(row) : undefined;
  }

  getUserById(id: string): DbUser | undefined {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.rowToUser(row) : undefined;
  }

  createUser(user: DbUser): DbUser {
    this.db
      .prepare(
        `INSERT INTO users (id, email, name, password, role, created_at, updated_at)
         VALUES (@id, @email, @name, @password, @role, @createdAt, @updatedAt)`,
      )
      .run({
        id: user.id,
        email: user.email,
        name: user.name,
        password: user.password,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

    return user;
  }

  createSession(session: DbSession): DbSession {
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at)
         VALUES (@id, @userId, @expiresAt, @createdAt)`,
      )
      .run({
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      });

    return session;
  }

  getSession(id: string): DbSession | undefined {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return undefined;

    return {
      id: row.id as string,
      userId: row.user_id as string,
      expiresAt: row.expires_at as string,
      createdAt: row.created_at as string,
    };
  }

  deleteSession(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM sessions WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  deleteExpiredSessions(): number {
    const result = this.db
      .prepare("DELETE FROM sessions WHERE expires_at < datetime('now')")
      .run();
    return result.changes;
  }

  // =====================================================================
  // CRUD: Activity Log
  // =====================================================================

  listActivity(limit = 20): ActivityEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id as string,
      migrationId: r.migration_id as string,
      migrationName: r.migration_name as string,
      action: r.action as string,
      timestamp: r.timestamp as string,
      details: r.details as string,
    }));
  }

  // =====================================================================
  // Row-to-Object Mappers
  // =====================================================================

  private rowToMigration(r: Record<string, unknown>): MigrationProject {
    const migId = r.id as string;
    const assessment = this.getAssessmentByMigration(migId) ?? null;
    const phases = this.getPhasesByMigration(migId);

    return {
      id: migId,
      name: r.name as string,
      organizationId: r.organization_id as string,
      organizationName: r.organization_name as string,
      migrationType: r.migration_type as MigrationProject['migrationType'],
      status: r.status as MigrationProject['status'],
      productsInScope: JSON.parse(r.products_in_scope as string),
      complianceRequirements: JSON.parse(r.compliance_requirements as string),
      sourceEnvironment: JSON.parse(r.source_environment as string),
      targetEnvironment: JSON.parse(r.target_environment as string),
      assessment,
      phases,
      riskScore: r.risk_score as number,
      estimatedDurationWeeks: r.estimated_duration_weeks as number,
      estimatedCost: r.estimated_cost as number,
      actualCost: (r.actual_cost as number) ?? null,
      progress: r.progress as number,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      targetCompletionDate: (r.target_completion_date as string) ?? null,
      completedAt: (r.completed_at as string) ?? null,
    };
  }

  private rowToAssessment(r: Record<string, unknown>): AssessmentResult {
    const assessmentId = r.id as string;
    const findingRows = this.db
      .prepare('SELECT * FROM assessment_findings WHERE assessment_id = ?')
      .all(assessmentId) as Record<string, unknown>[];

    const findings: AssessmentFinding[] = findingRows.map((f) => ({
      id: f.id as string,
      category: f.category as string,
      subCategory: f.sub_category as string,
      severity: f.severity as AssessmentFinding['severity'],
      compatibilityLevel: f.compatibility_level as AssessmentFinding['compatibilityLevel'],
      title: f.title as string,
      description: f.description as string,
      affectedPath: f.affected_path as string,
      remediationGuide: f.remediation_guide as string,
      autoFixAvailable: (f.auto_fix_available as number) === 1,
      estimatedHours: f.estimated_hours as number,
      bpaPatternCode: (f.bpa_pattern_code as string) ?? null,
    }));

    return {
      id: assessmentId,
      migrationProjectId: r.migration_project_id as string,
      overallScore: r.overall_score as number,
      codeCompatibilityScore: r.code_compatibility_score as number,
      contentReadinessScore: r.content_readiness_score as number,
      integrationComplexityScore: r.integration_complexity_score as number,
      configurationReadinessScore: r.configuration_readiness_score as number,
      complianceScore: r.compliance_score as number,
      findings,
      contentHealth: JSON.parse(r.content_health as string),
      integrationMap: JSON.parse(r.integration_map as string),
      riskFactors: JSON.parse(r.risk_factors as string),
      estimatedTimeline: JSON.parse(r.estimated_timeline as string),
      estimatedCost: JSON.parse(r.estimated_cost as string),
      traditionalEstimate: JSON.parse(r.traditional_estimate as string),
      recommendations: JSON.parse(r.recommendations as string),
      createdAt: r.created_at as string,
    };
  }

  private rowToConnector(r: Record<string, unknown>): ConnectorConfig {
    return {
      id: r.id as string,
      type: r.type as string,
      name: r.name as string,
      connectionDetails: JSON.parse(r.connection_details as string),
      status: r.status as ConnectorConfig['status'],
      lastTestedAt: (r.last_tested_at as string) ?? null,
      capabilities: JSON.parse(r.capabilities as string),
    };
  }

  private rowToUser(r: Record<string, unknown>): DbUser {
    return {
      id: r.id as string,
      email: r.email as string,
      name: r.name as string,
      password: r.password as string,
      role: r.role as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  }

  // =====================================================================
  // Phases & Items helpers
  // =====================================================================

  private getPhasesByMigration(migrationId: string): MigrationPhase[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM migration_phases WHERE migration_id = ? ORDER BY sort_order',
      )
      .all(migrationId) as Record<string, unknown>[];

    return rows.map((r) => {
      const phaseId = r.id as string;
      const itemRows = this.db
        .prepare('SELECT * FROM migration_items WHERE phase_id = ?')
        .all(phaseId) as Record<string, unknown>[];

      const items: MigrationItem[] = itemRows.map((i) => ({
        id: i.id as string,
        type: i.type as string,
        name: i.name as string,
        sourcePath: i.source_path as string,
        targetPath: (i.target_path as string) ?? null,
        status: i.status as MigrationItem['status'],
        compatibilityLevel: i.compatibility_level as MigrationItem['compatibilityLevel'],
        autoFixed: (i.auto_fixed as number) === 1,
        validationResult: i.validation_result
          ? JSON.parse(i.validation_result as string)
          : null,
        error: (i.error as string) ?? null,
        processedAt: (i.processed_at as string) ?? null,
      }));

      return {
        id: phaseId,
        type: r.type as MigrationPhase['type'],
        name: r.name as string,
        status: r.status as MigrationPhase['status'],
        progress: r.progress as number,
        items,
        startedAt: (r.started_at as string) ?? null,
        completedAt: (r.completed_at as string) ?? null,
        estimatedDuration: r.estimated_duration as number,
        actualDuration: (r.actual_duration as number) ?? null,
      };
    });
  }

  private insertPhases(migrationId: string, phases: MigrationPhase[]): void {
    const insertPhase = this.db.prepare(
      `INSERT INTO migration_phases (
        id, migration_id, type, name, status, progress,
        started_at, completed_at, estimated_duration, actual_duration, sort_order
      ) VALUES (
        @id, @migrationId, @type, @name, @status, @progress,
        @startedAt, @completedAt, @estimatedDuration, @actualDuration, @sortOrder
      )`,
    );

    const insertItem = this.db.prepare(
      `INSERT INTO migration_items (
        id, phase_id, type, name, source_path, target_path,
        status, compatibility_level, auto_fixed, validation_result,
        error, processed_at
      ) VALUES (
        @id, @phaseId, @type, @name, @sourcePath, @targetPath,
        @status, @compatibilityLevel, @autoFixed, @validationResult,
        @error, @processedAt
      )`,
    );

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      insertPhase.run({
        id: phase.id,
        migrationId,
        type: phase.type,
        name: phase.name,
        status: phase.status,
        progress: phase.progress,
        startedAt: phase.startedAt,
        completedAt: phase.completedAt,
        estimatedDuration: phase.estimatedDuration,
        actualDuration: phase.actualDuration,
        sortOrder: i,
      });

      for (const item of phase.items) {
        insertItem.run({
          id: item.id,
          phaseId: phase.id,
          type: item.type,
          name: item.name,
          sourcePath: item.sourcePath,
          targetPath: item.targetPath,
          status: item.status,
          compatibilityLevel: item.compatibilityLevel,
          autoFixed: item.autoFixed ? 1 : 0,
          validationResult: item.validationResult
            ? JSON.stringify(item.validationResult)
            : null,
          error: item.error,
          processedAt: item.processedAt,
        });
      }
    }
  }

  // =====================================================================
  // Demo Seed Data
  // =====================================================================

  private seedDemoData(): void {
    // Re-use the exact same data from the original store.ts by importing it.
    // We call the seed module which pushes data through our CRUD methods.
    const { seedDatabase } = require('./seed');
    seedDatabase(this);
  }

  // =====================================================================
  // Close
  // =====================================================================

  close(): void {
    this.db.close();
    if (_instance === this) {
      _instance = null;
    }
  }
}
