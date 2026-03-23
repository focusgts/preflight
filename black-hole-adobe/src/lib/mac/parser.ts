/**
 * Migration-as-Code Config Parser
 *
 * Parses YAML/JSON migration configurations, validates them against
 * the Zod schema, resolves environment variable references, and
 * supports config merging for environment-specific overrides.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  MigrationConfigSchema,
  type MigrationConfig,
  type ConfigValidationResult,
  type ConfigValidationError,
  type ConfigValidationWarning,
  type TemplateName,
  TEMPLATE_NAMES,
} from './schema';
import { getTemplate } from './templates';

// ============================================================
// Utility Types
// ============================================================

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? U[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

// ============================================================
// Parser
// ============================================================

export class MigrationConfigParser {
  /**
   * Parse a YAML string into a validated MigrationConfig.
   * Returns a validation result with errors if the config is invalid.
   */
  parseYAML(content: string): ConfigValidationResult {
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (err) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        warnings: [],
        config: null,
      };
    }

    if (raw === null || raw === undefined || typeof raw !== 'object') {
      return {
        valid: false,
        errors: [{ path: '', message: 'Config must be a YAML object, not a scalar or array' }],
        warnings: [],
        config: null,
      };
    }

    return this.validate(raw);
  }

  /**
   * Parse a JSON string into a validated MigrationConfig.
   */
  parseJSON(content: string): ConfigValidationResult {
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (err) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        warnings: [],
        config: null,
      };
    }

    return this.validate(raw);
  }

  /**
   * Validate a raw object against the MigrationConfig schema.
   * Returns structured errors and warnings.
   */
  validate(raw: unknown): ConfigValidationResult {
    const result = MigrationConfigSchema.safeParse(raw);
    const warnings = this.generateWarnings(raw);

    if (result.success) {
      return {
        valid: true,
        errors: [],
        warnings,
        config: result.data,
      };
    }

    const errors: ConfigValidationError[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return {
      valid: false,
      errors,
      warnings,
      config: null,
    };
  }

  /**
   * Replace ${ENV_VAR} references in auth fields with actual
   * environment variable values. Throws if a referenced var is missing.
   */
  resolveEnvVars(config: MigrationConfig): MigrationConfig {
    const resolved = structuredClone(config);

    const resolve = (value: string): string => {
      const match = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
      if (!match) return value;
      const envVar = match[1];
      const envValue = process.env[envVar];
      if (envValue === undefined) {
        throw new EnvVarError(`Environment variable ${envVar} is not set`);
      }
      return envValue;
    };

    if (resolved.source.auth) {
      resolved.source.auth.credentials = resolve(resolved.source.auth.credentials);
    }
    if (resolved.target.auth) {
      resolved.target.auth.credentials = resolve(resolved.target.auth.credentials);
    }
    if (resolved.notifications?.slack) {
      resolved.notifications.slack.webhookUrl = resolve(
        resolved.notifications.slack.webhookUrl,
      );
    }

    return resolved;
  }

  /**
   * Deep-merge a base config with an override config. The override
   * takes precedence for scalar values; arrays are replaced entirely.
   */
  mergeConfigs(
    base: MigrationConfig,
    override: DeepPartial<MigrationConfig>,
  ): MigrationConfig {
    const merged = structuredClone(base);

    if (override.metadata) {
      Object.assign(merged.metadata, override.metadata);
    }
    if (override.source) {
      Object.assign(merged.source, override.source);
    }
    if (override.target) {
      Object.assign(merged.target, override.target);
    }
    if (override.scope) {
      Object.assign(merged.scope, override.scope);
    }
    if (override.phases) {
      merged.phases = override.phases as MigrationConfig['phases'];
    }
    if (override.rules) {
      merged.rules = override.rules as MigrationConfig['rules'];
    }
    if (override.compliance) {
      merged.compliance = {
        ...merged.compliance,
        ...override.compliance,
      };
    }
    if (override.notifications) {
      merged.notifications = {
        ...merged.notifications,
        ...override.notifications,
      };
    }
    if (override.rollback) {
      merged.rollback = {
        ...merged.rollback,
        ...override.rollback,
      };
    }

    return merged;
  }

  /**
   * Generate a starter YAML config for a given migration type.
   * If the type matches a known template, returns it directly.
   */
  generateTemplate(migrationType: string): string {
    const templateName = migrationType as TemplateName;
    if (TEMPLATE_NAMES.includes(templateName)) {
      return getTemplate(templateName);
    }

    // Return a generic skeleton for unknown types
    return getTemplate('aem-onprem-to-cloud');
  }

  /**
   * Convert a MigrationConfig object to a YAML string.
   */
  toYAML(config: MigrationConfig): string {
    return stringifyYaml(config, { lineWidth: 100 });
  }

  // ── Private ────────────────────────────────────────────────

  private generateWarnings(raw: unknown): ConfigValidationWarning[] {
    const warnings: ConfigValidationWarning[] = [];
    if (!raw || typeof raw !== 'object') return warnings;

    const obj = raw as Record<string, unknown>;

    // Warn if no compliance section
    if (!obj.compliance) {
      warnings.push({
        path: 'compliance',
        message: 'No compliance configuration specified.',
        suggestion: 'Add a compliance section with frameworks like gdpr or ccpa.',
      });
    }

    // Warn if no rollback section
    if (!obj.rollback) {
      warnings.push({
        path: 'rollback',
        message: 'No rollback configuration specified.',
        suggestion: 'Add a rollback section with errorThresholdPercent for safety.',
      });
    }

    // Warn if no notifications
    if (!obj.notifications) {
      warnings.push({
        path: 'notifications',
        message: 'No notification channels configured.',
        suggestion: 'Add Slack or email notifications to stay informed.',
      });
    }

    // Warn about inline credentials
    const source = obj.source as Record<string, unknown> | undefined;
    if (source?.auth) {
      const auth = source.auth as Record<string, unknown>;
      if (typeof auth.credentials === 'string' && !auth.credentials.startsWith('${')) {
        warnings.push({
          path: 'source.auth.credentials',
          message: 'Credentials appear to be inline. Use ${ENV_VAR} references.',
          suggestion: 'Replace with ${SOURCE_API_KEY} and set the env var.',
        });
      }
    }

    return warnings;
  }
}

// ============================================================
// Error Class
// ============================================================

export class EnvVarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvVarError';
  }
}
