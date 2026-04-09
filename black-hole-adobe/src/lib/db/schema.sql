-- Black Hole for Adobe Marketing Cloud - SQLite Schema
-- Auto-applied on first run by database.ts

-- ============================================================
-- Migrations (projects)
-- ============================================================

CREATE TABLE IF NOT EXISTS migrations (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  organization_name      TEXT NOT NULL,
  migration_type         TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft',
  products_in_scope      TEXT NOT NULL DEFAULT '[]',       -- JSON array
  compliance_requirements TEXT NOT NULL DEFAULT '[]',      -- JSON array
  source_environment     TEXT NOT NULL DEFAULT '{}',       -- JSON object
  target_environment     TEXT NOT NULL DEFAULT '{}',       -- JSON object
  risk_score             REAL NOT NULL DEFAULT 0.0,
  estimated_duration_weeks INTEGER NOT NULL DEFAULT 0,
  estimated_cost         REAL NOT NULL DEFAULT 0,
  actual_cost            REAL,
  progress               INTEGER NOT NULL DEFAULT 0,
  target_completion_date TEXT,
  completed_at           TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_migrations_status ON migrations(status);
CREATE INDEX IF NOT EXISTS idx_migrations_org ON migrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_migrations_type ON migrations(migration_type);

-- ============================================================
-- Assessments
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
  id                           TEXT PRIMARY KEY,
  migration_project_id         TEXT NOT NULL,
  overall_score                INTEGER NOT NULL DEFAULT 0,
  code_compatibility_score     INTEGER NOT NULL DEFAULT 0,
  content_readiness_score      INTEGER NOT NULL DEFAULT 0,
  integration_complexity_score INTEGER NOT NULL DEFAULT 0,
  configuration_readiness_score INTEGER NOT NULL DEFAULT 0,
  compliance_score             INTEGER NOT NULL DEFAULT 0,
  content_health               TEXT NOT NULL DEFAULT '{}',  -- JSON
  integration_map              TEXT NOT NULL DEFAULT '[]',  -- JSON array
  risk_factors                 TEXT NOT NULL DEFAULT '[]',  -- JSON array
  estimated_timeline           TEXT NOT NULL DEFAULT '{}',  -- JSON
  estimated_cost               TEXT NOT NULL DEFAULT '{}',  -- JSON
  traditional_estimate         TEXT NOT NULL DEFAULT '{}',  -- JSON
  recommendations              TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at                   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (migration_project_id) REFERENCES migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessments_migration ON assessments(migration_project_id);

-- ============================================================
-- Assessment Findings
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_findings (
  id                  TEXT PRIMARY KEY,
  assessment_id       TEXT NOT NULL,
  category            TEXT NOT NULL,
  sub_category        TEXT NOT NULL,
  severity            TEXT NOT NULL,
  compatibility_level TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  affected_path       TEXT NOT NULL,
  remediation_guide   TEXT NOT NULL,
  auto_fix_available  INTEGER NOT NULL DEFAULT 0,
  estimated_hours     REAL NOT NULL DEFAULT 0,
  bpa_pattern_code    TEXT,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_findings_assessment ON assessment_findings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON assessment_findings(severity);

-- ============================================================
-- Connectors
-- ============================================================

CREATE TABLE IF NOT EXISTS connectors (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL,
  name               TEXT NOT NULL,
  connection_details TEXT NOT NULL DEFAULT '{}',  -- JSON
  status             TEXT NOT NULL DEFAULT 'disconnected',
  last_tested_at     TEXT,
  capabilities       TEXT NOT NULL DEFAULT '[]'   -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);

-- ============================================================
-- Migration Phases
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_phases (
  id                 TEXT PRIMARY KEY,
  migration_id       TEXT NOT NULL,
  type               TEXT NOT NULL,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft',
  progress           INTEGER NOT NULL DEFAULT 0,
  started_at         TEXT,
  completed_at       TEXT,
  estimated_duration REAL NOT NULL DEFAULT 0,
  actual_duration    REAL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_phases_migration ON migration_phases(migration_id);

-- ============================================================
-- Migration Items
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_items (
  id                  TEXT PRIMARY KEY,
  phase_id            TEXT NOT NULL,
  type                TEXT NOT NULL,
  name                TEXT NOT NULL,
  source_path         TEXT NOT NULL,
  target_path         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  compatibility_level TEXT NOT NULL DEFAULT 'compatible',
  auto_fixed          INTEGER NOT NULL DEFAULT 0,
  validation_result   TEXT,  -- JSON or null
  error               TEXT,
  processed_at        TEXT,
  FOREIGN KEY (phase_id) REFERENCES migration_phases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_phase ON migration_items(phase_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON migration_items(status);

-- ============================================================
-- Activity Log
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id             TEXT PRIMARY KEY,
  migration_id   TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  action         TEXT NOT NULL,
  details        TEXT NOT NULL DEFAULT '',
  timestamp      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_migration ON activity_log(migration_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp DESC);

-- ============================================================
-- Users
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,  -- hashed
  role       TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,  -- session token
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- Drift Baselines (ADR-035)
-- ============================================================

CREATE TABLE IF NOT EXISTS drift_baselines (
  migration_id TEXT PRIMARY KEY,
  site_url     TEXT NOT NULL,
  data         TEXT NOT NULL,  -- JSON serialized DriftBaseline
  captured_at  TEXT NOT NULL
);

-- ============================================================
-- Drift Checks (ADR-035)
-- ============================================================

CREATE TABLE IF NOT EXISTS drift_checks (
  id            TEXT PRIMARY KEY,
  migration_id  TEXT NOT NULL,
  drift_score   REAL NOT NULL,
  alert_level   TEXT NOT NULL,
  data          TEXT NOT NULL,  -- JSON serialized DriftCheck
  checked_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drift_checks_migration ON drift_checks(migration_id);
CREATE INDEX IF NOT EXISTS idx_drift_checks_checked_at ON drift_checks(checked_at DESC);

-- ============================================================
-- Pre-Flight Reports (ADR-036)
-- ============================================================

CREATE TABLE IF NOT EXISTS preflight_reports (
  id            TEXT PRIMARY KEY,
  migration_id  TEXT NOT NULL,
  data          TEXT NOT NULL,  -- JSON serialized PreFlightReport
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preflight_reports_migration ON preflight_reports(migration_id);

-- ============================================================
-- Migration Audit Log (ADR-061)
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_audit_log (
  id              TEXT PRIMARY KEY,
  migration_id    TEXT NOT NULL,
  correlation_id  TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  operation       TEXT NOT NULL,
  item_path       TEXT,
  status          TEXT NOT NULL,
  duration_ms     INTEGER,
  error_code      TEXT,
  error_category  TEXT,
  error_message   TEXT,
  metadata        TEXT  -- JSON or null
);

CREATE INDEX IF NOT EXISTS idx_audit_migration ON migration_audit_log(migration_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON migration_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_status ON migration_audit_log(status);

-- ============================================================
-- Public Pre-Flight Leads (ADR-064)
-- ============================================================
-- Separate from the main `leads` table because public pre-flight
-- lead capture is email-only (no name/company required).

CREATE TABLE IF NOT EXISTS preflight_leads (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'preflight-public',
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_preflight_leads_email
  ON preflight_leads(email);
CREATE INDEX IF NOT EXISTS idx_preflight_leads_created_at
  ON preflight_leads(created_at DESC);

-- ============================================================
-- Analytics Events (ADR-064)
-- ============================================================
-- Lightweight, privacy-friendly analytics for the public pre-flight
-- funnel. No PII beyond an optional IP; properties are opaque JSON.

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  event       TEXT NOT NULL,
  path        TEXT,
  properties  TEXT NOT NULL DEFAULT '{}',  -- JSON
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event
  ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON analytics_events(created_at DESC);

-- ============================================================
-- Migration State History (ADR-062)
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_state_history (
  id             TEXT PRIMARY KEY,
  migration_id   TEXT NOT NULL,
  from_state     TEXT,
  to_state       TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  triggered_by   TEXT,
  timestamp      TEXT NOT NULL,
  metadata       TEXT  -- JSON or null
);

CREATE INDEX IF NOT EXISTS idx_state_history_migration ON migration_state_history(migration_id);
CREATE INDEX IF NOT EXISTS idx_state_history_timestamp ON migration_state_history(timestamp);
