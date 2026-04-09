/**
 * JSON Output Formatter
 *
 * Outputs the raw PreFlightReport as formatted JSON.
 */

import type { PreFlightReport } from '@blackhole/preflight-engine';

export function formatJson(report: PreFlightReport): string {
  return JSON.stringify(report, null, 2) + '\n';
}
