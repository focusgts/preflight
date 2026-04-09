/**
 * SARIF file generation for GitHub Code Scanning integration.
 *
 * Generates the SARIF 2.1.0 file and writes it to disk.
 * Actual upload to GitHub Code Scanning requires a subsequent
 * github/codeql-action/upload-sarif@v3 step in the workflow.
 */
import type { PreFlightReport } from '@blackhole/preflight-engine';
/**
 * Generate a SARIF 2.1.0 log from a pre-flight report.
 */
export declare function generateSarif(report: PreFlightReport): string;
/**
 * Write SARIF file to RUNNER_TEMP and set the sarif-path output.
 */
export declare function writeSarifFile(report: PreFlightReport): string;
