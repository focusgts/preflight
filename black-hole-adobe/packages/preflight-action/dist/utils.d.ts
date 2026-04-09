/**
 * Utility helpers for the Pre-Flight GitHub Action.
 */
import type { PreFlightSeverity, PreFlightFinding } from '@blackhole/preflight-engine';
export declare const SEVERITY_ORDER: Record<PreFlightSeverity, number>;
export type FailOnLevel = PreFlightSeverity | 'none';
/**
 * Check whether a finding's severity meets or exceeds a given threshold.
 */
export declare function severityAtOrAbove(finding: PreFlightFinding, threshold: FailOnLevel): boolean;
/**
 * Count findings grouped by severity.
 */
export declare function countBySeverity(findings: PreFlightFinding[]): {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
};
/**
 * Truncate a message to fit within GitHub annotation limits.
 * GitHub has a 64KB limit per annotation message.
 */
export declare function truncateForAnnotation(message: string, maxLen?: number): string;
/**
 * File extensions supported by the engine scanner.
 */
export declare const SUPPORTED_EXTENSIONS: Set<string>;
/**
 * Check if a file path has a supported extension.
 */
export declare function isSupportedFile(filePath: string): boolean;
