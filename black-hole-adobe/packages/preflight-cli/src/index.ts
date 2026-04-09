/**
 * @blackhole/preflight CLI
 *
 * Local Cloud Manager pre-flight check for AEM projects.
 * Runs the same rule engine used by the web UI, entirely offline.
 */

import { Command } from 'commander';
import { registerRunCommand } from './commands/run';
import { registerExplainCommand } from './commands/explain';
import { registerListRulesCommand } from './commands/list-rules';
import { registerInitCommand } from './commands/init';
import { registerLoginCommand } from './commands/login';

const program = new Command();

program
  .name('preflight')
  .description(
    'Cloud Manager pre-flight check for AEM as a Cloud Service projects'
  )
  .version('0.1.0');

registerRunCommand(program);
registerExplainCommand(program);
registerListRulesCommand(program);
registerInitCommand(program);
registerLoginCommand(program);

program.parse(process.argv);
