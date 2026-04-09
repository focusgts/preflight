"use strict";
/**
 * @blackhole/preflight CLI
 *
 * Local Cloud Manager pre-flight check for AEM projects.
 * Runs the same rule engine used by the web UI, entirely offline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const run_1 = require("./commands/run");
const explain_1 = require("./commands/explain");
const list_rules_1 = require("./commands/list-rules");
const init_1 = require("./commands/init");
const login_1 = require("./commands/login");
const program = new commander_1.Command();
program
    .name('preflight')
    .description('Cloud Manager pre-flight check for AEM as a Cloud Service projects')
    .version('0.1.0');
(0, run_1.registerRunCommand)(program);
(0, explain_1.registerExplainCommand)(program);
(0, list_rules_1.registerListRulesCommand)(program);
(0, init_1.registerInitCommand)(program);
(0, login_1.registerLoginCommand)(program);
program.parse(process.argv);
//# sourceMappingURL=index.js.map