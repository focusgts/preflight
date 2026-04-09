/**
 * Emit GitHub Checks inline annotations for pre-flight findings.
 *
 * Maps findings to workflow commands so they appear as inline
 * annotations on the PR diff in the Files Changed tab.
 */

import * as core from '@actions/core';
import type { PreFlightFinding, PreFlightSeverity } from '@blackhole/preflight-engine';
import { truncateForAnnotation } from './utils';

/**
 * Maximum annotations per severity level per step.
 * GitHub silently drops annotations beyond this limit.
 */
const MAX_ANNOTATIONS_PER_SEVERITY = 10;

type AnnotationLevel = 'error' | 'warning' | 'notice';

function severityToAnnotationLevel(severity: PreFlightSeverity): AnnotationLevel {
  switch (severity) {
    case 'blocker':
    case 'critical':
      return 'error';
    case 'major':
      return 'warning';
    case 'minor':
      return 'notice';
  }
}

/**
 * Emit GitHub Actions workflow annotations for each finding.
 * Groups by severity and truncates at the per-severity limit.
 */
export function emitAnnotations(findings: PreFlightFinding[]): void {
  if (findings.length === 0) return;

  const bySeverity: Record<PreFlightSeverity, PreFlightFinding[]> = {
    blocker: [],
    critical: [],
    major: [],
    minor: [],
  };

  for (const f of findings) {
    bySeverity[f.severity].push(f);
  }

  for (const severity of ['blocker', 'critical', 'major', 'minor'] as PreFlightSeverity[]) {
    const group = bySeverity[severity];
    const emitCount = Math.min(group.length, MAX_ANNOTATIONS_PER_SEVERITY);
    const level = severityToAnnotationLevel(severity);

    for (let i = 0; i < emitCount; i++) {
      const f = group[i];
      const title = `[${f.ruleId}] ${f.ruleName}`;
      const body = truncateForAnnotation(
        `${f.message}. Remediation: ${f.remediation}`
      );

      const properties: core.AnnotationProperties = {
        title,
        file: f.filePath,
        startLine: f.line,
      };

      switch (level) {
        case 'error':
          core.error(body, properties);
          break;
        case 'warning':
          core.warning(body, properties);
          break;
        case 'notice':
          core.notice(body, properties);
          break;
      }
    }

    if (group.length > MAX_ANNOTATIONS_PER_SEVERITY) {
      core.warning(
        `${group.length - MAX_ANNOTATIONS_PER_SEVERITY} additional ${severity} finding(s) not shown as annotations (limit: ${MAX_ANNOTATIONS_PER_SEVERITY} per severity).`
      );
    }
  }
}
