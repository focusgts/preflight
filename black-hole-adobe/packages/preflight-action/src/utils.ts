/**
 * Utility helpers for the Pre-Flight GitHub Action.
 */

import type { PreFlightSeverity, PreFlightFinding } from '@blackhole/preflight-engine';

export const SEVERITY_ORDER: Record<PreFlightSeverity, number> = {
  blocker: 4,
  critical: 3,
  major: 2,
  minor: 1,
};

export type FailOnLevel = PreFlightSeverity | 'none';

/**
 * Check whether a finding's severity meets or exceeds a given threshold.
 */
export function severityAtOrAbove(
  finding: PreFlightFinding,
  threshold: FailOnLevel
): boolean {
  if (threshold === 'none') return false;
  return SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER[threshold];
}

/**
 * Count findings grouped by severity.
 */
export function countBySeverity(findings: PreFlightFinding[]): {
  blocker: number;
  critical: number;
  major: number;
  minor: number;
} {
  const counts = { blocker: 0, critical: 0, major: 0, minor: 0 };
  for (const f of findings) {
    if (f.severity in counts) {
      counts[f.severity]++;
    }
  }
  return counts;
}

/**
 * Truncate a message to fit within GitHub annotation limits.
 * GitHub has a 64KB limit per annotation message.
 */
export function truncateForAnnotation(message: string, maxLen = 8192): string {
  if (message.length <= maxLen) return message;
  return message.slice(0, maxLen - 3) + '...';
}

/**
 * File extensions supported by the engine scanner.
 */
export const SUPPORTED_EXTENSIONS = new Set([
  '.java',
  '.jsp',
  '.jspx',
  '.xml',
  '.cfg.json',
  '.properties',
  '.yaml',
  '.yml',
  '.html',
  '.htl',
]);

/**
 * Check if a file path has a supported extension.
 */
export function isSupportedFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}
