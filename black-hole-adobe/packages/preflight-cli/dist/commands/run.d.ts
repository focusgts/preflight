/**
 * `preflight run` command
 *
 * Scans AEM project files and reports Cloud Manager quality gate violations.
 */
import { Command } from 'commander';
export declare function registerRunCommand(program: Command): void;
interface RunOptions {
    staged?: boolean;
    since?: string;
    format: string;
    failOn: string;
    cloud?: boolean;
    config?: string;
}
export declare function runCommand(paths: string[], options: RunOptions): Promise<number>;
export {};
//# sourceMappingURL=run.d.ts.map