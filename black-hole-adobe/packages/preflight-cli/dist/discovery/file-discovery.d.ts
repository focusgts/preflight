/**
 * File Discovery
 *
 * Walks the project directory tree to find scannable AEM files.
 * Honors .gitignore patterns and config include/exclude globs.
 */
import type { PreFlightConfig } from '../config/config-loader';
/**
 * Discover files to scan based on paths, config, and .gitignore.
 */
export declare function discoverFiles(scanPaths: string[], config: PreFlightConfig): Promise<string[]>;
//# sourceMappingURL=file-discovery.d.ts.map