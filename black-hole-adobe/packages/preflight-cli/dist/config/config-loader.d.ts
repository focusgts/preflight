/**
 * Config Loader
 *
 * Loads .preflightrc.json configuration, walking up from cwd to git root.
 */
export interface PreFlightConfig {
    include?: string[];
    exclude?: string[];
    failOn?: string;
    rules?: Record<string, 'off' | 'warn' | 'error'>;
    mode?: 'local' | 'cloud';
}
/**
 * Load config from a specific path or by walking up the directory tree.
 * Returns an empty config if none found.
 */
export declare function loadConfig(configPath?: string): PreFlightConfig;
//# sourceMappingURL=config-loader.d.ts.map