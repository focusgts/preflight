/**
 * `preflight login` command (stub)
 *
 * Cloud authentication is not yet implemented.
 */

import { Command } from 'commander';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Link to paid cloud tier (coming soon)')
    .action(() => {
      process.stdout.write(
        'Cloud mode coming soon. Visit https://blackhole.focusgts.com/preflight for now.\n'
      );
      process.exit(0);
    });
}
