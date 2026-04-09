/**
 * Tests for config loading and merging.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __setConfigValue,
  __clearConfigValues,
} from './__mocks__/vscode';
import { getConfig, loadRcConfig } from '../src/config';

beforeEach(() => {
  __clearConfigValues();
});

describe('getConfig', () => {
  it('should return defaults when no config is set', () => {
    const config = getConfig();
    expect(config.enable).toBe(true);
    expect(config.runOnType).toBe(true);
    expect(config.runOnSave).toBe(true);
    expect(config.severityThreshold).toBe('info');
    expect(config.rules).toEqual({});
  });

  it('should read VS Code settings', () => {
    __setConfigValue('preflight.enable', false);
    __setConfigValue('preflight.severityThreshold', 'major');
    const config = getConfig();
    expect(config.enable).toBe(false);
    expect(config.severityThreshold).toBe('major');
  });

  it('should handle missing .preflightrc.json gracefully', async () => {
    // loadRcConfig should not throw when file is missing
    const result = await loadRcConfig();
    expect(result).toBeNull();
    // getConfig still works
    const config = getConfig();
    expect(config.enable).toBe(true);
  });

  it('should have correct rule overrides shape', () => {
    __setConfigValue('preflight.rules', {
      'CQBP-84': 'off',
      'JavaCompat:SunPackages': 'warn',
    });
    const config = getConfig();
    expect(config.rules).toEqual({
      'CQBP-84': 'off',
      'JavaCompat:SunPackages': 'warn',
    });
  });

  it('should merge VS Code settings with defaults', () => {
    __setConfigValue('preflight.runOnType', false);
    const config = getConfig();
    // runOnType overridden
    expect(config.runOnType).toBe(false);
    // others remain default
    expect(config.enable).toBe(true);
    expect(config.runOnSave).toBe(true);
  });
});
