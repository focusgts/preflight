/**
 * Command Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { runCommand } from '../src/commands/run';
import { explainCommand } from '../src/commands/explain';
import { listRulesCommand } from '../src/commands/list-rules';
import { initCommand } from '../src/commands/init';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('run command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(() => {
    stdoutOutput = '';
    stderrOutput = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk);
      return true;
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('finds violations in bad-project', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'human', failOn: 'critical' }
    );
    expect(exitCode).toBe(1);
    expect(stdoutOutput).toContain('BLOCKER');
  });

  it('clean-project returns exit 0', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'clean-project')],
      { format: 'human', failOn: 'critical' }
    );
    expect(exitCode).toBe(0);
  });

  it('outputs JSON format', async () => {
    await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'json', failOn: 'critical' }
    );
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.findings).toBeDefined();
    expect(parsed.findings.length).toBeGreaterThan(0);
  });

  it('outputs SARIF format', async () => {
    await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'sarif', failOn: 'critical' }
    );
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it('outputs JUnit format', async () => {
    await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'junit', failOn: 'critical' }
    );
    expect(stdoutOutput).toContain('<?xml');
    expect(stdoutOutput).toContain('<failure');
  });

  it('--fail-on none always exits 0', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'human', failOn: 'none' }
    );
    expect(exitCode).toBe(0);
  });

  it('--fail-on major exits 1 when major findings exist', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'json', failOn: 'major' }
    );
    expect(exitCode).toBe(1);
  });

  it('--cloud prints coming-soon message', async () => {
    const exitCode = await runCommand([], {
      format: 'human',
      failOn: 'critical',
      cloud: true,
    });
    expect(exitCode).toBe(0);
    expect(stdoutOutput).toContain('Cloud mode coming soon');
  });

  it('returns exit 2 for invalid format', async () => {
    const exitCode = await runCommand([], {
      format: 'invalid',
      failOn: 'critical',
    });
    expect(exitCode).toBe(2);
  });
});

describe('explain command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(() => {
    stdoutOutput = '';
    stderrOutput = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk);
      return true;
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('prints rule details for a valid rule ID', () => {
    const exitCode = explainCommand('JavaCompat:SunPackages');
    expect(exitCode).toBe(0);
    expect(stdoutOutput).toContain('JavaCompat:SunPackages');
    expect(stdoutOutput).toContain('sun.*');
    expect(stdoutOutput).toContain('Remediation');
  });

  it('suggests similar rules when not found', () => {
    const exitCode = explainCommand('SunPackages');
    expect(exitCode).toBe(1);
    expect(stderrOutput).toContain('Did you mean');
    expect(stderrOutput).toContain('JavaCompat:SunPackages');
  });

  it('shows not-found message for totally wrong ID', () => {
    const exitCode = explainCommand('NonExistentRuleXYZ123');
    expect(exitCode).toBe(1);
    expect(stderrOutput).toContain('not found');
  });
});

describe('list-rules command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stdoutOutput: string;

  beforeEach(() => {
    stdoutOutput = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('lists all 16 rules in table format', () => {
    const exitCode = listRulesCommand('table');
    expect(exitCode).toBe(0);
    expect(stdoutOutput).toContain('16 total');
    expect(stdoutOutput).toContain('CQRules:ConnectionTimeoutMechanism');
    expect(stdoutOutput).toContain('JavaCompat:SunPackages');
  });

  it('outputs JSON format with all rules', () => {
    const exitCode = listRulesCommand('json');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdoutOutput);
    expect(parsed).toHaveLength(16);
    expect(parsed[0].id).toBeDefined();
    expect(parsed[0].severity).toBeDefined();
  });
});

describe('init command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;
  let tmpDir: string;

  beforeEach(() => {
    stdoutOutput = '';
    stderrOutput = '';
    tmpDir = fs.mkdtempSync('/tmp/preflight-test-');
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk);
      return true;
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .preflightrc.json', () => {
    const exitCode = initCommand(tmpDir);
    expect(exitCode).toBe(0);

    const configPath = path.join(tmpDir, '.preflightrc.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.failOn).toBe('critical');
    expect(config.mode).toBe('local');
  });

  it('does not overwrite existing .preflightrc.json', () => {
    const configPath = path.join(tmpDir, '.preflightrc.json');
    fs.writeFileSync(configPath, '{"custom": true}');

    initCommand(tmpDir);

    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('"custom"');
    expect(stderrOutput).toContain('already exists');
  });

  it('creates git hook when .git exists', () => {
    const gitDir = path.join(tmpDir, '.git', 'hooks');
    fs.mkdirSync(gitDir, { recursive: true });

    initCommand(tmpDir);

    const hookPath = path.join(gitDir, 'pre-commit');
    expect(fs.existsSync(hookPath)).toBe(true);
    const hookContent = fs.readFileSync(hookPath, 'utf-8');
    expect(hookContent).toContain('@blackhole/preflight');
  });
});
