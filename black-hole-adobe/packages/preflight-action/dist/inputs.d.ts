/**
 * Parse and validate GitHub Action inputs.
 */
import type { FailOnLevel } from './utils';
export interface ActionInputs {
    failOn: FailOnLevel;
    scan: 'changed' | 'all';
    configFile: string;
    comment: boolean;
    annotations: boolean;
    sarifUpload: boolean;
    token: string;
}
/**
 * Read and validate all action inputs from the GitHub Actions environment.
 */
export declare function parseInputs(): ActionInputs;
