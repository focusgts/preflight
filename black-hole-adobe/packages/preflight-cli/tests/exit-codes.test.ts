/**
 * Exit Code Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { runCommand } from '../src/commands/run';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('Exit Codes', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('clean code returns exit 0', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'clean-project')],
      { format: 'json', failOn: 'critical' }
    );
    expect(exitCode).toBe(0);
  });

  it('blocker findings return exit 1 with default fail-on', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'json', failOn: 'critical' }
    );
    expect(exitCode).toBe(1);
  });

  it('--fail-on major exits 1 when major findings exist', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'json', failOn: 'major' }
    );
    expect(exitCode).toBe(1);
  });

  it('--fail-on none always exits 0', async () => {
    const exitCode = await runCommand(
      [path.join(FIXTURES, 'bad-project')],
      { format: 'json', failOn: 'none' }
    );
    expect(exitCode).toBe(0);
  });

  it('bad config path returns exit 2', async () => {
    const exitCode = await runCommand(
      [],
      { format: 'invalid-format', failOn: 'critical' }
    );
    expect(exitCode).toBe(2);
  });
});
