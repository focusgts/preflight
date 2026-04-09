"use strict";
/**
 * `preflight init` command
 *
 * Creates .preflightrc.json and optionally installs a pre-commit hook.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInitCommand = registerInitCommand;
exports.initCommand = initCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function registerInitCommand(program) {
    program
        .command('init')
        .description('Initialize pre-flight configuration and optional git hook')
        .action(() => {
        const exitCode = initCommand(process.cwd());
        process.exit(exitCode);
    });
}
function initCommand(cwd) {
    const configPath = path.join(cwd, '.preflightrc.json');
    // Write config
    if (fs.existsSync(configPath)) {
        process.stderr.write(`.preflightrc.json already exists at ${configPath}. Not overwriting.\n`);
    }
    else {
        fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
        process.stdout.write(`Created ${configPath}\n`);
    }
    // Try to install pre-commit hook
    const huskyDir = path.join(cwd, '.husky');
    const gitDir = path.join(cwd, '.git');
    if (fs.existsSync(huskyDir)) {
        const hookPath = path.join(huskyDir, 'pre-commit');
        if (fs.existsSync(hookPath)) {
            process.stderr.write(`.husky/pre-commit already exists. Not overwriting.\n`);
        }
        else {
            fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });
            process.stdout.write(`Created Husky pre-commit hook at ${hookPath}\n`);
        }
    }
    else if (fs.existsSync(gitDir)) {
        const hooksDir = path.join(gitDir, 'hooks');
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }
        const hookPath = path.join(hooksDir, 'pre-commit');
        if (fs.existsSync(hookPath)) {
            process.stderr.write(`.git/hooks/pre-commit already exists. Not overwriting.\n`);
        }
        else {
            fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });
            process.stdout.write(`Created git pre-commit hook at ${hookPath}\n`);
        }
    }
    else {
        process.stdout.write('No .git directory or .husky found. Skipping pre-commit hook.\n');
    }
    return 0;
}
//# sourceMappingURL=init.js.map