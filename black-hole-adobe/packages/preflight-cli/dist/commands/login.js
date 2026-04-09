"use strict";
/**
 * `preflight login` command (stub)
 *
 * Cloud authentication is not yet implemented.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLoginCommand = registerLoginCommand;
function registerLoginCommand(program) {
    program
        .command('login')
        .description('Link to paid cloud tier (coming soon)')
        .action(() => {
        process.stdout.write('Cloud mode coming soon. Visit https://blackhole.focusgts.com/preflight for now.\n');
        process.exit(0);
    });
}
//# sourceMappingURL=login.js.map