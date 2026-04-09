/**
 * Sticky PR comment with pre-flight results.
 *
 * Creates or updates a single comment on the PR. Uses a hidden
 * HTML marker to find the existing comment on re-runs.
 */
import type { PreFlightFinding } from '@blackhole/preflight-engine';
/**
 * Post or update the sticky pre-flight PR comment.
 */
export declare function postOrUpdateComment(token: string, findings: PreFlightFinding[]): Promise<void>;
/**
 * Build the markdown body for the PR comment.
 */
export declare function buildCommentBody(findings: PreFlightFinding[]): string;
