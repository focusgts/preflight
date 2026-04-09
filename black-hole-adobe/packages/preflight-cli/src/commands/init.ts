/**
 * `preflight init` command
 *
 * Creates .preflightrc.json and optionally installs a pre-commit hook.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_CONFIG = {
  include: ['**/*.java', '**/*.xml', '**/*.cfg.json'],
  exclude: ['**/node_modules/**', '**/target/**', '**/generated/**'],
  failOn: 'critical',
  rules: {},
  mode: 'local',
};

const HOOK_CONTENT = `#!/bin/sh
npx @blackhole/preflight run --staged --fail-on critical
`;

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize pre-flight configuration and optional git hook')
    .action(() => {
      const exitCode = initCommand(process.cwd());
      process.exit(exitCode);
    });
}

export function initCommand(cwd: string): number {
  const configPath = path.join(cwd, '.preflightrc.json');

  // Write config
  if (fs.existsSync(configPath)) {
    process.stderr.write(
      `.preflightrc.json already exists at ${configPath}. Not overwriting.\n`
    );
  } else {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
    process.stdout.write(`Created ${configPath}\n`);
  }

  // Try to install pre-commit hook
  const huskyDir = path.join(cwd, '.husky');
  const gitDir = path.join(cwd, '.git');

  if (fs.existsSync(huskyDir)) {
    const hookPath = path.join(huskyDir, 'pre-commit');
    if (fs.existsSync(hookPath)) {
      process.stderr.write(
        `.husky/pre-commit already exists. Not overwriting.\n`
      );
    } else {
      fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });
      process.stdout.write(`Created Husky pre-commit hook at ${hookPath}\n`);
    }
  } else if (fs.existsSync(gitDir)) {
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
    const hookPath = path.join(hooksDir, 'pre-commit');
    if (fs.existsSync(hookPath)) {
      process.stderr.write(
        `.git/hooks/pre-commit already exists. Not overwriting.\n`
      );
    } else {
      fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });
      process.stdout.write(`Created git pre-commit hook at ${hookPath}\n`);
    }
  } else {
    process.stdout.write(
      'No .git directory or .husky found. Skipping pre-commit hook.\n'
    );
  }

  return 0;
}
