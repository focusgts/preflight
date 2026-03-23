/**
 * Migration-as-Code Unit Tests
 *
 * Tests for schema validation, parsing, env var resolution,
 * config merging, templates, dry-run, diff, and export.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationConfigParser, EnvVarError } from '@/lib/mac/parser';
import { MigrationConfigExecutor } from '@/lib/mac/executor';
import { getTemplate, getTemplateList } from '@/lib/mac/templates';
import {
  MigrationConfigSchema,
  TEMPLATE_NAMES,
  type MigrationConfig,
  type TemplateName,
} from '@/lib/mac/schema';
import { PhaseType, AdobeProduct, MigrationType } from '@/types';

// ── Helpers ──────────────────────────────────────────────────

function validConfig(): MigrationConfig {
  return {
    metadata: {
      name: 'Test Migration',
      version: '1.0.0',
      description: 'A test migration config',
      author: 'Tester',
      created: '2026-03-22T00:00:00Z',
    },
    source: {
      platform: 'aem_6x',
      version: '6.5.18',
      url: 'https://author.example.com',
      auth: {
        type: 'basic',
        credentials: '${AEM_SOURCE_CREDS}',
      },
    },
    target: {
      platform: 'aem_cloud',
      url: 'https://author-p123-e456.adobeaemcloud.com',
      programId: '123',
      environmentId: '456',
      auth: {
        type: 'oauth_s2s',
        credentials: '${AEM_CLOUD_CREDS}',
      },
    },
    scope: {
      products: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS],
      sites: {
        include: ['/content/mysite'],
        exclude: ['/content/mysite/archive'],
      },
      contentPaths: ['/content/mysite'],
      maxSizeGB: 100,
    },
    phases: [
      {
        type: PhaseType.ASSESSMENT,
        enabled: true,
        retries: 1,
        continueOnError: false,
        concurrency: 5,
      },
      {
        type: PhaseType.CONTENT_MIGRATION,
        enabled: true,
        retries: 3,
        continueOnError: true,
        concurrency: 10,
      },
    ],
    rules: [
      {
        name: 'Replace paths',
        type: 'path_mapping',
        enabled: true,
        sourcePath: '/old',
        targetPath: '/new',
      },
    ],
    compliance: {
      frameworks: ['gdpr' as never],
      piiHandling: {
        strategy: 'encrypt',
        fields: ['email'],
        auditLog: true,
      },
    },
    rollback: {
      enabled: true,
      errorThresholdPercent: 10,
      validationFailureThreshold: 5,
      autoRollback: false,
      snapshotBeforeCutover: true,
      notifyOnRollback: true,
    },
  };
}

function validYAML(): string {
  return `
metadata:
  name: "Test Migration"
  version: "1.0.0"
  author: "Tester"

source:
  platform: aem_6x
  version: "6.5.18"

target:
  platform: aem_cloud

scope:
  products:
    - aem-sites
  contentPaths:
    - /content/mysite

phases:
  - type: assessment
    enabled: true
    retries: 1
    continueOnError: false
    concurrency: 5
`;
}

// ============================================================
// Tests
// ============================================================

describe('MigrationConfigParser', () => {
  let parser: MigrationConfigParser;

  beforeEach(() => {
    parser = new MigrationConfigParser();
  });

  // ── YAML Parsing ─────────────────────────────────────────

  it('should parse valid YAML config', () => {
    const result = parser.parseYAML(validYAML());
    expect(result.valid).toBe(true);
    expect(result.config).not.toBeNull();
    expect(result.config?.metadata.name).toBe('Test Migration');
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for invalid YAML syntax', () => {
    const result = parser.parseYAML('{ invalid yaml: [}');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('YAML parse error');
  });

  it('should return errors for empty YAML object', () => {
    const result = parser.parseYAML('null');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('YAML object');
  });

  it('should return errors for missing required fields', () => {
    const result = parser.parseYAML(`
metadata:
  name: "Test"
  version: "1.0.0"
  author: "Me"
source:
  platform: aem_6x
  version: "6.5"
target:
  platform: aem_cloud
scope:
  products:
    - aem-sites
phases: []
`);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('phase'))).toBe(true);
  });

  // ── JSON Parsing ─────────────────────────────────────────

  it('should parse valid JSON config', () => {
    const config = validConfig();
    const result = parser.parseJSON(JSON.stringify(config));
    expect(result.valid).toBe(true);
    expect(result.config?.metadata.name).toBe('Test Migration');
  });

  it('should return errors for invalid JSON', () => {
    const result = parser.parseJSON('not json at all');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('JSON parse error');
  });

  // ── Validation ───────────────────────────────────────────

  it('should validate config against schema', () => {
    const result = parser.validate(validConfig());
    expect(result.valid).toBe(true);
  });

  it('should reject config with invalid version format', () => {
    const config = validConfig();
    config.metadata.version = 'invalid';
    const result = parser.validate(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('semver'))).toBe(true);
  });

  it('should reject config with invalid auth credentials format', () => {
    const config = validConfig();
    config.source.auth = { type: 'basic', credentials: 'inline-secret' };
    const result = parser.validate(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ENV_VAR'))).toBe(true);
  });

  it('should generate warnings for missing optional sections', () => {
    const config = validConfig();
    delete (config as Record<string, unknown>).notifications;
    const result = parser.validate(config);
    expect(result.warnings.some((w) => w.path === 'notifications')).toBe(true);
  });

  // ── Env Var Resolution ───────────────────────────────────

  it('should resolve environment variable references', () => {
    const original = process.env;
    process.env = {
      ...original,
      AEM_SOURCE_CREDS: 'resolved-source-creds',
      AEM_CLOUD_CREDS: 'resolved-cloud-creds',
    };

    const config = validConfig();
    const resolved = parser.resolveEnvVars(config);

    expect(resolved.source.auth?.credentials).toBe('resolved-source-creds');
    expect(resolved.target.auth?.credentials).toBe('resolved-cloud-creds');

    process.env = original;
  });

  it('should throw EnvVarError for missing env vars', () => {
    const original = process.env;
    process.env = { ...original };
    delete process.env.AEM_SOURCE_CREDS;

    const config = validConfig();
    expect(() => parser.resolveEnvVars(config)).toThrow(EnvVarError);

    process.env = original;
  });

  // ── Config Merging ───────────────────────────────────────

  it('should merge base config with overrides', () => {
    const base = validConfig();
    const override = {
      metadata: { name: 'Override Name' },
      target: { environmentId: 'override-env' },
    };

    const merged = parser.mergeConfigs(base, override);
    expect(merged.metadata.name).toBe('Override Name');
    expect(merged.metadata.version).toBe('1.0.0'); // Preserved from base
    expect(merged.target.environmentId).toBe('override-env');
  });

  it('should replace arrays entirely when merging', () => {
    const base = validConfig();
    const override = {
      phases: [
        {
          type: PhaseType.TESTING,
          enabled: true,
          retries: 0,
          continueOnError: false,
          concurrency: 1,
        },
      ],
    };

    const merged = parser.mergeConfigs(base, override);
    expect(merged.phases).toHaveLength(1);
    expect(merged.phases[0].type).toBe(PhaseType.TESTING);
  });

  // ── Template Generation ──────────────────────────────────

  it('should generate a template for known migration types', () => {
    const template = parser.generateTemplate('aem-onprem-to-cloud');
    expect(template).toContain('AEM 6.5');
    expect(template).toContain('metadata:');
    expect(template).toContain('source:');
    expect(template).toContain('phases:');
  });

  it('should fall back to default template for unknown types', () => {
    const template = parser.generateTemplate('unknown-type');
    expect(template).toContain('metadata:');
  });

  // ── YAML Serialization ──────────────────────────────────

  it('should convert config to YAML string', () => {
    const config = validConfig();
    const yamlStr = parser.toYAML(config);
    expect(yamlStr).toContain('name: Test Migration');
    expect(yamlStr).toContain('platform: aem_6x');
  });
});

describe('Template Generation', () => {
  it.each(TEMPLATE_NAMES)('should generate valid template for %s', (templateName) => {
    const template = getTemplate(templateName as TemplateName);
    expect(template).toBeTruthy();
    expect(template.length).toBeGreaterThan(100);
    expect(template).toContain('metadata:');
    expect(template).toContain('source:');
    expect(template).toContain('target:');
    expect(template).toContain('phases:');
  });

  it('should return all templates in the list', () => {
    const list = getTemplateList();
    expect(list).toHaveLength(7);
    expect(list.every((t) => t.name && t.label && t.description)).toBe(true);
  });

  it('should produce parseable YAML for each template', () => {
    const parser = new MigrationConfigParser();
    for (const name of TEMPLATE_NAMES) {
      const template = getTemplate(name as TemplateName);
      const result = parser.parseYAML(template);
      expect(result.valid).toBe(true);
      expect(result.config).not.toBeNull();
    }
  });
});

describe('MigrationConfigExecutor', () => {
  let executor: MigrationConfigExecutor;

  beforeEach(() => {
    executor = new MigrationConfigExecutor();
  });

  // ── fromConfig ───────────────────────────────────────────

  it('should create a MigrationProject from config', () => {
    const config = validConfig();
    const project = executor.fromConfig(config);

    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Test Migration');
    expect(project.productsInScope).toEqual([AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS]);
    expect(project.phases).toHaveLength(2);
    expect(project.phases[0].type).toBe(PhaseType.ASSESSMENT);
  });

  // ── execute ──────────────────────────────────────────────

  it('should execute a migration from config', () => {
    const config = validConfig();
    const result = executor.execute(config);

    expect(result.status).toBe('created');
    expect(result.migrationId).toBeTruthy();
    expect(result.project.name).toBe('Test Migration');
    expect(result.message).toContain('2 phases');
  });

  // ── dryRun ───────────────────────────────────────────────

  it('should return dry-run preview without executing', () => {
    const config = validConfig();
    const result = executor.dryRun(config);

    expect(result.valid).toBe(true);
    expect(result.migrationName).toBe('Test Migration');
    expect(result.phasesPlanned).toHaveLength(2);
    expect(result.rulesCount).toBe(1);
    expect(result.rollbackEnabled).toBe(true);
  });

  it('should warn about disabled phases in dry run', () => {
    const config = validConfig();
    config.phases[1].enabled = false;
    const result = executor.dryRun(config);

    expect(result.warnings.some((w) => w.includes('disabled'))).toBe(true);
  });

  it('should warn about disabled rollback', () => {
    const config = validConfig();
    config.rollback = { ...config.rollback!, enabled: false };
    const result = executor.dryRun(config);

    expect(result.warnings.some((w) => w.includes('Rollback is disabled'))).toBe(true);
  });

  // ── diff ─────────────────────────────────────────────────

  it('should detect differences between two configs', () => {
    const configA = validConfig();
    const configB = validConfig();
    configB.metadata.name = 'Changed Name';
    configB.target.environmentId = 'new-env';

    const diff = executor.diff(configA, configB);

    expect(diff.entries.length).toBeGreaterThan(0);
    expect(diff.entries.some((e) => e.path === 'metadata.name')).toBe(true);
    expect(diff.summary).toContain('changed');
  });

  it('should report no differences for identical configs', () => {
    const config = validConfig();
    const diff = executor.diff(config, config);

    expect(diff.entries).toHaveLength(0);
    expect(diff.summary).toContain('No differences');
  });

  it('should detect added phases', () => {
    const configA = validConfig();
    const configB = validConfig();
    configB.phases.push({
      type: PhaseType.TESTING,
      enabled: true,
      retries: 0,
      continueOnError: false,
      concurrency: 1,
    });

    const diff = executor.diff(configA, configB);
    expect(diff.entries.some((e) => e.type === 'added')).toBe(true);
  });

  // ── exportConfig ─────────────────────────────────────────

  it('should export a migration project as YAML config', () => {
    const config = validConfig();
    const project = executor.fromConfig(config);
    const exported = executor.exportConfig(project);

    expect(exported).toContain('name: Test Migration');
    expect(exported).toContain('platform: aem_6x');
    expect(exported).toContain('version:');

    // Verify the exported YAML is parseable
    const parser = new MigrationConfigParser();
    const result = parser.parseYAML(exported);
    expect(result.valid).toBe(true);
  });
});

describe('Zod Schema', () => {
  it('should accept valid config objects', () => {
    const result = MigrationConfigSchema.safeParse(validConfig());
    expect(result.success).toBe(true);
  });

  it('should reject missing metadata name', () => {
    const config = validConfig();
    (config.metadata as Record<string, unknown>).name = '';
    const result = MigrationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('should reject empty products array', () => {
    const config = validConfig();
    config.scope.products = [] as never;
    const result = MigrationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('should apply defaults for optional fields', () => {
    const result = MigrationConfigSchema.safeParse({
      metadata: { name: 'Test', version: '1.0.0', author: 'Me' },
      source: { platform: 'aem_6x', version: '6.5' },
      target: { platform: 'aem_cloud' },
      scope: { products: ['aem-sites'] },
      phases: [{ type: 'assessment' }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phases[0].retries).toBe(2); // Default
      expect(result.data.phases[0].concurrency).toBe(10); // Default
      expect(result.data.rules).toEqual([]); // Default empty array
    }
  });
});
