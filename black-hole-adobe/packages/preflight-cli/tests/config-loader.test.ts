/**
 * Config Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from '../src/config/config-loader';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('Config Loader', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('loads a valid config from a specific path', () => {
    const configPath = path.join(FIXTURES, 'with-config', '.preflightrc.json');
    const config = loadConfig(configPath);

    expect(config.include).toEqual(['**/*.java']);
    expect(config.exclude).toEqual(['**/generated/**']);
    expect(config.failOn).toBe('critical');
    expect(config.rules).toEqual({ 'CQBP-72': 'off' });
    expect(config.mode).toBe('local');
  });

  it('returns empty config when file does not exist', () => {
    const config = loadConfig('/tmp/non-existent/.preflightrc.json');
    expect(config).toEqual({});
  });

  it('returns empty config for invalid JSON', () => {
    const tmpPath = path.join('/tmp', `preflight-test-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, 'not json {{{');
    try {
      const config = loadConfig(tmpPath);
      expect(config).toEqual({});
      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('warns on unknown keys', () => {
    const tmpPath = path.join('/tmp', `preflight-test-${Date.now()}.json`);
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({ unknownKey: true, include: ['**/*.java'] })
    );
    try {
      const config = loadConfig(tmpPath);
      expect(config.include).toEqual(['**/*.java']);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown key "unknownKey"')
      );
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('validates rule values', () => {
    const tmpPath = path.join('/tmp', `preflight-test-${Date.now()}.json`);
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({ rules: { 'CQBP-72': 'off', 'CQBP-84': 'invalid' } })
    );
    try {
      const config = loadConfig(tmpPath);
      expect(config.rules?.['CQBP-72']).toBe('off');
      expect(config.rules?.['CQBP-84']).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid value "invalid"')
      );
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('handles non-object root gracefully', () => {
    const tmpPath = path.join('/tmp', `preflight-test-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, '"just a string"');
    try {
      const config = loadConfig(tmpPath);
      expect(config).toEqual({});
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });
});
