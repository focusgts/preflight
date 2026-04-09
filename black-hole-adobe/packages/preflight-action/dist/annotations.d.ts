/**
 * Emit GitHub Checks inline annotations for pre-flight findings.
 *
 * Maps findings to workflow commands so they appear as inline
 * annotations on the PR diff in the Files Changed tab.
 */
import type { PreFlightFinding } from '@blackhole/preflight-engine';
/**
 * Emit GitHub Actions workflow annotations for each finding.
 * Groups by severity and truncates at the per-severity limit.
 */
export declare function emitAnnotations(findings: PreFlightFinding[]): void;
